-- Migration: 006_inferences
-- Active Inference System — inference audit log.
--
-- Every inference the engine produces is stored here with its evidence.
-- This is the auditability guarantee: any driver-state decision can be
-- traced back to the exact signals that supported it.
--
-- Inferences are higher-frequency and shorter-lived than memory_chunks,
-- hence a separate table with its own retention characteristics.
--
-- Apply after 005_smartcar_v3.sql.

create table inferences (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references users(id) on delete cascade,
  session_id     uuid references sessions(id) on delete set null,

  -- What kind of inference this is
  type           text not null,   -- driver_state | mode_suggestion | persona_recommendation | preference_pattern

  -- For driver_state: which state (fatigued, stressed, calm, ...)
  state          text,

  -- 0.0 - 1.0
  confidence     numeric not null check (confidence >= 0 and confidence <= 1),

  -- Array of evidence items: [{ source: "silo2.terseness", value: 0.8, detail: "..." }]
  evidence       jsonb not null default '[]',

  -- Which inference path produced this, and its version (paths are versioned
  -- so tuning a path is traceable in the audit log)
  path_id        text not null,
  path_version   text not null default 'v1',

  created_at     timestamptz not null default now(),

  -- When this inference should be considered decayed / stale
  expires_at     timestamptz,

  pii_class      text not null default 'personal'
);

create index inferences_user_session_idx on inferences (user_id, session_id, created_at desc);
create index inferences_type_state_idx on inferences (type, state, created_at desc);

-- RLS — service role only until auth is wired
alter table inferences enable row level security;
