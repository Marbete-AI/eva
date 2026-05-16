import { z } from "zod";
/**
 * A retrieved memory chunk from Supabase pgvector.
 * Hybrid retrieval: semantic similarity + recency + explicit preference weight.
 */
export declare const MemoryChunkSchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodString;
    /** Embedding is not transmitted to the reasoning model — only content */
    source: z.ZodEnum<["conversation", "feedback", "adas_event", "explicit_preference"]>;
    /** Recency-decayed relevance score, 0.0 – 1.0 */
    weight: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: "conversation" | "feedback" | "adas_event" | "explicit_preference";
    id: string;
    content: string;
    weight: number;
    createdAt: string;
}, {
    source: "conversation" | "feedback" | "adas_event" | "explicit_preference";
    id: string;
    content: string;
    weight: number;
    createdAt: string;
}>;
export type MemoryChunk = z.infer<typeof MemoryChunkSchema>;
//# sourceMappingURL=memory.d.ts.map