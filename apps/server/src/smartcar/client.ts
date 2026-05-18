import { createRequire } from "module";
import { getSupabaseClient } from "../memory/supabase-client.js";

// Use createRequire to load the CJS smartcar package correctly in ESM context.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sc = require("smartcar") as Record<string, any>;
const AuthClient = sc["AuthClient"] as new (opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  mode?: "simulated" | "live" | "test";
}) => {
  getAuthUrl(opts?: { state?: string; scope?: string[]; forcePrompt?: boolean }): string;
};

const SMARTCAR_IAM_URL = "https://iam.smartcar.com/oauth2/token";

// ── AuthClient (Connect URL generation only) ──────────────────────────────────

let _authClient: InstanceType<typeof AuthClient> | null = null;

export function getSmartcarClient(): InstanceType<typeof AuthClient> {
  const clientId = process.env["SMARTCAR_CLIENT_ID"] ?? "";
  const clientSecret = process.env["SMARTCAR_CLIENT_SECRET"] ?? "";
  const redirectUri = process.env["SMARTCAR_REDIRECT_URI"] ?? "http://localhost:8787/smartcar/callback";
  const mode = (process.env["SMARTCAR_MODE"] ?? "simulated") as "simulated" | "live" | "test";

  if (_authClient) return _authClient;

  _authClient = new AuthClient({ clientId, clientSecret, redirectUri, mode });
  return _authClient;
}

export function isSmartcarConfigured(): boolean {
  return !!(
    process.env["SMARTCAR_CLIENT_ID"] &&
    process.env["SMARTCAR_CLIENT_SECRET"]
  );
}

// ── Application-level access token (OAuth 2.0 client_credentials) ─────────────
//
// SmartCar v3 uses a single application-level token for all API calls.
// The token is valid for 1 hour. There is no refresh token — just re-fetch.
// We cache it in memory with expiry; no need to persist to DB.

interface AppToken {
  accessToken: string;
  expiresAt: number; // Unix ms
}

let _appToken: AppToken | null = null;

export async function getApplicationToken(): Promise<string | null> {
  // API credentials (client_credentials grant) are separate from OAuth Connect
  // credentials. Set SMARTCAR_API_CLIENT_ID and SMARTCAR_API_CLIENT_SECRET
  // from the "API Credentials" tab in the SmartCar dashboard.
  // Falls back to the OAuth credentials if API-specific ones are not set.
  const clientId = process.env["SMARTCAR_API_CLIENT_ID"]
    ?? process.env["SMARTCAR_CLIENT_ID"]
    ?? "";
  const clientSecret = process.env["SMARTCAR_API_CLIENT_SECRET"]
    ?? process.env["SMARTCAR_CLIENT_SECRET"]
    ?? "";

  if (!clientId || !clientSecret) return null;

  // Return cached token if still valid (with 60s buffer)
  if (_appToken && Date.now() < _appToken.expiresAt - 60_000) {
    return _appToken.accessToken;
  }

  try {
    const response = await fetch(SMARTCAR_IAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[smartcar] Failed to get app token: ${response.status} ${text}`);
      return null;
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    _appToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    console.log(`[smartcar] App token obtained, expires in ${data.expires_in}s`);
    return _appToken.accessToken;
  } catch (err) {
    console.error("[smartcar] App token fetch failed:", err);
    return null;
  }
}

// ── SmartCar user ID resolution ───────────────────────────────────────────────
//
// SmartCar has two different user identifiers:
//
//   OAuth callback user_id  — identifies the OAuth session (who connected)
//   Connection owner user_id — relationships.user.data.id on the connection object
//                              This is the correct sc-user-id for API calls
//
// We resolve the correct one at connect time by calling the connections API
// immediately after the callback, so the right ID is stored from the start.

const SMARTCAR_V3_API = "https://vehicle.api.smartcar.com/v3";

/**
 * Resolve the vehicle-owner user ID (sc-user-id) for a given OAuth user ID.
 *
 * The OAuth callback returns a `user_id` that identifies the OAuth session.
 * The connections API returns the vehicle owner's user ID under
 * `data[0].relationships.user.data.id` — this is what the sc-user-id header
 * needs to be set to for vehicle API calls to work correctly.
 *
 * Falls back to the OAuth user ID if the connections API call fails.
 */
export async function resolveVehicleOwnerUserId(
  oauthUserId: string,
  appToken: string
): Promise<string> {
  try {
    const res = await fetch(`${SMARTCAR_V3_API}/connections`, {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "sc-user-id": oauthUserId,
      },
    });

    if (!res.ok) {
      console.warn(`[smartcar] Could not resolve vehicle owner user ID: ${res.status}`);
      return oauthUserId;
    }

    const body = (await res.json()) as {
      data: Array<{
        relationships: {
          user: { data: { id: string } };
        };
      }>;
    };

    const vehicleOwnerUserId = body.data[0]?.relationships?.user?.data?.id;
    if (!vehicleOwnerUserId) {
      console.warn("[smartcar] No vehicle owner user ID in connections response — using OAuth user ID");
      return oauthUserId;
    }

    if (vehicleOwnerUserId !== oauthUserId) {
      console.log(`[smartcar] Resolved vehicle owner user ID: ${vehicleOwnerUserId} (OAuth was: ${oauthUserId})`);
    }

    return vehicleOwnerUserId;
  } catch (err) {
    console.error("[smartcar] resolveVehicleOwnerUserId failed:", err);
    return oauthUserId;
  }
}

// ── SmartCar user ID storage ──────────────────────────────────────────────────
//
// We store the resolved vehicle-owner user ID (sc-user-id) per EVA driver.
// This is the correct ID to use as the sc-user-id header on all API calls.

export async function storeSmartcarUserId(
  driverId: string,
  smartcarUserId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("smartcar_tokens")
    .upsert(
      {
        user_id: driverId,
        smartcar_user_id: smartcarUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[smartcar] Failed to store SmartCar user ID:", error.message);
  }
}

export async function getSmartcarUserId(
  driverId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("smartcar_tokens")
    .select("smartcar_user_id")
    .eq("user_id", driverId)
    .single();

  if (error || !data) return null;
  return (data.smartcar_user_id as string) ?? null;
}

// Keep old interface for any callers that check connection status
export async function getSmartcarTokens(
  driverId: string
): Promise<{ connected: true } | null> {
  const userId = await getSmartcarUserId(driverId);
  return userId ? { connected: true } : null;
}
