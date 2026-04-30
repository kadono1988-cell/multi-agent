// Apply SQL migration via Supabase Management API
// Usage: node scripts/apply_migration.mjs <path-to-sql>
// Reads SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF from .env

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dep needed for one-off)
const envPath = join(__dirname, '..', '.env');
const env = {};
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env');
  process.exit(1);
}

const sqlPath = resolve(process.argv[2] || join(__dirname, '..', 'supabase', 'migration_20260430_tier_organization.sql'));
const sql = readFileSync(sqlPath, 'utf-8');
console.log(`Applying ${sqlPath} to project ${ref}...`);
console.log(`SQL size: ${sql.length} chars\n`);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  const json = JSON.parse(text);
  console.log(JSON.stringify(json, null, 2));
} catch {
  console.log(text);
}

if (!res.ok) process.exit(1);
console.log('\n✅ Migration applied');
