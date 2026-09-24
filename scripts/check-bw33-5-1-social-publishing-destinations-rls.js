'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const originalPath = 'migrations/20260911_bw33_5_supabase_rls_hardening.sql';
const migrationPath = 'migrations/20260914_bw33_5_1_social_publishing_destinations_rls.sql';
const verifyPath = 'migrations/20260914_bw33_5_1_social_publishing_destinations_rls.verify.sql';
const rollbackPath = 'migrations/20260914_bw33_5_1_social_publishing_destinations_rls.rollback.sql';
const auditPath = 'docs/audits/bw33-5-1-social-publishing-destinations-rls.md';
const runbookPath = 'docs/runbooks/bw33-5-1-social-publishing-destinations-rls.md';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const original = read(originalPath);
const migration = read(migrationPath);
const verify = read(verifyPath);
const rollback = read(rollbackPath);
const audit = read(auditPath);
const runbook = read(runbookPath);

assert.strictEqual(
  crypto.createHash('sha256').update(original).digest('hex'),
  '7ceb2d22647d1c5bc0526ff9f1d72698d5f37086c573c4d2db763e44af561b27',
  'the applied BW-33.5 migration must remain byte-for-byte unchanged'
);

const target = 'public.social_publishing_destinations';
const firstMutation = Math.min(
  migration.indexOf(`ALTER TABLE ${target}`),
  migration.indexOf('REVOKE ALL PRIVILEGES')
);
assert.match(migration, /^--[^\n]*\n--[^\n]*\nBEGIN;/);
assert.match(migration, /COMMIT;\s*$/);
assert(firstMutation > 0, 'expected catalog mutations');
assert(migration.indexOf(`to_regclass('${target}')`) < firstMutation, 'existence guard must precede mutation');
assert(migration.indexOf("policyname <> 'bw33_5_deny_supabase_api_roles'") < firstMutation, 'policy guard must precede mutation');
assert(migration.indexOf('RAISE EXCEPTION') < firstMutation, 'guards must abort before mutation');
assert.match(migration, new RegExp(`ALTER TABLE ${target.replace('.', '\\.') } ENABLE ROW LEVEL SECURITY;`));
assert.doesNotMatch(migration, /FORCE ROW LEVEL SECURITY/i);
assert.match(migration, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE ${target.replace('.', '\\.')}[\\s\\S]+FROM anon, authenticated;`));
assert.match(migration, /CREATE POLICY bw33_5_deny_supabase_api_roles[\s\S]+AS RESTRICTIVE[\s\S]+FOR ALL[\s\S]+TO anon, authenticated[\s\S]+USING \(false\)[\s\S]+WITH CHECK \(false\)/);
assert.match(migration, /IF NOT EXISTS[\s\S]+policyname = 'bw33_5_deny_supabase_api_roles'/);
assert.doesNotMatch(migration, /AS PERMISSIVE|TO PUBLIC|USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)/i);
assert.doesNotMatch(migration, /CREATE\s+(?:TABLE|INDEX|TRIGGER|SEQUENCE)|DROP\s+(?:TABLE|INDEX|TRIGGER|SEQUENCE)|INSERT\s+INTO|UPDATE\s+[^\n]+SET|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE[^;]*(?:ADD|DROP|ALTER\s+COLUMN|OWNER)|GRANT\s+/i);

const qualifiedTables = new Set(migration.match(/public\.[a-z_]+/g));
assert.deepStrictEqual([...qualifiedTables], [target], 'delta must cover exactly one table');

assert.match(verify, /table_name[\s\S]+rls_enabled[\s\S]+rls_forced[\s\S]+deny_policy[\s\S]+anon_privileges[\s\S]+authenticated_privileges[\s\S]+compliant/);
assert.match(verify, /p\.permissive = 'RESTRICTIVE'/);
assert.match(verify, /p\.roles @> ARRAY\['anon', 'authenticated'\]::name\[\]/);
assert.match(verify, /cardinality\(p\.roles\) = 2/);
assert.match(verify, /p\.qual = 'false'[\s\S]+p\.with_check = 'false'/);
assert.doesNotMatch(verify, /\b(?:ALTER|CREATE|DROP|REVOKE|GRANT|INSERT|UPDATE|DELETE|TRUNCATE|DO)\b/i);
assert.strictEqual((verify.match(/social_publishing_destinations/g) || []).length, 1);

assert.match(rollback, /BEGIN;[\s\S]+DROP POLICY IF EXISTS bw33_5_deny_supabase_api_roles[\s\S]+ON public\.social_publishing_destinations;[\s\S]+ALTER TABLE public\.social_publishing_destinations DISABLE ROW LEVEL SECURITY;[\s\S]+COMMIT;/);
assert.strictEqual((rollback.match(/public\.[a-z_]+/g) || []).filter((value, index, all) => all.indexOf(value) === index).join(','), target);
assert.doesNotMatch(rollback, /\bGRANT\b|\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);

const originalTables = new Set([
  'boards', 'brands', 'social_publish_jobs', 'social_provider_attempts',
  'brand_documents', 'brand_document_upload_intents', 'brand_document_processing_jobs',
  'brand_document_processing_results', 'social_external_posts', 'brand_members',
  'social_token_secrets', 'social_connected_accounts', 'social_oauth_attempts'
]);
for (const table of originalTables) assert(original.includes(`'${table}'`), `${table} missing from original migration`);
assert.strictEqual(originalTables.size, 13);
const protectedTables = new Set([...originalTables, 'social_publishing_destinations']);
assert.strictEqual(protectedTables.size, 14);

const runtimeSchema = [
  read('api/_boards-storage.js'),
  read('api/_brands-storage.js'),
  read('api/_document-records.js'),
  read('api/_document-processing-records.js'),
  read('api/social-connector/schema.js')
].join('\n');
const representedTables = new Set(
  [...runtimeSchema.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)]
    .map(match => match[1])
);
const separatelyInventoried = new Set(['board_editors', 'social_connector_schema_version']);
assert.deepStrictEqual(
  [...representedTables].sort(),
  [...new Set([...protectedTables, ...separatelyInventoried])].sort(),
  'a user-created runtime table is missing from the documented inventory'
);
for (const table of representedTables) assert(audit.includes(`\`${table}\``), `${table} is silently absent from the audit`);

assert.match(audit, /server-side[\s\S]+pg\.Pool[\s\S]+POSTGRES_URL/);
assert.match(audit, /SELECT[\s\S]+INSERT \/ UPDATE[\s\S]+UPDATE[\s\S]+DELETE/);
assert.match(audit, /omitted[\s\S]+not created after/i);
assert.match(runbook, /1\. Confirm the application still works before execution\.[\s\S]+16\. Confirm zero remaining security errors\./);

const packageJson = JSON.parse(read('package.json'));
assert.strictEqual(packageJson.scripts['check:bw33.5.1'], 'node scripts/check-bw33-5-1-social-publishing-destinations-rls.js');
const workflow = read('.github/workflows/runtime-boot-safety.yml');
assert.match(workflow, /run: npm run check:bw33\.5\s+[\s\S]*?run: npm run check:bw33\.5\.1/);

assert.doesNotMatch(migration + verify + rollback, /postgres(?:ql)?:\/\/|POSTGRES_URL\s*=|SUPABASE_[A-Z_]*KEY\s*=/i);

console.log('BW-33.5.1 one-table RLS delta contract passed; no database command was executed.');
