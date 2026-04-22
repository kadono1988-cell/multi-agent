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
