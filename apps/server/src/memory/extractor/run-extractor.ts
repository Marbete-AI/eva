import type { DriverContext, InterpretedMetrics } from "@eva/types";
import { extractCandidatesFromTurn, EXTRACTOR_PROMPT_VERSION } from "./extract.js";
import { writeCandidateAndMaybePromote } from "./promote.js";

export interface ExtractorRunInput {
  userMessage: string;
  assistantResponse: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  context: DriverContext;
  metrics: InterpretedMetrics | null;
}

/**
 * Runs the full post-turn extraction pipeline.
 * Called ASYNC after every turn — does not block the driver-facing response.
 *
 * Steps:
 *   1. Extract candidates from the conversation turn
 *   2. For each candidate: write to memory_candidates, auto-promote if threshold met
 *
 * Non-fatal — any failure is logged but does not affect the session.
 */
export async function runPostTurnExtractor(input: ExtractorRunInput): Promise<void> {
  const { userMessage, assistantResponse, userMessageId, assistantMessageId, context, metrics } = input;

  // Build a short driving metrics summary for the extractor context
  const drivingMetrics = metrics
    ? `braking: ${formatScore(metrics.harshBrakingScore)}, fatigue: ${formatScore(metrics.fatigueRisk)}, stability: ${formatScore(metrics.lateralStabilityScore)}`
    : undefined;

  try {
    const candidates = await extractCandidatesFromTurn({
      userMessage,
      assistantResponse,
      sessionContext: {
        mode: context.mode,
        persona: context.persona,
        sessionDurationMin: context.driver.sessionDurationMin,
        ...(drivingMetrics !== undefined ? { drivingMetrics } : {}),
      },
    });

    if (candidates.length === 0) return;

    console.log(`[extractor] Extracted ${candidates.length} candidate(s) from turn`);

    // Context snapshot — stored with every candidate
    const contextSnapshot = {
      session_mode: context.mode,
      persona: context.persona,
      session_duration_min: context.driver.sessionDurationMin,
      vehicle_state: context.vehicle
        ? {
            battery_pct: context.vehicle.batteryPercent,
            range_km: context.vehicle.rangeKm,
            speed_kmh: context.vehicle.speedKmh,
            drive_mode: context.vehicle.driveMode,
          }
        : null,
      adas_metrics: metrics
        ? {
            harsh_braking_score: metrics.harshBrakingScore,
            fatigue_risk: metrics.fatigueRisk,
            lateral_stability_score: metrics.lateralStabilityScore,
            forward_clearance_m: metrics.forwardClearanceMeters,
          }
        : null,
      time_of_day: new Date().toISOString(),
    };

    const sourceIds = {
      user_message_id: userMessageId,
      assistant_message_id: assistantMessageId,
    };

    // Write each candidate — may auto-promote to Tier 2
    await Promise.allSettled(
      candidates.map(candidate =>
        writeCandidateAndMaybePromote({
          userId: context.driverId,
          sessionId: context.sessionId,
          candidate,
          sourceType: "conversation",
          sourceIds,
          contextSnapshot,
          extractorVersion: EXTRACTOR_PROMPT_VERSION,
        })
      )
    );
  } catch (err) {
    // Non-fatal — extractor failure never affects the session
    console.error("[extractor] Post-turn extraction failed:", err);
  }
}

function formatScore(score: number): string {
  if (score >= 0.7) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}
