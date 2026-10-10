#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runtime, D, EMAIL, now, clone, png } = require('./fixtures/bw36-13r5-local-runtime');
const { server, protectedGenerator } = require('./check-bw36-15-campaign-team-responsibilities');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const ROOT = path.resolve(__dirname, '..');
const PERSON_A = 'editor@local.test', PERSON_B = EMAIL;
function seed(r) {
  const canvas = r.db.boards[0].canvas_json;
  canvas.nodes = ['Idea', 'Campaign Variation', 'Content', 'Content', 'Social Media Posting', 'Landing Page', 'Email Campaign'].map((type, index) => ({
    id: `continuity-${index + 1}`, type, title: `Campaign asset ${index + 1}`, status: 'Draft',
    position: { x: 60 + index * 230, y: 60 }, tags: [], variants: [], images: [], postits: [], reactions: {},
    contentFormat: '1:1', audience: '', goal: '', channel: '', funnelStage: '', tone: '', favoriteImageId: null,
    social: { platform: 'Instagram', caption: '', hashtags: [], preview: '', scheduledAt: '' }, imagePrompt: '',
    landingPage: { headerVisualPrompt: '', headerClaim: '', problem: '', solution: '', trust: '', cta: '' },
    compact: false, justConnectedAt: null, content: `Existing campaign content ${index + 1}`
  }));
  canvas.edges = [[1,2],[2,3],[2,4],[3,5],[5,6],[6,7]].map(pair => pair.map(id => `continuity-${id}`));
}
async function serverChecks() {
  const r = runtime(); seed(r);
  const s = server(r, { pgDates: true, advanceMs: 137 });
  let revision = now;
  const canvas = clone(r.db.boards[0].canvas_json);
  for (const email of [PERSON_A, PERSON_B, '']) {
    canvas.nodes[0].ownerEmail = email;
    const response = await s.call('PUT', `/api/boards/${D}`, {
      canvas_json: canvas, lastKnownUpdatedAt: revision, responsibility_changes: [{ id: canvas.nodes[0].id, email }]
    });
    assert.equal(response.statusCode, 200, 'Sequential fractional-millisecond PostgreSQL Date revisions must match');
    assert.notEqual(response.body.updated_at, revision);
    assert.equal(response.body.assignments[0].ownerEmail, email);
    assert.deepEqual(Object.keys(response.body).sort(), ['access', 'assignments', 'id', 'updated_at']);
    revision = response.body.updated_at;
  }
  const before = s.writes;
  canvas.nodes[0].ownerEmail = PERSON_A;
  const stale = await s.call('PUT', `/api/boards/${D}`, { canvas_json: canvas, lastKnownUpdatedAt: now,
    responsibility_changes: [{ id: canvas.nodes[0].id, email: PERSON_A }] });
  assert.equal(stale.statusCode, 409); assert.equal(s.writes, before);
  for (const user of [null, { email: 'viewer@local.test' }, { email: 'foreign@other.test' }]) {
    const denied = await s.call('PUT', `/api/boards/${D}`, { canvas_json: canvas, lastKnownUpdatedAt: revision,
      responsibility_changes: [{ id: canvas.nodes[0].id, email: PERSON_A }] }, user);
    assert([401,403].includes(denied.statusCode));
  }
  console.log('PASS production server: PostgreSQL Date rows with .137/.274/.411 revisions, authoritative assignments, genuine stale conflict, owner/editor/viewer boundaries');
}
async function browserChecks() {
  const r = runtime(); seed(r);
  const s = server(r, { pgDates: true, advanceMs: 137 });
  const originalBrand = clone(r.db.brands), originalBoard = clone(r.db.boards[0]);
  const commands = [], errors = [], nativeDialogs = [], requests = [];
  let boardGets = 0;
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH }
    : fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { nativeDialogs.push(dialog.type()); void dialog.dismiss(); });
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      assert.equal(url.hostname, 'localhost', 'No production/provider/AI/storage request');
      requests.push({ path: url.pathname, method: req.method() });
      assert(!/\/api\/(?:generate|refine|campaigns|ai|providers)/.test(url.pathname), 'No provider or AI requests');
      if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: { email: EMAIL, name: 'Board Owner' } } });
      if (url.pathname === '/api/workspaces') {
        const catalog = r.catalog(); catalog.request_id = '0123456789abcdef01234567';
        catalog.workspaces = catalog.workspaces.map(w => ({ ...w, avatar_url: null, locale: null,
          brands: w.brands.map(({ workspace_id, ...b }) => b), boards: w.boards.map(({ workspace_id, ...b }) => b) }));
        return route.fulfill({ json: catalog });
      }
      if (url.pathname === '/api/brands') return route.fulfill({ json: { brands: r.catalog().workspaces[0].brands.map(b => ({ ...b, created_at: now, updated_at: now })) } });
      if (url.pathname.endsWith('/editors')) {
        const response = await s.call(req.method(), url.href, req.postDataJSON());
        return route.fulfill({ status: response.statusCode, json: response.body });
      }
      if (url.pathname === `/api/boards/${D}`) {
        if (req.method() === 'PUT') {
          const body = req.postDataJSON();
          assert(Array.isArray(body.responsibility_changes), 'Only responsibility mutations in this session');
          assert.deepEqual(Object.keys(body).sort(), ['canvas_json','lastKnownUpdatedAt','responsibility_changes']);
          const response = await s.call('PUT', url.href, body);
          commands.push({ body, status: response.statusCode, result: clone(response.body) });
          return route.fulfill({ status: response.statusCode, json: response.body });
        }
        boardGets++;
        return route.fulfill({ json: (await r.request('GET', url.pathname)).body });
      }
      if (url.pathname === '/fixture-avatar.png') return route.fulfill({ contentType: 'image/png', body: png });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { boards: r.db.boards, members: [], editors: [], nodes: [], presence: [] } });
      const file = path.resolve(ROOT, url.pathname === '/' || url.pathname.startsWith('/boards/') ? 'index.html' : '.' + url.pathname);
      return route.fulfill(fs.existsSync(file) && fs.statSync(file).isFile() ? { path: file } : { body: '' });
    });
    await page.goto(`http://localhost/boards/${D}`);
    await page.waitForFunction(() => state.currentBoardId && state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && state.nodes.length === 7);
    await page.evaluate(() => { setAppMode('canvas'); setActiveView('board'); });
    const toolbar = page.locator('.canvas-toolbar'), entry = toolbar.locator('#campaign-responsibilities-btn');
    const dialog = page.locator('#campaign-responsibilities');
    const id1 = 'continuity-1', id2 = 'continuity-2';
    const immutableCanvas = await page.evaluate(() => state.nodes.map(n => {
      const { ownerEmail, ownerName, ownerAvatar, ...rest } = sanitizeNodeForPersistence(n); return rest;
    }));
    const edges = await page.evaluate(() => state.edges);
    assert(await entry.isVisible());
    await page.locator('#utilities-toggle-btn').click();
    assert.equal(await page.locator('#floating-utilities-popover [data-utility-action="campaign-responsibilities"]').count(), 0);
    assert(!await page.locator('#floating-utilities-popover').innerText().then(text => /responsibilities/i.test(text)));
    await page.locator('#utilities-toggle-btn').click();
    await entry.focus(); await page.keyboard.press('Enter');
    async function interactive() {
      await page.waitForFunction(() => document.getElementById('campaign-responsibilities')?.getAttribute('aria-busy') === 'false');
      assert(await dialog.isVisible());
      assert(await dialog.locator('[data-responsibility-node] button').evaluateAll(buttons => buttons.length > 0 && buttons.every(b => !b.disabled)));
      assert.equal(await dialog.getByRole('button', { name: 'Load latest project', exact: true }).count(), 0);
      assert(await dialog.getByRole('button', { name: 'Add team member', exact: true }).isEnabled());
    }
    await interactive();
    async function mutate(id, email) {
      const before = commands.length, previousRevision = r.db.boards[0].updated_at, getCount = boardGets;
      await page.evaluate(id => { window.previousResponsibilityNode = getNode(id); }, id);
      await dialog.locator(`[data-responsibility-node="${id}"] button`).click();
      if (email) {
        await dialog.locator(`.responsibility-people [data-email="${email}"]`).click();
        await dialog.locator('.responsibility-picker').getByRole('button', { name: 'Assign', exact: true }).click();
      } else await dialog.getByRole('button', { name: 'Remove responsibility', exact: true }).click();
      await dialog.locator('.responsibility-live').getByText('Saved', { exact: true }).waitFor();
      assert.equal(commands.length, before + 1);
      const command = commands.at(-1);
      assert.equal(command.status, 200);
      assert.equal(command.body.lastKnownUpdatedAt, previousRevision);
      assert.equal(command.result.updated_at, r.db.boards[0].updated_at);
      assert.equal(await page.evaluate(() => state.lastKnownUpdatedAt), command.result.updated_at);
      assert.equal(await dialog.getByRole('button', { name: /^Assign all unassigned/ }).textContent(), `Assign all unassigned (${r.db.boards[0].canvas_json.nodes.filter(n => !n.ownerEmail).length})`);
      for (const assignment of command.result.assignments) {
        const actual = await page.evaluate(id => { const node = getNode(id); return { id, ownerEmail: node.ownerEmail, ownerName: node.ownerName, ownerAvatar: node.ownerAvatar }; }, assignment.id);
        assert.deepEqual(actual, assignment, 'Authoritative returned identity is reconciled');
      }
      assert.equal(await dialog.locator(`[data-responsibility-node="${id}"] [data-responsibility-owner]`).getAttribute('data-responsibility-owner'), email);
      assert(await page.evaluate(id => getNode(id) !== window.previousResponsibilityNode, id), 'Immutable authoritative row reconciliation');
      assert.equal(boardGets, getCount, 'Sufficient mutation response needs no follow-up GET');
      await interactive();
    }
    // This is one uninterrupted dialog session, using real client reconciliation
    // and the actual locked production handler with fractional Date revisions.
    await mutate(id1, PERSON_A);
    await mutate(id2, PERSON_B);
    await mutate(id1, PERSON_B);
    await mutate(id2, '');
    const beforeBulk = commands.length, beforeBulkRevision = r.db.boards[0].updated_at;
    const pendingIds = await page.evaluate(() => state.nodes.filter(n => !n.ownerEmail).map(n => n.id));
    await dialog.getByRole('button', { name: /Assign all unassigned/ }).click();
    assert.equal(commands.length, beforeBulk, 'Bulk selection requires explicit confirmation');
    await dialog.locator(`.responsibility-people [data-email="${PERSON_A}"]`).click();
    assert.equal(commands.length, beforeBulk, 'Selecting a person does not commit bulk');
    await dialog.getByRole('button', { name: 'Assign unassigned only', exact: true }).click();
    await dialog.locator('.responsibility-live').getByText('Saved', { exact: true }).waitFor();
    assert.equal(commands.length, beforeBulk + 1);
    assert.equal(commands.at(-1).body.lastKnownUpdatedAt, beforeBulkRevision);
    assert.deepEqual(commands.at(-1).result.assignments.map(a => a.id).sort(), pendingIds.sort());
    for (const node of r.db.boards[0].canvas_json.nodes) {
      assert.equal(await dialog.locator(`[data-responsibility-node="${node.id}"] [data-responsibility-owner]`).getAttribute('data-responsibility-owner'), node.ownerEmail);
    }
    assert(await dialog.getByRole('button', { name: 'Assign all unassigned (0)', exact: true }).isDisabled());
    await interactive();
    await mutate(id2, PERSON_B);
    await mutate(id1, '');
    assert(await dialog.getByRole('button', { name: 'Assign all unassigned (1)', exact: true }).isEnabled());
    await dialog.getByRole('button', { name: 'Add team member', exact: true }).click();
    assert(await dialog.locator('input[type=email]').isVisible());
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert(commands.every(c => c.status === 200), 'No self-created conflict after individual or bulk edits');
    assert.deepEqual(clone(r.db.brands), originalBrand, 'No Brand mutation');
    for (const key of Object.keys(originalBoard).filter(k => !['canvas_json','updated_at'].includes(k))) assert.deepEqual(clone(r.db.boards[0][key]), originalBoard[key], `Board ${key} unchanged`);
    assert.deepEqual(await page.evaluate(() => state.nodes.map(n => {
      const { ownerEmail, ownerName, ownerAvatar, ...rest } = sanitizeNodeForPersistence(n); return rest;
    })), immutableCanvas, 'No unrelated node/content change');
    assert.deepEqual(await page.evaluate(() => state.edges), edges, 'Campaign topology unchanged');
    // External revision and assignment change really reach the production guard.
    r.db.boards[0].canvas_json.nodes.find(n => n.id === id1).ownerEmail = PERSON_A;
    r.db.boards[0].updated_at = new Date(Date.parse(r.db.boards[0].updated_at) + 137).toISOString();
    await dialog.locator(`[data-responsibility-node="${id1}"] button`).click();
    await dialog.locator(`.responsibility-people [data-email="${PERSON_B}"]`).click();
    await dialog.locator('.responsibility-picker').getByRole('button', { name: 'Assign', exact: true }).click();
    await dialog.getByRole('button', { name: 'Load latest project', exact: true }).waitFor();
    assert.equal(commands.at(-1).status, 409);
    assert(await dialog.getByText('This project changed. Load the latest version and confirm your selection again.', { exact: true }).isVisible());
    assert(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'Conflict stays bounded in the dialog');
    assert.equal(r.db.boards[0].canvas_json.nodes.find(n => n.id === id1).ownerEmail, PERSON_A);
    await dialog.getByRole('button', { name: 'Load latest project', exact: true }).click();
    await dialog.getByText('Review your selection and confirm again.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => state.lastKnownUpdatedAt), r.db.boards[0].updated_at);
    assert.equal(await dialog.locator(`[data-responsibility-node="${id1}"] [data-responsibility-owner]`).getAttribute('data-responsibility-owner'), PERSON_A);
    assert.equal(await dialog.locator(`.responsibility-people [data-email="${PERSON_B}"]`).getAttribute('aria-pressed'), 'true');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await interactive();
    await mutate(id1, PERSON_B);
    const finalRevision = r.db.boards[0].updated_at;
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'campaign-responsibilities-btn');
    await page.keyboard.press('Enter'); await interactive();
    assert.equal(await page.evaluate(() => state.lastKnownUpdatedAt), finalRevision);
    assert.equal(await dialog.locator(`[data-responsibility-node="${id1}"] [data-responsibility-owner]`).getAttribute('data-responsibility-owner'), PERSON_B);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    // The real toolbar and dialog, including long German picker labels, reflow
    // independently; no synthetic toolbar fixture or overflow suppression.
    for (const lang of ['en','de']) for (const theme of ['light','dark']) for (const width of [1440,1024,768,480,375,320,720]) {
      const height = width === 720 ? 450 : 900, context = `${lang}/${theme}/${width}x${height}`;
      await page.setViewportSize({ width, height });
      await page.evaluate(({ lang, theme }) => {
        language.setUiLanguage(lang); state.uiLanguage = lang;
        document.documentElement.dataset.theme = theme; translateInterface(document.querySelector('.canvas-toolbar'));
      }, { lang, theme });
      assert.equal(await entry.textContent(), lang === 'de' ? 'Verantwortlichkeiten' : 'Responsibilities');
      assert.equal(await entry.getAttribute('title'), lang === 'de' ? 'Verantwortlichkeiten' : 'Responsibilities');
      assert(await toolbar.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `Toolbar overflow ${context}`);
      await entry.click({ trial: true });
      const box = await entry.boundingBox();
      assert(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1, `Toolbar target/viewport ${context}`);
      await entry.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('campaign-responsibilities')?.getAttribute('aria-busy') === 'false');
      assert(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `Dialog overflow ${context}`);
      await dialog.locator(`[data-responsibility-node="${id1}"] button`).click();
      assert(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `Picker overflow ${context}`);
      await page.keyboard.press('Tab');
      assert(await dialog.evaluate(n => {
        const active = document.activeElement, style = getComputedStyle(active);
        return n.contains(active) && active.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      }), `Visible keyboard focus ${context}`);
      const targets = await dialog.locator('button:visible').evaluateAll(buttons => buttons.map(b => ({label:b.textContent,height:b.getBoundingClientRect().height,minHeight:getComputedStyle(b).minHeight})));
      assert(targets.every(b => b.height >= 44), `44px dialog targets ${context}: ${JSON.stringify(targets)}`);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.activeElement.id), 'campaign-responsibilities-btn');
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await entry.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('campaign-responsibilities')?.getAttribute('aria-busy') === 'false');
    assert(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { language.setUiLanguage('en'); state.uiLanguage = 'en'; translateInterface(document.querySelector('.canvas-toolbar')); });
    // Preserve authorized read-only visibility, exclude mutation authority, and
    // hide the Canvas action outside Canvas and without an authorized project.
    for (const role of ['editor','viewer','public_viewer']) {
      await page.evaluate(role => {
        applyBoardAccessFromServer({ role, canView: true, canEdit: role === 'editor', canManagePermissions: false });
        state.publicBoardToken = role === 'public_viewer' ? 'read-only-token' : null;
        synchronizeResponsibilityToolbar();
      }, role);
      assert(await entry.isVisible()); await entry.click();
      await page.waitForFunction(() => document.getElementById('campaign-responsibilities')?.getAttribute('aria-busy') === 'false');
      assert.equal(await dialog.getByRole('button', { name: 'Add team member', exact: true }).count(), 0);
      assert.equal(await dialog.locator('[data-responsibility-node] button').first().isEnabled(), role === 'editor');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    }
    await page.evaluate(() => { state.publicBoardToken = null; setActiveView('home'); });
    assert(!await entry.isVisible());
    await page.evaluate(() => { setActiveView('board'); state.boardAccess.canView = false; synchronizeResponsibilityToolbar(); });
    assert(!await entry.isVisible());
    await page.evaluate(() => { state.boardAccess.canView = true; state.currentBoardId = null; synchronizeResponsibilityToolbar(); });
    assert(!await entry.isVisible());
    assert.deepEqual(errors, []); assert.deepEqual(nativeDialogs, []);
    assert.deepEqual(clone(r.db.brands), originalBrand);
    assert(!requests.some(req => req.method !== 'GET' && !req.path.startsWith(`/api/boards/${D}`) && !req.path.startsWith('/api/boards/presence/')));
    console.log('PASS real Chromium: uninterrupted individual/reassign/unassign/bulk/post-bulk session; exact revision transitions; no self-conflict or blind GET; genuine external conflict/recovery/reopen; toolbar only; EN/DE, light/dark, all 7 widths including 720x450 reflow, keyboard/focus/Escape, media, owner/editor/viewer/public boundaries; no unrelated mutations or AI/provider requests');
  } finally { await browser.close(); }
}
(async () => { protectedGenerator(); await serverChecks(); await browserChecks(); console.log('BW-36.15R1 checks passed'); })()
  .catch(error => { console.error(error); process.exitCode = 1; });
