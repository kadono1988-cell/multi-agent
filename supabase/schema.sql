-- 🧠 Construction Multi-Agent Decision System - Supabase Schema (MVP v0.1)

-- 0. Enable Vector Extension (RAG用)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT, -- Residential, Commercial, Infrastructure, etc.
    client_type TEXT,
    contract_type TEXT,
    strategic_importance TEXT CHECK (strategic_importance IN ('low', 'medium', 'high')),
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decision Sessions
CREATE TABLE IF NOT EXISTS decision_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    theme_type TEXT NOT NULL CHECK (theme_type IN ('delay', 'go_no_go', 'design_change')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agent Messages (The core discussion)
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES decision_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    agent_role TEXT NOT NULL CHECK (agent_role IN ('PM', 'CFO', 'COO', 'CEO')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Information Requests (Missing info identification)
CREATE TABLE IF NOT EXISTS information_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES decision_sessions(id) ON DELETE CASCADE,
    requested_by_agent TEXT,
    content TEXT NOT NULL,
    importance TEXT CHECK (importance IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Information Responses (User input)
CREATE TABLE IF NOT EXISTS information_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES decision_sessions(id) ON DELETE CASCADE,
    request_id UUID REFERENCES information_requests(id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Final Decision Memos
CREATE TABLE IF NOT EXISTS final_decision_memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES decision_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    confidence_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Reference Cases (RAG Source)
CREATE TABLE IF NOT EXISTS reference_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    project_type TEXT,
    summary TEXT,
    outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Reference Case Chunks (For granular retrieval)
CREATE TABLE IF NOT EXISTS reference_case_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES reference_cases(id) ON DELETE CASCADE,
    chunk_type TEXT CHECK (chunk_type IN ('overview', 'finance', 'contract', 'execution', 'outcome', 'lesson')),
    content TEXT NOT NULL,
    embedding VECTOR(1536) -- Optional: for pgvector usage if enabled
);

-- Enable RLS (Row Level Security) - Simplified for MVP
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON projects FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE decision_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON decision_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON agent_messages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE information_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON information_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE information_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON information_responses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE final_decision_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON final_decision_memos FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE reference_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON reference_cases FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE reference_case_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON reference_case_chunks FOR ALL USING (true) WITH CHECK (true);

-- 9. Expert Agents (Customizable team)
CREATE TABLE IF NOT EXISTS expert_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT UNIQUE NOT NULL, -- e.g. 'PM', 'CFO'
    name TEXT NOT NULL,
    description TEXT,
    style TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expert_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON expert_agents FOR ALL USING (true) WITH CHECK (true);
