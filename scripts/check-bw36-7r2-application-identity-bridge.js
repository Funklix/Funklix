// R5R2 updates only the approved logo/Avatar separation and dependent test fingerprints; historical SQL/auth remain pinned.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const migrationName = '20260929_bw36_7r2_application_identity_bridge.sql';
const sql = fs.readFileSync(path.join(root, 'migrations', migrationName), 'utf8');
const normalized = sql.replace(/\s+/g, ' ');
const identity = require(path.join(root, 'api/_app-identity'));
const workspace = require(path.join(root, 'api/_workspace-authorization'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`✓ ${name}\n`); }
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); }

test('one ordered transactional migration preserves the historical foundation', () => {
  assert.equal(fs.readdirSync(path.join(root, 'migrations')).filter(x => x.includes('bw36_7r2')).join(), migrationName);
  assert.match(sql, /^--[^\n]+\nBEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.equal(digest('migrations/20260928_bw36_6_workspace_schema_foundation.sql'), 'd7832add0dd280a05a420fad42c90b81929dae5e72eae9ccc5a7377b1d49a35c');
});

test('preflight refuses adoption, drift and partial/repeat application', () => {
  for (const token of ["to_regclass('public.app_identities')", 'FROM public.workspaces', 'FROM public.workspace_memberships', 'FROM public.brands WHERE workspace_id IS NOT NULL', 'FROM public.boards WHERE workspace_id IS NOT NULL', 'information_schema.columns', 'pg_constraint', 'pg_policies', 'pg_indexes', 'pg_trigger', 'bw36_7r2_already_or_partially_applied', 'bw36_7r2_adoption_nonzero', 'bw36_7r2_schema_mismatch']) assert.ok(sql.includes(token), token);
  assert.ok(sql.indexOf('DO $preflight$') < sql.indexOf('CREATE TABLE public.app_identities'));
});

test('identity schema is minimal, normalized, unique and lifecycle-bounded', () => {
  assert.match(normalized, /CREATE TABLE public\.app_identities \( id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
  for (const token of ["canonical_email <> ''", 'canonical_email = lower(btrim(canonical_email))', "status IN ('active', 'disabled')", "DEFAULT 'active'", 'revision BIGINT NOT NULL DEFAULT 1', 'revision >= 0', 'created_at TIMESTAMPTZ NOT NULL DEFAULT now()', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT now()', 'CREATE UNIQUE INDEX app_identities_canonical_email_key']) assert.ok(normalized.includes(token), token);
  const table = sql.slice(sql.indexOf('CREATE TABLE public.app_identities'), sql.indexOf(');', sql.indexOf('CREATE TABLE public.app_identities')));
  assert.doesNotMatch(table, /token|payload|avatar|display_name|metadata|session|cookie|password/i);
});

test('RLS is closed and auth.uid policies and helper are removed', () => {
  assert.match(sql, /ALTER TABLE public\.app_identities ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.app_identities FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /CREATE POLICY/);
  assert.match(sql, /DROP POLICY workspace_member_read/);
  assert.match(sql, /DROP POLICY workspace_membership_bounded_read/);
  assert.match(sql, /DROP FUNCTION public\.workspace_has_active_role/);
  assert.doesNotMatch(sql, /REFERENCES\s+auth\.users|auth\.uid\s*\(/i);
});

test('all Workspace identity columns and restrictive keys use app identities', () => {
  for (const rename of ['created_by_user_id TO created_by_identity_id', 'user_id TO identity_id', 'invited_by_user_id TO invited_by_identity_id']) assert.ok(sql.includes(rename));
  assert.equal((sql.match(/REFERENCES public\.app_identities\(id\) ON DELETE RESTRICT/g) || []).length, 3);
  assert.match(sql, /UNIQUE|workspace_memberships_workspace_identity_key/);
  assert.match(sql, /OLD\.identity_id[\s\S]*NEW\.identity_id/);
  assert.match(sql, /UPDATE OF workspace_id, identity_id, role, status/);
});

test('migration performs no rows, legacy authorization mutation or remote work', () => {
  const executable = sql.replace(/--[^\n]*/g, '').replace(/'([^']|'')*'/g, "''");
  assert.doesNotMatch(executable, /\b(?:INSERT|UPDATE\s+public\.(?:brands|boards)|TRUNCATE|COPY)\b/i);
  assert.doesNotMatch(sql, /https?:\/\/|fetch\s*\(|axios|openai|anthropic/i);
  assert.doesNotMatch(sql, /ALTER TABLE public\.(?:brand_members|board_editors)|public_view_token|canvas_json/i);
});

test('pure identity helper canonicalizes without inventing equivalence', () => {
  assert.equal(identity.normalizeCanonicalEmail('  ÜSER+Tag@Example.COM  '), 'üser+tag@example.com');
  assert.equal(identity.isCanonicalEmail('person@example.com'), true);
  assert.equal(identity.isCanonicalEmail(''), false);
  assert.equal(identity.isCanonicalEmail('person@invalid'), false);
  assert.equal(identity.normalizeCanonicalEmail('a.b+tag@example.com'), 'a.b+tag@example.com');
  assert.equal(identity.normalizeAppIdentityStatus(' ACTIVE '), 'active');
  assert.equal(identity.normalizeAppIdentityStatus('deleted'), null);
});

test('verified session conversion has bounded email-free failures', () => {
  assert.equal(identity.lookupRequestFromVerifiedSession({ user: { email: 'x@y.test' } }).code, identity.APP_IDENTITY_ERRORS.SESSION_REQUIRED);
  assert.equal(identity.lookupRequestFromVerifiedSession({ verified: true, user: {} }).code, identity.APP_IDENTITY_ERRORS.EMAIL_REQUIRED);
  assert.equal(identity.lookupRequestFromVerifiedSession({ verified: true, user: { email: 'bad' } }).code, identity.APP_IDENTITY_ERRORS.EMAIL_INVALID);
  assert.deepEqual(identity.lookupRequestFromVerifiedSession({ verified: true, user: { email: ' Person@Example.COM ' } }), { ok: true, canonicalEmail: 'person@example.com' });
  for (const value of Object.values(identity.APP_IDENTITY_ERRORS)) assert.doesNotMatch(value, /@/);
});

test('identity rows handle missing, ambiguous, disabled, invalid and mismatched data', () => {
  const row = { id: '11111111-1111-4111-8111-111111111111', canonical_email: 'person@example.com', status: 'active', revision: 1 };
  assert.equal(identity.validateIdentityRow(null).code, identity.APP_IDENTITY_ERRORS.NOT_FOUND);
  assert.equal(identity.validateIdentityRow([row, row]).code, identity.APP_IDENTITY_ERRORS.AMBIGUOUS);
  assert.equal(identity.validateIdentityRow({ ...row, status: 'disabled' }).code, identity.APP_IDENTITY_ERRORS.DISABLED);
  assert.equal(identity.validateIdentityRow({ ...row, id: 'person@example.com' }).code, identity.APP_IDENTITY_ERRORS.CONTRACT_INVALID);
  const resolved = identity.validateIdentityRow(row);
  assert.equal(identity.compareIdentityToSessionEmail(resolved, 'other@example.com').code, identity.APP_IDENTITY_ERRORS.MISMATCH);
  assert.equal(identity.compareIdentityToSessionEmail(resolved, row.canonical_email).identityId, row.id);
});

test('Workspace authorization is UUID-, lifecycle-, role- and last-owner-bounded', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const membership = { identity_id: id, workspace_id: '22222222-2222-4222-8222-222222222222', role: 'viewer', status: 'accepted' };
  assert.equal(workspace.evaluateWorkspacePermission().allowed, false);
  assert.equal(workspace.evaluateWorkspacePermission({ identity: 'email@example.com', membership }).allowed, false);
  assert.equal(workspace.evaluateWorkspacePermission({ identity: { identityId: id, status: 'disabled' }, membership }).allowed, false);
  assert.equal(workspace.evaluateWorkspacePermission({ identity: id, membership, minimumRole: 'admin' }).category, 'insufficient_workspace_role');
  for (const role of ['owner','admin','member','viewer']) assert.equal(workspace.normalizeWorkspaceRole(role), role);
  assert.equal(workspace.evaluateWorkspacePermission({ identity: id, membership }).allowed, true);
  assert.equal(workspace.protectsLastOwner({ membership: { ...membership, role: 'owner' }, acceptedOwnerCount: 1 }), true);
  assert.equal(workspace.protectsLastOwner({ membership: { ...membership, role: 'owner' }, acceptedOwnerCount: 2 }), false);
});

test('helpers contain no database, network, provider or cross-catalog authority', () => {
  const helpers = fs.readFileSync(path.join(root, 'api/_app-identity.js'), 'utf8') + fs.readFileSync(path.join(root, 'api/_workspace-authorization.js'), 'utf8');
  assert.doesNotMatch(helpers, /require\(['"](?:pg|https?|@supabase)|fetch\s*\(|pool\.|query\s*\(|auth\.users|brand_id|board_id|public.*token/i);
});

test('login, Brand, Board, UI and prior evidence baselines are byte-identical', () => {
  // R3's opt-in Brand transaction extension preserves the original authorization model; R1's corresponding evidence pin is updated.
  const expected = {
    'api/_auth-session.js':'2ee41ebe695a761c9aa05cc1c9a0df1a0dc81649f9150a6a083b6139c3e26e28', 'api/_brand-access.js':'15f35ef6ab4e77a1fda5d07ecd24d5a85cf920d98a16beeb57f8d789990b214c', 'api/_board-access.js':'84620c66037f2ff039c414032056b3e452f09e524cf481efa68c865cee59daef', 'api/auth/google/callback.js':'676451684d6610d9b9daaca6e4fcbce4bba1ee2fc2dce12d97cc33a88ee36485', 'brand-sidebar.js':'42cd9ca38505a7e4755b888c494c73440a457e57bcc495059f9746bba02d1efb', 'content-workspace.js':'72915d34948fef1352f645a336cff2160d07e605021c4d8fcd33a67a996d0615', 'automatic-planning.js':'3f2ce9323a4cf7896092dfaae7cf147f3fae7664a8c174f1cb7d4fb04e877bb4', 'scripts/check-bw36-7-workspace-backfill-preflight.js':'82cf69aba30c96cab94c30e4d680928bc0846e7cc94e019a10d1eb890f9d5478', 'scripts/check-bw36-7r1-workspace-identity-diagnostic.js':'06eba1c0ee0073db83aab9465be1e5b4f93cbd20438631d205398a3301247284'
  };
  for (const [file, hash] of Object.entries(expected)) assert.equal(digest(file), hash, file);
});

test('registration immediately follows BW-36.7R1', () => {
  assert.equal(pkg.scripts['check:bw36.7r2'], 'node scripts/check-bw36-7r2-application-identity-bridge.js');
  assert.ok(workflow.indexOf('check:bw36.7r2') > workflow.indexOf('check:bw36.7r1'));
});

process.stdout.write(`BW-36.7R2 application identity bridge: ${passed} deterministic groups passed; zero database, provider, AI, or network requests.\n`);
