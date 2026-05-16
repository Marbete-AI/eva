"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasoningTriggerSchema = void 0;
const zod_1 = require("zod");
/**
 * Discriminated union of all reasoning loop trigger types.
 * The loop fires on any of these — not just driver voice.
 */
exports.ReasoningTriggerSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({
        type: zod_1.z.literal("voice"),
        transcript: zod_1.z.string(),
        asrConfidence: zod_1.z.number().min(0).max(1),
        timestamp: zod_1.z.string().datetime(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("signal_threshold"),
        /** Which derived metric crossed a threshold */
        metric: zod_1.z.string(),
        value: zod_1.z.number(),
        threshold: zod_1.z.number(),
        direction: zod_1.z.enum(["above", "below"]),
        timestamp: zod_1.z.string().datetime(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("vehicle_state_change"),
        field: zod_1.z.string(),
        previousValue: zod_1.z.unknown(),
        newValue: zod_1.z.unknown(),
        timestamp: zod_1.z.string().datetime(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("timer"),
        intervalMs: zod_1.z.number(),
        timestamp: zod_1.z.string().datetime(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("mode_change"),
        previousMode: zod_1.z.string(),
        requestedMode: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("uta_feedback"),
        feedbackType: zod_1.z.enum([
            "thumbs_up",
            "thumbs_down",
            "voice_correction",
            "voice_positive",
        ]),
        referenceMessageId: zod_1.z.string().optional(),
        content: zod_1.z.string().optional(),
        timestamp: zod_1.z.string().datetime(),
    }),
]);
//# sourceMappingURL=triggers.js.map