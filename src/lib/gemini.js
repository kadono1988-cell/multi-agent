import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from './supabase';
import { DEFAULT_AGENTS } from './agents_manager';

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "placeholder";
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

const MODEL_NAME = "gemini-2.5-flash-lite";

export const AGENT_ROLES = DEFAULT_AGENTS;

const BREVITY_INSTRUCTION = "\n【重要】回答は簡潔にまとめてください。各セクションは最大3つの箇条書きとし、全体で500文字程度に収めてください。";

// ── Shared helpers ────────────────────────────────────────────────────────────

async function fetchRAGContext(project) {
  try {
    const keywords = (project.summary || '').split(/[、\s。]/).filter(w => w.length > 1);
    let { data: cases } = await supabase
      .from('reference_cases')
      .select('*')
      .or(`summary.ilike.%${keywords[0] || ''}%,title.ilike.%${keywords[0] || ''}%`)
      .limit(3);

    if (!cases || cases.length === 0) {
      const { data: fallback } = await supabase.from('reference_cases').select('*').limit(3);
      cases = fallback || [];
    }

    const ragContext = cases.length > 0
      ? cases.map(c => `【参考事例: ${c.title}】\n概要: ${c.summary}\n結果: ${c.outcome}`).join('\n\n')
      : '特になし';

    return { cases, ragContext };
  } catch {
    return { cases: [], ragContext: '特になし' };
  }
}

function buildAgentPrompt(agentKey, session, project, roundNumber, previousMessages, setupContext, roles, cases, ragContext) {
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

  if (roundNumber === 1) {
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
${BREVITY_INSTRUCTION}`;

  } else if (roundNumber === 2) {
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
${BREVITY_INSTRUCTION}`;

  } else if (roundNumber === 3) {
    const prevRoundMessages = previousMessages.map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    systemInstruction = `あなたは建設会社の${role.name}です。経営層として不足情報の特定に集中してください。`;
    prompt = `専門家たちの議論を読み、意思決定のために不足している情報を最大3つ特定してください。
これまでの議論：
${prevRoundMessages}

出力内容：
1. 議論のサマリー
2. 不足している具体的情報 (Top 3)
3. その理由
${BREVITY_INSTRUCTION}`;

  } else if (roundNumber === 4) {
    const userInputs = previousMessages.filter(m => m.agent_role === 'USER').map(m => m.content).join('\n');
    const prevRoundMessages = previousMessages.filter(m => m.agent_role !== 'USER').map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    prompt = `【ユーザーからの追加情報】
${userInputs || '（情報提供なし）'}

【これまでの議論】
${prevRoundMessages}

上記を踏まえ、専門家として最終的な見解を述べてください。
${BREVITY_INSTRUCTION}`;

  } else if (roundNumber === 5) {
    const allDiscussion = previousMessages.map(m => `${m.agent_role}: ${m.content}`).join('\n\n');
    prompt = `【全ラウンドの議論】
${allDiscussion}

上記を総括し、CEOとして最終的な決定を下してください。
1. 最終決定
2. 判断の根拠
3. 実行に向けた具体的指示
${BREVITY_INSTRUCTION}`;
  }

  return { prompt, systemInstruction };
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
  previousMessages = [], setupContext = {}, customAgents = null
) => {
  const roles = customAgents || AGENT_ROLES;
  if (!roles[agentKey]) return null;

  const { cases, ragContext } = await fetchRAGContext(project);
  const { prompt, systemInstruction } = buildAgentPrompt(
    agentKey, session, project, roundNumber, previousMessages, setupContext, roles, cases, ragContext
  );

  const content = await callGemini(prompt, systemInstruction);
  return { role: agentKey, content };
};

/**
 * Streaming version using the Gemini SDK.
 * `onChunk(partialText)` is called incrementally as text arrives.
 * Falls back to non-streaming if the SDK stream fails.
 */
export const generateAgentResponseStream = async (
  agentKey, session, project, roundNumber,
  previousMessages = [], setupContext = {}, customAgents = null,
  onChunk
) => {
  const roles = customAgents || AGENT_ROLES;
  if (!roles[agentKey]) return null;

  const { cases, ragContext } = await fetchRAGContext(project);
  const { prompt, systemInstruction } = buildAgentPrompt(
    agentKey, session, project, roundNumber, previousMessages, setupContext, roles, cases, ragContext
  );

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction
    });

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
