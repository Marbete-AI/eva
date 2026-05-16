import { z } from "zod";
/**
 * Discriminated union of all reasoning loop trigger types.
 * The loop fires on any of these — not just driver voice.
 */
export declare const ReasoningTriggerSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"voice">;
    transcript: z.ZodString;
    asrConfidence: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    type: "voice";
    transcript: string;
    asrConfidence: number;
}, {
    timestamp: string;
    type: "voice";
    transcript: string;
    asrConfidence: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"signal_threshold">;
    /** Which derived metric crossed a threshold */
    metric: z.ZodString;
    value: z.ZodNumber;
    threshold: z.ZodNumber;
    direction: z.ZodEnum<["above", "below"]>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    value: number;
    type: "signal_threshold";
    metric: string;
    threshold: number;
    direction: "above" | "below";
}, {
    timestamp: string;
    value: number;
    type: "signal_threshold";
    metric: string;
    threshold: number;
    direction: "above" | "below";
}>, z.ZodObject<{
    type: z.ZodLiteral<"vehicle_state_change">;
    field: z.ZodString;
    previousValue: z.ZodUnknown;
    newValue: z.ZodUnknown;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    type: "vehicle_state_change";
    field: string;
    previousValue?: unknown;
    newValue?: unknown;
}, {
    timestamp: string;
    type: "vehicle_state_change";
    field: string;
    previousValue?: unknown;
    newValue?: unknown;
}>, z.ZodObject<{
    type: z.ZodLiteral<"timer">;
    intervalMs: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    type: "timer";
    intervalMs: number;
}, {
    timestamp: string;
    type: "timer";
    intervalMs: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mode_change">;
    previousMode: z.ZodString;
    requestedMode: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    type: "mode_change";
    previousMode: string;
    requestedMode: string;
}, {
    timestamp: string;
    type: "mode_change";
    previousMode: string;
    requestedMode: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"uta_feedback">;
    feedbackType: z.ZodEnum<["thumbs_up", "thumbs_down", "voice_correction", "voice_positive"]>;
    referenceMessageId: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    type: "uta_feedback";
    feedbackType: "thumbs_up" | "thumbs_down" | "voice_correction" | "voice_positive";
    content?: string | undefined;
    referenceMessageId?: string | undefined;
}, {
    timestamp: string;
    type: "uta_feedback";
    feedbackType: "thumbs_up" | "thumbs_down" | "voice_correction" | "voice_positive";
    content?: string | undefined;
    referenceMessageId?: string | undefined;
}>]>;
export type ReasoningTrigger = z.infer<typeof ReasoningTriggerSchema>;
//# sourceMappingURL=triggers.d.ts.map