import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

interface GMapsPlaceSearchResponse {
  status: string;
  candidates: Array<{
    name: string;
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    place_id: string;
    types: string[];
    rating?: number;
  }>;
}

/**
 * Tool: find_place
 *
 * Search for a place by name and return its address, coordinates, and type.
 * Uses Google Maps Find Place API — factual results, not generated.
 *
 * Use cases:
 *   - Disambiguating a destination: "Old Trafford" → find both the football
 *     ground and the cricket ground, return both so Claude can ask the driver
 *   - Finding a specific business or landmark by name
 *   - Locating a charging station, rest stop, or POI near a route
 *
 * When you have coordinates for a location bias, pass them to narrow results.
 * Falls back to stub if GOOGLE_MAPS_API_KEY not set.
 */
export function makeFindPlaceTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Search for a specific place, business, or landmark by name using Google Maps. " +
      "Returns address, coordinates, and place type. Use when a destination name is ambiguous " +
      "(multiple places with the same name) or when you need coordinates for a specific POI " +
      "like a charging station, stadium, or rest stop. " +
      "Do NOT use for general city/region routing — pass those directly to get_route.",
    parameters: z.object({
      query: z
        .string()
        .describe("Place name or search query — e.g. 'Old Trafford stadium Manchester', 'Tesco Extra Birmingham', 'EV charging M1 motorway'"),
      locationBiasLat: z
        .number()
        .optional()
        .describe("Latitude to bias results toward — use vehicle current location when available"),
      locationBiasLon: z
        .number()
        .optional()
        .describe("Longitude to bias results toward"),
      locationBiasRadiusM: z
        .number()
        .optional()
        .default(50000)
        .describe("Search radius in metres around the location bias. Default 50km."),
    }),
    execute: async ({ query, locationBiasLat, locationBiasLon, locationBiasRadiusM }) => {
      console.log(
        `[tool:find_place] query="${query}" session=${ctx.sessionId}`
      );

      const apiKey = process.env["GOOGLE_MAPS_API_KEY"];
      if (!apiKey) {
        console.warn("[tool:find_place] GOOGLE_MAPS_API_KEY not set — returning stub");
        return {
          ok: true,
          source: "find_place_stub",
          data: {
            candidates: [{
              name: query,
              formattedAddress: `${query}, UK`,
              lat: 51.5074,
              lon: -0.1278,
              types: ["establishment"],
            }],
          },
        };
      }

      try {
        const params = new URLSearchParams({
          input: query,
          inputtype: "textquery",
          fields: "name,formatted_address,geometry,place_id,types,rating",
          key: apiKey,
        });

        // Add location bias if coordinates provided
        if (locationBiasLat !== undefined && locationBiasLon !== undefined) {
          const radius = locationBiasRadiusM ?? 50000;
          params.set("locationbias", `circle:${radius}@${locationBiasLat},${locationBiasLon}`);
        }

        const res = await fetch(`${MAPS_BASE}/place/findplacefromtext/json?${params}`);
        const data = (await res.json()) as GMapsPlaceSearchResponse;

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          return {
            ok: false,
            source: "find_place",
            error: `Places API error: ${data.status}`,
          };
        }

        const candidates = (data.candidates ?? []).map(c => ({
          name: c.name,
          formattedAddress: c.formatted_address,
          lat: c.geometry.location.lat,
          lon: c.geometry.location.lng,
          placeId: c.place_id,
          types: c.types,
          rating: c.rating,
        }));

        console.log(
          `[tool:find_place] Found ${candidates.length} result(s) for "${query}"`
        );

        return {
          ok: true,
          source: "google_maps_places",
          dataFreshAt: new Date().toISOString(),
          data: { candidates },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tool:find_place] Error: ${msg}`);
        return { ok: false, source: "find_place", error: msg };
      }
    },
  });
}
