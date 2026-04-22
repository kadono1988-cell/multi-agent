# 🧠 建設マルチエージェント意思決定支援システム (Construction Agent AI)

このシステムは、建設プロジェクトの複雑な課題に対して、4人のAIエキスパート（PM, CFO, COO, CEO）が議論を行い、あなたに最適なアドバイスを提示するプラットフォームです。

**プログラミングの知識は一切不要です。** 以下の手順に従うだけで、誰でも動かすことができます。

---

## ⚡ 1. とりあえず動かしてみる（デモモード）

設定作業が面倒な場合は、以下の2つのコマンドを打つだけで、AIキーなしで動作する「デモモード」を体験できます。

```bash
npm install
npm run dev
```
画面に表示された `http://localhost:5173` をクリックするとブラウザで開きます。

---

## 🏗️ 2. 本格的に自分のプロジェクトで使う（本番設定）

自分のプロジェクトでAIに議論させるには、以下の3つのステップが必要です。

### ステップ①：AIの「脳（Gemini）」と「倉庫（Supabase）」の鍵をもらう

1. **Gemini API Key**: [Google AI Studio](https://aistudio.google.com/app/apikey) で「Create API key」を押し、出てきた文字列をメモします。
2. **Supabase**: [Supabase公式サイト](https://supabase.com/)でアカウントを作り、「New Project」を作成します。設定画面の「API」から **Project URL** と **anon Key** をメモします。

### ステップ②：鍵を登録する

1. このフォルダの中にある `.env.example` というファイルをメモ帳で開きます。
2. 先ほどメモした3つの情報を書き込み、上書き保存します。
3. ファイル名を `.env.example` から `.env` に変更します。

### ステップ③：データベースを準備する（コピペだけ！）

1. Supabaseの画面で「SQL Editor」を選び、「New Query」を押します。
2. このフォルダの `supabase/schema.sql` の中身を全てコピーして貼り付け、「Run」ボタンを押します。
3. 同様に `supabase/seed_expanded.sql` も貼り付けて「Run」を押します。

---

## 🚀 3. システムを起動する

1. ターミナル（黒い画面）で以下を打ちます：
   ```bash
   npm run dev
   ```
2. ブラウザで開き、プロジェクト名を入力して議論を開始してください。

---

## 📚 もっと詳しい手順を知りたい方へ
さらに細かい一歩ずつの説明が必要な場合は、以下のガイドをご覧ください。
- [SETUP_GUIDE_FOR_BEGINNERS.md](./SETUP_GUIDE_FOR_BEGINNERS.md)

困ったときは、この README をもう一度読み返してみてください。
