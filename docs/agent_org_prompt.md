# 🏢 Agent Organization Prompt — 会社別カスタマイズテンプレート

> 用途: 別の建設会社・別業界向けに、Tier 1-4 構造の AI エージェント組織 (40〜50 名規模) を一括生成する LLM プロンプト。
> 想定運用: ユーザーが会社プロファイルを入力 → Claude/Gemini が `.md` ファイル群と migration SQL を出力 → そのまま `public/agents/` に投入。
> ベース実装: 2026-04-30 時点の汎用ゼネコン版 (`scripts/generate_tier_agents.mjs`) をリファレンスとする。

---

## 1. Tier 哲学

| Tier | 名称 | 役割 | 典型人数 | 議論での視点 |
|------|------|------|---------|------------|
| **1** | 経営層 | 最終意思決定・対外責任 | 4-6 名 | 全社最適・ステークホルダー対応・3-5 年スパン |
| **2** | 部門長 | 事業部・機能組織の長 | 10-14 名 | 部門 KPI・予算・人員配置・1-2 年スパン |
| **3** | 専門スタッフ | 法務・リスク・ESG・IT 等の本社機能 | 12-16 名 | ガバナンス・規制対応・横断的リスク |
| **4** | 現場・情報 | 現場実行・市場/規制ウォッチャー | 10-14 名 | 即日〜数週間の実行可能性・最新動向 |
| **External** | 外部コンサル | 弁護士・環境・保険・建築基準法等 | 3-5 名 | 専門領域の独立第三者視点 |

**設計原則**:
- 議題に応じて Tier を横断する 5-8 名で議論する設計 (43 名一斉参加は議論にならない)
- Tier 1 は CEO + 1-2 名のコア
- 各 Tier は専門性が重複しないよう ID と department を割り振る
- 既存 4 名 (PM/CFO/COO/CEO) は社内政治的な互換のため keep + tier metadata 追加

---

## 2. 入力スキーマ

LLM に渡す会社プロファイル (YAML or JSON):

```yaml
company:
  name: "株式会社 〇〇建設"
  founded: 1900
  employees: 8500
  revenue_jpy_billion: 1800
  domain_focus:  # この会社の主力ドメイン (重み)
    - building: 0.4       # 建築
    - civil: 0.3          # 土木
    - international: 0.2  # 海外
    - development: 0.1    # 不動産開発
  strengths:
    - "免震・制震技術"
    - "原子力関連工事"
    - "東南アジア網"
  weaknesses:
    - "DX 投資が他社比で遅れている"
    - "若手離職率が業界平均より高い"
  current_priorities:
    - "ESG 開示の S スコア向上"
    - "海外売上比率 30% 達成 (現状 20%)"
    - "DX 推進 (BIM 利用率 100%)"
  regulatory_environment: "建設業法・労安法・カーボンプライシング・建設 GX"
  cultural_traits:
    - "現場主義"
    - "技術先行"
    - "和を重んじる意思決定"
locale: "ja"  # ja | en
```

---

## 3. プロンプト本体

````
あなたは建設会社の組織設計コンサルタントです。
以下の会社プロファイルを基に、AI エージェントの 4-Tier 組織を設計してください。

【入力】
{{ company profile YAML をここに挿入 }}

【設計要件】
1. 合計 43-47 名の Internal エージェント + 3-5 名の External コンサルタントを設計する
2. 各エージェントは下記 4 Tier のいずれかに属する:
   - Tier 1: 経営層 (4-6 名)
   - Tier 2: 部門長 (10-14 名)
   - Tier 3: 専門スタッフ (12-16 名)
   - Tier 4: 現場・情報 (10-14 名)
3. 会社の domain_focus (建築/土木/海外/開発の比重) に応じて Tier 2 の事業部数を調整する
4. strengths / weaknesses / current_priorities が議論で表面化するよう、専門エージェントを配置する
   (例: ESG 強化なら T3_ESG を厚く・DX 遅れなら T1_CTO + T3_DX を必置)
5. 既存 4 名 (PM, CFO, COO, CEO) は ID 維持しつつ tier metadata を加える
6. 各エージェントには cultural_traits を反映した発話スタイル・思考パターン・既知バイアスを織り込む

【出力 (JSON)】
{
  "agents": [
    {
      "id": "T1_CEO",
      "name": "代表取締役社長",
      "tier": 1,
      "department": "Executive",
      "sub_role": "top_management",
      "agent_type": "internal",
      "style": "...",
      "background": "...",
      "thinking_pattern": "...",
      "focus_points": "...",
      "known_biases": "..."
    },
    ...
  ]
}

各 agent の各テキストフィールドは 100-200 字を目安。
````

---

## 4. 出力 → ファイル変換

LLM 出力 (JSON) を `.md` ファイル群に変換するスクリプトの擬似コード:

```js
import { writeFileSync } from 'fs';
const out = JSON.parse(llmResponse);
for (const a of out.agents) {
  const frontmatter = [
    `id: ${a.id}`,
    `name: ${a.name}`,
    `style: ${a.style}`,
    `is_active: true`,
    `tier: ${a.tier}`,
    `department: ${a.department}`,
    `sub_role: ${a.sub_role}`,
  ].join('\n');
  const body = [a.background, a.thinking_pattern, a.focus_points, a.known_biases].join('\n');
  writeFileSync(`public/agents/${a.id}.md`, `---\n${frontmatter}\n---\n\n${body}\n`);
}
```

そして `migration_<date>_<company>_seed.sql` を自動生成して Supabase に流し込む。

---

## 5. リファレンス実装

汎用ゼネコン版 (2026-04-30 実装) は以下を参照:

- **生成スクリプト**: [scripts/generate_tier_agents.mjs](../scripts/generate_tier_agents.mjs)
  - 39 内部エージェント + 既存 8 名のメタデータ追加 + `index.json` 構造化を idempotent に行う
- **DB マイグレーション**: [supabase/migration_20260430_tier_organization.sql](../supabase/migration_20260430_tier_organization.sql)
  - `tier`, `department`, `sub_role` カラム追加 + 39 INSERT
- **DB シード補完**: [supabase/migration_20260430_seed_existing_agents.sql](../supabase/migration_20260430_seed_existing_agents.sql)
  - 既存 8 名 (PM/CFO/COO/CEO + 4 EXT_) を `expert_agents` に INSERT (Supabase 優先ロジックで消えないように)
- **UI 改修**: [src/App.jsx](../src/App.jsx) の `PARTICIPANT_PRESETS` / `TIER_LABELS` 定数 + 参加者選択 UI
- **AI 会議体設計連動**: [src/lib/gemini.js](../src/lib/gemini.js) の `suggestMeetingDesign()` (Tier 別組織図をプロンプト注入)

---

## 6. プリセット拡張ガイド

会社の業務特性に応じて [src/App.jsx](../src/App.jsx) の `PARTICIPANT_PRESETS` を編集する。汎用版で定義済みのプリセット:

| プリセット | 想定シーン | デフォルト構成 |
|-----------|-----------|---------------|
| 既定 (Classic 4) | 基本設計 | PM, CFO, COO, CEO |
| 経営判断 | 役員会案件 | T1 全員 + T2_PLANNING + T2_FINANCE |
| 現場リスク評価 | 重大インシデント・施工困難 | PM, COO, T4_SAFETY, T4_QC, T4_SITE_MGR, T3_SAFETY_ENV, T3_RISK |
| M&A 検討 | 買収・JV 結成 | CEO, CFO, T3_MA, T3_LEGAL, T2_PLANNING, T2_FINANCE |
| 海外プロジェクト | クロスボーダー案件 | CEO, CFO, T2_INTL_DIV, T3_INTL_LEGAL, EXT_LEGAL |
| 大型受注検討 | 100 億超案件 | CEO, CFO, T2_BLDG_DIV, T2_SALES, T2_PROCUREMENT, T3_LEGAL |
| ESG/コンプラ | 開示・不祥事対応 | CEO, COO, T3_ESG, T3_COMPLIANCE, T3_LEGAL, T3_PR_IR |
| DX/技術投資 | BIM・建設ロボット導入 | CEO, T1_CTO, T3_DX, T2_PROD_TECH, T4_BIM, T2_PLANNING |
| 設計変更 | クライアント要望・法令変更 | PM, T2_DESIGN, T4_DESIGNER, T3_QA, T4_BIM, COO |
| 危機対応 | 訴訟・メディア炎上 | CEO, COO, T3_PR_IR, T3_LEGAL, T3_RISK, T3_COMPLIANCE |

会社特有のプリセット例:
- **病院 PJ 専用**: PM, T2_DESIGN, T4_BIM, T3_QA, T4_DESIGNER, EXT_BUILDING_CODE
- **公共インフラ入札**: CEO, COO, T2_CIVIL_DIV, T3_LEGAL, T2_SALES, T2_FINANCE

---

## 7. 注意事項

- **既存 ID 重複の扱い**: PM/CFO/COO/CEO の 4 ID は backward compat のため keep する。新規組織でも同じ役割 (現場 PM・財務責任者・運営責任者・最高責任者) は同じ ID を再利用する
- **agent_id の命名規則**: `T<tier>_<dept_or_role>` (例: T1_CEO, T2_BLDG_DIV, T3_LEGAL, T4_SITE_MGR)。外部は `EXT_<domain>` (例: EXT_LEGAL)
- **Supabase 優先ロジック**: `loadAgents()` は DB データがあればそれを使う。`.md` だけ追加すると DB 側で消えて見えるので、必ず seed migration もセットで流す
- **多言語対応**: `locale: 'en'` 入力時は英語 .md を別ディレクトリ (`public/agents/en/`) に出力するか、`name`/`description` を英訳併記する設計が必要 (将来課題)

---

## 8. 関連ドキュメント

- [PENDING_FIXES.md](../PENDING_FIXES.md) — 全体ロードマップ
- [README.md](../README.md) — セットアップ手順
- [USER_MANUAL.md](../USER_MANUAL.md) — エンドユーザー向け使い方
