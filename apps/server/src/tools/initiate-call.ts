import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

export function makeInitiateCallTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Initiate an outbound phone call to a contact. Use when the driver asks to call someone, or when the fatigue trigger suggests calling a friend. Returns a tel: URI the phone app will handle.",
    parameters: z.object({
      contactName: z.string().describe("Name of the person to call"),
      phoneNumber: z
        .string()
        .optional()
        .describe("Phone number if known — otherwise EVA will look up from contacts"),
      reason: z
        .enum(["driver_request", "fatigue_trigger"])
        .describe("Why the call is being initiated"),
    }),
    execute: async ({ contactName, phoneNumber, reason }) => {
      console.log(
        `[tool:initiate_call] contact="${contactName}" reason=${reason} session=${ctx.sessionId}`
      );

      // EVA-1: return tel: URI — phone app handles native dialler
      const number = phoneNumber ?? "unknown";
      return {
        ok: true,
        source: "tel_uri",
        dataFreshAt: new Date().toISOString(),
        data: {
          telUri: phoneNumber ? `tel:${phoneNumber}` : null,
          contactName,
          reason,
          note: phoneNumber
            ? "Phone app should open native dialler with this tel: URI."
            : "Phone number unknown — contacts lookup not yet integrated (Week 7).",
        },
      };
    },
  });
}
