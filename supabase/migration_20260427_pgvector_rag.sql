-- 2026-04-27: pgvector-backed smart RAG for reference_cases
-- Run after backfilling embeddings via scripts/backfill_case_embeddings.mjs.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE multi_agent.reference_cases
  ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

-- Cosine-similarity index. ivfflat with lists=10 is fine for 50–500 rows;
-- bump lists when the corpus grows (Supabase docs recommend rows/1000).
CREATE INDEX IF NOT EXISTS reference_cases_embedding_ivfflat
  ON multi_agent.reference_cases USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- RPC for the client to call from PostgREST.
CREATE OR REPLACE FUNCTION multi_agent.match_reference_cases(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  project_type TEXT,
  summary TEXT,
  outcome TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT id, title, project_type, summary, outcome,
         1 - (embedding <=> query_embedding) AS similarity
  FROM multi_agent.reference_cases
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION multi_agent.match_reference_cases(VECTOR, INT)
  TO anon, authenticated, service_role;
