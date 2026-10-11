#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runtime, D, EMAIL, now, clone } = require('./fixtures/bw36-13r5-local-runtime');
const { server } = require('./check-bw36-15-campaign-team-responsibilities');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const ROOT = path.resolve(__dirname, '..');
const OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function check({ refinement = false } = {}) {
  const r = runtime();
  r.db.boards[0].canvas_json.nodes = ['Idea','Content'].map((type,i) => ({
    id: `adaptive-${i ? 'b' : 'a'}`, type, title: `Asset ${i + 1}`, content: 'Existing content. '.repeat(35),
    status: 'Draft', position: { x: 60 + i * 560, y: 80 }, compact: true,
    tags: [], variants: [], images: [], postits: [], reactions: {},
    social: { platform: 'Instagram', caption: '', hashtags: [], preview: '', scheduledAt: '' },
    landingPage: {}, contentFormat: '1:1'
  }));
  r.db.boards[0].canvas_json.edges = [['adaptive-a','adaptive-b']];
  r.db.boards.push({ ...clone(r.db.boards[0]), id: OTHER, name: 'Other Board' });
  const s = server(r);
  const errors = [], writes = [], forbidden = [], requests = [];
  let sessionEmail = EMAIL;
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH }
    : fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const routeProductionFixture = async route => {
      const req = route.request(), url = new URL(req.url());
      assert.equal(url.hostname, 'localhost', 'Only authorized local production fixture endpoints');
      requests.push({ path: url.pathname, method: req.method() });
      if (/\/api\/(?:generate|refine|campaigns|ai|providers)/.test(url.pathname)) forbidden.push(url.pathname);
      if (url.pathname.startsWith('/api/') && !['GET','HEAD'].includes(req.method()) && !/presence|activity/.test(url.pathname)) writes.push(url.pathname);
      if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: { email: sessionEmail, name: 'Board Owner' } } });
      if (url.pathname === '/api/workspaces') {
        const catalog = r.catalog(); catalog.request_id = '0123456789abcdef01234567';
        catalog.workspaces = catalog.workspaces.map(w => ({ ...w, avatar_url: null, locale: null,
          brands: w.brands.map(({ workspace_id, ...b }) => b), boards: w.boards.map(({ workspace_id, ...b }) => b) }));
        return route.fulfill({ json: catalog });
      }
      if (url.pathname === '/api/brands') return route.fulfill({ json: { brands: r.catalog().workspaces[0].brands.map(b => ({ ...b, created_at: now, updated_at: now })) } });
      if (url.pathname.endsWith('/editors')) return route.fulfill({ json: (await s.call(req.method(), url.href, req.postDataJSON())).body });
      if ([`/api/boards/${D}`, `/api/boards/${OTHER}`].includes(url.pathname)) return route.fulfill({ json: (await r.request('GET', url.pathname)).body });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { boards: r.db.boards, members: [], editors: [], nodes: [], presence: [] } });
      const file = path.resolve(ROOT, url.pathname === '/' || url.pathname.startsWith('/boards/') ? 'index.html' : '.' + url.pathname);
      return route.fulfill(fs.existsSync(file) && fs.statSync(file).isFile() ? { path: file } : { body: '' });
    };
    await page.route('**/*', routeProductionFixture);
    await page.addInitScript(() => localStorage.setItem('tendra.canvasDensity.v1', JSON.stringify({ version: 1, mode: 'detailed' })));
    await page.goto(`http://localhost/boards/${D}`);
    await page.waitForFunction(() => state.currentBoardId && !state.isBoardLoading && state.nodes.length === 2 && state.workspaceCatalog.status === 'ready');
    await page.evaluate(() => { setAppMode('canvas'); setActiveView('board'); });
    const a = page.locator('.node[data-id="adaptive-a"]'), b = page.locator('.node[data-id="adaptive-b"]');
    const toggle = page.locator('.canvas-toolbar #canvas-compact-view-btn');
    const responsibilities = page.locator('.canvas-toolbar #campaign-responsibilities-btn');
    const view = async (card, expected) => assert.equal(await card.getAttribute('data-adaptive-view'), expected);
    const geometry = async () => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => state.edges.every(([from,to]) => [...el.links.querySelectorAll('path')].some(p => p.getAttribute('d') === edgePath(nodeBottomCenter(from),nodeBottomCenter(to))))), true, 'Edges match actual resized card endpoints');
    };
    const allCompact = async () => { await view(a,'compact'); await view(b,'compact'); };
    const pick = async card => { await card.locator('.type').click(); await page.mouse.move(1200,700); };
    const double = async card => { await card.locator('.type').dblclick(); await page.mouse.move(1200,700); };
    if (refinement) {
      assert.equal(await page.locator('.canvas-toolbar-row.primary #campaign-responsibilities-btn, .canvas-toolbar-row.primary #canvas-compact-view-btn').count(),0);
      assert.deepEqual(await page.locator('.toolbar-row2-left > button').evaluateAll(es => es.map(e => e.id)),
        ['filters-toggle-btn','utilities-toggle-btn','campaign-responsibilities-btn','canvas-compact-view-btn']);
      assert.equal(await responsibilities.textContent(),'Tasks');
      assert.equal(await toggle.textContent(),''); assert.equal(await toggle.locator('svg').count(),1);
      await responsibilities.click();
      const workspace = page.locator('#campaign-responsibilities');
      await workspace.waitFor();
      await page.waitForFunction(() => document.getElementById('campaign-responsibilities').getAttribute('aria-busy') === 'false');
      assert(await workspace.getByRole('heading',{name:'Campaign responsibilities',exact:true}).isVisible());
      await page.keyboard.press('Escape'); await workspace.waitFor({state:'detached'});
      assert.equal(await page.evaluate(() => document.activeElement.id),'campaign-responsibilities-btn');
      console.log('PASS R1 exact two-row ownership/order, Tasks opens existing responsibility workspace, icon-only SVG');
    }
    if (refinement) {
      await page.evaluate(() => {
        window.presentationStorageWrites = [];
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key,value) { window.presentationStorageWrites.push(key); return original.call(this,key,value); };
      });
      const before = await page.evaluate(() => ({nodes:JSON.stringify(state.nodes),edges:JSON.stringify(state.edges),dirty:state.isDirty}));
      const dbBefore = clone(r.db.boards), requestIndex = requests.length;
      for (const mode of ['standard','detailed','compact']) {
        await toggle.click(); await view(a,mode); await view(b,mode);
        if (mode !== 'compact') {
          await pick(a); await b.hover(); await view(a,mode); await view(b,mode);
          await pick(b); await a.hover(); await view(a,mode); await view(b,mode);
        }
      }
      assert.deepEqual(await page.evaluate(() => ({nodes:JSON.stringify(state.nodes),edges:JSON.stringify(state.edges),dirty:state.isDirty})),before);
      assert.deepEqual(clone(r.db.boards),dbBefore);
      assert.deepEqual(await page.evaluate(() => window.presentationStorageWrites),[]);
      assert.deepEqual(requests.slice(requestIndex).filter(r => r.path.startsWith('/api/') && !/presence|activity/.test(r.path)),[],'Global presentation performs zero API requests');
      console.log('PASS R1 first cycle all nodes, selection/hover authority, zero API/storage/data mutations');
    }
    const original = await page.evaluate(() => JSON.stringify(state.nodes));
    const saved = await page.evaluate(() => ({ board: localStorage.getItem('campaignCanvasState'), density: localStorage.getItem('tendra.canvasDensity.v1') }));
    const checkpoint = requests.length;
    assert.equal(await toggle.getAttribute('data-global-view'),'compact'); await allCompact();
    await a.hover(); await view(a,'standard'); await view(b,'compact'); await geometry();
    await page.mouse.move(1200,700); await allCompact();
    await a.focus(); await view(a,'standard'); await responsibilities.focus(); await allCompact();
    await pick(a); await view(a,'standard');
    await double(a); await view(a,'detailed'); await geometry();
    await pick(b); await view(a,'compact'); await view(b,'standard');
    await page.keyboard.press('Escape'); await allCompact();
    assert.equal(await page.evaluate(() => state.selectedPrimary),null);
    // Only the obsolete forced-Compact/Auto expectations are replaced.
    await pick(a);
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const mode of ['standard','detailed','compact']) {
        await toggle.click();
        assert.equal(await toggle.getAttribute('data-global-view'),mode);
        await view(a,mode); await view(b,mode);
        if (mode !== 'compact') {
          await pick(a); await b.hover(); await view(a,mode); await view(b,mode);
          await pick(b); await a.focus(); await view(a,mode); await view(b,mode);
          await double(a); await view(a,mode); await view(b,mode);
        }
      }
    }
    await a.hover(); await view(a,'standard'); await view(b,'compact');
    await page.mouse.move(1200,700); await allCompact();
    await pick(a); await view(a,'standard'); await double(a); await view(a,'detailed');
    await pick(b); await view(a,'compact'); await view(b,'standard');
    await page.keyboard.press('Escape'); await allCompact();
    await page.locator('#canvas').click({ position: { x: 100, y: 650 } }); await allCompact();
    if (refinement) { await toggle.click(); await toggle.click(); await view(a,'detailed'); await view(b,'detailed'); }
    await page.evaluate(async other => { await loadBoardFromUrlIfPresent(other); }, OTHER);
    await allCompact(); assert.equal(await toggle.getAttribute('data-global-view'),'compact');
    await page.evaluate(async id => { await loadBoardFromUrlIfPresent(id); }, D);
    await allCompact(); assert.equal(await page.evaluate(() => state.selectedPrimary), null);
    await page.evaluate(() => setActiveView('list')); await page.evaluate(() => setActiveView('board')); await allCompact();
    console.log('PASS exact BW-36.16 hierarchy sequence, two authorized Boards, legacy preference ignored, Canvas teardown');
    // Details button, keyboard-only selection and independent modal Escape ownership.
    await a.focus(); await page.keyboard.press('Space'); await view(a,'standard');
    await a.getByRole('button', { name: 'Show details', exact: true }).click(); await view(a,'detailed');
    await toggle.click(); await view(a,'standard'); await view(b,'standard');
    await toggle.click(); await view(a,'detailed'); await view(b,'detailed');
    await toggle.click(); await allCompact(); await double(a); await view(a,'detailed');
    await responsibilities.click(); assert(await page.locator('#campaign-responsibilities').isVisible());
    await page.keyboard.press('Escape'); await view(a,'detailed');
    await a.focus(); await page.keyboard.press('Escape'); await view(a,'standard');
    await page.keyboard.press('Escape'); await allCompact();
    await a.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await view(a,'detailed');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await allCompact();
    await page.locator('#utilities-toggle-btn').click();
    assert.equal(await page.locator('#floating-utilities-popover [data-canvas-density-choice], #floating-utilities-popover [data-utility-action="compact-all"], #floating-utilities-popover [data-utility-action="expand-all"]').count(),0);
    assert(await page.locator('#floating-utilities-popover [data-utility-action="auto-arrange"]').isVisible());
    await page.locator('#utilities-toggle-btn').click();
    // Child status control is usable without replacing an existing primary selection.
    await pick(a);
    const primary = await page.evaluate(() => state.selectedPrimary);
    const child = b.locator('.title');
    if (await child.count()) { await child.click(); assert.equal(await page.evaluate(() => state.selectedPrimary),primary); await responsibilities.focus(); }
    // Renderer geometry and strict content/layout/storage boundaries before intentional drag/connection.
    await page.mouse.move(1200,700);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => JSON.stringify(state.nodes)), original);
    assert.deepEqual(await page.evaluate(() => ({ board: localStorage.getItem('campaignCanvasState'), density: localStorage.getItem('tendra.canvasDensity.v1') })), saved);
    assert.equal(requests.slice(checkpoint).filter(r => /^\/api\/boards\/[^/]+$/.test(r.path) && r.method === 'GET').length,2, 'Only explicit Board switches reload');
    assert.equal(await page.evaluate(() => [...el.links.querySelectorAll('path')].every(p => !/NaN|undefined/.test(p.getAttribute('d')))),true);
    assert.deepEqual(writes,[]); assert.deepEqual(forbidden,[]);
    console.log('PASS accessible Details, keyboard, modal Escape, child controls, Utilities cleanup, zero presentation mutations/storage/provider calls');
    // Each responsive environment uses production toolbar/card rendering.
    for (const language of ['en','de']) for (const theme of ['light','dark']) {
      await page.evaluate(({language,theme}) => { state.uiLanguage = language; window.FunklixLanguage.setUiLanguage(language); document.documentElement.dataset.theme = theme; translateInterface(document); synchronizeAdaptiveCanvasToolbar(); }, {language,theme});
      for (const width of [1920,1440,1280,1024,768,640,600,480,375,360,320]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => synchronizeAppShell());
        assert(await toggle.isVisible()); assert(await responsibilities.isVisible());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true, `Page overflow ${language}/${theme}/${width}`);
        assert.equal(await page.locator('.canvas-toolbar').evaluate(e => e.scrollWidth <= e.clientWidth + 1),true, `Toolbar overflow ${language}/${theme}/${width}`);
        assert.equal(await toggle.getAttribute('aria-label'),language === 'de' ? 'Node-Ansicht: Kompakt. Zu Standard wechseln' : 'Node view: Compact. Switch to Standard');
        if (refinement) {
          assert.equal(await responsibilities.textContent(),language === 'de' ? 'Aufgaben' : 'Tasks');
          const taskName = language === 'de' ? 'Kampagnen-Verantwortlichkeiten verwalten' : 'Manage campaign responsibilities';
          assert.equal(await responsibilities.getAttribute('aria-label'),taskName);
          assert.equal(await responsibilities.getAttribute('title'),taskName);
          const box = await toggle.boundingBox(); assert.equal(box.width,44); assert.equal(box.height,44);
          for (const [mode,en,de,next] of [
            ['compact','Compact','Kompakt','Standard'], ['standard','Standard','Standard',language === 'de' ? 'Detailliert' : 'Detailed'],
            ['detailed','Detailed','Detailliert',language === 'de' ? 'Kompakt' : 'Compact']]) {
            const expected = language === 'de' ? `Node-Ansicht: ${de}. Zu ${next} wechseln` : `Node view: ${en}. Switch to ${next}`;
            assert.equal(await toggle.getAttribute('aria-label'),expected);
            assert.equal(await toggle.getAttribute('title'),expected);
            await page.keyboard.press('Tab'); await toggle.focus();
            assert(await toggle.evaluate(e => e.matches(':focus-visible')));
            assert.notEqual(await toggle.evaluate(e => getComputedStyle(e).outlineStyle),'none');
            await page.keyboard.press(mode === 'standard' ? 'Enter' : 'Space');
            const newMode = {compact:'standard',standard:'detailed',detailed:'compact'}[mode];
            await view(a,newMode); await view(b,newMode);
            assert.equal(await page.locator('#canvas-view-status').textContent(),language === 'de' ? `Node-Ansicht: ${{compact:'Kompakt',standard:'Standard',detailed:'Detailliert'}[newMode]}` : `Node view: ${{compact:'Compact',standard:'Standard',detailed:'Detailed'}[newMode]}`);
          }
          assert.equal(await page.locator('#canvas').evaluate(e => { const r=e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && ['hidden','auto','scroll','clip'].includes(getComputedStyle(e).overflowX); }),true,`Infinite Canvas stays inside viewport ${language}/${theme}/${width}`);
          const controls = await page.locator('.toolbar-row2-left > button').evaluateAll(es => es.map(e => { const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; }));
          const peers = await page.locator('.toolbar-row2-right').evaluate(e => [...e.children].filter(c => c.getClientRects().length).map(c => {const r=c.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
          assert(controls.every(c => peers.every(p => c.right <= p.left || p.right <= c.left || c.bottom <= p.top || p.bottom <= c.top)),`Overlap ${language}/${theme}/${width}`);
        }
        assert((await toggle.boundingBox()).height >= 44);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    await page.setViewportSize({width:640,height:450}); // 1280x900 at 200% equivalent reflow.
    await toggle.focus(); await page.keyboard.press('Space'); assert.equal(await toggle.getAttribute('data-global-view'),'standard');
    await page.keyboard.press('Enter'); assert.equal(await toggle.getAttribute('data-global-view'),'detailed');
    await page.keyboard.press('Space'); assert.equal(await toggle.getAttribute('data-global-view'),'compact');
    assert.equal(await page.locator('.canvas-toolbar').evaluate(e => e.scrollWidth <= e.clientWidth + 1),true);
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
    console.log('PASS 44 responsive language/theme cases, 200%-equivalent reflow, reduced motion, forced colors, 44px target');
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(() => { state.uiLanguage='en'; window.FunklixLanguage.setUiLanguage('en'); synchronizeAdaptiveCanvasToolbar(); resetAdaptiveCanvasView(); });
    await page.mouse.move(1200,700);
    // Read-only readers have the same render-only hierarchy and Details access.
    await page.evaluate(() => { window.originalAdaptiveAccess = {...state.boardAccess}; applyBoardAccessFromServer({...state.boardAccess,canEdit:false},'adaptive-reader'); });
    await pick(a); await view(a,'standard'); await double(a); await view(a,'detailed');
    if (refinement) {
      for (const mode of ['standard','detailed','compact']) { await toggle.click(); await view(a,mode); await view(b,mode); }
    }
    await page.evaluate(() => { applyBoardAccessFromServer(window.originalAdaptiveAccess,'adaptive-owner'); resetAdaptiveCanvasView(); });
    assert.deepEqual(writes,[]);
    // Drag retains its established data mutation; it cannot open Standard from a click.
    const dragBox = await b.locator('.type').boundingBox();
    await page.mouse.move(dragBox.x+5,dragBox.y+5); await page.mouse.down();
    await page.mouse.move(dragBox.x+65,dragBox.y+65,{steps:5}); await page.mouse.up();
    await page.mouse.move(1200,700); await view(b,'compact');
    await pick(b); await view(b,'standard');
    // Connection creation remains owned by the established handler (intentional edge mutation).
    await a.locator('.connector-link-handle').dispatchEvent('pointerdown',{button:0});
    assert.equal(await page.evaluate(() => state.activeConnection?.fromId),'adaptive-a');
    await b.locator('.type').click();
    assert.equal(await page.evaluate(() => state.activeConnection),null);
    assert(await page.evaluate(() => state.edges.some(([a,b]) => a === 'adaptive-a' && b === 'adaptive-b')));
    // Deleted active nodes are pruned by the real DOM/state lifecycle.
    await page.evaluate(() => { state.nodes = state.nodes.filter(n => n.id !== 'adaptive-b'); el.zoomLayer.querySelector('[data-id="adaptive-b"]').remove(); });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => adaptiveCanvasView.snapshot().selected),null);
    assert.deepEqual(errors,[]);
    console.log('PASS real drag/click suppression, connection creation, deletion pruning, zero console errors');
    // Touch taps and a visible Details action use the same renderer and selection functions.
    const touch = await browser.newPage({ viewport:{width:390,height:844},isMobile:true,hasTouch:true });
    touch.on('pageerror', error => errors.push(error.message));
    touch.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await touch.route('**/*', routeProductionFixture);
    await touch.goto(`http://localhost/boards/${D}`);
    await touch.waitForFunction(() => state.currentBoardId && !state.isBoardLoading && state.nodes.length===2);
    await touch.evaluate(() => {setAppMode('canvas');setActiveView('board');});
    const ta=touch.locator('.node[data-id="adaptive-a"]');
    await ta.locator('.type').tap(); await view(ta,'standard');
    await touch.locator('#inspector-canvas-details-btn').tap(); await view(ta,'detailed');
    const tb=touch.locator('.node[data-id="adaptive-b"]');
    await tb.locator('.type').tap(); await view(ta,'compact'); await view(tb,'standard');
    await touch.locator('#inspector-close-btn').tap();
    await touch.locator('#canvas').tap({position:{x:10,y:10}}); await view(ta,'compact'); await view(tb,'compact');
    assert.deepEqual(errors,[]);
    if (refinement) {
      await toggle.click(); await toggle.click(); await view(a,'detailed');
      sessionEmail = 'other-account@example.test';
      await page.evaluate(() => loadSessionUser());
      assert.equal(await toggle.getAttribute('data-global-view'),'compact'); await view(a,'compact');
      assert.equal(await page.evaluate(() => state.selectedPrimary),null);
      await toggle.click(); await view(a,'standard');
      await page.locator('#auth-signout-btn').click();
      await page.waitForFunction(() => !state.user);
      assert.equal(await toggle.getAttribute('data-global-view'),'compact'); await view(a,'compact');
      assert.deepEqual(errors,[]);
      console.log('PASS R1 reader global cycle, account change and sign-out clear UI presentation');
    }
    console.log('PASS touch selection, accessible Details and blank Canvas tap, zero touch console errors');
  } finally { await browser.close(); }
}
module.exports = { check };
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
