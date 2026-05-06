// Ingest PDFs from rag-sources/kajima/ into Supabase rag_documents + rag_chunks.
//
// Usage:
//   node scripts/ingest_kajima_docs.mjs           # skip already-ingested files
//   node scripts/ingest_kajima_docs.mjs --update  # re-ingest all files (deletes old chunks)

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const env = {};
for (const line of readFileSync(resolve(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  db: { schema: 'multi_agent' },
});
const genAI = new GoogleGenerativeAI(env.VITE_GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

// Folder name → metadata resolver
const SOURCE_METADATA = {
  '有価証券報告書': (filename) => {
    if (filename.includes('129') || filename.includes('半期')) {
      return { source_type: '有価証券報告書', period: '2024年9月期（半期）' };
    }
    return { source_type: '有価証券報告書', period: '2024年3月期（通期）' };
  },
  '統合報告書': () => ({ source_type: '統合報告書', period: '2024年版' }),
  '決算説明会': (filename) => {
    const m = filename.match(/(\d{8})/);
    if (m) {
      const d = m[1];
      return { source_type: '決算説明会資料', period: `${d.slice(0, 4)}年${d.slice(4, 6)}月期` };
    }
    return { source_type: '決算説明会資料', period: '' };
  },
  '中期経営計画資料': () => ({ source_type: '中期経営計画資料', period: '2024年策定' }),
  'コーポレートガバナンス報告書': () => ({ source_type: 'コーポレートガバナンス報告書', period: '2024年版' }),
};

// Detect Japanese/numbered section headers
function isSectionHeader(line) {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  return [
    /^第[一二三四五六七八九十百千]+[部章節項]/,
    /^\d+\.\s+\S/,
    /^[IVX]+\.\s+\S/,
    /^[■●▶◆【].{1,40}/,
    /^\([一二三四五六七八九十]+\)\s+\S/,
    /^[（(]\d+[）)]\s+\S/,
    /^[①②③④⑤⑥⑦⑧⑨⑩]\s*\S/,
  ].some(p => p.test(t));
}

// Split text into section-based chunks. Oversized chunks are split at paragraphs.
function chunkBySection(text, maxSize = 900) {
  const lines = text.split('\n');
  const chunks = [];
  let currentTitle = '';
  let buf = [];

  const flush = () => {
    const content = buf.join('\n').trim();
    buf = [];
    if (content.length < 80) return;
    if (content.length <= maxSize) {
      chunks.push({ section_title: currentTitle, content });
      return;
    }
    // Split oversize chunk at paragraph breaks
    let acc = '';
    for (const para of content.split(/\n\n+/)) {
      if (acc.length + para.length > maxSize && acc.length >= 80) {
        chunks.push({ section_title: currentTitle, content: acc.trim() });
        acc = para;
      } else {
        acc += (acc ? '\n\n' : '') + para;
      }
    }
    if (acc.trim().length >= 80) chunks.push({ section_title: currentTitle, content: acc.trim() });
  };

  for (const line of lines) {
    if (isSectionHeader(line) && buf.join('').trim().length > 50) {
      flush();
      currentTitle = line.trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function embedWithRetry(text, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await embedModel.embedContent({
        content: { parts: [{ text: text.slice(0, 3000) }] },
        outputDimensionality: 768,
      });
      return res.embedding.values;
    } catch (err) {
      if (i < retries - 1) await sleep(2000 * (i + 1));
      else throw err;
    }
  }
}

async function processFile(filePath, folderName, isUpdate) {
  const fileName = basename(filePath);
  console.log(`\n📄 ${fileName}`);

  const metaFn = SOURCE_METADATA[folderName];
  if (!metaFn) { console.warn(`  Unknown folder: ${folderName}`); return; }
  const { source_type, period } = metaFn(fileName);

  // Check existing record
  const { data: existing } = await supabase
    .from('rag_documents')
    .select('id, chunk_count')
    .eq('file_name', fileName)
    .maybeSingle();

  if (existing && !isUpdate) {
    console.log(`  Skipped (${existing.chunk_count} chunks already). Use --update to re-ingest.`);
    return;
  }

  // Extract text
  const pdfBuffer = readFileSync(filePath);
  const pdfData = await pdfParse(pdfBuffer);
  const totalChars = pdfData.text.length;
  console.log(`  Pages: ${pdfData.numpages}, chars: ${totalChars}`);

  const chunks = chunkBySection(pdfData.text);
  console.log(`  Chunks: ${chunks.length}`);

  // Upsert document record
  let docId;
  if (existing) {
    await supabase.from('rag_chunks').delete().eq('document_id', existing.id);
    await supabase.from('rag_documents')
      .update({ chunk_count: 0, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    docId = existing.id;
  } else {
    const { data: doc, error } = await supabase
      .from('rag_documents')
      .insert({ file_name: fileName, source_type, period, file_path: filePath, chunk_count: 0 })
      .select('id').single();
    if (error) { console.error('  Insert doc failed:', error.message); return; }
    docId = doc.id;
  }

  // Embed and insert chunks
  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { section_title, content } = chunks[i];
    process.stdout.write(`\r  Embedding ${i + 1}/${chunks.length}...`);
    try {
      const embedding = await embedWithRetry([section_title, content].filter(Boolean).join('\n'));
      const { error } = await supabase.from('rag_chunks').insert({
        document_id: docId,
        section_title: section_title || null,
        page_hint: null,
        content,
        embedding,
      });
      if (!error) inserted++;
      else console.error(`\n  Chunk insert error:`, error.message);
    } catch (err) {
      console.error(`\n  Embed failed chunk ${i + 1}:`, err.message);
    }
    await sleep(60); // ~16 req/s, well within Gemini free tier
  }

  await supabase.from('rag_documents').update({ chunk_count: inserted }).eq('id', docId);
  console.log(`\n  ✅ ${inserted}/${chunks.length} chunks inserted`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const isUpdate = process.argv.includes('--update');
const ragRoot = resolve(__dirname, '..', 'rag-sources', 'kajima');

let totalFiles = 0;
for (const folder of Object.keys(SOURCE_METADATA)) {
  let files;
  try {
    files = readdirSync(join(ragRoot, folder)).filter(f => f.toLowerCase().endsWith('.pdf'));
  } catch {
    console.warn(`⚠️  Folder not found: ${folder}`);
    continue;
  }
  for (const file of files) {
    await processFile(join(ragRoot, folder, file), folder, isUpdate);
    totalFiles++;
  }
}
console.log(`\n🎉 Done. Processed ${totalFiles} PDF files.`);
