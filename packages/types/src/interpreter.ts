import { z } from "zod";

/**
 * Output of the deterministic signal interpreter.
 * These derived metrics are what the reasoning LLM sees — not raw signals,
 * not scenario labels. Pure functions, fully auditable, no hallucination risk.
 */
export const InterpretedMetricsSchema = z.object({
  /**
   * 0.0 – 1.0. Derived from longitudinal deceleration magnitude.
   * > 0.4g = harsh, > 0.7g = emergency. LLM uses this to communicate,
   * not to decide safety actions.
   */
  harshBrakingScore: z.number().min(0).max(1),

  /**
   * 0.0 – 1.0. Derived from steering angle variance (SDLP proxy),
   * session duration, and interaction recency.
   */
  fatigueRisk: z.number().min(0).max(1),

  /**
   * 0.0 – 1.0. Low = unstable (lane departure risk). Derived from
   * yaw rate, lateral acceleration, and steering angle.
   */
  lateralStabilityScore: z.number().min(0).max(1),

  /**
   * Metres of clear space ahead. Derived from front obstacle distances.
   * Null if no obstacle data available.
   */
  forwardClearanceMeters: z.number().min(0).nullable(),

  /**
   * 0.0 – 1.0 likelihood of an overtake manoeuvre in progress.
   * Derived from lateral accel, yaw rate, turn signal, adjacent distances.
   */
  overtakeLikelihood: z.number().min(0).max(1),

  /**
   * Available lateral gap in metres relative to vehicle width.
   * Positive = fits with margin. Negative = does not fit.
   * Null if vehicle width or obstacle data unavailable.
   */
  gapFitMarginMeters: z.number().nullable(),

  /** ISO 8601 — when these metrics were computed */
  computedAt: z.string().datetime(),
});

export type InterpretedMetrics = z.infer<typeof InterpretedMetricsSchema>;
