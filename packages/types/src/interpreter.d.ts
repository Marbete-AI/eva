import { z } from "zod";
/**
 * Output of the deterministic signal interpreter.
 * These derived metrics are what the reasoning LLM sees — not raw signals,
 * not scenario labels. Pure functions, fully auditable, no hallucination risk.
 */
export declare const InterpretedMetricsSchema: z.ZodObject<{
    /**
     * 0.0 – 1.0. Derived from longitudinal deceleration magnitude.
     * > 0.4g = harsh, > 0.7g = emergency. LLM uses this to communicate,
     * not to decide safety actions.
     */
    harshBrakingScore: z.ZodNumber;
    /**
     * 0.0 – 1.0. Derived from steering angle variance (SDLP proxy),
     * session duration, and interaction recency.
     */
    fatigueRisk: z.ZodNumber;
    /**
     * 0.0 – 1.0. Low = unstable (lane departure risk). Derived from
     * yaw rate, lateral acceleration, and steering angle.
     */
    lateralStabilityScore: z.ZodNumber;
    /**
     * Metres of clear space ahead. Derived from front obstacle distances.
     * Null if no obstacle data available.
     */
    forwardClearanceMeters: z.ZodNullable<z.ZodNumber>;
    /**
     * 0.0 – 1.0 likelihood of an overtake manoeuvre in progress.
     * Derived from lateral accel, yaw rate, turn signal, adjacent distances.
     */
    overtakeLikelihood: z.ZodNumber;
    /**
     * Available lateral gap in metres relative to vehicle width.
     * Positive = fits with margin. Negative = does not fit.
     * Null if vehicle width or obstacle data unavailable.
     */
    gapFitMarginMeters: z.ZodNullable<z.ZodNumber>;
    /** ISO 8601 — when these metrics were computed */
    computedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fatigueRisk: number;
    harshBrakingScore: number;
    lateralStabilityScore: number;
    forwardClearanceMeters: number | null;
    overtakeLikelihood: number;
    gapFitMarginMeters: number | null;
    computedAt: string;
}, {
    fatigueRisk: number;
    harshBrakingScore: number;
    lateralStabilityScore: number;
    forwardClearanceMeters: number | null;
    overtakeLikelihood: number;
    gapFitMarginMeters: number | null;
    computedAt: string;
}>;
export type InterpretedMetrics = z.infer<typeof InterpretedMetricsSchema>;
//# sourceMappingURL=interpreter.d.ts.map