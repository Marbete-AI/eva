import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

/**
 * Tool: get_adas_signals
 * Returns the latest interpreted ADAS metrics (not raw signals — not scenario labels).
 * The signal_interpreter has already processed the raw VSS signals.
 * EVA-1: reads from the mock server's latest frame.
 * EVA-2: reads from OEM ADAS adapter.
 */
export function makeGetAdasSignalsTool(
  ctx: ToolCallContext,
  getLatestMetrics: () => import("@eva/types").InterpretedMetrics | null
) {
  return tool({
    description:
      "Get current driving dynamics metrics: braking intensity, fatigue signal, lateral stability, forward clearance, overtake detection, and gap fit margin. Use this when the driver asks about driving conditions, safety, or situational awareness.",
    parameters: z.object({}),
    execute: async () => {
      console.log(`[tool:get_adas_signals] session=${ctx.sessionId} request=${ctx.requestId}`);

      const metrics = getLatestMetrics();
      if (!metrics) {
        return {
          ok: false,
          source: "signal_interpreter",
          error: "No ADAS signal data available yet.",
        };
      }

      return {
        ok: true,
        source: "signal_interpreter",
        dataFreshAt: metrics.computedAt,
        data: metrics,
      };
    },
  });
}
