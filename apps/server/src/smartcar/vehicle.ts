import { getApplicationToken, getSmartcarUserId, isSmartcarConfigured } from "./client.js";

const SMARTCAR_API = "https://vehicle.api.smartcar.com/v3";

export interface SmartcarVehicleData {
  vehicleId: string;
  batteryPercent: number | null;
  rangeKm: number | null;
  speedKmh: number | null;
  location: { lat: number; lon: number } | null;
  odometer: number | null;
  driveMode: string | null;
  lastReadAt: string;
  widthMm: number | null;
  source: "smartcar" | "smartcar_mock";
}

// ── SmartCar v3 signal codes ───────────────────────────────────────────────
// Signal API path: GET /v3/vehicles/{id}/signals/{signalCode}
// Response envelope: { data: { id, type, attributes: { code, body: { value, unit, ... } } } }

const SIGNALS = {
  batteryLevel:  "tractionbattery-stateofcharge",  // body.value = 0-100 percent
  batteryRange:  "tractionbattery-range",           // body.value = km
  speed:         "motion-currentspeed",             // body.value = km/h
  location:      "location-preciselocation",        // body.latitude, body.longitude
  odometer:      "odometer-traveleddistance",       // body.value = km
};

/**
 * Fetch a single signal value from the SmartCar v3 API.
 * Returns null if the signal is not configured or the vehicle doesn't support it.
 */
async function fetchSignal(
  vehicleId: string,
  signalCode: string,
  headers: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(
      `${SMARTCAR_API}/vehicles/${vehicleId}/signals/${signalCode}`,
      { headers }
    );
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        attributes?: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body?: Record<string, any>;
          status?: { value: string };
        };
      };
    };

    const status = body.data?.attributes?.status?.value;
    if (status && status !== "SUCCESS") return null;

    return body.data?.attributes?.body ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch vehicle state using SmartCar v3 REST API.
 *
 * Auth model:
 *   - Application-level Bearer token (client_credentials, 1hr TTL)
 *   - sc-user-id header identifies which user's vehicle to read
 *
 * Signal API: GET /v3/vehicles/{id}/signals/{signalCode}
 * Connections API: GET /v3/connections (JSON:API format)
 *
 * Falls back to mock data if SmartCar not configured, user not connected,
 * or signals not yet published in the simulator.
 */
export async function getVehicleState(
  driverId: string,
  vehicleId?: string
): Promise<SmartcarVehicleData> {
  if (!isSmartcarConfigured()) {
    return getMockVehicleState();
  }

  const smartcarUserId = await getSmartcarUserId(driverId);
  if (!smartcarUserId) {
    console.warn("[smartcar] No SmartCar user ID for driver — returning mock");
    return getMockVehicleState();
  }

  const appToken = await getApplicationToken();
  if (!appToken) {
    console.warn("[smartcar] Could not get application token — returning mock");
    return getMockVehicleState();
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${appToken}`,
    "sc-user-id": smartcarUserId,
  };

  try {
    // ── Resolve vehicle ID + sc-user-id ───────────────────────────────────
    // Option B fallback: extract the real vehicle-owner user ID from the
    // connections response at query time. This corrects the sc-user-id even
    // if the callback stored the OAuth user ID instead of the owner user ID.
    let resolvedVehicleId = vehicleId;
    let effectiveScUserId = smartcarUserId; // may be overridden below

    if (!resolvedVehicleId) {
      const connectionsRes = await fetch(`${SMARTCAR_API}/connections`, { headers });
      if (!connectionsRes.ok) {
        console.error(`[smartcar] Connections API error: ${connectionsRes.status}`);
        return getMockVehicleState();
      }

      // SmartCar v3 uses JSON:API format
      const connectionsBody = (await connectionsRes.json()) as {
        data: Array<{
          relationships: {
            vehicle: { data: { id: string } };
            user: { data: { id: string } };
          };
        }>;
      };

      const connection = connectionsBody.data[0];
      resolvedVehicleId = connection?.relationships?.vehicle?.data?.id;

      // Extract real vehicle-owner user ID from the connection — this is the
      // correct sc-user-id for signal/vehicle API calls (Option B fallback).
      const ownerUserId = connection?.relationships?.user?.data?.id;
      if (ownerUserId && ownerUserId !== smartcarUserId) {
        console.log(`[smartcar] Using vehicle-owner sc-user-id from connection: ${ownerUserId}`);
        effectiveScUserId = ownerUserId;
        // Update headers for subsequent signal calls
        headers["sc-user-id"] = effectiveScUserId;
      }
    }

    if (!resolvedVehicleId) {
      console.warn("[smartcar] No vehicles found for user");
      return getMockVehicleState();
    }

    console.log(`[smartcar] Reading signals for vehicle ${resolvedVehicleId}`);

    // ── Fetch all signals in parallel ──────────────────────────────────────
    const [battery, range, speed, location, odometer] = await Promise.all([
      fetchSignal(resolvedVehicleId, SIGNALS.batteryLevel, headers),
      fetchSignal(resolvedVehicleId, SIGNALS.batteryRange, headers),
      fetchSignal(resolvedVehicleId, SIGNALS.speed, headers),
      fetchSignal(resolvedVehicleId, SIGNALS.location, headers),
      fetchSignal(resolvedVehicleId, SIGNALS.odometer, headers),
    ]);

    // If no signals came back at all, the vehicle has no state configured yet
    // in the simulator — fall back to mock so EVA can still respond meaningfully
    if (!battery && !range && !speed && !location && !odometer) {
      console.warn("[smartcar] No signal data available — vehicle may need simulator state configured");
      return { ...getMockVehicleState(), vehicleId: resolvedVehicleId };
    }

    return {
      vehicleId: resolvedVehicleId,
      batteryPercent: battery?.["value"] != null ? Math.round(battery["value"]) : null,
      rangeKm:        range?.["value"] != null ? Math.round(range["value"]) : null,
      speedKmh:       speed?.["value"] != null ? Math.round(speed["value"]) : null,
      location: location?.["latitude"] != null && location?.["longitude"] != null
        ? { lat: location["latitude"] as number, lon: location["longitude"] as number }
        : null,
      odometer: odometer?.["value"] != null ? Math.round(odometer["value"]) : null,
      driveMode: null,
      lastReadAt: new Date().toISOString(),
      widthMm: null,
      source: "smartcar",
    };
  } catch (err) {
    console.error("[smartcar] Vehicle read failed:", err);
    return getMockVehicleState();
  }
}

function getMockVehicleState(): SmartcarVehicleData {
  return {
    vehicleId: "mock-vehicle-001",
    batteryPercent: 68,
    rangeKm: 214,
    speedKmh: 0,
    location: { lat: 53.4808, lon: -2.2426 },
    odometer: 12450,
    driveMode: "NORMAL",
    lastReadAt: new Date().toISOString(),
    widthMm: 2050,
    source: "smartcar_mock",
  };
}
