'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationName = '20260928_bw36_6_workspace_schema_foundation.sql';
const migrationPath = path.join(root, 'migrations', migrationName);
const sql = fs.readFileSync(migrationPath, 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/implementation/2026-09-28-bw36-6-workspace-schema-foundation.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
const auth = require(path.join(root, 'api/_workspace-authorization'));

function statements(source) {
  const result = [];
  let current = '', quote = null, dollar = null, lineComment = false, blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index], pair = source.slice(index, index + 2);
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (pair === '*/') { blockComment = false; index += 1; } continue; }
    if (!quote && !dollar && pair === '--') { lineComment = true; index += 1; continue; }
    if (!quote && !dollar && pair === '/*') { blockComment = true; index += 1; continue; }
    if (!quote && char === '$') {
      const tag = source.slice(index).match(/^\$[A-Za-z0-9_]*\$/)?.[0];
      if (tag) { dollar = dollar === tag ? null : (dollar || tag); current += tag; index += tag.length - 1; continue; }
    }
    if (!dollar && (char === "'" || char === '"')) {
      if (quote === char && source[index + 1] === char) { current += char + char; index += 1; continue; }
      quote = quote === char ? null : (quote || char);
    }
    if (char === ';' && !quote && !dollar) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

const parsed = statements(sql);
const normalized = sql.replace(/\s+/g, ' ');
const schemaMigrations = fs.readdirSync(path.join(root, 'migrations')).filter((name) => name.endsWith('.sql') && !name.includes('rollback') && !name.includes('verify')).sort();
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`✓ ${name}\n`); }
function hasStatement(pattern) { return parsed.some((statement) => pattern.test(statement)); }
function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); }

test('the exact immutable BW-36.6 migration is selected while later migrations are allowed', () => {
  assert.equal(path.basename(migrationPath), migrationName);
  assert.equal(schemaMigrations.filter((name) => name === migrationName).length, 1);
  assert.equal(schemaMigrations.filter((name) => /bw36[_-]6/i.test(name)).length, 1);
  assert.equal(sha(`migrations/${migrationName}`), 'd7832add0dd280a05a420fad42c90b81929dae5e72eae9ccc5a7377b1d49a35c');
  const migrationPosition = schemaMigrations.indexOf(migrationName);
  assert.ok(migrationPosition >= 0);
  assert.ok(schemaMigrations.slice(migrationPosition + 1).every((name) => name > migrationName));
  assert.equal(parsed[0].toUpperCase(), 'BEGIN');
  assert.equal(parsed.at(-1).toUpperCase(), 'COMMIT');
});
test('Workspace shape has stable UUID, bounded name, locale/status/revision, actor, timestamps and archive state', () => {
  assert.match(normalized, /CREATE TABLE public\.workspaces \( id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
  assert.match(normalized, /length\(btrim\(name\)\) BETWEEN 1 AND 160/);
  for (const token of ["locale IN ('en', 'de')", "status IN ('active', 'archived')", 'revision >= 1', 'created_by_user_id UUID NOT NULL', 'created_at TIMESTAMPTZ NOT NULL DEFAULT now()', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT now()', 'archived_at TIMESTAMPTZ NULL']) assert.ok(normalized.includes(token), token);
});
test('membership shape has unique identity, exact roles and bounded lifecycle', () => {
  assert.match(normalized, /CREATE TABLE public\.workspace_memberships/);
  assert.match(normalized, /UNIQUE \(workspace_id, user_id\)/);
  assert.match(normalized, /role IN \('owner', 'admin', 'member', 'viewer'\)/);
  assert.match(normalized, /status IN \('pending', 'accepted', 'revoked', 'expired'\)/);
  assert.ok(normalized.includes('invited_by_user_id UUID NULL') && normalized.includes('revoked_at TIMESTAMPTZ NULL'));
});
test('Brand and Board references are nullable, restrictive, indexed and have no default', () => {
  for (const table of ['brands', 'boards']) {
    const alteration = parsed.find((statement) => new RegExp(`^ALTER TABLE public\\.${table} `, 'i').test(statement));
    assert.match(alteration, /ADD COLUMN\s+workspace_id\s+UUID\s+NULL\s+REFERENCES\s+public\.workspaces\(id\)\s+ON DELETE RESTRICT/i);
    assert.doesNotMatch(alteration, /NOT NULL|DEFAULT/i);
    assert.ok(normalized.includes(`CREATE INDEX ${table}_workspace_id_idx ON public.${table} (workspace_id)`));
  }
});
test('query indexes cover Workspaces and memberships', () => {
  for (const index of ['workspaces_status_updated_idx', 'workspace_memberships_user_status_idx', 'workspace_memberships_workspace_status_role_idx']) assert.ok(normalized.includes(`CREATE INDEX ${index}`));
});
test('new tables enable RLS and reads require bounded active membership', () => {
  assert.ok(hasStatement(/^ALTER TABLE public\.workspaces ENABLE ROW LEVEL SECURITY$/i));
  assert.ok(hasStatement(/^ALTER TABLE public\.workspace_memberships ENABLE ROW LEVEL SECURITY$/i));
  assert.match(normalized, /workspace_member_read[\s\S]*FOR SELECT TO authenticated[\s\S]*workspace_has_active_role\(id\)/);
  assert.match(normalized, /user_id = auth\.uid\(\) AND status = 'accepted'/);
  assert.match(normalized, /ARRAY\['owner', 'admin'\]::TEXT\[\]/);
  assert.doesNotMatch(normalized, /USING \(true\)/i);
});
test('writes are service-bounded and grants cannot create orphan Workspaces', () => {
  assert.equal(parsed.filter((statement) => /^CREATE POLICY/i.test(statement)).length, 2);
  assert.ok(parsed.filter((statement) => /^CREATE POLICY/i.test(statement)).every((statement) => /FOR SELECT/i.test(statement)));
  assert.ok(hasStatement(/^REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated$/i));
  assert.ok(hasStatement(/^GRANT SELECT ON TABLE[\s\S]*TO authenticated$/i));
  assert.equal(hasStatement(/^GRANT (?:INSERT|UPDATE|DELETE|ALL)/i), false);
});
test('SQL helper is fixed-path, qualified, bounded, recursion-safe and not public', () => {
  const helper = parsed.find((statement) => /^CREATE FUNCTION public\.workspace_has_active_role/i.test(statement));
  assert.ok(helper);
  assert.match(helper, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog/);
  assert.match(helper, /FROM public\.workspace_memberships/);
  assert.match(helper, /auth\.uid\(\) IS NOT NULL/);
  assert.doesNotMatch(helper, /EXECUTE|format\s*\(/i);
  assert.ok(hasStatement(/^REVOKE ALL ON FUNCTION public\.workspace_has_active_role[\s\S]*FROM PUBLIC, anon$/i));
});
test('last owner downgrade, revocation, deletion, bulk and concurrent boundary are protected', () => {
  const guard = parsed.find((statement) => /^CREATE FUNCTION public\.protect_workspace_last_owner/i.test(statement));
  assert.match(guard, /OLD\.role = 'owner'[\s\S]*OLD\.status = 'accepted'/);
  assert.match(guard, /TG_OP = 'DELETE'[\s\S]*NEW\.role <> 'owner'[\s\S]*NEW\.status <> 'accepted'/);
  assert.match(guard, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended/);
  assert.match(guard, /count\(\*\)[\s\S]*<= 1[\s\S]*workspace_last_owner_protected/);
  assert.match(normalized, /BEFORE DELETE OR UPDATE OF workspace_id, role, status[\s\S]*FOR EACH ROW/);
  assert.match(docs, /single\/bulk statements and competing transactions/);
});
test('pure authorization helper evaluates identity, lifecycle and role rank', () => {
  const identityId = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(auth.WORKSPACE_ROLES, ['owner', 'admin', 'member', 'viewer']);
  assert.equal(auth.normalizeWorkspaceRole(' ADMIN '), 'admin');
  assert.equal(auth.normalizeWorkspaceRole('editor'), null);
  assert.equal(auth.evaluateWorkspacePermission().category, 'unauthenticated');
  assert.equal(auth.evaluateWorkspacePermission({ identity: identityId, workspaceExists: false }).category, 'workspace_not_found');
  assert.equal(auth.evaluateWorkspacePermission({ identity: identityId }).category, 'membership_missing');
  assert.equal(auth.evaluateWorkspacePermission({ identity: identityId, membership: { identity_id: identityId, role: 'owner', status: 'revoked' } }).category, 'membership_inactive');
  assert.equal(auth.evaluateWorkspacePermission({ identity: identityId, membership: { identity_id: identityId, role: 'viewer', status: 'accepted' }, minimumRole: 'admin' }).category, 'insufficient_workspace_role');
  assert.equal(auth.evaluateWorkspacePermission({ identity: identityId, membership: { identity_id: identityId, role: 'admin', status: 'accepted' }, minimumRole: 'member' }).allowed, true);
});
test('migration is additive, data-free, preference-free and provider-free', () => {
  assert.equal(parsed.some((statement) => /^(DROP|TRUNCATE|UPDATE|INSERT|DELETE)\b/i.test(statement)), false);
  assert.doesNotMatch(sql, /localStorage|sessionStorage|ephemeralBrand|owner_email\s*=|https?:\/\/|openai|anthropic|provider/i);
  assert.doesNotMatch(sql, /FOREIGN KEY\s*\(\s*brand_id\s*,\s*workspace_id/i);
  assert.doesNotMatch(sql, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});
test('current Brand, Board, shares, tokens and membership policies are not cut over', () => {
  const altered = parsed.filter((statement) => /^ALTER TABLE public\.(brands|boards)/i.test(statement));
  assert.equal(altered.length, 2);
  assert.ok(altered.every((statement) => /ADD COLUMN workspace_id UUID NULL/i.test(statement)));
  assert.doesNotMatch(sql, /brand_members|board_editors|public_view_token|CREATE POLICY[^;]+public\.(?:brands|boards)/i);
});
test('UI, BW-36.4 sidebar, compact bar and Canvas toolbar baselines are unchanged', () => {
  const expected = {
    'app.js': '1814a8cf8b939399812787a405e5c74d51fe532c501af03f8e77f1e7a50c1756',
    'brand-sidebar.js': '1c9dc05ca3dea04cd7a78538db3b958e35ade0441184a8234a456d4ce2bb22f0',
    'index.html': '07df5155e66d651fb73237f04a376140b30bad4a67cb432d1a1a5df34d383d60',
    'styles.css': '5f0a37c8006f3685d187731ec1564303810cae9494453458fdccd982d0342d9c',
    'scripts/check-bw36-4-simplified-brand-sidebar.js': '2d8cfe6e01c8e604bde5aff70c02872eb4c7ad2797c0082400ceeb3dcf7129a5',
    'scripts/check-bw36-2-compact-non-canvas-context-bar.js': '7d000ad953878f9c91abb3c46f66bb91750be4b0252e0452b8e02e95e02216c8',
    'scripts/check-bw36-1r1-canvas-toolbar-visibility-and-funnel-footer.js': 'de9b3bfadb6dc64c805d27931c06beb4d5c3780bdc83ce071feaff7d0fefb5d1'
  };
  for (const [file, digest] of Object.entries(expected)) assert.equal(sha(file), digest, file);
});
test('documentation fixes hierarchy, invariant phases, deployment and refusal rollback', () => {
  for (const phrase of ['Account/User → Workspace → Brands → Boards', 'Phase 2', 'write cutover', 'Final contract enforcement', 'Refuse rollback', 'not activate Workspace reads or writes', 'BW-36.4 remains']) assert.ok(docs.includes(phrase), phrase);
});
test('registration is immediately after BW-36.4 with no dependency change', () => {
  assert.equal(pkg.scripts['check:bw36.6'], 'node scripts/check-bw36-6-workspace-schema-foundation.js');
  assert.ok(workflow.indexOf('check:bw36.6') > workflow.indexOf('check:bw36.4'));
  assert.ok(workflow.indexOf('check:bw36.6') < workflow.indexOf('dynamic AI Insights'));
  assert.deepEqual(pkg.dependencies, { '@vercel/blob': 'latest', pg: '^8.13.1' });
});

process.stdout.write(`BW-36.6 Workspace schema foundation: ${passed} deterministic groups passed; zero database, provider, AI, or network requests.\n`);
