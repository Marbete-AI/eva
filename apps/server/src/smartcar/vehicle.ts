import Smartcar from "smartcar";
import { getSmartcarClient, getValidAccessToken, isSmartcarConfigured } from "./client.js";

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

/**
 * Fetch real vehicle state from SmartCar.
 * Reads battery, range, odometer, speed, location in parallel.
 * Falls back to mock data if SmartCar not configured or token unavailable.
 */
export async function getVehicleState(
  userId: string,
  vehicleId?: string
): Promise<SmartcarVehicleData> {
  if (!isSmartcarConfigured()) {
    return getMockVehicleState();
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    console.warn("[smartcar] No valid access token for user — returning mock");
    return getMockVehicleState();
  }

  try {
    // Get list of vehicles if no vehicleId provided
    let resolvedVehicleId = vehicleId;
    if (!resolvedVehicleId) {
      const { vehicles } = await Smartcar.getVehicles(accessToken);
      resolvedVehicleId = vehicles[0];
    }

    if (!resolvedVehicleId) {
      console.warn("[smartcar] No vehicles found for user");
      return getMockVehicleState();
    }

    const vehicle = new Smartcar.Vehicle(resolvedVehicleId, accessToken);

    // Fetch all signals in parallel — each call is independent
    const [battery, odometer, location, speed] = await Promise.allSettled([
      vehicle.battery(),
      vehicle.odometer(),
      vehicle.location(),
      vehicle.speed?.() ?? Promise.reject("speed not available"),
    ]);

    const batteryData = battery.status === "fulfilled" ? battery.value : null;
    const odometerData = odometer.status === "fulfilled" ? odometer.value : null;
    const locationData = location.status === "fulfilled" ? location.value : null;
    const speedData = speed.status === "fulfilled" ? speed.value : null;

    // SmartCar returns range in km for metric, miles for imperial
    // percentRemaining is 0.0–1.0
    const batteryPercent = batteryData
      ? Math.round((batteryData as { percentRemaining: number }).percentRemaining * 100)
      : null;

    const rangeKm = batteryData
      ? Math.round((batteryData as { range: { value: number } }).range?.value ?? 0)
      : null;

    const odometerKm = odometerData
      ? Math.round((odometerData as { distance: { value: number } }).distance?.value ?? 0)
      : null;

    const loc = locationData
      ? {
          lat: (locationData as { data: { latitude: number; longitude: number } }).data?.latitude,
          lon: (locationData as { data: { latitude: number; longitude: number } }).data?.longitude,
        }
      : null;

    const speedKmh = speedData
      ? Math.round((speedData as { speed: { value: number } }).speed?.value ?? 0)
      : null;

    return {
      vehicleId: resolvedVehicleId,
      batteryPercent,
      rangeKm,
      speedKmh,
      location: loc?.lat && loc?.lon ? { lat: loc.lat, lon: loc.lon } : null,
      odometer: odometerKm,
      driveMode: null, // Not available on all vehicles
      lastReadAt: new Date().toISOString(),
      widthMm: null, // Not available via SmartCar API — set from user preferences
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
