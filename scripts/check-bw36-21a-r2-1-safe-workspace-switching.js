#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { runtime, W, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '..');
const W2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W3 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SHARED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function main() {
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : null);
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
  let passed = 0;
  async function check(name, run) { await run(); console.log('PASS ' + name); passed++; }
  async function fixture(route = '/boards/' + D) {
    const r = runtime();
    r.db.boards[0].canvas_json.nodes = [{ id: 'saved-node', type: 'Idea', title: 'Outgoing confidential idea', content: 'Original', position: { x: 10, y: 10 }, images: [], tags: [], postits: [], variants: [], reactions: {}, social: {}, landingPage: {} }];
    const c = r.catalog(); c.request_id = '0123456789abcdef01234567';
    // Wire contract excludes the normalized workspace_id projection.
    c.workspaces.forEach(w => { w.avatar_url = null; w.locale = 'en'; [...w.brands, ...w.boards].forEach(x => delete x.workspace_id); });
    c.workspaces.push(...[W2, W3].map((id, i) => ({ id, name: 'Target ' + i, role: 'viewer', revision: 1, avatar_url: null, locale: null, brands: [], boards: [] })));
    const f = { r, catalog: c, signedIn: true, writes: [], errors: [], pending: [], failSave: 0, offlineSave: false, failCatalog: false };
    const page = await browser.newPage(); f.page = page; page.setDefaultTimeout(15000);
    page.on('pageerror', e => { f.errors.push(e.message); console.error('BROWSER', e.message); });
    await page.route('**/*', async intercept => {
      const req = intercept.request(), url = new URL(req.url()), method = req.method();
      assert.equal(url.hostname, 'localhost', 'Disposable local transport only');
      if (url.pathname.startsWith('/api/') && method !== 'GET' && !url.pathname.includes('/presence/')) f.writes.push({ path: url.pathname, method, body: req.postDataJSON() });
      const pending = f.pending.find(x => !x.used && x.match(url.pathname, method));
      if (pending) {
        pending.used = true; pending.started.resolve(); await pending.release.promise;
        if (pending.abort) return intercept.abort('failed');
        return intercept.fulfill(pending.response);
      }
      if (url.pathname === '/api/auth/session') return intercept.fulfill({ json: { user: f.signedIn ? { email: EMAIL, name: 'Local User' } : null } });
      if (url.pathname === '/api/workspaces') return intercept.fulfill(f.failCatalog ? { status: 503, json: {} } : { json: f.catalog });
      if (url.pathname === '/api/boards' && method === 'GET') return intercept.fulfill({ json: { boards: r.db.boards } });
      if (url.pathname.startsWith('/api/boards/presence/')) return intercept.fulfill({ json: { viewers: [] } });
      if (/\/editors|\/sharing/.test(url.pathname)) return intercept.fulfill({ json: { editors: [] } });
      if (url.pathname === '/api/boards/' + D || url.pathname === '/api/boards/' + SHARED) {
        if (method === 'PUT') {
          if (f.offlineSave) return intercept.abort('internetdisconnected');
          if (f.failSave) return intercept.fulfill({ status: f.failSave, json: { error: 'Fixture save failed' } });
          const body = req.postDataJSON(), board = r.db.boards[0];
          Object.assign(board, { canvas_json: body.canvas_json, updated_at: new Date().toISOString() });
        }
        const data = clone(r.db.boards[0]); data.id = url.pathname.split('/').pop();
        if (data.id === SHARED) { data.brand_id = null; data.brand_visibility = 'hidden'; }
        data.access = { role: 'owner', canView: true, canEdit: true, canViewBoardBrandCore: true, canManagePermissions: false, canViewPresence: true };
        return intercept.fulfill({ json: data });
      }
      if (url.pathname.startsWith('/api/brands')) {
        const res = await r.request(method, url.pathname, req.postDataJSON());
        return intercept.fulfill({ status: res.statusCode, json: res.body });
      }
      if (url.pathname === '/api/social-connections') return intercept.fulfill({ json: { connections: [] } });
      if (url.pathname.startsWith('/api/')) throw Error('Unexpected fixture request: ' + method + ' ' + url.pathname);
      const file = path.join(ROOT, url.pathname === '/' || url.pathname.startsWith('/boards/') ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
      return intercept.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    await page.goto('http://localhost' + route);
    await page.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating).catch(async e => { console.error(await page.evaluate(() => ({ catalog: state.workspaceCatalog, load: state.isBoardLoading, hydrate: state.isBoardHydrating }))); throw e; });
    await page.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); });
    await page.waitForFunction(() => !state.presencePingInFlight && !state.boardRefreshInFlight && workspaceExitOperations.size === 0);
    await page.evaluate(() => { stopPresenceLite(); stopBoardRefreshPolling(); });
    f.writes.length = 0;
    f.hold = (match, response, abort = false) => { const pending = { match, response, abort, started: deferred(), release: deferred() };
      pending.started.promise = Promise.race([pending.started.promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Fixture request did not start: ' + match)), 15000); timer.unref(); })]); f.pending.push(pending); return pending; };
    f.close = async () => { assert.deepEqual(f.errors, []); await page.close(); };
    return f;
  }
  const scope = page => page.evaluate(() => JSON.stringify({ board: state.currentBoardId, workspace: state.workspaceCatalog.activeWorkspaceId, nodes: state.nodes, edges: state.edges, core: state.brandCore, access: state.boardAccess, association: state.boardBrandAssociation, snapshot: state.authoritativeBoardBrandCore, revision: state.lastKnownUpdatedAt }));
  const dirty = page => page.evaluate(() => { state.nodes[0].content = 'Unsaved secret'; markUnsaved(); clearAutosaveTimer(); });
  const begin = (page, id = W2) => page.evaluate(id => { window.switchResult = selectSessionWorkspace(id); }, id);
  async function cleanExit(f, target = W2) {
    await f.page.waitForFunction(id => state.workspaceCatalog.activeWorkspaceId === id, target);
    const data = await f.page.evaluate(() => ({ board: state.currentBoardId, nodes: state.nodes, edges: state.edges, brand: state.boardBrandAssociation.brandId, core: state.authoritativeBoardBrandCore.value,
      access: state.boardAccess, dirty: state.isDirty, timer: state.autosaveTimer, polling: state.boardRefreshPollTimer, presence: state.presenceViewers, revision: state.lastKnownUpdatedAt,
      history: state.history, selection: state.selectedPrimary, local: localStorage.getItem(STORAGE_KEY), view: state.activeView, path: location.pathname, snapshot: state.lastSavedSnapshot === buildLastSavedSnapshot() }));
    assert.equal(data.board, null); assert.deepEqual(data.nodes, []); assert.deepEqual(data.edges, []); assert.equal(data.brand, null); assert.deepEqual(data.core, {});
    assert.equal(data.access.canEdit, false); assert.equal(data.access.canManagePermissions, false); assert.equal(data.access.canView, false);
    assert.equal(await f.page.evaluate(() => state.runtimeDiagnostics.boardOwnership.brandId), null);
    assert.equal(await f.page.evaluate(() => state.runtimeDiagnostics.pathBoardId), null);
    assert.equal(data.dirty, false); assert.equal(data.timer, null); assert.equal(data.polling, null); assert.deepEqual(data.presence, []);
    assert.equal(data.revision, null); assert.deepEqual(data.history, []); assert.equal(data.selection, null); assert.equal(data.local, null);
    assert.equal(data.view, 'home'); assert.equal(data.path, '/'); assert.equal(data.snapshot, true);
    assert(!(await f.page.locator('#home-foundation').innerText()).includes('Outgoing confidential'));
  }
  try {
    await check('clean saved Board retires state, permissions, snapshot and local projection without persistence writes', async () => {
      const f = await fixture(), persisted = clone(f.r.db.boards);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f);
      assert.equal(await f.page.evaluate(() => saveBoardToServer()), false);
      assert.deepEqual(f.writes, []); assert.deepEqual(clone(f.r.db.boards), persisted);
      await f.page.evaluate(() => detectDirtyFromSnapshot()); assert.equal(await f.page.evaluate(() => state.isDirty), false);
      await f.close();
    });
    await check('dirty Canvas Cancel preserves original data; explicit discard clears it', async () => {
      const f = await fixture(); await dirty(f.page); const before = await scope(f.page);
      await begin(f.page); await f.page.locator('#leave-cancel').click(); assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await scope(f.page), before);
      await begin(f.page); assert.match(await f.page.locator('.brand-confirm-card').innerText(), /Switching does not save/);
      await f.page.locator('#leave-continue').click(); assert.equal(await f.page.evaluate(() => window.switchResult), true); await cleanExit(f); assert.deepEqual(f.writes, []); await f.close();
    });
    await check('unsaved local draft without a Board preserves storage on Cancel and clears it only on discard', async () => {
      const f = await fixture('/');
      await f.page.evaluate(({ W, node }) => {
        state.workspaceCatalog.activeWorkspaceId = W; state.session.workspaceId = W;
        state.nodes = [node]; state.isDirty = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState())); renderWorkspaceSidebar();
      }, { W, node: clone(f.r.db.boards[0].canvas_json.nodes[0]) });
      const before = await scope(f.page), local = await f.page.evaluate(() => localStorage.getItem(STORAGE_KEY));
      await begin(f.page); await f.page.locator('#leave-cancel').click();
      assert.equal(await scope(f.page), before); assert.equal(await f.page.evaluate(() => localStorage.getItem(STORAGE_KEY)), local);
      await begin(f.page); await f.page.locator('#leave-continue').click(); await cleanExit(f); assert.deepEqual(f.writes, []); await f.close();
    });
    await check('read-only unsaved Canvas cannot save and still requires Cancel or explicit discard', async () => {
      const f = await fixture(); await dirty(f.page);
      await f.page.evaluate(() => applyBoardAccessFromServer({ role: 'viewer', canView: true, canEdit: false, canViewBoardBrandCore: true }));
      assert.equal(await f.page.evaluate(() => saveBoardToServer()), false); const before = await scope(f.page);
      await begin(f.page); await f.page.locator('#leave-cancel').click(); assert.equal(await scope(f.page), before);
      await begin(f.page); await f.page.locator('#leave-continue').click(); await cleanExit(f); assert.deepEqual(f.writes, []); await f.close();
    });
    await check('successful existing Board save before retry permits clean switch', async () => {
      const f = await fixture(); await dirty(f.page); assert.equal(await f.page.evaluate(() => saveBoardToServer()), true);
      await f.page.waitForFunction(() => workspaceExitOperations.size === 0);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f); assert.equal(f.writes.length, 1); assert.equal(f.writes[0].method, 'PUT'); await f.close();
    });
    await check('save acknowledgment covers submitted content only; edits made during save remain dirty', async () => {
      const f = await fixture(); await dirty(f.page);
      const hold = f.hold((p, m) => p === '/api/boards/' + D && m === 'PUT', { json: { ...clone(f.r.db.boards[0]), updated_at: '2026-10-16T14:00:00Z', access: { role: 'owner', canEdit: true, canView: true } } });
      await f.page.evaluate(() => { window.saveResult = saveBoardToServer(); }); await hold.started.promise;
      await f.page.evaluate(() => { state.nodes[0].content = 'Edit after save dispatch'; }); hold.release.resolve();
      assert.equal(await f.page.evaluate(() => window.saveResult), true);
      await f.page.waitForFunction(() => workspaceExitOperations.size === 0);
      assert.equal(await f.page.evaluate(() => state.isDirty), true);
      await begin(f.page); await f.page.locator('#leave-cancel').click();
      assert.equal(await f.page.evaluate(() => state.nodes[0].content), 'Edit after save dispatch'); await f.close();
    });
    await check('malformed successful save response cannot mark Canvas as saved', async () => {
      const f = await fixture(); await dirty(f.page);
      const hold = f.hold((p, m) => p === '/api/boards/' + D && m === 'PUT', { json: { id: D } });
      await f.page.evaluate(() => { window.saveResult = saveBoardToServer(); }); await hold.started.promise; hold.release.resolve();
      assert.equal(await f.page.evaluate(() => window.saveResult), false); assert.equal(await f.page.evaluate(() => state.isDirty), true);
      await begin(f.page); await f.page.locator('#leave-cancel').click(); assert.equal(await f.page.evaluate(() => state.currentBoardId), D); await f.close();
    });
    for (const kind of ['failed', 'offline', 'conflict']) await check(kind + ' save preserves unsaved work and requires explicit discard', async () => {
      const f = await fixture(); await dirty(f.page);
      f.failSave = kind === 'conflict' ? 409 : kind === 'failed' ? 503 : 0; f.offlineSave = kind === 'offline';
      await f.page.evaluate(() => { window.saveResult = saveBoardToServer(); });
      if (kind === 'conflict') {
        await f.page.waitForFunction(() => state.conflictModalOpen);
        assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
        await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      assert.notEqual(await f.page.evaluate(() => window.saveResult), true);
      const before = await scope(f.page); await begin(f.page); await f.page.locator('#leave-cancel').click();
      assert.equal(await scope(f.page), before); assert.equal(await f.page.evaluate(() => state.isDirty), true); await f.close();
    });
    await check('Home selector keeps confirmed Workspace and visibly explains blocked navigation', async () => {
      const f = await fixture();
      await f.page.locator('#home-nav-btn').click();
      await f.page.evaluate(() => { state.isSaving = true; });
      await f.page.locator('#home-workspace-select').selectOption(W2);
      await f.page.locator('#workspace-switch-status').waitFor();
      assert.match(await f.page.locator('#workspace-switch-status').innerText(), /Finish the Board save/);
      assert.equal(await f.page.locator('#home-workspace-select').inputValue(), W);
      assert.equal(await f.page.evaluate(() => state.currentBoardId), D);
      await f.page.evaluate(() => { state.isSaving = false; }); await f.close();
    });
    await check('loading/hydration/save/association/campaign/responsibility guards keep outgoing context intact', async () => {
      const f = await fixture();
      for (const key of ['isBoardLoading', 'isBoardHydrating', 'initialServerLoadInFlight', 'isSaving', 'conflictModalOpen']) {
        await f.page.evaluate(key => { state[key] = true; }, key); const before = await scope(f.page);
        assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false, key); assert.equal(await scope(f.page), before);
        await f.page.evaluate(key => { state[key] = false; }, key);
      }
      for (const kind of ['association', 'campaign', 'responsibility', 'operation']) {
        await f.page.evaluate(kind => {
          if (kind === 'association') state.boardBrandAssociation.status = 'submitting';
          if (kind === 'campaign') campaignCreationController = { suspendAutosave: true };
          if (kind === 'responsibility') responsibilityWorkspaceState.pending = { context: responsibilityContext() };
          if (kind === 'operation') workspaceExitOperations.add('pending-preview');
        }, kind);
        const before = await scope(f.page); assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false, kind); assert.equal(await scope(f.page), before);
        await f.page.evaluate(() => { state.boardBrandAssociation.status = 'idle'; campaignCreationController = null; responsibilityWorkspaceState.pending = null; workspaceExitOperations.clear(); });
      }
      await f.close();
    });
    await check('node preview dialogs retire on exit and active refinement blocks until its real response settles', async () => {
      const f = await fixture();
      await f.page.evaluate(() => runImproveNodeFlow(state.nodes[0]));
      assert.equal(await f.page.locator('#improve-ai-run').count(), 1);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true);
      assert.equal(await f.page.locator('#improve-ai-run').count(), 0); await cleanExit(f); assert.deepEqual(f.writes, []); await f.close();
      const busy = await fixture();
      const hold = busy.hold(p => p === '/api/refine-node', { json: { title: 'Reviewed local idea', content: 'Refined local content' } });
      await busy.page.evaluate(() => runImproveNodeFlow(state.nodes[0]));
      await busy.page.locator('[data-preset="Direct"]').click(); await busy.page.locator('#improve-ai-run').click(); await hold.started.promise;
      assert.equal(await busy.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      hold.release.resolve(); await busy.page.waitForFunction(() => workspaceExitOperations.size === 0);
      await begin(busy.page); await busy.page.locator('#leave-continue').click(); await cleanExit(busy); await busy.close();
    });
    await check('association write and dependent preview requests block exit until their real responses settle', async () => {
      const f = await fixture();
      await f.page.evaluate(() => loadCanonicalBrandCatalog());
      const hold = f.hold((p, m) => p === '/api/boards/' + D && m === 'PATCH', { status: 503, json: {} });
      await f.page.evaluate(() => { el.boardBrandAssociationChoice.value = ''; window.associationResult = submitBoardBrandAssociation({ preventDefault() {} }); });
      await hold.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      hold.release.resolve(); await f.page.evaluate(() => window.associationResult);
      await f.page.waitForFunction(() => workspaceExitOperations.size === 0);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f); await f.close();
    });
    await check('campaign generation uses existing pending operation guard with mocked failure and no paid request', async () => {
      const f = await fixture();
      const hold = f.hold(p => p === '/api/generate-campaign', { status: 503, json: { error: 'Local provider unavailable' } });
      await f.page.evaluate(() => { window.campaignResult = debugRunCampaignV3AI(); }); await hold.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      hold.release.resolve(); await f.page.evaluate(() => window.campaignResult);
      await f.page.waitForFunction(() => workspaceExitOperations.size === 0);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f); await f.close();
    });
    await check('responsibility submission and failed-save retry hold the Workspace until confirmed', async () => {
      const f = await fixture();
      const hold = f.hold((p, m) => p === '/api/boards/' + D && m === 'PUT', { status: 503, json: {} });
      await f.page.evaluate(email => {
        responsibilityWorkspaceState.rosterContext = responsibilityContext();
        responsibilityWorkspaceState.roster = [{ email, name: 'Local User' }];
        window.responsibilityResult = assignCampaignResponsibilities(['saved-node'], email).catch(() => false);
      }, EMAIL);
      await hold.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      hold.release.resolve(); assert.equal(await f.page.evaluate(() => window.responsibilityResult), false);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false, 'Failed assignment remains held for deliberate retry');
      const retry = f.hold((p, m) => p === '/api/boards/' + D && m === 'PUT', { json: { id: D, updated_at: '2026-10-16T14:00:00Z', assignments: [{ id: 'saved-node', ownerEmail: EMAIL, ownerName: 'Local User' }] } });
      await f.page.evaluate(() => { window.responsibilityRetry = persistResponsibilitySelection(); }); await retry.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      retry.release.resolve(); await f.page.evaluate(() => window.responsibilityRetry);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f); await f.close();
    });
    await check('authorization revalidation rejects an account change while awaiting the fresh catalog', async () => {
      const f = await fixture(), before = await scope(f.page);
      const hold = f.hold(p => p === '/api/workspaces', { json: f.catalog });
      await begin(f.page); await hold.started.promise;
      await f.page.evaluate(() => { state.user = { email: 'replacement@test.invalid' }; }); hold.release.resolve();
      assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await scope(f.page), before); await f.close();
    });
    await check('delayed Board load blocks switch until hydration settles', async () => {
      const f = await fixture(), data = clone(f.r.db.boards[0]); data.access = { role: 'owner', canView: true, canEdit: true, canViewBoardBrandCore: true };
      const hold = f.hold((p, m) => p === '/api/boards/' + D && m === 'GET', { json: data });
      await f.page.evaluate(() => { window.loadResult = loadBoardFromUrlIfPresent(); }); await hold.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      hold.release.resolve(); assert.equal(await f.page.evaluate(() => window.loadResult), true);
      await f.page.waitForFunction(() => workspaceExitOperations.size === 0);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f); await f.close();
    });
    for (const status of [200, 409, 503]) await check('late save ' + status + ' cannot restore retired context or conflict UI', async () => {
      const f = await fixture(); await dirty(f.page);
      const hold = f.hold((p, m) => p === '/api/boards/' + D && m === 'PUT', { status, json: { ...clone(f.r.db.boards[0]), access: { role: 'owner', canEdit: true } } });
      await f.page.evaluate(() => { window.saveResult = saveBoardToServer(); }); await hold.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false, 'Real write blocks navigation');
      // Defense-in-depth: exercise the same retirement boundary with an already
      // superseded response, as logout/route invalidation can also retire work.
      await f.page.evaluate(() => { retireBoardForWorkspaceSwitch(); history.replaceState({}, '', '/'); });
      hold.release.resolve(); await f.page.evaluate(() => window.saveResult);
      assert.equal(await f.page.evaluate(() => state.currentBoardId), null); assert.equal(await f.page.evaluate(() => state.boardAccess.canEdit), false);
      assert.equal(await f.page.evaluate(() => state.conflictModalOpen), false); await f.close();
    });
    await check('queued autosave near transition cannot save outgoing Canvas', async () => {
      const f = await fixture(); await dirty(f.page);
      await f.page.evaluate(() => scheduleAutosave()); await begin(f.page); await f.page.locator('#leave-continue').click(); await cleanExit(f);
      await f.page.waitForTimeout(3100); assert.deepEqual(f.writes, []); await f.close();
    });
    for (const abort of [false, true]) await check('late presence ' + (abort ? 'failure' : 'success') + ' and Board refresh cannot restore collaboration/data', async () => {
      const f = await fixture();
      const presence = f.hold(p => p.startsWith('/api/boards/presence/'), { json: { viewers: [{ email: 'old@test.invalid' }] } }, abort);
      const refresh = f.hold((p, m) => p === '/api/boards/' + D && m === 'GET', { json: { ...clone(f.r.db.boards[0]), updated_at: '2030-01-01T00:00:00Z' } });
      await f.page.evaluate(() => { window.pingResult = pingPresenceLite(); window.refreshResult = pollBoardForRemoteChanges(); });
      await Promise.all([presence.started.promise, refresh.started.promise]);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f);
      presence.release.resolve(); refresh.release.resolve(); await f.page.evaluate(() => Promise.all([window.pingResult, window.refreshResult])); await cleanExit(f); await f.close();
    });
    await check('independent shared Board outside catalog exits and remains available through direct route/reload/Back', async () => {
      const f = await fixture('/boards/' + SHARED); assert.equal(await f.page.evaluate(() => state.currentBoardId), SHARED);
      // Independent Board access does not select a Workspace.
      assert.equal(await f.page.evaluate(() => state.workspaceCatalog.activeWorkspaceId), null);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f);
      await f.page.goto('http://localhost/boards/' + SHARED); await f.page.waitForFunction(() => !state.isBoardLoading);
      assert.equal(await f.page.evaluate(() => state.currentBoardId), SHARED); await f.page.reload(); await f.page.waitForFunction(() => !state.isBoardLoading);
      assert.equal(await f.page.evaluate(() => state.nodes[0].id), 'saved-node'); await f.page.goBack(); await f.close();
    });
    await check('same Workspace is no-op; inaccessible/revoked/stale catalog and offline validation preserve context', async () => {
      const f = await fixture(); await dirty(f.page); const before = await scope(f.page);
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W), true); assert.equal(await scope(f.page), before); assert.equal(await f.page.locator('#leave-continue').count(), 0);
      assert.equal(await f.page.evaluate(() => selectSessionWorkspace('missing')), false);
      f.catalog.workspaces = f.catalog.workspaces.filter(w => w.id !== W2);
      await begin(f.page); await f.page.locator('#leave-continue').click(); assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await scope(f.page), before);
      f.failCatalog = true; await begin(f.page, W3); await f.page.locator('#leave-continue').click(); assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await scope(f.page), before);
      await f.page.evaluate(() => { state.workspaceCatalog.status = 'stale'; }); assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W3), false); await f.close();
    });
    await check('account/logout changes, superseded attempts and edits during confirmation reject stale decisions', async () => {
      const f = await fixture(); await dirty(f.page); const before = await scope(f.page);
      await begin(f.page); await f.page.evaluate(() => { window.originalAccount = state.user; state.user = null; }); await f.page.locator('#leave-continue').click(); assert.equal(await f.page.evaluate(() => window.switchResult), false);
      await f.page.evaluate(() => { state.user = window.originalAccount; }); assert.equal(await scope(f.page), before);
      await begin(f.page); f.signedIn = false; await f.page.locator('#leave-continue').click(); assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await scope(f.page), before); f.signedIn = true;
      await begin(f.page); await f.page.evaluate(() => { window.firstSwitch = window.switchResult; }); await begin(f.page, W3);
      assert.equal(await f.page.locator('#leave-continue').count(), 1); assert.equal(await f.page.evaluate(() => window.firstSwitch), false);
      await f.page.locator('#leave-cancel').click(); assert.equal(await scope(f.page), before);
      await begin(f.page); await f.page.evaluate(() => { state.nodes[0].content = 'Edited during confirmation'; }); await f.page.locator('#leave-continue').click();
      assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await f.page.evaluate(() => state.currentBoardId), D); await f.close();
    });
    for (const action of ['cancel', 'discard', 'save', 'failed-save']) await check('dirty Brand Profile ' + action + ' preserves existing leave contract', async () => {
      const f = await fixture();
      await f.page.evaluate(({ W, B }) => openRegularBrandProfile({ workspace_id: W, id: B }), { W, B });
      await f.page.waitForFunction(() => brandProfileController);
      await f.page.evaluate(() => { brandProfileController.state.core.brandCore = 'Profile changes'; brandProfileController.state.dirty = true; });
      if (action === 'failed-save') f.r.db.failPut = true;
      await begin(f.page);
      // The leave dialog is the existing native dialog from Brand Profile.
      const dialog = f.page.getByRole('dialog', { name: 'Save changes before leaving?' }); await dialog.waitFor();
      if (action === 'cancel') await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
      else if (action === 'discard') await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
      else await dialog.getByRole('button', { name: 'Save and continue', exact: true }).click();
      if (action === 'failed-save') await dialog.getByRole('status').filter({ hasText: 'The save was not confirmed.' }).waitFor();
      if (action === 'discard' || action === 'save') { await cleanExit(f); assert.equal(f.r.db.brands[0].brand_core.brandCore, action === 'save' ? 'Profile changes' : 'Original positioning'); }
      else { assert.equal(await f.page.evaluate(() => state.currentBoardId), D); assert.equal(await f.page.evaluate(() => brandProfileController.dirty()), true); }
      await f.close();
    });
    console.log(`PASS ${passed} safe Workspace switching browser groups; local fixtures only, zero provider calls`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
