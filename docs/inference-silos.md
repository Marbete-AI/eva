# Inference Silos

> Working document. Defines the 5 silos that feed the Active Inference Engine, the joint inference paths that span them, and the contract for how observations become inferences.

See: [Active Inference System](./active-inference-system.md), [Driver State Matrix](./driver-state-matrix.md).

---

## Why silos

The temptation is to merge all signals into one big context object and let the LLM reason over it. That fails because:

1. Signals arrive at different cadences (ADAS at 10Hz, memory recall on demand, calendar once an hour)
2. Signals have different reliability (ADAS thresholds are deterministic; voice tone is fuzzy)
3. Inference patterns repeat — observing one silo's pattern over time matters more than its instantaneous value
4. The system needs to be auditable — which signal caused which inference must be traceable

Each silo is a stream with its own schema, write cadence, and retention rules. Inference paths read from multiple silos to produce higher-level inferences.

---

## The 5 silos

### Silo 1 — ADAS
Source: `apps/server/src/interpreters/signal-interpreter.ts` (already exists)
Read cadence: every frame (10Hz when ADAS mock is connected)
Schema:
- `harshBrakingScore` 0-1
- `fatigueRisk` 0-1
- `lateralStabilityScore` 0-1
- `forwardClearanceMeters` nullable
- `overtakeLikelihood` 0-1
- `gapFitMarginMeters` nullable

The signal interpreter is already deterministic. The AIS treats its output as the ADAS silo.

### Silo 2 — Driver input
Source: ASR transcripts + acoustic features (future) + text input
Read cadence: per turn
Schema:
- `utterance` string
- `speechRate` (words/sec) — future, needs realtime acoustic analysis
- `hedgeDensity` — count of hedge words ("um", "kind of", "maybe") per 100 words
- `responseDelay` ms — time between EVA's last response and driver's
- `terseness` — short responses sustained = inferred attention drain
- `tone` (future) — extracted from acoustic features in conversation mode

For EVA-1 most acoustic features will be derived from text alone (hedge density, terseness, response delay). Audio-derived features arrive when conversation mode is stable.

### Silo 3 — Memory tier
Source: existing `apps/server/src/memory/*`
Read cadence: per turn (retrieval) + post-turn (extraction)
Schema:
- `confirmed preferences` — promoted memories from `memory_chunks`
- `behavioural patterns` — promoted patterns from session analyser
- `route history` — past routes taken
- `contact patterns` — calls/messages tied to time/state
- `feedback record` — implicit and explicit feedback over time

The memory tier already exists. The AIS reads it; the AIS also writes new pattern observations as memory candidates that the existing extractor promotes.

### Silo 4 — Environment
Source: GPS + weather + calendar + time-of-day + traffic
Read cadence: on demand + scheduled (every 5 min for ambient)
Schema:
- `location` lat/lon
- `weatherCondition`, `temperatureC`, `precipMm`
- `currentTrafficSummary`
- `calendarUpcoming` — next event + time-until
- `dayOfWeek`, `timeOfDay`, `isWeekend`
- `routeContext` — currently navigating? to where? ETA?

Calendar integration is post EVA-1 unless trivially via a tool. Weather and traffic are already available.

### Silo 5 — Inferences (feedback loop)
Source: this engine
Read cadence: every turn (engine reads its own past output)
Schema:
- `inferenceId` uuid
- `type` (`driver_state`, `mode_suggestion`, `persona_recommendation`, `preference_pattern`, `contact_pattern`, …)
- `value` object — the inferred value with confidence
- `evidence` — references to which silo entries supported this
- `timestamp`
- `decayedAt` — when this should be re-evaluated

Inferences are written to a new `inferences` table (separate from `memory_chunks` because the retention and access patterns differ).

---

## Silo write contract

| Silo | Writers | Read access |
|---|---|---|
| ADAS | Signal interpreter only | Inference engine, system prompt builder |
| Driver input | Session manager (post-ASR) | Inference engine |
| Memory tier | Memory extractor, promotion engine, AIS | Inference engine, system prompt builder, tools |
| Environment | Context manager (timers), tool calls | Inference engine, system prompt builder |
| Inferences | AIS only | AIS (its own next pass), system prompt builder |

Strict separation. The inference engine **never** mutates other silos directly. It can propose memory writes by emitting a candidate to the existing extractor pipeline.

---

## Joint inference paths

A path is a function that reads from N silos and emits 1 inference (or none). Paths are not hardcoded — they are configurable as a registry the engine iterates over each turn.

### Path schema

```ts
interface InferencePath {
  id: string;                     // e.g. "fatigue-detection"
  reads: SiloId[];                // which silos this path reads from
  emits: InferenceType;           // what kind of inference this produces
  run(context: SiloSnapshot): Inference | null;
  cooldownMs: number;             // do not re-emit the same inference within this window
}
```

### Path registry (placeholder for EVA-1)

| Path ID | Reads | Emits | Logic sketch |
|---|---|---|---|
| `fatigue-detection` | ADAS + Driver input + Environment + Memory | `driver_state: fatigued` | Combine `fatigueRisk` from interpreter, hedge density, session duration, time of day, historical fatigue patterns |
| `stress-detection` | ADAS + Driver input + Environment | `driver_state: stressed` | Combine harsh braking, terseness, traffic, weather, lateness |
| `focused-detection` | ADAS + Driver input + Environment | `driver_state: focused` | High speed + traffic + minimal utterances |
| `playful-detection` | Driver input + Environment | `driver_state: playful` | Open-ended questions + laughter markers + weekend |
| `hunger-detection` | Driver input + Memory + Environment | `driver_state: hungry` | Direct mention OR time-since-meal + history |
| `late-detection` | Environment + Memory | `driver_state: late_for_event` | Calendar + ETA mismatch |
| `contact-suggestion` | Memory + Inferences + Environment | `contact_pattern: <name>` | "When this driver is fatigued at 6pm they call X" |
| `routing-preference` | Memory + Inferences | `preference: prefers_a_roads_when_stressed` | Observed patterns in route choices vs state |
| `mode-suggestion` | Inferences + Environment | `mode_suggestion: <mode>` | Highest-confidence driver state + current mode → suggested mode |
| `persona-selection` | Inferences + Environment | `persona_recommendation: <persona>` | See persona-system.md mapping table |

Each path has its own confidence model and cooldown. The engine runs all paths every turn, collects emissions, deduplicates by type, and writes the highest-confidence inferences to Silo 5.

---

## Inference confidence

Every inference has a confidence score 0-1. Confidence comes from:

1. **Signal strength** — how strong is the underlying signal? (e.g. `fatigueRisk = 0.8` → strong)
2. **Signal convergence** — how many independent silos agree? (ADAS + voice + memory all point fatigued → high)
3. **Historical accuracy** — has this path been right before? (tracked in inferences silo over time)
4. **Recency** — fresher signals weigh more

Confidence determines:
- Whether the inference appears in the system prompt
- Whether mode/persona switches happen silently or are confirmed
- Whether the inference is logged as a learning event

---

## Decay and re-evaluation

Inferences are not permanent.

- Acute inferences (`stressed`, `distracted`) decay fast — half-life 2-5 minutes
- Behavioural inferences (`prefers_a_roads_when_stressed`) decay slow — half-life days to weeks, but only confirmed once promoted to memory
- Mode/persona suggestions decay quickly — they are momentary

The engine re-evaluates each inference on its half-life. If still supported by silos, refresh; otherwise let it decay.

---

## Inference auditability

Every inference produced is reviewable. The schema includes `evidence` — references to the silo entries that supported the inference. This means:

- A developer can ask: "why did EVA think the driver was stressed at 14:23?"
- The answer points to specific ADAS frames, specific utterances, specific calendar events
- Mis-inferences can be debugged and the path tuned

This auditability is critical for trust. Drivers will reject an assistant that "just decides" things they cannot interrogate.

---

## How this connects to the existing memory tier

The memory tier and the inference engine are **siblings**, not parent/child.

- Memory tier observes conversations and promotes confirmed facts (existing extractor)
- Inference engine observes everything and produces short-lived hypotheses
- When an inference is consistently supported across sessions, the extractor promotes it to memory tier
- Memory tier reads feed back into the inference engine as Silo 3

The bridge: the inference engine can emit a `memory_candidate` event when a pattern looks stable. The existing confirmation queue can pick this up and ask the driver to confirm.

---

## What gets built first

A practical implementation order (when we move from doc to code):

1. `inferences` table migration
2. Silo snapshot type — a single object the engine receives each turn
3. `InferencePath` interface and registry
4. One real path end-to-end: `fatigue-detection` (already half-built in signal interpreter)
5. Inference write + system prompt injection
6. Persona selector reading inferences
7. Mode suggester reading inferences
8. Additional paths added incrementally

The first deliverable is **the engine running each turn with one path, writing inferences, and shifting persona based on output**. Everything else is incremental.

---

## Open questions

1. **Schedule** — engine runs inline on every reasoning turn, or also on a timer between turns? Inline-first; timer later if needed for proactive triggers between utterances.
2. **Path conflict resolution** — if two paths claim conflicting states (`calm` 0.6 + `stressed` 0.7), what does the engine emit? Both, with confidences. Dominance rules in driver-state-matrix.md decide which one drives persona.
3. **Where does fleet pattern learning fit?** Not EVA-1. The schema is designed to allow it later (`evidence` can reference cross-session memory).
4. **GDPR / privacy** — inference data is sensitive. Retention policy needs design. Likely shorter than memory tier (90 days max for acute inferences).
5. **Versioning paths** — when we tune a path, do we keep both versions? Yes — paths are versioned, inferences record the path version that emitted them.

---

*Last updated: working document.*
