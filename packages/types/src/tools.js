"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaToolResultSchema = exports.ToolCallContextSchema = void 0;
const zod_1 = require("zod");
/**
 * Context passed to every tool call — enables tracing and logging.
 * Every tool receives this; nothing runs without session attribution.
 */
exports.ToolCallContextSchema = zod_1.z.object({
    driverId: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    triggeredBy: zod_1.z.string(),
    requestId: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
});
/**
 * Uniform tool return envelope.
 * All tools return this shape — reasoning model sees a consistent interface.
 */
exports.EvaToolResultSchema = zod_1.z.object({
    ok: zod_1.z.boolean(),
    data: zod_1.z.unknown().optional(),
    error: zod_1.z.string().optional(),
    /** How fresh is this data? ISO 8601 timestamp of the underlying source read */
    dataFreshAt: zod_1.z.string().datetime().optional(),
    /** Source identifier for audit trail */
    source: zod_1.z.string(),
});
//# sourceMappingURL=tools.js.map