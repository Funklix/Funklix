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
        pending.used = true; pending.requestUrl = url.href; pending.started.resolve(); await pending.release.promise;
        if (pending.abort) return intercept.abort('failed');
        return intercept.fulfill(pending.response);
      }
      if (f.aiResponses?.[url.pathname]) return intercept.fulfill(f.aiResponses[url.pathname]);
      if (url.pathname === '/generated-header.png') return intercept.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV1sAAAAASUVORK5CYII=', 'base64') });
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
  const generatedImage = 'http://localhost/generated-header.png';
  const aiReply = { title: 'Generated title', content: 'Generated copy', caption: 'Generated caption #Marketing', imageUrl: generatedImage };
  async function prepareAi(f, kind) {
    await f.page.evaluate(kind => {
      const node = state.nodes[0];
      node.type = kind === 'header' ? 'Landing Page' : kind.startsWith('social') ? 'Social Media Posting' : 'Content';
      node.social = { platform: 'LinkedIn', caption: 'Original caption', preview: 'Original CTA', hashtags: ['#Original'] };
      node.landingPage = { headerVisualPrompt: 'Original visual prompt' };
      updateNodeCard(node); state.selectedPrimary = node.id; state.selectedIds = new Set([node.id]); fillInspector(node);
      updateInspectorActionVisibility(); refreshLastSavedSnapshot(); state.isDirty = false; clearAutosaveTimer();
    }, kind);
    f.writes.length = 0;
    f.aiResponses = { '/api/refine-node': { json: aiReply } };
  }
  async function startAi(f, kind) {
    await f.page.evaluate(kind => {
      if (kind === 'header') el.generateHeaderVisualButton.click();
      else if (kind.startsWith('social')) {
        const label = { social: 'Regenerate Caption', 'social-cta': 'Regenerate CTA', 'social-hashtags': 'Regenerate Hashtags' }[kind];
        [...el.zoomLayer.querySelectorAll('button')].find(b => b.textContent === label).click();
      } else window.pendingSuggestion = createSuggestedNodeFromAnalysis({ recommendedNodeType: kind === 'suggest-social' ? 'Social Media Posting' : kind === 'suggest-landing' ? 'Landing Page' : 'Content', title: 'Suggested content', description: 'Suggested description', reason: 'Local evidence', suggestedStrategy: { channel: 'LinkedIn' } });
    }, kind);
  }
  const aiEndpoint = kind => kind === 'header' ? '/api/generate-image' : '/api/refine-node';
  const settleAi = f => f.page.waitForFunction(() => workspaceExitOperations.size === 0);
  async function observeMutations(f) {
    await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await f.page.evaluate(() => {
      window.staleCalls = [];
      for (const name of ['updateNodeCard', 'fillInspector', 'saveCampaignCanvasState', 'addEdge', 'setSaveStatus', 'renderCampaignCanvasFromStateIfNeeded']) {
        const original = window[name]; window[name] = (...args) => { window.staleCalls.push(name); return original(...args); };
      }
      window.retiredSnapshot = JSON.stringify(serializeState());
    });
  }
  async function noStaleMutations(f) {
    assert.deepEqual(await f.page.evaluate(() => window.staleCalls), []);
    assert.equal(await f.page.evaluate(() => JSON.stringify(serializeState()) === window.retiredSnapshot), true);
    assert.equal(await f.page.evaluate(() => state.autosaveTimer), null);
    assert.equal(await f.page.evaluate(() => !window.outgoingAiNode || JSON.stringify(window.outgoingAiNode) === window.outgoingAiSnapshot), true);
  }
  try {
    for (const kind of ['social', 'social-cta', 'social-hashtags', 'header', 'suggest', 'suggest-social', 'suggest-landing']) {
      await check(kind + ' real AI response holds Workspace exit, preserves output and Cancel retains it', async () => {
        const f = await fixture(); await prepareAi(f, kind);
        const hold = f.hold(p => p === aiEndpoint(kind), { json: aiReply });
        await startAi(f, kind); await hold.started.promise;
        const before = await scope(f.page);
        assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
        assert.equal(await scope(f.page), before);
        hold.release.resolve(); await settleAi(f);
        const output = await f.page.evaluate(kind => kind === 'header' ? state.nodes[0].images.at(-1).url : kind === 'social' ? state.nodes[0].social.caption : kind === 'social-cta' ? state.nodes[0].social.preview : kind === 'social-hashtags' ? state.nodes[0].social.hashtags.join(' ') : state.nodes.at(-1).content, kind);
        assert.match(output, kind === 'header' ? /generated-header\.png$/ : /Generated|Marketing/);
        const completed = await scope(f.page);
        await begin(f.page); await f.page.locator('#leave-cancel').click();
        assert.equal(await f.page.evaluate(() => window.switchResult), false); assert.equal(await scope(f.page), completed);
        await begin(f.page); await f.page.locator('#leave-continue').click(); await cleanExit(f);
        await f.page.waitForTimeout(3100);
        assert.equal(f.writes.filter(w => /^\/api\/boards/.test(w.path)).length, 0);
        await f.close();
      });
      for (const outcome of ['success', 'failure']) await check(kind + ' stale ' + outcome + ' cannot mutate a new Board with the same node ID', async () => {
        const f = await fixture(); await prepareAi(f, kind);
        const hold = f.hold(p => p === aiEndpoint(kind), outcome === 'failure' ? { status: 503, json: { error: 'Local generation failure' } } : { json: aiReply });
        await startAi(f, kind); await hold.started.promise;
        const retiredId = await f.page.evaluate(() => { window.outgoingAiNode = state.nodes.at(-1); window.outgoingAiSnapshot = JSON.stringify(window.outgoingAiNode); return window.outgoingAiNode.id; });
        // Normal navigation is held. Also exercise retirement from another lifecycle
        // owner, followed by the real loader with an overlapping node ID.
        await f.page.evaluate(() => { retireBoardForWorkspaceSwitch(); history.replaceState({}, '', '/'); });
        f.r.db.boards[0].canvas_json.nodes[0].id = retiredId;
        await f.page.evaluate(id => loadBoardFromUrlIfPresent(id), SHARED);
        await f.page.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); });
        await observeMutations(f); const writes = f.writes.length;
        hold.release.resolve(); await settleAi(f);
        await noStaleMutations(f);
        assert.equal(f.writes.length, writes, 'Stale suggestion must not dispatch its next AI stage or save');
        assert.equal(await f.page.evaluate(() => state.currentBoardId), SHARED);
        assert.equal(await f.page.evaluate(() => state.nodes[0].title), 'Outgoing confidential idea');
        await f.close();
      });
      await check(kind + ' failed generation releases its hold and preserves existing failure behavior', async () => {
        const f = await fixture(); await prepareAi(f, kind);
        const hold = f.hold(p => p === aiEndpoint(kind), { status: 503, json: { error: 'Local generation failure' } });
        const before = await scope(f.page); await startAi(f, kind); await hold.started.promise;
        assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
        hold.release.resolve(); await settleAi(f);
        if (kind.startsWith('suggest')) {
          // Analysis suggestions intentionally retain their existing local fallback.
          assert.equal(await f.page.evaluate(() => state.nodes.length), 2);
          await begin(f.page); await f.page.locator('#leave-continue').click();
        } else {
          assert.equal(await scope(f.page), before);
          assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true);
        }
        await cleanExit(f); await f.close();
      });
    }
    for (const stage of [1, 2, 3, 4]) await check('multi-stage landing suggestion rejects retirement at stage ' + (stage + 1), async () => {
      const f = await fixture(); await prepareAi(f, 'suggest-landing');
      const holds = Array.from({ length: stage + 1 }, () => f.hold(p => p === '/api/refine-node', { json: aiReply }));
      await startAi(f, 'suggest-landing');
      for (let i = 0; i < stage; i++) { await holds[i].started.promise; holds[i].release.resolve(); }
      await holds[stage].started.promise;
      await f.page.evaluate(() => { retireBoardForWorkspaceSwitch(); history.replaceState({}, '', '/'); });
      await observeMutations(f); const writes = f.writes.length;
      holds[stage].release.resolve(); await settleAi(f); await noStaleMutations(f);
      assert.equal(f.writes.length, writes); await f.close();
    });
    await check('catalog refresh keeps a valid Board generation result', async () => {
      const f = await fixture(); await prepareAi(f, 'social');
      const hold = f.hold(p => p === '/api/refine-node', { json: aiReply });
      await startAi(f, 'social'); await hold.started.promise;
      await f.page.evaluate(() => { state.workspaceCatalog = { ...state.workspaceCatalog, activeWorkspaceId: null, generation: state.workspaceCatalog.generation + 1 }; });
      hold.release.resolve(); await settleAi(f);
      assert.match(await f.page.evaluate(() => state.nodes[0].social.caption), /Generated/); await f.close();
    });
    for (const invalidation of ['account', 'generation', 'node']) await check('social completion rejects changed ' + invalidation + ' identity', async () => {
      const f = await fixture(); await prepareAi(f, 'social');
      const hold = f.hold(p => p === '/api/refine-node', { json: aiReply });
      await startAi(f, 'social'); await hold.started.promise;
      await f.page.evaluate(invalidation => {
        if (invalidation === 'account') state.user = { ...state.user, email: 'changed@test.invalid' };
        if (invalidation === 'generation') state.boardLoadGeneration++;
        if (invalidation === 'node') state.nodes[0] = { ...state.nodes[0] };
      }, invalidation);
      await observeMutations(f); hold.release.resolve(); await settleAi(f); await noStaleMutations(f); await f.close();
    });
    for (const kind of ['refine', 'review', 'image', 'next-step', 'platform', 'full-pack', 'posting-visual']) await check('existing ' + kind + ' asynchronous node mutation still holds Workspace exit', async () => {
      const f = await fixture(); await prepareAi(f, 'suggest');
      const endpoint = { refine: '/api/refine-node', review: '/api/review-node', image: '/api/generate-image', 'next-step': '/api/generate-next-step', platform: '/api/refine-node', 'full-pack': '/api/refine-node', 'posting-visual': '/api/generate-posting-visual' }[kind];
      const hold = f.hold(p => p === endpoint, { status: 503, json: { error: 'Local generation failure' } });
      await f.page.evaluate(kind => {
        const node = state.nodes[0];
        if (kind === 'platform') { node.type = 'Social Media Posting'; updateNodeCard(node); }
        let target = node;
        if (kind === 'posting-visual') { node.images = [{ id: 'source', url: 'http://localhost/generated-header.png' }]; target = createNode({ type: 'Social Media Posting', initial: { title: 'Local visual' }, position: { x: 400, y: 0 } }); addEdge(node.id, target.id); }
        window.existingMutation = kind === 'posting-visual' ? generatePostingVisualForNode(target) : kind === 'refine' ? runInlineRefine(node, 'Local instruction') : kind === 'review' ? reviewNodeWithAI(node) : kind === 'image' ? generateImageForNode(node) : kind === 'next-step' ? generateNextStepFromNode(node) : kind === 'platform' ? regenerateSocialForPlatform(node) : generateFullContentPack(node);
        window.existingMutation = window.existingMutation.catch(() => null);
      }, kind);
      await hold.started.promise;
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), false);
      hold.release.resolve(); await f.page.evaluate(() => window.existingMutation); await settleAi(f);
      await f.close();
    });
    for (const retired of [false, true]) await check('Facebook publication reconciliation respects ' + (retired ? 'retired' : 'current') + ' Board identity', async () => {
      const f = await fixture(); await prepareAi(f, 'social');
      await f.page.evaluate(() => { state.nodes[0].social.platform = 'Facebook'; window.FacebookSettings.refresh = async () => {}; });
      const hold = f.hold(p => p === '/api/social-publishing/facebook/publication', { json: {} });
      await f.page.evaluate(() => { window.facebookRefresh = refreshFacebookWorkspaceSnapshot(); }); await hold.started.promise;
      if (retired) {
        await f.page.evaluate(() => { retireBoardForWorkspaceSwitch(); history.replaceState({}, '', '/'); });
        await f.page.evaluate(id => loadBoardFromUrlIfPresent(id), SHARED);
      }
      await f.page.evaluate(() => {
        clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); window.reconcileCalls = [];
        window.FunklixContentWorkspace = { ...window.FunklixContentWorkspace, reconcileFacebookPublication: (...args) => window.reconcileCalls.push(args) };
      });
      // Match the real wire contract so the test reaches reconciliation if the
      // lifecycle check is removed.
      hold.response = { headers: { 'content-type': 'application/json', 'x-request-id': 'local-publication' }, json: { contract_version: 'bw32.3.9-v1', server_request_id: 'local-publication', client_request_id: new URL(hold.requestUrl).searchParams.get('clientRequestId'), ok: true, status: 'published', provider: 'facebook', finalized: true } };
      hold.release.resolve(); await f.page.evaluate(() => window.facebookRefresh);
      assert.equal(await f.page.evaluate(() => window.reconcileCalls.length), retired ? 0 : 1); await f.close();
    });
    await check('retired header response leaves a newer header generation and its controls untouched', async () => {
      const f = await fixture(); await prepareAi(f, 'header');
      const originalLabel = await f.page.locator('#generate-header-visual-btn').textContent();
      const old = f.hold(p => p === '/api/generate-image', { json: aiReply });
      await startAi(f, 'header'); await old.started.promise;
      await f.page.evaluate(() => { retireBoardForWorkspaceSwitch(); history.replaceState({}, '', '/'); });
      f.r.db.boards[0].canvas_json.nodes[0].type = 'Landing Page';
      f.r.db.boards[0].canvas_json.nodes[0].social = { platform: 'LinkedIn', caption: '', preview: '', hashtags: [] };
      f.r.db.boards[0].canvas_json.nodes[0].landingPage = { headerVisualPrompt: 'Incoming header prompt' };
      await f.page.evaluate(id => loadBoardFromUrlIfPresent(id), SHARED);
      await f.page.evaluate(() => { stopPresenceLite(); stopBoardRefreshPolling(); clearAutosaveTimer(); state.selectedPrimary = state.nodes[0].id; state.selectedIds = new Set([state.selectedPrimary]); fillInspector(state.nodes[0]); });
      assert.equal(await f.page.locator('#generate-header-visual-btn').textContent(), originalLabel);
      const fresh = f.hold(p => p === '/api/generate-image', { json: { imageUrl: generatedImage + '?incoming=1' } });
      await startAi(f, 'header'); await fresh.started.promise; await observeMutations(f);
      old.release.resolve(); await f.page.waitForFunction(() => workspaceExitOperations.size === 1);
      await noStaleMutations(f);
      assert.equal(await f.page.locator('#generate-header-visual-btn').textContent(), 'Generating...');
      assert.equal(await f.page.locator('#generate-header-visual-btn').isDisabled(), true);
      fresh.release.resolve(); await settleAi(f);
      assert.equal(await f.page.evaluate(() => state.nodes[0].images.length), 1);
      assert.equal(await f.page.evaluate(() => state.nodes[0].images[0].url), generatedImage + '?incoming=1');
      assert.equal(await f.page.locator('#generate-header-visual-btn').textContent(), originalLabel); await f.close();
    });
    for (const kind of ['social', 'header']) await check(kind + ' completion remains valid after cancelling an open Workspace confirmation', async () => {
      const f = await fixture(); await prepareAi(f, kind); await dirty(f.page);
      await begin(f.page); await f.page.locator('#leave-cancel').waitFor();
      const hold = f.hold(p => p === aiEndpoint(kind), { json: aiReply });
      await startAi(f, kind); await hold.started.promise;
      await f.page.locator('#leave-cancel').click();
      assert.equal(await f.page.evaluate(() => window.switchResult), false);
      hold.release.resolve(); await settleAi(f);
      assert.equal(await f.page.evaluate(() => state.currentBoardId), D);
      assert.equal(await f.page.evaluate(() => state.workspaceCatalog.activeWorkspaceId), W);
      assert.equal(await f.page.evaluate(kind => kind === 'header' ? state.nodes[0].images.length : state.nodes[0].social.caption.includes('Generated'), kind), kind === 'header' ? 1 : true);
      await f.close();
    });
    await check('late Facebook settings refresh cannot start reconciliation for a replacement Board', async () => {
      const f = await fixture(); await prepareAi(f, 'social');
      await f.page.evaluate(() => {
        state.nodes[0].social.platform = 'Facebook'; refreshLastSavedSnapshot();
        window.FacebookSettings.refresh = () => new Promise(resolve => { window.releaseSettings = resolve; });
        window.facebookRefresh = refreshFacebookWorkspaceSnapshot();
      });
      assert.equal(await f.page.evaluate(id => selectSessionWorkspace(id), W2), true); await cleanExit(f);
      f.r.db.boards[0].canvas_json.nodes[0].type = 'Social Media Posting';
      f.r.db.boards[0].canvas_json.nodes[0].social = { platform: 'Facebook', caption: 'Incoming caption', preview: '', hashtags: [] };
      f.aiResponses['/api/social-publishing/facebook/publication'] = { json: {} };
      await f.page.evaluate(id => loadBoardFromUrlIfPresent(id), SHARED);
      await f.page.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); });
      await f.page.waitForFunction(() => !state.presencePingInFlight && !state.boardRefreshInFlight);
      await f.page.evaluate(() => {
        window.originalFetch = window.fetch; window.lateReconciliationReads = [];
        window.fetch = (...args) => { window.lateReconciliationReads.push(args[0]); return window.originalFetch(...args); };
        window.releaseSettings();
      });
      await f.page.evaluate(() => window.facebookRefresh);
      assert.deepEqual(await f.page.evaluate(() => window.lateReconciliationReads), []); await f.close();
    });
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
