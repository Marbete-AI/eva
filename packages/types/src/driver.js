"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonaSchema = exports.AsrModeSchema = exports.DriverStateSchema = void 0;
const zod_1 = require("zod");
/**
 * Driver state derived from voice patterns, UTA feedback,
 * and session-level signals. No camera in EVA-1.
 */
exports.DriverStateSchema = zod_1.z.object({
    /**
     * Fatigue risk level — derived deterministically by signal_interpreter
     * from steering variance, session duration, and UTA patterns.
     * Never set directly by the LLM.
     */
    fatigueRisk: zod_1.z.enum(["low", "medium", "high"]),
    /** Most recent driver utterance text (ASR transcript) */
    lastUtterance: zod_1.z.string().nullable(),
    /** How long the current driving session has been running, in minutes */
    sessionDurationMin: zod_1.z.number().min(0),
    /** ISO 8601 timestamp of last UTA interaction */
    lastInteractionAt: zod_1.z.string().datetime().nullable(),
});
/** ASR input mode — driver's choice, stored in user preferences */
exports.AsrModeSchema = zod_1.z.enum(["ptt", "wake_word", "vad"]);
/** Persona selection */
exports.PersonaSchema = zod_1.z.enum(["copilot", "quiet_companion", "meeting_mode"]);
//# sourceMappingURL=driver.js.map