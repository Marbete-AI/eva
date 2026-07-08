import type {
  DriverContext,
  DriverStateVector,
  Inference,
  InferencePathDef,
  InterpretedMetrics,
  SiloSnapshot,
} from "@eva/types";
import { emptyStateVector } from "@eva/types";
import { getSupabaseClient } from "../memory/supabase-client.js";
import { extractDriverInputSignals } from "./text-signals.js";
import { fatiguePath } from "./paths/fatigue.js";
import { stressPath } from "./paths/stress.js";

/**
 * Active Inference Engine — v1.
 *
 * Runs inline on every reasoning turn:
 *   1. Assemble a SiloSnapshot from available sources
 *   2. Run every registered inference path over it
 *   3. Persist emitted inferences to the audit log (fire-and-forget)
 *   4. Return the driver state vector for system prompt injection
 *
 * Design constraints for real participant deployment:
 *   - ADAS is OPTIONAL. A normal car has no ADAS feed — paths must work
 *     from text + time + telemetry alone.
 *   - Every inference carries its evidence. Nothing is unexplainable.
 *   - Paths are versioned. Tuning a path is traceable in the audit log.
 */

// ── Path registry ─────────────────────────────────────────────────────────────
// Add new paths here. Each runs independently every turn.

const PATHS: InferencePathDef[] = [
  fatiguePath,
  stressPath,
];

// ── Snapshot assembly ─────────────────────────────────────────────────────────

export function buildSiloSnapshot(
  context: DriverContext,
  metrics: InterpretedMetrics | null,
  recentDriverMessages: string[]
): SiloSnapshot {
  const now = new Date();
  const hour = now.getHours();

  return {
    adas: metrics,
    driverInput: extractDriverInputSignals(recentDriverMessages),
    memoryHints: context.memory.map(m => m.content),
    environment: {
      timeOfDayHour: hour,
      isLateNight: hour >= 22 || hour < 5,
      sessionDurationMin: context.driver.sessionDurationMin,
      vehicle: context.vehicle,
    },
    snapshotAt: now.toISOString(),
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export interface InferenceRunResult {
  stateVector: DriverStateVector;
  inferences: Inference[];
}

/**
 * Run all inference paths over a snapshot.
 * Returns the state vector and persists inferences to the audit log.
 */
export function runInferenceEngine(
  snapshot: SiloSnapshot,
  driverId: string,
  sessionId: string
): InferenceRunResult {
  const stateVector = emptyStateVector();
  const inferences: Inference[] = [];

  for (const path of PATHS) {
    try {
      const inference = path.run(snapshot);
      if (!inference) continue;

      inferences.push(inference);

      // Update state vector — keep the highest confidence per state
      if (inference.type === "driver_state" && inference.state) {
        stateVector[inference.state] = Math.max(
          stateVector[inference.state],
          inference.confidence
        );
      }
    } catch (err) {
      console.error(`[inference:${path.id}] Path failed:`, err);
      // A failing path never blocks the turn
    }
  }

  // Default: if no acute state has meaningful confidence, driver is calm
  const maxAcute = Math.max(
    stateVector.stressed,
    stateVector.fatigued,
    stateVector.distracted,
    stateVector.late_for_event
  );
  stateVector.calm = maxAcute < 0.35 ? 0.7 : Math.max(0, 0.7 - maxAcute);

  // Persist to audit log — fire-and-forget, never blocks the response
  if (inferences.length > 0) {
    void persistInferences(inferences, driverId, sessionId);
  }

  return { stateVector, inferences };
}

// ── Persistence (audit log) ───────────────────────────────────────────────────

async function persistInferences(
  inferences: Inference[],
  driverId: string,
  sessionId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const rows = inferences.map(inf => ({
    user_id: driverId,
    session_id: sessionId,
    type: inf.type,
    state: inf.state ?? null,
    confidence: inf.confidence,
    evidence: inf.evidence,
    path_id: inf.pathId,
    path_version: inf.pathVersion,
    expires_at: inf.expiresAt ?? null,
    pii_class: "personal",
  }));

  const { error } = await supabase.from("inferences").insert(rows);
  if (error) {
    console.error("[inference] Failed to persist inferences:", error.message);
  } else {
    for (const inf of inferences) {
      console.log(
        `[inference] ${inf.state ?? inf.type}: ${inf.confidence} (${inf.evidence.length} evidence items, path=${inf.pathId}@${inf.pathVersion})`
      );
    }
  }
}
