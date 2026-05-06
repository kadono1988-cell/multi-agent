-- RAG Documents: tracks which PDF files have been ingested
CREATE TABLE IF NOT EXISTS multi_agent.rag_documents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name    TEXT NOT NULL UNIQUE,
  source_type  TEXT NOT NULL,
  period       TEXT,
  file_path    TEXT,
  chunk_count  INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  ingested_at  TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- RAG Chunks: actual content blocks with embeddings
CREATE TABLE IF NOT EXISTS multi_agent.rag_chunks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id   UUID REFERENCES multi_agent.rag_documents(id) ON DELETE CASCADE,
  section_title TEXT,
  page_hint     TEXT,
  content       TEXT NOT NULL,
  embedding     VECTOR(768),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ivfflat index for cosine similarity search
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
  ON multi_agent.rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- RPC: semantic search across Kajima docs with metadata
CREATE OR REPLACE FUNCTION multi_agent.match_kajima_docs(
  query_embedding VECTOR(768),
  match_count     INT DEFAULT 5
) RETURNS TABLE (
  id            UUID,
  document_id   UUID,
  section_title TEXT,
  page_hint     TEXT,
  content       TEXT,
  source_type   TEXT,
  period        TEXT,
  file_name     TEXT,
  similarity    FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    rc.id,
    rc.document_id,
    rc.section_title,
    rc.page_hint,
    rc.content,
    rd.source_type,
    rd.period,
    rd.file_name,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM multi_agent.rag_chunks rc
  JOIN multi_agent.rag_documents rd ON rd.id = rc.document_id
  WHERE rd.is_active = true
    AND rc.embedding IS NOT NULL
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
$$;
