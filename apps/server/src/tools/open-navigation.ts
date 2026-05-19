import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

/**
 * Tool: open_navigation
 *
 * Sends a navigation destination to the driver's phone.
 * EVA-1: emits an `open_navigation` WS message — the mobile app opens
 *        Google Maps (or Apple Maps) via a deep link URL.
 * EVA-2: swaps to dispatch_havmco with navigation channel — sends
 *        directly to the vehicle's built-in sat-nav via HAVMCO.
 *
 * Use cases:
 *   - Driver asks to navigate somewhere
 *   - EVA finds a charging stop and offers to send it
 *   - EVA finds a rest stop during fatigue assist
 *   - EVA suggests a route change due to traffic
 *
 * The tool emits a structured result. The session manager intercepts
 * it and sends the open_navigation WS message to the mobile client.
 */

// Maps deep link builders
function buildGoogleMapsUrl(destination: string, lat?: number, lon?: number): string {
  if (lat !== undefined && lon !== undefined) {
    // Precise coordinate — Google Maps opens directly
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  }
  // Text query — Google Maps resolves it
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function buildAppleMapsUrl(destination: string, lat?: number, lon?: number): string {
  if (lat !== undefined && lon !== undefined) {
    return `maps://?daddr=${lat},${lon}`;
  }
  return `maps://?daddr=${encodeURIComponent(destination)}`;
}

export interface NavigationPayload {
  destination: string;
  label: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
  lat?: number;
  lon?: number;
  reason: string;
}

export function makeOpenNavigationTool(
  ctx: ToolCallContext,
  onNavigation: (payload: NavigationPayload) => void
) {
  return tool({
    description:
      "Send a navigation destination to the driver's phone. Use when the driver asks to go somewhere, or when EVA has found a charging stop, rest stop, or alternate route. The phone will open Google Maps or Apple Maps with the destination pre-set. Always confirm with the driver before opening navigation unless they explicitly asked for it.",
    parameters: z.object({
      destination: z
        .string()
        .describe("Destination address, place name, or description — e.g. 'Watford Gap Services, M1'"),
      label: z
        .string()
        .describe("Short human-readable label shown to the driver — e.g. 'Watford Gap Services'"),
      lat: z
        .number()
        .optional()
        .describe("Latitude of destination if known — produces more precise routing"),
      lon: z
        .number()
        .optional()
        .describe("Longitude of destination if known — produces more precise routing"),
      reason: z
        .enum(["driver_request", "charging_stop", "rest_stop", "traffic_diversion", "point_of_interest"])
        .describe("Why EVA is opening navigation"),
    }),
    execute: async ({ destination, label, lat, lon, reason }) => {
      console.log(
        `[tool:open_navigation] "${label}" reason=${reason} session=${ctx.sessionId}`
      );

      const googleMapsUrl = buildGoogleMapsUrl(destination, lat, lon);
      const appleMapsUrl = buildAppleMapsUrl(destination, lat, lon);

      const payload: NavigationPayload = {
        destination,
        label,
        googleMapsUrl,
        appleMapsUrl,
        ...(lat !== undefined ? { lat } : {}),
        ...(lon !== undefined ? { lon } : {}),
        reason,
      };

      // Notify the session manager — it will push the WS message to the app
      onNavigation(payload);

      return {
        ok: true,
        source: "open_navigation",
        dataFreshAt: new Date().toISOString(),
        data: {
          label,
          destination,
          googleMapsUrl,
          reason,
          note: "Navigation sent to phone. Google Maps or Apple Maps will open on the device.",
        },
      };
    },
  });
}
