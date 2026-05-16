"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryChunkSchema = void 0;
const zod_1 = require("zod");
/**
 * A retrieved memory chunk from Supabase pgvector.
 * Hybrid retrieval: semantic similarity + recency + explicit preference weight.
 */
exports.MemoryChunkSchema = zod_1.z.object({
    id: zod_1.z.string(),
    content: zod_1.z.string(),
    /** Embedding is not transmitted to the reasoning model — only content */
    source: zod_1.z.enum([
        "conversation",
        "feedback",
        "adas_event",
        "explicit_preference",
    ]),
    /** Recency-decayed relevance score, 0.0 – 1.0 */
    weight: zod_1.z.number().min(0).max(1),
    createdAt: zod_1.z.string().datetime(),
});
//# sourceMappingURL=memory.js.map