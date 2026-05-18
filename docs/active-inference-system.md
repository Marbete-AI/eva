# Active Inference System

> Working document. The Active Inference System (AIS) is the underlying engine that turns EVA from a reactive tool-calling assistant into a continuously learning, always-on co-pilot that understands the driver as a person.

---

## What the AIS is

The Active Inference System is **not** a single feature. It is the engine that drives every "smart" thing EVA does. It sits underneath the reasoning loop and continuously observes signals, infers patterns, and feeds those inferences back into the system prompt so the main LLM has context it could not otherwise reach.

The user-facing features (will I make it on this charge, road closures, phone a friend, mode switching) are **applications of the AIS, not standalone systems**. Each feature is a thin layer on top of the inference engine.

---

## Why it matters

Without the AIS:
- EVA reacts to direct requests only
- "Are there road closures" gets a generic Maps API answer
- Fatigue suggestion requires the driver to mention being tired
- Routing preferences must be explicitly stated and stored
- Persona never adapts to how the driver is feeling

With the AIS:
- EVA observes silently and proactively offers help when patterns match
- "Are there road closures" gets routed through Gemini with driver state and routing preferences baked in
- EVA notices fatigue from voice patterns + time of day + driving behaviour, then suggests calling a known contact who maps to that pattern
- Routing preferences are learned from rejection patterns, not just explicit statements
- Persona shifts based on inferred driver state, mid-conversation, without losing context

---

## Architectural shape

```
┌─────────────────────────────────────────────────────────────────┐
│                  INPUT SILOS (continuously updated)              │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│   │ ADAS     │  │ Driver   │  │ Memory   │  │ Environment  │    │
│   │ signals  │  │ input    │  │ tier     │  │ (time, wx,   │    │
│   │ (steer,  │  │ (voice,  │  │ (prefs,  │  │  calendar,   │    │
│   │  brake,  │  │  text,   │  │  past    │  │  location)   │    │
│   │  yaw)    │  │  tone)   │  │  states) │  │              │    │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
└────────┼─────────────┼─────────────┼────────────────┼───────────┘
         │             │             │                │
         ▼             ▼             ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  INFERENCE ENGINE                                │
│                                                                  │
│   Joint inference paths read from multiple silos and produce:    │
│                                                                  │
│   • Driver State    (calm / focused / stressed / fatigued / …)  │
│   • Preferences     (routing, audio, communication style, …)    │
│   • Behavioural     (typical patterns: 6pm tired calls X, …)    │
│   • Mode signal     (which mode best fits this moment)          │
│   • Persona signal  (which communication style fits this state) │
│                                                                  │
│   Output is written back as a 5th silo: INFERENCES                │
│   The inference silo is itself a signal source — patterns of    │
│   inference over time are reviewed too.                          │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              SYSTEM PROMPT ASSEMBLY                              │
│                                                                  │
│   Persona block + driver state block + mode block +              │
│   memory recall + recent inferences are injected into            │
│   the system prompt on every turn.                               │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  REASONING LOOP (main LLM)                       │
│                                                                  │
│   Receives enriched prompt → calls tools → returns response      │
│   Response is observed by the inference engine — patterns of     │
│   what EVA chose to say are themselves a signal.                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## The 5 silos

The AIS observes 5 independent streams of information. Each is a "silo" because they are written to and read from independently. Joint inference paths span multiple silos.

### Silo 1 — ADAS signals
Source: vehicle CAN, mock ADAS server, OEM adapter (EVA-2). Examples: steering variance, braking intensity, yaw rate, lateral acceleration, forward clearance.

### Silo 2 — Driver input
Source: voice (transcript + acoustic features), text input, button taps. Examples: utterance content, speech rate, pause patterns, hedge words, frustration markers.

### Silo 3 — Memory tier
Source: Supabase pgvector + extractor + promotion engine (existing memory system). Examples: confirmed preferences, behavioural patterns across sessions, route history, contact patterns.

### Silo 4 — Environment
Source: vehicle GPS + weather + calendar + time-of-day + traffic. Examples: rush hour, weather degrading, meeting in 20 min, low ambient temperature.

### Silo 5 — Inferences (feedback loop)
Source: this engine's own outputs from prior turns. Examples: "EVA inferred fatigue 3 times in this session", "stress level has been rising over the last 15 min". This silo lets the engine see its own pattern of inference and avoid oscillation.

---

## Joint inference paths

A "path" is a defined rule for combining signals from multiple silos to produce a higher-level inference. Paths are **not** if-statements in code — they are observations the engine makes that get injected into the system prompt as soft signals for the LLM to reason over.

Example paths for EVA-1:

| Path | Reads from silos | Infers |
|---|---|---|
| Fatigue path | ADAS (steering variance, braking pattern) + Driver input (voice rate, hedging) + Environment (session duration, time of day) | `fatigueRisk` level |
| Stress path | ADAS (harsh braking, lateral instability) + Driver input (terse responses, raised tone) + Environment (traffic, weather) | `stressLevel` |
| Hunger path | Environment (time since last meal proxy from calendar/time-of-day) + Memory (past hunger patterns) + Driver input (mention of food) | `likelyHungry` |
| Communication preference | Memory (rejection of long responses) + Driver state (current fatigue/stress) | `responsePreferredBrevity` |
| Routing preference | Memory (past route choices) + Driver state (current stress) + Environment (current traffic) | `routingPreference` |
| Contact-on-state | Memory (past calls correlated with state + time) + Inferences (current driver state) + Environment (time of day) | `suggestedContact` |

The engine writes inferences to silo 5 with confidence scores. The system prompt receives the top-N inferences as natural language hints, not as hard facts.

---

## Tier of driver state understanding

Driver state is not binary. EVA-1 needs at least these tiers:

1. **Acute signals** — sharp threshold crossings (emergency braking, sudden lateral instability). Handled by the deterministic signal interpreter already.
2. **Short-term state** — current cognitive/emotional state inferred over the last few minutes. The main job of the AIS.
3. **Session-level patterns** — what's typical for this drive. Used to detect deviation.
4. **Driver-level patterns** — what's typical for this driver across all sessions. Stored in memory tier, used for personalisation.
5. **Cross-driver patterns** — not in EVA-1 (would require fleet data and federated learning, EVA-3+).

The AIS focuses on tiers 2-4. Tier 1 is the existing signal interpreter (the AIS reads its output as input). Tier 5 is out of scope.

---

## Relationship to existing components

| Existing | Relationship to AIS |
|---|---|
| Signal interpreter (`interpreters/signal-interpreter.ts`) | Provides Silo 1 data. Output (interpreted metrics) is read by the inference engine. |
| Memory tier (`memory/*`) | Provides Silo 3 data. Inference engine writes new patterns and observations as memory chunks. |
| Threshold checker (`triggers/thresholds.ts`) | Provides acute Tier 1 signals. The AIS will eventually subsume or coordinate with this for proactive triggers. |
| Persona system (`personas/base.ts`) | Currently driven by user selection. Will be driven by AIS-inferred driver state instead. |
| Mode system (`set_mode` tool, `mode` field on context) | Currently driver-initiated. AIS will propose mode switches based on inference. |
| Conversation window (last 30 turns) | An input to the inference engine — patterns of conversation itself are a signal. |

The AIS does not replace any of these. It sits above them and gives them coherence.

---

## What is in EVA-1 scope

**In scope for EVA-1:**
- Silo definitions and contracts
- Inference engine skeleton with placeholder paths
- Driver state inference at minimum 4 levels (`calm`, `focused`, `stressed`, `fatigued`)
- Driver state injection into system prompt
- Persona selection driven by driver state (not user toggle)
- Mode matrix as a configurable mapping (signal patterns → suggested mode), placeholders only
- Inference logging — every inference is stored for review

**Out of scope for EVA-1 (placeholders only, no production logic):**
- Fine-tuned per-persona models (EVA-1.5+)
- Federated learning across drivers (EVA-3+)
- Camera-based driver state (EVA-2)
- Calendar integration (post EVA-1 unless trivially via tool)
- Contact integration depth (basic `tel:` URI only)

---

## Open architectural questions

These are the questions to resolve before the AIS is implemented. They are recorded here for review, not answered.

1. **Where does the inference engine live?** Pure server-side scheduled job? Inline on every reasoning turn? Continuous background WS-driven? The plan defaults to inline-on-every-turn for EVA-1 (simplest, sufficient for short trip latency).
2. **Are inferences themselves stored as memory chunks, or as a separate `inferences` table?** Defaults to separate table — inferences are higher-frequency than memory and have different retention requirements.
3. **Confidence model** — how is confidence computed and how does it decay over time? Needs a draft.
4. **Persona switch boundary** — what is the minimum confidence to switch persona mid-session? Needs a threshold.
5. **Auditability** — every inference must be reviewable in the dashboard. Schema needs design.
6. **Mode switch UX** — does EVA silently switch, or always ask? Probably mode-dependent (copilot asks, quiet companion silently switches).

---

## Companion documents

- [Driver State Matrix](./driver-state-matrix.md) — the states themselves, their signals, their behavioural implications
- [Mode Matrix](./mode-matrix.md) — modes, switching rules, what each mode means for proactive behaviour
- [Persona System](./persona-system.md) — how persona is driven by driver state, prompt design, character.ai-style instant persona switching
- [Inference Silos](./inference-silos.md) — formal contract for each silo and their joint inference paths

---

*Last updated: working document.*
