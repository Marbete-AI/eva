# EVA — In-Cabin AI Co-pilot

Multi-model orchestration over vehicle, driver, and environment state. EVA-1 is the proof-of-architecture build.

## What this is

A phone app + cloud backend. The backend maintains a live driver context (vehicle state, ADAS signals, driver state, environment) and runs a continuous reasoning loop over it using Claude Sonnet as the sole reasoning model. Gemini, Maps, weather, SmartCar, and HAVMCO are tools the reasoning model calls — not co-reasoners.

## Repo structure

```
eva/
├── apps/
│   ├── mobile/          # React Native + Expo (thin client)
│   └── server/          # Node.js + Hono (reasoning backend)
├── packages/
│   ├── types/           # Shared TypeScript contracts + Zod schemas
│   ├── adas-mock/       # Mock ADAS signal server (VSS schema, raw signals)
│   ├── tools-core/      # Shared tool definitions
│   └── prompts/         # Versioned prompt templates
├── infra/
│   └── supabase/        # DB schema + migrations
└── docs/                # Architecture doc + ADRs
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- API keys (see `.env.example` in each app)

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp apps/server/.env.example apps/server/.env
cp apps/mobile/.env.example apps/mobile/.env
# Fill in your API keys
```

### 3. Start the ADAS mock server

```bash
pnpm --filter @eva/adas-mock start -- --scenario late_braking
```

Streams raw VSS signals over WebSocket on `ws://localhost:3001`.

### 4. Start the backend

```bash
pnpm --filter @eva/server dev
```

Server runs on `http://localhost:8787`.

Verify: `curl http://localhost:8787/health`

### 5. Test the chat endpoint

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

### 6. Start the mobile app

```bash
pnpm --filter @eva/mobile start
```

Then scan the QR code with Expo Go on your phone, or press `i` for iOS simulator.

## Running tests

```bash
pnpm test
```

## Type checking

```bash
pnpm typecheck
```

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Decisions

See [docs/decisions/](docs/decisions/) for Architecture Decision Records.

## Week 1 milestone

- `pnpm install` succeeds
- ADAS mock server streams raw VSS signals
- `/chat` returns Claude response end-to-end
- Signal interpreter unit tests pass
- TypeScript compiles clean across workspace
