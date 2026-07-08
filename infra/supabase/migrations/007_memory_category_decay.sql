-- Migration: 007_memory_category_decay
-- Real-world memory decay: category-aware half-lives.
--
-- Problem: memory_chunks had no category column — the category assigned at
-- extraction (memory_candidates.category) was lost at promotion. All memories
-- decayed at a single 7-day half-life, which makes confirmed preferences
-- nearly irrelevant within a month for a participant driving 2-3x/week,
-- while transient emotional states lingered too long.
--
-- This migration:
--   - Adds category to memory_chunks (carried through from candidates)
--   - Adds last_reinforced_at — decay restarts when a memory is re-observed
--     or re-confirmed, so reinforced memories stay fresh
--
-- Apply after 006_inferences.sql.

alter table memory_chunks
  add column if not exists category text,
  add column if not exists last_reinforced_at timestamptz;

-- Backfill: existing chunks decay from creation until reinforced
update memory_chunks
  set last_reinforced_at = created_at
  where last_reinforced_at is null;

create index if not exists memory_chunks_category_idx on memory_chunks (user_id, category);
