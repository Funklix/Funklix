'use strict';

// Real route and ACL helpers; only session, database transport and provider are doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '..');
const BOARD = '11111111-1111-4111-8111-111111111111';
const BRAND = '22222222-2222-4222-8222-222222222222';
const owner = { id: 'private-owner-id', email: 'private-owner@example.invalid' };
const stranger = { id: 'stranger', email: 'stranger@example.invalid' };
const source = fs.readFileSync(path.join(ROOT, 'api/ai-brain/advice.js'), 'utf8');
const legacySource = source.replace('id, name, owner_id, owner_email, brand_id,', 'id, name, brand_id,')
  .replace(/    \/\/ Missing ownership columns[\s\S]*?(?=    if \(!access\?\.canEdit\))/, '')
  // Reproduce the original single-read route, before freshness integration existed.
  .replace('await learningContext.capture({ boardId, user })', '({ board, canonical, learnings: [] })')
  .replaceAll('await learningContext.revalidate({ data, selected: prepared.selected, user });', '');

function runtime({ user = stranger, board = {}, member = null, brandRole = null, projectionFault = null, routeSource = source, providerAnswer = 'Advice' } = {}) {
  const saved = { id: BOARD, name: 'Private campaign', owner_id: owner.id, owner_email: owner.email,
    brand_id: null, brand_core_snapshot: { campaign: 'Saved snapshot' }, brand_core_source_revision: '3',
    brand_core_source_updated_at: '2026-10-14', updated_at: '2026-10-15', public_view_enabled: true, ...board };
  const queries = [], calls = [], resolutions = [], cache = new Map();
  const rows = (values) => ({ rows: values, rowCount: values.length });
  async function query(sql, args) {
    sql = sql.replace(/\s+/g, ' ').replace(/\bpublic\./g, '').trim(); queries.push({ sql, args });
    assert.match(sql, /^(SELECT |BEGIN|SET LOCAL|COMMIT|ROLLBACK)/, 'Advice must not write application data');
    if (sql.includes('SELECT tendra_runtime_private.lock_brand(')) return rows([]);
    if (/^(BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(sql)) return rows([]);
    if (sql.includes('FROM app_identities')) return rows([{ id: '44444444-4444-4444-8444-444444444444', canonical_email: user.email.trim().toLowerCase(), status: 'active', revision: '1' }]);
    if (sql.includes('FROM brand_members')) return rows(brandRole && brandRole !== 'owner' ? [{ role: brandRole }] : []);
    if (sql.includes('FROM brand_learnings')) return rows([]);
    if (sql.includes(' FROM boards WHERE')) {
      assert.equal(args[0], BOARD);
      // Returning the stored row wholesale would hide the original projection defect.
      const columns = sql.match(/^SELECT (.+) FROM boards WHERE/)[1].split(',').map((key) => key.trim());
      const projected = Object.fromEntries(columns.map((key) => {
        assert(Object.hasOwn(saved, key), `Unknown Board column: ${key}`);
        return [key, saved[key]];
      }));
      if (projectionFault) projectionFault(projected);
      return rows([projected]);
    }
    if (sql.includes('FROM board_editors')) {
      assert.deepEqual(Array.from(args), [BOARD, user.email.trim().toLowerCase()]);
      return rows(member ? [{ role: member }] : []);
    }
    if (sql.includes('FROM brands b')) {
      assert.deepEqual(Array.from(args), [BRAND, user.email.trim().toLowerCase()]);
      if (!brandRole) return rows([]);
      return rows(sql.includes('AS brand_access_role')
        ? [{ id: BRAND, name: 'Canonical brand', brand_core: { canonical: 'Authorized core' }, revision: '7', updated_at: '2026-10-15', brand_access_role: brandRole }]
        : [{ id: BRAND, name: 'Canonical brand', revision: '7', role: brandRole }]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative), local = createRequire(filename), module = { exports: {} };
    cache.set(relative, module);
    function requireFixture(name) {
      if (!name.startsWith('.')) return local(name);
      const resolved = path.relative(ROOT, local.resolve(name));
      if (resolved === 'api/_auth-session.js') return { getSessionUser: () => user };
      if (resolved === 'api/_boards-storage.js') return { pool: { query, connect: async () => ({ query, release() {} }) } };
      if (resolved === 'api/_brands-storage.js') return { pool: { query }, ensureBrandsTable: async () => {} };
      return load(resolved);
    }
    vm.runInNewContext(relative === 'api/ai-brain/advice.js' ? routeSource : fs.readFileSync(filename, 'utf8'), {
      module, exports: module.exports, require: requireFixture, Buffer, console, AbortController, setTimeout, clearTimeout,
      process: { env: { OPENAI_API_KEY: 'local-stub-only' } },
      fetch: async (url, options) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        calls.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ output_text: providerAnswer }) };
      }
    }, { filename });
    return module.exports;
  }
  const realAccess = load('api/_board-access.js');
  const original = realAccess.getBoardAccess;
  realAccess.getBoardAccess = async (...args) => {
    const result = await original(...args); resolutions.push(result); return result;
  };
  const handler = load('api/ai-brain/advice.js');
  async function invoke(overrides = {}) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: 'POST', headers: {}, body: { board_id: BOARD, question: 'What should change?', response_language: 'en',
      selected_node_id: 'idea', canvas_context: { nodes: [{ id: 'idea', type: 'Idea', title: 'Working idea', content: 'Unsaved direction' }], edges: [] }, ...overrides } }, response);
    const external = JSON.stringify([calls, response.body]);
    for (const secret of ['owner_id', 'owner_email', owner.id, owner.email]) assert(!external.includes(secret), `Ownership leaked: ${secret}`);
    return response;
  }
  return { invoke, queries, calls, resolutions };
}

async function main() {
  const legacy = runtime({ routeSource: legacySource });
  assert.equal((await legacy.invoke()).statusCode, 200);
  assert.equal(legacy.resolutions[0].access.role, 'unowned');
  assert.equal(legacy.calls.length, 1);
  assert.equal(legacy.queries.length, 1, 'Original defect bypassed membership lookup');
  console.log('Confirmed pre-fix defect: unrelated identity classified unowned; provider invoked once (stub).');

  const cases = [
    ['private owner by ID', { user: { ...owner, email: 'changed@example.invalid' } }, 'owner', 200],
    ['private owner by normalized email', { user: { id: 'different', email: ` ${owner.email.toUpperCase()} ` } }, 'owner', 200],
    ['Board editor without Brand access', { member: 'editor', board: { brand_id: BRAND } }, 'editor', 200],
    ['unrelated identity on public-enabled owned Board', {}, 'non_owner', 403],
    ['genuine null ownership', { board: { owner_id: null, owner_email: null } }, 'unowned', 200],
    ['legacy empty ownership', { board: { owner_id: '', owner_email: '' } }, 'unowned', 200],
    ['ID-only owned Board', { board: { owner_email: null } }, 'non_owner', 403],
    ['email-only owned Board', { board: { owner_id: null } }, 'non_owner', 403],
    ['Board viewer', { member: 'viewer' }, 'viewer', 403],
    ...['owner', 'admin', 'editor'].map((role) => [`Brand ${role}`, { board: { brand_id: BRAND }, brandRole: role }, `brand_${role}`, 200]),
    ['Brand viewer without Board edit', { board: { brand_id: BRAND }, brandRole: 'viewer' }, 'brand_viewer', 403],
    ['Brand viewer with Board edit', { board: { brand_id: BRAND }, brandRole: 'viewer', member: 'editor' }, 'editor', 200],
    ['unrelated Brand identity', { board: { brand_id: BRAND } }, 'non_owner', 403],
    ['anonymous public-enabled Board', { user: null }, null, 401],
    ['anonymous unowned Board', { user: null, board: { owner_id: null, owner_email: null } }, null, 401]
  ];
  for (const [label, options, role, status] of cases) {
    const r = runtime(options), response = await r.invoke();
    assert.equal(response.statusCode, status, label);
    assert.equal(r.resolutions[0]?.access.role || null, role, label);
    assert.equal(r.calls.length, status === 200 ? 1 : 0, `${label}: provider boundary`);
    if (status === 200) {
      assert.equal(response.body.answer, 'Advice');
      assert.equal(response.body.context.canonicalBrandCore, !!options.brandRole);
      const context = JSON.parse(r.calls[0].input[1].content.split('\n').slice(1).join('\n'));
      assert.equal(context.boardBrandCore.campaign, 'Saved snapshot');
      assert.equal(context.workingCanvas.selectedNode.title, 'Working idea');
      assert.equal(!!context.canonicalBrandCore, !!options.brandRole);
      assert.equal(r.calls[0].model, 'gpt-4o-mini');
      assert.equal(r.calls[0].input.at(-1).content, 'What should change?');
      assert.equal(response.body.disclaimer, 'AI advice, not measured performance. No changes were made.');
    }
  }
  for (const key of ['owner_id', 'owner_email']) {
    for (const value of [undefined, 0, false, {}, []]) {
      const r = runtime({ projectionFault: (row) => { if (value === undefined) delete row[key]; else row[key] = value; } });
      assert.equal((await r.invoke()).statusCode, 500, `${key}: malformed projection`);
      assert.equal(r.calls.length, 0);
    }
  }
  const omitted = runtime({ projectionFault: (row) => { delete row.owner_id; delete row.owner_email; } });
  assert.equal((await omitted.invoke()).statusCode, 500);
  assert.equal(omitted.resolutions[0].access.role, 'unowned', 'Shared helper still requires complete projection; route fails closed');
  assert.equal(omitted.calls.length, 0);
  const clarification = runtime({ user: owner });
  const response = await clarification.invoke({ question: 'What about the second idea?' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.context.reference_resolution, 'clarification');
  assert.equal(clarification.calls.length, 0);
  const invalidCanvas = runtime({ user: owner });
  assert.equal((await invalidCanvas.invoke({ canvas_context: { nodes: [null], edges: [] } })).statusCode, 400);
  assert.equal(invalidCanvas.calls.length, 0);
  console.log(`BW-36.20R0 passed: ${cases.length} ACL cases, 11 invalid projections, zero unauthorized provider calls, context isolation and Advice compatibility.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
