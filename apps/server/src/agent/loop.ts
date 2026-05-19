import type { ReasoningTrigger, DriverContext, InterpretedMetrics } from "@eva/types";
import { runOrchestrator } from "./orchestrator.js";
import type { SessionMode } from "@eva/types";
import { runPostTurnExtractor } from "../memory/extractor/run-extractor.js";
import type { NavigationPayload } from "../tools/open-navigation.js";

export interface LoopInput {
  trigger: ReasoningTrigger;
  context: DriverContext;
  metrics: InterpretedMetrics | null;
  onModeChange?: (mode: SessionMode) => void;
  onNavigation?: (payload: NavigationPayload) => void;
}

export interface LoopOutput {
  text: string;
  requestId: string;
  shouldRespond: boolean;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
}

/**
 * Reasoning loop entry point.
 * Accepts any trigger type. For timer/context-refresh triggers,
 * it may decide not to respond (shouldRespond = false).
 *
 * This is the single entry point used by both:
 *   - POST /chat (dev shim, text input)
 *   - WS /session (production, voice + signal triggers) — Week 3+
 *
 * Keeping this separate from the route handler means the WebSocket
 * session can reuse the same reasoning path without duplication.
 */
export async function runReasoningLoop(input: LoopInput): Promise<LoopOutput> {
  const { trigger, context, metrics, onModeChange, onNavigation } = input;

  // Timer triggers: silent context refresh — no response to driver
  if (trigger.type === "timer") {
    return { text: "", requestId: "timer-refresh", shouldRespond: false, userMessageId: null, assistantMessageId: null };
  }

  // Extract the message from the trigger
  let message: string;

  switch (trigger.type) {
    case "voice":
      message = trigger.transcript;
      break;

    case "signal_threshold":
      message = buildThresholdMessage(trigger, metrics);
      break;

    case "vehicle_state_change":
      message = buildVehicleStateMessage(trigger);
      break;

    case "mode_change":
      message = `The driver has requested to switch to ${trigger.requestedMode} mode.`;
      break;

    case "uta_feedback":
      message = buildFeedbackMessage(trigger);
      break;

    default:
      message = "What can I help you with?";
  }

  const result = await runOrchestrator({
    message,
    context,
    metrics,
    ...(onModeChange !== undefined ? { onModeChange } : {}),
    ...(onNavigation !== undefined ? { onNavigation } : {}),
  });

  // Fire-and-forget passive memory extraction — never blocks driver response
  void runPostTurnExtractor({
    userMessage: message,
    assistantResponse: result.text,
    userMessageId: result.userMessageId,
    assistantMessageId: result.assistantMessageId,
    context,
    metrics,
  });

  return {
    text: result.text,
    requestId: result.requestId,
    shouldRespond: true,
    userMessageId: result.userMessageId,
    assistantMessageId: result.assistantMessageId,
  };
}

// ── Trigger-to-message builders ────────────────────────────────────────────────

function buildThresholdMessage(
  trigger: Extract<ReasoningTrigger, { type: "signal_threshold" }>,
  _metrics: InterpretedMetrics | null
): string {
  const { metric } = trigger;

  // Natural language descriptions only — no numeric values, no metric names,
  // no threshold numbers ever reach the LLM. Directive, not passive.
  const metricMessages: Record<string, string> = {
    harshBrakingScore: "The driver has just braked very hard. Acknowledge this calmly and check if they are okay. One sentence only.",
    fatigueRisk: "The driver's driving pattern is showing signs of fatigue. Gently suggest a break. One sentence only.",
    lateralStabilityScore: "The vehicle's lateral stability has dropped — the driver may be drifting or making abrupt steering corrections. Calmly draw their attention to it. One sentence only.",
    forwardClearanceMeters: "Forward clearance ahead is very low. Calmly alert the driver to the obstacle or closing gap. One sentence only.",
    overtakeLikelihood: "The driver appears to be in the middle of an overtake. Do not interrupt unless safety is at risk. If you respond, keep it to one sentence.",
    gapFitMarginMeters: "The available gap may be too narrow for the vehicle to pass safely. Calmly advise the driver. One sentence only.",
  };

  return metricMessages[metric] ?? "A driving condition has been detected. Inform the driver briefly and calmly. One sentence only.";
}

function buildVehicleStateMessage(
  trigger: Extract<ReasoningTrigger, { type: "vehicle_state_change" }>
): string {
  const { field, previousValue, newValue } = trigger;

  if (field === "batteryPercent" && typeof newValue === "number" && newValue < 20) {
    return `The vehicle battery has dropped to ${newValue}%. Previous reading was ${previousValue}%. The driver may need to be informed about charging options.`;
  }

  return `Vehicle state changed: ${field} changed from ${String(previousValue)} to ${String(newValue)}.`;
}

function buildFeedbackMessage(
  trigger: Extract<ReasoningTrigger, { type: "uta_feedback" }>
): string {
  switch (trigger.feedbackType) {
    case "thumbs_up":
      return "The driver has indicated they liked the previous response. Acknowledge briefly and store this positive feedback.";
    case "thumbs_down":
      return "The driver has indicated they did not like the previous response. Acknowledge, ask if they'd like a different approach, and store this feedback.";
    case "voice_correction":
      return `The driver has provided a correction: "${trigger.content ?? ""}". Acknowledge, apply the correction, and store it as a preference.`;
    case "voice_positive":
      return `The driver has provided positive voice feedback: "${trigger.content ?? ""}". Acknowledge briefly and store this preference.`;
  }
}
