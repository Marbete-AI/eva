import { z } from "zod";
/**
 * Driver state derived from voice patterns, UTA feedback,
 * and session-level signals. No camera in EVA-1.
 */
export declare const DriverStateSchema: z.ZodObject<{
    /**
     * Fatigue risk level — derived deterministically by signal_interpreter
     * from steering variance, session duration, and UTA patterns.
     * Never set directly by the LLM.
     */
    fatigueRisk: z.ZodEnum<["low", "medium", "high"]>;
    /** Most recent driver utterance text (ASR transcript) */
    lastUtterance: z.ZodNullable<z.ZodString>;
    /** How long the current driving session has been running, in minutes */
    sessionDurationMin: z.ZodNumber;
    /** ISO 8601 timestamp of last UTA interaction */
    lastInteractionAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fatigueRisk: "low" | "medium" | "high";
    lastUtterance: string | null;
    sessionDurationMin: number;
    lastInteractionAt: string | null;
}, {
    fatigueRisk: "low" | "medium" | "high";
    lastUtterance: string | null;
    sessionDurationMin: number;
    lastInteractionAt: string | null;
}>;
export type DriverState = z.infer<typeof DriverStateSchema>;
/** ASR input mode — driver's choice, stored in user preferences */
export declare const AsrModeSchema: z.ZodEnum<["ptt", "wake_word", "vad"]>;
export type AsrMode = z.infer<typeof AsrModeSchema>;
/** Persona selection */
export declare const PersonaSchema: z.ZodEnum<["copilot", "quiet_companion", "meeting_mode"]>;
export type Persona = z.infer<typeof PersonaSchema>;
//# sourceMappingURL=driver.d.ts.map