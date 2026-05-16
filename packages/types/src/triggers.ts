import { z } from "zod";

/**
 * Discriminated union of all reasoning loop trigger types.
 * The loop fires on any of these — not just driver voice.
 */
export const ReasoningTriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("voice"),
    transcript: z.string(),
    asrConfidence: z.number().min(0).max(1),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("signal_threshold"),
    /** Which derived metric crossed a threshold */
    metric: z.string(),
    value: z.number(),
    threshold: z.number(),
    direction: z.enum(["above", "below"]),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("vehicle_state_change"),
    field: z.string(),
    previousValue: z.unknown(),
    newValue: z.unknown(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("timer"),
    intervalMs: z.number(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("mode_change"),
    previousMode: z.string(),
    requestedMode: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("uta_feedback"),
    feedbackType: z.enum([
      "thumbs_up",
      "thumbs_down",
      "voice_correction",
      "voice_positive",
    ]),
    referenceMessageId: z.string().optional(),
    content: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
]);

export type ReasoningTrigger = z.infer<typeof ReasoningTriggerSchema>;
