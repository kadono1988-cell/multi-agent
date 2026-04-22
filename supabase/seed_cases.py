"""Generate 50 synthetic construction decision cases via Gemini and insert into
multi_agent.reference_cases (Supabase West).

Usage:
    python seed_cases.py

Requires env vars in ../.env:
    VITE_GEMINI_API_KEY
    SUPABASE_ACCESS_TOKEN
    SUPABASE_PROJECT_REF
"""
from __future__ import annotations
import json
import os
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE.parent / ".env"


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


env = load_env(ENV_FILE)
GEMINI_KEY = env["VITE_GEMINI_API_KEY"]
PAT = env["SUPABASE_ACCESS_TOKEN"]
REF = env["SUPABASE_PROJECT_REF"]
MODEL = "gemini-2.5-flash-lite"

CATEGORIES = [
    ("Residential", "集合住宅（タワーマンション/中高層マンション/戸建分譲/リフォーム）"),
    ("Commercial", "商業施設（オフィスビル/ショッピングモール/ホテル/複合ビル）"),
    ("Infrastructure", "土木インフラ（道路/橋梁/トンネル/ダム/下水道）"),
    ("Industrial", "工業施設（工場/物流倉庫/データセンター）"),
    ("Public", "公共建築（病院/学校/庁舎/文化施設）"),
]
THEMES = ["工期遅延", "Go/No-Go 判断", "設計変更"]


def gemini_generate(prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_KEY}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.9},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    return data["candidates"][0]["content"]["parts"][0]["text"]


def build_prompt(project_type_en: str, project_type_ja: str, n: int) -> str:
    themes_list = "、".join(THEMES)
    return f"""あなたは日本の大手ゼネコン（鹿島建設）のナレッジマネジメント担当です。
過去に実際にありそうな建設プロジェクトの意思決定事例を {n} 件、JSON 配列形式で生成してください。

【カテゴリ】{project_type_ja}
【テーマの配分】{themes_list} をまんべんなく含めること
【1件あたりのフィールド】
- title: プロジェクト事例の名称（30字以内、架空のもの・実社名は避ける）
- project_type: "{project_type_en}"
- summary: プロジェクト概要と意思決定に至った状況（150〜250字、日本語）
- outcome: 最終判断と学んだ教訓（100〜200字、日本語）

【制約】
- 実在企業名・地名は避け、「A県B市」「X社」のように抽象化する
- summary には規模・予算レンジ・関係者・制約・論点を含める
- outcome は「結果どうなったか」＋「得た教訓」の2要素を明記

出力は次の形式の JSON 配列のみ（前後に文章を付けない）:
[{{"title":"...","project_type":"{project_type_en}","summary":"...","outcome":"..."}}, ...]
"""


def insert_cases(cases: list[dict]) -> None:
    # Build a multi-row INSERT with safe single-quote escaping
    def esc(s: str) -> str:
        return s.replace("'", "''")

    values = ",\n".join(
        f"('{esc(c['title'])}', '{esc(c['project_type'])}', '{esc(c['summary'])}', '{esc(c['outcome'])}')"
        for c in cases
    )
    sql = (
        "INSERT INTO multi_agent.reference_cases (title, project_type, summary, outcome) VALUES\n"
        + values + ";"
    )
    url = f"https://api.supabase.com/v1/projects/{REF}/database/query"
    req = urllib.request.Request(
        url, data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json", "User-Agent": "multi-agent-seed/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = r.read().decode("utf-8")
        print(f"  Insert OK. Response: {resp[:120]}")
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode('utf-8')[:500]}")
        raise


def main() -> None:
    # Clear existing cases first
    url = f"https://api.supabase.com/v1/projects/{REF}/database/query"
    req = urllib.request.Request(
        url, data=json.dumps({"query": "DELETE FROM multi_agent.reference_cases;"}).encode("utf-8"),
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json", "User-Agent": "multi-agent-seed/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        r.read()
    print("Cleared existing reference_cases.")

    all_cases: list[dict] = []
    per_category = 10  # 5 categories * 10 = 50
    for en, ja in CATEGORIES:
        print(f"Generating {per_category} cases for {en} ({ja}) ...")
        prompt = build_prompt(en, ja, per_category)
        for attempt in range(3):
            try:
                raw = gemini_generate(prompt)
                cases = json.loads(raw)
                if not isinstance(cases, list) or len(cases) < per_category:
                    raise ValueError(f"Expected {per_category} cases, got {len(cases) if isinstance(cases, list) else '?'}")
                # Validate
                for c in cases[:per_category]:
                    for k in ("title", "project_type", "summary", "outcome"):
                        assert k in c and isinstance(c[k], str) and c[k].strip()
                all_cases.extend(cases[:per_category])
                print(f"  OK: {len(cases[:per_category])} cases")
                break
            except Exception as e:
                print(f"  Attempt {attempt+1} failed: {e}")
                time.sleep(2 * (attempt + 1))
        else:
            print(f"!! Giving up on {en}")
            sys.exit(1)

    print(f"Total generated: {len(all_cases)}")
    print("Inserting into Supabase ...")
    insert_cases(all_cases)

    # Verify
    req = urllib.request.Request(
        url, data=json.dumps({"query": "SELECT count(*) AS n FROM multi_agent.reference_cases;"}).encode("utf-8"),
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json", "User-Agent": "multi-agent-seed/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        resp = json.loads(r.read().decode("utf-8"))
    print(f"Final count in DB: {resp}")


if __name__ == "__main__":
    main()
