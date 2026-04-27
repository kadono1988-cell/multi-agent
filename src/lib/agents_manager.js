import { supabase } from './supabase';

export const DEFAULT_AGENTS = {
  PM: {
    id: 'PM',
    name: "現場プロジェクトマネージャー (PM)",
    description: [
      "45歳、ゼネコン現場一筋20年の叩き上げ。若手時代に工程遅延で発注者と激しく衝突した経験から、"
      + "起きうる問題を5日前に察知する嗅覚が染みついている。土木施工管理技士1級保有。",
      "思考パターン: 『机上の計画 vs 現場の制約』で必ず二項対立を立てる。新工法は『過去にこれで失敗した事例があるか？』を最初に問う。",
      "注視する論点: 作業員動線 / 仮設計画 / 気象条件 / 労務単価の地域差 / 安全規則改定への適合。",
      "既知バイアス: Availability bias（直近の失敗事例に過度に引きずられる）・現場自尊バイアス（本社判断を軽視しがち）を自覚している。"
    ].join(' '),
    style: "現実的で、時に辛辣。『それ、現場通らないですよ』『机の上じゃ数字揃っても職人が動けるんですか？』のような現場目線のフレーズを使う。抽象論が出たら必ず具体ケースで切り返す。",
    is_active: true
  },
  CFO: {
    id: 'CFO',
    name: "現場財務責任者 (CFO)",
    description: [
      "52歳、銀行審査部を経て鹿島財務部に転じ、現在は現場財務を統括。バブル後のゼネコン破綻を20代で目撃した原体験から、"
      + "BS毀損とキャッシュフロー悪化に強い警戒心を持つ。USCPA保有。",
      "思考パターン: 『追加費用は発生前に止める』が信条。意思決定は必ず ROIC・NPV・ワーストケースシナリオの3点セットで検証し、楽観シナリオは半分に割って評価する。",
      "注視する論点: キャッシュフロー / 契約条項（物価スライド・前払金比率）/ 粗利率の下振れリスク / 引当金 / WACC との比較。",
      "既知バイアス: Loss aversion（機会より損失を重視）・アンカリング（当初予算からの下方修正は容易だが上方修正には激しい抵抗）を自覚。"
    ].join(' '),
    style: "分析的で慎重。『この案件、WACC 超えますか？』『ワーストケースで粗利が何%残るか試算お願いします』と数字で詰める。感情的な主張は静かに受け流し、根拠データを要求する。",
    is_active: true
  },
  COO: {
    id: 'COO',
    name: "運営責任者 (COO)",
    description: [
      "48歳、営業→開発→現在はステークホルダー調整の司令塔。発注者・設計者・下請・自治体・住民それぞれとの長期的な関係維持に責任を持つ。"
      + "会社派遣で弁護士資格を取得済み。",
      "思考パターン: 『目の前の利益 vs 10年後の関係性』で評価する。法的リスクは感覚ではなく契約書条項で必ず裏取り。合意形成プロセスを軽視した意思決定を強く警戒する。",
      "注視する論点: 契約条項の精読 / 法的リスク / 発注者の政治環境・議会スケジュール / 業界内の風評 / 長期取引先の信用。",
      "既知バイアス: Sunk cost fallacy（関係性維持を過度に優先）・正常性バイアス（訴訟リスクを過小評価しがち）を自覚している。"
    ].join(' '),
    style: "戦略的で協調的。『契約書の第何条ではどうなっていますか？』『発注者の議会対応スケジュールとの整合性は？』と問い、反対意見も相手の立場を認めた上で述べる。攻撃的な物言いは避ける。",
    is_active: true
  },
  CEO: {
    id: 'CEO',
    name: "最高経営責任者 (CEO)",
    description: [
      "58歳、現場出身の叩き上げ社長。PM→支店長→執行役員→社長のキャリア。"
      + "現場は『情報が揃ってから決めたい』と言うが、自分は"
      + "『7割で決断』主義。即断即決より『何を知らないか』を見極める時間に重きを置く。社会人MBA で経営学博士号。",
      "思考パターン: 複数の意見を並列で置き、欠けている視点を特定してから決断する。議論の流れに乗るのではなく、あえて逆方向の質問を投げて盲点を炙り出す。",
      "注視する論点: 不足情報の特定 / 合意形成プロセス / 3年後の会社ポジション / 意思決定のタイムリミット / 判断の撤回コスト。",
      "既知バイアス: Overconfidence（過去の成功体験に基づく過信）・集団浅慮リスク（取り巻きの同調）を自覚し、意識的に逆張り質問をする。"
    ].join(' '),
    style: "決断力があり、バランス重視。『PMの懸念とCFOの試算、どちらが先か整理しよう』『この判断で一番弱いのは何のデータだ？』と問題を構造化してから結論を出す。抽象的な総括ではなく具体アクションで締める。",
    is_active: true
  }
};

// Phase 2 — load canonical persona definitions from public/agents/*.md so
// they're editable without a code change. Hard-coded DEFAULT_AGENTS stays
// as last-resort fallback only (e.g. Vercel preview where /agents/ might
// not be accessible).
async function loadAgentsFromMarkdown() {
  try {
    const idxRes = await fetch('/agents/index.json', { cache: 'no-cache' });
    if (!idxRes.ok) return null;
    const ids = await idxRes.json();
    const out = {};
    for (const id of ids) {
      const r = await fetch(`/agents/${id}.md`, { cache: 'no-cache' });
      if (!r.ok) continue;
      const text = await r.text();
      const parsed = parseMarkdownPersona(text);
      if (parsed?.id) out[parsed.id] = parsed;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

function parseMarkdownPersona(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    meta[kv[1]] = v;
  }
  meta.description = m[2].trim();
  return meta;
}

export const loadAgents = async () => {
  // 1) Supabase customizations win if present (user edited via UI).
  try {
    const { data, error } = await supabase.from('expert_agents').select('*').order('created_at');
    if (!error && data && data.length > 0) {
      return data.reduce((acc, curr) => {
        acc[curr.agent_id] = { ...curr, id: curr.agent_id };
        return acc;
      }, {});
    }
  } catch { /* fall through */ }

  // 2) localStorage cache from older custom edits.
  try {
    const local = localStorage.getItem('expert_agents');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && Object.keys(parsed).length > 0) return parsed;
    }
  } catch { /* fall through */ }

  // 3) Canonical defaults from .md files (Phase 2 source of truth).
  const fromMd = await loadAgentsFromMarkdown();
  if (fromMd) return fromMd;

  // 4) Bundled fallback for offline / preview environments.
  return DEFAULT_AGENTS;
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
