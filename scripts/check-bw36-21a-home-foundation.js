#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { model, sameScope } = require('../home-foundation');
const { chromium } = require('playwright-core');
const { runtime, W, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '..');
const W2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', D3 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const UNKNOWN = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function catalog() {
  const brand = (id, name) => ({ id, name, revision: 1, role: 'owner', logo_url: null, logo_revision: 0 });
  return { contract: 'workspace_catalog_v1', request_id: '0123456789abcdef01234567', workspaces: [
    { id: W, name: 'Studio North', role: 'owner', revision: 1, avatar_url: null, locale: 'en',
      brands: [brand(B, 'Atelier North'), brand(B2, 'Field Notes')], boards: [
        { id: D, name: 'The next chapter', brand_id: B, role: 'owner' },
        { id: D2, name: 'A quieter kind of launch', brand_id: B2, role: 'viewer' },
        { id: D3, name: 'Ideas worth keeping', brand_id: null, role: 'editor' }] },
    { id: W2, name: 'Open Studio', role: 'viewer', revision: 1, avatar_url: null, locale: null, brands: [], boards: [] }
  ] };
}
const metadata = [ { id: D, updated_at: '2026-10-10T08:00:00Z' }, { id: D2, updated_at: '2026-10-14T09:10:00Z' },
  { id: UNKNOWN, name: 'PRIVATE COLLECTION NAME', updated_at: '2026-10-16T10:00:00Z', brand_display: { name: 'PRIVATE BRAND' } } ];

function composition() {
  const c = { account: { email: EMAIL }, identity: EMAIL, status: 'ready', catalog: catalog(), workspaceId: W, brandId: B, boardId: D };
  const order = clone(metadata);
  assert.deepEqual(model(c, metadata).boards.map(b => b.id), [D, D2, D3]);
  assert.deepEqual(metadata, order, 'Collection/manual library ordering is untouched');
  assert.deepEqual(model({ ...c, boardId: null }, metadata).boards.map(b => b.id), [D, D2, D3]);
  assert(model(c, metadata).partial); assert.equal(model(c, []).boards.length, 3);
  assert.equal(model(c, [{ id: D3, updated_at: 'invalid' }]).boards.find(b => b.id === D3).savedAt, undefined);
  assert.equal(model(c, metadata, 'brand').boards.length, 1);
  assert.equal(model(c, metadata).boards.find(b => b.id === D3).brand, null);
  for (const patch of [{ account: null }, { identity: 'other@test.invalid' }, { status: 'stale' }, { publicToken: 'public' }]) {
    assert.equal(model({ ...c, ...patch }, metadata).boards.length, 0);
  }
  assert.equal(model({ ...c, workspaceId: W2 }, metadata).canCreate, false);
  for (const key of ['account', 'catalog', 'identity', 'status', 'generation', 'workspaceId', 'brandId', 'boardId', 'boardGeneration', 'view', 'publicToken']) {
    assert.equal(sameScope(c, { ...c, [key]: {} }), false, key + ' rejects stale scope');
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!/AI suggestion accepted|Asset approved|Campaign deployed|No deployed campaigns yet/.test(html));
  console.log('PASS authorized composition, Brand priority, server dates, missing metadata, stable manual ordering, hidden associations and identity boundaries');
}

async function browserChecks() {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH }
    : fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  const r = runtime(); r.db.boards[0].name = 'The next chapter';
  r.db.boards[0].canvas_json.nodes = [{ id: 'saved-idea', type: 'Idea', title: 'Saved idea', content: 'An existing campaign', status: 'Draft', position: { x: 20, y: 20 }, tags: [], images: [], postits: [], variants: [], reactions: {}, social: {}, landingPage: {} }];
  let signedIn = true, available = catalog(), failure = false, collectionFailure = false, collectionDenied = false, delayed = false, release;
  const boardLoads = [];
  const errors = [], writes = [], provider = [], detail = [], requests = [];
  async function pageAt(route = '/', preferences = {}) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, ...preferences });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async interception => {
      const req = interception.request(), url = new URL(req.url());
      assert.equal(url.hostname, 'localhost', 'No remote/provider requests from Home');
      requests.push(url.pathname);
      if (/\/api\/(generate|ai-brain|campaigns|discover)/.test(url.pathname)) provider.push(url.pathname);
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method()) && !/presence/.test(url.pathname)) writes.push(url.pathname);
      if (url.pathname === '/api/auth/session') return interception.fulfill({ json: { user: signedIn ? { email: EMAIL, name: 'Alex North' } : null } });
      if (url.pathname === '/api/workspaces') return interception.fulfill(failure ? { status: 503, json: { error: { code: 'INTERNAL_ERROR' } } } : { json: available });
      if (url.pathname === '/api/boards') {
        const result = clone(metadata);
        if (delayed) { delayed = false; await new Promise(resolve => { release = resolve; }); }
        try { return await interception.fulfill(collectionDenied ? { status: 403, body: 'Access revoked' } : collectionFailure ? { status: 503, json: {} } : { json: { boards: result } }); } catch { return; }
      }
      if (url.pathname.startsWith('/api/boards/') && !/presence|editors|sharing|access/.test(url.pathname)) {
        detail.push(url.pathname);
        const pending = boardLoads.shift();
        if (pending) {
          pending.started();
          await pending.ready;
          if (pending.abort) return interception.abort(typeof pending.abort === 'string' ? pending.abort : 'timedout');
          return interception.fulfill(pending.response);
        }
        const response = await r.request(req.method(), url.pathname, req.postDataJSON());
        return interception.fulfill({ status: response.statusCode, json: response.body });
      }
      if (url.pathname === '/api/brands') return interception.fulfill({ json: { brands: r.db.brands } });
      if (url.pathname.startsWith('/api/')) return interception.fulfill({ json: { members: [], editors: [], presence: [], boards: [] } });
      const file = path.join(ROOT, routeFile(url.pathname));
      return interception.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    await page.addInitScript(() => localStorage.setItem('campaignCanvasState', JSON.stringify({ nodes: [{ id: 'old-private-draft', type: 'Idea', title: 'Old private draft' }], edges: [] })));
    await page.goto('http://localhost' + route);
    await page.waitForFunction(() => state.runtimeDiagnostics?.startupBranch && state.activeView);
    return page;
  }
  function routeFile(url) { return url === '/' || url.startsWith('/boards/') ? 'index.html' : decodeURIComponent(url.slice(1)); }
  const home = page => page.locator('#home-foundation');
  const action = (page, value) => home(page).locator(`[data-home-action="${value}"]`);
  const selectW = async page => { await page.locator('#home-workspace-select').selectOption(W); await home(page).locator('.home-board-card').first().waitFor(); };
  try {
    signedIn = false;
    let page = await pageAt(); await action(page, 'signin').waitFor();
    assert.equal(await home(page).locator('.home-board-card').count(), 0); assert.equal(await page.evaluate(() => state.nodes.length), 0); await page.close();
    signedIn = true;
    page = await pageAt(); await page.locator('#home-workspace-select').waitFor();
    assert.equal(await home(page).locator('.home-board-card').count(), 0, 'Multiple Workspaces require selection');
    await selectW(page);
    await page.waitForFunction(() => document.querySelector('#home-foundation time'));
    assert.deepEqual(await home(page).locator('.home-board-card h3').allTextContents(), ['A quieter kind of launch', 'The next chapter', 'Ideas worth keeping']);
    assert(!(await home(page).innerText()).includes('PRIVATE')); assert.equal(detail.length, 0, 'Home never retrieves a full Board');
    assert.equal(await page.evaluate(() => state.nodes.length), 0, 'Root does not restore old Canvas draft');
    assert.equal(await page.evaluate(() => state.runtimeDiagnostics.localDraft.restored), false);
    await action(page, 'brand').first().click(); await action(page, 'filtered').click();
    assert.equal(await home(page).locator('.home-board-card').count(), 1);
    assert.equal(await page.evaluate(() => state.session.brandId), B); await action(page, 'all').click();
    assert.equal(await home(page).locator('.home-board-card').count(), 3);
    const screenshots = process.env.BW36_HOME_SCREENSHOTS || path.join(ROOT, 'work/bw36-21a'); fs.mkdirSync(screenshots, { recursive: true });
    const geometries = [];
    for (const [width, height, theme, language, large] of [[1440,1000,'light','en',false],[1440,1000,'dark','de',false],[375,900,'light','en',false],[320,900,'dark','de',false],[768,1000,'system','en',false],[720,1000,'light','de',true]]) {
      await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      await page.evaluate(({ theme, language, large }) => { FunklixTheme.setPreference(theme); state.uiLanguage = FunklixLanguage.setUiLanguage(language); document.documentElement.style.fontSize = large ? '200%' : ''; refreshDashboardIfVisible(); }, { theme, language, large });
      assert((await home(page).innerText()).includes(language === 'de' ? 'Brands in deinem Workspace' : 'Brands in your Workspace'), 'Actual EN/DE copy');
      const geometry = await home(page).evaluate(element => ({ width: element.getBoundingClientRect().width, scroll: element.scrollWidth,
        internalOverflow: element.scrollWidth > element.getBoundingClientRect().width + 1
          ? Array.from(element.querySelectorAll('*')).filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
            .map(e => ({ tag: e.tagName, class: e.className, width: e.clientWidth, scroll: e.scrollWidth, right: e.getBoundingClientRect().right })).slice(0, 30) : [],
        overflow: Array.from(element.querySelectorAll('*')).filter(e => e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => e.className) }));
      assert(geometry.scroll <= geometry.width + 1, JSON.stringify({ width, geometry })); assert.deepEqual(geometry.overflow, [], 'No clipped/wide Home descendants');
      const contrast = await home(page).evaluate(element => {
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        const luminance = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
          const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
        const card = element.querySelector('.home-board-card'), ink = luminance(getComputedStyle(card.querySelector('.home-board-group')).color), background = luminance(getComputedStyle(card).backgroundColor);
        return (Math.max(ink, background) + .05) / (Math.min(ink, background) + .05);
      });
      assert(contrast >= 4.5, `Small accent text contrast ${contrast}`);
      geometries.push({ viewport: width, theme, language, large, accentTextContrast: contrast, ...geometry });
      if (!large && width !== 768) {
        await page.screenshot({ path: path.join(screenshots, `home-${width}-${theme}-${language}.png`), fullPage: true });
        if (width < 400) {
          await home(page).locator('.home-board-card').first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(screenshots, `boards-${width}-${theme}-${language}.png`), fullPage: true });
          await home(page).locator('h1').scrollIntoViewIfNeeded();
        }
      }
    }
    fs.writeFileSync(path.join(screenshots, 'geometry.json'), JSON.stringify(geometries, null, 2));
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; state.uiLanguage = FunklixLanguage.setUiLanguage('en'); refreshDashboardIfVisible(); });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await action(page, 'all').focus(); await page.keyboard.press('Enter');
    assert.equal(await action(page, 'all').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.homeAction), 'all', 'Refresh retains keyboard focus');
    // Optional read failure keeps catalog destinations, and does not mean empty.
    collectionFailure = true;
    await page.evaluate(() => { setActiveView('boards_library'); setActiveView('home'); });
    await action(page, 'metadata').waitFor(); assert.equal(await home(page).locator('.home-board-card').count(), 3);
    collectionFailure = false;
    await action(page, 'metadata').click(); await home(page).locator('time').first().waitFor();
    // Reject an old metadata response after switching to another Workspace.
    delayed = true;
    await page.evaluate(() => { setActiveView('boards_library'); setActiveView('home'); });
    await page.waitForFunction(() => document.querySelector('#home-foundation [aria-labelledby="home-continue-title"]'));
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    await page.locator('#home-workspace-select').selectOption(W2); release(); release = null;
    await page.waitForFunction(id => state.workspaceCatalog.activeWorkspaceId === id, W2);
    assert.equal(await home(page).locator('.home-board-card').count(), 0); assert(!(await home(page).innerText()).includes('Atelier North'));
    await page.evaluate(() => { state.user = { email: 'new-account@example.test' }; renderAuthState(); });
    assert(!(await home(page).innerText()).includes('Studio North')); assert.equal(await home(page).locator('.home-brand-card').count(), 0);
    await page.evaluate(() => { state.user = null; clearWorkspaceCatalog(); }); await action(page, 'signin').waitFor();
    assert.equal(await home(page).locator('time').count(), 0); await page.close();
    console.log('PASS signed-in/out root, local draft guard, Workspace/Brand context, filters, optional failures, stale response, account/logout isolation, keyboard focus, six actual layout geometries and four Chromium screenshots');

    // Catalog failures must not be presented as an empty account.
    failure = true; page = await pageAt(); await action(page, 'retry').waitFor();
    assert(!(await home(page).innerText()).includes('first Workspace')); failure = false; await action(page, 'retry').click(); await page.locator('#home-workspace-select').waitFor(); await page.close();
    available = { ...catalog(), workspaces: [] }; page = await pageAt(); await action(page, 'workspace-create').waitFor(); await page.close(); available = catalog();
    // Long labels, missing logos, viewer/public boundaries and revoked reads.
    available.workspaces[0].name = 'A very long Workspace name '.repeat(5).trim();
    available.workspaces[0].brands[0].name = 'Continue';
    available.workspaces[0].brands[0].logo_url = `/api/brands/${B}/logo?revision=1`; available.workspaces[0].brands[0].logo_revision = 1;
    available.workspaces[0].boards[0].name = 'An exceptionally long saved Board name '.repeat(4).trim();
    available.workspaces[0].role = 'viewer'; available.workspaces[0].brands.forEach(b => { b.role = 'viewer'; });
    page = await pageAt('/', { viewport: { width: 320, height: 900 } }); await selectW(page);
    await page.evaluate(() => { state.uiLanguage = FunklixLanguage.setUiLanguage('de'); refreshDashboardIfVisible(); });
    assert((await action(page, 'brand').first().innerText()).endsWith('Continue'), 'Object names are not translated');
    assert.equal(await action(page, 'create').count(), 0, 'Viewer gets no creation action');
    await page.waitForFunction(() => document.querySelector('.home-brand-pick .brand-logo-initials'));
    assert(await home(page).evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Long names do not overflow');
    await page.evaluate(() => { state.publicBoardToken = 'public-fixture'; refreshDashboardIfVisible(); });
    assert.equal(await home(page).locator('.home-board-card').count(), 0); await page.close();
    available = catalog(); page = await pageAt(); await selectW(page); collectionDenied = true; failure = true;
    await page.evaluate(() => { setActiveView('boards_library'); setActiveView('home'); });
    await action(page, 'retry').waitFor(); assert(!(await home(page).innerText()).includes('Atelier North'));
    collectionDenied = false; failure = false; await page.close();
    console.log('PASS long names, real logo failure fallback, untranslated object names, viewer/public boundaries, revoked metadata and failed catalog clear private cards');
    // Saved active Board stays first and returns to the same live Canvas.
    page = await pageAt('/boards/' + D); await page.waitForFunction(() => !state.isBoardLoading && state.nodes.length === 1);
    await page.locator('#home-nav-btn').click(); await home(page).locator('.home-board-card').first().waitFor();
    assert.equal(await home(page).locator('.home-board-card h3').first().textContent(), 'The next chapter');
    assert(!(await action(page, 'brand').first().isDisabled()), 'R2.2 Brand navigation remains available with an open Board');
    await page.evaluate(() => { state.isBoardLoading = true; refreshDashboardIfVisible(); });
    assert(await action(page, 'board').first().isDisabled(), 'Do not open another Board during hydration');
    await page.evaluate(() => { state.isBoardLoading = false; refreshDashboardIfVisible(); });
    assert(!(await action(page, 'board').first().isDisabled()));
    const snapshot = await page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, core: state.brandCore, updated: state.lastKnownUpdatedAt }));
    await page.evaluate(() => { state.isDirty = true; state.nodes[0].title = 'Unsaved campaign work'; });
    const dirty = await page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, core: state.brandCore, updated: state.lastKnownUpdatedAt }));
    await page.evaluate(() => refreshDashboardIfVisible()); assert.equal(await page.evaluate(() => state.isDirty), true);
    await action(page, 'board').first().click(); assert.equal(await page.evaluate(() => state.activeView), 'board');
    assert.equal(await page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, core: state.brandCore, updated: state.lastKnownUpdatedAt })), dirty);
    assert.notEqual(snapshot, dirty); await page.close();
    // Full route navigation uses the same reauthorizing loader as the library.
    page = await pageAt(); await selectW(page);
    await action(page, 'board').filter({ hasText: 'Open Board' }).nth(1).click();
    await page.waitForURL('**/boards/' + D); await page.waitForFunction(() => state.currentBoardId && !state.isBoardLoading);
    await page.reload(); await page.waitForFunction(() => state.currentBoardId && !state.isBoardLoading);
    assert.equal(await page.evaluate(() => state.nodes[0].id), 'saved-idea');
    await page.goBack(); await page.locator('#home-workspace-select').waitFor(); await page.close();
    // Exercise the real loader and Home controller, with only transport mocked.
    function deferredLoad(response, abort = false) {
      let release, started;
      const ready = new Promise(resolve => { release = resolve; });
      const seen = new Promise(resolve => { started = resolve; });
      boardLoads.push({ response, abort, ready, started });
      return { release, seen };
    }
    const begin = (page, id, key) => page.evaluate(({ id, key }) => {
      // Match route navigation without replacing the test document.
      history.replaceState({}, '', '/boards/' + id);
      setActiveView('board');
      window[key] = loadBoardFromUrlIfPresent(id);
    }, { id, key });
    const showHome = async page => {
      await page.locator('#home-nav-btn').click();
      await home(page).locator('.home-board-card').first().waitFor();
      // Settle optional metadata before completion: it must not mask a missing
      // loader notification by causing an unrelated Home redraw afterwards.
      await home(page).locator('time').first().waitFor();
    };
    async function expectLoading(page, loading) {
      const actual = await page.evaluate(() => {
        const host = document.querySelector('#home-foundation');
        const buttons = [...host.querySelectorAll('[data-home-action="board"]')];
        return { disabled: buttons.map(b => b.disabled),
          notice: host.textContent.includes('A Board is loading. Please wait before opening another.') };
      });
      assert(actual.disabled.length > 0);
      assert(actual.disabled.every(value => value === loading), 'Board actions immediately reflect completed loading state');
      assert.equal(actual.notice, loading, 'Loading explanation immediately reflects completed loading state');
    }
    const valid = (id = D) => ({ ...clone(r.db.boards[0]), id,
      access: { canView: true, canEdit: true, canViewBoardBrandCore: true, role: 'owner' } });
    for (const [label, response, abort] of [
      ['request failure', { status: 503, json: { error: 'Fixture failure' } }],
      ['invalid association', { json: { ...valid(), brand_id: 'invalid' } }],
      ['wrong Board identity', { json: valid(D2) }],
      ['invalid Canvas', { json: { ...valid(), canvas_json: { nodes: 'invalid' } } }],
      ['malformed JSON', { contentType: 'application/json', body: '{' }],
      ['transport timeout', null, true],
      ['transport termination', null, 'aborted'],
      ['success', { json: valid() }]
    ]) {
      page = await pageAt(); await selectW(page);
      // Root boot clears its loading flag after Home's first render.
      await expectLoading(page, false);
      const pending = deferredLoad(response, abort);
      await begin(page, D, 'recoveryLoad'); await pending.seen;
      await showHome(page); await expectLoading(page, true);
      assert.equal(await page.evaluate(() => state.initialServerLoadInFlight), true);
      pending.release();
      const loaded = await page.evaluate(() => window.recoveryLoad);
      assert.equal(loaded, label === 'success', label);
      await expectLoading(page, false);
      assert.deepEqual(await page.evaluate(() => [state.isBoardLoading, state.isBoardHydrating, state.initialServerLoadInFlight]), [false, false, false]);
      // Retry uses the same loader; actions must stay disabled until it finishes.
      const retry = deferredLoad({ json: valid() });
      await begin(page, D, 'retryLoad'); await retry.seen;
      await showHome(page); await expectLoading(page, true);
      retry.release(); assert.equal(await page.evaluate(() => window.retryLoad), true);
      await expectLoading(page, false);
      assert.equal(await page.evaluate(() => state.nodes[0].id), 'saved-idea');
      await page.close();
      console.log('PASS Home loading recovery and retry: ' + label);
    }
    for (const oldFails of [false, true]) {
      page = await pageAt(); await selectW(page);
      const old = deferredLoad(oldFails ? { status: 503, json: {} } : { json: valid() });
      await begin(page, D, 'oldLoad'); await old.seen;
      const latest = deferredLoad({ json: valid(D2) });
      await begin(page, D2, 'latestLoad'); await latest.seen;
      await showHome(page); await expectLoading(page, true);
      old.release(); assert.equal(await page.evaluate(() => window.oldLoad), false);
      await expectLoading(page, true); // stale finally cannot enable current actions
      latest.release(); assert.equal(await page.evaluate(() => window.latestLoad), true);
      await expectLoading(page, false);
      const snapshot = await page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, core: state.brandCore }));
      assert.equal(await page.evaluate(() => state.currentBoardId), D2);
      // Complete a newer request before the older response arrives.
      const stale = deferredLoad({ json: valid() });
      await begin(page, D, 'staleLoad'); await stale.seen;
      const winner = deferredLoad({ json: valid(D2) });
      await begin(page, D2, 'winnerLoad'); await winner.seen;
      await showHome(page); await expectLoading(page, true);
      winner.release(); assert.equal(await page.evaluate(() => window.winnerLoad), true);
      await expectLoading(page, false);
      stale.release(); assert.equal(await page.evaluate(() => window.staleLoad), false);
      await expectLoading(page, false);
      assert.equal(await page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, core: state.brandCore })), snapshot);
      await page.close();
    }
    console.log('PASS rapid switching, stale success/failure during active load, and late stale completion preserve current Canvas and actions');
    assert.deepEqual(errors, []); assert.deepEqual(provider, []); assert.deepEqual(writes, [], 'Home renders and opens do not write Board/Brand/Canvas data');
    console.log('PASS catalog failure/retry, no Workspace, active Board priority, persisted Brand guard, dirty Canvas preservation, saved Board route/reload/Back, zero provider calls or writes');
  } finally { if (release) release(); await browser.close(); }
}
composition();
if (!process.argv.includes('--model-only')) browserChecks().catch(error => {
  console.error(error);
  // Keep the failure diagnosable when Actions log downloads are unavailable.
  if (process.env.GITHUB_ACTIONS === 'true') console.error('::error title=Home foundation regression::'
    + String(error.stack || error).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'));
  process.exitCode = 1;
});
