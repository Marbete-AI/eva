# Driver State Matrix

> Working document. Driver state is the central inferred output of the Active Inference System. This document defines the states, their signals, and their behavioural implications.

This is not user-facing documentation. It is the design reference for what EVA infers and how it reacts.

See: [Active Inference System](./active-inference-system.md) for the engine, [Mode Matrix](./mode-matrix.md) for mode transitions, [Persona System](./persona-system.md) for how state changes EVA's voice.

---

## Why driver state is the centre

The build plan describes "persona" as a user choice. **That is wrong for the product.** The driver should never need to choose a persona. EVA chooses how to communicate based on what the driver needs in that moment — and what the driver needs is inferred from their state, not selected from a menu.

The state IS the lens. Mode and persona are downstream of state.

---

## EVA-1 state set

The state set for EVA-1 is intentionally small. Each state has confidence between 0 and 1. States can co-occur (a driver can be both fatigued and stressed) — these are not exclusive.

| State | Meaning | Primary signals | Behavioural implication |
|---|---|---|---|
| `calm` | Default. Driver is engaged, unstressed, drivelogue normal. | Low ADAS variance, even speech, no acute alerts | EVA can volunteer information, suggest scenic routes, conversational tone |
| `focused` | Driver is concentrating, possibly mid-manoeuvre or in heavy traffic. | High forward-clearance attention, short utterances, motorway speeds, traffic | EVA stays quiet unless safety-critical. Brief responses. No proactive talk. |
| `stressed` | Driver is under pressure — late, frustrated, traffic, harsh inputs. | Harsh braking, terse speech, raised tone, traffic delay rising | EVA simplifies. Offers help (alternate routes, ETA reassurance). No small talk. |
| `fatigued` | Cognitive load building. Risk of impaired judgement. | Steering variance up, session duration long, slower speech, time-of-day | EVA proactively suggests rest stop or contact. Stays alert. Conversational only if it serves alertness. |
| `distracted` | Driver attention divided — phone use, conversation, passenger. | Sudden response delays, voice partial, lateral deviation | EVA pauses non-urgent talk. Returns to topic later. |
| `playful` | Driver engaged, asking open questions, joking, lighter tone. | Open-ended questions, laughter, lower stress signals | EVA can match tone, suggest discovery (scenic route, music). |
| `hungry` | Driver mentions food, or pattern suggests it. | Direct mention, time since last meal proxy, route past food places | EVA recalls favourite stops, time-aware suggestion. |
| `late_for_event` | Calendar event approaching + current route insufficient. | Calendar + route ETA + traffic | EVA prioritises faster route, brief responses, notifies risk. |

---

## State inference inputs (signal map)

Each state has a defined set of signals across the AIS silos. Confidence is computed from the strength and convergence of these signals.

### `calm`
- ADAS: lateral stability ≥ 0.8, harsh braking score < 0.3
- Driver input: speech rate normal, no hedge density
- Memory: no recent fatigue or stress flags
- Environment: not rush hour, weather acceptable
- Inference: default state when no other state has high confidence

### `focused`
- ADAS: high speed sustained, traffic density high, forward clearance low
- Driver input: minimal utterances, response delays acceptable
- Environment: motorway segment, ongoing manoeuvre (overtake likelihood > 0.3)
- Inference: high if motorway + traffic, regardless of stress markers

### `stressed`
- ADAS: harsh braking score ≥ 0.5, lateral instability score < 0.5
- Driver input: terse, raised tone, increased speech rate, frustration markers ("come on", "for god's sake")
- Memory: prior history of stress on this route
- Environment: late for event likely, traffic delay > 10 min, weather degrading
- Inference: high when ADAS + speech align

### `fatigued`
- ADAS: steering variance rising, harsh braking score creeping up, lane drift markers
- Driver input: slower speech, more hedge words, sentences trailing off
- Memory: long session duration, time-of-day pattern (post-midnight, after long workday)
- Environment: late hour, long continuous drive
- Inference: this is the path from the existing `fatigueRisk` interpreter plus voice + memory

### `distracted`
- ADAS: lateral deviation without explanation, lane-keep warnings
- Driver input: partial transcripts, long pauses mid-utterance
- Environment: passenger present (proxy: multi-voice detection — future), call active
- Inference: short-lived state, usually paired with other signals

### `playful`
- Driver input: laughter, open-ended questions, longer pleasant utterances
- Memory: prior playful sessions, scenic route preferences
- Environment: weekend, daytime, scenic route segment
- Inference: low priority — only when other negative states have low confidence

### `hungry`
- Driver input: direct mention ("getting hungry"), questions about food
- Memory: typical meal times, favourite food stops
- Environment: time since last meal (calendar proxy), nearby food
- Inference: explicit mention forces high confidence; otherwise pattern-driven

### `late_for_event`
- Memory: calendar event in next 60 min
- Environment: current ETA + traffic vs event start time
- Inference: pure deterministic when calendar + route data present

---

## State outputs

For each turn, the AIS produces a state vector — confidences for every state. The top-N states above threshold are written into the system prompt as natural language hints.

Example payload injected into system prompt:

```
<driver_state>
The driver currently appears: stressed (0.78), fatigued (0.42).
Traffic delay is rising. Steering variance has been elevated for the last 12 minutes.
Driver has historically preferred A-roads over motorways when stressed.
</driver_state>
```

This is not a hard instruction. The LLM reads it as context. The persona system (separate doc) is what turns this into a behavioural shift in tone and content.

---

## State persistence and decay

- Each state has a half-life. `stressed` decays faster than `fatigued`. `fatigued` carries across short breaks.
- A state can also be **confirmed** by the LLM mid-conversation (driver acknowledges "yes I'm tired") which boosts confidence and locks the state for a configurable period.
- State changes are logged as inference events for review.

---

## Joint states and dominance rules

When multiple states have high confidence, the AIS applies dominance rules to pick the primary state for persona selection:

| Combination | Primary state for persona |
|---|---|
| `fatigued` + `stressed` | `fatigued` — fatigue is higher safety risk |
| `late_for_event` + `stressed` | `late_for_event` — actionable, more specific |
| `hungry` + `fatigued` | `fatigued` — primary, but EVA may suggest a rest stop for both |
| `distracted` + anything | `distracted` — pause and de-escalate communication first |
| `playful` + `calm` | `playful` — match tone |
| `focused` + anything else | `focused` — minimise communication regardless |

Secondary states still go into the prompt so the LLM can address them in responses.

---

## Where this lives in the existing code

When the AIS is implemented:

- `packages/types/src/driver.ts` — add `DriverStateSet` schema with the 8 states above
- `packages/types/src/inference.ts` — new — `Inference` shape (state name, confidence, evidence, timestamp)
- `apps/server/src/inference/` — new module containing the engine and individual state paths
- `apps/server/src/personas/base.ts` — update `buildDynamicContext` to inject the state vector

---

## Open questions

1. Should we distinguish `frustrated` from `stressed`? Maybe, but EVA-1 keeps them merged.
2. `hungry` is half a behavioural cue and half a routing signal. Worth its own state, or just a preference flag? Defaults to state for now because it changes how EVA proactively engages.
3. Should the LLM be able to **propose** a state inference back to the engine ("I think the driver sounds anxious — flag for stress")? Useful but circular — needs guard rails to prevent inference cascades.
4. How does state affect tool selection? E.g. should `stressed` make EVA prefer fewer tools per turn? Worth modelling.
5. Camera-based affect detection arrives in EVA-2. The state schema is designed to accept these new signals additively.

---

*Last updated: working document.*
