# 📰 業界ニュース自動 Cron — 詳細設計 (実装待ち)

> **ステータス**: 設計完了・実装待ち (deferred)
> **設計日**: 2026-05-03
> **想定実装工数**: 1-1.5 時間 (本番デプロイまで)
> **PENDING_FIXES.md**: 「業界ニュース自動 cron」項目に対応

このドキュメントは **将来このタスクに着手したときに、設計判断を再生成しなくていいように** 詳細を保存したもの。実装着手時はこのファイルを最初に読むこと。

---

## 1. ゴール

週次で建設業界の RSS ニュースを取得 → Gemini で議題候補を生成 → Supabase に pending suggestions として保存 → ユーザーが Web UI で承認 → 既存の `applyNewsSuggestion()` フローでプロジェクト作成。

PENDING_FIXES.md の元記述:
> 既存の `9999-9_News` ニュース収集スキルと連動。週次で注目ニュースを取得 → テーマ候補をユーザーに提案 → 承認後にエージェントが自律的に3ラウンド議論 → サマリーを蓄積。常時全自動ではなくセミオート（ユーザー承認ゲートあり）を推奨。

**Phase 1 のスコープ**: 承認後の自律議論は**含めない** (手動で議論開始させる)。理由は Gemini コスト・バグリスク・複雑度。Phase 2 で追加検討。

---

## 2. アーキテクチャ

```
[GitHub Actions Cron] ← Vercel Hobby の 10 秒制限を回避するため GitHub 経由
   │  月曜 09:00 JST = 月曜 00:00 UTC
   │  cron: "0 0 * * 1"
   ↓ POST /api/news-cron (with CRON_SECRET header)
[Vercel Serverless /api/news-cron]
   ↓ 1. fetch RSS (5 並列・各 2s timeout)
   ↓ 2. parse + dedupe (URL ベース)
   ↓ 3. top 3 選定 (新しい + キーワードマッチ)
   ↓ 4. Gemini suggestTopicFromNews × 3 並列
   ↓ 5. supabase upsert news_suggestions
[Supabase: news_suggestions テーブル]
   ↓ status: pending
[Web UI 起動時]
   ↓ pending count を fetch
   ↓ ヘッダーバッジ「📰 3 件の新規提案」表示
   ↓ クリック → suggestions パネル
   ↓ ユーザー操作:
   ↓   ・承認 → applyNewsSuggestion (既存フロー) → status: applied
   ↓   ・却下 → status: dismissed
```

**なぜ GitHub Actions cron 経由か**: Vercel Hobby は serverless function 実行を 10 秒に制限。RSS 5 + Gemini 3 並列で 6-9 秒見積もりで微妙。GitHub Actions は実行時間制限なし & 完全無料 (2000 分/月の枠で月 4 回 × 30 秒 = 2 分しか使わない)。Vercel Cron 単独でも動く可能性は高いが、安全マージン的に GitHub Actions が安心。

---

## 3. 無料枠分析 (2026-05 時点)

| コンポーネント | 使用量 | 上限 | 余裕 |
|---------------|--------|------|------|
| Vercel Serverless 実行回数 | 4 回/月 | 100,000 回/月 | 99.99% 余裕 |
| Vercel Bandwidth | <1 KB/回 | 100 GB/月 | ✅ |
| Supabase Storage | +1 KB×3/週×52 週 = 150 KB/年 | 500 MB | ✅ |
| GitHub Actions 実行時間 | 月 4 回 × 30 秒 = 2 分/月 | 2000 分/月 | 99.9% 余裕 |
| **Gemini API** | **3 calls/週 = 12/月** | 無料 tier: 1500 RPD | **0.03% (3750 倍余裕)** |

### Gemini API のコスト戦略

memory `gemini_api_billing_lessons` の重要事項:
> **2026-04 時点の仕様変更・新規projectは billing必須・2.0-flash提供停止**

memory `gemini_project_allocation`:
> **IAP5アプリが Jiyukenkyu プロジェクトの $20 cap 共有・キー別でも課金プールは1つ・コスト実績$0.005/問**

#### 戦略: 2 段構え

```js
// api/news-cron.mjs
const apiKey = process.env.GEMINI_NEWS_API_KEY    // 優先: 新規無料キー (試行)
            || process.env.VITE_GEMINI_API_KEY;   // フォールバック: 既存 billing キー
```

**実装着手時の手順**:
1. <https://aistudio.google.com/app/apikey> で「Create API key in new project」を試す
2. **成功すれば**: 無料 tier (1500 RPD) で永続運用 → **$0/月**
3. **billing を要求された場合**: 既存 `VITE_GEMINI_API_KEY` を流用 → $0.06/月 ($20 cap の 0.3%)

どちらにしてもコストは無視できる範囲。

---

## 4. RSS フィード選定

memory にはないが、既存の news-collector skill (`~/.claude/skills/news-collector/scripts/collect_news.py`) で使われているフィードのうち建設特化の 5 件を採用:

```js
const FEEDS = [
  { name: 'ENR', url: 'https://www.enr.com/rss/all' },
  { name: 'Construction Dive', url: 'https://www.constructiondive.com/feeds/news/' },
  { name: 'The Construction Index', url: 'https://www.theconstructionindex.co.uk/feeds/news.xml/' },
  { name: 'Autodesk Blog', url: 'https://blogs.autodesk.com/feed/' },
  { name: '日経クロステック (建設)', url: 'https://xtech.nikkei.com/atcl/nxt/column/18/02002/feed/' },  // 要確認
];
```

注意:
- Cloudflare 等で fetch 失敗するフィードは個別 try/catch で skip
- AI/テック系は不要 (建設に絞る)
- 国土交通省 RSS は要調査 (建設専門ニュースは政府系も価値高い)

---

## 5. Supabase スキーマ

```sql
-- supabase/migration_<date>_news_cron.sql

CREATE TABLE IF NOT EXISTS multi_agent.news_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT UNIQUE NOT NULL,
  source_title TEXT NOT NULL,
  source_feed TEXT NOT NULL,
  source_published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  -- Gemini suggestTopicFromNews の出力
  suggested_theme TEXT,         -- 'delay' | 'go_no_go' | 'design_change' | カスタム
  suggested_focus TEXT,
  suggested_summary TEXT,
  suggested_project JSONB,      -- { name, summary, building_usage, ... }
  -- ステータス管理
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  applied_to_project_id UUID REFERENCES multi_agent.projects(id),
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT
);

CREATE INDEX idx_news_suggestions_status ON multi_agent.news_suggestions(status);
CREATE INDEX idx_news_suggestions_fetched ON multi_agent.news_suggestions(fetched_at DESC);

ALTER TABLE multi_agent.news_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write" ON multi_agent.news_suggestions FOR ALL USING (true) WITH CHECK (true);
```

---

## 6. ファイル構成

```
multi-agent/
├── api/
│   └── news-cron.mjs          ← Vercel Serverless Function (NEW)
├── .github/workflows/
│   └── news-cron.yml          ← GitHub Actions cron (NEW)
├── supabase/
│   └── migration_<date>_news_cron.sql   (NEW)
├── src/
│   ├── lib/
│   │   └── news_suggestions.js   ← fetch / approve / dismiss helper (NEW)
│   ├── components/
│   │   └── NewsSuggestionsPanel.jsx   ← UI panel (NEW)
│   └── App.jsx                ← header badge + panel mount (MODIFY)
└── vercel.json                ← (MODIFY: API route 設定)
```

---

## 7. 実装ステップ (1-1.5h 想定)

### Step 1: スキーマ + Supabase migration (10 分)
- `migration_<date>_news_cron.sql` 作成
- `apply_migration.mjs` で適用 (PAT 経由)

### Step 2: Vercel Serverless 関数 (30 分)
- `api/news-cron.mjs`
  - CRON_SECRET ヘッダー検証
  - RSS 5 並列 fetch (各 AbortController で 2s timeout)
  - feed-parser-light など軽量パーサで parse (Vercel cold start を抑える)
  - Top 3 選定ロジック (24h 以内 + キーワード マッチ "建設" "DX" "M&A" 等)
  - Gemini `suggestTopicFromNews` 並列呼び出し
  - Supabase upsert (URL ベース dedupe)
- `vercel.json` で `/api/news-cron` を登録

### Step 3: GitHub Actions cron (10 分)
- `.github/workflows/news-cron.yml`
  ```yaml
  name: News Cron
  on:
    schedule:
      - cron: '0 0 * * 1'  # 月曜 00:00 UTC = 月曜 09:00 JST
    workflow_dispatch:  # 手動トリガーも可能に
  jobs:
    trigger:
      runs-on: ubuntu-latest
      steps:
        - run: |
            curl -X POST "https://multi-agent-xi.vercel.app/api/news-cron" \
              -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
              -m 60 --fail
  ```
- GitHub repo secrets に `CRON_SECRET` を追加 (`vercel env add CRON_SECRET production` も)

### Step 4: UI — Suggestions Panel (30 分)
- `src/components/NewsSuggestionsPanel.jsx`
  - pending list 表示
  - 承認 → 既存 `applyNewsSuggestion` ハンドラを呼ぶ → status: applied
  - 却下 → status: dismissed
- `src/App.jsx`
  - ヘッダーに badge `📰 N` (N = pending count)
  - クリックで panel をモーダル表示
  - 起動時 (load 後) に `news_suggestions where status='pending'` を fetch

### Step 5: 動作確認 (10 分)
- Supabase migration 適用確認
- ローカルで `curl POST /api/news-cron` を叩いて 1 件サンプル投入
- UI で pending suggestion → approve → 既存フローで project 作成できるか確認
- GitHub Actions の workflow_dispatch で cron 動作確認

### Step 6: コミット + push (5 分)
```
Bundle 12: weekly news cron + suggestions queue
```

---

## 8. リスクとミティゲーション

| リスク | 対策 |
|-------|------|
| RSS フィードがダウン | Promise.allSettled で個別エラーを許容 |
| Cloudflare ブロック | User-Agent を一般ブラウザ風に + 失敗時 skip |
| Gemini レイテンシ急増 | Promise.race で 7 秒タイムアウト |
| 同じニュースが何度も提案される | URL UNIQUE 制約 + ON CONFLICT DO NOTHING |
| pending が溜まりすぎる | UI で「7 日以上前は自動 dismiss」オプション or バッジ最大 5 表示 |
| 月曜祝日でも動作 | 問題なし (cron は曜日ベース) |
| GitHub Actions が無効化される (90日 inactive) | workflow_dispatch を月 1 回手動実行 or push が定期的にあれば維持される |

---

## 9. Phase 2 構想 (将来)

承認後に **自律 3 ラウンド議論** を自動実行する案。但し:
- Gemini 消費が大幅増 (1 提案承認で 5-15 calls)
- Vercel Hobby 10s 制限を超える (議論完走には数十秒〜数分必要)
- 必要なら Inngest / Trigger.dev 等の background job runner を併用 (両方無料 tier あり)

Phase 2 着手判断:
1. Phase 1 が安定運用できている (3-4 週間)
2. ユーザーが「承認したら勝手に議論しててほしい」と明確に望む
3. Gemini cap に余裕がある

---

## 10. 関連ファイル / メモリ

- **PENDING_FIXES.md** (OneDrive 側): 元タスク記載
- **memory `gemini_api_billing_lessons`**: 2026-04 の仕様変更
- **memory `gemini_project_allocation`**: $20 cap の状況
- **memory `email_news_pipeline_insights`**: ニュース処理の知見 (`9999-9_News` 側)
- **既存実装**:
  - `src/lib/gemini.js` の `suggestTopicFromNews()` (再利用)
  - `src/App.jsx` の `analyzeNews()` / `applyNewsSuggestion()` (再利用)
  - `scripts/apply_migration.mjs` (PAT 経由 SQL 適用)

---

## 11. 着手時の最初のアクション

```bash
cd C:/Projects/multi-agent
# 1. Read this design doc fully
cat docs/news_cron_design.md

# 2. Try free Gemini key
# Open https://aistudio.google.com/app/apikey in browser
# Click "Create API key" → choose "Create API key in new project"
# If it works: save as GEMINI_NEWS_API_KEY in .env (and Vercel env)

# 3. Start Step 1 (schema)
```

---

## 12. 設計判断履歴

- **2026-05-03**: 設計完了・実装は将来に延期 (ユーザー判断)
  - 理由: 大型タスク (43名 Tier 組織) 直後でセッション切替えが妥当
  - 当時の他の major task: PDF persona injection / TS 移行
