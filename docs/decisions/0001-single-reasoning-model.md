# ADR 0001 — Single Reasoning Model

**Status:** Accepted  
**Date:** 2026-05-14

## Context

The original EVA-1 build plan described a "provider router" that would route queries to Claude, Gemini, or OpenAI depending on query type. This implies multiple reasoning models, each owning a slice of the conversation.

## Decision

EVA uses one reasoning model. Claude Sonnet is the default. The reasoning model is swappable via `REASONING_MODEL_PROVIDER` env var, but only one model reasons at a time.

Gemini, OpenAI, and other models are **tools** the reasoning model calls — not co-reasoners. Claude decides when to call Gemini (e.g. for Google Maps grounding, calendar, contacts), receives the result, and reasons over it.

## Consequences

- One system prompt, one persona, one memory context, one output identity — EVA is coherent.
- Swapping the reasoning model is a one-line env var change plus a new provider adapter.
- Anthropic-specific features (prompt caching, extended thinking, XML prompting) are available without LCD abstraction.
- No multi-model alignment problem — we are not training or aligning multiple reasoners.
- If the reasoning model changes, EVA's behaviour may change — this is expected and deliberate.

## Rejected alternative

Provider router: Claude for reasoning, Gemini for nav/location queries, OpenAI for general. Rejected because it creates two reasoning identities, makes memory context split ambiguous, and requires aligning two models' outputs to sound like one persona.
