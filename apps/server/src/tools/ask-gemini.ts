import { z } from "zod";
import { tool, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ToolCallContext } from "@eva/types";

/**
 * Tool: ask_gemini
 *
 * Gemini is called as a scoped tool — not a co-reasoner.
 * Claude decides what context Gemini sees and what to ask it.
 * Gemini returns a structured result. Claude reasons over it.
 *
 * Primary use cases:
 *   - Real-time Maps grounding (POI search, place details)
 *   - Google account data context (calendar, contacts) — Week 3 when OAuth wired
 *   - Grounded factual lookups where Gemini's real-time knowledge helps
 *
 * Claude controls the scope. Gemini never sees the full driver context
 * or system prompt — only what Claude explicitly passes.
 */
export function makeAskGeminiTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Ask Gemini a scoped question — use for real-time Maps grounding, location search, place details, or factual lookups that benefit from Gemini's real-time knowledge. Pass only the specific context needed. Do NOT pass the full driver context or system prompt.",
    parameters: z.object({
      prompt: z
        .string()
        .describe("The specific, scoped question to ask Gemini. Be precise."),
      context: z
        .string()
        .optional()
        .describe(
          "Optional background context for Gemini — e.g. 'Driver is in Manchester, UK' or 'Looking for EV charging'. Keep it minimal."
        ),
    }),
    execute: async ({ prompt, context }) => {
      console.log(
        `[tool:ask_gemini] prompt="${prompt.slice(0, 80)}..." session=${ctx.sessionId}`
      );

      const apiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
      if (!apiKey) {
        console.warn("[tool:ask_gemini] GOOGLE_GENERATIVE_AI_API_KEY not set — returning stub");
        return {
          ok: true,
          source: "gemini_stub",
          data: {
            response:
              "Gemini is not yet configured. Set GOOGLE_GENERATIVE_AI_API_KEY to enable real-time grounding.",
          },
        };
      }

      try {
        const google = createGoogleGenerativeAI({ apiKey });

        const systemPrompt = context
          ? `You are a helpful assistant providing concise, factual information. Context: ${context}`
          : "You are a helpful assistant providing concise, factual information.";

        const result = await generateText({
          model: google("gemini-2.5-flash"),
          system: systemPrompt,
          prompt,
          maxTokens: 512,
        });

        return {
          ok: true,
          source: "gemini",
          dataFreshAt: new Date().toISOString(),
          data: { response: result.text },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tool:ask_gemini] Error: ${msg}`);
        return { ok: false, source: "gemini", error: msg };
      }
    },
  });
}
