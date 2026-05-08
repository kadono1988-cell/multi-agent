"""
Quick verification of RAG retrieval against the multi_agent.reference_cases table.

Embeds a few sample query texts (typical project + news-discussion queries) using
Gemini embeddings and calls the pgvector RPC `match_reference_cases` to inspect
which past cases are surfaced and how distant they are.

Run from C:/Projects/multi-agent:
    python scripts/verify_rag.py
"""
from __future__ import annotations
import os
import sys
from pathlib import Path

import google.genai as genai
from dotenv import load_dotenv
from supabase import create_client, ClientOptions

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"]
SUPABASE_KEY = os.environ["VITE_SUPABASE_ANON_KEY"]
SCHEMA = os.environ.get("VITE_SUPABASE_SCHEMA", "multi_agent")
GEMINI_KEY = os.environ["VITE_GEMINI_API_KEY"]

EMBED_MODEL = "gemini-embedding-001"
MATCH_COUNT = 5

QUERIES = [
    ("Residential delay typical",
     "築40年の分譲マンション建替プロジェクト。基礎工事中に予期しない地中障害物が見つかり、工期が3ヶ月遅延見込み。販売スケジュールへの影響と追加コスト負担の判断が必要。"),
    ("Commercial Go/No-Go",
     "都心部の大型商業ビル開発プロジェクトで、テナント候補のリーシング進捗が想定の60%。プロジェクト続行（Go）か縮小・撤退（No-Go）の経営判断を行う。"),
    ("News: AI safety tools",
     "Skanska・Turner・Balfour Beatty などの大手ゼネコンが現場安全管理に AI を導入し始めている業界トレンド。鹿島としてどう対応すべきかを議論する。"),
    ("News: Data center boom",
     "Jacobs CEO が「データセンター投資サイクルは初期段階」と発言し、業界各社が AI データセンター開発に注力している。鹿島の建築事業セグメントとして取るべき戦略を議論する。"),
    ("News: Wage compliance enforcement",
     "ミネソタ州が建設会社から128万ドルの未払い賃金を回収した事案。協力会社の労務管理を強化すべきかを議論する。"),
]


def embed(client: genai.Client, text: str) -> list[float]:
    # Match the frontend (gemini.ts: outputDimensionality: 768) so vectors fit
    # the existing 768-dim pgvector column.
    from google.genai import types
    res = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=768),
    )
    if hasattr(res, "embeddings"):
        return list(res.embeddings[0].values)
    return list(res.embedding.values)  # type: ignore


def main() -> None:
    gemini = genai.Client(api_key=GEMINI_KEY)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(schema=SCHEMA))  # type: ignore[call-arg]

    print(f"Schema: {SCHEMA}")
    print(f"Embed model: {EMBED_MODEL}")
    print(f"match_count per query: {MATCH_COUNT}")
    print("=" * 70)

    for label, qtext in QUERIES:
        print(f"\n[{label}]")
        print(f"Query: {qtext[:80]}{'…' if len(qtext) > 80 else ''}")
        try:
            vec = embed(gemini, qtext)
        except Exception as e:
            print(f"  embed failed: {e}")
            continue

        try:
            res = sb.rpc(
                "match_reference_cases",
                {"query_embedding": vec, "match_count": MATCH_COUNT},
            ).execute()
        except Exception as e:
            print(f"  rpc failed: {e}")
            continue

        rows = res.data or []
        if not rows:
            print("  (no matches returned)")
            continue

        for i, r in enumerate(rows, 1):
            sim = r.get("similarity")
            if sim is None and "distance" in r:
                sim = 1 - r["distance"]
            sim_str = f"{sim:.3f}" if isinstance(sim, (int, float)) else "?"
            ptype = r.get("project_type", "?")
            title = r.get("title", "(no title)")
            print(f"  {i}. sim={sim_str}  [{ptype}]  {title[:60]}")


if __name__ == "__main__":
    main()
