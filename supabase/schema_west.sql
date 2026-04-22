-- Multi-Agent Discussion - Supabase West schema (multi_agent namespace)
-- Adapted from schema.sql: moved all tables into multi_agent schema, merged migration_add_project_fields.sql,
-- removed pgvector dependency (MVP uses keyword match for RAG).

CREATE SCHEMA IF NOT EXISTS multi_agent;

-- 1. Projects
CREATE TABLE IF NOT EXISTS multi_agent.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT,
    client_type TEXT,
    contract_type TEXT,
    strategic_importance TEXT CHECK (strategic_importance IN ('low', 'medium', 'high')),
    summary TEXT,
    client TEXT,
    duration TEXT,
    size TEXT,
    budget TEXT,
    building_usage TEXT,
    location TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decision sessions
CREATE TABLE IF NOT EXISTS multi_agent.decision_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES multi_agent.projects(id) ON DELETE CASCADE,
    theme_type TEXT NOT NULL CHECK (theme_type IN ('delay', 'go_no_go', 'design_change')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agent messages
CREATE TABLE IF NOT EXISTS multi_agent.agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES multi_agent.decision_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    agent_role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Information requests
CREATE TABLE IF NOT EXISTS multi_agent.information_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES multi_agent.decision_sessions(id) ON DELETE CASCADE,
    requested_by_agent TEXT,
    content TEXT NOT NULL,
    importance TEXT CHECK (importance IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Information responses
CREATE TABLE IF NOT EXISTS multi_agent.information_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES multi_agent.decision_sessions(id) ON DELETE CASCADE,
    request_id UUID REFERENCES multi_agent.information_requests(id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Final decision memos
CREATE TABLE IF NOT EXISTS multi_agent.final_decision_memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES multi_agent.decision_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    confidence_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Reference cases (RAG source)
CREATE TABLE IF NOT EXISTS multi_agent.reference_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    project_type TEXT,
    summary TEXT,
    outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Reference case chunks (optional granular retrieval, embedding column skipped for MVP)
CREATE TABLE IF NOT EXISTS multi_agent.reference_case_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES multi_agent.reference_cases(id) ON DELETE CASCADE,
    chunk_type TEXT CHECK (chunk_type IN ('overview', 'finance', 'contract', 'execution', 'outcome', 'lesson')),
    content TEXT NOT NULL
);

-- 9. Expert agents (customizable team)
CREATE TABLE IF NOT EXISTS multi_agent.expert_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    style TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: MVP public read/write (same as original schema.sql policy, reapplied per table)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'multi_agent' LOOP
    EXECUTE format('ALTER TABLE multi_agent.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public read/write" ON multi_agent.%I;', t);
    EXECUTE format('CREATE POLICY "Public read/write" ON multi_agent.%I FOR ALL USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- Grants for PostgREST (anon / authenticated / service_role)
GRANT USAGE ON SCHEMA multi_agent TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA multi_agent TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA multi_agent TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA multi_agent GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA multi_agent GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
