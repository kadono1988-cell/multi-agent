-- 2026-04-27: persistence + feature columns for upcoming bundles
--   #9 Supabase complete restore: setup_context + current_round
--   #1 round-depth slider: max_rounds
--   #3 web grounding: grounding_enabled
--   #4 HITL gates: gate_responses
--   #5 AI meeting designer: meeting_design
--   #8 confidence labels: agent_messages.confidence

ALTER TABLE multi_agent.decision_sessions
  ADD COLUMN IF NOT EXISTS setup_context     JSONB,
  ADD COLUMN IF NOT EXISTS current_round     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_rounds        INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS grounding_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_design    JSONB,
  ADD COLUMN IF NOT EXISTS gate_responses    JSONB;

ALTER TABLE multi_agent.agent_messages
  ADD COLUMN IF NOT EXISTS confidence TEXT;
