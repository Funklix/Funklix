'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const migrationPath = 'migrations/20260911_bw33_5_supabase_rls_hardening.sql';
const rollbackPath = 'migrations/20260911_bw33_5_supabase_rls_hardening.rollback.sql';
const migration = fs.readFileSync(path.join(root, migrationPath), 'utf8');
const rollback = fs.readFileSync(path.join(root, rollbackPath), 'utf8');
const tables = [
  'brands', 'social_publish_jobs', 'social_provider_attempts', 'brand_documents',
  'brand_document_upload_intents', 'brand_document_processing_jobs',
  'brand_document_processing_results', 'social_external_posts', 'brand_members',
  'social_token_secrets', 'social_connected_accounts', 'social_oauth_attempts', 'boards'
];

for (const table of tables) {
  assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
  assert.match(migration, new RegExp(`['"]${table}['"]`));
}
assert.strictEqual((migration.match(/ENABLE ROW LEVEL SECURITY;/g) || []).length, 13);
assert.match(migration, /REVOKE ALL PRIVILEGES[\s\S]+FROM anon, authenticated;/);
assert.match(migration, /AS RESTRICTIVE FOR ALL TO anon, authenticated USING \(false\) WITH CHECK \(false\)/);
assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)|FORCE ROW LEVEL SECURITY/i);
assert.doesNotMatch(migration, /\b(?:GRANT|INSERT INTO|UPDATE|DELETE FROM|TRUNCATE|DROP TABLE|CREATE TABLE|ALTER TABLE[^;]*(?:ADD|DROP|ALTER COLUMN|OWNER))\b/i);
assert.match(migration, /pg_policies/);
assert.match(migration, /role_table_grants/);
assert.match(rollback, /DROP POLICY IF EXISTS/);
assert.match(rollback, /public\.boards was already RLS-enabled|boards was already RLS-enabled/);

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const allowed = new Set([migrationPath, rollbackPath, 'scripts/check-bw33-5-supabase-rls-hardening.js',
  'docs/audits/bw33-5-supabase-rls-hardening.md', 'docs/runbooks/bw33-5-rls-hardening.md',
  'package.json', '.github/workflows/runtime-boot-safety.yml']);
assert.deepStrictEqual(changed.filter(file => !allowed.has(file)), [], 'application/auth/API/UI files must remain unchanged');

const browserSources = ['app.js', 'index.html', 'content-workspace.js', 'campaign-v3.js']
  .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
assert.doesNotMatch(browserSources, /SUPABASE_(?:SERVICE_ROLE|ANON)_KEY|DATABASE_URL|POSTGRES_URL|\/rest\/v1|@supabase\/supabase-js/i);
assert.match(fs.readFileSync(path.join(root, 'api/_boards-storage.js'), 'utf8'),
  /new Pool\(\{ connectionString: process\.env\.POSTGRES_URL \}\)/);
assert.doesNotMatch(migration + rollback, /postgres(?:ql)?:\/\/|SUPABASE_[A-Z_]*KEY\s*=|POSTGRES_URL\s*=/i);
assert.doesNotMatch(migration + rollback, /supabase\s+(?:db push|migration up)|psql\s|curl\s/i);

const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
assert.match(workflow, /check:bw33\.4b4\.2[\s\S]*check:bw33\.5/);
console.log('BW-33.5 static RLS hardening contract passed; no database command was executed.');
