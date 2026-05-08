"""
Seed 20 news-discussion-oriented reference cases into multi_agent.reference_cases.

These cases supplement the existing 50 project-decision cases (Residential /
Commercial / Industrial / Infrastructure / Public x 10 each, themed around
delay / go-no-go / design-change). The new 20 cover industry-trend, regulatory,
M&A, and crisis topics that surface in news_discussion mode meetings.

Run from C:/Projects/multi-agent:
    python scripts/seed_news_discussion_cases.py [--dry-run]

Idempotent by title: existing rows with matching titles are skipped.
"""
from __future__ import annotations
import argparse
import os
import sys
import time
from pathlib import Path

import google.genai as genai
from dotenv import load_dotenv
from google.genai import types
from supabase import create_client, ClientOptions

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"]
SUPABASE_KEY = os.environ["VITE_SUPABASE_ANON_KEY"]
SCHEMA = os.environ.get("VITE_SUPABASE_SCHEMA", "multi_agent")
GEMINI_KEY = os.environ["VITE_GEMINI_API_KEY"]

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768  # matches gemini.ts: outputDimensionality: 768


CASES: list[dict] = [
    # ── Industry / Tech Trend (5) ────────────────────────────────────────────
    {
        "title": "業界大手のAI安全管理ツール導入を受けた自社展開判断",
        "project_type": "Industry Trend",
        "summary": "Skanska・Turner・Balfour Beatty 等の米大手ゼネコンがAI安全予測・ニアミス検知ツールの全社展開を相次いで発表。鹿島でも追随すべきか、現場プライバシー懸念・初期投資5億円・現場マネジャー受容度が論点となった。",
        "outcome": "海外現場3拠点での半年パイロットでケガ件数23%減・ヒヤリハット報告2.3倍を確認後、国内展開は2027年度から段階的に開始決定。教訓: 業界追随判断は必ずパイロットでROI実証する。プライバシー懸念には労組と事前協議が必須で、後追い説得は逆効果。",
    },
    {
        "title": "AI設計レビューツールの社内展開判断",
        "project_type": "Industry Trend",
        "summary": "米国でSolicitation AdvisorなどAIによる公共RFP事前審査ツールが普及。鹿島の意匠設計部門でもAI設計レビュー導入機運が高まり、設計者の役割再定義と費用負担スキームの議論が経営層に上申された。",
        "outcome": "Construction Manager at Risk案件のリスクレビュー支援に限定導入。設計者の判断責任は維持しつつAIを「レビュー助手」に位置づけ。月額200万円のSaaSで年間4億円の手戻りコスト削減を試算。教訓: 既存職務の置換でなく拡張として導入することで現場抵抗を最小化できる。",
    },
    {
        "title": "AI需要主導のデータセンター特化チーム新設判断",
        "project_type": "Industry Trend",
        "summary": "Jacobs CEOが「データセンター投資サイクルは初期段階」と発言し、業界各社がAIデータセンター開発に注力。鹿島も建築事業内にDC特化チームを新設すべきか、設計知見・冷却インフラ・電力調達ノウハウの内製可否、既存案件チームとのリソース配分が課題となった。",
        "outcome": "建築事業本部内に「DCソリューション部」を30名で新設。冷却・電気は外部JVパートナーと組み、3年で年商800億円目標。教訓: ピーク需要に乗るには専門部隊の早期立ち上げが鍵。後追いでは利幅が取れず、機を逸する。",
    },
    {
        "title": "走行中ワイヤレス充電道路への事業参入判断",
        "project_type": "Industry Trend",
        "summary": "ミシガン・ユタで走行中EV充電道路の実証が進み、米国インフラ予算でも本格化見込み。鹿島道路として事業参入すべきか、技術提携先・特許リスク・初期赤字許容度を中期計画で検討する必要が生じた。",
        "outcome": "単独参入はリスク高と判断し、欧州先行のElectReonと技術提携。日本国内の高速道路SA周辺5km区間で実証PJを2027年に立ち上げ。教訓: 新インフラ事業は技術提携で初動コストを抑え、実証段階で標準化議論に参加することで後発でも主導権を取れる。",
    },
    {
        "title": "モジュラー建築・3Dプリンタ建設の中期脅威評価",
        "project_type": "Industry Trend",
        "summary": "米国を中心にモジュラー建築・3Dプリンタ建設の事例が増え、低層住宅・倉庫案件で工期半減・コスト3割減の実績。鹿島の伝統的工法ビジネスへの中期的脅威となるか、対応投資の規模を経営判断する必要があった。",
        "outcome": "国内では建築基準法・職人文化の制約で本格普及まで5-7年と評価。脅威より機会と捉え、自社モジュラー工場建設（2028年稼働）と工法知財取得を並行推進。教訓: 破壊的イノベーション評価は規制・文化の摩擦係数を必ず算入する。米国データを直輸入してはいけない。",
    },
    # ── Regulatory / Compliance (5) ──────────────────────────────────────────
    {
        "title": "協力会社労務管理の全社強化（賃金未払い事案受けて）",
        "project_type": "Regulatory",
        "summary": "ミネソタ州が建設会社1社から128万ドルの未払い賃金を回収した事案を受け、鹿島米国法人でも同様リスクの自己診断と是正措置を進める必要が経営に上申。協力会社契約見直し範囲・追加管理コスト・契約解除条項が論点となった。",
        "outcome": "米国全現場で協力会社労務監査を四半期実施に切り替え。AI賃金分析ツール導入で月次自動チェック。違反3回で契約解除の罰則条項を標準契約書に追加。教訓: 規制強化期は「業界平均水準」では不十分。州当局の動きに先行して内部統制を厚くする。",
    },
    {
        "title": "OSHA安全基準対応の前倒し判断（Total Worker Health）",
        "project_type": "Regulatory",
        "summary": "Construction Safety WeekがOSHAと公式同盟締結し、米国ではTotal Worker Health（メンタル含む包括的健康管理）が事実上の業界標準化見込み。鹿島米国法人も先行対応すべきか、追加コスト3億円・人員配置で議論が必要となった。",
        "outcome": "全米12現場でTotal Worker Healthプログラム導入（カウンセラー常駐＋メンタルヘルス研修）。年間3億円の追加コストだが訴訟リスク低減・人材定着で5年回収見込み。教訓: 規制が事実上の業界標準になる前に動くと、採用市場で先行者利益が出る。",
    },
    {
        "title": "建築物石綿規制改正（Level 1範囲拡大）対応",
        "project_type": "Regulatory",
        "summary": "建築物石綿規制が2026年改正でLevel 1含有材の事前調査範囲が大幅拡大。築古案件の解体・改修プロジェクトで調査コスト・工期影響が予測される。社内対応マニュアル整備と顧客への価格転嫁スキームが論点となった。",
        "outcome": "建築物石綿含有建材調査者を50名に倍増。新基準対応費用は別建て見積りとして契約書テンプレに反映。発注者向け説明資料を法務と共同作成し価格転嫁交渉を標準化。教訓: 規制改正は調査者・有資格者の数が律速になる。早期育成が競争力に直結する。",
    },
    {
        "title": "排出量取引制度（GX-ETS）対応の経営判断",
        "project_type": "Regulatory",
        "summary": "GX-ETS（東京都・国の排出量取引制度）が建設業も対象に拡大される見通し。施工段階のCO2排出計測・削減コミットメント未対応では大型公共案件入札で減点される懸念。社内CO2計測体制と削減投資額が論点となった。",
        "outcome": "全現場で建設機械の電動化を2030年までに80%完了する目標設定。CO2計測SaaSと連携した内部炭素価格¥10,000/t-CO2を意思決定に組込み。教訓: 規制対応はコストでなく入札優位性として捉える。削減目標は外部公表で逆算する。",
    },
    {
        "title": "建設業界DEI推進の経営判断（米国基準対応）",
        "project_type": "Regulatory",
        "summary": "米国大型公共案件で女性・マイノリティ雇用比率がスコア化され、欧米顧客は鹿島にもDEIレポート開示を要求し始めた。社内ポリシー整備と数値目標公表時期、米国子会社のDEI専任部署設置が論点となった。",
        "outcome": "2027年までに管理職女性比率15%・外国籍従業員比率8%を社外公表。米国子会社にDEI専任部署設置。教訓: DEIは採用ブランディングと欧米案件入札の両面で実利がある。日本基準で発信せず欧米基準に合わせる。",
    },
    # ── Market / Macro (4) ───────────────────────────────────────────────────
    {
        "title": "人手不足・高齢化への構造的対応（22万人求人空席）",
        "project_type": "Market Trend",
        "summary": "米国3月の建設業労働市場は22万4千人分の求人が空席のまま停滞。日本でも同様の構造的人手不足。賃金引き上げ・自動化投資・外国人技能実習生制度活用の優先順位を経営が中期計画で決定する必要があった。",
        "outcome": "5年間で人件費単価+20%を覚悟しつつ、自動化機械（自律施工ロボ・遠隔施工）への投資200億円を承認。技能実習生制度から特定技能制度へ移行支援。教訓: 人手不足は3要素（賃金・自動化・移民）の同時実行が必要で、単独施策では追いつかない。",
    },
    {
        "title": "鋼材・資材高騰時の入札方針見直し",
        "project_type": "Market Trend",
        "summary": "米国の関税政策・中国需要回復で鋼材価格が前年比+35%。受注済み大型案件で原価割れリスク、新規入札では他社が低価格で攻めてくる懸念。スライド条項の交渉強化と入札規律の保持が論点となった。",
        "outcome": "既存案件は契約スライド条項を全件再交渉。新規入札では原価ベース＋8%利益率を最低ラインとし、それを下回る案件は失注を許容。教訓: 資材高騰期は「失注を恐れない規律」が利益を守る。シェア追求は次の景気循環で必ず代償を払う。",
    },
    {
        "title": "集合住宅着工減少への戦略修正（許可件数-18%）",
        "project_type": "Market Trend",
        "summary": "2026年3月の集合住宅許可件数が前年比-18%。住宅事業部の中期計画は据え置きできない状況。リソース配分（DC・物流・公共）への振替か、住宅事業の縮小・撤退かを経営判断する必要があった。",
        "outcome": "住宅事業のリソース30%（150名）をDC・物流事業に再配置。残存リソースで首都圏プレミアム物件に特化し、地方分譲から段階撤退。教訓: マクロ転換期は「縮小も成長」と捉える。残った領域で利幅を厚くすることが収益貢献の最短経路。",
    },
    {
        "title": "データセンター需要急増への建築事業シフト",
        "project_type": "Market Trend",
        "summary": "Schneider ElectricがAI需要とエネルギー安全保障で四半期過去最高収益達成。データセンター・電力インフラの需要が建築需要の構造を変えている。鹿島の建築事業セグメントとして既存案件構成（オフィス60%・商業20%）を見直すべきか論点となった。",
        "outcome": "中期計画で建築セグメント構成をオフィス40%・DC30%・商業15%・その他15%に再設計。営業部隊の40%をDC・物流専任に再編。教訓: 需要構造の不可逆な変化に対しては営業組織から先に変える。設計・施工は需要に追随できる。",
    },
    # ── Competitive / M&A (3) ────────────────────────────────────────────────
    {
        "title": "米国大手GCとの大型JV受注検討（24億ドル案件）",
        "project_type": "M&A",
        "summary": "AECOM Hunt × Turner JVが24億ドルのクリーブランド・ブラウンズ新スタジアム着工。鹿島米国法人にも類似の大型公共スポーツ施設案件でJV招待がきた。コミットメント比率・リーダーシップ条件・リスク分担が論点となった。",
        "outcome": "JV比率35%で参加し、設計責任は米側パートナー、施工管理は鹿島がリードするスキームで合意。教訓: JVは責任分担を「強みベース」で組むことで、対等比率でなくてもwin-winになる。比率交渉に固執せず役割で勝つ。",
    },
    {
        "title": "業界M&A加速時の老舗GC買収機会判断",
        "project_type": "M&A",
        "summary": "マイアミの58年続いた老舗GCが経営交代を機に事業売却を検討。米国南部市場参入の機会だが、文化統合リスク・労務承継・既存債務評価が課題。買収価格1.2億ドルで提示された。",
        "outcome": "経営陣・キーマン残留を条件に買収実行。既存案件保証は売主側SPCにエスクロー留保。教訓: 業界M&Aは「人」が時価。キーパーソン契約期間が買収価値の半分を決める。アーンアウト条項を厚めに設計する。",
    },
    {
        "title": "競合の安全文化先進化への対応戦略",
        "project_type": "M&A",
        "summary": "競合大手3社がAI安全ツール・心理的安全性プログラム・全社ウェルビーイング戦略で業界アワード独占。鹿島の人材獲得力・受注競争力への中期的影響を経営が評価する必要があった。",
        "outcome": "「安全文化推進室」をCEO直轄で新設（25名）。3年計画で外部広報・内部投資を年間15億円。教訓: 競合の文化的優位は財務指標より遅れて入札勝率に効く。早期キャッチアップ必須で、追いつくより追い越す投資水準を選ぶ。",
    },
    # ── Crisis / Reputation (3) ──────────────────────────────────────────────
    {
        "title": "メンタルヘルス・ウェルビーイング全社推進判断",
        "project_type": "Crisis",
        "summary": "建設業界のメンタルヘルス研修をCPRと同等に扱う動きが米国で加速。社内自殺・離職データの内部分析で同様問題が顕在化。メンタルヘルス推進プログラムの予算と人事制度改革が論点となった。",
        "outcome": "全管理職向けメンタルヘルス研修必須化（年4時間）。社内EAP（従業員支援プログラム）を24時間化。年間予算8億円。教訓: 業界全体の動きが先行する課題は遅れると採用市場で致命傷。優秀層の流出が顕在化してからでは取り返しがつかない。",
    },
    {
        "title": "政治的にセンシティブな案件の請負判断（連邦バルーム改修）",
        "project_type": "Crisis",
        "summary": "米国共和党がトランプ大統領バルーム向け10億ドルのセキュリティ改修費を法案に追加。鹿島米国子会社にも入札参加打診。政治的中立性・国家プロジェクト保安リスク・社内ステークホルダー反応が論点となった。",
        "outcome": "入札不参加を決定。理由は政治的中立性維持と国家保安リスクの不確実性。同時期の他公共案件（連邦庁舎）には積極参加。教訓: 個別案件の高利益と長期ブランド価値のトレードオフを明示し、後者を優先する規律を保つ。判断基準を文書化する。",
    },
    {
        "title": "業界スキャンダル発生時のステークホルダー対応",
        "project_type": "Crisis",
        "summary": "業界他社で重大談合事件が発覚。鹿島には直接関与なしも、調達担当役員へのメディア質問・取引先からの自社事案有無の照会が殺到。コンプライアンス再確認と外部広報の方針が論点となった。",
        "outcome": "CEO直轄でコンプライアンス第三者調査を30日で完了。プレスリリース＋取引先1,000社への文書通知を一斉発出。教訓: 業界スキャンダルは関与なしでも「不作為」と見られないよう即時可視的対応が必須。ファクトより認知が先に動く前に手を打つ。",
    },
]


def embed(client: genai.Client, text: str) -> list[float]:
    res = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
    )
    if hasattr(res, "embeddings"):
        return list(res.embeddings[0].values)
    return list(res.embedding.values)  # type: ignore


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Cases to seed: {len(CASES)}")
    print(f"Schema: {SCHEMA} | Embed dim: {EMBED_DIM} | dry-run: {args.dry_run}")
    print("=" * 70)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(schema=SCHEMA))  # type: ignore[call-arg]

    # Dedup by title
    existing = sb.table("reference_cases").select("title").execute().data or []
    existing_titles = {r["title"] for r in existing}
    print(f"Existing rows: {len(existing_titles)}")

    new_cases = [c for c in CASES if c["title"] not in existing_titles]
    skipped = len(CASES) - len(new_cases)
    print(f"To insert: {len(new_cases)} | Skipped (already exist): {skipped}")
    if not new_cases:
        print("Nothing to do.")
        return

    if args.dry_run:
        for c in new_cases:
            print(f"  [DRY] {c['project_type']:15} {c['title']}")
        return

    gemini = genai.Client(api_key=GEMINI_KEY)

    rows = []
    for i, c in enumerate(new_cases, 1):
        text_for_embed = "\n".join([c["title"], c["summary"], c["outcome"]])
        try:
            vec = embed(gemini, text_for_embed)
        except Exception as e:
            print(f"  [{i}/{len(new_cases)}] embed failed: {e}")
            continue
        rows.append({**c, "embedding": vec})
        print(f"  [{i}/{len(new_cases)}] embedded: {c['title'][:50]}")
        time.sleep(0.2)

    if not rows:
        print("No rows to insert (all embeds failed).")
        return

    res = sb.table("reference_cases").insert(rows).execute()
    inserted = len(res.data or [])
    print("=" * 70)
    print(f"Inserted: {inserted} / Attempted: {len(rows)}")


if __name__ == "__main__":
    main()
