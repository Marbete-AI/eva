# Assumption and Confirmation Behaviour

> Working document. Captures how EVA handles ambiguous inputs, when it assumes vs asks, and how driver preferences and state affect this behaviour over time.

This document sits across three systems: the tiered memory tier, the Active Inference System, and the persona system. It should be read alongside those docs.

---

## The core problem

When a driver says "will I make it to Manchester?", EVA has two options:

**Option A — Assume:** Treat "Manchester" as Manchester city centre, run the calculation, give an answer. State the assumption briefly.
> "Assuming Manchester city centre — you won't make it on this charge. You'd need a top-up around Stoke."

**Option B — Clarify:** Ask the driver where in Manchester before running anything.
> "Where in Manchester are you heading?"

**Option A is almost always better for driving.** The driver is behind the wheel. Clarifying questions cost attention. An approximate answer with a stated assumption is more useful than a precise answer that arrives 3 turns later.

But "almost always" is not "always." The right behaviour depends on three things:

1. **Driver preference** — does this driver typically accept EVA's assumptions, or do they correct them?
2. **Driver state** — are they calm and receptive, or stressed and in a rush?
3. **Stakes** — a 10km difference in destination matters for range calculation; it rarely matters for a traffic summary.

---

## Default behaviour (EVA-1)

Until enough is known about a specific driver, EVA uses these defaults:

| Query type | Default behaviour |
|---|---|
| Range / "will I make it" | Assume largest/most central interpretation. State it. Proceed. |
| Navigation "take me to X" | Assume most likely destination. Open navigation. |
| Traffic / road conditions | Assume the likely route. Answer. |
| Contact / call | Always confirm — wrong contact is a social error, not just an approximation |
| Calendar / meeting | Always confirm — wrong event has real consequences |

The pattern: **factual/logistical queries default to assume + state. Social/calendar queries default to confirm.**

---

## How assumption tolerance is learned (memory tier)

Every time EVA makes an assumption and the driver responds, that becomes a memory signal:

| Driver response | Signal | Memory candidate |
|---|---|---|
| Accepts or ignores the assumption | Positive | "Driver accepts approximate routing without correction" |
| Corrects EVA ("I meant Didsbury, not city centre") | Negative | "Driver prefers precision before routing" |
| Explicitly confirms ("yes, city centre is fine") | Strong positive | "Driver explicitly comfortable with EVA assumptions" |
| Frustrated response ("you always assume wrong") | Strong negative | "Driver wants confirmation before acting on assumptions" |

These become `preference_interaction` candidates in Tier 1. When promoted to Tier 2 (`confirmed memory`), they are injected into the system prompt on future turns:

```
<driver_memory>
  - Driver accepts approximate destination assumptions without correction (confirmed, 4 observations)
</driver_memory>
```

This means EVA stops stating its assumptions to drivers who have consistently accepted them — the assumption becomes invisible and the response gets crisper over time.

New category to add to `memory/extractor/categories.ts`:

```ts
preference_assumption_tolerance: {
  directConfidence: 0.80,   // explicit statement ("I don't mind you assuming") promotes immediately
  observationCount: 3,       // 3 consistent accept/reject signals before auto-promotion
  requireMultipleSessions: false,
}
```

---

## How driver state gates assumption behaviour (AIS)

Driver state changes how EVA handles assumptions in real time — even before any learning has occurred.

| Driver state | Assumption behaviour |
|---|---|
| `calm` | State the assumption briefly. Proceed. Offer to adjust. |
| `focused` | Skip the assumption statement entirely. Just answer. |
| `stressed` | Skip confirmation. Give the answer fast. One sentence. |
| `late_for_event` | Maximum brevity. Assume most direct interpretation. No caveats. |
| `fatigued` | Gentle confirmation — a tired driver making a wrong turn is a safety issue. |
| `playful` | Can afford to be more precise — ask if it adds value to the interaction. |

The pattern: **higher urgency or cognitive load → more assumptions, fewer confirmation steps. Safety-adjacent states (`fatigued`) → more care, not less.**

This is injected into the system prompt via the driver state vector from the AIS:

```
<driver_state>
Driver is stressed (0.74), running late for an event (0.81).
</driver_state>
```

Claude reads this and adjusts — even without an explicit rule, "stressed + late" reliably produces crisper, assumption-heavy responses.

---

## Persona expression of assumption behaviour

Each persona handles assumptions differently. This is what makes the personas feel distinct:

| Persona | How it handles assumptions |
|---|---|
| `co-pilot` | States assumptions clearly, concisely. "Assuming city centre." Offers to adjust. |
| `quiet companion` | Makes the assumption silently. Doesn't state it unless asked. |
| `coach` | More careful. Validates assumptions especially for safety-relevant queries (range, fatigue). |
| `briefer` | Pure speed. Assumes the most business-relevant interpretation. No caveats. |
| `dispatcher` | Command mode. Assumes. Acts. Does not ask. |

The persona system inherits this from the driver state mapping — so `stressed` → `co-pilot` toned down behaves closer to `briefer` than to normal `co-pilot`.

---

## Implementation touchpoints

| Area | What changes | Branch |
|---|---|---|
| `memory/extractor/categories.ts` | Add `preference_assumption_tolerance` | `tweak/tiered-memory` |
| `personas/base.ts` | System prompt guidance on assumption defaults | `main` (done partially) |
| `inference/paths/assumption-preference.ts` | Inference path observing driver accept/reject signals | `feature/active-inference-engine` |
| `inference/persona-selector.ts` | Driver state gates → assumption behaviour per persona | `feature/active-inference-engine` |

---

## Open questions

1. **How long does a correction stick?** If a driver corrects EVA once, does that immediately change future behaviour for that session, or does it require multiple sessions? Proposed: immediate effect within session, requires 3 observations for cross-session promotion.

2. **Assumption confidence threshold** — when should EVA state its assumption vs silently assume? Proposed: state when confidence in the interpretation is < 0.85, silent above that threshold.

3. **Domain specificity** — should assumption tolerance be tracked per domain (routing vs contact vs calendar) or as a single driver-level trait? Proposed: per domain, because a driver who hates routing assumptions may be fine with EVA assuming a contact.

4. **Error recovery** — if EVA assumes wrong and the driver corrects mid-journey, how does EVA handle the correction gracefully? This is a conversation design question as much as a technical one.

---

*Last updated: working document.*
