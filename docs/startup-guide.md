# EVA — Startup Guide

Simple reference. How to start everything, and how to confirm it booted correctly.

---

## Directory layout

```
/Users/jassingh/
├── eva/           ← backend monorepo (server, packages, infra)
└── eva-mobile/    ← React Native iOS app
```

---

## What you need running

You need three things running to use EVA:

| What | Where | Required? |
|---|---|---|
| Backend server | `eva/` | Yes — always |
| ADAS mock server | `eva/` | Optional — needed for proactive driving alerts |
| Metro bundler | `eva-mobile/` | Yes — needed to run the app |

---

## Step 1 — Start the backend

Open a terminal:

```bash
cd "/Users/jassingh/Marbete AI/eva"
pnpm --filter @eva/server dev
```

Expected output:
```
[eva-server] Ready at http://localhost:8787
[eva-server] Health:   GET  http://localhost:8787/health
[eva-server] Chat:     POST http://localhost:8787/chat
[eva-server] Session:  WS   ws://localhost:8787/session
```

Leave this terminal open.

---

## Step 2 — Start the ADAS mock (optional)

Open a second terminal:

```bash
cd "/Users/jassingh/Marbete AI/eva"
pnpm --filter @eva/adas-mock start -- --scenario late_braking
```

To run without looping (fires once, stops):
```bash
pnpm --filter @eva/adas-mock start -- --scenario late_braking --no-loop
```

Available scenarios: `late_braking` `overtake` `fatigue_proxy` `gap_estimation`

Leave this terminal open if you want proactive ADAS triggers.

---

## Step 3 — Start Metro and the app

Open a third terminal:

```bash
cd /Users/jassingh/eva-mobile
npx react-native run-ios
```

This builds the native app and opens it in the iOS Simulator. Metro starts automatically.

To run on a specific simulator:
```bash
npx react-native run-ios --simulator "iPhone 17 Pro"
```

To run Metro separately (if app is already installed):
```bash
npx react-native start
```

---

## Checking boot is good

### Backend is healthy

```bash
curl http://localhost:8787/health
```

Expected:
```json
{"status":"ok","service":"eva-server","version":"0.0.1","reasoning":{"provider":"anthropic","model":"claude-sonnet-4-5"}}
```

### App connected

Look at the backend terminal after the app launches. You should see:

```
[memory:user] User ready: xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx
[memory:session] Session created: yyyyyyyy-...
[session:yyyy...] Started for driver xxxx...
```

The driver UUID should be the same every time you open the app on the same device.

In the app: the status badge in the top right shows a **blue dot and "Live"**.

### ADAS mock connected (if running)

Backend terminal:
```
[session:yyyy...] Connected to ADAS mock at ws://localhost:3001
```

App: proactive EVA messages appear automatically (green left border, "EVA — proactive" label).

---

## Environment variables

If the server won't start or Claude isn't responding, check `eva/apps/server/.env` has:

```
ANTHROPIC_API_KEY=sk-ant-...        ← required for Claude to respond
REASONING_MODEL_PROVIDER=anthropic
REASONING_MODEL_NAME=claude-sonnet-4-5
SUPABASE_URL=https://...            ← required for memory to persist
SUPABASE_SERVICE_ROLE_KEY=...       ← required for memory to persist
OPENAI_API_KEY=sk-...               ← required for memory embeddings
```

Optional (stubs work without these):
```
GOOGLE_MAPS_API_KEY=...
OPENWEATHER_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
ELEVENLABS_API_KEY=...
```

---

## Supabase — migrations to apply

| Migration | Status | Apply when |
|---|---|---|
| `001_initial_schema.sql` | Apply once on project create | Done |
| `002_memory_search.sql` | Apply after 001 | Done |
| `003_memory_candidates_and_event_log.sql` | Apply after 002 | Done |

To apply: Supabase dashboard → SQL editor → paste file contents → Run.

---

## Quick smoke test (30 seconds)

1. Backend running, app open, blue "Live" dot showing
2. Type: `My name is Jas`
3. EVA responds with a greeting — no Markdown, no bullet points, 1-2 sentences
4. Check Supabase `memory_candidates` table — a row should appear with `category = identity`
5. Check `memory_chunks` — same content should appear (auto-promoted, high confidence)

If all five pass, EVA is fully operational.

---

## Stopping everything

- Backend: `Ctrl+C` in the terminal
- ADAS mock: `Ctrl+C` in the terminal
- Metro: `Ctrl+C` in the terminal
- App: close the simulator or swipe up to close on device

Nothing needs to be "saved" — all state is in Supabase and AsyncStorage on the device.
