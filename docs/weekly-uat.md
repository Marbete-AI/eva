# EVA — Weekly UAT Checklist

Run through the relevant week's checklist after each build session.
Each section shows what to test, what prompts to use, and what the expected outcome is.
Session count notes assume a fresh Supabase project with no prior data.

---

## Weeks 1-2 — Foundation (current build)

### Boot check
Start everything per `startup-guide.md`. Confirm:
- Blue "Live" dot in top right of app
- Backend terminal shows UUID + session created
- No `AsyncStorage error` in Metro

### Test 1 — Basic round trip
**Prompt:** `Hello`
**Expected:** Short greeting, plain English, no Markdown, 1-2 sentences. No filler ("Sure!", "Of course!").

### Test 2 — Identity extraction (Session 1)
**Prompt:** `My name is Jas`
**Expected:**
- EVA responds naturally acknowledging the name
- Supabase `memory_candidates`: row with `category=identity`, `content` contains "Jas", `status=confirmed`
- Supabase `memory_chunks`: same content promoted (auto-promote, confidence >= 0.9)

### Test 3 — Vehicle identity (Session 1)
**Prompt:** `I drive a Golf`
**Expected:** Same as Test 2 — identity extracted, auto-promoted.

### Test 4 — Temporal statement (not a persistent preference)
**Prompt:** `I will be travelling soon and can't be bothered to change gears`
**Expected:**
- EVA responds acknowledging the trip context
- Supabase `memory_candidates`: row with `category=emotional_state` (NOT `preference_routing`), confidence 0.5-0.65
- `suggest_confirmation=true`
- EVA may ask ONE clean question at the end: "Should I factor that in when suggesting routes today?"
- EVA does NOT ask two questions in one sentence

### Test 5 — Habitual preference (persistent)
**Prompt:** `I always avoid motorways`
**Expected:**
- Supabase `memory_candidates`: `category=preference_routing`, confidence >= 0.85, `status=confirmed`
- Supabase `memory_chunks`: promoted immediately
- No confirmation question asked (high confidence auto-promote)

### Test 6 — Persistent UUID (cross-session)
- Note the UUID from the backend terminal on first launch
- Kill the app completely (swipe off on simulator)
- Reopen the app
- **Expected:** same UUID in backend terminal on reconnect. No new `users` row in Supabase.

### Test 7 — Weather query
**Prompt:** `What's the weather like?`
**Expected:** EVA calls weather tool, returns a 1-2 sentence weather summary. No tool errors in backend terminal.
*Requires `OPENWEATHER_API_KEY` set. Without key: stub response returned, still works.*

### Test 8 — Route query
**Prompt:** `How long will it take to get to Manchester?`
**Expected:** EVA calls route tool, gives time estimate with traffic. Natural English, no Markdown.
*Requires `GOOGLE_MAPS_API_KEY`. Without key: stub response.*

### Test 9 — ADAS proactive trigger (requires ADAS mock running)
Start: `pnpm --filter @eva/adas-mock start -- --scenario late_braking`
**Expected within ~10 seconds:**
- Green-bordered message appears in app with "EVA — proactive" label
- Message is 1 sentence: something about braking hard, calm check-in
- No numeric values in message (no "0.82", no "threshold", no "m/s²")

### Test 10 — Memory persists across sessions (after 2+ sessions)
Start a new session after Test 2-5 have run.
**Prompt:** `What do you know about me?`
**Expected:** EVA references name and vehicle from previous session. Does not hallucinate facts not given.

---

## Weeks 3-4 — Voice + SmartCar (coming)

### Test V1 — Push to talk (after voice is added)
Hold PTT button, say "What's my battery at?"
**Expected:** EVA responds via ElevenLabs TTS voice within 3 seconds. No text needed.

### Test V2 — ASR accuracy
Say: "Will I make it to Leeds on this charge?"
**Expected:** Transcript appears correctly in backend terminal. EVA calls vehicle state + route + weather tools. Spoken response cites range and distance clearly.

### Test V3 — SmartCar real data
Connect vehicle via SmartCar OAuth in onboarding.
**Expected:** Vehicle state tool returns real battery %, range, speed. Not mock data.

### Test V4 — Voice memory extraction
Say: "I hate the M6, always use the A roads"
**Expected:** Memory candidate extracted with `category=preference_routing`, content captures implication ("Driver avoids the M6, prefers A roads"), high confidence, auto-promoted.

### Test V5 — Fatigue trigger + phone a friend
After `fatigue_proxy` scenario runs long enough:
**Expected:** EVA proactively suggests a break. If driver says "I'm really tired", EVA offers to call someone. `initiate_call` tool fires, tel: URI sent to app.

---

## Weeks 5-6 — Features (coming)

### Test F1 — "Will I make it on this charge?"
**Prompt:** `Will I make it to Edinburgh on this charge?`
**Expected:** EVA uses vehicle state (battery, range) + route (distance, elevation) + weather (cold = higher consumption). Gives clear yes/no with margin, not just distance.

### Test F2 — Traffic query
**Prompt:** `Is there much traffic on the M6 right now?`
**Expected:** EVA calls route/maps tool, summarises traffic conditions in 1-2 sentences. Mentions any incidents.

### Test F3 — Feedback loop
Send a message. Immediately after EVA responds:
**Prompt:** `Wrong, I don't like that`
**Expected:**
- `store_feedback` tool called with `feedbackType=voice_correction`
- Memory candidate created with the correction
- EVA acknowledges naturally: "Got it, I'll do it differently" — one sentence

### Test F4 — Meeting mode
**Prompt:** `Let's discuss my meeting`
**Expected:** EVA calls `set_mode` with `meeting`, switches to conversational tone, asks what the meeting is about. ADAS alerts suppressed (only emergency-level fires).

---

## Weeks 7-8 — Polish + demo (coming)

### Test D1 — Full demo sequence (90 second version)
1. Say: "Will I make it to Leeds on this charge?" → EVA answers with real data
2. Say: "Any road closures on the way?" → EVA checks traffic
3. Give thumbs down on a response → EVA acknowledges, stores feedback
4. Trigger fatigue scenario → EVA proactively suggests rest stop
**Expected:** All four work end-to-end with voice in, voice out, no crashes.

### Test D2 — Memory after 10 sessions
After 10+ sessions, start a new session.
**Prompt:** `What are my usual preferences?`
**Expected:** EVA summarises confirmed Tier 2 memory naturally. Mentions routing preferences, communication style, and any behavioural patterns that have been promoted.

### Test D3 — Pattern detection (after 5+ sessions)
After using the app across multiple sessions with consistent routing preferences:
Check Supabase `behavioural_patterns` table.
**Expected:** At least one pattern row with `confidence >= 0.7`. If >= 0.8, a corresponding row in `memory_chunks`.

---

## Supabase tables to check after each session

| Table | What to look for |
|---|---|
| `users` | One row per device. UUID consistent across sessions. |
| `sessions` | One row per app open. `ended_at` populated on close. |
| `messages` | User + assistant turns logged. No FK errors. |
| `memory_candidates` | Extracted observations. Categories correct. Statuses progressing. |
| `memory_chunks` | Auto-promoted facts. High confidence items appear here quickly. |
| `memory_confirmations` | Confirmation questions EVA asked. Outcomes recorded. |
| `feedback` | Thumbs up/down and voice corrections logged. |
| `behavioural_patterns` | Populated after multiple sessions. Confidence grows over time. |

---

## Red flags — things that mean something is wrong

| Symptom | Likely cause |
|---|---|
| Blue dot never appears | Backend not running or wrong `API_URL` in `eva-mobile/.env` |
| Different UUID every session | AsyncStorage not working — rebuild the app (`npx react-native run-ios`) |
| No rows in `memory_candidates` | Extractor failing silently — check backend terminal for `[extractor]` errors |
| Messages FK error in terminal | Session row not committed before message write — retry logic should handle it |
| EVA responds with Markdown / bullet points | Response format prompt not applying — check `STATIC_RESPONSE_FORMAT` in `personas/base.ts` |
| EVA asks two questions in one response | Compound question rule not enforced — check same file |
| Proactive alerts contain numbers like "0.82" | Threshold trigger messages still exposing numeric values — check `loop.ts` |
| ADAS mock says connected but no proactive messages | Threshold cooldowns — wait 8+ seconds between triggers, or use `--no-loop` and restart |
| `memory_chunks` empty after identity statement | Embedding may be failing — check `OPENAI_API_KEY` is set |
