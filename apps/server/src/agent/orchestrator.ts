import { generateText } from "ai";
import { v4 as uuidv4 } from "uuid";
import type { DriverContext, InterpretedMetrics, ToolCallContext, SessionMode } from "@eva/types";
import { createReasoningModel, getReasoningConfig } from "../providers/reasoning/index.js";
import { buildSystemPrompt } from "../personas/base.js";
import { makeGetVehicleStateTool } from "../tools/get-vehicle-state.js";
import { makeGetAdasSignalsTool } from "../tools/get-adas-signals.js";
import { makeGetWeatherTool } from "../tools/get-weather.js";
import { makeGetRouteTool } from "../tools/get-route.js";
import { makeRetrieveMemoryTool } from "../tools/retrieve-memory.js";
import { makeStoreFeedbackTool } from "../tools/store-feedback.js";
import { makeDispatchHavmcoTool } from "../tools/dispatch-havmco.js";
import { makeSetModeTool } from "../tools/set-mode.js";
import { makeInitiateCallTool } from "../tools/initiate-call.js";
import { makeAskGeminiTool } from "../tools/ask-gemini.js";
import { makeCalculateRangeTool } from "../tools/calculate-range.js";
import { writeMessage, getConversationWindow } from "../memory/messages.js";
import { getPendingConfirmations } from "../memory/extractor/confirmation-queue.js";
import { expireRejectedCandidates } from "../memory/extractor/rejection-bank.js";

const CONVERSATION_WINDOW_TURNS = parseInt(
  process.env["CONVERSATION_WINDOW_TURNS"] ?? "30",
  10
);

export interface OrchestratorInput {
  message: string;
  context: DriverContext;
  metrics: InterpretedMetrics | null;
  onModeChange?: ((mode: SessionMode) => void) | undefined;
}

export interface OrchestratorResult {
  text: string;
  requestId: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
}

/**
 * Core orchestrator.
 * - Loads conversation history (last 30 turns) and injects into system prompt
 * - Writes user message + assistant response to messages table
 * - Uses direct @ai-sdk/anthropic — not Vercel SDK's provider abstraction
 * - All tools receive ToolCallContext for full traceability
 */
export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const requestId = uuidv4();
  const { message, context, metrics, onModeChange } = input;

  const config = getReasoningConfig();
  const model = createReasoningModel(config);

  const toolCtx: ToolCallContext = {
    driverId: context.driverId,
    sessionId: context.sessionId,
    triggeredBy: "voice",
    requestId,
    timestamp: new Date().toISOString(),
  };

  // 1. Write user message to DB (non-blocking path — await for ID)
  const userMessageId = await writeMessage({
    sessionId: context.sessionId,
    role: "user",
    content: message,
  });

  // 2. Load conversation history + pending confirmations in parallel
  const [conversationHistory, pendingConfirmations] = await Promise.all([
    getConversationWindow(context.sessionId, CONVERSATION_WINDOW_TURNS),
    getPendingConfirmations(context.driverId),
  ]);

  // Expire any stale rejected candidates (fire-and-forget)
  void expireRejectedCandidates(context.driverId);

  // 3. Build system prompt with history + confirmations injected
  const systemPrompt = buildSystemPrompt(context, metrics, conversationHistory, pendingConfirmations);

  // 4. Run reasoning
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: message,
    maxSteps: 5,
    tools: {
      get_vehicle_state: makeGetVehicleStateTool(toolCtx),
      get_adas_signals: makeGetAdasSignalsTool(toolCtx, () => metrics),
      get_weather: makeGetWeatherTool(toolCtx),
      get_route: makeGetRouteTool(toolCtx),
      retrieve_memory: makeRetrieveMemoryTool(toolCtx),
      store_feedback: makeStoreFeedbackTool(toolCtx),
      dispatch_havmco: makeDispatchHavmcoTool(toolCtx),
      set_mode: makeSetModeTool(toolCtx, onModeChange ?? ((_mode: SessionMode) => {})),
      initiate_call: makeInitiateCallTool(toolCtx),
      ask_gemini: makeAskGeminiTool(toolCtx),
      calculate_range: makeCalculateRangeTool(toolCtx),
    },
  });

  // 5. Write assistant response to DB
  const assistantMessageId = await writeMessage({
    sessionId: context.sessionId,
    role: "assistant",
    content: result.text,
  });

  return {
    text: result.text,
    requestId,
    userMessageId,
    assistantMessageId,
  };
}
