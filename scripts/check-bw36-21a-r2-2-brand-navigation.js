#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { runtime, W, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '..'), Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  let passed = 0;
  async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
  async function fixture({ association = B, singleton = false, empty = false, role = 'owner' } = {}) {
    const r = runtime(); r.db.boards[0].brand_id = association === 'hidden' ? null : association;
    r.db.boards[0].canvas_json.nodes = [{id:'saved-r22-node',type:'Idea',title:'Saved Board A',content:'Preserve this campaign',position:{x:10,y:10},images:[],tags:[],postits:[],variants:[],reactions:{},social:{},landingPage:{}}];
    if (!singleton) r.db.brands.push({ ...clone(r.db.brands[0]), id: Y, name: 'Navigation Brand Y' });
    if (role === 'viewer') { r.db.brandRole = 'viewer'; r.db.brands.forEach(b => { b.owner_email = 'independent-owner@example.test'; }); }
    const c = r.catalog(); c.request_id = '0123456789abcdef01234567';
    c.workspaces.forEach(w => { w.avatar_url = null; w.locale = 'en'; w.role = role; [...w.brands, ...w.boards].forEach(x => { delete x.workspace_id; if (role === 'viewer') x.role = 'viewer'; }); });
    if (empty) c.workspaces = [];
    const f = { catalog: c, writes: [], errors: [], posts: [], gets: 0, timeout: false, hold: null };
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); f.page = page; page.setDefaultTimeout(12000);
    page.on('pageerror', e => f.errors.push(e.message));
    await page.route('**/*', async route => {
      const q = route.request(), u = new URL(q.url()), method = q.method(); assert.equal(u.hostname, 'localhost');
      if (u.pathname.startsWith('/api/') && method !== 'GET' && !u.pathname.includes('/presence/')) f.writes.push({ path: u.pathname, method });
      if (u.pathname === '/api/auth/session') return route.fulfill({ json: { user: { email: EMAIL } } });
      if (u.pathname === '/api/workspaces') {
        if (method === 'GET') { f.gets++; return route.fulfill({ json: f.catalog }); }
        const body = q.postDataJSON(); f.posts.push(body);
        const existing = f.catalog.workspaces.find(w => w.id === body.workspace_id);
        const workspace = { id: body.workspace_id, name: body.name, role: 'owner', revision: 1, brands: [], boards: [] };
        if (!existing) f.catalog.workspaces.push({ ...workspace, avatar_url: null, locale: 'en' });
        if (f.hold) await f.hold.promise;
        if (f.timeout) { f.timeout = false; return route.abort('timedout'); }
        return route.fulfill({ status: existing ? 200 : 201, json: { contract: 'workspace_create_v2', request_id: body.request_id, ok: true, created: !existing, workspace } });
      }
      if (u.pathname === '/api/boards') return route.fulfill({ json: { boards: r.db.boards } });
      if (u.pathname.startsWith('/api/boards/presence/')) return route.fulfill({ json: { viewers: [] } });
      if (/\/editors|\/sharing/.test(u.pathname)) return route.fulfill({ json: { editors: [] } });
      if (u.pathname === '/api/boards/' + D) {
        assert.equal(method, 'GET', 'Navigation cannot mutate a Board');
        const board = clone(r.db.boards[0]); board.brand_id = association === 'hidden' ? null : association;if(association==='hidden')board.brand_visibility='hidden';
        board.access = { role: 'owner', canView: true, canEdit: true, canViewBoardBrandCore: true, canViewPresence: false };
        return route.fulfill({ json: board });
      }
      if (u.pathname==='/api/brands' && f.legacyBrands) return route.fulfill({json:{brands:f.legacyBrands}});
      if (u.pathname.startsWith('/api/brands')) { const out = await r.request(method, u.pathname, q.postDataJSON()); return route.fulfill({ status: out.statusCode, json: out.body }); }
      if (u.pathname.startsWith('/api/')) return route.fulfill({ json: { members: [], editors: [], connections: [] } });
      const file = path.join(ROOT, u.pathname === '/' || u.pathname.startsWith('/boards/') ? 'index.html' : u.pathname.slice(1));
      return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : file.endsWith('.ico') ? 'image/x-icon' : 'application/javascript', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    await page.goto('http://localhost' + (empty ? '/' : '/boards/' + D));
    await page.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating);
    await page.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setSidebarCollapsed(false); });
    f.writes = [];
    f.snapshot = () => page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, edges: state.edges, association: state.boardBrandAssociation, snapshot: state.authoritativeBoardBrandCore, core: state.brandCore, dirty: state.isDirty, revision: state.lastKnownUpdatedAt }));
    f.close = async () => { assert.deepEqual(f.errors, []); await page.close(); };
    return f;
  }
  async function openCreate(f, name = 'New independent Workspace') {
    await f.page.locator('#workspace-context-trigger').click();
    await f.page.locator('[data-workspace-create]').click();
    const form = f.page.locator('#workspace-create-dialog');
    if (await form.locator('input').isEnabled()) await form.locator('input').fill(name);
    await form.locator('[type=submit]').click(); return form;
  }
  try {
    for (const association of [B, null, 'hidden']) for (const collapsed of [false, true]) await check(`sidebar selects Y independently of Board ${association ? 'X' : 'unbranded'}; collapsed=${collapsed}`, async () => {
      const f = await fixture({ association }), p = f.page, before = await f.snapshot();
      await p.evaluate(collapsed => setSidebarCollapsed(collapsed), collapsed);
      await p.locator('#workspace-brand-trigger').click(); await p.locator(`[data-brand-id="${Y}"]`).click();
      assert.equal(await p.evaluate(() => state.session.brandId), Y); assert.equal(await f.snapshot(), before);
      if (association===B)assert.equal(await p.evaluate(() => resolveCampaignCreationContext().brand.id), B, 'Campaign remains bound to Board X');
      await p.locator('#workspace-brand-trigger').click();
      assert.equal(await p.locator(`[data-brand-id="${Y}"]`).getAttribute('aria-selected'), 'true');
      assert((await p.locator('#brand-selector-status').innerText()).includes('Open Board'));
      await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.activeElement.id), 'workspace-brand-trigger');
      await p.evaluate(() => syncRuntimeSessionFromLegacy('r22-test-save')); await p.evaluate(() => refreshActiveWorkspaceContext());
      assert.equal(await p.evaluate(() => state.session.brandId), Y); assert.equal(await f.snapshot(), before); assert.deepEqual(f.writes, []);
      await f.close();
    });
    await check('Home Y, All default, explicit filter, Profile Y, Canvas return and Board reload retain X', async () => {
      const f = await fixture(), p = f.page, before = await f.snapshot();
      await p.locator('#home-nav-btn').click(); await p.locator(`[data-home-action=brand][data-home-id="${Y}"]`).click();
      assert.equal(await p.locator(`[data-home-id="${Y}"][data-home-action=brand]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await p.locator('[data-home-action=all]').getAttribute('aria-pressed'), 'true');
      assert.equal(await p.locator('.home-board-card').count(), 1); assert.equal(await f.snapshot(), before);
      await p.locator('[data-home-action=filtered]').click(); assert.equal(await p.locator('.home-board-card').count(), 0);
      f.legacyBrands=[];await p.evaluate(()=>loadCanonicalBrandCatalog());assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),Y,'Partial legacy catalog cannot erase authorized Workspace preference');
      await p.locator('[data-home-action=all]').click(); await p.locator(`[data-home-action=profile][data-home-id="${Y}"]`).click();
      await p.waitForFunction(Y => canonicalBrandDetail.status === 'ready' && canonicalBrandDetail.brandId === Y, Y);
      assert.equal(await f.snapshot(), before);
      await p.locator('#campaign-canvas-nav-btn').click(); assert.equal(await f.snapshot(), before);
      await p.locator('#brand-core-nav-btn').click();
      await p.waitForFunction(Y => canonicalBrandDetail.status === 'ready' && canonicalBrandDetail.brandId === Y, Y);
      await p.locator('#campaign-canvas-nav-btn').click(); assert.equal(await f.snapshot(), before);
      await p.evaluate(D => loadBoardFromUrlIfPresent(D), D); assert.equal(await p.evaluate(() => state.boardBrandAssociation.brandId), B);
      assert.equal(await p.evaluate(() => state.session.brandId), Y); assert.deepEqual(f.writes, []); await f.close();
    });
    await check('viewer singleton Profile is independently accessible and mobile selectors remain reachable', async () => {
      const f = await fixture({ singleton: true, role: 'viewer' }), p = f.page;
      for (const width of [1440, 1024, 768, 390, 320]) for (const collapsed of [false, true]) {
        await p.setViewportSize({ width, height: 900 }); await p.evaluate(c => setSidebarCollapsed(c), collapsed);
        assert(await p.locator('#workspace-brand-trigger').isVisible(), `Brand reachable ${width}/${collapsed}`);
        assert(await p.locator('#workspace-context-trigger').isVisible(), `Workspace reachable ${width}/${collapsed}`);
        await p.locator('#workspace-brand-trigger').click(); await p.locator('.workspace-brand-row-actions').click();
        await p.waitForFunction(() => canonicalBrandDetail.status === 'ready'); assert.equal(await p.evaluate(() => canonicalBrandDetail.brandId), B);
        assert.equal(await p.evaluate(() => canonicalBrandDetail.brand.access.canEditCanonicalBrand), false, 'Actual server Profile is read-only for Brand viewer');
        await p.locator('#campaign-canvas-nav-btn').click();
      }
      assert.deepEqual(f.writes, []); await f.close();
    });
    await check('create second Workspace retains dirty Board; explicit switch uses Cancel/Discard lifecycle', async () => {
      const f = await fixture({ role: 'viewer' }), p = f.page;
      await p.evaluate(() => { state.nodes[0].title = 'Retained dirty Board'; markUnsaved(); clearAutosaveTimer(); });
      const before = await f.snapshot(), gets = f.gets, form = await openCreate(f);
      await form.getByText('Workspace created.', { exact: true }).waitFor(); await p.waitForFunction(() => state.workspaceCatalog.status === 'ready');
      if(process.env.BW36_R22_SCREENSHOTS){fs.mkdirSync(process.env.BW36_R22_SCREENSHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.BW36_R22_SCREENSHOTS,'r22-create-confirmed.png'),fullPage:true});}
      assert(f.gets > gets); assert.equal(await f.snapshot(), before); assert.equal(await p.evaluate(() => state.workspaceCatalog.activeWorkspaceId), W);
      assert.equal(await p.evaluate(() => state.workspaceCatalog.value.workspaces.length), 2);
      await form.getByRole('button', { name: 'Switch to new Workspace' }).click();
      await p.getByRole('button', { name: 'Cancel', exact: true }).last().click(); assert.equal(await f.snapshot(), before);
      // The confirmation owns/focuses its buttons and may close the create form.
      const id = f.posts[0].workspace_id;
      await p.evaluate(id => { void selectSessionWorkspace(id); }, id);
      await p.getByRole('button', { name: 'Discard and switch', exact: true }).click();
      await p.waitForFunction(id => state.workspaceCatalog.activeWorkspaceId === id, id);
      assert.equal(await p.evaluate(() => state.currentBoardId), null); assert.equal(await p.evaluate(() => state.nodes.length), 0); await f.close();
    });
    await check('timeout/lost response retries immutable UUID and name even after dialog dismissal', async () => {
      const f = await fixture(), p = f.page; f.timeout = true;
      let form = await openCreate(f); await form.getByText('Creation could not be confirmed.', { exact: false }).waitFor();
      assert.equal(f.posts.length, 1); await form.getByRole('button', { name: 'Cancel' }).click();
      form = await openCreate(f); await form.getByText('Workspace created.', { exact: true }).waitFor();
      assert.equal(f.posts.length, 2); assert.deepEqual(f.posts[0], f.posts[1]); assert.equal(f.catalog.workspaces.length, 2); await f.close();
    });
    await check('first Workspace activates automatically through the same dialog', async () => {
      const f = await fixture({ empty: true }), form = await openCreate(f); await form.getByText('Workspace created.', { exact: true }).waitFor();
      await f.page.waitForFunction(() => state.workspaceCatalog.status === 'ready');
      assert.equal(await f.page.evaluate(() => state.workspaceCatalog.activeWorkspaceId), f.posts[0].workspace_id); await f.close();
    });
    await check('account replacement during creation cannot reconcile or announce success', async () => {
      const f = await fixture(), p = f.page; f.hold = defer(); await openCreate(f);
      await p.waitForFunction(() => !!firstWorkspaceCreation?.promise);
      await p.evaluate(() => { state.user = { email: 'other@example.test' }; clearWorkspaceCatalog(); }); f.hold.resolve();
      await p.waitForFunction(() => firstWorkspaceCreation === null);
      assert.equal(await p.evaluate(() => state.workspaceCatalog.value), null); assert.equal(await p.locator('#workspace-create-dialog').count(), 0); await f.close();
    });
    await check('foreign Brand, stale catalog, public context and logout cannot select', async () => {
      const f = await fixture(), p = f.page;
      assert.equal(await p.evaluate(id => selectSessionBrand(id), W2), false);
      await p.evaluate(() => { state.workspaceCatalog.status = 'stale'; }); assert.equal(await p.evaluate(id => selectSessionBrand(id), Y), false);
      await p.evaluate(() => { state.workspaceCatalog.status = 'ready'; state.publicBoardToken = 'fixture'; }); assert.equal(await p.evaluate(id => selectSessionBrand(id), Y), false);
      await p.evaluate(() => { state.publicBoardToken = null; state.user = null; }); assert.equal(await p.evaluate(id => selectSessionBrand(id), Y), false); await f.close();
    });
    await check('Workspace validation never adopts a foreign preference; logout clears preference owner', async () => {
      const f = await fixture(), p = f.page;
      f.catalog.workspaces.push({ id: W2, name: 'Other Workspace', role: 'viewer', revision: 1, avatar_url: null, locale: 'en', brands: [], boards: [] });
      await p.evaluate(() => retryWorkspaceCatalog());
      await p.evaluate(Y => selectSessionBrand(Y), Y);
      await p.evaluate(W2 => selectSessionWorkspace(W2), W2);
      assert.equal(await p.evaluate(Y => selectSessionBrand(Y), Y), false);
      assert.equal(await p.evaluate(() => getResolvedWorkspaceBrand()), null);
      await p.evaluate(() => { state.user = null; clearWorkspaceCatalog(); });
      assert.equal(await p.evaluate(() => ephemeralBrandSwitcherSelection), null); await f.close();
    });
    await check('search keyboard skips hidden Brand rows and selection never opens Profile', async () => {
      const f = await fixture(), p = f.page;
      for (let i=0;i<9;i++)f.catalog.workspaces[0].brands.push({id:require('node:crypto').randomUUID(),name:'Extra '+i,revision:1,role:'viewer',logo_url:null,logo_revision:0});
      await p.evaluate(() => retryWorkspaceCatalog()); await p.locator('#workspace-brand-trigger').click();
      await p.locator('#brand-selector-popover input').fill('Navigation Brand Y');
      await p.locator(`[data-brand-id="${Y}"]`).focus(); await p.keyboard.press('ArrowDown');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.brandActionId), Y);
      await p.keyboard.press('ArrowDown'); assert.equal(await p.evaluate(() => document.activeElement.dataset.brandId), Y);
      await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => canonicalBrandDetail.status), 'closed');
      assert.equal(await p.evaluate(() => state.session.brandId), Y); await f.close();
    });
    if (process.env.BW36_R22_SCREENSHOTS) await check('representative light/dark desktop/tablet/mobile screenshots', async () => {
      const dir = process.env.BW36_R22_SCREENSHOTS; fs.mkdirSync(dir, { recursive: true });
      const f = await fixture(), p = f.page;
      await p.locator('#home-nav-btn').click(); await p.locator(`[data-home-action=brand][data-home-id="${Y}"]`).click();
      for (const [width, theme, language, collapsed] of [[1440,'light','en',false],[1440,'dark','de',true],[768,'light','de',true],[390,'dark','en',false]]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.evaluate(({ theme, language, collapsed }) => { FunklixTheme.setPreference(theme); state.uiLanguage = FunklixLanguage.setUiLanguage(language); setSidebarCollapsed(collapsed); renderWorkspaceSidebar(); }, { theme, language, collapsed });
        await p.locator('#workspace-brand-trigger').click();
        const popover = p.locator('#brand-selector-popover'); assert(await popover.isVisible());
        const box = await popover.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width + 1);
        await p.screenshot({ path: path.join(dir, `r22-${width}-${theme}-${language}-${collapsed ? 'collapsed' : 'expanded'}.png`), fullPage: true });
        await p.keyboard.press('Escape');
      }
      await f.close();
    });
    console.log(`PASS R2.2 ${passed} Chromium groups, mocked transport only.`);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
