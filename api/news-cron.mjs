/**
 * POST /api/news-cron
 * Weekly construction industry news RSS collector.
 * Called by GitHub Actions cron (see .github/workflows/news-cron.yml).
 *
 * Flow:
 *   1. Validate CRON_SECRET
 *   2. Fetch RSS feeds in parallel (5 feeds, 2s timeout each)
 *   3. Parse + dedupe by URL
 *   4. Select top 3 recent articles matching construction keywords
 *   5. Call Gemini suggestTopicFromNews for each → structured JSON
 *   6. Upsert into multi_agent.news_suggestions (URL-based dedupe)
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Config ───────────────────────────────────────────────────────────────────

const FEEDS = [
  { name: 'ENR',                url: 'https://www.enr.com/rss/all' },
  { name: 'Construction Dive',  url: 'https://www.constructiondive.com/feeds/news/' },
  { name: 'The Construction Index', url: 'https://www.theconstructionindex.co.uk/feeds/news.xml/' },
  { name: 'Autodesk Blog',      url: 'https://blogs.autodesk.com/feed/' },
  { name: 'Nikkei XTech',       url: 'https://xtech.nikkei.com/atcl/nxt/column/18/02002/feed/' },
];

const KEYWORDS = [
  'construction', 'contractor', 'building', 'infrastructure', 'project',
  'concrete', 'steel', 'BIM', 'DX', 'safety', 'cost overrun', 'delay',
  '建設', '施工', 'ゼネコン', '工事', '建築',
];

const MAX_ARTICLES = 3;
const FETCH_TIMEOUT_MS = 2000;
const GEMINI_TIMEOUT_MS = 7000;

// ── Supabase + Gemini init ───────────────────────────────────────────────────

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { db: { schema: 'multi_agent' } }
);

const gemini = new GoogleGenerativeAI(
  process.env.GEMINI_NEWS_API_KEY || process.env.VITE_GEMINI_API_KEY
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsCron/1.0)' },
  }).finally(() => clearTimeout(timer));
}

function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) ||
                   /<title[^>]*>([\s\S]*?)<\/title>/.exec(block))?.[1]?.trim() || '';
    const link  = (/<link>([\s\S]*?)<\/link>/.exec(block))?.[1]?.trim() ||
                  (/<link[^>]+href="([^"]+)"/.exec(block))?.[1]?.trim() || '';
    const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block))?.[1]?.trim() || '';
    if (title && link) items.push({ title, link, pubDate });
  }
  return items;
}

function isRecent(pubDateStr) {
  if (!pubDateStr) return true;
  try {
    const d = new Date(pubDateStr);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

function matchesKeywords(title) {
  const lower = title.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

async function callGeminiSuggest(newsText) {
  const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const prompt = `次のニュース記事を読み、建設会社の経営会議で議論すべき「議題」と議論用プロジェクト簡易プロファイルをJSONのみで提案してください。すべて日本語で。

【ニュース原文】
${newsText.slice(0, 3000)}

【出力JSONスキーマ厳守】
{
  "project_name": "新規プロジェクト名 (30字以内)",
  "project_summary": "状況・課題の要約 (200字以内)",
  "project_type": "Residential | Commercial | Infrastructure | Industrial | Public | Other",
  "strategic_importance": "high | medium | low",
  "recommended_theme": "delay | go_no_go | design_change またはカスタムテーマ",
  "focus_points": "重視すべき視点 (1-2文)",
  "user_context": "相談内容テキスト (1-2文)",
  "constraints": "制約条件",
  "goal": "議論で得たい結論 (1文)"
}`;

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS)),
  ]);

  const raw = result.response.text();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate CRON_SECRET
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch RSS feeds in parallel
    const feedResults = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const r = await fetchWithTimeout(feed.url, FETCH_TIMEOUT_MS);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const xml = await r.text();
        return { feed: feed.name, items: parseRssItems(xml) };
      })
    );

    // 2. Collect + dedupe by URL
    const seen = new Set();
    const candidates = [];
    for (const result of feedResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value.items) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);
        if (isRecent(item.pubDate) && matchesKeywords(item.title)) {
          candidates.push({ ...item, feedName: result.value.feed });
        }
      }
    }

    // 3. Sort by date desc, take top N
    candidates.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    const top = candidates.slice(0, MAX_ARTICLES);

    if (top.length === 0) {
      return res.status(200).json({ message: 'No relevant articles found', inserted: 0 });
    }

    // 4. Gemini suggestions in parallel
    const suggestions = await Promise.allSettled(
      top.map(async (article) => {
        const newsText = `${article.title}\n${article.link}`;
        const suggested = await callGeminiSuggest(newsText);
        return { article, suggested };
      })
    );

    // 5. Upsert into Supabase
    let inserted = 0;
    for (const r of suggestions) {
      if (r.status !== 'fulfilled' || !r.value.suggested) continue;
      const { article, suggested } = r.value;
      const { error } = await supabase.from('news_suggestions').upsert(
        {
          source_url: article.link,
          source_title: article.title,
          source_feed: article.feedName,
          source_published_at: article.pubDate ? new Date(article.pubDate).toISOString() : null,
          suggested_theme: suggested.recommended_theme || null,
          suggested_focus: suggested.focus_points || null,
          suggested_summary: suggested.project_summary || null,
          suggested_project: suggested,
          status: 'pending',
        },
        { onConflict: 'source_url', ignoreDuplicates: true }
      );
      if (!error) inserted++;
    }

    return res.status(200).json({
      feeds_fetched: feedResults.filter(r => r.status === 'fulfilled').length,
      candidates_found: candidates.length,
      articles_processed: top.length,
      inserted,
    });

  } catch (err) {
    console.error('[news-cron] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
