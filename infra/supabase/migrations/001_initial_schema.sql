-- EVA-1 Initial Schema
-- Migration: 001_initial_schema
-- Status: STUB — not yet applied. Apply once Supabase project is created.
--
-- To apply:
--   supabase db push
-- Or via Supabase dashboard > SQL editor.
--
-- Data classification columns are included on every table from day one.
-- This allows OEM-specific retention policies to be applied without schema rewrites.

-- ── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ── Users ─────────────────────────────────────────────────────────────────────

create table users (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique,
  created_at    timestamptz not null default now(),
  -- Preferences: persona, asr_mode, output_mode, etc.
  preferences   jsonb not null default '{}',
  -- Data classification
  pii_class     text not null default 'personal',   -- personal | anonymised | aggregated
  consent_flags jsonb not null default '{}',         -- e.g. {"store_adas": true, "store_voice": true}
  retention_days int                                  -- null = keep indefinitely until OEM policy set
);

-- ── Vehicles ──────────────────────────────────────────────────────────────────

create table vehicles (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users(id) on delete cascade,
  smartcar_id       text,                             -- SmartCar vehicle ID
  make              text,
  model             text,
  year              int,
  width_mm          int,                              -- Including mirrors — used for gap estimation
  created_at        timestamptz not null default now(),
  pii_class         text not null default 'personal',
  retention_days    int
);

-- ── Sessions ─────────────────────────────────────────────────────────────────

create table sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  mode          text not null default 'driving',       -- driving | meeting | fatigue | navigation
  persona       text not null default 'copilot',       -- copilot | quiet_companion | meeting_mode
  pii_class     text not null default 'personal',
  retention_days int
);

-- ── Messages ─────────────────────────────────────────────────────────────────

create table messages (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references sessions(id) on delete cascade,
  role          text not null,                        -- user | assistant | tool
  content       text,
  tool_calls    jsonb,                               -- Structured tool call records
  timestamp     timestamptz not null default now(),
  pii_class     text not null default 'personal',
  retention_days int
);

-- ── ADAS Events (raw VSS signals — never labelled) ────────────────────────────

create table adas_events (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references sessions(id) on delete cascade,
  -- signals: array of VssSignal objects — raw values, no event labels
  signals       jsonb not null,
  -- interpreted_metrics: InterpretedMetrics output — stored for analysis
  interpreted_metrics jsonb,
  timestamp     timestamptz not null default now(),
  -- ADAS data is generally less sensitive than conversation
  pii_class     text not null default 'vehicle_telemetry',
  retention_days int
);

-- ── UTA Feedback ──────────────────────────────────────────────────────────────

create table feedback (
  id                  uuid primary key default uuid_generate_v4(),
  session_id          uuid not null references sessions(id) on delete cascade,
  message_id          uuid references messages(id) on delete set null,
  -- type: thumbs_up | thumbs_down | voice_correction | voice_positive
  type                text not null,
  -- value: free text for voice corrections/positives
  value               text,
  timestamp           timestamptz not null default now(),
  pii_class           text not null default 'personal',
  retention_days      int
);

-- ── Memory Chunks (pgvector) ──────────────────────────────────────────────────

create table memory_chunks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  content       text not null,
  -- 1536-dimensional embedding (OpenAI text-embedding-3-small or similar)
  embedding     vector(1536),
  -- source: conversation | feedback | adas_event | explicit_preference
  source        text not null,
  -- Recency-decayed relevance weight, 0.0–1.0
  weight        float not null default 1.0,
  created_at    timestamptz not null default now(),
  pii_class     text not null default 'personal',
  retention_days int
);

-- Vector similarity index for memory retrieval
create index memory_chunks_embedding_idx
  on memory_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── HAVMCO Dispatch Log (stub in EVA-1 — training data for EVA-2) ─────────────

create table havmco_dispatches (
  id                  uuid primary key default uuid_generate_v4(),
  session_id          uuid not null references sessions(id) on delete cascade,
  -- What triggered the dispatch (derived metric name + value)
  trigger_event       jsonb not null,
  -- Which HAVMCO channel: haptic | audio | visual | mechanical | climate | olfed
  type                text not null,
  intensity           float not null,
  duration_ms         int not null,
  -- Whether the driver gave feedback on this dispatch
  driver_feedback_id  uuid references feedback(id) on delete set null,
  timestamp           timestamptz not null default now(),
  pii_class           text not null default 'vehicle_telemetry',
  retention_days      int
);

-- ── Row Level Security (placeholder — configure after Supabase auth setup) ────

alter table users           enable row level security;
alter table vehicles        enable row level security;
alter table sessions        enable row level security;
alter table messages        enable row level security;
alter table adas_events     enable row level security;
alter table feedback        enable row level security;
alter table memory_chunks   enable row level security;
alter table havmco_dispatches enable row level security;

-- Policies will be added in migration 002 once auth is configured.
-- Placeholder: only service role can access all tables until policies are set.
