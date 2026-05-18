# Mode Matrix

> Working document. Modes define **what EVA is currently optimised for**, separate from driver state (how the driver is) and persona (how EVA speaks). This document defines modes and their switching rules. No production decisions are made here — these are placeholders for review.

See: [Active Inference System](./active-inference-system.md), [Driver State Matrix](./driver-state-matrix.md), [Persona System](./persona-system.md).

---

## Modes vs driver state vs persona

A frequently confused triangle. Each is independent:

| Layer | What it answers | Driven by | Example |
|---|---|---|---|
| **Mode** | What is EVA optimised for right now? | Driver state + environment + explicit request | `driving`, `navigation`, `meeting` |
| **Driver state** | How is the driver feeling/coping? | AIS inference from silos | `stressed`, `fatigued`, `calm` |
| **Persona** | How does EVA communicate? | Driver state + mode + driver preferences | `co-pilot`, `quiet companion` |

A driver in `navigation` mode who is `fatigued` may get the `quiet companion` persona for tone but with extra alertness checks because of the state.

---

## EVA-1 mode set (current + planned)

The codebase currently has 4 modes (`driving`, `meeting`, `fatigue`, `navigation`). Below is the proposed expanded matrix.

| Mode | Purpose | Default tools allowed | ADAS alert behaviour | Proactivity |
|---|---|---|---|---|
| `driving` | Default operating mode. General assistance. | All | Standard thresholds | Mode-dependent (see below) |
| `navigation` | Active route guidance underway. Maps queries are primary. | `get_route`, `ask_gemini` (Maps grounded), `get_weather`, `get_vehicle_state`, `calculate_range` | Standard | High — proactive route updates |
| `meeting` | Driver preparing for or in a meeting (calendar driven). | Calendar/notes tools (future) | Suppressed unless safety-critical | Low — minimal interruption |
| `fatigue` | Fatigue detected. Active state to keep driver alert. | `initiate_call`, `get_route` (rest stops) | Elevated sensitivity | Medium — alertness checks |
| `quiet` | Driver requested or AIS inferred minimal speech (focused/distracted state). | All but EVA stays silent | Critical only | None unless safety |
| `discovery` | Driver in `playful` state, exploring or no time pressure. | All including suggestions, scenic routes | Standard | High — suggestive/curious |
| `emergency` | Safety event detected (collision, severe weather, medical hint). | `initiate_call`, `dispatch_havmco` | Maximum sensitivity | Maximum |

`navigation` requests work in **all modes** — they tool-call Gemini regardless of mode. The mode affects only the framing/tone of the reply and whether EVA proactively volunteers nav updates.

---

## Mode switching rules (placeholder)

These are the proposed signal-to-mode mappings. They are **not** locked decisions. They are placeholders for review.

### Mode entry conditions

| Mode | Enters when | Switch UX |
|---|---|---|
| `navigation` | Driver requests destination + route is active | Silent if from `driving`, ask if from `meeting` |
| `meeting` | Calendar event detected in next 30 min + work calendar | Ask: "You have a meeting at 4pm, switch to meeting mode?" |
| `fatigue` | `fatigued` state confidence ≥ 0.7 sustained for 3+ min | Ask: "You sound tired — switch to fatigue assist?" |
| `quiet` | `focused` confidence ≥ 0.8 OR driver says "be quiet" | Silent |
| `discovery` | `playful` confidence ≥ 0.6 + no time pressure | Silent |
| `emergency` | Acute safety threshold (deterministic interpreter) | Forced, no ask |
| `driving` | Default fallback | Silent |

### Mode exit conditions

| Mode | Exits when |
|---|---|
| `navigation` | Destination reached OR route cancelled |
| `meeting` | Meeting ends OR driver requests exit |
| `fatigue` | Rest taken OR fatigue confidence < 0.4 sustained |
| `quiet` | Driver speaks OR state changes |
| `discovery` | Stress signal OR time pressure detected |
| `emergency` | Acute signal resolved + safe state confirmed |

### Mode transition matrix (placeholder)

Which transitions are valid:

| From → To | `driving` | `navigation` | `meeting` | `fatigue` | `quiet` | `discovery` | `emergency` |
|---|---|---|---|---|---|---|---|
| `driving` | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `navigation` | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| `meeting` | ✓ | ✓ | – | ✓ | ✓ | ✗ | ✓ |
| `fatigue` | ✓ | ✓ | ✗ | – | ✓ | ✗ | ✓ |
| `quiet` | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| `discovery` | ✓ | ✓ | ✗ | ✓ | ✓ | – | ✓ |
| `emergency` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | – |

`emergency` can be entered from anything but only returns to `driving`/`navigation` after safety confirmation. `discovery` cannot be entered from `meeting` or `fatigue` — wrong context.

---

## Proactivity dial per mode

Proactivity is **not** a boolean. It is a dial that defines:

1. Whether EVA volunteers information without being asked
2. The threshold for surfacing observations
3. How verbose responses are

| Mode | Proactivity dial | Verbosity | Volunteer threshold |
|---|---|---|---|
| `driving` | Medium | Conversational, 1-2 sentences | Medium-high info value |
| `navigation` | High | Concise, route-focused | Anything route-relevant |
| `meeting` | Low | Brief, calendar/work-focused | Critical safety only |
| `fatigue` | Medium-high | Caring, brief | Wellbeing-relevant |
| `quiet` | None | Single-sentence answers only | Safety-critical only |
| `discovery` | High | Curious, can be longer | Anything interesting |
| `emergency` | Forced | Directive, terse | All safety info |

---

## Where this lives in code

When the AIS is implemented:

- `packages/types/src/session.ts` — extend `SessionMode` enum with new modes
- `apps/server/src/agent/mode-matrix.ts` — new — the transition rules as data, not hardcoded if/else
- `apps/server/src/personas/base.ts` — `STATIC_CONSTRAINTS` per mode (already partly exists)
- `apps/server/src/inference/mode-suggester.ts` — new — produces mode change suggestions from driver state vector
- `apps/server/src/tools/set-mode.ts` — already exists, no changes needed for the surface, but it will receive suggestions from the inference engine, not just driver-initiated calls

---

## Mode switch UX rules

Whether EVA asks before switching depends on:

1. **Current mode** — `quiet` always silent, `meeting` always asks
2. **Target mode** — `emergency` always forces, `discovery` always silent
3. **Confidence of suggestion** — > 0.85 = silent if allowed, < 0.85 = ask
4. **Recent switching history** — never propose same mode switch within 5 min of last decline

Confirmation phrasing must be brief: "Looks like you're heading into work — meeting mode?" rather than "I have detected a calendar event…".

---

## Open questions

1. Should `quiet` be a mode or a state? It is currently a mode because it changes EVA's tool routing and proactivity. The argument for state: it is purely a communication preference. Resolved as mode for now — easier to dial.
2. `discovery` mode is new and not in the build plan. It exists because the `playful` driver state needs a destination. Keep or drop?
3. Should mode switches be sent over WS to the client for UI? Probably yes — current mode is shown in the header somewhere.
4. Conflict resolution — if two modes are equally valid (e.g. `navigation` + `meeting`), which wins? Defaults to `navigation` because it is more actionable, but worth a rule.
5. Does emergency override calendar? Almost certainly yes.

---

*Last updated: working document.*
