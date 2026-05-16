import { Hono } from "hono";
import Smartcar from "smartcar";
import {
  getSmartcarClient,
  isSmartcarConfigured,
  storeSmartcarTokens,
} from "../smartcar/client.js";

const smartcarRoutes = new Hono();

/**
 * GET /smartcar/auth?userId=xxx
 * Returns the SmartCar Connect URL for the mobile app to open in a browser.
 * The userId is passed through as state so we can associate tokens on callback.
 */
smartcarRoutes.get("/smartcar/auth", (c) => {
  if (!isSmartcarConfigured()) {
    return c.json(
      { error: "SmartCar not configured — set SMARTCAR_CLIENT_ID and SMARTCAR_CLIENT_SECRET" },
      503
    );
  }

  const userId = c.req.query("userId");
  if (!userId) {
    return c.json({ error: "userId query param required" }, 400);
  }

  const client = getSmartcarClient();
  const authUrl = client.getAuthUrl({
    state: userId,
    // Request the permissions EVA needs
    scope: [
      "read_vehicle_info",
      "read_battery",
      "read_charge",
      "read_fuel",
      "read_location",
      "read_odometer",
      "read_speedometer",
    ],
  });

  return c.json({ authUrl });
});

/**
 * GET /smartcar/callback?code=xxx&state=xxx
 * SmartCar redirects here after the user connects their vehicle.
 * Exchanges the code for tokens, stores them, redirects back to the app.
 */
smartcarRoutes.get("/smartcar/callback", async (c) => {
  if (!isSmartcarConfigured()) {
    return c.text("SmartCar not configured", 503);
  }

  const code = c.req.query("code");
  const userId = c.req.query("state"); // We passed userId as state

  if (!code || !userId) {
    return c.text("Missing code or state", 400);
  }

  try {
    const client = getSmartcarClient();
    const tokens = await client.exchangeCode(code);

    await storeSmartcarTokens(userId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiration.toISOString(),
    });

    console.log(`[smartcar] Tokens stored for user ${userId}`);

    // Deep-link back to the EVA app — the app handles eva://smartcar/success
    return c.redirect(`eva://smartcar/success?userId=${userId}`);
  } catch (err) {
    console.error("[smartcar] OAuth callback error:", err);
    return c.redirect(`eva://smartcar/error`);
  }
});

/**
 * GET /smartcar/status?userId=xxx
 * Returns whether a user has connected their vehicle.
 */
smartcarRoutes.get("/smartcar/status", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ connected: false });

  const { getSmartcarTokens } = await import("../smartcar/client.js");
  const tokens = await getSmartcarTokens(userId);

  return c.json({ connected: !!tokens });
});

export { smartcarRoutes };
