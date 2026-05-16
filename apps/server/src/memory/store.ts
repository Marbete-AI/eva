import { getSupabaseClient } from "./supabase-client.js";
import { embedText } from "./embeddings.js";
import type { MemoryChunk } from "@eva/types";

export interface StoreMemoryInput {
  userId: string;
  content: string;
  source: MemoryChunk["source"];
  weight?: number;
}

/**
 * Write a memory chunk to Supabase.
 * Embeds the content and stores both text + vector.
 * Non-fatal if Supabase not configured — logs and returns null.
 */
export async function storeMemory(input: StoreMemoryInput): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[memory:store] Supabase not configured — skipping memory write");
    return null;
  }

  const embedding = await embedText(input.content);

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
    })
    .select("id")
    .single();

  if (error) {
    console.error("[memory:store] Insert error:", error.message);
    return null;
  }

  console.log(`[memory:store] Stored chunk ${data.id} for user ${input.userId}`);
  return data.id as string;
}
