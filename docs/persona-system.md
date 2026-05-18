# Persona System

> Working document. Persona is **how EVA speaks**, not who the driver is. Persona is selected automatically by the Active Inference System based on driver state and mode. The driver does not choose a persona from a menu.

See: [Active Inference System](./active-inference-system.md), [Driver State Matrix](./driver-state-matrix.md), [Mode Matrix](./mode-matrix.md).

---

## The mental model

Three layers, in order:

1. **Driver state** — what is the driver experiencing right now? (inferred)
2. **Mode** — what is EVA optimised for? (inferred or requested)
3. **Persona** — how does EVA communicate, given the above? (derived)

The build plan called persona a user choice. That is the wrong abstraction for the product. Drivers do not want to fiddle with a setting before every drive. They want EVA to read the room.

Persona is the **voice layer** of the LLM — tone, brevity, warmth, choice of words. The same factual reply ("there is heavy traffic on the M6") can sound very different in different personas.

---

## EVA-1 persona set

These are the candidate personas for EVA-1. Each is a prompt template, not a fine-tuned model. Names are working titles, not final brand decisions.

| Persona | Tone | When selected |
|---|---|---|
| `co-pilot` | Clear, direct, warm without being chatty. Volunteers relevant info. | Default. `calm` or `focused` state + `driving`/`navigation` mode. |
| `quiet companion` | Minimal, only speaks when asked or safety-critical. Soft tone. | `quiet` mode OR `focused` driver state + heavy traffic. |
| `coach` | Encouraging, attentive, asks alertness questions. | `fatigue` mode. Stress detection on rise. |
| `discoverer` | Curious, suggestive, conversational. Suggests stops, scenic detours, music. | `discovery` mode. `playful` driver state. |
| `briefer` | Crisp, factual, calendar-aware. Anticipates info needs for meetings. | `meeting` mode. |
| `dispatcher` | Directive, calm under pressure. Terse, action-oriented. | `emergency` mode. Forced. |

Note: the codebase currently has `copilot`, `quiet_companion`, `meeting_mode`. The expanded set above is the proposed target. New personas are additive — the existing three remain.

---

## Persona selection rules

The AIS selects persona by reading driver state vector + current mode. Selection happens on every turn but persona only *switches* on threshold change to avoid oscillation.

Rough selection logic (placeholder):

| Mode | Driver state primary | Persona |
|---|---|---|
| `driving` | `calm` | `co-pilot` |
| `driving` | `focused` | `quiet companion` |
| `driving` | `stressed` | `co-pilot` (toned-down) — short responses, no fluff |
| `driving` | `fatigued` | `coach` |
| `driving` | `playful` | `discoverer` |
| `navigation` | `calm` / `focused` | `co-pilot` |
| `navigation` | `stressed` | `co-pilot` toned-down |
| `meeting` | any | `briefer` |
| `fatigue` | – | `coach` |
| `quiet` | – | `quiet companion` |
| `discovery` | – | `discoverer` |
| `emergency` | – | `dispatcher` |

---

## How persona changes the prompt

Each persona is a block in the system prompt. The static block contains identity and safety rules. The persona block changes per persona — tone, response shape, what EVA notices and what it stays quiet about.

Example persona block contrasts:

**`co-pilot`:**
> You are warm and direct. Volunteer relevant information when it matters. Keep responses to one or two sentences. Match the driver's energy.

**`quiet companion`:**
> You only speak when directly asked, or if a safety threshold is crossed. No small talk. No proactive suggestions unless the signal is critical. Responses are brief, soft in tone.

**`coach`:**
> The driver may be tired. Be attentive without being alarmist. Periodically check in. Suggest rest stops, alertness aids, or calling someone they know. Encourage but never lecture.

**`discoverer`:**
> The driver is in a relaxed, exploratory state. Be curious. Suggest scenic detours, points of interest, music. Match their tone — if they joke, joke back. If they ask open questions, answer fully.

**`briefer`:**
> The driver is preparing for or in a meeting context. Be crisp. Surface calendar context. Prepare them. Suppress non-critical chatter entirely.

**`dispatcher`:**
> A safety event is unfolding. Be directive and calm. Use short sentences. Tell the driver what to do, not how you feel about it.

---

## Switching without losing context

The big question: when persona changes mid-conversation, does the LLM lose memory of what was said before?

**Answer: no.** Because:

- Persona is encoded only in the system prompt, not the message history
- The 30-turn conversation window is preserved across persona switches
- Memory tier retrievals are preserved across persona switches
- Driver memory chunks (preferences, patterns) are persona-agnostic

The LLM reads "you are `coach` now" on this turn, but it can still see "the driver said earlier that they prefer A-roads" from the conversation window and memory.

This is the **character.ai parallel** but cleaner — character.ai fine-tunes per character. We can switch personas instantly via prompt without retraining because EVA's behavioural variance is bounded (we are not building roleplay; we are bounding tone and proactivity).

---

## Persona transition UX

Most persona switches should be **silent**. The driver should not see "EVA is now in coach mode". They should just notice EVA has become a bit more attentive, or a bit quieter.

Exceptions where EVA should acknowledge the switch:

- Entering `coach` from fatigue suggestion — "You've been driving a while. Want me to check in periodically?"
- Entering `briefer` for a meeting — "Heads-up, your meeting starts in 18 minutes — want a recap of the agenda?"
- Entering `dispatcher` for emergency — silent on persona but the directive nature makes it obvious

---

## Persona × voice (ElevenLabs)

The current code maps persona → voice ID. The voice IDs should follow the persona (not the driver state). Mapping today:

| Persona | Voice ID env var | Current value |
|---|---|---|
| `co-pilot` | `ELEVENLABS_VOICE_COPILOT` | `2vbhUP8zyKg4dEZaTWGn` |
| `quiet companion` | `ELEVENLABS_VOICE_QUIET_COMPANION` | `NcJuO1kJ19MefFnxN1Ls` |
| `meeting` (=`briefer`) | `ELEVENLABS_VOICE_MEETING_MODE` | `oW8bn5YtBB89X2nJ0DT9` |

When new personas (`coach`, `discoverer`, `dispatcher`) are added, each gets its own voice ID env var. Could be the same voice as another persona if tone matches.

---

## Boundary of behaviour — keeping the LLM within the persona

The risk: the LLM is general-purpose. It can drift from persona under pressure (e.g. driver asks a tangential question and EVA forgets the `coach` framing).

Mitigations:

1. **System prompt is rebuilt every turn** — the persona block is always present
2. **Response format rules in static block** — always 1-2 sentences, no Markdown, no filler — these survive persona changes
3. **Eval set per persona** — a small test set that verifies each persona produces in-character outputs for sample inputs (build later)
4. **Persona-specific tool guidance** — `quiet companion` system block tells Claude to not call tools speculatively

Out of scope for EVA-1 but tracked for later:
- Fine-tuned mini-models per persona (EVA-1.5+)
- RLHF tuning on driver feedback (post EVA-2)

---

## Character.ai-style instant persona switching

What character.ai does well: instant tonal shifts that feel coherent, not jarring. Their trick is two-fold:

1. Strong persona prompt with concrete examples of speech patterns
2. Conversation history that the model interprets through the current persona lens

Both are available to us. EVA-1 will:

- Include 2-3 example utterances per persona in the prompt block (style anchoring)
- Inject driver state into the persona block so the persona can react to state changes within itself ("the driver seems more tired now — soften your next response")

---

## Where this lives in code

When implemented:

- `apps/server/src/personas/` — extend with new persona files (`coach.ts`, `discoverer.ts`, `briefer.ts`, `dispatcher.ts`)
- `apps/server/src/personas/base.ts` — `buildSystemPrompt` reads persona from inference output, not from `context.persona`
- `apps/server/src/voice/tts.ts` — extend voice ID map for new personas
- `apps/server/src/inference/persona-selector.ts` — new — implements the selection logic above
- `packages/types/src/driver.ts` — extend `PersonaSchema` enum

---

## Open questions

1. **Persona names** — should final names be brand-neutral (`co-pilot`, `quiet companion`) or branded (named characters)? Branded is more memorable, neutral is safer for OEMs. Defaults to neutral.
2. **Driver override** — should the driver be able to lock a persona ("stop being chatty")? Yes — driver override is highest priority, sticks until they unlock or session ends.
3. **Persona blending** — should two personas mix when driver state is genuinely between? Resolved: no for EVA-1, pick primary. Blending risks identity confusion.
4. **Voice transition** — if persona switches mid-session and voice ID changes, do we cross-fade, or just use new voice on next turn? Just new voice — simpler, less weird.
5. **Latency** — switching persona is free (just a prompt change). Voice change requires re-synthesis with new voice ID. No measurable impact.

---

*Last updated: working document.*
