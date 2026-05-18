import { Hono } from "hono";
import {
  getSmartcarClient,
  isSmartcarConfigured,
  storeSmartcarUserId,
  getSmartcarTokens,
  getApplicationToken,
  resolveVehicleOwnerUserId,
} from "../smartcar/client.js";

const smartcarRoutes = new Hono();

/**
 * GET /smartcar/auth?userId=xxx
 * Returns the SmartCar Connect URL for the mobile app to open in a browser.
 * The EVA driverId is passed through as state so we can associate on callback.
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
 * GET /smartcar/callback?code=xxx&user_id=xxx&state=xxx
 *
 * SmartCar v3 callback — no token exchange needed.
 * SmartCar sends the user_id directly as a query param.
 * We store it against the EVA driverId (passed as state).
 */
smartcarRoutes.get("/smartcar/callback", async (c) => {
  if (!isSmartcarConfigured()) {
    return c.text("SmartCar not configured", 503);
  }

  // SmartCar v3 sends user_id directly — no code exchange needed
  const smartcarUserId = c.req.query("user_id");
  const driverId = c.req.query("state"); // EVA driverId passed as state

  console.log(`[smartcar] Callback — smartcarUserId=${smartcarUserId} driverId=${driverId}`);

  if (!smartcarUserId || !driverId) {
    console.error("[smartcar] Callback missing user_id or state", {
      smartcarUserId,
      driverId,
      allParams: Object.fromEntries(new URL(c.req.url).searchParams),
    });
    return c.redirect("eva://smartcar/error");
  }

  try {
    // Option A: Resolve the real vehicle-owner sc-user-id at connect time.
    // The OAuth callback gives us an OAuth session user_id which differs from
    // the vehicle owner user_id needed for sc-user-id header on API calls.
    // We get the app token and resolve the correct ID immediately.
    let resolvedUserId = smartcarUserId;
    const appToken = await getApplicationToken();
    if (appToken) {
      resolvedUserId = await resolveVehicleOwnerUserId(smartcarUserId, appToken);
    } else {
      console.warn("[smartcar] No app token — storing OAuth user ID as fallback");
    }

    await storeSmartcarUserId(driverId, resolvedUserId);
    console.log(`[smartcar] SmartCar user ID stored for driver ${driverId} (sc-user-id: ${resolvedUserId})`);
    return c.redirect(`eva://smartcar/success?userId=${driverId}`);
  } catch (err) {
    console.error("[smartcar] Failed to store user ID:", err);
    return c.redirect("eva://smartcar/error");
  }
});

/**
 * GET /smartcar/status?userId=xxx
 * Returns whether a driver has connected their vehicle via SmartCar.
 */
smartcarRoutes.get("/smartcar/status", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ connected: false });

  const tokens = await getSmartcarTokens(userId);
  return c.json({ connected: !!tokens });
});

export { smartcarRoutes };
