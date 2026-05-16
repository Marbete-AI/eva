import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

/**
 * Tool: dispatch_havmco
 * STUB — interface only in EVA-1. No real dispatch.
 *
 * HAVMCO = Haptic, Audio, Visual, Mechanical, Climate, Olfed
 * OEM integration required for real dispatch (EVA-2).
 *
 * All dispatch attempts are logged to console and will write to
 * havmco_dispatches table in Supabase (EVA-2 training data).
 */
export function makeDispatchHavmcoTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Dispatch a HAVMCO (Haptic/Audio/Visual/Mechanical/Climate/Olfed) response to the vehicle systems. Use to provide physical feedback to the driver — e.g. haptic pulse on harsh braking, seat vibration for fatigue. EVA-1: logs the dispatch only.",
    parameters: z.object({
      type: z
        .enum(["haptic", "audio", "visual", "mechanical", "climate", "olfed"])
        .describe("Which HAVMCO channel to activate"),
      intensity: z
        .number()
        .min(0)
        .max(1)
        .describe("Intensity of the response, 0.0 to 1.0"),
      durationMs: z
        .number()
        .positive()
        .describe("Duration of the response in milliseconds"),
      reason: z
        .string()
        .describe("Why this dispatch was triggered — for logging and training data"),
    }),
    execute: async ({ type, intensity, durationMs, reason }) => {
      // Log for EVA-2 training data — every dispatch attempt recorded
      console.log(
        `[tool:dispatch_havmco] STUB type=${type} intensity=${intensity} duration=${durationMs}ms reason="${reason}" session=${ctx.sessionId}`
      );

      // EVA-1: stub only — OEM integration in EVA-2
      return {
        ok: true,
        source: "havmco_stub",
        dataFreshAt: new Date().toISOString(),
        data: {
          dispatched: false,
          note: "HAVMCO dispatch is a stub in EVA-1. OEM integration required for real dispatch.",
          logged: true,
          type,
          intensity,
          durationMs,
        },
      };
    },
  });
}
