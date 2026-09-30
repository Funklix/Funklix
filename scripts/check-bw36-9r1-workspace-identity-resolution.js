'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '..');
const ids = Object.freeze({
  identity: '11111111-1111-4111-8111-111111111111',
  identity2: '11111111-1111-4111-8111-111111111112',
  workspace: '22222222-2222-4222-8222-222222222222',
  otherWorkspace: '22222222-2222-4222-8222-222222222223',
  brand: '33333333-3333-4333-8333-333333333333',
  board: '44444444-4444-4444-8444-444444444444'
});
const canonicalEmail = 'owner@example.test';
let passed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); passed += 1; }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}
function response() {
  return { headers: {}, statusCode: 0, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; } };
}

const originalLoad = Module._load;
const productionPool = { query: async () => ({ rows: [] }) };
Module._load = function load(request, parent, isMain) {
  if (request === 'pg') return { Pool: function Pool() { return productionPool; } };
  return originalLoad.call(this, request, parent, isMain);
};
process.env.AUTH_SECRET = 'bw36-9r1-invented-secret';
const route = require('../api/workspaces');
const { createSessionToken } = require('../api/_auth-session');
const { validateIdentityRow } = require('../api/_app-identity');
Module._load = originalLoad;

const identity = Object.freeze({
  id: ids.identity,
  canonical_email: canonicalEmail,
  status: 'active',
  revision: '0'
});
const membership = Object.freeze({ id: ids.workspace, name: 'Invented Workspace', avatar_url: null, locale: 'en', revision: '0', role: 'owner' });
const brand = Object.freeze({ id: ids.brand, workspace_id: ids.workspace, name: 'Invented Brand', revision: '0', role: 'owner' });
const board = Object.freeze({ id: ids.board, workspace_id: ids.workspace, brand_id: ids.brand, name: 'Invented Board', role: 'owner' });

function cookie(email = ' Owner@Example.Test ') {
  return `funklix_session=${encodeURIComponent(createSessionToken({ email }))}`;
}
function database({ identities = [identity], memberships = [membership], brands = [brand], boards = [board], failAt = 0, malformedEnvelope = false } = {}) {
  const outputs = [identities, memberships, brands, boards];
  return { calls: [], writes: 0, async query(sql, params) {
    this.calls.push({ sql, params });
    if (/\b(?:INSERT|UPDATE|DELETE|UPSERT|ALTER|CREATE|DROP)\b/i.test(sql)) this.writes += 1;
    if (this.calls.length === failAt) throw Object.assign(new Error('private database detail'), { code: '57P03' });
    if (malformedEnvelope && this.calls.length === 1) return outputs[0];
    return { rows: outputs[this.calls.length - 1] || [] };
  } };
}
async function invoke(options = {}, request = {}) {
  const db = database(options);
  const req = { method: 'GET', headers: { cookie: cookie() }, ...request };
  const res = response();
  const logs = [];
  const oldInfo = console.info; const oldError = console.error;
  console.info = (...args) => logs.push(args); console.error = (...args) => logs.push(args);
  try { await route.createHandler({ db })(req, res); } finally { console.info = oldInfo; console.error = oldError; }
  return { db, res, logs };
}

(async () => {
  await test('production BIGINT representation reproduces the old rejection and is now normalized', () => {
    assert.equal(typeof identity.revision, 'string');
    assert.equal(Number.isSafeInteger(identity.revision), false, 'BW-36.9 incorrectly required this and returned IDENTITY_INVALID');
    const resolved = validateIdentityRow(identity);
    assert.deepEqual(resolved, { ok: true, identityId: ids.identity, canonicalEmail, status: 'active', revision: 0 });
  });

  await test('real signed-session route resolves the production envelope and exact selected-column contract once', async () => {
    const result = await invoke();
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.body.contract, 'workspace_catalog_v1');
    assert.equal(result.res.body.workspaces.length, 1);
    assert.equal(result.res.body.workspaces[0].name, 'Invented Workspace');
    assert.equal(result.db.calls.length, 4);
    assert.equal(result.db.calls[0].sql, route.IDENTITY_SELECT);
    assert.deepEqual(result.db.calls[0].params, [canonicalEmail]);
    assert.deepEqual(Object.keys(identity), ['id', 'canonical_email', 'status', 'revision']);
    assert(!/email|identity/i.test(JSON.stringify(result.res.body)));
    assert.equal(result.db.writes, 0);
    const stages = result.logs.map((entry) => entry[1]?.stage).filter(Boolean);
    for (const stage of ['identity_query_construction', 'identity_query_execution', 'identity_response_normalization',
      'identity_row_validation', 'identity_canonical_comparison', 'membership_lookup', 'catalog_projection', 'response_construction']) assert(stages.includes(stage), stage);
    assert(!new RegExp(`${canonicalEmail}|${ids.identity}|${ids.workspace}`, 'i').test(JSON.stringify(result.logs)));
  });

  await test('no identity and no accepted membership produce empty catalogs', async () => {
    const missing = await invoke({ identities: [] });
    assert.equal(missing.res.statusCode, 200); assert.deepEqual(missing.res.body.workspaces, []); assert.equal(missing.db.calls.length, 1);
    const noMembership = await invoke({ memberships: [], brands: [], boards: [] });
    assert.equal(noMembership.res.statusCode, 200); assert.deepEqual(noMembership.res.body.workspaces, []); assert.equal(noMembership.db.calls.length, 2);
  });

  await test('disabled, malformed, ambiguous, mismatched and malformed-envelope identities fail closed', async () => {
    assert.equal((await invoke({ identities: [{ ...identity, status: 'disabled' }] })).res.body.error.code, 'IDENTITY_DISABLED');
    for (const bad of [{ ...identity, id: 'bad' }, { ...identity, revision: '-1' }, { ...identity, revision: '9007199254740992' }, { ...identity, status: 'pending' }]) {
      assert.equal((await invoke({ identities: [bad] })).res.body.error.code, 'IDENTITY_INVALID');
    }
    assert.equal((await invoke({ identities: [identity, { ...identity, id: ids.identity2 }] })).res.body.error.code, 'IDENTITY_AMBIGUOUS');
    assert.equal((await invoke({ identities: [{ ...identity, canonical_email: 'different@example.test' }] })).res.body.error.code, 'IDENTITY_INVALID');
    assert.equal((await invoke({ malformedEnvelope: true })).res.body.error.code, 'IDENTITY_INVALID');
  });

  await test('database unavailability remains bounded and carries privacy-safe request stages', async () => {
    const result = await invoke({ failAt: 1 });
    assert.equal(result.res.statusCode, 503); assert.equal(result.res.body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(result.res.body.error.stage, 'database'); assert.match(result.res.body.request_id, /^[0-9a-f]{24}$/);
    assert(!/private database detail/.test(JSON.stringify(result.logs)));
  });

  await test('membership cannot expand descendants and cross-Workspace descendants fail closed', async () => {
    const isolated = await invoke({ brands: [], boards: [] });
    assert.deepEqual(isolated.res.body.workspaces[0].brands, []); assert.deepEqual(isolated.res.body.workspaces[0].boards, []);
    const cross = await invoke({ brands: [{ ...brand, workspace_id: ids.otherWorkspace }], boards: [] });
    assert.equal(cross.res.body.error.code, 'WORKSPACE_CATALOG_CONFLICT');
  });

  await test('Board-only collaborator, public token and request parameters cannot become identity authority', async () => {
    const boardOnly = await invoke({ memberships: [], brands: [], boards: [board] });
    assert.deepEqual(boardOnly.res.body.workspaces, []);
    const publicOnly = await invoke({}, { headers: {}, query: { token: 'invented', email: canonicalEmail, role: 'owner' } });
    assert.equal(publicOnly.res.body.error.code, 'AUTHENTICATION_REQUIRED'); assert.equal(publicOnly.db.calls.length, 0);
    const injected = await invoke({}, { query: { email: 'attacker@example.test', identity: ids.identity2, role: 'owner' }, body: { email: 'attacker@example.test' } });
    assert.deepEqual(injected.db.calls[0].params, [canonicalEmail]);
  });

  await test('duplicate browser loads share one request and cause no provider or AI traffic', async () => {
    const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(source, /if \(current\.identity === identity && current\.promise\) return current\.promise/);
    assert.equal((source.match(/FunklixWorkspaceCatalog\.load\(\)/g) || []).length, 1);
    const boundary = fs.readFileSync(path.join(root, 'api/workspaces.js'), 'utf8') + fs.readFileSync(path.join(root, 'api/_workspace-catalog.js'), 'utf8');
    assert(!/fetch\(|axios|openai|anthropic|linkedin|facebook|googleapis/i.test(boundary));
    assert(!/\b(?:INSERT|UPDATE|DELETE|UPSERT)\b/.test(boundary));
  });

  await test('repair is registered immediately after BW-36.9 with no migration change', () => {
    const pkg = require('../package.json');
    const keys = Object.keys(pkg.scripts);
    assert.equal(pkg.scripts['check:bw36.9r1'], 'node scripts/check-bw36-9r1-workspace-identity-resolution.js');
    assert.equal(keys.indexOf('check:bw36.9r1'), keys.indexOf('check:bw36.9') + 1);
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
    assert(workflow.indexOf('check:bw36.9r1') > workflow.indexOf('check:bw36.9'));
    if (fs.existsSync(path.join(root, '.git'))) {
      const changed = require('child_process').execFileSync('git', ['status', '--short', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
      assert(!/migrations\//.test(changed));
    }
  });

  console.log(`BW-36.9R1 Workspace identity resolution checks passed (${passed}). Zero writes/provider/AI/network requests.`);
})().catch(() => { process.exitCode = 1; });
