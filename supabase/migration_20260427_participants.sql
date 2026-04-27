-- 2026-04-27 (Bundle 5): per-session participant list + agent type tag
ALTER TABLE multi_agent.expert_agents
  ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'internal'
  CHECK (agent_type IN ('internal', 'external'));

ALTER TABLE multi_agent.decision_sessions
  ADD COLUMN IF NOT EXISTS participants JSONB;
