import { getSupabaseClient } from "./supabase-client.js";
import { embedText } from "./embeddings.js";
import type { MemoryChunk } from "@eva/types";

export interface StoreMemoryInput {
  userId: string;
  content: string;
  source: MemoryChunk["source"];
  weight?: number;
  /** Memory category — drives category-aware retrieval decay (migration 007) */
  category?: string;
}

/**
 * Write a memory chunk to Supabase.
 * Embeds the content and stores both text + vector.
 * Category is carried through from the extraction candidate so retrieval
 * decay can be category-aware (identity persists, moods fade).
 * Non-fatal if Supabase not configured — logs and returns null.
 */
export async function storeMemory(input: StoreMemoryInput): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[memory:store] Supabase not configured — skipping memory write");
    return null;
  }

  const embedding = await embedText(input.content);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("memory_chunks")
    .insert({
      user_id: input.userId,
      content: input.content,
      // Pass as raw JS array — Supabase client serialises to pgvector format.
      // Do NOT JSON.stringify — that produces a string, not a vector.
      embedding: embedding ?? null,
      source: input.source,
      weight: input.weight ?? 1.0,
      category: input.category ?? null,
      last_reinforced_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[memory:store] Insert error:", error.message);
    return null;
  }

  console.log(`[memory:store] Stored chunk ${data.id} for user ${input.userId}${input.category ? ` (${input.category})` : ""}`);
  return data.id as string;
}

/**
 * Reinforce an existing memory — restarts its decay clock.
 * Call when a memory is re-observed, re-confirmed, or proves relevant.
 */
export async function reinforceMemory(memoryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("memory_chunks")
    .update({ last_reinforced_at: new Date().toISOString() })
    .eq("id", memoryId);

  if (error) {
    console.error("[memory:store] Reinforce error:", error.message);
  }
}
