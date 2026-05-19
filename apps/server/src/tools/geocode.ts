import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

interface GMapsGeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    place_id: string;
  }>;
}

/**
 * Tool: geocode
 *
 * Two modes:
 *
 *   Forward geocode: place name / address → coordinates + formatted address.
 *   Use to resolve a destination to precise coordinates before calling get_route.
 *   ONLY call this when disambiguation genuinely requires it (e.g. "Old Trafford"
 *   could be two different places). Do not call for clear destinations like
 *   "Birmingham" or "Manchester" — get_route handles those directly.
 *
 *   Reverse geocode: coordinates → human-readable address.
 *   Use when the vehicle has a GPS location and the driver asks where they are.
 *
 * Uses Google Maps Geocoding API — factual, not generated.
 * Falls back to stub if GOOGLE_MAPS_API_KEY not set.
 */
export function makeGeocodeTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Convert between place names/addresses and coordinates using Google Maps. " +
      "Forward geocode: resolve an ambiguous place name to a precise address and coordinates. " +
      "Reverse geocode: find the address at a given latitude/longitude. " +
      "Only use forward geocoding when the destination is genuinely ambiguous (multiple possible locations with the same name). " +
      "Do NOT use for clear city/town names — pass those directly to get_route.",
    parameters: z.object({
      mode: z
        .enum(["forward", "reverse"])
        .describe("forward = place name to coordinates. reverse = coordinates to address."),
      address: z
        .string()
        .optional()
        .describe("Place name or address for forward geocoding. Required when mode=forward."),
      lat: z
        .number()
        .optional()
        .describe("Latitude for reverse geocoding. Required when mode=reverse."),
      lon: z
        .number()
        .optional()
        .describe("Longitude for reverse geocoding. Required when mode=reverse."),
      context: z
        .string()
        .optional()
        .describe("Optional location context to improve forward geocoding accuracy — e.g. 'Manchester, UK'."),
    }),
    execute: async ({ mode, address, lat, lon, context }) => {
      console.log(
        `[tool:geocode] mode=${mode} ${mode === "forward" ? `address="${address}"` : `coords=${lat},${lon}`} session=${ctx.sessionId}`
      );

      const apiKey = process.env["GOOGLE_MAPS_API_KEY"];
      if (!apiKey) {
        console.warn("[tool:geocode] GOOGLE_MAPS_API_KEY not set — returning stub");
        return {
          ok: true,
          source: "geocode_stub",
          data: mode === "forward"
            ? { formattedAddress: address ?? "Unknown", lat: 51.5074, lon: -0.1278 }
            : { formattedAddress: "London, UK", locality: "London", country: "UK" },
        };
      }

      try {
        let url: string;

        if (mode === "forward") {
          if (!address) {
            return { ok: false, source: "geocode", error: "address required for forward geocoding" };
          }
          const query = context ? `${address}, ${context}` : address;
          url = `${MAPS_BASE}/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
        } else {
          if (lat === undefined || lon === undefined) {
            return { ok: false, source: "geocode", error: "lat and lon required for reverse geocoding" };
          }
          url = `${MAPS_BASE}/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
        }

        const res = await fetch(url);
        const data = (await res.json()) as GMapsGeocodeResponse;

        if (data.status !== "OK" || !data.results.length) {
          return {
            ok: false,
            source: "geocode",
            error: `Geocoding failed: ${data.status}`,
          };
        }

        const result = data.results[0]!;
        const locality = result.address_components.find(c => c.types.includes("locality"))?.long_name;
        const country = result.address_components.find(c => c.types.includes("country"))?.long_name;
        const postcode = result.address_components.find(c => c.types.includes("postal_code"))?.long_name;

        return {
          ok: true,
          source: "google_maps_geocoding",
          dataFreshAt: new Date().toISOString(),
          data: {
            formattedAddress: result.formatted_address,
            lat: result.geometry.location.lat,
            lon: result.geometry.location.lng,
            placeId: result.place_id,
            locality,
            country,
            postcode,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tool:geocode] Error: ${msg}`);
        return { ok: false, source: "geocode", error: msg };
      }
    },
  });
}
