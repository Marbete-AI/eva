-- Migration: 004_smartcar_tokens
-- SmartCar OAuth token storage.
-- Apply after 003_memory_candidates_and_event_log.sql.
-- Additive — no existing tables modified.

create table smartcar_tokens (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade unique,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now(),
  -- The SmartCar vehicle IDs associated with this user
  vehicle_ids   jsonb not null default '[]',
  pii_class     text not null default 'personal'
);

-- RLS — only service role can access (no user-facing policies until auth is wired)
alter table smartcar_tokens enable row level security;
