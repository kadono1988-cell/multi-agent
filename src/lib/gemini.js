import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from './supabase';
import { DEFAULT_AGENTS } from './agents_manager';

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "placeholder";
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

const MODEL_NAME = "gemini-2.5-flash-lite";

export const AGENT_ROLES = DEFAULT_AGENTS;

const BREVITY_INSTRUCTION = "\n【重要】回答は簡潔にまとめてください。各セクションは最大3つの箇条書きとし、全体で500文字程度に収めてください。";
const CONFIDENCE_INSTRUCTION = "\n【確信度の付記】回答の最終行に必ず `[確信度: 高]` `[確信度: 中]` `[確信度: 低]` のいずれかを単独で付けてください。判断材料が十分なら高、不確実性が大きければ低を選ぶこと。";

// ── Shared helpers ────────────────────────────────────────────────────────────

async function embedQuery(text) {
  if (!text) return null;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const res = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    });
    return res.embedding?.values || null;
  } catch (err) {
    console.warn('[Gemini] embedQuery failed, falling back to keyword:', err?.message || err);
    return null;
  }
}

async function fetchRAGContext(project) {
  try {
    // 1) Vector similarity search via pgvector RPC (preferred)
    const queryText = [project.name, project.summary, project.building_usage, project.remarks]
      .filter(Boolean).join('\n');
    const queryVec = await embedQuery(queryText);

    let cases = null;
    if (queryVec) {
      const { data, error } = await supabase.rpc('match_reference_cases', {
        query_embedding: queryVec,
        match_count: 3,
      });
      if (!error && data && data.length > 0) cases = data;
    }

    // 2) Keyword fallback if vector path produced nothing
    if (!cases) {
      const keywords = (project.summary || '').split(/[、\s。]/).filter(w => w.length > 1);
      const { data: kw } = await supabase
        .from('reference_cases')
        .select('*')
        .or(`summary.ilike.%${keywords[0] || ''}%,title.ilike.%${keywords[0] || ''}%`)
        .limit(3);
      cases = kw;
    }

    // 3) Last-resort generic sample so prompts still have something
    if (!cases || cases.length === 0) {
      const { data: any } = await supabase.from('reference_cases').select('*').limit(3);
      cases = any || [];
    }

    const ragContext = cases.length > 0
      ? cases.map(c => `【参考事例: ${c.title}】\n概要: ${c.summary}\n結果: ${c.outcome}`).join('\n\n')
      : '特になし';

    return { cases, ragContext };
  } catch {
    return { cases: [], ragContext: '特になし' };
  }
}

function buildAgentPrompt(agentKey, session, project, roundNumber, previousMessages, setupContext, roles, cases, ragContext, roundType = null) {
  const role = roles[agentKey];

  const projectDetails = `
    【プロジェクト詳細データ】
    - 施主: ${project.client || '未設定'}
    - 場所: ${project.location || '未設定'}
    - 工期: ${project.duration || '未設定'}
    - 予算: ${project.budget || '未設定'}
    - 規模: ${project.size || '未設定'}
    - 用途: ${project.building_usage || '未設定'}
    - 備考: ${project.remarks || '特になし'}
  `;

  const sessionDetails = `
    【今回の相談コンテキスト】
    - 相談内容: ${setupContext?.user_context || '未設定'}
    - 制約条件: ${setupContext?.constraints || '未設定'}
    - 目標ゴール: ${setupContext?.goal || '未設定'}${
      setupContext?.focus_points
        ? `\n    - 特に重視してほしい視点 (論点設定): ${setupContext.focus_points}`
        : ''
    }${
      setupContext?.prfaq
        ? `\n    【PRFAQ - プロジェクト完成時のニュース記事想定】\n${setupContext.prfaq}`
        : ''
    }
  `;

  // Focus points は全ラウンドで一貫した視点注入として systemInstruction にも注入する
  const focusInjection = setupContext?.focus_points
    ? `\n【重視すべき視点】今回の議論では特に「${setupContext.focus_points}」の観点を織り込んで発言してください。`
    : '';

  let prompt = '';
  let systemInstruction = `あなたは建設会社の${role.name}です。${role.description} スタイル：${role.style}${focusInjection}`;

  // Map round → prompt template. Prefer explicit roundType (Bundle 2);
  // fall back to legacy round-number mapping for older callers.
  const type = roundType || legacyRoundType(roundNumber);

  if (type === 'initial') {
    prompt = `プロジェクト「${project.name}」に関する意思決定議論を開始します。
テーマ：${session.theme_type}
${projectDetails}
プロジェクト概要：${project.summary || '未設定'}
${sessionDetails}
【過去の類似事例】
${ragContext}

出力内容：
1. 現状の理解${cases?.length > 0 ? ` [事例: ${cases[0].title}] を踏まえた分析` : ''}
2. 主要な論点
3. 推奨するアプローチ
4. 潜在的リスク
※過去事例が参考になる場合は、必ず名称を挙げて引用してください。
${BREVITY_INSTRUCTION}${CONFIDENCE_INSTRUCTION}`;

  } else if (type === 'feedback') {
    const prevRoundMessages = previousMessages.map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    systemInstruction += `。他のメンバーと矛盾点や甘い見積もりを指摘してください。`;
    prompt = `他のメンバーの意見を聞いて、以下の議論を深めてください。
これまでの議論：
${prevRoundMessages}

出力内容：
1. 他のメンバーへのフィードバック
2. 自身の提案の修正・強化
3. 反論に対する再反論
※「PMさんの懸念については…」のように他メンバーの意見を直接引用してください。
${BREVITY_INSTRUCTION}${CONFIDENCE_INSTRUCTION}`;

  } else if (type === 'ceo_check') {
    const prevRoundMessages = previousMessages.map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    systemInstruction = `あなたは建設会社の${role.name}です。経営層として不足情報の特定に集中してください。`;
    prompt = `専門家たちの議論を読み、意思決定のために不足している情報を最大3つ特定してください。
これまでの議論：
${prevRoundMessages}

出力内容：
1. 議論のサマリー
2. 不足している具体的情報 (Top 3)
3. その理由
${BREVITY_INSTRUCTION}${CONFIDENCE_INSTRUCTION}`;

  } else if (type === 'final_views') {
    const userInputs = previousMessages.filter(m => m.agent_role === 'USER').map(m => m.content).join('\n');
    const prevRoundMessages = previousMessages.filter(m => m.agent_role !== 'USER').map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    prompt = `【ユーザーからの追加情報】
${userInputs || '（情報提供なし）'}

【これまでの議論】
${prevRoundMessages}

上記を踏まえ、専門家として最終的な見解を述べてください。
${BREVITY_INSTRUCTION}${CONFIDENCE_INSTRUCTION}`;

  } else if (type === 'ceo_final') {
    const allDiscussion = previousMessages.map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    prompt = `【全ラウンドの議論】
${allDiscussion}

上記を総括し、CEOとして最終的な決定を下してください。
1. 最終決定
2. 判断の根拠
3. 実行に向けた具体的指示
${BREVITY_INSTRUCTION}${CONFIDENCE_INSTRUCTION}`;

  } else if (type === 'follow_up') {
    // After the final CEO decision, the user asks "what if X?". Every active
    // agent (incl. CEO) responds once with the new condition factored in.
    const userQuestion = [...previousMessages].reverse().find(m => m.agent_role === 'USER')?.content || '';
    const allDiscussion = previousMessages.filter(m => m.agent_role !== 'USER').map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    prompt = `【追加の問いかけ (ユーザーから)】
${userQuestion}

【これまでの全議論】
${allDiscussion}

この追加条件を踏まえて、当初の決定をどう修正・補強すべきか、あなたの専門領域から一言で述べてください。元の結論を変える必要があれば明記してください。
${BREVITY_INSTRUCTION}${CONFIDENCE_INSTRUCTION}`;
  }

  return { prompt, systemInstruction };
}

function legacyRoundType(round) {
  // Preserve old hardcoded R1-R5 mapping for any caller that hasn't migrated.
  if (round === 1) return 'initial';
  if (round === 2) return 'feedback';
  if (round === 3) return 'ceo_check';
  if (round === 4) return 'final_views';
  if (round === 5) return 'ceo_final';
  return 'feedback';
}

// Parse `[確信度: 高/中/低]` (or English variants) from response trailing line.
// Returns { confidence: 'high'|'medium'|'low'|null, cleaned: string }.
export function extractConfidence(content) {
  if (!content) return { confidence: null, cleaned: content };
  const re = /\[?\s*確信度\s*[:：]\s*(高|中|低)\s*\]?\s*$/m;
  const enRe = /\[?\s*confidence\s*[:：]\s*(high|medium|low)\s*\]?\s*$/im;
  const m = content.match(re);
  if (m) {
    const map = { '高': 'high', '中': 'medium', '低': 'low' };
    return { confidence: map[m[1]], cleaned: content.replace(re, '').trimEnd() };
  }
  const m2 = content.match(enRe);
  if (m2) {
    return { confidence: m2[1].toLowerCase(), cleaned: content.replace(enRe, '').trimEnd() };
  }
  return { confidence: null, cleaned: content };
}

// ── Non-streaming (fallback / REST) ──────────────────────────────────────────

async function callGemini(prompt, systemInstruction, retryCount = 0) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }]
      })
    });

    const data = await response.json();
    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    if ((response.status === 429 || response.status === 503) && retryCount < 2) {
      await new Promise(r => setTimeout(r, 3000 * (retryCount + 1)));
      return callGemini(prompt, systemInstruction, retryCount + 1);
    }
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  } catch (error) {
    if (retryCount < 2 && error.message?.includes("quota")) {
      await new Promise(r => setTimeout(r, 5000));
      return callGemini(prompt, systemInstruction, retryCount + 1);
    }
    console.error("Gemini API Error:", error);
    return `【エラー】AIとの通信に失敗しました。理由: ${error.message}`;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const generateAgentResponse = async (
  agentKey, session, project, roundNumber,
  previousMessages = [], setupContext = {}, customAgents = null,
  roundType = null
) => {
  const roles = customAgents || AGENT_ROLES;
  if (!roles[agentKey]) return null;

  const { cases, ragContext } = await fetchRAGContext(project);
  const { prompt, systemInstruction } = buildAgentPrompt(
    agentKey, session, project, roundNumber, previousMessages, setupContext, roles, cases, ragContext, roundType
  );

  const content = await callGemini(prompt, systemInstruction);
  return { role: agentKey, content };
};

// ── Live discussion summary ──────────────────────────────────────────────────
// Quick TLDR of the discussion so far. Used by the right-side panel during
// an active session. Cheap prompt — can be called after each round.

export const summarizeProgress = async ({ messages, locale = 'ja' }) => {
  if (!messages || messages.length === 0) return null;
  const transcript = messages
    .map(m => `[R${m.round_number}] ${m.agent_role}: ${(m.content || '').slice(0, 600)}`)
    .join('\n\n');
  const langInstruction = locale === 'en' ? 'Reply in English.' : 'すべて日本語で。';

  const prompt = `次のマルチエージェント議論ログを読み、現在の状態を3つのトピックで簡潔に要約してください。各トピックは2文以内・全体200字以内。

【ログ】
${transcript}

【出力 (このスキーマ厳守・JSONのみ)】
{
  "current_focus": "今まさに焦点になっている論点",
  "tentative_agreements": "暫定合意 (なければ『なし』)",
  "open_tensions": "対立・未解決 (なければ『なし』)"
}

${langInstruction}`;

  try {
    const raw = await callGemini(prompt, 'あなたは建設会社の議事録要約担当です。');
    const parsed = extractJsonObject(raw);
    if (!parsed) return null;
    return {
      current_focus: parsed.current_focus || '',
      tentative_agreements: parsed.tentative_agreements || '',
      open_tensions: parsed.open_tensions || '',
    };
  } catch (err) {
    console.warn('[Gemini] summarizeProgress failed:', err?.message || err);
    return null;
  }
};

// ── AI meeting designer ──────────────────────────────────────────────────────
// Reads the project brief and returns a suggested meeting plan that the user
// can edit before pressing "Start". Returns null on any failure so the UI can
// silently fall back to manual setup.

export const suggestMeetingDesign = async ({ project, agents, locale = 'ja' }) => {
  if (!project?.name) return null;

  const agentList = Object.keys(agents || {})
    .filter(k => agents[k]?.is_active)
    .map(k => `${k} (${agents[k].name})`).join(', ') || 'PM, CFO, COO, CEO';

  const langInstruction = locale === 'en'
    ? 'Write all values in English.'
    : 'すべての値を日本語で記述してください。';

  const prompt = `次のプロジェクトについて、4エージェント (${agentList}) で行う意思決定議論の最適な設計をJSONのみで提案してください。${langInstruction}

【プロジェクト】
名称: ${project.name}
施主: ${project.client || '未設定'}
予算: ${project.budget || '未設定'}
工期: ${project.duration || '未設定'}
規模: ${project.size || '未設定'}
用途: ${project.building_usage || '未設定'}
場所: ${project.location || '未設定'}
備考: ${project.remarks || '特になし'}
概要: ${project.summary || '未設定'}

【出力JSON (このスキーマ厳守・他の文字列を一切出力しない)】
{
  "recommended_theme": "delay | go_no_go | design_change のいずれか、もしくは独自テーマを文字列で",
  "recommended_rounds": 3 | 5 | 7 のいずれか,
  "focus_points": "特に重視すべき視点を1-2文で",
  "key_risks": ["想定される主要リスクを最大4件、各40字以内"],
  "missing_information": ["事前に揃えておくべき情報を最大3件、各40字以内"],
  "estimated_minutes": 議論完了に必要な目安分数 (整数)
}`;

  const systemInstruction = `あなたは建設プロジェクトの意思決定をデザインするファシリテータです。${langInstruction}`;

  try {
    const raw = await callGemini(prompt, systemInstruction);
    const parsed = extractJsonObject(raw);
    if (!parsed) return null;
    return {
      recommended_theme: parsed.recommended_theme || '',
      recommended_rounds: [3, 5, 7].includes(parsed.recommended_rounds) ? parsed.recommended_rounds : 5,
      focus_points: parsed.focus_points || '',
      key_risks: Array.isArray(parsed.key_risks) ? parsed.key_risks : [],
      missing_information: Array.isArray(parsed.missing_information) ? parsed.missing_information : [],
      estimated_minutes: typeof parsed.estimated_minutes === 'number' ? parsed.estimated_minutes : null,
    };
  } catch (err) {
    console.warn('[Gemini] suggestMeetingDesign failed:', err?.message || err);
    return null;
  }
};

// ── Decision-memo synthesizer ────────────────────────────────────────────────
// Reads the entire transcript and returns a structured report for the PDF.
// Returns null on failure so the caller can fall back to a transcript-only PDF.

function extractJsonObject(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const synthesizeDecisionMemo = async ({
  project, session, messages, setupContext, locale = 'ja'
}) => {
  if (!messages || messages.length === 0) return null;

  const transcript = messages
    .map(m => `[Round ${m.round_number}] ${m.agent_role}:\n${m.content}`)
    .join('\n\n');

  const projectBlock = `プロジェクト名: ${project?.name || '未設定'}
施主: ${project?.client || '未設定'}
予算: ${project?.budget || '未設定'}
テーマ: ${session?.theme_type || '未設定'}
概要: ${project?.summary || '未設定'}`;

  const setupBlock = setupContext ? [
    setupContext.user_context && `相談内容: ${setupContext.user_context}`,
    setupContext.constraints && `制約条件: ${setupContext.constraints}`,
    setupContext.goal && `目標ゴール: ${setupContext.goal}`,
    setupContext.focus_points && `論点設定: ${setupContext.focus_points}`,
    setupContext.prfaq && `PRFAQ: ${setupContext.prfaq}`,
  ].filter(Boolean).join('\n') : '';

  const langInstruction = locale === 'en'
    ? 'Write all values in English.'
    : 'すべての値を日本語で記述してください。';

  const systemInstruction = `あなたは建設プロジェクトの意思決定議事録を構造化するアナリストです。
複数の専門家エージェント (PM/CFO/COO/CEO 等) と、必要に応じてユーザー (USER) の発言を読み解き、
意思決定のためのレポートに再構成してください。事実関係を捏造せず、議論で実際に出た内容のみを抽出します。
${langInstruction}`;

  const prompt = `以下は建設プロジェクトに関する複数エージェントの議論ログです。これを「エグゼクティブ向け意思決定メモ」に再構成し、JSONのみを出力してください。

【プロジェクト情報】
${projectBlock}

${setupBlock ? `【セットアップコンテキスト】\n${setupBlock}\n` : ''}
【議論ログ (全Round)】
${transcript}

【出力フォーマット (このJSONスキーマ厳守・他の文字列を一切出力しない)】
{
  "executive_summary": "意思決定の概要を3-5文で。背景・主要論点・到達結論を含める。",
  "conclusion": "最終的にどう決まったかを1-2文で簡潔に。未確定なら『未確定: 理由』形式。",
  "discussion_points": ["議論された主要論点を箇条書き(最大6件)。各40字以内。"],
  "agreements": ["エージェント間で合意に至った事項(最大5件)。なければ空配列。"],
  "disagreements": ["対立・未解決として残った論点(最大5件)。各論点に立場の違いも含める。なければ空配列。"],
  "final_decision": {
    "headline": "最終決定の一言要約。未確定なら『判断保留』。",
    "rationale": ["判断根拠を箇条書き(最大4件)。"]
  },
  "action_items": [
    { "owner": "PM", "task": "具体的な実行タスク", "due": "期限が明示されていれば記入、なければ空文字" }
  ]
}

注意:
- "owner" は議論に登場した役職名 (PM / CFO / COO / CEO / USER 等) かフリーテキスト
- action_items は最大8件、議論で実際に指示された内容のみ
- 議論が短い/未完結の場合でも、空配列や『未確定』表現で必ずこのスキーマを満たす
- JSON以外の前置きや解説を絶対に書かない`;

  try {
    const raw = await callGemini(prompt, systemInstruction);
    const parsed = extractJsonObject(raw);
    if (!parsed) return null;
    return {
      executive_summary: parsed.executive_summary || '',
      conclusion: parsed.conclusion || '',
      discussion_points: Array.isArray(parsed.discussion_points) ? parsed.discussion_points : [],
      agreements: Array.isArray(parsed.agreements) ? parsed.agreements : [],
      disagreements: Array.isArray(parsed.disagreements) ? parsed.disagreements : [],
      final_decision: {
        headline: parsed.final_decision?.headline || '',
        rationale: Array.isArray(parsed.final_decision?.rationale) ? parsed.final_decision.rationale : [],
      },
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.map(a => ({
            owner: a.owner || '',
            task: a.task || '',
            due: a.due || '',
          }))
        : [],
    };
  } catch (err) {
    console.warn('[Gemini] synthesizeDecisionMemo failed:', err?.message || err);
    return null;
  }
};

/**
 * Streaming version using the Gemini SDK.
 * `onChunk(partialText)` is called incrementally as text arrives.
 * Falls back to non-streaming if the SDK stream fails.
 */
export const generateAgentResponseStream = async (
  agentKey, session, project, roundNumber,
  previousMessages = [], setupContext = {}, customAgents = null,
  onChunk, roundType = null, grounding = false
) => {
  const roles = customAgents || AGENT_ROLES;
  if (!roles[agentKey]) return null;

  const { cases, ragContext } = await fetchRAGContext(project);
  const { prompt, systemInstruction } = buildAgentPrompt(
    agentKey, session, project, roundNumber, previousMessages, setupContext, roles, cases, ragContext, roundType
  );

  // Web grounding: only enable on rounds where fresh facts move the needle
  // (initial framing + final-views recap). Mid-discussion is RAG-only.
  const useGrounding = grounding && (roundType === 'initial' || roundType === 'final_views');

  try {
    const modelOptions = { model: MODEL_NAME, systemInstruction };
    if (useGrounding) {
      modelOptions.tools = [{ googleSearch: {} }];
    }
    const model = genAI.getGenerativeModel(modelOptions);

    const result = await model.generateContentStream(prompt);

    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      if (onChunk) onChunk(fullText);
    }

    return { role: agentKey, content: fullText };
  } catch (streamError) {
    // Graceful fallback to non-streaming REST call
    console.warn(`[Gemini] Streaming failed (${streamError.message}), falling back to REST.`);
    const content = await callGemini(prompt, systemInstruction);
    if (onChunk) onChunk(content);
    return { role: agentKey, content };
  }
};
