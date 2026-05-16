-- Migration: 003_memory_candidates_and_event_log
-- Tiered memory system tables.
-- Apply after 001_initial_schema.sql and 002_memory_search.sql.
-- All changes are additive — no existing tables are modified.

-- ── Event Log ─────────────────────────────────────────────────────────────────
-- Unified log of all significant input/output events across all signal sources.
-- Every event that can feed memory passes through here first.
-- The Tier 3 pattern analyser queries this table across event types.

create table event_log (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  session_id      uuid references sessions(id) on delete set null,

  -- Source type — what kind of event is this
  -- conversation | adas | vehicle_state | feedback | tool_result | route | calendar | system
  event_type      text not null,

  -- Full event payload — everything known at the time
  payload         jsonb not null,

  -- Lightweight summary for quick queries without deserialising payload
  summary         text,

  timestamp       timestamptz not null default now(),
  pii_class       text not null default 'personal',
  retention_days  int
);

create index event_log_user_type_idx on event_log(user_id, event_type);
create index event_log_session_idx on event_log(session_id);
create index event_log_timestamp_idx on event_log(timestamp desc);

-- ── Memory Candidates (Tier 1) ────────────────────────────────────────────────
-- Every potentially significant observation extracted from any event source.
-- Duplicates are intentional — stored as separate rows so the pattern
-- analyser can see frequency and trend. The analyser merges later.

create table memory_candidates (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  session_id          uuid references sessions(id) on delete set null,

  -- Category from the memory tier matrix
  -- identity | preference_routing | preference_audio | preference_communication |
  -- preference_climate | routine | relationship | emotional_state |
  -- behavioural_driving | behavioural_interaction | vehicle_state_pattern | health
  category            text not null,

  -- Normalised candidate text (third-person: "Driver's name is Jas")
  content             text not null,

  -- Extractor confidence 0.0–1.0
  confidence          float not null,

  -- Lifecycle status
  -- candidate | pending_confirmation | confirmed | rejected | expired
  status              text not null default 'candidate',

  -- How many times this observation has been seen (for duplicates)
  evidence_count      int not null default 1,

  -- The exact phrase, signal value, or event summary that triggered this
  evidence_quote      text,

  -- Array of quoted evidence from each observation
  evidence_quotes     jsonb not null default '[]',

  -- Source type: conversation | adas | vehicle_state | feedback | tool_result | route | calendar
  source_type         text not null,

  -- Linked source IDs (message_id, adas_event_id, feedback_id, tool_call_id, event_log_id)
  source_ids          jsonb not null default '{}',

  -- Full JSON payload of the source event
  raw_evidence        jsonb,

  -- Context snapshot at time of extraction — everything useful for later analysis
  context_snapshot    jsonb not null default '{}',
  -- Contains: session_mode, persona, vehicle_state (battery, range, speed, drive_mode),
  --           adas_metrics (harshBrakingScore, fatigueRisk, etc.),
  --           route_context (origin, destination, distance, duration if active),
  --           environment (weather, traffic), session_duration_min, time_of_day

  -- Extractor metadata
  extraction_metadata jsonb not null default '{}',
  -- Contains: extractor_model, extractor_version, prompt_version,
  --           extraction_rationale (not chain-of-thought — short explanation)

  -- Whether EVA should actively ask the driver about this
  suggest_confirmation boolean not null default false,

  -- If rejected: expiry timestamp (30 days from rejection)
  rejection_expires_at timestamptz,

  -- If promoted to Tier 2
  promoted_at         timestamptz,
  promoted_memory_id  uuid references memory_chunks(id) on delete set null,

  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  pii_class           text not null default 'personal',
  retention_days      int
);

create index memory_candidates_user_status_idx on memory_candidates(user_id, status);
create index memory_candidates_category_idx on memory_candidates(user_id, category);
create index memory_candidates_session_idx on memory_candidates(session_id);
create index memory_candidates_suggest_confirmation_idx
  on memory_candidates(user_id, suggest_confirmation)
  where suggest_confirmation = true and status = 'candidate';

-- ── Memory Confirmations ──────────────────────────────────────────────────────
-- Tracks every confirmation question EVA asked the driver and the outcome.
-- Backend-readable for analysis. Never exposed directly to the driver.

create table memory_confirmations (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  session_id          uuid references sessions(id) on delete set null,
  candidate_id        uuid not null references memory_candidates(id) on delete cascade,

  -- The question EVA asked
  question_text       text not null,

  -- The message_id of the EVA response that contained this question
  asked_in_message_id uuid references messages(id) on delete set null,

  -- Driver's response and outcome
  -- pending | accepted | rejected | unanswered | expired
  outcome             text not null default 'pending',
  driver_response     text,

  -- The message_id of the driver's response (if they answered)
  answered_in_message_id uuid references messages(id) on delete set null,

  asked_at            timestamptz not null default now(),
  answered_at         timestamptz,
  expires_at          timestamptz not null default (now() + interval '24 hours'),

  pii_class           text not null default 'personal'
);

create index memory_confirmations_user_pending_idx
  on memory_confirmations(user_id, outcome)
  where outcome = 'pending';

create index memory_confirmations_candidate_idx on memory_confirmations(candidate_id);

-- ── Behavioural Patterns (Tier 3) ─────────────────────────────────────────────
-- Cross-session, cross-input patterns detected by the session-end analyser.
-- Detected by correlating messages, adas_events, feedback, routing_history,
-- and event_log. Promoted to memory_chunks when confidence exceeds threshold.

create table behavioural_patterns (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,

  -- Pattern type — dot-separated: domain.subtype
  -- e.g. routine.commute | driving_style.harsh_braker | interaction.prefers_brief |
  --      range_anxiety.below_30_percent | audio.weekday_morning
  pattern_type    text not null,

  -- Human-readable pattern description (used if promoted to Tier 2)
  description     text not null,

  -- All evidence that contributed to this pattern detection
  evidence        jsonb not null default '[]',

  -- Detection confidence 0.0–1.0
  confidence      float not null,

  -- How many separate sessions contributed evidence
  session_count   int not null default 1,

  -- Total evidence events (ADAS events, turns, feedback events, etc.)
  evidence_count  int not null default 1,

  -- If promoted to Tier 2
  promoted_at     timestamptz,
  promoted_memory_id uuid references memory_chunks(id) on delete set null,

  first_detected_at timestamptz not null default now(),
  last_updated_at   timestamptz not null default now(),

  pii_class       text not null default 'personal'
);

create index behavioural_patterns_user_idx on behavioural_patterns(user_id);
create index behavioural_patterns_type_idx on behavioural_patterns(user_id, pattern_type);

-- ── Routing History ───────────────────────────────────────────────────────────
-- Every route query and outcome. Used by the Tier 3 analyser to detect
-- routing preferences and routines.

create table routing_history (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  session_id      uuid references sessions(id) on delete set null,

  origin          text,
  destination     text,
  -- Route actually taken (if known)
  route_summary   text,
  distance_km     float,
  duration_min    int,
  -- Was there a traffic delay? How much?
  traffic_delay_min int,
  -- Time of day as hour (0–23) for time-of-day pattern detection
  hour_of_day     int,
  day_of_week     int, -- 0 = Sunday

  timestamp       timestamptz not null default now(),
  pii_class       text not null default 'personal',
  retention_days  int
);

create index routing_history_user_idx on routing_history(user_id);
create index routing_history_destination_idx on routing_history(user_id, destination);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Enable RLS on new tables — policies added in migration 004 with auth.

alter table event_log            enable row level security;
alter table memory_candidates    enable row level security;
alter table memory_confirmations enable row level security;
alter table behavioural_patterns enable row level security;
alter table routing_history      enable row level security;
