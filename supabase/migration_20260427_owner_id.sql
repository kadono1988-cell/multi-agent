-- 2026-04-27 (Bundle 7): opt-in auth — record the owner of new rows
-- Stamping only; existing public RLS still allows anonymous read/write so
-- the app keeps working without sign-in. A future phase can flip RLS to
-- "auth.uid() = owner_id OR owner_id IS NULL" when private mode launches.

ALTER TABLE multi_agent.projects
  ADD COLUMN IF NOT EXISTS owner_id UUID;

ALTER TABLE multi_agent.decision_sessions
  ADD COLUMN IF NOT EXISTS owner_id UUID;

CREATE INDEX IF NOT EXISTS projects_owner_idx ON multi_agent.projects(owner_id);
CREATE INDEX IF NOT EXISTS sessions_owner_idx ON multi_agent.decision_sessions(owner_id);
