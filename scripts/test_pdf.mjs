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

const sampleMessages = [
  { round_number: 1, agent_role: "PM", content: "現場PMとしての見解です。納期遅延は現場で5日前に察知していた問題。" + "長い応答のテスト。".repeat(40) },
  { round_number: 1, agent_role: "CFO", content: "WACC超過リスクがあるため慎重に。ワーストケースで粗利10%残るか試算。" + "CFOの詳細説明。".repeat(30) },
  { round_number: 1, agent_role: "COO", content: "契約第12条の物価スライド条項を再確認します。" + "COO視点の補足。".repeat(25) },
  { round_number: 2, agent_role: "PM", content: "2ラウンド目の現場応答。" + "現場の実態を繰り返し伝える。".repeat(35) },
  { round_number: 2, agent_role: "CFO", content: "他メンバー意見への反論。" + "数字で詰める。".repeat(40) },
  { round_number: 3, agent_role: "CEO", content: "不足情報を3点特定する。" + "CEO視点。".repeat(30) },
  { round_number: 5, agent_role: "CEO", content: "最終判断を下す。" + "具体アクション。".repeat(20) },
];

const labels = {
  title: "建設意思決定支援プラットフォーム — 議論サマリー",
  subtitle: "PM / CFO / COO / CEO 4エージェントによる意思決定議論の記録",
  locale: "ja-JP",
  meta: {
    project: "プロジェクト",
    client: "施主",
    budget: "予算",
    theme: "テーマ",
    date: "実施日",
  },
  sections: { setup: "▌ セットアップ情報" },
  setup: {
    user_context: "相談内容",
    constraints: "制約事項",
    goal: "目指すゴール",
    focus_points: "特に重視してほしい視点 (論点設定)",
    prfaq: "PRFAQ (完成時のニュース記事 + 想定FAQ)",
  },
  round_prefix: "Round",
  footer: `生成日時: ${new Date().toLocaleString("ja-JP")}  —  Construction Multi-Agent Decision System`,
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
