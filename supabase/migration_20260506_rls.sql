-- 2026-05-06: RLS Phase 1 (Option A — owner-aware, backwards-compatible)
--
-- Policy design:
--   owner_id IS NULL  → public row, anyone can read/write (existing anon usage)
--   owner_id = UUID   → private row, only that authenticated user can access
--
-- Tables with owner semantics: projects, decision_sessions
-- All other tables: fully open (RLS enabled but USING true to preserve current behaviour)
--
-- This migration does NOT break existing anonymous usage.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. projects
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON multi_agent.projects
  FOR SELECT USING (owner_id IS NULL OR auth.uid() = owner_id);

CREATE POLICY "projects_insert" ON multi_agent.projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "projects_update" ON multi_agent.projects
  FOR UPDATE USING (owner_id IS NULL OR auth.uid() = owner_id);

CREATE POLICY "projects_delete" ON multi_agent.projects
  FOR DELETE USING (owner_id IS NULL OR auth.uid() = owner_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. decision_sessions
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.decision_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON multi_agent.decision_sessions
  FOR SELECT USING (owner_id IS NULL OR auth.uid() = owner_id);

CREATE POLICY "sessions_insert" ON multi_agent.decision_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "sessions_update" ON multi_agent.decision_sessions
  FOR UPDATE USING (owner_id IS NULL OR auth.uid() = owner_id);

CREATE POLICY "sessions_delete" ON multi_agent.decision_sessions
  FOR DELETE USING (owner_id IS NULL OR auth.uid() = owner_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. agent_messages  (AI-generated, no owner — always open)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_all" ON multi_agent.agent_messages FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. reference_cases / reference_case_chunks  (case library — fully open)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.reference_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_cases_all" ON multi_agent.reference_cases FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE multi_agent.reference_case_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_chunks_all" ON multi_agent.reference_case_chunks FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. expert_agents  (agent roster — read-only from client)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.expert_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_select" ON multi_agent.expert_agents FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. rag_documents / rag_chunks  (RAG library — anon reads + is_active toggle)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.rag_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rag_docs_select" ON multi_agent.rag_documents FOR SELECT USING (true);
CREATE POLICY "rag_docs_update" ON multi_agent.rag_documents FOR UPDATE USING (true);

ALTER TABLE multi_agent.rag_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rag_chunks_select" ON multi_agent.rag_chunks FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. news_suggestions  (news pipeline — fully open)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.news_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_all" ON multi_agent.news_suggestions FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. final_decision_memos / information_requests / information_responses
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE multi_agent.final_decision_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memos_all" ON multi_agent.final_decision_memos FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE multi_agent.information_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "info_req_all" ON multi_agent.information_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE multi_agent.information_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "info_res_all" ON multi_agent.information_responses FOR ALL USING (true) WITH CHECK (true);
