import { getSupabaseClient } from "./supabase-client.js";
import { embedText } from "./embeddings.js";
import type { MemoryChunk } from "@eva/types";
import { DECAY_PARAMS, DEFAULT_DECAY, type MemoryCategory } from "./extractor/categories.js";

export interface RetrieveMemoryInput {
  userId: string;
  query: string;
  /** Max chunks to return (default 5) */
  limit?: number;
}

/**
 * Hybrid memory retrieval — real-world tuned:
 *   1. Semantic similarity (pgvector cosine distance)
 *   2. Category-aware recency decay (identity persists ~1yr, moods fade in 2 days)
 *      with a per-category floor so confirmed memories never fully vanish
 *   3. Explicit preference weight (stored weight field)
 *
 * Combined score = similarity * recency * weight
 * Decay runs from last_reinforced_at — re-confirmed memories stay fresh.
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

  interface RawChunk {
    id: string;
    content: string;
    source: string;
    weight: number;
    created_at: string;
    similarity: number;
    category?: string | null;
    last_reinforced_at?: string | null;
  }

  const rawChunks = data as RawChunk[];

  // The RPC may not return category/last_reinforced_at (pre-007 function).
  // Fetch them in one query for the matched IDs so decay is category-aware.
  const ids = rawChunks.map(r => r.id);
  const metaById = new Map<string, { category: string | null; lastReinforcedAt: string | null }>();
  if (ids.length > 0) {
    const { data: metaRows } = await supabase
      .from("memory_chunks")
      .select("id, category, last_reinforced_at")
      .in("id", ids);
    for (const row of metaRows ?? []) {
      metaById.set(row.id as string, {
        category: (row.category as string | null) ?? null,
        lastReinforcedAt: (row.last_reinforced_at as string | null) ?? null,
      });
    }
  }

  // Re-rank: similarity * category-aware recency decay * weight
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const ranked = rawChunks
    .map((row) => {
      const meta = metaById.get(row.id);
      const decay =
        meta?.category && meta.category in DECAY_PARAMS
          ? DECAY_PARAMS[meta.category as MemoryCategory]
          : DEFAULT_DECAY;

      // Decay from last_reinforced_at when available, else created_at
      const anchor = meta?.lastReinforcedAt ?? row.created_at;
      const ageMs = Math.max(0, now - new Date(anchor).getTime());
      const halfLifeMs = decay.halfLifeDays * DAY_MS;

      const rawRecency = Math.exp((-Math.LN2 * ageMs) / halfLifeMs);
      const recency = Math.max(decay.recencyFloor, rawRecency);

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
