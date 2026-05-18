import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type {
  AdasSignalFrame,
  DriverContext,
  InterpretedMetrics,
  ReasoningTrigger,
  SessionMode,
} from "@eva/types";
import { DriverContextManager } from "../context/driver-context.js";
import { checkThresholds } from "../triggers/thresholds.js";
import { runReasoningLoop } from "../agent/loop.js";
import { createOrGetUser } from "../memory/user.js";
import { createSessionRecord, closeSessionRecord } from "../memory/session-record.js";
import { runSessionAnalyser } from "../memory/analyser/session-analyser.js";
import { transcribeAudio } from "../voice/asr.js";
import { synthesiseSpeech } from "../voice/tts.js";

/**
 * WS message types sent to the client.
 */
export type ServerMessage =
  | { type: "session_started"; sessionId: string; driverId: string }
  | { type: "eva_response"; text: string; requestId: string; trigger: string }
  | { type: "eva_audio"; audioBase64: string; requestId: string }
  | { type: "asr_transcript"; transcript: string; confidence: number }
  | { type: "context_update"; metrics: InterpretedMetrics | null; mode: SessionMode }
  | { type: "error"; message: string };

/**
 * WS message types received from the client.
 */
export type ClientMessage =
  | { type: "voice_input"; transcript: string; confidence?: number }
  | { type: "audio_input"; audioBase64: string; mimeType?: string }  // PTT audio chunk
  | { type: "feedback"; feedbackType: string; content?: string; referenceMessageId?: string }
  | { type: "mode_change"; mode: SessionMode }
  | { type: "ping" };

/**
 * EvaSession — one per connected WebSocket client.
 *
 * Owns:
 *   - DriverContextManager (live state)
 *   - ADAS signal subscription (from mock server or OEM adapter)
 *   - Threshold checker (fires proactive triggers)
 *   - Reasoning loop invocation
 *   - Outbound message queue to client WS
 *
 * The reasoning loop is serialised — only one invocation at a time.
 * If a trigger arrives during reasoning, it is queued and processed after.
 */
export class EvaSession {
  readonly sessionId: string;
  readonly driverId: string;
  private ctxManager: DriverContextManager;
  private ws: WebSocket;
  private thresholdCooldowns = new Map<string, number>();
  private reasoning = false;
  private pendingTriggers: ReasoningTrigger[] = [];
  private adasWs: WebSocket | null = null;
  private contextRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ws: WebSocket, driverId?: string) {
    this.sessionId = uuidv4();
    this.driverId = driverId ?? uuidv4();
    this.ws = ws;
    // Pass sessionId so DriverContextManager uses the same ID that gets
    // written to Supabase — prevents FK violations on messages table.
    this.ctxManager = new DriverContextManager(this.driverId, this.sessionId);
  }

  /**
   * Start the session: ensure user + session rows exist in DB,
   * connect to ADAS mock, start context refresh timer, notify client.
   *
   * Async — awaits DB writes before sending session_started so no tool
   * can fire a DB write before the user/session rows exist.
   * Non-fatal if Supabase is not configured.
   */
  async start(adasMockUrl: string): Promise<void> {
    // 1. Ensure anonymous user row exists (idempotent upsert)
    await createOrGetUser(this.driverId);

    // 2. Create session row (user row now guaranteed to exist)
    const ctx = this.ctxManager.getContext();
    await createSessionRecord(
      this.sessionId,
      this.driverId,
      ctx.mode,
      ctx.persona
    );

    // 3. Notify client — DB is ready, tools can now write safely
    this.send({ type: "session_started", sessionId: this.sessionId, driverId: this.driverId });

    // 4. Connect to ADAS mock + start refresh timer
    this.connectToAdasMock(adasMockUrl);
    this.startContextRefreshTimer();

    console.log(`[session:${this.sessionId}] Started for driver ${this.driverId}`);
  }

  /**
   * Handle an inbound message from the client.
   */
  handleClientMessage(raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send({ type: "error", message: "Invalid JSON" });
      return;
    }

    const now = new Date().toISOString();

    switch (msg.type) {
      case "audio_input": {
        // PTT audio chunk — transcribe then feed to reasoning loop
        void this.handleAudioInput(msg.audioBase64, msg.mimeType ?? "audio/wav", now);
        break;
      }
      case "voice_input": {
        // Text transcript from client (text-mode or pre-transcribed)
        this.ctxManager.setLastUtterance(msg.transcript);
        this.enqueueTrigger({
          type: "voice",
          transcript: msg.transcript,
          asrConfidence: msg.confidence ?? 1.0,
          timestamp: now,
        });
        break;
      }
      case "feedback": {
        this.enqueueTrigger({
          type: "uta_feedback",
          feedbackType: msg.feedbackType as ReasoningTrigger extends { type: "uta_feedback" } ? ReasoningTrigger["feedbackType"] : never,
          content: msg.content,
          referenceMessageId: msg.referenceMessageId,
          timestamp: now,
        });
        break;
      }
      case "mode_change": {
        this.ctxManager.setMode(msg.mode);
        this.enqueueTrigger({
          type: "mode_change",
          previousMode: this.ctxManager.getContext().mode,
          requestedMode: msg.mode,
          timestamp: now,
        });
        break;
      }
      case "ping":
        // No-op — keeps connection alive
        break;
    }
  }

  /**
   * Graceful shutdown — close ADAS connection, clear timers, mark session ended,
   * run session-end pattern analyser (Tier 3).
   */
  stop(): void {
    // All fire-and-forget — non-fatal
    void closeSessionRecord(this.sessionId);
    void runSessionAnalyser({ userId: this.driverId, sessionId: this.sessionId });
    this.adasWs?.close();
    if (this.contextRefreshTimer) clearInterval(this.contextRefreshTimer);
    console.log(`[session:${this.sessionId}] Stopped`);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private connectToAdasMock(url: string): void {
    try {
      this.adasWs = new WebSocket(url);

      this.adasWs.on("open", () => {
        console.log(`[session:${this.sessionId}] Connected to ADAS mock at ${url}`);
      });

      this.adasWs.on("message", (data) => {
        try {
          const frame = JSON.parse(data.toString()) as AdasSignalFrame;
          this.onAdasFrame(frame);
        } catch {
          // Malformed frame — ignore
        }
      });

      this.adasWs.on("error", (err) => {
        console.warn(`[session:${this.sessionId}] ADAS mock connection error: ${err.message}`);
        // Non-fatal — session continues without ADAS data
      });

      this.adasWs.on("close", () => {
        console.log(`[session:${this.sessionId}] ADAS mock disconnected`);
      });
    } catch (err) {
      console.warn(`[session:${this.sessionId}] Could not connect to ADAS mock: ${String(err)}`);
    }
  }

  private onAdasFrame(frame: AdasSignalFrame): void {
    this.ctxManager.onAdasFrame(frame);
    const metrics = this.ctxManager.getLatestMetrics();
    if (!metrics) return;

    // Push context update to client (lightweight — no reasoning)
    this.send({ type: "context_update", metrics, mode: this.ctxManager.getContext().mode });

    // Check thresholds — fire proactive triggers
    const triggers = checkThresholds(metrics, this.thresholdCooldowns);
    for (const trigger of triggers) {
      this.enqueueTrigger(trigger);
    }
  }

  private startContextRefreshTimer(): void {
    // Every 5 minutes: silent context refresh (weather, traffic)
    this.contextRefreshTimer = setInterval(() => {
      this.enqueueTrigger({
        type: "timer",
        intervalMs: 300000,
        timestamp: new Date().toISOString(),
      });
    }, 300000);
  }

  private enqueueTrigger(trigger: ReasoningTrigger): void {
    if (this.reasoning) {
      // Serialise — queue it
      this.pendingTriggers.push(trigger);
      return;
    }
    void this.processTrigger(trigger);
  }

  /**
   * Handle inbound PTT audio: transcribe → send transcript back → enqueue voice trigger.
   */
  private async handleAudioInput(
    audioBase64: string,
    mimeType: string,
    timestamp: string
  ): Promise<void> {
    const result = await transcribeAudio(audioBase64, mimeType);

    if (!result.transcript) {
      console.warn(`[session:${this.sessionId}] ASR returned empty transcript`);
      return;
    }

    // Send transcript back to client so it appears in the chat UI
    this.send({
      type: "asr_transcript",
      transcript: result.transcript,
      confidence: result.confidence,
    });

    // Feed transcript into the reasoning loop as a voice trigger
    this.ctxManager.setLastUtterance(result.transcript);
    this.enqueueTrigger({
      type: "voice",
      transcript: result.transcript,
      asrConfidence: result.confidence,
      timestamp,
    });
  }

  private async processTrigger(trigger: ReasoningTrigger): Promise<void> {
    this.reasoning = true;

    try {
      const context = this.ctxManager.getContext();
      const metrics = this.ctxManager.getLatestMetrics();

      const result = await runReasoningLoop({
        trigger,
        context,
        metrics,
        onModeChange: (mode: SessionMode) => this.ctxManager.setMode(mode),
      });

      if (result.shouldRespond && result.text) {
        // 1. Send text response immediately
        this.send({
          type: "eva_response",
          text: result.text,
          requestId: result.requestId,
          trigger: trigger.type,
        });

        // 2. Generate TTS audio and send — fire-and-forget, non-blocking
        void this.sendTTSAudio(result.text, result.requestId, context.persona);
      }
    } catch (err) {
      console.error(`[session:${this.sessionId}] Reasoning error:`, err);
      this.send({ type: "error", message: "EVA reasoning failed. Please try again." });
    } finally {
      this.reasoning = false;

      // Process next queued trigger if any
      const next = this.pendingTriggers.shift();
      if (next) {
        void this.processTrigger(next);
      }
    }
  }

  /**
   * Generate TTS audio for EVA's response and send to client.
   * Runs after the text response is already sent — never blocks.
   */
  private async sendTTSAudio(
    text: string,
    requestId: string,
    persona: string
  ): Promise<void> {
    const ttsResult = await synthesiseSpeech(text, persona);
    if (!ttsResult) return; // TTS not configured or failed — text already sent

    this.send({
      type: "eva_audio",
      audioBase64: ttsResult.audioBase64,
      requestId,
    });
  }

  private send(msg: ServerMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
