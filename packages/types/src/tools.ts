import { z } from "zod";

/**
 * Context passed to every tool call — enables tracing and logging.
 * Every tool receives this; nothing runs without session attribution.
 */
export const ToolCallContextSchema = z.object({
  driverId: z.string(),
  sessionId: z.string(),
  triggeredBy: z.string(),
  requestId: z.string(),
  timestamp: z.string().datetime(),
});

export type ToolCallContext = z.infer<typeof ToolCallContextSchema>;

/**
 * Uniform tool return envelope.
 * All tools return this shape — reasoning model sees a consistent interface.
 */
export const EvaToolResultSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  /** How fresh is this data? ISO 8601 timestamp of the underlying source read */
  dataFreshAt: z.string().datetime().optional(),
  /** Source identifier for audit trail */
  source: z.string(),
});

export type EvaToolResult = z.infer<typeof EvaToolResultSchema>;
