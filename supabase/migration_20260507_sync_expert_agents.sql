-- Sync expert_agents to 20-agent roster (Bundle 11 reduction from 52 → 20)

-- 1. Remove the 32 deleted agents
DELETE FROM multi_agent.expert_agents
WHERE agent_id IN (
  'T1_CTO', 'T1_VICE_PRES',
  'T2_CIVIL_DIV', 'T2_DESIGN', 'T2_DEV_DIV', 'T2_ENG_DIV', 'T2_HR',
  'T2_INTL_DIV', 'T2_PROCUREMENT', 'T2_PROD_TECH',
  'T3_AUDIT', 'T3_COMPLIANCE', 'T3_INTL_LEGAL', 'T3_IP', 'T3_IT',
  'T3_PR_IR', 'T3_QA', 'T3_SAFETY_ENV', 'T3_SUBSIDIARY',
  'T4_BIM', 'T4_COMPETITOR', 'T4_CONSTR_MGR', 'T4_DESIGNER',
  'T4_ECONOMIST', 'T4_FIELD_PROC', 'T4_MARKET_RESEARCH',
  'T4_REGULATORY', 'T4_SITE_MGR',
  'EXT_LEGAL', 'EXT_ENV', 'EXT_INSURANCE', 'EXT_BUILDING_CODE'
);

-- 2. Insert 5 new agents
INSERT INTO multi_agent.expert_agents
  (agent_id, name, tier, department, sub_role, agent_type, is_active)
VALUES
  ('T2_ESTIMATION', '積算・見積担当部長',           2, 'Estimation',    'cost_estimation', 'internal', true),
  ('T2_ASSET',      'アセット・ソリューション本部 担当部長', 2, 'AssetSolution', 'real_estate_dev', 'internal', true),
  ('T3_TECH_RESEARCH', '技術研究所 研究員',          3, 'TechResearch',  'rd_researcher',   'internal', true),
  ('T3_AFTERCARE',  'アフターサービス担当',           3, 'AfterCare',     'maintenance',     'internal', true),
  ('EXT_CLIENT',    '発注者プロジェクト担当',         4, 'External',      'client_pm',       'external', false)
ON CONFLICT (agent_id) DO NOTHING;
