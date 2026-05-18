# Deck 2 — EVA: The In-Vehicle AI Companion
## OEM Integration Vision | EVA-2 / EVA-3
### Guy Kawasaki Format — 10 Slides, 30pt minimum, 20 minutes

*For Karan / EMA call. Audience: OEM partnership decision makers, automotive technology leads.*

---

## Slide 1 — The Problem

**Your car knows everything. It tells you nothing.**

Modern vehicles generate terabytes of sensor data per drive. ADAS systems see the road better than any human. The vehicle knows battery state, tyre pressure, fatigue signals, traffic patterns, the driver's history.

None of it reaches the driver in a way they can use.

They get warning lights. Generic alerts. Infotainment that requires eyes and hands.

**The gap is not sensors or compute. The gap is intelligence.**

---

## Slide 2 — The Product

**EVA is the AI companion that lives in your car.**

Not a voice assistant that executes commands. A co-pilot that understands you, learns you, and acts on your behalf — with your consent, within your preferences.

EVA observes:
- Your driving behaviour across every session
- Your vehicle's real-time state
- The road, traffic, weather, and your calendar
- Your fatigue, your stress, your mood

EVA infers:
- What you need before you ask
- When to speak and when to stay quiet
- Who to call, where to stop, which route to take

EVA acts:
- Speaks in your preferred voice, tone, and style
- Adjusts the car around you — climate, lighting, drive mode
- Surfaces the right information at the right moment
- Learns every drive and gets better

**EVA-1:** Phone app. Read-only. Conversational.
**EVA-2:** Native vehicle. Read and write. Ambient. Integrated.
**EVA-3:** Fleet intelligence. Cross-vehicle learning. OEM data asset.

---

## Slide 3 — The Architecture

**Smart core. Simple edges. OEM-swappable.**

```
Driver voice / input
        ↓
  EVA Reasoning Core (cloud)
  ┌─────────────────────────────┐
  │  Active Inference Engine    │ ← learns driver state
  │  Memory Tier (4 levels)     │ ← remembers everything
  │  Persona System             │ ← adapts communication
  │  Claude (main reasoning)    │ ← tool use + response
  │  GPT-4o mini (specialist)   │ ← intent + state signals
  └────────────┬────────────────┘
               ↓
  Output Router
  ├── Voice (ElevenLabs TTS)
  ├── HUD / cluster display
  ├── HAVMCO vehicle commands
  ├── Ambient (lighting, haptics)
  └── Comms (call, SMS, nav)
```

**The reasoning core does not change per OEM.**

What changes per OEM is the adapter layer:
- ADAS signal source (mock → OEM ECU stream)
- Vehicle command target (SmartCar → OEM HAVMCO SDK)
- Display surface (phone → cluster / HUD)
- Voice pipeline (phone mic → in-cabin mics)

Everything above the adapter layer is EVA. Everything below is OEM infrastructure.

---

## Slide 4 — How EVA Lives in the Vehicle
### EVA-2: The Native Experience

**EVA-1 runs on the driver's phone. EVA-2 runs in the vehicle.**

The shift from phone to vehicle changes three things:

**1. Always on**
No wake word required on a phone. EVA listens through the vehicle's existing in-cabin microphone array. The driver never takes out a phone.

**2. Ambient output**
EVA's responses are not just audio. They are felt and seen:

| Driver state | EVA output |
|---|---|
| Overtaking manoeuvre detected | Ambient cabin lighting pulses soft white — heightened focus signal |
| Fatigue crossing threshold | Seat haptic vibration — gentle, repeated — before EVA speaks |
| Navigation turn approaching | Dashboard ambient strip shifts direction |
| EVA speaking | HUD displays key information simultaneously |

The driver's senses are not overloaded. Each channel carries a different type of information.

**3. Direct vehicle control**
EVA-2 can write to the vehicle, not just read:

| EVA infers | EVA does (with permission) |
|---|---|
| Driver is stressed on motorway | Offers to switch to comfort drive mode |
| Long motorway cruise | Suggests enabling adaptive cruise, sets it |
| Hot + fatigued | Pre-cools cabin, dims internal lighting |
| Overtake opportunity detected | Tightens throttle map, confirms with driver |
| Fatigue at rest stop | Adjusts seat to recline position |

Every action is confirmable. EVA never acts without driver awareness.

---

## Slide 5 — HAVMCO Integration
### The Command Layer

**HAVMCO** (Human-Autonomous Vehicle Machine Communication Orchestra) is the OEM middleware that EVA writes commands to.

In EVA-1: `dispatch_havmco` is a stub. It logs the command. Nothing executes.
In EVA-2: `dispatch_havmco` calls the OEM HAVMCO SDK. Commands execute on the vehicle.

**What EVA can command via HAVMCO:**

| Channel | Command examples |
|---|---|
| Drive mode | Switch to Sport, Comfort, Eco, Custom |
| Throttle map | Tighten or smooth throttle response |
| Suspension | Stiffen or soften per corner |
| Climate | Set cabin temperature, direct vents, seat heat/cool |
| Ambient lighting | Colour, brightness, pulse pattern |
| Seat | Position, lumbar, massage, recline |
| HUD | Content, brightness, what to display |
| Comms | Initiate call, send SMS, read messages |
| Navigation | Set destination, add waypoint, avoid area |

**EVA never commands safety systems.** Braking, steering, and collision avoidance remain under vehicle control. EVA is advisory + comfort + experience — not safety-critical actuation.

**HAVMCO integration path:**
1. OEM provides HAVMCO SDK or REST API
2. EVA wraps it as a tool: `dispatch_havmco(channel, command, params)`
3. Claude calls the tool when the driver context justifies it
4. Tool confirms execution, EVA acknowledges verbally
5. Memory tier notes the driver's response (accepted/rejected/reversed)

---

## Slide 6 — The Ambient Experience
### What EVA Feels Like When It Works

**Scenario: 6pm motorway. Driver running late. Fatigue signals rising.**

```
Session minute 0:    EVA connects. Silent.
Session minute 45:   Steering variance up. EVA notes internally.
Session minute 62:   Harsh braking at junction. EVA notes.
Session minute 71:   Speech rate slowing. Hedge words increasing.
Session minute 75:   Fatigue inference confidence crosses 0.70.

                     Seat haptics: two soft pulses.
                     Cabin lighting: shifts to warm amber.

                     EVA (quiet companion tone):
                     "You've been driving a while. There's a services
                     in 8 miles — want to stop?"

                     Driver: "Yeah, good shout."

                     EVA: "I'll add it to the route. Your wife called
                     earlier — want me to let her know you're stopping?"

                     Driver: "Yeah, text her."

                     EVA: [sends SMS via HAVMCO comms channel]
                     "Done. Exit in 3 miles."
```

The driver did not ask for any of this. EVA watched, inferred, and acted — briefly, calmly, usefully.

This is not a feature. This is the product.

---

## Slide 7 — The Learning Engine
### Why EVA Gets Better With Every Drive

**The data asset that compounds.**

| After N sessions | EVA knows |
|---|---|
| 3 sessions | Typical commute route, preferred departure time |
| 10 sessions | Routing preferences, radio habits, fatigue onset pattern |
| 20 sessions | Stress triggers, who to call when tired, favourite rest stop |
| 50 sessions | Full driving personality model — better than any assistant the driver has ever used |
| 100+ sessions | Predictive assistance — EVA acts before patterns become problems |

**The four memory tiers:**
- **Tier 0** — last 30 turns of this session (immediate context)
- **Tier 1** — candidates: everything that might matter, held for review
- **Tier 2** — confirmed facts and preferences, injected into every response
- **Tier 3** — cross-session behavioural patterns, detected at session end

**This is the competitive moat.** The model does not hold this. The memory does. If the driver switches to a competitor, the memory does not transfer. Every session with EVA widens the gap.

---

## Slide 8 — The Personalisation Pathway
### From Memory to Model

**EVA-1:** In-context personalisation. Memory retrieved into prompt. Fast, effective, no training cost.

**EVA-1.5:** Fine-tuned specialist models per driver archetype. Trained on approved session data. Intent classification + driver state extraction tuned to this driver's patterns.

**EVA-2:** Driver-specific model variant. Opt-in. The driver's approved sessions become their private fine-tune. Their EVA responds faster, understands them more deeply, and is not the same as anyone else's EVA.

**EVA-3:** Fleet intelligence. Aggregated (anonymised) patterns across vehicles inform base models. Individual personalisation remains private. Fleet patterns improve the starting point for every new driver.

**The demo shows step 1.** The architecture shows the path to step 4. No competitor is building this way.

---

## Slide 9 — OEM Integration Model

**EVA as an OEM partnership, not a consumer app.**

**What EVA provides:**
- Full reasoning and inference stack
- Memory and personalisation layer
- Voice pipeline (ASR + TTS)
- Tool and command framework

**What the OEM provides:**
- ADAS sensor stream (at VSS schema interface)
- HAVMCO command SDK
- In-cabin hardware (mics, speakers, displays, haptics, ambient lighting)
- Brand and voice customisation

**Integration points (all designed for swap, not rewrite):**

| EVA-1 component | EVA-2 OEM swap |
|---|---|
| `packages/adas-mock` WebSocket | OEM ECU stream adapter — same VSS schema interface |
| `tools/get-vehicle-state.ts` SmartCar | OEM direct vehicle API |
| `tools/dispatch-havmco.ts` stub | OEM HAVMCO SDK call |
| `tools/initiate-call.ts` tel: URI | OEM comms system (in-cabin call) |
| Phone screen card | OEM HUD / cluster renderer |
| ElevenLabs voice | OEM brand voice (optional — can stay ElevenLabs) |

**EVA-1 proves the reasoning architecture. EVA-2 is a swap, not a rebuild.**

**Licensing model options (for discussion):**
- Per-vehicle per-month subscription
- Revenue share on engagement data (opt-in, anonymised)
- White-label: OEM brands EVA as their own assistant
- Platform model: EVA as the app store for in-vehicle intelligence

---

## Slide 10 — The Ask

**This is what a real in-vehicle AI companion looks like.**

Not a voice assistant with a car skin. Not a chatbot bolted onto infotainment. A system that learns the driver, adapts to their state, acts through the vehicle, and compounds in value with every drive.

**EVA-1 is live.** Text and voice. SmartCar connected. Memory running. ADAS signals interpreted. Range calculated. TTS in the driver's preferred voice.

**EVA-2 needs an OEM partner.**
- Access to a real HAVMCO SDK
- In-cabin hardware for ambient output (lighting, haptics, HUD)
- ADAS sensor stream beyond the SmartCar simulator
- A vehicle to test in

**What we are asking for:**
1. A technical pilot — one model line, one vehicle, sandbox environment
2. HAVMCO SDK access under NDA
3. Introduction to the relevant product and engineering leads

**The upside:**
Every driver who uses EVA becomes harder to win back. The memory is the moat. The earlier an OEM partners, the deeper the data asset.

---

## Appendix — Technical Specifications

| Component | Technology | Notes |
|---|---|---|
| Reasoning model | Claude Sonnet (Anthropic) | Swappable via env var |
| Specialist model | Fine-tuned GPT-4o mini (OpenAI) | Intent + driver state extraction |
| ASR | OpenAI Realtime API | Conversation mode, semantic VAD |
| TTS | ElevenLabs Turbo v2.5 | Per-persona voice IDs, streaming |
| Memory store | Supabase (Postgres + pgvector) | 4-tier memory, vector retrieval |
| Vehicle data | SmartCar (EVA-1) → OEM direct (EVA-2) | VSS schema interface |
| ADAS mock | Custom VSS-schema WebSocket server | Swap for OEM ECU stream |
| Backend | Node.js + Hono | Deployable on Fly.io, Cloudflare, or OEM cloud |
| HAVMCO | Stub (EVA-1) → OEM SDK (EVA-2) | Tool interface unchanged |
| Ambient output | HAVMCO lighting/haptic channels | EVA-2 only |
| HUD / cluster | HAVMCO display channel | EVA-2 only |

---

*Last updated: working document. Not for external distribution without review.*
