#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const profile = require('../brand-profile-setup');
const W = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const D = '33333333-3333-4333-8333-333333333333';
const B2 = '44444444-4444-4444-8444-444444444444';
const now = '2026-10-07T09:00:00.000Z';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function catalog(role = 'owner', brandRole = 'editor') {
  const brand = id => ({ id, workspace_id: W, name: id === B ? '😀 Über Brand' : 'Second Brand', role: brandRole, revision: 1, logo_url: null, logo_revision: 0 });
  return { workspaces: [{ id: W, name: 'Workspace', role, revision: 1, brands: [brand(B), brand(B2)], boards: [{ id: D, workspace_id: W, brand_id: B, role: 'viewer', name: 'Project' }] }] };
}
const base = { signedIn: true, status: 'ready', catalog: catalog(), workspaceId: W, brandId: B2 };
assert.equal(profile.resolveEntry({ ...base, boardId: D, boardAuthorized: true }).brand.id, B);
assert.equal(profile.resolveEntry(base).brand.id, B2);
assert.equal(profile.resolveEntry({ ...base, brandId: null }).kind, 'choice');
assert.equal(profile.resolveEntry({ ...base, catalog: { workspaces: [{ ...catalog().workspaces[0], brands: [catalog().workspaces[0].brands[0]] }] }, brandId: null }).brand.id, B);
for (const input of [{ publicToken: 'token' }, { status: 'stale' }, { signedIn: false }, { boardId: D, boardAuthorized: false }, { boardId: 'board-only', boardAuthorized: true }]) assert.equal(profile.resolveEntry({ ...base, ...input }).kind, 'empty');
const cross = catalog(); cross.workspaces[0].boards[0].brand_id = 'foreign';
assert.equal(profile.resolveEntry({ ...base, catalog: cross, boardId: D, boardAuthorized: true }).kind, 'empty');
assert.equal(profile.resolveEntry({ ...base, catalog: { workspaces: [] } }).kind, 'empty');

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [], requests = [], expectedTransportErrors = [];
    page.on('dialog', dialog => { errors.push(`Unexpected native dialog: ${dialog.type()}`); void dialog.dismiss(); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') {
      if (m.location().url === `http://localhost/api/brands/${B}/logo` && m.text().includes('status of 500')) expectedTransportErrors.push(m.text());
      else errors.push(m.text());
    } });
    let role = 'editor', logoRevision = 0, logoUrl = null, failUpload = false;
    const brandDetail = id => ({ id, name: id === B ? '😀 Über Brand' : 'Second Brand', brand_core: { brandCore: 'Confirmed knowledge', personas: [], customTiles: [], brandAssets: { domain: 'https://example.com/' } }, revision: 1, logo_url: logoUrl, logo_revision: logoRevision, logo_source: logoUrl ? 'uploaded' : null, created_at: now, updated_at: now,
      access: { role, canEditCanonicalBrand: ['owner', 'admin', 'editor'].includes(role), canManageBrandMembers: ['owner', 'admin'].includes(role) } });
    // Every request is fulfilled locally: no provider, storage, or production DB.
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      assert.equal(url.hostname, 'localhost', 'No external browser destination');
      if (url.pathname.startsWith('/api/')) {
        requests.push({ path: url.pathname, method: req.method(), body: req.postDataJSON() });
        if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: null } });
        if (/\/api\/brands\/[^/]+\/logo$/.test(url.pathname)) {
          if (req.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') });
          if (failUpload) return route.fulfill({ status: 500, json: { error: { code: 'UPDATE_FAILED' } } });
          const body = req.postDataJSON();
          assert.equal(body.contract, 'brand_logo_v1'); assert.equal(body.workspace_id, W);
          assert.equal(body.expected_revision, logoRevision); logoRevision++;
          logoUrl = body.action === 'remove' ? null : `/api/brands/${B}/logo?revision=${logoRevision}`;
          return route.fulfill({ json: { contract: 'brand_logo_v1', request_id: body.request_id, logo: { logo_url: logoUrl, logo_revision: logoRevision, source: body.action === 'remove' ? null : 'uploaded' } } });
        }
        if (/\/api\/brands\/[^/]+$/.test(url.pathname)) return route.fulfill({ json: brandDetail(url.pathname.split('/').at(-1)) });
        if (url.pathname === '/api/analyze-brand-domain') return route.fulfill({ json: { suggestions: { brandCore: 'Suggestion' }, logoDiscovery: { status: 'candidate_found', candidate_url: 'https://example.com/logo.png', mime_type: 'image/png', image_base64: png, image_sha256: 'a'.repeat(64) } } });
        if (url.pathname === '/api/workspaces' && req.method() === 'PATCH') {
          const body = req.postDataJSON(); return route.fulfill({ json: { contract: 'workspace_update_v1', request_id: body.request_id, workspace: { id: W, name: body.name, role: 'owner', revision: body.expected_revision + 1, avatar_url: null, locale: null } } });
        }
        return route.fulfill({ json: url.pathname === '/api/brands' ? { brands: [] } : {} });
      }
      const file = path.resolve(__dirname, '..', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      return route.fulfill(fs.existsSync(file) && fs.statSync(file).isFile() ? { path: file } : { status: 200, body: '' });
    });
    await page.goto('http://localhost/');
    await page.waitForFunction(() => typeof state !== 'undefined' && state.activeView === 'home' && !!workspaceSidebarController);
    async function context({ workspaceRole = 'owner', brandRole = 'editor', board = true, selection = B2, brands = true, status = 'ready', publicToken = null } = {}) {
      role = brandRole;
      const data = catalog(workspaceRole, brandRole); if (!brands) data.workspaces[0].brands = [];
      await page.evaluate(({ data, board, selection, status, publicToken, W, D }) => {
        closeCanonicalBrandDetail({ restoreFocus: false });
        state.user = { email: 'fixture@example.com' }; state.publicBoardToken = publicToken;
        state.workspaceCatalog.value = data; state.workspaceCatalog.status = status;
        state.workspaceCatalog.activeWorkspaceId = W; state.session.brandId = selection;
        state.currentBoardId = board ? D : null;
        state.boardAccess = { canView: true, canViewBoardBrandCore: true, canEdit: false };
        state.boardBrandAssociation = { ...state.boardBrandAssociation, boardId: board ? D : null, brandId: board ? data.workspaces[0].boards[0].brand_id : null };
        history.replaceState({}, '', '/'); setSidebarCollapsed(false); renderWorkspaceSidebar();
      }, { data, board, selection, status, publicToken, W, D });
    }
    async function visible(selector) { if (selector.includes('guided-brand-profile input[type=file]')) await page.locator('[data-profile-key="Brand Assets"]').click(); await page.locator(selector).waitFor({ state: 'visible' }); assert(await page.locator(selector).isVisible(), selector); }
    async function menuOpen() {
      const before = requests.length; await page.locator('#workspace-context-manage').click();
      await visible('#workspace-context-menu'); assert.equal(await page.locator('#workspace-context-menu').count(), 1);
      assert.equal(await page.locator('#workspace-context-menu').getAttribute('role'), 'menu');
      assert.equal(await page.locator('#workspace-context-menu').getAttribute('aria-label'), 'Workspace actions');
      assert(await page.locator('body > #workspace-context-menu').count());
      assert.equal(requests.length, before, 'Opening actions issues no GET or PATCH');
    }
    assert.equal(await page.locator('#workspace-context-manage').count(), 1, 'One production trigger');
    await context({ workspaceRole: 'admin' }); await menuOpen(); await page.keyboard.press('Escape');
    await context();
    for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 768, 480, 375, 320]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      console.log(`browser: ${theme} ${width}px`); await menuOpen();
      const trigger = await page.locator('#workspace-context-manage').boundingBox();
      const menu = await page.locator('#workspace-context-menu').boundingBox();
      assert(trigger.width >= 44 && trigger.height >= 44); assert(menu.x >= 0 && menu.x + menu.width <= width && menu.y >= 0 && menu.y + menu.height <= 900);
      assert(await page.locator('#workspace-context-menu [role=menuitem]').evaluate(n => n.getBoundingClientRect().height >= 44));
      await page.evaluate(() => renderWorkspaceSidebar()); await visible('#workspace-context-menu');
      await page.getByRole('menuitem', { name: 'Rename workspace', exact: true }).click(); await visible('#workspace-rename-dialog');
      assert(await page.locator('body > #workspace-rename-dialog').count());
      await page.locator('#workspace-rename-dialog button[type=button]').click();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'workspace-context-manage');
      assert.equal(await page.locator('#workspace-rename-dialog').count(), 0);
    }
    // 200% equivalent CSS reflow: a 1440x900 viewport becomes 720x450 CSS px.
    await page.setViewportSize({ width: 720, height: 450 }); await menuOpen();
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#workspace-context-menu').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'workspace-context-manage');
    assert.notEqual(await page.locator('#workspace-context-manage').evaluate(n => getComputedStyle(n).outlineStyle), 'none');
    await menuOpen(); await page.locator('#workspace-context-manage').click(); assert.equal(await page.locator('#workspace-context-menu').count(), 0);
    await menuOpen(); await page.mouse.click(300, 300); assert.equal(await page.locator('#workspace-context-menu').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'workspace-context-manage');
    await page.setViewportSize({ width: 1440, height: 900 });
    await menuOpen(); await page.getByRole('menuitem', { name: 'Rename workspace' }).click();
    await page.locator('#workspace-rename-dialog input').fill('Renamed Workspace');
    const patches = requests.filter(r => r.method === 'PATCH').length;
    await page.locator('#workspace-rename-dialog button[type=submit]').click();
    await page.waitForFunction(() => !document.getElementById('workspace-rename-dialog'));
    assert.equal(requests.filter(r => r.method === 'PATCH').length, patches + 1);
    for (const workspaceRole of ['member', 'viewer']) {
      await context({ workspaceRole }); assert(!(await page.locator('#workspace-context-manage').isVisible()));
      await page.evaluate(() => workspaceSidebarController.openManagement()); assert.equal(await page.locator('#workspace-context-menu').count(), 0);
    }
    for (const status of ['stale', 'error', 'loading', 'refreshing']) {
      await context({ status }); await page.evaluate(() => workspaceSidebarController.openManagement()); assert.equal(await page.locator('#workspace-context-menu').count(), 0);
    }
    await context(); await menuOpen(); await page.evaluate(() => { state.workspaceCatalog.value.workspaces[0].role = 'viewer'; renderWorkspaceSidebar(); });
    assert.equal(await page.locator('#workspace-context-menu').count(), 0, 'Revocation closes ready menu');
    // Required real sidebar-to-existing-Brand flow, using full app.js.
    for (const brandRole of ['owner', 'admin', 'editor']) {
      await context({ brandRole }); await page.locator('#brand-core-nav-btn').click();
      await visible('.profile-page-mode .guided-brand-profile input[type=file]');
      assert.equal(await page.evaluate(() => canonicalBrandDetail.brandId), B, 'Board association outranks session Brand');
      assert.equal(await page.evaluate(() => state.activeView), 'brand-profile');
      assert(!(await page.locator('#brand-core-workspace').isVisible()));
    }
    const snapshot = await page.evaluate(() => JSON.stringify(state.brandCore));
    // Project picker shares production reconciliation helper, while the Profile remains open.
    await page.evaluate(({ W, B }) => { projectDialogController = FunklixProjectDialog.mount({ document, language: 'en', workspace: state.workspaceCatalog.value.workspaces[0], requestId: () => 'project-fixture', submit: () => { throw new Error('No project submission'); } }); projectDialogController.dialog.close(); }, { W, B });
    const file = page.locator('.guided-brand-profile input[type=file]');
    await file.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await visible('.profile-logo-candidate');
    failUpload = true;
    await page.locator('[data-profile-key="Upload logo"]').click();
    await page.waitForFunction(() => brandProfileController.state.message.includes('file is retained'));
    await visible('.profile-logo-candidate'); assert.equal(await page.evaluate(() => brandProfileController.state.file.name), 'logo.png');
    failUpload = false;
    await page.locator('[data-profile-key="Upload logo"]').click();
    await page.waitForFunction(() => brandProfileController.state.logo === 'Logo saved');
    assert.equal(await page.locator('.profile-header .profile-logo img').getAttribute('src'), logoUrl);
    assert.equal(await page.locator('#workspace-brand-avatar img').getAttribute('src'), logoUrl);
    assert(await page.evaluate(({ B, logoUrl }) => [...projectDialogController.dialog.querySelectorAll('img')].some(n => n.getAttribute('src') === logoUrl), { B, logoUrl }));
    assert.equal(await page.evaluate(() => JSON.stringify(state.brandCore)), snapshot, 'Logo write does not overwrite Board snapshot');
    assert(requests.filter(r => r.method === 'POST' && /logo/.test(r.path)).every(r => r.path === `/api/brands/${B}/logo`));
    await visible('[data-profile-key="Change logo"]'); await visible('[data-profile-key="Remove logo"]');
    await page.locator('[data-profile-key="Overview"]').click();
    await page.locator('[data-profile-key="Analyze website"]').click();
    await page.waitForFunction(() => !!brandProfileController.state.candidate); await visible('[data-profile-key="Use this logo"]');
    await page.locator('[data-profile-key="Remove logo"]').click();
    await page.waitForFunction(() => brandProfileController.state.message === 'Logo removed');
    await visible('[data-profile-key="Campaign Brand Snapshot"]');
    await page.locator('[data-profile-key="Campaign Brand Snapshot"]').click();
    assert.equal(await page.locator('#brand-leave-dialog').count(), 0, 'R6 website suggestions are retained without a profile save warning');
    await visible('#brand-core-workspace');
    await page.evaluate(() => { state.brandCoreSelectedKey = 'brandAssets'; renderBrandCoreEditor(); });
    assert.equal(await page.locator('#brand-core-workspace input[type=file]').count(), 0);
    assert(!(await page.locator('#brand-core-workspace').innerText()).includes('temporarily unavailable'));
    assert.equal(await page.evaluate(() => BRAND_LOGO_MUTATIONS_ENABLED), false);
    const beforeLegacy = requests.length;
    await page.evaluate(() => replacePrimaryBrandLogo({ type: 'image/png', size: 10 })); assert.equal(requests.length, beforeLegacy);
    await page.locator('#campaign-snapshot-open-profile').click(); await visible('.guided-brand-profile input[type=file]');
    await context({ board: false, selection: B2 }); await page.locator('#brand-core-nav-btn').click();
    await page.waitForFunction(B2 => canonicalBrandDetail.brand?.id === B2, B2);
    await context({ board: false, selection: null });
    await page.evaluate(() => { state.workspaceCatalog.value.workspaces[0].brands = state.workspaceCatalog.value.workspaces[0].brands.slice(0, 1); renderWorkspaceSidebar(); });
    await page.locator('#brand-core-nav-btn').click(); await page.waitForFunction(B => canonicalBrandDetail.brand?.id === B, B);
    await context({ board: false, selection: null }); await page.locator('#brand-core-nav-btn').click();
    assert((await page.locator('#brand-workspace-detail-content').innerText()).includes('Choose a Brand'));
    await page.locator('#brand-workspace-detail-content button').filter({ hasText: 'Second Brand' }).click();
    await page.waitForFunction(B2 => canonicalBrandDetail.brand?.id === B2, B2);
    for (const input of [{ brands: false }, { publicToken: 'public-token' }]) {
      await context(input); const before = requests.length; await page.evaluate(() => openRegularBrandProfile());
      assert((await page.locator('#brand-workspace-detail-content').innerText()).includes('No authorized Brand Profile'));
      assert.equal(requests.length, before);
    }
    await context({ brandRole: 'viewer' }); await page.locator('#brand-core-nav-btn').click();
    await page.waitForFunction(() => !!brandProfileController);
    for (const key of ['Upload logo', 'Change logo', 'Remove logo', 'Analyze website', 'Confirm and save Brand Profile']) assert.equal(await page.locator(`[data-profile-key="${key}"]`).count(), 0);
    const beforeViewer = requests.length;
    await page.evaluate(async () => { await brandProfileController.upload(); await brandProfileController.removeLogo(); await brandProfileController.save(); });
    assert.equal(requests.length, beforeViewer);
    // Failed same-origin images use Unicode-safe initials without a page error.
    await page.evaluate(({ B }) => { const image = document.querySelector('.profile-header .profile-logo'); FunklixBrandLogo.render(image, { name: '😀 Über', logo_url: `/api/brands/${B}/logo?revision=99` }); image.querySelector('img').dispatchEvent(new Event('error')); }, { B });
    assert.equal(await page.locator('.profile-header .profile-logo').innerText(), '😀Ü');
    await context(); await page.locator('#brand-core-nav-btn').click(); await visible('.guided-brand-profile input[type=file]');
    for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 768, 480, 375, 320, 720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      assert(await page.locator('.profile-page-mode').evaluate(n => n.getBoundingClientRect().right <= innerWidth + 1));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await visible('.guided-brand-profile input[type=file]');
      assert(await page.locator('.guided-brand-profile button').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).every(n => n.getBoundingClientRect().height >= 44)));
      if (process.env.BW36_SCREENSHOTS && [1440, 320].includes(width)) await page.screenshot({ path: path.join(process.env.BW36_SCREENSHOTS, `${theme}-${width}.png`) });
    }
    await page.evaluate(() => { state.uiLanguage = 'de'; brandProfileController.render(); });
    assert((await page.locator('.guided-brand-profile').innerText()).includes('Markenmaterialien'));
    await page.evaluate(() => renderWorkspaceSidebar()); await page.locator('#workspace-context-manage').click();
    assert.equal(await page.locator('#workspace-context-menu').getAttribute('aria-label'), 'Workspace-Aktionen');
    assert.equal(await page.locator('#workspace-context-menu [role=menuitem]').innerText(), 'Workspace umbenennen');
    await page.keyboard.press('Escape');
    assert.equal(expectedTransportErrors.length, 1, 'Only the deliberate HTTP 500 emits a browser transport diagnostic');
    assert.deepEqual(errors, [], 'No unexpected console or page errors');
    console.log('BW-36.13R4R1 passed: real index.html/app.js/DOM/CSS in Chromium; authorized Profile resolution, existing Brand upload/retry/reconciliation, Snapshot isolation, actual ellipsis→menu→rename→cancel/submit, roles/revocation/status, focus, both themes, six widths and 200% equivalent reflow. Zero real provider/AI/storage/production database calls.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
