import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Swappable reasoning provider interface.
 * Default: Claude Sonnet via Anthropic.
 * Swap via REASONING_MODEL_PROVIDER env var.
 *
 * Uses direct @ai-sdk/anthropic (not Vercel SDK's provider abstraction)
 * so Anthropic-specific features (prompt caching, extended thinking) are available.
 *
 * Vercel AI SDK is used for streamText/generateText + tool-calling only.
 */

export interface ReasoningProviderConfig {
  provider: string;
  modelName: string;
  apiKey: string;
}

export function createReasoningModel(config: ReasoningProviderConfig): LanguageModel {
  const { provider, modelName, apiKey } = config;

  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelName);
    }
    case "openai": {
      throw new Error(
        `OpenAI reasoning provider is not yet implemented. ` +
          `Set REASONING_MODEL_PROVIDER=anthropic to use Claude.`
      );
    }
    default:
      throw new Error(
        `Unknown reasoning provider: "${provider}". Supported: anthropic`
      );
  }
}

export function getReasoningConfig(): ReasoningProviderConfig {
  const provider = process.env["REASONING_MODEL_PROVIDER"] ?? "anthropic";
  const modelName =
    process.env["REASONING_MODEL_NAME"] ?? "claude-sonnet-4-5";
  const apiKey = (() => {
    switch (provider) {
      case "anthropic":
        return process.env["ANTHROPIC_API_KEY"] ?? "";
      case "openai":
        return process.env["OPENAI_API_KEY"] ?? "";
      default:
        return "";
    }
  })();

  if (!apiKey) {
    throw new Error(
      `API key not set for reasoning provider "${provider}". ` +
        `Check your .env file.`
    );
  }

  return { provider, modelName, apiKey };
}
