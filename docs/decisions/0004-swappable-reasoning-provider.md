# ADR 0004 — Swappable Reasoning Provider

**Status:** Accepted  
**Date:** 2026-05-14

## Context

Claude Sonnet is the default reasoning model for EVA-1. However, the LLM landscape changes rapidly. In 6 months the best reasoning model for in-cabin AI may be a different provider, a fine-tuned model, or an on-device model.

## Decision

The reasoning model is injected via a `ReasoningProvider` interface. The active provider is selected by `REASONING_MODEL_PROVIDER` env var (default: `anthropic`). The model name is `REASONING_MODEL_NAME`.

The provider interface wraps direct provider SDKs (not Vercel AI SDK's provider abstraction) so Anthropic-specific features (prompt caching, extended thinking, citations) remain accessible without being hidden by a lowest-common-denominator layer.

Vercel AI SDK is used for the streaming loop and tool-calling protocol only.

## Consequences

- Switching reasoning models is a one-line env var change.
- Adding a new provider requires one new file in `apps/server/src/providers/reasoning/`.
- Anthropic prompt caching is enabled from the first call — reduces cost ~90% and latency ~2x on repeat session turns.
- The Vercel AI SDK's `LanguageModel` type is used as the return type of `createReasoningModel()` for compatibility with `generateText`/`streamText`.

## Rejected alternative

Vercel AI SDK provider abstraction for everything. Rejected because it hides Anthropic-specific features (prompt caching, extended thinking) that are material to EVA's performance and cost.
