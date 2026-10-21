'use strict';
// Controller/transport regression. SQL durability is covered by the PostgreSQL suite.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const profile = require('../brand-profile-setup');
const clone = value => structuredClone(value);
function fixture() {
  const id = randomUUID(), workspace = randomUUID();
  let brand = { id, workspace_id: workspace, name: 'Replay fixture', revision: 1, brand_core: { future: { retained: true } },
    logo_revision: 0, logo_url: null, access: { role: 'owner', canEditCanonicalBrand: true } };
  let context = { account: {}, generation: 1, workspaceId: workspace, brandId: id, authorized: true };
  const receipts = new Map(), posts = [], history = [], assets = new Map();
  let mode = 'normal', onLogo = 0, deferred;
  const response = (status, value) => ({ status, ok: status === 200, json: async () => clone(value) });
  const fetchImpl = async (url, init = {}) => {
    assert(url.startsWith(`/api/brands/${id}`), 'No external transport');
    const input = init.body && JSON.parse(init.body);
    if (url.endsWith('/write-preview')) return response(200, { changes: [] });
    if (init.method === 'POST') {
      posts.push(clone(input));
      if (mode === 'fail') return response(500, { error: { code: 'UPDATE_FAILED' } });
      let receipt = receipts.get(input.request_id);
      if (!receipt) {
        assert.equal(input.workspace_id, workspace);
        assert.equal(input.expected_revision, brand.logo_revision);
        const revision = brand.logo_revision + 1;
        brand = { ...brand, logo_revision: revision, logo_url: `/api/brands/${id}/logo?revision=${revision}` };
        assets.set(input.request_id, input.image_base64);
        receipt = { contract: 'brand_logo_v1', request_id: input.request_id,
          logo: { brand_id: id, changed: true, logo_revision: revision, logo_url: brand.logo_url, source: 'uploaded' } };
        receipts.set(input.request_id, clone(receipt)); history.push(clone(brand));
      }
      if (mode === 'lost') { mode = 'normal'; throw new Error('Committed response lost'); }
      if (mode === 'invalid') return response(200, { ...receipt, request_id: 'wrong-receipt' });
      if (mode === 'deferred') await new Promise(resolve => { deferred = resolve; });
      return response(200, receipt);
    }
    return response(200, brand);
  };
  const session = profile.createSession({ brand: clone(brand), getContext: () => context, fetchImpl,
    requestId: randomUUID, validateBrand: (value, expected) => value?.id === expected && Number.isSafeInteger(value.revision),
    onSave() {}, onLogo() { onLogo++; } });
  return { session, posts, history, assets, receipts, setMode(value) { mode = value; },
    change(value) { context = { ...context, ...value }; }, release() { deferred(); },
    get brand() { return clone(brand); }, get projections() { return onLogo; } };
}
async function choose(f) {
  await f.session.chooseFile({ name: 'fixture.png', type: 'image/png', size: 32 }, async () => Buffer.alloc(32, 1).toString('base64'));
}
(async () => {
  let groups = 0;
  for (const mode of ['lost', 'invalid', 'fail']) {
    const f = fixture(); await choose(f); f.setMode(mode);
    assert.equal(await f.session.upload(), false);
    assert(f.session.state.fileData, 'Unverified outcome retains the upload');
    assert.equal(f.projections, 0);
    if (mode === 'fail') { assert.equal(f.history.length, 0); assert.equal(f.assets.size, 0); }
    f.setMode('normal'); assert.equal(await f.session.upload(), true);
    assert.equal(f.posts[1].request_id, f.posts[0].request_id, 'Retry validates the persisted request identity');
    assert.deepEqual(f.posts[1], f.posts[0]); assert.equal(f.history.length, 1); assert.equal(f.assets.size, 1);
    assert.equal(f.brand.logo_revision, 1); assert.equal(f.session.state.brand.logo_revision, 1);
    assert.equal(f.session.state.file, null); assert.equal(f.projections, 1);
    assert.deepEqual(f.brand.brand_core, { future: { retained: true } });
    await choose(f); assert.equal(await f.session.upload(), true);
    assert.notEqual(f.posts[2].request_id, f.posts[0].request_id, 'Verified success releases the pending identity');
    assert.equal(f.history.length, 2); groups++;
  }
  for (const change of [{ account: {} }, { workspaceId: randomUUID() }, { brandId: randomUUID() }, { generation: 2 }, { authorized: false }]) {
    const f = fixture(); await choose(f); f.setMode('deferred'); const flight = f.session.upload();
    while (!f.posts.length) await new Promise(resolve => setImmediate(resolve));
    f.change(change); f.release(); assert.equal(await flight, false); assert.equal(f.projections, 0);
    assert.equal(f.session.state.brand.logo_revision, 0, 'Stale response cannot update another context');
    if (change.generation) {
      // Same authorized surface may resume after its generation refresh.
      f.setMode('normal'); assert.equal(await f.session.upload(), true);
      assert.equal(f.posts[1].request_id, f.posts[0].request_id); assert.equal(f.history.length, 1);
    } else { assert.equal(await f.session.upload(), false); assert.equal(f.posts.length, 1); }
    groups++;
  }
  // Execute the real signed-session HTTP/logo/preview/storage/controller path.
  // Only its external SQL and private object storage are disposable adapters.
  const { runtime, B, W, png } = require('./fixtures/bw36-13r5-local-runtime');
  const server = runtime({ postgresLogo: true });
  const initial = (await server.request('GET', `/api/brands/${B}`)).body;
  const context = { account: {}, generation: 1, brandId: B, workspaceId: W, authorized: true };
  const session = profile.createSession({ brand: initial, getContext: () => context, requestId: randomUUID,
    validateBrand: (value, id) => value?.id === id && Number.isSafeInteger(value.revision),
    confirmReview: async () => true, onSave() {}, onLogo() {}, fetchImpl: async (url, init = {}) => {
      const result = await server.request(init.method || 'GET', url, init.body && JSON.parse(init.body), undefined, init.headers);
      return { ok: result.statusCode === 200, status: result.statusCode, json: async () => result.body };
    } });
  await session.chooseFile({ name: 'actual-route.png', type: 'image/png', size: png.length }, async () => png.toString('base64'));
  server.db.failLogoResponse = true;
  assert.equal(await session.upload(), false); assert(session.state.fileData);
  assert.equal(server.db.brands[0].logo_revision, 1); assert.equal(server.db.history.length, 1);
  const committed = clone(server.db.history); const originalCore = clone(server.db.brands[0].brand_core);
  server.db.failLogoResponse = false;
  assert.equal(await session.upload(), true, session.state.message + ' ' + JSON.stringify(server.logs));
  const attempts = server.requests.filter(r => r.method === 'POST' && r.path.endsWith('/logo'));
  assert.equal(attempts.length, 2); assert.deepEqual(attempts[1].body, attempts[0].body);
  assert.equal(server.storageRequests.filter(method => method === 'POST').length, 1);
  assert.equal(server.objects.size, 1); assert.deepEqual(server.db.history, committed);
  assert.equal(session.state.brand.logo_revision, 1); assert.equal(session.state.file, null);
  assert.deepEqual(server.db.brands[0].brand_core, originalCore); groups++;
  const beforeMissing = clone(server.db.brands), assetsBefore = server.objects.size;
  const missing = await server.request('POST', `/api/brands/${B}/logo`, { ...attempts[0].body, request_id: randomUUID(), expected_revision: 1 },
    undefined, { 'x-brand-receipt-only': '1' });
  assert.equal(missing.statusCode, 409); assert.equal(missing.body.error.code, 'RECEIPT_NOT_FOUND');
  assert.deepEqual(server.db.brands, beforeMissing); assert.deepEqual(server.db.history, committed); assert.equal(server.objects.size, assetsBefore); groups++;
  console.log(`BW-36.23A logo replay: ${groups}/${groups} groups PASS (lost response, malformed receipt, failed commit, fresh mutation, account/Workspace/Brand isolation).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
