import { z } from "zod";

/**
 * A retrieved memory chunk from Supabase pgvector.
 * Hybrid retrieval: semantic similarity + recency + explicit preference weight.
 */
export const MemoryChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  /** Embedding is not transmitted to the reasoning model — only content */
  source: z.enum([
    "conversation",
    "feedback",
    "adas_event",
    "explicit_preference",
  ]),
  /** Recency-decayed relevance score, 0.0 – 1.0 */
  weight: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});

export type MemoryChunk = z.infer<typeof MemoryChunkSchema>;
