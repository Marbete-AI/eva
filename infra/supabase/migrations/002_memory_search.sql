-- Migration: 002_memory_search
-- Adds pgvector similarity search function for memory retrieval.
-- Apply after 001_initial_schema.sql.

-- Hybrid retrieval function: returns memory chunks by vector similarity
-- for a given user. Re-ranking (recency * weight) is done in application code.
create or replace function match_memory_chunks(
  query_embedding vector(1536),
  query_user_id  uuid,
  match_count     int default 15
)
returns table (
  id          uuid,
  content     text,
  source      text,
  weight      float,
  created_at  timestamptz,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    mc.id,
    mc.content,
    mc.source,
    mc.weight,
    mc.created_at,
    1 - (mc.embedding <=> query_embedding) as similarity
  from memory_chunks mc
  where mc.user_id = query_user_id
    and mc.embedding is not null
  order by mc.embedding <=> query_embedding
  limit match_count;
end;
$$;
