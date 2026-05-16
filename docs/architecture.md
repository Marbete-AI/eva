# EVA-1 Architecture

## Overview

EVA-1 is a phone app + cloud backend. The backend maintains a live driver context and runs a continuous reasoning loop over vehicle state, ADAS signals, driver state, and environment data. The driver's voice is one input signal among many — not the only trigger.

## Data flow

```
Vehicle / ADAS / driver / environment signals
        |
        v
Live DriverContext session (per driver, per session)
        |
        v
Deterministic signal_interpreter
(pure functions — no LLM — derives metrics from raw VSS signals)
        |
        v
Reasoning loop trigger
(voice | signal_threshold | vehicle_state_change | timer | mode_change | uta_feedback)
        |
        v
Main reasoning LLM (Claude Sonnet — sole reasoning model)
System prompt: XML-tagged sections (identity, persona, constraints, context, memory)
        |
        v (tool calls)
  get_vehicle_state   — SmartCar adapter (mock in EVA-1)
  get_adas_signals    — interpreted metrics from signal_interpreter
  get_weather         — OpenWeather
  get_route           — Google Maps
  retrieve_memory     — Supabase pgvector (hybrid retrieval)
  store_feedback      — Supabase (UTA feedback)
  dispatch_havmco     — STUB in EVA-1, OEM integration in EVA-2
  set_mode            — session mode manager
  initiate_call       — tel: URI (EVA-1), OEM comms (EVA-2)
  ask_gemini          — Gemini as tool (Week 3+)
        |
        v
Output router
  audio   — ElevenLabs TTS (Week 5+)
  visual  — phone screen card (EVA-1) / HUD (EVA-2)
  action  — HAVMCO dispatch, call, navigation
```

## Key architectural decisions

See `docs/decisions/` for full ADRs.

| Decision | Choice | ADR |
|---|---|---|
| Single reasoning model | Claude Sonnet (swappable via env var) | 0001 |
| ADAS signal schema | COVESA VSS | 0002 |
| Deterministic signal interpreter | Pure functions, no LLM | 0003 |
| Swappable reasoning provider | REASONING_MODEL_PROVIDER env var | 0004 |

## Component map

```
eva/
├── apps/
│   ├── mobile/              React Native + Expo. Thin client.
│   │                        Week 1: text I/O. Week 5+: voice.
│   └── server/              Node.js + Hono. Reasoning backend.
│       ├── agent/           Reasoning loop + orchestrator
│       ├── context/         Live DriverContext state manager
│       ├── interpreters/    Deterministic signal interpreter (pure functions)
│       ├── providers/       Swappable reasoning model providers
│       ├── tools/           All tool implementations
│       ├── personas/        System prompt builder (XML-tagged)
│       └── routes/          HTTP + WebSocket endpoints
├── packages/
│   ├── types/               Shared TypeScript contracts + Zod schemas
│   ├── adas-mock/           Mock ADAS signal server (VSS schema)
│   ├── tools-core/          Tool name constants
│   └── prompts/             Versioned prompt templates
└── infra/
    └── supabase/            DB schema + migrations
```

## EVA-2 integration points

Every EVA-2 OEM integration is a swap at a defined interface:

| EVA-1 | EVA-2 swap |
|---|---|
| `packages/adas-mock` WebSocket | OEM ADAS ECU stream adapter at same interface |
| `tools/get-vehicle-state.ts` SmartCar mock | OEM direct vehicle API |
| `tools/dispatch-havmco.ts` stub | OEM HAVMCO SDK call |
| `tools/initiate-call.ts` tel: URI | OEM comms system |
| Phone screen visual card | OEM HUD renderer |

The reasoning loop, orchestrator, signal interpreter, and memory layer are untouched in EVA-2.
