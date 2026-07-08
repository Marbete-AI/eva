import { z } from "zod";
import type { InterpretedMetrics } from "./interpreter.js";
import type { VehicleState } from "./vehicle.js";

/**
 * Active Inference System types.
 *
 * See docs/active-inference-system.md, docs/driver-state-matrix.md,
 * docs/inference-silos.md for the design.
 */

// ── Driver states ─────────────────────────────────────────────────────────────

export const DriverStateNameSchema = z.enum([
  "calm",
  "focused",
  "stressed",
  "fatigued",
  "distracted",
  "playful",
  "hungry",
  "late_for_event",
]);
export type DriverStateName = z.infer<typeof DriverStateNameSchema>;

/** Confidence per state, 0-1. States can co-occur. */
export type DriverStateVector = Record<DriverStateName, number>;

export function emptyStateVector(): DriverStateVector {
  return {
    calm: 0,
    focused: 0,
    stressed: 0,
    fatigued: 0,
    distracted: 0,
    playful: 0,
    hungry: 0,
    late_for_event: 0,
  };
}

// ── Inference ─────────────────────────────────────────────────────────────────

export const InferenceTypeSchema = z.enum([
  "driver_state",
  "mode_suggestion",
  "persona_recommendation",
  "preference_pattern",
]);
export type InferenceType = z.infer<typeof InferenceTypeSchema>;

/** A single evidence item supporting an inference — auditability guarantee. */
export interface InferenceEvidence {
  /** Which silo/signal produced this — e.g. "silo1.fatigueRisk", "silo2.terseness" */
  source: string;
  /** The raw value observed */
  value: number | string | boolean;
  /** Human-readable explanation */
  detail: string;
}

export interface Inference {
  type: InferenceType;
  /** For driver_state inferences: which state */
  state?: DriverStateName;
  confidence: number;
  evidence: InferenceEvidence[];
  pathId: string;
  pathVersion: string;
  /** ISO 8601 — when this inference should decay */
  expiresAt?: string;
}

// ── Silo snapshot ─────────────────────────────────────────────────────────────

/**
 * Text-derived driver input signals (Silo 2).
 * Computed deterministically from recent driver messages — no ML required.
 * The fine-tuned mini model replaces/augments this later.
 */
export interface DriverInputSignals {
  /** Mean words per driver message over recent window (low = terse) */
  meanMessageLength: number | null;
  /** Hedge words per 100 words (um, maybe, kind of, i think) */
  hedgeDensity: number | null;
  /** Frustration markers found in recent messages */
  frustrationMarkers: string[];
  /** Explicit fatigue mentions (tired, exhausted, knackered, sleepy) */
  fatigueMentions: string[];
  /** Number of driver messages in the window analysed */
  messageCount: number;
}

/**
 * A consistent view of all silos at the moment of inference.
 * Assembled once per turn. ADAS (silo 1) is null when no ADAS
 * source is connected — a normal participant car.
 */
export interface SiloSnapshot {
  /** Silo 1 — ADAS. Null when vehicle has no ADAS feed (normal car). */
  adas: InterpretedMetrics | null;
  /** Silo 2 — driver input text signals */
  driverInput: DriverInputSignals;
  /** Silo 3 — memory: relevant confirmed memory contents (already retrieved) */
  memoryHints: string[];
  /** Silo 4 — environment */
  environment: {
    timeOfDayHour: number;        // 0-23 local
    isLateNight: boolean;         // 22:00-05:00
    sessionDurationMin: number;
    vehicle: VehicleState | null;
  };
  /** ISO 8601 */
  snapshotAt: string;
}

// ── Inference path contract ───────────────────────────────────────────────────

export interface InferencePathResult {
  inference: Inference | null;
}

export interface InferencePathDef {
  id: string;
  version: string;
  /** Which state this path infers (for driver_state paths) */
  emitsState?: DriverStateName;
  run(snapshot: SiloSnapshot): Inference | null;
}
