import { getSupabaseClient } from "./supabase-client.js";

export type MessageRole = "user" | "assistant" | "tool";

export interface MessageRecord {
  id?: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: unknown;
}

/**
 * Write a single message turn to the messages table.
 * Called after every user input and every EVA response.
 * Non-fatal if Supabase not configured.
 */
export async function writeMessage(msg: MessageRecord): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const payload = {
    session_id: msg.sessionId,
    role: msg.role,
    content: msg.content,
    tool_calls: msg.toolCalls ?? null,
    pii_class: "personal",
  };

  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    // 23503 = FK violation — session row may not have committed yet.
    // Retry once after 200ms.
    if (error.code === "23503") {
      await new Promise(r => setTimeout(r, 200));
      const { data: retryData, error: retryError } = await supabase
        .from("messages")
        .insert(payload)
        .select("id")
        .single();

      if (retryError) {
        console.error("[memory:messages] Write error (retry):", retryError.message);
        return null;
      }
      return retryData.id as string;
    }

    console.error("[memory:messages] Write error:", error.message);
    return null;
  }

  return data.id as string;
}

/**
 * Retrieve the last N conversation turns for a session.
 * Used to build the conversation window for the system prompt.
 * Returns turns in chronological order (oldest first).
 */
export async function getConversationWindow(
  sessionId: string,
  limit: number = 30
): Promise<Array<{ role: MessageRole; content: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  // Fetch latest N in reverse, then reverse back to chronological
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, timestamp")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("[memory:messages] Read error:", error?.message);
    return [];
  }

  return data
    .reverse()
    .map(row => ({ role: row.role as MessageRole, content: row.content }));
}

/**
 * Retrieve the last N turns across ALL sessions for a user.
 * Used by the memory extractor and pattern analyser — not the live prompt.
 */
export async function getUserMessageHistory(
  userId: string,
  limit: number = 100
): Promise<Array<{ role: MessageRole; content: string; sessionId: string; timestamp: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("role, content, session_id, timestamp, sessions!inner(user_id)")
    .eq("sessions.user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("[memory:messages] User history error:", error?.message);
    return [];
  }

  return data.reverse().map(row => ({
    role: row.role as MessageRole,
    content: row.content,
    sessionId: row.session_id,
    timestamp: row.timestamp,
  }));
}
