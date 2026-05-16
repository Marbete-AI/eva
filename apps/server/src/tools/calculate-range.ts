import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";
import { getVehicleState } from "../smartcar/vehicle.js";

/**
 * Tool: calculate_range
 *
 * Answers "will I make it to X on this charge?" by combining:
 *   - SmartCar battery (percent + reported range)
 *   - Route distance and elevation gain from get_route
 *   - Weather temperature (cold degrades EV range significantly)
 *   - A conservative efficiency model with margin
 *
 * Consumption model:
 *   Base: 0.20 kWh/km (typical mid-range EV at ~100kph)
 *   Elevation penalty: +0.005 kWh/km per 10m net gain
 *   Cold penalty: +8% per 10°C below 20°C (below 0°C = +24% at most)
 *   Headwind: not modelled (insufficient signal)
 *
 * The model deliberately errs on the side of caution — if it says yes,
 * the driver can trust it. If it says borderline, err towards charging.
 *
 * The orchestrator should call get_vehicle_state and get_route first,
 * then pass the results into this tool. get_weather is optional but
 * improves accuracy in cold conditions.
 */
export function makeCalculateRangeTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Calculate whether the vehicle has enough charge to reach a destination. Call this after get_vehicle_state and get_route to give the driver a concrete yes/no answer with estimated charge on arrival. Optionally pass current temperature for cold-weather adjustment.",
    parameters: z.object({
      batteryPercent: z
        .number()
        .min(0)
        .max(100)
        .describe("Current battery level as a percentage, from get_vehicle_state"),
      reportedRangeKm: z
        .number()
        .min(0)
        .describe("Range in km as reported by the vehicle, from get_vehicle_state"),
      routeDistanceKm: z
        .number()
        .min(0)
        .describe("Route distance in km, from get_route"),
      elevationGainM: z
        .number()
        .min(0)
        .default(0)
        .describe("Net elevation gain in metres, from get_route. Use 0 if unknown."),
      temperatureCelsius: z
        .number()
        .optional()
        .describe("Ambient temperature in Celsius from get_weather. Omit if unavailable."),
      includeReturnJourney: z
        .boolean()
        .default(false)
        .describe("If true, calculate whether there is enough charge for both the outward and return trip."),
    }),
    execute: async ({
      batteryPercent,
      reportedRangeKm,
      routeDistanceKm,
      elevationGainM,
      temperatureCelsius,
      includeReturnJourney,
    }) => {
      console.log(
        `[tool:calculate_range] battery=${batteryPercent}% range=${reportedRangeKm}km ` +
        `route=${routeDistanceKm}km elev=${elevationGainM}m temp=${temperatureCelsius ?? "unknown"}°C ` +
        `return=${includeReturnJourney} session=${ctx.sessionId}`
      );

      // ── Efficiency adjustments ─────────────────────────────────────────────

      // Base adjustment multiplier starts at 1.0 (no adjustment)
      let adjustmentMultiplier = 1.0;

      // Elevation penalty: net gain increases consumption
      // +5% per 100m gain on a typical route
      if (elevationGainM > 0) {
        adjustmentMultiplier += (elevationGainM / 100) * 0.05;
      }

      // Cold weather penalty: below 20°C, range degrades
      // Roughly 8% per 10°C below 20°C, capped at -24% at 0°C and below
      if (temperatureCelsius !== undefined && temperatureCelsius < 20) {
        const degreesBelow20 = Math.min(20, 20 - temperatureCelsius);
        adjustmentMultiplier += (degreesBelow20 / 10) * 0.08;
      }

      // Add a 10% safety buffer — we'd rather say "borderline" than strand a driver
      const SAFETY_BUFFER = 1.10;
      const effectiveMultiplier = adjustmentMultiplier * SAFETY_BUFFER;

      // ── Adjusted range ─────────────────────────────────────────────────────

      // Use the vehicle's own reported range as the base (it already knows its
      // battery chemistry, degradation, and consumption history) — then apply
      // our weather and elevation adjustments on top
      const adjustedRangeKm = Math.round(reportedRangeKm / effectiveMultiplier);

      // Distance needed: one way or return
      const distanceNeededKm = includeReturnJourney
        ? routeDistanceKm * 2
        : routeDistanceKm;

      // ── Result ─────────────────────────────────────────────────────────────

      const canMakeIt = adjustedRangeKm >= distanceNeededKm;
      const marginKm = Math.round(adjustedRangeKm - distanceNeededKm);

      // Estimated battery percent on arrival (linear approximation)
      const percentPerKm = batteryPercent / adjustedRangeKm;
      const percentUsed = Math.min(100, Math.round(distanceNeededKm * percentPerKm));
      const estimatedArrivalPercent = Math.max(0, batteryPercent - percentUsed);

      // Verdict
      let verdict: "yes" | "borderline" | "no";
      if (marginKm >= 20) {
        verdict = "yes";
      } else if (marginKm >= 0) {
        verdict = "borderline"; // Can make it, but tight
      } else {
        verdict = "no";
      }

      // Nearest charging suggestion threshold
      const suggestCharging = verdict !== "yes" || estimatedArrivalPercent < 15;

      const result = {
        ok: true,
        source: "range_calculator",
        dataFreshAt: new Date().toISOString(),
        data: {
          verdict,
          canMakeIt,
          adjustedRangeKm,
          distanceNeededKm,
          marginKm,
          estimatedArrivalPercent,
          suggestCharging,
          includeReturnJourney,
          assumptions: {
            adjustmentMultiplier: Math.round(effectiveMultiplier * 100) / 100,
            coldPenaltyApplied: temperatureCelsius !== undefined && temperatureCelsius < 20,
            elevationPenaltyApplied: elevationGainM > 0,
            safetyBufferPercent: 10,
          },
        },
      };

      console.log(
        `[tool:calculate_range] verdict=${verdict} adjustedRange=${adjustedRangeKm}km ` +
        `needed=${distanceNeededKm}km margin=${marginKm}km arrivalBattery=${estimatedArrivalPercent}%`
      );

      return result;
    },
  });
}

/**
 * Fetch vehicle state for range calculation without requiring the orchestrator
 * to call get_vehicle_state separately first. Used internally when the tool
 * is called without pre-fetched battery data.
 *
 * The orchestrator should prefer to call get_vehicle_state itself so the
 * result is visible in the reasoning trace, but this is available as a fallback.
 */
export async function fetchBatteryForRangeCalc(
  driverId: string
): Promise<{ batteryPercent: number | null; reportedRangeKm: number | null }> {
  const state = await getVehicleState(driverId);
  return {
    batteryPercent: state.batteryPercent,
    reportedRangeKm: state.rangeKm,
  };
}
