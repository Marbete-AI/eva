import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

interface GMapsDirectionsResponse {
  status: string;
  routes: Array<{
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      duration_in_traffic?: { value: number; text: string };
    }>;
    warnings: string[];
  }>;
}

interface GMapsElevationResponse {
  status: string;
  results: Array<{ elevation: number }>;
}

/**
 * Tool: get_route
 * Real Google Maps Directions API integration.
 * Falls back to stub if GOOGLE_MAPS_API_KEY not set.
 *
 * Returns: distance, duration, traffic duration, elevation gain, incidents summary.
 * Elevation gain is used in battery range calculations.
 */
export function makeGetRouteTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Get route information between two locations: distance, estimated travel time with current traffic, road incidents, and elevation gain. Use for navigation queries and EV range/charge calculations. Accepts informal place names, city names, postcodes, road names, or full addresses — pass the destination exactly as the driver said it. Google Maps resolves the address internally. Do NOT pre-geocode or look up coordinates before calling this tool.",
    parameters: z.object({
      origin: z
        .string()
        .describe("Starting location. Preferred format when vehicle location is available: coordinate string '51.5014,-0.1419' (lat,lon from get_vehicle_state). Falls back to 'current' if location is null, or any address string."),
      destination: z
        .string()
        .describe("Destination exactly as the driver said it — informal names, city names, postcodes, or full addresses all work. Do not pre-resolve before calling."),
    }),
    execute: async ({ origin, destination }) => {
      console.log(
        `[tool:get_route] "${origin}" → "${destination}" session=${ctx.sessionId}`
      );

      const apiKey = process.env["GOOGLE_MAPS_API_KEY"];
      if (!apiKey) {
        console.warn("[tool:get_route] GOOGLE_MAPS_API_KEY not set — returning stub");
        return stubRoute(origin, destination);
      }

      try {
        const params = new URLSearchParams({
          origin,
          destination,
          departure_time: "now",
          traffic_model: "best_guess",
          key: apiKey,
        });

        const res = await fetch(`${MAPS_BASE}/directions/json?${params}`);
        const data = (await res.json()) as GMapsDirectionsResponse;

        if (data.status !== "OK" || !data.routes.length) {
          return {
            ok: false,
            source: "google_maps",
            error: `Directions API error: ${data.status}`,
          };
        }

        const leg = data.routes[0]!.legs[0]!;
        const distanceKm = Math.round((leg.distance.value / 1000) * 10) / 10;
        const durationMin = Math.round(leg.duration.value / 60);
        const durationWithTrafficMin = leg.duration_in_traffic
          ? Math.round(leg.duration_in_traffic.value / 60)
          : durationMin;

        // Estimate elevation gain via Elevation API (2 sample points)
        let elevationGainM = 0;
        try {
          const elevRes = await fetch(
            `${MAPS_BASE}/elevation/json?locations=${encodeURIComponent(origin)}|${encodeURIComponent(destination)}&key=${apiKey}`
          );
          const elevData = (await elevRes.json()) as GMapsElevationResponse;
          if (elevData.status === "OK" && elevData.results.length >= 2) {
            const gain =
              (elevData.results[1]?.elevation ?? 0) -
              (elevData.results[0]?.elevation ?? 0);
            elevationGainM = Math.round(Math.max(0, gain));
          }
        } catch {
          // Non-critical — elevation unavailable
        }

        return {
          ok: true,
          source: "google_maps",
          dataFreshAt: new Date().toISOString(),
          data: {
            distanceKm,
            durationMin,
            durationWithTrafficMin,
            trafficDelayMin: Math.max(0, durationWithTrafficMin - durationMin),
            trafficSummary:
              durationWithTrafficMin > durationMin
                ? `Traffic adds ${durationWithTrafficMin - durationMin} minutes.`
                : "Traffic is flowing normally.",
            elevationGainM,
            warnings: data.routes[0]?.warnings ?? [],
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tool:get_route] API error: ${msg}`);
        return { ok: false, source: "google_maps", error: msg };
      }
    },
  });
}

function stubRoute(origin: string, destination: string) {
  return {
    ok: true,
    source: "google_maps_stub",
    dataFreshAt: new Date().toISOString(),
    data: {
      distanceKm: 42,
      durationMin: 38,
      durationWithTrafficMin: 45,
      trafficDelayMin: 7,
      trafficSummary: "Moderate traffic. Journey adds about 7 minutes.",
      elevationGainM: 120,
      warnings: [],
    },
  };
}
