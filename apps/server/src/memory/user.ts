import { getSupabaseClient } from "./supabase-client.js";

/**
 * Upserts an anonymous user row into the users table.
 *
 * Called on every session start — before any DB writes that reference user_id.
 * Anonymous users have no email. Email is populated later when/if auth is added
 * (Google Sign-In, Apple Sign-In, or any other provider).
 *
 * Multiple calls with the same userId are safe — ON CONFLICT DO NOTHING.
 * Non-fatal if Supabase is not configured.
 */
export async function createOrGetUser(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    // Supabase not configured — graceful no-op, session continues in-memory only
    return;
  }

  const { error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        // email: null — anonymous user, set by auth provider later
        preferences: {},
        pii_class: "personal",
        consent_flags: {},
      },
      {
        onConflict: "id",
        ignoreDuplicates: true, // ON CONFLICT (id) DO NOTHING
      }
    );

  if (error) {
    // Non-fatal — log and continue. Memory will degrade gracefully.
    console.error(`[memory:user] Failed to upsert user ${userId}:`, error.message);
  } else {
    console.log(`[memory:user] User ready: ${userId}`);
  }
}
