# EVA Memory Tier Matrix

*Reference document. Captures design decisions as agreed in session.*
*Last updated: May 2026*

---

## Overview

EVA's memory system is tiered. The tiers serve different purposes and operate on different timescales. A 10-turn or even 30-turn context window is for immediate conversational continuity only — it cannot detect repeated behaviour across trips. Behaviour patterns require a separate observation and promotion pipeline.

The key design principle: **store everything, surface selectively**. Every turn, ADAS event, vehicle state change, feedback event, and tool output is logged. What reaches Claude's prompt is a filtered, tiered subset.

---

## The Four Tiers

### Tier 0 — Conversation Window

**Purpose:** In-session conversational coherence.

**What it contains:** The last N turns of the current session (user messages + EVA responses).

**Live prompt window:** 30 turns (configurable via `CONVERSATION_WINDOW_TURNS` env var).

**Analysis window:** 100 turns — used by the async memory extractor and session-end pattern analyser. Not injected into every live response.

**Storage:** `messages` table (full log, no TTL by default — apply retention policy per OEM preference).

**Decay:** Rolling window. Oldest turns drop off the live prompt as new ones arrive. Full log stays in DB.

**EVA uses this for:** Following up on what was just said, correcting itself, not asking the same question twice, understanding "that" refers to what.

---

### Tier 1 — Memory Candidates

**Purpose:** Capture everything that could matter, before deciding whether it does.

**What it contains:** Every potentially significant observation extracted from conversation turns, ADAS events, vehicle state changes, feedback, and tool outputs. Duplicates are intentional — stored as separate rows so the pattern analyser can see frequency and trend.

**Storage:** `memory_candidates` table.

**Status lifecycle:**
```
candidate → pending_confirmation → confirmed → promoted (→ Tier 2)
                                             → rejected (kept 30 days)
```

**Key design decisions from session:**
- Duplicates are always stored as separate rows. The analyser merges them and uses the duplication as signal.
- When a candidate is rejected, it is kept for 30 days as a rejection bank entry.
- If new evidence arrives that matches a rejected candidate, the candidate is revived to `candidate` status.
- If the driver explicitly provides the same information later, it is promoted even if a prior rejection exists.
- Every Tier 1 entry stores full metadata from the source event (see Metadata section below).

**Extraction trigger:** Async, after every assistant turn. Does not block the response to the driver.

**What triggers a Tier 1 entry:**
- Driver mentions anything about identity, preferences, relationships, routines, health
- ADAS threshold crossed + driver reaction observed
- Driver gives feedback (thumbs up/down, voice correction, voice positive)
- Driver asks the same type of question multiple times in one session
- Tool result reveals significant context (e.g. route taken, calendar event, playlist)
- EVA notices a behavioural signal (same route, same timing, same request pattern)

---

### Tier 2 — Confirmed Memory

**Purpose:** Facts and preferences EVA actively uses in every response.

**What it contains:** Promoted candidates that have been confirmed (by driver, by repetition, or by direct high-confidence statement).

**Storage:** `memory_chunks` table (existing). Retrieved via hybrid search (vector similarity + recency decay + weight) on every prompt.

**Promotion sources:**
- Direct high-confidence statement (single-shot: "my name is Jas", "I drive a Model 3")
- Driver confirms a Tier 1 candidate via EVA's discreet confirmation prompt
- Tier 1 candidate reaches its repetition threshold automatically
- Tier 3 behavioural pattern reaches confidence threshold

**EVA uses this for:** Personalising responses, routing decisions, communication style, HAVMCO calibration, fatigue response bias, meeting mode context.

**Weight decay:** Recency-weighted. Older memories decay unless reinforced. Explicit preferences (high weight) decay slower. Session-scoped emotions (low weight) decay fast.

---

### Tier 3 — Behavioural Patterns

**Purpose:** Cross-session, cross-input patterns that cannot be seen in a single session.

**What it contains:** Patterns detected by the session-end analyser across `messages`, `memory_candidates`, `adas_events`, `feedback`, `routing_history`, and `event_log`.

**Storage:** `behavioural_patterns` table.

**Detection trigger:** Session end + optional scheduled job.

**Examples:**
- "Driver tends to harsh-brake when running late" (ADAS + calendar + routing)
- "Driver rejects proactive alerts longer than 2 sentences" (feedback + message length)
- "Driver asks about range below 30% battery in every session" (vehicle state + message pattern)
- "Driver prefers Radio 4 on weekday morning motorway drives" (audio + route + time)
- "Driver fatigue signals increase significantly after 90 minutes of driving" (ADAS over time)

**Promotion:** When pattern confidence exceeds threshold, auto-promote to Tier 2 as a `memory_chunk` with source `adas_event` or `feedback`.

---

## Memory Categories

| Category | Examples | Promotion Threshold | Notes |
|---|---|---|---|
| `identity` | Name, vehicle, occupation, hometown | 1 direct mention (confidence >= 0.8) or 1 confirmation | Single most important category |
| `preference_routing` | Fast routes, hates motorways, prefers scenic | 1 explicit preference or 2 consistent observations | Affects every navigation response |
| `preference_audio` | Radio 2, no podcasts, specific playlists | 1 explicit preference or 2 observations | |
| `preference_communication` | Short answers, less proactive, formal tone | 1 explicit correction or 2 feedback events | Also informs HAVMCO intensity |
| `preference_climate` | Likes 21C, always cold, hates air con | 1 explicit preference or 2 observations | HAVMCO climate channel in EVA-2 |
| `routine` | Commute M6 8am, school run 3pm, regular route | 3 observations across 2 sessions | Session time + route + repeat required |
| `relationship` | Partner name, kids ages, close contacts for fatigue trigger | 1 direct mention or confirmation | Feeds the "phone a friend" fatigue feature |
| `emotional_state` | Tired today, stressed about meeting, happy | Session-scoped unless pattern (3+ sessions) | Short TTL unless repeated |
| `behavioural_driving` | Harsh braking tendency, calm driver, late braker | 5 ADAS observations across 2 sessions | From signal interpreter, not conversation |
| `behavioural_interaction` | Thumbs down on long responses, rarely uses PTT | 3 feedback events or 3 usage pattern observations | Informs persona tuning |
| `vehicle_state_pattern` | Charges to 80%, range anxiety below 30% | 2 observations | Useful for proactive range warnings |
| `health` | Needs glasses for night, fatigue after 2h, back pain | 1 direct mention or confirmation | Sensitive — high PII class |

Thresholds are intentionally aggressive. The rejection bank and confirmation system are the guard rails against false memory, not conservative thresholds.

---

## Confirmation Policy

**Setting:** Active — EVA asks when it has good reason to.

**Never ask during:**
- Active ADAS threshold triggers
- Safety warnings in progress
- Navigation urgency (less than X minutes from junction)
- Fatigue mode
- First 2 minutes of a session

**Ask at:**
- End of a natural response where the driver is not mid-task
- After the driver has already been chatty/relaxed in this session

**Format — discreet, not robotic:**

Good:
> "I'll keep that in mind for future drives, unless you'd rather I don't."
> "Should I treat that as your usual preference?"
> "Sounds like that's typically how you do it — want me to remember that?"

Bad:
> "Should I remember this information?"
> "Do you want me to store that?"

**Rate limit:** One confirmation question per EVA response. Minimum 2-minute cooldown between confirmation questions regardless of response count.

**Persona rules:**
- Co-pilot mode: ask freely within the policy above
- Quiet Companion mode: only ask if driver is already talking about the topic
- Meeting Mode: no confirmation questions — driver is busy

**Backend visibility:** All confirmation prompts, driver responses, and outcomes are logged in `memory_confirmations` with timestamps and full candidate reference.

---

## Rejection Bank

- Rejected candidates kept for 30 days with status `rejected`
- Not re-asked within 30 days unless:
  - New evidence matching the rejected candidate arrives (confidence >= 0.6)
  - Driver explicitly volunteers the same information
- On revival, a new duplicate candidate is created. The rejection is preserved for analyser visibility.
- After 30 days, status moves to `expired`. Row is kept for audit trail but not used in analysis.

---

## Metadata Stored on Every Tier 1 Entry

When anything hits Tier 1, the following context is stored alongside the candidate:

```
Core:
  id, user_id, session_id, category, content, confidence, status

Evidence:
  evidence_quote       The exact phrase, signal value, or event summary that triggered this
  source_type          conversation | adas | vehicle_state | feedback | tool_result | route | calendar
  source_ids           Linked message_id, adas_event_id, feedback_id, tool_call_id etc.
  raw_evidence         Full JSON payload of the source event

Context at time of extraction:
  session_mode         driving | meeting | fatigue | navigation
  persona              copilot | quiet_companion | meeting_mode
  vehicle_state        battery, range, speed, drive mode at time of event
  adas_metrics         harshBrakingScore, fatigueRisk, lateralStabilityScore, etc.
  route_context        origin, destination, distance, duration if active
  environment          weather condition, temperature, traffic summary
  session_duration_min How long the session had been running
  time_of_day          ISO timestamp

Extractor metadata:
  extractor_model      Model used for extraction (e.g. claude-sonnet-4-5)
  extractor_version    Prompt template version
  extraction_rationale Short explanation of why this was extracted (not chain-of-thought)
  suggest_confirmation Whether EVA should actively ask the driver about this

Lifecycle:
  created_at, last_seen_at, evidence_count
  rejection_expires_at (if rejected, 30 days from rejection)
  promoted_at, promoted_memory_id (if promoted to Tier 2)
```

---

## Event Log

A unified log of all significant input/output events across all signal sources. Everything that can feed memory should first pass through the event log.

**Tables that feed it:**
- `messages` (conversation turns)
- `adas_events` (raw signals + interpreted metrics)
- `feedback` (UTA thumbs, voice corrections)
- Tool calls and results
- Vehicle state changes (battery drops, mode changes)
- Route queries and outcomes

**Why:** Cross-modal pattern detection requires correlating events across different source types. The event log gives the Tier 3 analyser a single queryable surface.

---

## Cross-Input Pattern Detection (Tier 3)

You raised this as crucial. The memory system is not just about what the driver says. It must track:

- ADAS patterns (harsh braking frequency, fatigue signals, lane departure)
- Vehicle usage patterns (charging habits, range anxiety triggers, drive mode preference)
- Interaction patterns (thumbs down frequency, UTA usage rate, response length preference)
- Temporal patterns (time-of-day, day-of-week, session length)
- Correlation patterns (does harsh braking increase when EVA gives long alerts?)

The Tier 3 analyser runs at session end and optionally on a schedule. It looks at all event log entries for the user and computes pattern confidence. When a pattern crosses its threshold, it is promoted to Tier 2.

This is the data asset that compounds over time. After 20 sessions, EVA should know the driver better than any assistant they have ever used.

---

## Implementation Status

| Phase | Commit | Status |
|---|---|---|
| Persistent driverId on mobile (AsyncStorage) | 1 | Pending |
| Write messages table on every turn | 1 | Pending |
| 30-turn live prompt window | 1 | Pending |
| Migration 003 (new tables) | 2 | Pending |
| Async post-turn passive memory extractor | 3 | Pending |
| Active confirmation queue + rejection bank | 4 | Pending |
| Session-end pattern analyser (Tier 3) | 5 | Pending |
| Backend memory debug endpoint | 4 | Pending |
| Scheduled pattern analysis job | 5 | Pending |

---

## Open Items / Future Decisions

- **Retention policy:** Default to no TTL on messages. OEM preference will constrain this later. Likely to be `MESSAGES_RETENTION_DAYS` env var.
- **PII handling:** `health` category entries need higher PII classification. Consent flag `store_health` should gate these writes.
- **Memory recovery on reinstall:** No recovery for anonymous users by design. Google Sign-In (Week 3) ties UUID to Google account, enabling recovery on reinstall.
- **"What do you know about me?" tool:** Driver can ask EVA what it has stored. EVA reads Tier 2 confirmed memory and summarises it naturally. Not a dump — a natural language summary. Planned for Week 7.
- **HAVMCO calibration from memory:** Tier 2 preferences (preference_climate, preference_communication) should inform HAVMCO dispatch intensity. Wired in EVA-2 when HAVMCO is real.
- **Scheduled vs session-end analysis:** Session-end analysis is fine for EVA-1. Scheduled job (e.g. daily 3am) becomes relevant when users have many sessions per day.
- **Embedding memory candidates:** Not all candidates need embedding — only the ones that get promoted to Tier 2. Avoids paying embedding cost for candidates that get rejected.

---

*This document should be updated as decisions are made. Do not delete earlier decisions — mark them as superseded with a note.*
