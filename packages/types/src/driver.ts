import { z } from "zod";

/**
 * Driver state derived from voice patterns, UTA feedback,
 * and session-level signals. No camera in EVA-1.
 */
export const DriverStateSchema = z.object({
  /**
   * Fatigue risk level — derived deterministically by signal_interpreter
   * from steering variance, session duration, and UTA patterns.
   * Never set directly by the LLM.
   */
  fatigueRisk: z.enum(["low", "medium", "high"]),
  /** Most recent driver utterance text (ASR transcript) */
  lastUtterance: z.string().nullable(),
  /** How long the current driving session has been running, in minutes */
  sessionDurationMin: z.number().min(0),
  /** ISO 8601 timestamp of last UTA interaction */
  lastInteractionAt: z.string().datetime().nullable(),
});

export type DriverState = z.infer<typeof DriverStateSchema>;

/** ASR input mode — driver's choice, stored in user preferences */
export const AsrModeSchema = z.enum(["ptt", "wake_word", "vad"]);
export type AsrMode = z.infer<typeof AsrModeSchema>;

/** Persona selection */
export const PersonaSchema = z.enum(["copilot", "quiet_companion", "meeting_mode"]);
export type Persona = z.infer<typeof PersonaSchema>;
