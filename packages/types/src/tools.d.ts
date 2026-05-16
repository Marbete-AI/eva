import { z } from "zod";
/**
 * Context passed to every tool call — enables tracing and logging.
 * Every tool receives this; nothing runs without session attribution.
 */
export declare const ToolCallContextSchema: z.ZodObject<{
    driverId: z.ZodString;
    sessionId: z.ZodString;
    triggeredBy: z.ZodString;
    requestId: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    sessionId: string;
    driverId: string;
    triggeredBy: string;
    requestId: string;
}, {
    timestamp: string;
    sessionId: string;
    driverId: string;
    triggeredBy: string;
    requestId: string;
}>;
export type ToolCallContext = z.infer<typeof ToolCallContextSchema>;
/**
 * Uniform tool return envelope.
 * All tools return this shape — reasoning model sees a consistent interface.
 */
export declare const EvaToolResultSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
    /** How fresh is this data? ISO 8601 timestamp of the underlying source read */
    dataFreshAt: z.ZodOptional<z.ZodString>;
    /** Source identifier for audit trail */
    source: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    source: string;
    data?: unknown;
    error?: string | undefined;
    dataFreshAt?: string | undefined;
}, {
    ok: boolean;
    source: string;
    data?: unknown;
    error?: string | undefined;
    dataFreshAt?: string | undefined;
}>;
export type EvaToolResult = z.infer<typeof EvaToolResultSchema>;
//# sourceMappingURL=tools.d.ts.map