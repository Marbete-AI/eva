-- Migration: 005_smartcar_v3
-- Update smartcar_tokens table for SmartCar v3 API.
--
-- SmartCar v3 uses application-level OAuth (client_credentials) rather than
-- per-user tokens. The callback no longer provides access/refresh tokens.
-- Instead we store the SmartCar user_id and use it as the sc-user-id header
-- on all API requests alongside a short-lived application-level Bearer token.
--
-- This migration:
--   - Adds smartcar_user_id column
--   - Drops the old token columns (no longer needed)
--
-- Apply after 004_smartcar_tokens.sql.

-- Add SmartCar user ID column
alter table smartcar_tokens
  add column if not exists smartcar_user_id text;

-- Drop old per-user token columns (no longer used in v3)
alter table smartcar_tokens
  drop column if exists access_token,
  drop column if exists refresh_token,
  drop column if exists expires_at,
  drop column if exists vehicle_ids;

-- smartcar_user_id is required for connected users going forward
-- Existing rows (if any) will have null smartcar_user_id — they are stale
-- and will be treated as disconnected until the user reconnects.
