'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const writes = require('../brand-write-contract');
const app = fs.readFileSync('app.js', 'utf8');
function block(start, end) { const from = app.indexOf(start), to = app.indexOf(end, from + start.length); assert(from >= 0 && to > from); return app.slice(from, to); }
const source = block('function canonicalInitializationEligible', 'function boardBrandCoreOperationEligible')
  + block('function beginCanonicalBrandCoreInitialization', 'async function loadBoardBrandCoreComparison');
function fixture(options = {}) {
  const brandId = randomUUID(), boardId = randomUUID(), workspace = randomUUID(), email = 'fixture@example.test';
  const snapshot = { brandCore: 'Authorized source', future: { immutable: true } };
  const canonical = { id: brandId, name: 'Empty fixture', revision: 7, brand_core: {} };
  const comparison = { status: 'ready', requiresReload: false, canonical, boardSnapshot: structuredClone(snapshot),
    result: { canonicalEmpty: true, boardEmpty: false }, userEmail: email, boardId, brandId, boardLoadGeneration: 1,
    requestId: 1, initializationId: 0, initializationController: null, confirming: false };
  const state = { user: { email }, currentBoardId: boardId, boardLoadGeneration: 1,
    boardBrandAssociation: { boardId, brandId }, boardAccess: { canEdit: true },
    authoritativeBoardBrandCore: { boardId, loadGeneration: 1, value: structuredClone(snapshot) },
    brandCatalog: { status: 'success', userEmail: email, entries: [{ id: brandId, role: 'owner' }] },
    workspaceCatalog: { activeWorkspaceId: workspace } };
  const requests = [], operations = new Set();
  const context = { state, boardBrandCoreComparison: comparison, AbortController, workspaceExitOperations: operations,
    BrandWriteContract: writes, getBoardIdFromPath: () => boardId, isPlainJsonObject: writes.object, canonicalJson: value => value,
    compareBrandCoreDocuments: () => ({ matches: true }), renderBoardBrandCoreComparison() {}, renderBrandCatalog() {},
    el: { boardBrandCoreComparison: { open: true }, boardBrandCoreInitializationReload: { focus() {} }, boardBrandCoreComparisonClose: { focus() {} } },
    fetch: async (url, init) => {
      requests.push({ url, init }); const input = JSON.parse(init.body);
      writes.normalize(input); assert.equal(input.operation, 'initialize'); assert.equal(input.workspace_id, workspace);
      assert.equal(input.expected_revision, '7'); assert.equal(input.source.board_id, boardId);
      assert.deepEqual(input.source.snapshot, snapshot); assert.deepEqual(writes.apply(canonical, input).brand_core, snapshot);
      options.during?.(context);
      const payload = { id: brandId, name: canonical.name, revision: 8, brand_core: structuredClone(snapshot) };
      options.payload?.(payload);
      return { status: options.status || 200, ok: !options.status || options.status === 200, json: async () => payload };
    } };
  vm.createContext(context); vm.runInContext(source, context);
  return { context, comparison, state, requests, operations };
}
(async () => {
  let groups = 0;
  let f = fixture(); await f.context.submitCanonicalBrandCoreInitialization(); assert.equal(f.requests.length, 0);
  f.context.beginCanonicalBrandCoreInitialization(); assert.equal(f.requests.length, 0);
  f.context.cancelCanonicalBrandCoreInitialization(); await f.context.submitCanonicalBrandCoreInitialization(); assert.equal(f.requests.length, 0); groups++;
  for (const core of [undefined, null, { brandDNA: null }, { brandCore: '' }, { brandDNA: { accepted: true } }]) {
    f = fixture(); f.comparison.canonical.brand_core = core;
    assert(!f.context.canonicalInitializationEligible()); f.context.beginCanonicalBrandCoreInitialization();
    await f.context.submitCanonicalBrandCoreInitialization(); assert.equal(f.requests.length, 0); groups++;
  }
  for (const change of [f => f.state.boardAccess.canEdit = false, f => f.state.brandCatalog.entries[0].role = 'viewer',
    f => f.state.authoritativeBoardBrandCore.value.future.immutable = false, f => f.state.boardLoadGeneration++,
    f => f.state.boardBrandAssociation.brandId = randomUUID(), f => f.state.user.email = 'other@example.test']) {
    f = fixture(); f.context.beginCanonicalBrandCoreInitialization(); change(f);
    await f.context.submitCanonicalBrandCoreInitialization(); assert.equal(f.requests.length, 0); groups++;
  }
  f = fixture(); f.context.beginCanonicalBrandCoreInitialization(); await f.context.submitCanonicalBrandCoreInitialization();
  assert.equal(f.requests.length, 1); assert.equal(f.requests[0].init.method, 'PUT');
  assert.equal(f.comparison.canonical.revision, 8); assert.equal(f.comparison.requiresReload, false);
  assert.equal(f.operations.size, 0); groups++;
  for (const options of [{ status: 409 }, { status: 403 }, { payload: p => p.brand_core.future.immutable = false },
    { payload: p => p.id = randomUUID() }, { payload: p => p.revision = 7 },
    { during: c => c.state.user.email = 'changed@example.test' }]) {
    f = fixture(options); f.context.beginCanonicalBrandCoreInitialization(); await f.context.submitCanonicalBrandCoreInitialization();
    assert.equal(f.comparison.canonical.revision, 7); assert.equal(f.operations.size, 0);
    assert.deepEqual(f.comparison.canonical.brand_core, {}); groups++;
  }
  console.log(`BW-36.23A initialization: ${groups}/${groups} controller groups PASS. Database guarantees require the separate PostgreSQL suite.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
