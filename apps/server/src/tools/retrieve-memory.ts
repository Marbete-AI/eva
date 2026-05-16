import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";
import { retrieveMemory } from "../memory/retrieve.js";

export function makeRetrieveMemoryTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Retrieve relevant memories and preferences for this driver based on a query. Use to personalise responses — routing preferences, music preferences, past feedback, and learned behaviours.",
    parameters: z.object({
      query: z.string().describe("What kind of memory or preference to look for"),
    }),
    execute: async ({ query }) => {
      console.log(`[tool:retrieve_memory] query="${query}" driver=${ctx.driverId}`);

      const chunks = await retrieveMemory({
        userId: ctx.driverId,
        query,
        limit: 5,
      });

      return {
        ok: true,
        source: "supabase_memory",
        dataFreshAt: new Date().toISOString(),
        data: {
          chunks: chunks.map((c) => ({ content: c.content, source: c.source })),
          count: chunks.length,
        },
      };
    },
  });
}
