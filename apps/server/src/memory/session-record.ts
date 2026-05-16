import { getSupabaseClient } from "./supabase-client.js";

/**
 * Creates a session row in the sessions table.
 *
 * Called at the start of every EvaSession (WS) and dev HTTP session.
 * Must be called after createOrGetUser() — sessions.user_id FK references users.id.
 * Non-fatal if Supabase is not configured.
 */
export async function createSessionRecord(
  sessionId: string,
  userId: string,
  mode: string,
  persona: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("sessions").insert({
    id: sessionId,
    user_id: userId,
    mode,
    persona,
    pii_class: "personal",
  });

  if (error) {
    // 23505 = unique_violation — session already exists, safe to ignore
    if (error.code !== "23505") {
      console.error(
        `[memory:session] Failed to create session ${sessionId}:`,
        error.message
      );
    }
  } else {
    console.log(`[memory:session] Session created: ${sessionId}`);
  }
}

/**
 * Sets ended_at on the session row when the session closes.
 * Fire-and-forget — non-fatal.
 */
export async function closeSessionRecord(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error(
      `[memory:session] Failed to close session ${sessionId}:`,
      error.message
    );
  }
}
