import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";
import { getVehicleState } from "../smartcar/vehicle.js";

/**
 * Tool: get_vehicle_state
 * Returns current vehicle state from SmartCar.
 * Falls back to mock data if SmartCar not configured or token unavailable.
 */
export function makeGetVehicleStateTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Get the current state of the driver's vehicle: battery level, estimated range, speed, location availability, and drive mode. Always call this before answering range or charging questions.",
    parameters: z.object({}),
    execute: async () => {
      console.log(`[tool:get_vehicle_state] session=${ctx.sessionId} driver=${ctx.driverId}`);

      const data = await getVehicleState(ctx.driverId);

      return {
        ok: true,
        source: data.source,
        dataFreshAt: data.lastReadAt,
        data,
      };
    },
  });
}
