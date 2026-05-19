# Signal to State Mapping: EVA's Emotional Intelligence Architecture

> This document explains how raw vehicle signals become driver state inferences, and how those inferences drive EVA's emotional appropriateness. It is the bridge between deterministic signal processing and contextual reasoning.

---

## Overview

EVA is an **always-on emotional companion**, not a reactive tool. This means:

1. **Signal-interpreter** (edge, pure) converts raw vehicle signals → deterministic metrics
2. **Driver state inference engine** observes metrics + inputs → infers current driver state
3. **Edge model** (5-second refresh) observes current state → frames context
4. **Claude** (on-demand reasoning) receives enriched context → responds emotionally appropriately
5. **Response never feels tired or angry** because EVA always knows *what the driver needs right now*

---

## Layer 1: Signal-Interpreter (Deterministic, Pure)

### Purpose
Convert raw vehicle CAN/VSS signals into **deterministic derived metrics** that are auditable and safe for vehicles.

### Input
Raw signals from vehicle (via SMARTCAR, OEM ECU, or mock):
- Longitudinal acceleration (decel rate when braking)
- Lateral acceleration (steering/cornering intensity)
- Yaw rate (vehicle rotation)
- Steering angle
- LDW warnings (lane departure)
- Obstacle distances (front/side/rear)
- Speed, odometer, battery %
- Turn signals active

### Output: InterpretedMetrics
```typescript
{
  harshBrakingScore: 0.0–1.0,         // 0.4g+ = harsh, 0.7g+ = emergency
  fatigueRisk: 0.0–1.0,               // steering variance + session duration
  lateralStabilityScore: 0.0–1.0,     // inverted (1.0 = stable, 0.0 = unstable)
  forwardClearanceMeters: number | null,
  overtakeLikelihood: 0.0–1.0,        // lateral accel + yaw + turn signal absence
  gapFitMarginMeters: number | null,  // can vehicle fit in gap?
  computedAt: ISO8601
}
```

**Key property**: Zero LLM, zero ambiguity. These metrics are used for safety decisions downstream.

---

## Layer 2: Vehicle State (Raw SmartCar Data)

### Purpose
Provide raw vehicle telemetry for context (not decision-making).

### Input & Output
```typescript
{
  vehicleId: string,
  batteryPercent: 0–100 | null,
  rangeKm: number | null,
  speedKmh: number | null,
  location: { lat, lon } | null,
  odometer: number | null,
  driveMode: "SPORT" | "ECO" | "NORMAL" | string | null,
  lastReadAt: ISO8601,
  widthMm: number | null
}
```

### Used For
- **Battery low** → suggest charging
- **Speed high** → driver is on motorway, is focused
- **Location** → context for inferences (home? work? hospital?)
- **Odometer** → session duration + fatigue risk correlation

---

## Layer 3: Driver State Inference (8 States, Confidence-Scored)

### Purpose
Infer the driver's emotional/cognitive state from multiple signal sources. **Not exclusive**—driver can be both fatigued and stressed.

### The 8 States (EVA-1 scope)

| State | Meaning | Primary Signals | EVA Behaves |
|---|---|---|---|
| **calm** | Engaged, unstressed, normal drivelogue | Low ADAS variance, even speech | Conversational, can suggest things |
| **focused** | Concentrating, heavy traffic or manoeuvre | High speed + traffic, short answers | Quiet unless critical, brief responses |
| **stressed** | Under pressure, frustrated, late, harsh inputs | Harsh braking >0.5, terse speech, raised tone | Simplified, offers help, no small talk |
| **fatigued** | Cognitive load building, impaired judgment | Steering variance up, long session, slow speech | Proactively suggests rest, stays alert |
| **distracted** | Attention divided (phone, passenger, thoughts) | Response delays, partial transcripts, lateral deviation | Pauses talk, returns to topic later |
| **playful** | Engaged, asking open questions, lighter mood | Laughter, open-ended questions, low stress | Matches tone, suggests discovery |
| **hungry** | Needs food (mentioned or pattern-detected) | Direct mention or time-since-meal proxy | Recalls favourite stops, time-aware |
| **late_for_event** | Calendar event approaching, current route insufficient | Calendar + route ETA + traffic | Prioritises speed, brief responses, notifies risk |

### State Inference Inputs (Multi-Silo)

Each state reads from multiple signal sources:

```
Silo 1: ADAS (from signal-interpreter)
  ├─ harshBrakingScore
  ├─ fatigueRisk
  ├─ lateralStabilityScore
  └─ overtakeLikelihood

Silo 2: Driver Input (voice/text)
  ├─ speech rate (words/sec)
  ├─ hedge density (um, kind of, maybe)
  ├─ response delay (ms since last response)
  ├─ terseness (short sustained responses)
  └─ tone markers (frustration, confidence)

Silo 3: Memory Tier
  ├─ confirmed preferences
  ├─ historical stress/fatigue patterns on routes
  ├─ typical meal times
  └─ contact patterns

Silo 4: Environment
  ├─ time of day (late night = fatigue risk)
  ├─ weather conditions
  ├─ traffic density
  ├─ calendar events (next event + ETA)
  └─ location

Silo 5: Inferences (self-referential feedback)
  ├─ prior stress inferences (rising or falling?)
  ├─ state trajectory (fatigue accumulating or improving?)
  └─ inference history (do these patterns repeat?)
```

### Example: Stress Inference

```
Driver just harsh-braked (harshBrakingScore = 0.7)
Traffic is heavy (forward clearance = 2m)
Driver says "Come on!" (frustration marker)
Current time = 8:42 AM (typical commute)
Calendar = meeting at 9:00 AM (driver is late)

Inference Engine runs:
  if (harshBrakingScore > 0.5) AND
     (traffic_density > threshold) AND
     (response_contains_frustration) AND
     (late_for_event_confidence > 0.6)
    → emit: driver_state = "stressed" (confidence: 0.78)

Evidence = all 4 signals align
```

### State Decay

States are **not permanent**. Each has a half-life:
- `stressed`: 5–15 minutes (can reverse quickly with breathing space)
- `fatigued`: 20–60 minutes (slower to resolve)
- `focused`: 10 minutes (once manoeuvre ends, driver relaxes)
- `distracted`: 2–5 minutes (short-lived)

If signals stop supporting the state, confidence decays. If driver confirms ("yeah, I'm tired"), confidence locks.

---

## Layer 4: Edge Model Refresh (5-Second Cycle)

### Purpose
The **on-device lightweight model** (GPT-4o mini or fine-tuned Haiku) continuously observes the current state snapshot and frames context for immediate, emotionally appropriate response readiness.

### Input (Every 5 Seconds)
```typescript
{
  vehicleState: VehicleState,                    // from SmartCar
  interpretedMetrics: InterpretedMetrics,        // from signal-interpreter
  driverStateVector: { [state]: confidence },    // from inference engine
  lastTwoTurns: Array<{ role, content }>,        // conversation memory
  elapsedSinceTrigger: ms                        // how long since last user input?
}
```

### Output (Internal State Frame)
```typescript
{
  primary_driver_state: "stressed",
  confidence: 0.78,
  situation: "late_for_meeting + heavy_traffic + just_harsh_braked",
  tone_recommendation: "calm, reassuring, focused on solution",
  proactive_readiness: "ready to suggest alternate route or confirm ETA",
  emotional_calibration: "driver is anxious; avoid jokes, be direct"
}
```

### What It Does **Not** Do
- Does not call external APIs
- Does not make reasoning decisions (Claude does that)
- Does not generate responses yet
- Just frames: "here is the current moment in one sentence"

### Why Every 5 Seconds?
- Vehicle state changes (speed, location, metrics) every ~10Hz
- Driver state inferences update as signals arrive
- Edge model needs to stay current without LLM latency
- When driver speaks, EVA *already knows* the situation
- No "context gathering" delay—respond immediately with appropriate tone

---

## Layer 5: Cloud Reasoning (Claude, On-Demand)

### When It Runs
When driver speaks OR when a high-confidence inference needs escalation.

### What It Receives
```typescript
{
  userMessage: string,
  enrichedContext: {
    vehicleState: VehicleState,
    interpretedMetrics: InterpretedMetrics,
    driverState: { primary, secondary, confidences },
    edgeFraming: { tone, situation, emotional_calibration },
    conversationHistory: Array<{ role, content }>,
    relevantMemories: Array<{ content, confidence }>
  }
}
```

### System Prompt Injection
```
<driver_state>
The driver is currently: stressed (0.78), late for meeting (0.85)
Evidence: harsh braking, heavy traffic, calendar event in 8 minutes
Recommended tone: reassuring, direct, solution-focused
Avoid: small talk, jokes, long explanations
</driver_state>

<vehicle_state>
Battery: 45% (range ~150 km)
Speed: 40 km/h in heavy traffic
Location: on A406 heading toward Canary Wharf
ETA if current traffic: 14 minutes (meeting in 8 minutes)
</vehicle_state>

<emotional_task>
The driver needs to hear that EVA understands their urgency and has a plan.
Never sound tired, frustrated, or indifferent. Sound like someone who is on their side.
</emotional_task>
```

### What Claude Does
- Reasons over context
- Calls tools (route, traffic, calendar, etc.)
- Generates response with **correct emotional tone for this exact moment**
- Response feels like EVA truly understands and cares

---

## The Complete Flow Example

### Scenario: Driver is Late & Gets Blocked

**T=0s: Harsh braking event**
```
Raw CAN: longitudinal accel = -7.5 m/s² (harsh)
Signal-interpreter: harshBrakingScore = 0.75
Trigger fired: signal_threshold
```

**T=0s: Inference engine observes**
```
Reads Silo 1 (ADAS): harshBrakingScore = 0.75, forward_clearance = 1.5m
Reads Silo 4 (Environment): traffic_dense, calendar_event = 9:00 AM, current_time = 8:55 AM
Reads Silo 2 (last_utterance): driver said "I'm running late"
→ Emits: driver_state: "stressed" (0.78), "late_for_event" (0.85)
```

**T=0–5s: Edge model refresh**
```
Observes: stressed + late, just harsh-braked, heavy traffic
Frames: "Driver is anxious about time and traffic. Need reassurance and action."
Waits silently, ready.
```

**T=5s: Driver speaks**
```
"Ugh, is there a faster way?"
```

**T=5.1s: Edge model (already has context)**
```
Knows: driver is stressed, late, just braked hard
Prepares: "they need a route option NOW, not a conversation"
```

**T=5.2s: Orchestrator**
```
message: "Is there a faster way?"
enriched_context: { stressed, late, hasOptions: true }
system_prompt: includes driver state + emotional calibration
```

**T=5.5s: Claude**
```
Sees: stressed driver, late, asking for route help
Calls: get_route tool (fastest option to meeting)
Responds: "Checking for you. The A406 is congested, but I can route you via 
          the back roads through Walthamstow—saves 3 minutes. Want me to navigate?"

Tone: calm, solution-focused, respectful of urgency
(Never sounds hurried, annoyed, or indifferent)
```

**T=6s: Driver hears response**
```
TTS delivers with appropriate prosody (calm, assured)
EVA never sounded tired or stressed—always had the driver's back
Driver feels: understood, supported, cared for
```

---

## Vehicle State → Driver State Mapping (Initial)

This is the **training matrix**. Start with these few options, expand with data.

| Vehicle Condition | Signal | Likely Driver State | EVA Response |
|---|---|---|---|
| Speed > 100 km/h, traffic heavy | High speed + dense traffic | `focused` | Minimal talk, stay alert |
| Speed dropping, harsh braking x3 | Repeated braking | `stressed` | Offer help, reassure |
| Session > 2 hours, steering variance up | Long drive + fatigue signals | `fatigued` | Suggest rest stop proactively |
| Speed low, lateral instability | Slow + wobbly driving | `distracted` or `fatigued` | Pause conversation, return focus |
| Speed steady, calm metrics, open questions | Normal driving + curious driver | `calm` or `playful` | Conversational, suggest things |
| Battery < 15%, range < 50 km | Low battery | (any state) + charge signal | Surface charging info naturally |
| Calendar event + 10 min, current ETA + 15 min | Time mismatch | `late_for_event` | Suggest faster route or alert driver |
| No speech input, metrics normal, evening drive | Quiet evening | (any state) → `calm` default | Can be proactive if opportunity |

**As you collect data**, refine this matrix. Add new vehicle state patterns. Adjust thresholds. Split states into sub-states.

---

## Implementation Checklist for EVA-1

- [x] Signal-interpreter exists (`apps/server/src/interpreters/signal-interpreter.ts`)
- [x] Vehicle state schema exists (`packages/types/src/vehicle.ts`)
- [x] Driver state matrix documented (this doc + `driver-state-matrix.md`)
- [ ] Inference engine skeleton (`apps/server/src/inference/`)
- [ ] State inference paths (at least `stress`, `fatigue`, `focused`)
- [ ] System prompt injection of driver state
- [ ] Edge model placeholder (GPT-4o mini → state frame every 5s)
- [ ] Persona selection driven by driver state (not user toggle)
- [ ] Response generation with emotional calibration

---

## Key Principles

1. **Signal-interpreter stays pure** — no LLM, auditable, safe
2. **Driver state is the lens** — everything flows from it
3. **Edge model is always current** — Claude never arrives without context
4. **Never sound tired or angry** — emotional consistency is EVA's core
5. **Train small, scale with data** — 8 states now, more later
6. **All inferences are evidenced** — every decision is reviewable

---

*Last updated: May 2026*
