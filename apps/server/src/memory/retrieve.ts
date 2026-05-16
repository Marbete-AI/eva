import { getSupabaseClient } from "./supabase-client.js";
import { embedText } from "./embeddings.js";
import type { MemoryChunk } from "@eva/types";

export interface RetrieveMemoryInput {
  userId: string;
  query: string;
  /** Max chunks to return (default 5) */
  limit?: number;
}

/**
 * Hybrid memory retrieval:
 *   1. Semantic similarity (pgvector cosine distance)
 *   2. Recency weight (exponential decay, half-life ~7 days)
 *   3. Explicit preference weight (stored weight field)
 *
 * Combined score = similarity * recency * weight
 * Returns top-N chunks sorted by combined score.
 *
 * Falls back to empty array if Supabase not configured or embedding fails.
 */
export async function retrieveMemory(
  input: RetrieveMemoryInput
): Promise<MemoryChunk[]> {
  const { userId, query, limit = 5 } = input;

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[memory:retrieve] Supabase not configured — returning empty");
    return [];
  }

  // Get query embedding
  const embedding = await embedText(query);
  if (!embedding) {
    // Fallback: recency-only retrieval (no vector search)
    const { data, error } = await supabase
      .from("memory_chunks")
      .select("id, content, source, weight, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(toMemoryChunk);
  }

  // Vector similarity search via pgvector RPC
  // Requires this function in Supabase (migration 002).
  // Pass embedding as raw JS array — Supabase serialises to pgvector format.
  const { data, error } = await supabase.rpc("match_memory_chunks", {
    query_embedding: embedding,
    query_user_id: userId,
    match_count: limit * 3, // Over-fetch, then re-rank
  });

  if (error || !data) {
    console.warn("[memory:retrieve] Vector search error:", error?.message);
    return [];
  }

  // Re-rank: similarity * recency_decay * weight
  const now = Date.now();
  const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  interface RawChunk {
    id: string;
    content: string;
    source: string;
    weight: number;
    created_at: string;
    similarity: number;
  }

  const ranked = (data as RawChunk[])
    .map((row) => {
      const ageMs = now - new Date(row.created_at).getTime();
      const recency = Math.exp((-Math.LN2 * ageMs) / HALF_LIFE_MS);
      const combinedScore = row.similarity * recency * row.weight;
      return { ...row, combinedScore };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);

  return ranked.map((row) =>
    toMemoryChunk({ ...row, combined_score: row.combinedScore })
  );
}

function toMemoryChunk(row: {
  id: string;
  content: string;
  source: string;
  weight: number;
  created_at: string;
  combined_score?: number;
}): MemoryChunk {
  return {
    id: row.id,
    content: row.content,
    source: row.source as MemoryChunk["source"],
    weight: row.combined_score ?? row.weight,
    createdAt: row.created_at,
  };
}
