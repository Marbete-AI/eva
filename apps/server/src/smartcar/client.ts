import Smartcar from "smartcar";
import { getSupabaseClient } from "../memory/supabase-client.js";

const CLIENT_ID = process.env["SMARTCAR_CLIENT_ID"] ?? "";
const CLIENT_SECRET = process.env["SMARTCAR_CLIENT_SECRET"] ?? "";
const REDIRECT_URI = process.env["SMARTCAR_REDIRECT_URI"] ?? "http://localhost:8787/smartcar/callback";

let _client: InstanceType<typeof Smartcar> | null = null;

export function getSmartcarClient(): InstanceType<typeof Smartcar> {
  if (!_client) {
    _client = new Smartcar({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      mode: (process.env["SMARTCAR_MODE"] ?? "simulated") as "simulated" | "live" | "test",
    });
  }
  return _client;
}

export function isSmartcarConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

// ── Token storage ──────────────────────────────────────────────────────────────

export interface SmartcarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO 8601
}

/**
 * Store SmartCar OAuth tokens for a user.
 * Tokens are upserted — only one set per user.
 */
export async function storeSmartcarTokens(
  userId: string,
  tokens: SmartcarTokens
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("smartcar_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[smartcar] Failed to store tokens:", error.message);
  }
}

/**
 * Retrieve stored SmartCar tokens for a user.
 * Returns null if not configured or no tokens stored.
 */
export async function getSmartcarTokens(
  userId: string
): Promise<SmartcarTokens | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("smartcar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: data.expires_at as string,
  };
}

/**
 * Refresh expired tokens and store the new ones.
 */
export async function refreshSmartcarTokens(
  userId: string,
  refreshToken: string
): Promise<SmartcarTokens | null> {
  const client = getSmartcarClient();

  try {
    const newTokens = await client.exchangeRefreshToken(refreshToken);

    const tokens: SmartcarTokens = {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: newTokens.expiration.toISOString(),
    };

    await storeSmartcarTokens(userId, tokens);
    return tokens;
  } catch (err) {
    console.error("[smartcar] Token refresh failed:", err);
    return null;
  }
}

/**
 * Get a valid access token — refreshes automatically if expired.
 */
export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const tokens = await getSmartcarTokens(userId);
  if (!tokens) return null;

  const expiresAt = new Date(tokens.expiresAt);
  const now = new Date();

  // Refresh if expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshSmartcarTokens(userId, tokens.refreshToken);
    return refreshed?.accessToken ?? null;
  }

  return tokens.accessToken;
}
