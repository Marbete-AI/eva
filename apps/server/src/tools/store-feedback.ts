import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";
import { storeMemory } from "../memory/store.js";
import { getSupabaseClient } from "../memory/supabase-client.js";

export function makeStoreFeedbackTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Store driver feedback about an EVA response or behaviour. Use when the driver gives a thumbs up, thumbs down, voice correction, or explicit preference statement.",
    parameters: z.object({
      feedbackType: z
        .enum(["thumbs_up", "thumbs_down", "voice_correction", "voice_positive"])
        .describe("Type of feedback"),
      content: z
        .string()
        .optional()
        .describe("Text of the correction or stated preference if voice feedback"),
      referenceMessageId: z
        .string()
        .optional()
        .describe("ID of the message being rated, if known"),
    }),
    execute: async ({ feedbackType, content, referenceMessageId }) => {
      console.log(
        `[tool:store_feedback] type=${feedbackType} driver=${ctx.driverId} content="${content ?? ""}"`
      );

      // Write to feedback table
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from("feedback").insert({
          session_id: ctx.sessionId,
          message_id: referenceMessageId ?? null,
          type: feedbackType,
          value: content ?? null,
        });
        if (error) {
          console.error("[tool:store_feedback] DB error:", error.message);
        }
      }

      // Also store corrections and positive preferences as memory chunks
      // so they surface in future sessions
      if (content && (feedbackType === "voice_correction" || feedbackType === "voice_positive")) {
        await storeMemory({
          userId: ctx.driverId,
          content:
            feedbackType === "voice_correction"
              ? `Driver preference/correction: ${content}`
              : `Driver positive feedback: ${content}`,
          source: "feedback",
          category: "preference_communication",
          weight: feedbackType === "voice_correction" ? 1.5 : 1.0,
        });
      }

      return {
        ok: true,
        source: "feedback_store",
        dataFreshAt: new Date().toISOString(),
        data: { stored: true, feedbackType },
      };
    },
  });
}
