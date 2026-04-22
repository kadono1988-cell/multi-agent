import { supabase } from './supabase';

export const DEFAULT_AGENTS = {
  PM: {
    id: 'PM',
    name: "現場プロジェクトマネージャー (PM)",
    description: "現場の実行可能性、スケジュールの遅延、リソース配分、安全面にフォーカスします。理論よりも現場の現実を重視します。",
    style: "現実的で、時に批判的。具体的な現場の制約を強調する。",
    is_active: true
  },
  CFO: {
    id: 'CFO',
    name: "現場財務責任者 (CFO)",
    description: "コスト効率、キャッシュフロー、財務的なダウンサイドリスクにフォーカスします。追加費用に対して非常に慎重です。",
    style: "分析的で慎重。ROIや予算超過の可能性を厳しく指摘する。",
    is_active: true
  },
  COO: {
    id: 'COO',
    name: "運営責任者 (COO)",
    description: "契約上の義務、クライアント（発注者）との関係、長期的なブランド価値と法的リスクにフォーカスします。",
    style: "戦略的で協調的。ステークホルダー管理と契約遵守を重視する。",
    is_active: true
  },
  CEO: {
    id: 'CEO',
    name: "最高経営責任者 (CEO)",
    description: "全エージェントの意見を統合し、全社的な視点で最終判断を下します。不足している情報の特定も行います。",
    style: "決断力があり、バランス重視。要点を簡潔にまとめ、アクションプランを提示する。",
    is_active: true
  }
};

export const loadAgents = async () => {
  try {
    const { data, error } = await supabase.from('expert_agents').select('*').order('created_at');
    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('expert_agents');
      return local ? JSON.parse(local) : DEFAULT_AGENTS;
    }
    // Convert array to object
    return data.reduce((acc, curr) => {
      acc[curr.agent_id] = {
        ...curr,
        id: curr.agent_id // for UI
      };
      return acc;
    }, {});
  } catch (e) {
    const local = localStorage.getItem('expert_agents');
    return local ? JSON.parse(local) : DEFAULT_AGENTS;
  }
};

export const saveAgentToStorage = async (agent) => {
  // Sync to localStorage
  const current = await loadAgents();
  current[agent.id] = agent;
  localStorage.setItem('expert_agents', JSON.stringify(current));

  try {
    const dbData = {
      agent_id: agent.id,
      name: agent.name,
      description: agent.description,
      style: agent.style,
      is_active: agent.is_active
    };
    await supabase.from('expert_agents').upsert(dbData, { onConflict: 'agent_id' });
  } catch (e) {
    console.warn("Supabase Sync Failed, using local only");
  }
  return current;
};

export const deleteAgentFromStorage = async (agentId) => {
  const current = await loadAgents();
  delete current[agentId];
  localStorage.setItem('expert_agents', JSON.stringify(current));
  
  try {
    await supabase.from('expert_agents').delete().eq('agent_id', agentId);
  } catch (e) {}
  return current;
};
