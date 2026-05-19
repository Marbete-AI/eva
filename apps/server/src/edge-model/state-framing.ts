/**
 * Edge Model: State Framing (5-second refresh)
 *
 * Lightweight model running on-device (or quick cloud call) that observes
 * current vehicle state + driver state inferences and frames context for
 * immediate emotional response readiness.
 *
 * This is NOT the reasoning layer. It's the perception layer that says:
 * "Right now, the driver is [state], so I should respond with [tone]."
 *
 * Eventually: fine-tuned Haiku or quantized mini, deployed to vehicle ECU.
 * For now: GPT-4o mini or placeholder function returning hard-coded frames.
 */

import type {
  VehicleState,
  InterpretedMetrics,
  DriverContext,
} from "@eva/types";

export interface DriverStateVector {
  calm: number;
  focused: number;
  stressed: number;
  fatigued: number;
  distracted: number;
  playful: number;
  hungry: number;
  late_for_event: number;
}

export interface EdgeModelStateFrame {
  /** Primary inferred state (highest confidence) */
  primaryState: keyof DriverStateVector;
  /** Its confidence 0–1 */
  confidence: number;
  /** One-sentence situation summary */
  situation: string;
  /** How EVA should sound right now */
  toneRecommendation: string;
  /** What EVA should be ready to do */
  proactiveReadiness: string;
  /** Internal emotional calibration (not sent to driver) */
  emotionalCalibration: string;
  /** Timestamp of frame */
  framedAt: string;
}

/**
 * PLACEHOLDER: Edge model framing function.
 *
 * Inputs:
 *   vehicleState: raw SmartCar data (speed, battery, location, etc.)
 *   interpretedMetrics: deterministic metrics from signal-interpreter
 *   driverStateVector: inferred confidences for each driver state
 *   lastTwoTurns: conversation history (for context)
 *
 * Output:
 *   StateFrame: emotional/contextual guidance for immediate response
 *
 * This function should run every 5 seconds on-device or via quick API call.
 * It MUST NOT call external APIs (except maybe config fetch).
 * It SHOULD be deterministic or instruction-following only.
 *
 * In EVA-1: return hard-coded frames based on state + metrics.
 * In EVA-1.5+: call fine-tuned model with learned frames.
 */
export async function frameStateForEdge(
  vehicleState: VehicleState,
  interpretedMetrics: InterpretedMetrics,
  driverStateVector: DriverStateVector,
  context: DriverContext,
  lastTwoTurns?: Array<{ role: string; content: string }>
): Promise<EdgeModelStateFrame> {
  // ─ Step 1: Find primary state ─────────────────────────────────────────
  const states = Object.entries(driverStateVector) as Array<
    [keyof DriverStateVector, number]
  >;
  const [primaryState, primaryConfidence] = states.reduce((a, b) =>
    a[1] > b[1] ? a : b
  );

  // ─ Step 2: Build situation summary (deterministic for now) ─────────────
  let situation = "";
  switch (primaryState) {
    case "stressed":
      situation = `Driver is under pressure (${(primaryConfidence * 100).toFixed(0)}% confidence).
        Harsh braking recently, traffic heavy, time pressure likely.`;
      break;
    case "fatigued":
      situation = `Fatigue signals building. Steering variance up, long session, time-of-day pattern.`;
      break;
    case "focused":
      situation = `Driver is concentrating. High speed, heavy traffic, minimal utterances.`;
      break;
    case "distracted":
      situation = `Driver attention divided. Partial transcripts, lateral deviation detected.`;
      break;
    case "late_for_event":
      situation = `Driver is late for upcoming event. Calendar + ETA mismatch, time pressure.`;
      break;
    case "playful":
      situation = `Driver is in lighter mood. Open questions, laughter, engaging tone.`;
      break;
    case "hungry":
      situation = `Driver likely needs food. Time-since-meal pattern or direct mention.`;
      break;
    default: // calm
      situation = `Driver is calm, engaged, normal drivelogue. No acute stress signals.`;
  }

  // ─ Step 3: Tone recommendation (based on state + metrics) ──────────────
  let toneRecommendation = "";
  switch (primaryState) {
    case "stressed":
      toneRecommendation =
        "Calm, reassuring, solution-focused. Be direct. No small talk.";
      break;
    case "fatigued":
      toneRecommendation =
        "Alert, supportive, suggest rest. Keep it brief if driver wants to focus.";
      break;
    case "focused":
      toneRecommendation =
        "Silent unless critical. If you respond, keep it under 10 seconds.";
      break;
    case "distracted":
      toneRecommendation =
        "Pause non-urgent talk. Return to topic later when attention is back.";
      break;
    case "late_for_event":
      toneRecommendation =
        "Respectful of urgency. Offer help, be direct, minimize verbosity.";
      break;
    case "playful":
      toneRecommendation = "Match tone. Can be conversational, suggest discovery.";
      break;
    case "hungry":
      toneRecommendation =
        "Casual, helpful. Recall favourite stops, suggest timing.";
      break;
    default: // calm
      toneRecommendation =
        "Conversational. Can volunteer information, suggest scenic routes.";
  }

  // ─ Step 4: Proactive readiness (what should EVA be ready to do?) ───────
  let proactiveReadiness = "";
  if (primaryConfidence > 0.7) {
    if (primaryState === "stressed") {
      proactiveReadiness =
        "Ready to suggest alternate route or confirm ETA if driver asks.";
    } else if (primaryState === "fatigued") {
      proactiveReadiness = "Ready to suggest rest stop or contact when appropriate.";
    } else if (primaryState === "focused") {
      proactiveReadiness = "Ready to respond only if safety-critical.";
    } else if (primaryState === "late_for_event") {
      proactiveReadiness = "Ready to suggest fastest route or notify about timing risk.";
    }
  } else {
    proactiveReadiness = "Ready for next driver input.";
  }

  // ─ Step 5: Emotional calibration (internal only) ───────────────────────
  const emotionalCalibration =
    `Driver is ${primaryState} (confidence ${(primaryConfidence * 100).toFixed(0)}%). ` +
    `Sound confident, never tired or frustrated. ` +
    `You understand their situation and are on their side.`;

  return {
    primaryState,
    confidence: primaryConfidence,
    situation,
    toneRecommendation,
    proactiveReadiness,
    emotionalCalibration,
    framedAt: new Date().toISOString(),
  };
}

/**
 * TODO: Replace this with actual edge model call.
 *
 * Options:
 * 1. GPT-4o mini API call (cloud, fast enough for 5s refresh)
 * 2. Prompt: "Given driver state vector + vehicle metrics, frame the situation in one sentence and recommend tone"
 * 3. Future: Fine-tuned Haiku WASM deployed to vehicle
 *
 * For EVA-1, option 1 (hard-coded logic above) is fine.
 * For EVA-1.5+, invest in fine-tuned model.
 */

/**
 * Integration point:
 *
 * In apps/server/src/agent/loop.ts or a separate timer:
 *
 * ```ts
 * setInterval(async () => {
 *   const frame = await frameStateForEdge(
 *     currentVehicleState,
 *     currentInterpretedMetrics,
 *     currentDriverStateVector,
 *     driverContext,
 *     conversationWindow
 *   );
 *
 *   // Store frame in context or memory for next reasoning call
 *   context.edgeModelFrame = frame;
 * }, 5000);
 * ```
 *
 * Then in orchestrator.ts system prompt builder:
 *
 * ```ts
 * const systemPrompt = buildSystemPrompt(
 *   context,
 *   metrics,
 *   conversationHistory,
 *   pendingConfirmations,
 *   context.edgeModelFrame  // ← inject emotional calibration
 * );
 * ```
 */
