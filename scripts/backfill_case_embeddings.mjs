// One-shot: embed every reference_cases row with gemini-embedding-001 (768 dim)
// and write the vector back. Idempotent — only re-embeds rows where embedding IS NULL.
//
// Run: node scripts/backfill_case_embeddings.mjs
// Reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY from .env.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader — avoids adding dotenv as a dependency.
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

const { data: rows, error } = await supabase
  .from('reference_cases')
  .select('id, title, project_type, summary, outcome')
  .is('embedding', null);

if (error) {
  console.error('Fetch failed:', error);
  process.exit(1);
}
console.log(`Embedding ${rows.length} cases...`);

let done = 0;
for (const row of rows) {
  const text = [row.title, row.project_type, row.summary, row.outcome].filter(Boolean).join('\n');
  const result = await embedModel.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  });
  const vec = result.embedding.values;

  const { error: upErr } = await supabase
    .from('reference_cases')
    .update({ embedding: vec })
    .eq('id', row.id);
  if (upErr) {
    console.error(`Failed to update ${row.title}:`, upErr);
    continue;
  }
  done++;
  process.stdout.write(`\r  ${done}/${rows.length}`);
}
console.log(`\nDone. Embedded ${done}/${rows.length} cases.`);
