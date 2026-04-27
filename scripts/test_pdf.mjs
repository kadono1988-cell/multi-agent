// Smoke test: render SessionPDF to a file to catch layout/style errors before deploy.
// Run with: node scripts/test_pdf.mjs

import React from "react";
import { pdf, Font } from "@react-pdf/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontPath = path.resolve(__dirname, "..", "public", "fonts", "NotoSansJP-Regular.ttf");

// Override the URL-based Font.register from SessionPDF.jsx by pre-registering
// the font with a local file path. react-pdf will use the first registration.
Font.register({ family: "NotoSansJP", src: fontPath });

// Dynamic import so the module's top-level Font.register runs after ours (no-op).
const { SessionPDF } = await import("../src/lib/SessionPDF.jsx");

// Use realistic AI-style markdown content that previously triggered PDFKit errors.
const realisticPM = `よし、始めよう。湾岸タワーマンション建替え、鉄骨納期遅延か。話は早い。

### 1. 現状の理解

* **「湾岸タワーマンション躯体工事の鉄骨納期遅延」事例の再現。** 8週遅延は、上棟式、販売開始時期への影響は計り知れない。これは単なる工程問題じゃない、発注者のキャッシュフローに直結する。
* **販売開始時期厳守という制約が、選択肢を狭めている。** 6月販売開始は、デベロッパーX社の生命線だ。ここを外すと、信頼関係にヒビが入るどころか、事業そのものが危うくなる。
* **追加コスト2億円までというのも、現場泣かせだ。** 限られた予算で、この遅延を3週間以内に圧縮するとなると、相当な工夫と覚悟が要る。

### 2. 主要な論点

* **国内メーカーへの発注切替の実現可能性。**
セカンドソース確保は当然として、今から国内メーカーに発注できるか？製造能力、納期、そして「品質」。過去の事例でもあったが、安易な切替は、新たな問題の火種になりかねない。
* **工区割見直し vs プレハブ化。** 机上の計画通りにできるか？作業員動線、仮設、安全。特に高層階になるほど、作業動線の交錯は命取りだ。
* **発注者との信頼関係維持。** 販売開始時期を守るための「追加コスト」の折半交渉。`;

const realisticCFO = `承知いたしました。現場財務責任者として、プロジェクト「湾岸タワーマンション建替え」における鉄骨納期遅延問題について、冷静かつ分析的に対応いたします。

### 1. 現状の理解 [湾岸タワーマンション躯体工事の鉄骨納期遅延] を踏まえた分析

* 海外製鉄骨の輸送遅延により、当初8週間の遅延が見込まれる。販売開始時期（6月）厳守が最優先課題。
* 追加コスト2億円の制約内で、最終遅延を3週間以内に圧縮する必要がある。
* 過去事例では、国内メーカーへの一部切替と並行施工で対応し、遅延を3週間に圧縮、コスト折半で着地している。

### 2. 主要な論点

* **国内メーカーへの切替可能性とWACC:** 国内メーカーへの切替による追加コストがWACCを上回るか、また、その調達リードタイムと品質を現行サプライヤーと比較評価。
* **工区割見直し・プレハブ化のNPV:** 各戦略による追加コストと、販売開始時期厳守によるキャッシュフロー最大化効果をNPVで比較。`;

const sampleMessages = [
  { round_number: 1, agent_role: "PM", content: realisticPM },
  { round_number: 1, agent_role: "CFO", content: realisticCFO },
  { round_number: 1, agent_role: "COO", content: realisticPM },
  { round_number: 2, agent_role: "PM", content: realisticPM },
  { round_number: 2, agent_role: "CFO", content: realisticCFO },
  { round_number: 2, agent_role: "COO", content: realisticCFO },
  { round_number: 3, agent_role: "CEO", content: realisticPM },
  { round_number: 4, agent_role: "PM", content: realisticPM },
  { round_number: 4, agent_role: "CFO", content: realisticCFO },
  { round_number: 4, agent_role: "COO", content: realisticPM },
  { round_number: 5, agent_role: "CEO", content: realisticCFO },
];

const labels = {
  title: "建設意思決定支援プラットフォーム — 議事録レポート",
  subtitle: "PM / CFO / COO / CEO 4エージェントによる意思決定議論の記録",
  locale: "ja-JP",
  meta: {
    project: "プロジェクト",
    client: "施主",
    budget: "予算",
    theme: "テーマ",
    date: "実施日",
  },
  sections: {
    setup: "▌ セットアップ情報",
    cover_summary: "▌ エグゼクティブサマリー",
    structured_body: "▌ 構造化本体",
    appendix: "—  APPENDIX  —",
    transcript: "▌ Round別 生発言ログ",
  },
  setup: {
    user_context: "相談内容",
    constraints: "制約事項",
    goal: "目指すゴール",
    focus_points: "特に重視してほしい視点 (論点設定)",
    prfaq: "PRFAQ (完成時のニュース記事 + 想定FAQ)",
  },
  report: {
    executive_summary: "概要",
    conclusion: "結論",
    discussion_points: "主要論点",
    agreements: "合意事項",
    disagreements: "対立・未解決論点",
    final_decision: "最終決定と判断根拠",
    action_items: "実行指示 (Action Items)",
    col_owner: "担当",
    col_task: "タスク",
    col_due: "期限",
    empty_points: "議論中に明確な論点は抽出されませんでした。",
    empty_agreements: "合意に至った事項はありません。",
    empty_disagreements: "対立・未解決の論点はありません。",
    empty_rationale: "判断根拠は記録されていません。",
    empty_actions: "実行指示は記録されていません。",
    unavailable: "AIによる構造化レポートを生成できませんでした。",
  },
  round_prefix: "Round",
  footer: `生成日時: ${new Date().toLocaleString("ja-JP")}  —  Construction Multi-Agent Decision System`,
};

const sampleReport = {
  executive_summary: "湾岸タワーマンション建替えにおいて鉄骨納期が8週遅延した。販売開始時期(6月)を厳守する制約のもと、国内メーカーへの一部切替と工区割見直しの併用で最終遅延を3週間以内に圧縮する方針で合意。追加コストは発注者と折半交渉する前提で進める。",
  conclusion: "国内メーカーへの一部切替＋工区割見直しの併用案を採用。追加コスト2億円以内・遅延3週間以内を達成目標とする。",
  discussion_points: [
    "国内メーカーへの発注切替の実現可能性と品質確保",
    "工区割見直しによる作業動線の安全性",
    "プレハブ化との比較におけるNPV評価",
    "発注者X社との信頼関係維持と販売開始時期厳守",
    "追加コスト負担の折半交渉余地",
  ],
  agreements: [
    "販売開始時期(6月)を最優先制約とする",
    "セカンドソース確保は必須",
    "追加コスト2億円を上限とする",
  ],
  disagreements: [
    "プレハブ化採用範囲: PM=限定的 / COO=積極導入を主張",
    "国内メーカー品質評価の独立監査要否: CFO=必要 / PM=既存実績で十分",
  ],
  final_decision: {
    headline: "国内メーカー切替 + 工区割見直し併用案を採用",
    rationale: [
      "過去事例で同条件で遅延3週間圧縮の実績あり",
      "プレハブ化単独は高層階の安全性リスクが残る",
      "発注者X社と折半交渉できる関係性が確保されている",
    ],
  },
  action_items: [
    { owner: "PM", task: "国内メーカー2社へ即日RFQを発出", due: "今週中" },
    { owner: "COO", task: "工区割見直し案の作業動線シミュレーションを作成", due: "10日以内" },
    { owner: "CFO", task: "X社財務担当へ折半交渉の事前打診", due: "5営業日以内" },
    { owner: "CEO", task: "X社経営層へ進捗を週次報告", due: "毎週金曜" },
  ],
};

const doc = React.createElement(SessionPDF, {
  project: { name: "湾岸タワーマンション建替え", client: "大手デベロッパーX社", budget: "280億円" },
  session: { theme_type: "遅延回復戦略 | 鉄骨納期遅延が顕在化", created_at: new Date().toISOString() },
  messages: sampleMessages,
  setupContext: {
    user_context: "鉄骨納期遅延が顕在化。工区割見直し・プレハブ化・工期延長交渉のどれを選ぶか判断したい。",
    constraints: "販売開始時期は6月から動かせない。追加コストは2億円まで。",
    goal: "最終遅延を3週間以内に圧縮する具体策の決定。",
    focus_points: "長期的な発注者との信頼関係と、国内メーカーへの発注切替の実現可能性を必ず織り込んで議論してほしい。",
    prfaq: "# ニュース記事\n見出し: X社のタワーマンション、計画通り販売開始\n本文: セカンドソース確保で遅延圧縮\n\n# FAQ\nQ: 最大の価値は?\nA: 販売開始時期厳守",
  },
  labels,
  report: sampleReport,
});

const outPath = path.resolve(__dirname, "..", "dist_test_session.pdf");
// toBuffer() returns a Node stream in react-pdf v4. Pipe it to a file.
const stream = await pdf(doc).toBuffer();
await new Promise((resolve, reject) => {
  const ws = fs.createWriteStream(outPath);
  stream.pipe(ws);
  ws.on("finish", resolve);
  ws.on("error", reject);
});
const size = fs.statSync(outPath).size;
console.log(`OK: wrote ${size} bytes → ${outPath}`);
