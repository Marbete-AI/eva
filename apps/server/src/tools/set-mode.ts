import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext, SessionMode } from "@eva/types";

export function makeSetModeTool(
  ctx: ToolCallContext,
  onModeChange: (mode: SessionMode) => void
) {
  return tool({
    description:
      "Change the current session mode. Use when the driver requests a mode change ('let's discuss this meeting', 'I'm tired', navigation started). Modes: driving, meeting, fatigue, navigation.",
    parameters: z.object({
      mode: z
        .enum(["driving", "meeting", "fatigue", "navigation"])
        .describe("The new session mode to switch to"),
      reason: z.string().describe("Brief reason for the mode change"),
    }),
    execute: async ({ mode, reason }) => {
      console.log(
        `[tool:set_mode] mode=${mode} reason="${reason}" session=${ctx.sessionId}`
      );
      onModeChange(mode as SessionMode);
      return {
        ok: true,
        source: "mode_manager",
        dataFreshAt: new Date().toISOString(),
        data: { mode, activated: true },
      };
    },
  });
}
