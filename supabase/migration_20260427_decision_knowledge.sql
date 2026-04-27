-- 2026-04-27 (Bundle 6): decision-memo embeddings for cross-project recall
ALTER TABLE multi_agent.decision_sessions
  ADD COLUMN IF NOT EXISTS decision_summary  TEXT,
  ADD COLUMN IF NOT EXISTS summary_embedding VECTOR(768);

CREATE INDEX IF NOT EXISTS decision_sessions_emb_ivfflat
  ON multi_agent.decision_sessions USING ivfflat (summary_embedding vector_cosine_ops)
  WITH (lists = 5);

CREATE OR REPLACE FUNCTION multi_agent.match_past_decisions(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 3,
  exclude_session UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  theme_type TEXT,
  decision_summary TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT id, project_id, theme_type, decision_summary,
         1 - (summary_embedding <=> query_embedding) AS similarity,
         created_at
  FROM multi_agent.decision_sessions
  WHERE summary_embedding IS NOT NULL
    AND status = 'completed'
    AND (exclude_session IS NULL OR id <> exclude_session)
  ORDER BY summary_embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION multi_agent.match_past_decisions(VECTOR, INT, UUID)
  TO anon, authenticated, service_role;
