import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase service-role client (server-side only).
 * Returns null if env vars not configured — callers degrade gracefully.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}
