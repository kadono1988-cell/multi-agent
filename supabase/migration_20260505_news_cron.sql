-- News suggestions queue for weekly RSS cron
-- Source: docs/news_cron_design.md

CREATE TABLE IF NOT EXISTS multi_agent.news_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT UNIQUE NOT NULL,
  source_title TEXT NOT NULL,
  source_feed TEXT NOT NULL,
  source_published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  -- Gemini suggestTopicFromNews output
  suggested_theme TEXT,
  suggested_focus TEXT,
  suggested_summary TEXT,
  suggested_project JSONB,
  -- Status management
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  applied_to_project_id UUID REFERENCES multi_agent.projects(id),
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_suggestions_status ON multi_agent.news_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_news_suggestions_fetched ON multi_agent.news_suggestions(fetched_at DESC);

ALTER TABLE multi_agent.news_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read/write" ON multi_agent.news_suggestions;
CREATE POLICY "Public read/write" ON multi_agent.news_suggestions
  FOR ALL USING (true) WITH CHECK (true);
