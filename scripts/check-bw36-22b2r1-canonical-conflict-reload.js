'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { create } = require('../canonical-brand-reader');
const { chromium } = require('playwright-core');
const { W, B } = require('./fixtures/bw36-13r5-local-runtime');
const app = process.env.BW22B2R1_BASELINE
  ? fs.readFileSync(process.env.BW22B2R1_BASELINE, 'utf8')
  : fs.readFileSync(require.resolve('../app.js'), 'utf8');
const loader = app.slice(app.indexOf('async function loadCanonicalBrandDetail('), app.indexOf('\nfunction resolveRegularBrandProfile('));
const validator = app.slice(app.indexOf('function isCanonicalBrandDetail('), app.indexOf('// No Board snapshot'));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const clone = x => JSON.parse(JSON.stringify(x));
let groups = 0;
async function check(name, run) { await run(); console.log('PASS ' + name); groups++; }
function fixture() {
  const brand = { id: B, name: 'Initial', revision: 1, brand_core: { brandCore: 'Initial' },
    created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z',
    access: { role: 'owner', canEditCanonicalBrand: true, canManageBrandMembers: true } };
  const state = { user: { email: 'owner@example.test' }, session: { brandId: B }, publicBoardToken: null, brandCatalog: { requestId: 1 },
    workspaceCatalog: { status: 'ready', generation: 1, activeWorkspaceId: W, value: { workspaces: [{ id: W, brands: [clone(brand)] }] } } };
  const calls = [], holds = [];
  const c = { state, canonicalBrandDetail: { brandId: B, userEmail: state.user.email, requestId: 0, draft: null, status: 'closed' },
    el: { brandWorkspaceDetail: { open: true } }, sidebarProfileCache: new Map(), AbortController,
    renderCanonicalBrandDetail() {}, closeCanonicalBrandDetail() {}, renderBrandCatalog() {}, renderAuthState() {}, clearEphemeralBrandSwitcherSelection() {},
    canonicalBrandDetailErrorStatus: s => s === 401 ? 'unauthenticated' : [403, 404].includes(s) ? 'unavailable' : 'error' };
  vm.createContext(c); vm.runInContext(validator + '\n' + loader, c);
  let status = 200;
  const reader = create({ validate: c.isCanonicalBrandDetail, context: id => {
    const w = state.workspaceCatalog.value?.workspaces.find(w => w.id === state.workspaceCatalog.activeWorkspaceId);
    const b = w?.brands.find(b => b.id === id);
    return state.user && !state.publicBoardToken && state.workspaceCatalog.status === 'ready' && b ? {
      account: state.user, identity: state.user.email, catalog: state.workspaceCatalog.value, generation: state.workspaceCatalog.generation,
      workspaceId: w.id, selectedBrandId: state.session.brandId, brandId: id, revision: b.revision
    } : null;
  }, fetchImpl: async (url, options) => {
    calls.push({ url, options }); const body = clone(brand), code = status, hold = holds.shift();
    if (hold?.stage === 'headers') { hold.started.resolve(); await hold.release.promise; }
    return { ok: code === 200, status: code, json: async () => {
      if (hold?.stage === 'json') { hold.started.resolve(); await hold.release.promise; } return body;
    } };
  } });
  c.canonicalBrandReader = reader;
  return { c, state, brand, reader, calls, holds, setStatus: value => { status = value; },
    run: (force = false) => c.loadCanonicalBrandDetail({ force }) };
}
(async () => {
  await check('initial authorized canonical GET; ordinary Home/Profile pending and settled deduplication', async () => {
    const f = fixture(), home = f.reader.read(B); await f.run(); await home;
    assert.equal(f.calls.length, 1); await f.run(); assert.equal(f.calls.length, 1);
    assert.equal(f.c.canonicalBrandDetail.brand.revision, 1);
    assert.equal(f.calls[0].url, '/api/brands/' + B);
    assert.equal(f.calls[0].options.credentials, 'same-origin'); assert.equal(f.calls[0].options.cache, 'no-store');
  });
  await check('409 conflict reload bypasses settled detail; repeated reload and accepted save bypass; draft revision retained', async () => {
    const f = fixture(); await f.run();
    const draft = { revision: 1, initialName: 'Initial', initialCore: '{}' };
    f.c.canonicalBrandDetail.status = 'conflict'; f.c.canonicalBrandDetail.draft = draft;
    f.brand.revision = 2; f.brand.name = 'Server changed';
    await f.run(true);
    assert.equal(f.c.canonicalBrandDetail.brand.revision, 2, 'Conflict reload must GET newest canonical revision');
    assert.equal(f.calls.length, 2); assert.equal(f.c.canonicalBrandDetail.draft, draft); assert.equal(draft.revision, 1);
    f.brand.revision = 3; await f.run(true); assert.equal(f.c.canonicalBrandDetail.brand.revision, 3);
    f.reader.accept(clone(f.brand)); f.brand.revision = 4; await f.run(true);
    assert.equal(f.c.canonicalBrandDetail.brand.revision, 4); assert.equal(f.calls.length, 4);
  });
  await check('overlapping forced reloads supersede old headers/JSON even when transport ignores abort', async () => {
    for (const stage of ['headers', 'json']) {
      const f = fixture(), h = { stage, started: deferred(), release: deferred() }; f.holds.push(h);
      const old = f.run(); await h.started.promise;
      const draft = { revision: 1 }; f.c.canonicalBrandDetail.draft = draft;
      f.brand.revision = 2; await f.run(true);
      assert.equal(f.calls[0].options.signal.aborted, true);
      h.release.resolve(); await old;
      assert.equal(f.c.canonicalBrandDetail.brand.revision, 2); assert.equal(f.c.canonicalBrandDetail.draft, draft);
      assert.equal((await f.reader.read(B)).revision, 2); assert.equal(f.calls.length, 2);
    }
  });
  await check('accepted newer save retires an old Profile reload without overwriting its state', async () => {
    const f = fixture(), h = { stage: 'json', started: deferred(), release: deferred() }; f.holds.push(h);
    const old = f.run(true); await h.started.promise;
    const accepted = { ...clone(f.brand), revision: 2 };
    // The confirmed-save projection replaces the catalog before reader.accept.
    f.state.workspaceCatalog.value = clone(f.state.workspaceCatalog.value);
    f.state.workspaceCatalog.value.workspaces[0].brands[0].revision = 2;
    f.c.canonicalBrandDetail.brand = accepted; f.c.canonicalBrandDetail.status = 'ready'; f.reader.accept(accepted);
    h.release.resolve(); await old;
    assert.equal(f.c.canonicalBrandDetail.brand, accepted); assert.equal(f.c.canonicalBrandDetail.status, 'ready');
  });
  await check('failed reload/retry and overlapping reload retain unsaved conflict draft', async () => {
    const f = fixture(); await f.run(); const draft = { revision: 1 }; f.c.canonicalBrandDetail.draft = draft;
    f.c.canonicalBrandDetail.status = 'conflict'; f.setStatus(503); await f.run(true);
    assert.equal(f.c.canonicalBrandDetail.status, 'error'); assert.equal(f.c.canonicalBrandDetail.draft, draft);
    f.setStatus(200); f.brand.revision = 2; await f.run(true); assert.equal(f.c.canonicalBrandDetail.draft, draft);
    const h = { stage: 'json', started: deferred(), release: deferred() }; f.holds.push(h);
    const old = f.run(true); await h.started.promise; f.brand.revision = 3; await f.run(true);
    h.release.resolve(); await old; assert.equal(f.c.canonicalBrandDetail.draft, draft); assert.equal(f.c.canonicalBrandDetail.brand.revision, 3);
  });
  await check('Brand, Workspace, account, catalog generation and access changes cannot apply stale reload success or failure', async () => {
    const changes = [f => { f.state.session.brandId = 'other'; }, f => { f.state.workspaceCatalog.activeWorkspaceId = 'other'; },
      f => { f.state.user = { ...f.state.user }; }, f => { f.state.user.email = 'changed@example.test'; },
      f => { f.state.workspaceCatalog.generation++; },
      f => { f.state.workspaceCatalog.value.workspaces[0].brands = []; }];
    for (const status of [200, 401, 403]) for (const stage of ['headers', 'json']) for (const change of changes) {
      const f = fixture(), h = { stage, started: deferred(), release: deferred() };
      // HTTP failures have no JSON stage.
      if (stage === 'json' && status !== 200) continue;
      f.setStatus(status); f.holds.push(h); const pending = f.run(true); await h.started.promise;
      change(f); const current = f.c.canonicalBrandDetail; h.release.resolve(); await pending;
      assert.equal(f.c.canonicalBrandDetail, current); assert.equal(current.status, 'loading');
      assert.equal(current.brand, null); assert(f.state.user, 'An old 401 must not sign out a newer account');
    }
    // Same-selection catalog refresh rejects old data but exposes Retry rather than remaining stuck loading.
    const refreshed = fixture(), hold = { stage: 'json', started: deferred(), release: deferred() };
    refreshed.holds.push(hold); const old = refreshed.run(true); await hold.started.promise;
    refreshed.state.workspaceCatalog.value = clone(refreshed.state.workspaceCatalog.value);
    hold.release.resolve(); await old; assert.equal(refreshed.c.canonicalBrandDetail.status, 'error');
    refreshed.brand.revision = 2; await refreshed.run(true); assert.equal(refreshed.c.canonicalBrandDetail.brand.revision, 2);
    for (const status of [401, 403, 404]) {
      const f = fixture(); await f.run(); f.setStatus(status); await f.run(true);
      assert.equal(f.c.canonicalBrandDetail.brand, null);
      assert.equal(f.c.canonicalBrandDetail.status, status === 401 ? 'unauthenticated' : 'unavailable');
    }
  });
  await check('fresh reads still reject malformed identity, access and revision; unauthorized context does not GET', async () => {
    for (const mutate of [f => { f.brand.id = 'wrong'; }, f => { f.brand.access = {}; }, f => { f.brand.revision = 0; },
      f => { f.state.workspaceCatalog.value.workspaces[0].brands[0].revision = 3; f.brand.revision = 2; }]) {
      const f = fixture(); mutate(f); await f.run(true); assert.equal(f.c.canonicalBrandDetail.status, 'malformed');
    }
    const f = fixture(); f.state.user = null; await f.run(true); assert.equal(f.calls.length, 0);
  });
  if (process.env.BW22B2R1_BASELINE) return;
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH }
    : fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  const setup = require('./fixtures/home-browser')(browser);
  try {
    await check('real 409, explicit conflict button, retained input, Cancel/Discard and deliberate reconciliation save; Home Avatar refresh', async () => {
      const f = await setup(), p = f.page;
      try {
        await p.waitForFunction(() => document.querySelector('[data-avatar-state=ready]'));
        const snapshot = () => p.evaluate(() => JSON.stringify({ nodes: state.nodes, core: state.brandCore, dirty: state.isDirty, revision: state.lastKnownUpdatedAt, association: state.boardBrandAssociation }));
        const before = await snapshot();
        const reads = () => f.requests.filter(r => r.method === 'GET' && r.path === '/api/brands/' + B).length;
        const initialReads = reads();
        await p.locator('#brand-core-nav-btn').click(); await p.waitForFunction(() => !!brandProfileController);
        assert.equal(reads(), initialReads, 'Ordinary Profile open reuses Home detail');
        await p.getByRole('button', { name: 'Advanced options', exact: true }).click();
        await p.locator('#brand-workspace-edit-open').click();
        await p.locator('#brand-workspace-edit-name').fill('Retained local draft');
        const revision = f.r.db.brands[0].revision;
        f.r.db.brands[0].revision++; f.r.db.brands[0].name = 'Newest server name';
        await p.locator('#brand-workspace-edit-save').click();
        await p.waitForFunction(() => canonicalBrandDetail.status === 'conflict');
        assert.equal(f.r.db.brands[0].name, 'Newest server name');
        await p.locator('#brand-workspace-conflict-reload').click();
        await p.waitForFunction(revision => canonicalBrandDetail.brand?.revision === revision + 1, revision);
        assert.equal(reads(), initialReads + 1);
        assert.equal(await p.locator('#brand-workspace-edit-name').inputValue(), 'Retained local draft');
        assert.equal(await p.evaluate(() => canonicalBrandDetail.draft.revision), revision, 'Reload never rebases a stale write silently');
        f.r.db.brands[0].revision++;
        await p.locator('#brand-workspace-conflict-reload').click();
        await p.waitForFunction(revision => canonicalBrandDetail.brand?.revision === revision + 2, revision);
        assert.equal(reads(), initialReads + 2);
        await p.locator('#brand-workspace-edit-cancel').click();
        await p.getByRole('button', { name: 'Save and continue', exact: true }).click();
        await p.locator('#brand-leave-dialog').getByText('The save was not confirmed. Your inputs are retained. Retry safely.', { exact: true }).waitFor();
        await p.keyboard.press('Escape');
        assert.equal(await p.locator('#brand-workspace-edit-name').inputValue(), 'Retained local draft');
        await p.locator('#brand-workspace-edit-cancel').click();
        await p.getByRole('button', { name: 'Discard changes', exact: true }).click();
        await p.waitForFunction(() => canonicalBrandDetail.status === 'ready');
        await p.locator('#brand-workspace-edit-open').click();
        await p.locator('#brand-workspace-edit-name').fill('Reconciled explicitly');
        const core = clone(f.r.db.brands[0].brand_core);
        core.brandDNA = { userApproved: true, avatar: { userApproved: true, imageUrl: '/accepted-avatar.svg' } };
        await p.route('**/accepted-avatar.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="green"/></svg>' }));
        await p.locator('#brand-workspace-edit-core').fill(JSON.stringify(core));
        await p.locator('#brand-workspace-edit-save').click(); await p.waitForFunction(() => canonicalBrandDetail.saved && canonicalBrandDetail.status === 'ready');
        assert.equal(f.r.db.brands[0].name, 'Reconciled explicitly'); assert.equal(f.r.db.brands[0].revision, revision + 3);
        await p.locator('#home-nav-btn').click(); await p.locator('[data-avatar-state=ready] img').waitFor();
        assert.equal(await p.locator('[data-avatar-state=ready] img').getAttribute('src'), '/accepted-avatar.svg');
        assert.equal(reads(), initialReads + 2, 'Home consumes accepted save without another GET');
        await p.evaluate(() => { for (let i = 0; i < 10; i++) homeFoundationController.sync(); clearAutosaveTimer(); });
        assert.equal(reads(), initialReads + 2, 'Repeated Home render does not fetch'); assert.equal(await snapshot(), before);
        assert(f.writes.every(r => r.method === 'PUT' && r.path === '/api/brands/' + B), 'Only explicit Brand PUTs are permitted');
        f.writes.length = 0;
      } finally { assert(f.writes.every(r => r.method === 'PUT' && r.path === '/api/brands/' + B)); f.writes.length = 0; await f.close(); }
    });
    await check('guided Profile 409 reload rebases untouched fields and retains local inputs before deliberate Save', async () => {
      const f = await setup(), p = f.page;
      try {
        await p.waitForFunction(() => document.querySelector('[data-avatar-state=ready]'));
        await p.locator('#brand-core-nav-btn').click(); await p.waitForFunction(() => !!brandProfileController);
        await p.locator('[data-profile-key="Brand description"]').fill('Local description');
        f.r.db.brands[0].revision++; f.r.db.brands[0].name = 'Remote name';
        await p.evaluate(async () => { if (await brandProfileController.save()) throw Error('Expected conflict'); });
        assert.match(await p.evaluate(() => brandProfileController.state.message), /changed elsewhere/);
        await p.getByRole('button', { name: 'Reload latest Brand', exact: true }).click();
        await p.waitForFunction(() => !brandProfileController.busy() && brandProfileController.state.message.startsWith('Latest Brand loaded.'));
        assert.equal(await p.evaluate(() => brandProfileController.state.name), 'Remote name');
        assert.equal(await p.locator('[data-profile-key="Brand description"]').inputValue(), 'Local description');
        await p.evaluate(async () => { if (!await brandProfileController.save()) throw Error(brandProfileController.state.message); });
        assert.equal(f.r.db.brands[0].brand_core.brandCore, 'Local description');
        assert(f.writes.every(r => r.method === 'PUT' && r.path === '/api/brands/' + B)); f.writes.length = 0;
      } finally { assert(f.writes.every(r => r.method === 'PUT' && r.path === '/api/brands/' + B)); f.writes.length = 0; await f.close(); }
    });
  } finally { await browser.close(); }
  console.log(`BW-36.22B2R1: ${groups} groups PASS; local intercepted transport only, no AI/provider calls or Canvas/Board writes.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
