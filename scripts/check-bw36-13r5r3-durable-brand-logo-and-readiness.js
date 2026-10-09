#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { runtime, W, B, EMAIL, png, clone } = require('./fixtures/bw36-13r5-local-runtime');
const profile = require('../brand-profile-setup');
const { projectCatalog } = require('../api/_workspace-catalog');
require('../workspace-catalog');
const catalogClient = globalThis.FunklixWorkspaceCatalog;
const ROOT = path.resolve(__dirname, '..'), M = '55555555-5555-4555-8555-555555555555';
function seed(r) {
  r.db.brands[0].name = 'Appics';
  Object.assign(r.db.brands[0].brand_core, { brandDNA: { primaryArchetype: 'Sage', secondaryArchetype: 'Creator', userApproved: true,
    avatar: { imageUrl: 'https://example.test/accepted.png', userApproved: true, prompt: 'advisor', future: { keep: true } }, futureDNA: { keep: true } }, unknown: { keep: ['all'] }, provenance: { source: 'confirmed', revision: 3 } });
  r.db.brands.push({ ...clone(r.db.brands[0]), id: M, name: 'Other', logo_revision: 0 });
}
function catalog(r) {
  return { contract: 'workspace_catalog_v1', request_id: 'abcdefabcdefabcdefabcdef', workspaces: projectCatalog({
    memberships: [{ id: W, name: 'Workspace', role: 'owner', revision: 1 }],
    brands: r.db.brands.map(b => ({ ...b, role: 'owner' })),
    boards: r.db.boards.map(b => ({ ...b, role: 'owner' }))
  }) };
}
async function boundaries() {
  const r = runtime(); seed(r); const untouched = clone(r.db.boards), dna = clone(r.db.brands[0].brand_core.brandDNA);
  let context = { account: {}, generation: 1, brandId: B, workspaceId: W, authorized: true }, failRead = false, failImage = false;
  const fetchImpl = async (url, init = {}) => {
    if (failImage && url.includes('/logo') && !init.method) return { ok: false, status: 502, json: async () => null };
    if (failRead && !init.method) return { ok: false, status: 503, json: async () => null };
    const res = await r.request(init.method || 'GET', url, init.body ? JSON.parse(init.body) : undefined);
    return { ok: res.statusCode < 300, status: res.statusCode, json: async () => res.body };
  };
  const make = async () => profile.createSession({ brand: (await r.request('GET', `/api/brands/${B}`)).body, getContext: () => context, fetchImpl,
    validateBrand: (b, id) => b?.id === id && Number.isSafeInteger(b.revision) && b.brand_core && b.access,
    requestId: () => 'durable-logo', onSave() {}, onLogo() {} });
  let s = await make(); assert(!s.dirty());
  const file = { type: 'image/png', size: png.length, name: 'appics logo.png' };
  await s.chooseFile(file, async () => png.toString('base64')); assert(s.state.fileData); assert(s.dirty());
  r.db.failLogoMetadata = true; assert.equal(await s.upload(), false); assert.equal(r.objects.size, 0, 'Failed metadata commit compensates the new Storage object'); assert.equal(s.state.file, file); assert.equal(r.db.brands[0].logo_revision, 0);
  r.db.failLogoMetadata = false; assert(await s.upload()); assert.equal(r.objects.size, 1); assert.equal(s.state.file, null); assert.equal(s.state.fileData, null); assert(!s.dirty());
  const metadata = Object.fromEntries(Object.entries(r.db.brands[0]).filter(([key]) => key.startsWith('logo_')));
  s.state.core.brandCore = 'Saved positioning'; assert(await s.save()); assert(!s.dirty());
  assert.deepEqual(Object.fromEntries(Object.entries(r.db.brands[0]).filter(([key]) => key.startsWith('logo_'))), metadata, 'Generic profile save preserves every logo column');
  s.invalidate(); s = await make(); const projected = catalogClient.validate(catalog(r)).workspaces[0].brands.find(b => b.id === B);
  assert.equal(projected.logo_url, s.state.brand.logo_url); assert.equal(projected.logo_revision, 1);
  const safe = await r.request('POST', `/api/brands/${B}/logo`, { contract: 'brand_logo_v1', request_id: 'stale-contract', action: 'upload', workspace_id: W, expected_revision: 0, mime_type: 'image/png', image_base64: png.toString('base64') }); assert.equal(safe.statusCode, 409);
  const committedResponse = r.requests.find(x => x.method === 'POST' && x.path.endsWith('/logo')); assert(committedResponse);
  const minimal = await make(); delete r.db.brands[0].brand_core.brandVoiceExamples; const normalized = await make(); assert(!normalized.dirty()); assert(await normalized.reload()); assert(!normalized.dirty(), 'Missing inherited UI defaults cannot create dirty state');
  r.db.brands[0].brand_core.brandVoiceExamples = minimal.state.core.brandVoiceExamples;
  assert.deepEqual(s.state.core.brandDNA, dna); assert.deepEqual(r.db.boards, untouched);
  // Production PUT must preserve omitted forward-compatible fields, DNA and avatar.
  const partial = await r.request('PUT', `/api/brands/${B}`, { name: 'Appics', revision: s.state.brand.revision, brand_core: { brandCore: 'Partial client' }, logo_url: null, logo_revision: 0, logo_object_path: null });
  assert.equal(partial.statusCode, 200); assert.deepEqual(r.db.brands[0].brand_core.brandDNA, dna); assert.deepEqual(r.db.brands[0].brand_core.unknown, { keep: ['all'] }); assert.equal(r.db.brands[0].logo_revision, 1);
  s = await make(); await s.chooseFile(file, async () => png.toString('base64')); failRead = true; assert.equal(await s.upload(), false);
  assert.equal(s.state.brand.logo_revision, 2); assert.equal(s.state.file, null); assert(s.state.syncRequired); assert(s.state.message.includes('saved on the server'));
  const uploads = r.storageRequests.filter(m => m === 'POST').length; assert.equal(await s.upload(), false); assert.equal(r.storageRequests.filter(m => m === 'POST').length, uploads, 'Synchronization cannot duplicate upload');
  failRead = false; assert(await s.reload()); assert(!s.state.syncRequired); assert.equal(s.state.brand.logo_revision, 2);
  assert.equal((await r.request('GET', `/api/brands/${B}/logo?revision=1`)).statusCode, 409, 'Old revision cannot cache new bytes');
  assert.equal((await r.request('GET', `/api/brands/${B}/logo?revision=2`)).statusCode, 200);
  await s.chooseFile(file, async () => png.toString('base64')); failImage = true; assert.equal(await s.upload(), false); assert.equal(s.state.brand.logo_revision, 3); assert(s.state.syncRequired); assert.equal(r.objects.size, 1); assert(s.state.message.includes('saved on the server')); failImage = false; assert(await s.reload()); assert(!s.state.syncRequired);
  assert(await s.removeLogo()); assert.equal(r.db.brands[0].logo_object_path, null); assert.equal(r.objects.size, 0);
  s.state.website = 'https://example.test/'; assert(await s.analyze()); assert(await s.useLogo()); assert.equal(r.db.brands[0].logo_source, 'discovered'); assert.equal(r.objects.size, 1);
  assert.deepEqual(r.db.boards, untouched);
  // Concurrent draft changes: the baseline must advance even when newer edits remain.
  let release; const gate = new Promise(resolve => { release = resolve; }); let reached;
  const called = new Promise(resolve => { reached = resolve; });
  const saved = s.state.brand;
  const concurrent = profile.createSession({ brand: saved, getContext: () => context, requestId: () => 'concurrent', onSave() {}, onLogo() {}, validateBrand: (b,id) => b?.id === id,
    fetchImpl: async (url, init = {}) => { const result = await fetchImpl(url, init); if (init.method === 'PUT') { reached(); await gate; } return result; } });
  concurrent.state.name = 'Submitted name'; const flight = concurrent.save(); await called; concurrent.state.name = 'Newer name'; release(); assert(await flight); assert(concurrent.dirty()); concurrent.state.name = 'Submitted name'; assert(!concurrent.dirty(), 'Reverting to the confirmed save must clear dirty state');
  const viewer = profile.createSession({ brand: { ...saved, access: { role: 'viewer', canEditCanonicalBrand: false } }, getContext: () => context, fetchImpl, validateBrand: () => true, onSave() {}, onLogo() {}, requestId: () => 'viewer' });
  assert.equal(await viewer.chooseFile(file), false); assert.equal(await viewer.save(), false); assert.equal(await viewer.generateAvatar(), false);
  context = { ...context, account: {} }; assert.equal(await s.save(), false); s.invalidate(); assert.equal(s.state.fileData, null); assert.deepEqual(s.state.core, {});
  assert(r.db.queries.every(sql => !/CREATE TABLE|ALTER TABLE|UPDATE boards/.test(sql)));
  console.log('R5R3 handlers: persistent Storage/DB, upload–PUT–reload, all logo metadata preserved, compensation, no duplicate synchronization, revision delivery, DNA/avatar/unknown preservation and account/role boundaries passed.');
}
function readiness() {
  const empty = { id: B, name: '', logo_url: null, logo_revision: 0, brand_core: {} };
  assert.deepEqual(profile.readiness(empty).map(r => r.status), ['empty','empty','empty','empty','empty','empty','empty','neutral','neutral','neutral']);
  const placeholders = { ...empty, name: 'TBD', brand_core: { brandCore: '  ', valueProposition: 'Not provided', brandAssets: { colors: ['placeholder'], typography: 'N/A' }, brandDNA: { avatar: { prompt: 'An advisor' } } } };
  assert(profile.readiness(placeholders).slice(0,7).every(r => r.status === 'empty'));
  const partial = { ...empty, name: 'Appics', brand_core: { brandAssets: { colors: ['#123456'] }, toneOfVoice: ['Clear'] } };
  assert.equal(profile.readiness(partial)[0].status, 'partial'); assert.equal(profile.readiness(partial)[3].status, 'partial'); assert.equal(profile.readiness(partial)[5].status, 'partial');
  partial.logo_url = 'blob:preview'; partial.logo_revision = 1; assert.equal(profile.readiness(partial)[5].status, 'partial');
  const complete = { id: B, name: 'Appics', logo_url: `/api/brands/${B}/logo?revision=1`, logo_revision: 1, brand_core: {
    brandCore: 'Positioning', valueProposition: 'Value', brandAssets: { domain: 'https://example.test/', colors: ['#123456'], typography: 'Sans' },
    brandDNA: { userApproved: true, primaryArchetype: 'Sage', secondaryArchetype: 'Creator', avatar: { userApproved: true, imageUrl: 'https://example.test/avatar.png' } },
    personas: [{ name: 'Buyer', note: 'Needs' }], customTiles: [{ moduleType: 'icp', content: 'Ideal buyer' }], toneOfVoice: ['Clear'], messagingPillars: ['Reliable'], contentGuidelines: ['Concise'], keywords: ['keyword'], dosAndDonts: { dos: ['Do'] }, brandVoiceExamples: { good: 'Example' }, offers: ['Product'], proof: ['Evidence']
  } };
  assert(profile.readiness(complete).slice(0,7).every(r => r.status === 'complete'));
  const assetOnly = { ...empty, logo_url: complete.logo_url, logo_revision: 1 }; assert.equal(profile.readiness(assetOnly)[5].status, 'partial', 'Accepted official logo is meaningful');
  const pkg = require('../package.json').scripts, keys = Object.keys(pkg); assert.equal(keys.indexOf('check:bw36.13r5r3'), keys.indexOf('check:bw36.13r5r2')+1);
  console.log('R5R3 readiness: all sections empty/partial/complete/neutral, placeholders, saved assets and accepted avatars passed.');
}
async function browserJourney(runtimeOptions) {
  let chromium; try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
  const r = runtime(runtimeOptions); seed(r); const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; let nativeDialogs = 0;
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => { nativeDialogs++; void d.dismiss(); });
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname === 'example.test') return route.fulfill({ contentType: 'image/png', body: png });
      assert.equal(url.hostname, 'localhost', 'All browser/provider/Storage traffic is deterministic and local');
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: null } });
        if (url.pathname === '/api/workspaces/catalog') return route.fulfill({ json: catalog(r) });
        if (/^\/api\/brands\/[^/]+(?:\/logo)?$/.test(url.pathname)) {
          const res = await r.request(req.method(), url.pathname + url.search, req.postDataJSON() || undefined);
          return Buffer.isBuffer(res.body) ? route.fulfill({ status: res.statusCode, contentType: 'image/png', body: res.body }) : route.fulfill({ status: res.statusCode, json: res.body });
        }
        return route.fulfill({ json: { boards: [], brands: [], members: [], nodes: [], presence: [] } });
      }
      const file = path.resolve(ROOT, url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      return route.fulfill(fs.existsSync(file) && fs.statSync(file).isFile() ? { path: file } : { body: '' });
    });
    async function context() {
      await page.evaluate(({ W, B, EMAIL }) => {
        state.user = { email: EMAIL }; state.publicBoardToken = null; state.currentBoardId = null; state.session.boardId = null; state.session.workspaceId = W; state.session.brandId = B;
        state.boardAccess = { canView: true, canEdit: true }; state.isDirty = false; history.replaceState({}, '', '/');
      }, { W, B, EMAIL });
      // Fetch and validate the production-shaped Workspace catalog on each application boot.
      await page.evaluate(async ({ W }) => { const value = window.FunklixWorkspaceCatalog.validate(await (await fetch('/api/workspaces/catalog')).json()); state.workspaceCatalog = { ...state.workspaceCatalog, value, status: 'ready', activeWorkspaceId: W }; state.brandCatalog = { ...state.brandCatalog, status: 'success', entries: value.workspaces[0].brands }; setActiveView('home'); setSidebarCollapsed(false); renderWorkspaceSidebar(); }, { W });
    }
    const ready = () => page.waitForFunction(B => brandProfileController?.state.brand.id === B && canonicalBrandDetail.status === 'ready', B);
    const key = k => page.locator(`[data-profile-key="${k}"]`);
    await page.goto('http://localhost/'); await page.waitForFunction(() => typeof state !== 'undefined' && workspaceSidebarController); await context();
    await page.locator('#brand-core-nav-btn').click(); await ready();
    assert.equal(await page.locator('.profile-identity-cards > section').count(), 2);
    await key('Brand Assets').click(); await key('file').setInputFiles({ name: 'appics logo.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => !!brandProfileController.state.fileData); assert(await page.locator('.profile-logo-candidate').isVisible());
    await key('Upload logo').click(); await page.waitForFunction(() => brandProfileController.state.logo === 'Logo saved' && !brandProfileController.busy());
    assert.equal(r.objects.size, 1); assert.equal(r.db.brands[0].logo_revision, 1); assert.equal(await key('file').inputValue(), '');
    await page.locator('#home-nav-btn').click(); assert.equal(await page.locator('#brand-leave-dialog').count(), 0, 'Logo upload alone clears dirty state');
    await page.locator('#brand-core-nav-btn').click(); await ready(); await key('Brand Assets').click();
    const metadata = clone(Object.fromEntries(Object.entries(r.db.brands[0]).filter(([k]) => k.startsWith('logo_'))));
    await key('Confirm and save Brand Profile').click(); await page.waitForFunction(() => brandProfileController.state.message === 'Brand Profile saved' && !brandProfileController.busy());
    assert.equal(await page.evaluate(() => brandProfileController.dirty()), false);
    assert.deepEqual(Object.fromEntries(Object.entries(r.db.brands[0]).filter(([k]) => k.startsWith('logo_'))), metadata);
    await page.locator('#home-nav-btn').click(); assert.equal(await page.locator('#brand-leave-dialog').count(), 0);
    await page.reload(); await page.waitForFunction(() => typeof state !== 'undefined' && workspaceSidebarController); await context();
    const url = `/api/brands/${B}/logo?revision=1`;
    assert.equal(await page.locator('#workspace-brand-avatar img').getAttribute('src'), url);
    await page.locator('#workspace-brand-trigger').click(); assert.equal(await page.locator(`[data-brand-id="${B}"] img`).getAttribute('src'), url); await page.keyboard.press('Escape');
    await page.locator('#brand-core-nav-btn').click(); await ready();
    assert.equal(await page.locator('.profile-official-logo img').getAttribute('src'), url); assert.equal(await page.locator('.profile-overview-avatar').getAttribute('src'), 'https://example.test/accepted.png');
    assert(await page.locator('.profile-official-logo img').evaluate(img => img.complete && img.naturalWidth > 0));
    if (runtimeOptions?.postgresLogo) {
      await key('Brand Assets').click(); await key('file').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
      await page.waitForFunction(() => !!brandProfileController.state.fileData);
      await key('Change logo').click(); await page.waitForFunction(() => brandProfileController.state.brand.logo_revision === 2 && !brandProfileController.busy());
      assert.equal(r.objects.size, 1); assert(!r.objects.has(`${B}/1.png`)); assert(r.objects.has(`${B}/2.png`));
      await page.evaluate(() => { const current = canonicalBrandDetail.brand; reconcileConfirmedBrand({ ...current, logo_revision: 1, logo_url: `/api/brands/${current.id}/logo?revision=1` }); });
      assert.equal(await page.evaluate(() => state.workspaceCatalog.value.workspaces[0].brands.find(b => b.id === canonicalBrandDetail.brand.id).logo_revision), 2, 'Stale reconciliation cannot overwrite the new logo');
      await key('Overview').click();
    }
    assert.equal(await key('Brand DNA').getAttribute('data-readiness'), 'complete'); assert.equal(await key('Overview').getAttribute('data-readiness'), 'partial'); assert.equal(await key('Audience').getAttribute('data-readiness'), 'empty'); assert.equal(await key('Team and permissions').getAttribute('data-readiness'), 'neutral');
    for (const section of profile.SECTIONS) { assert(await key(section).getAttribute('aria-describedby')); assert((await key(section).getAttribute('title')).includes(':')); assert(await key(section).getAttribute('title')); }
    const selected = await key('Overview').evaluate(b => ({ outline: getComputedStyle(b).outlineStyle, current: b.getAttribute('aria-current') })); assert.equal(selected.current, 'step'); assert.equal(selected.outline, 'solid');
    await page.evaluate(() => { const node = document.createElement('div'); node.id = 'logo-race-fixture'; document.body.append(node); FunklixBrandLogo.render(node, { name: 'Ä Brand', logo_url: '/api/brands/22222222-2222-4222-8222-222222222222/logo?revision=1', logo_revision: 2 }); const old = node.querySelector('img'); FunklixBrandLogo.render(node, { name: 'Appics', logo_url: '/api/brands/22222222-2222-4222-8222-222222222222/logo?revision=1', logo_revision: 1 }); old.dispatchEvent(new Event('error')); });
    assert.equal(await page.locator('#logo-race-fixture img').count(), 1, 'Stale image errors cannot remove the current logo');
    await page.locator('#logo-race-fixture img').evaluate(img => img.dispatchEvent(new Event('error'))); assert.equal(await page.locator('#logo-race-fixture').textContent(), 'A'); await page.locator('#logo-race-fixture').evaluate(n => n.remove());
    for (const theme of ['light','dark']) for (const width of [320,375,768,1440,720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await key('Overview').focus(); assert.equal(await page.evaluate(() => document.activeElement.dataset.profileKey), 'Overview'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Tab');
      assert(await key('Overview').evaluate(b => b.getBoundingClientRect().height >= 44));
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' }); assert.equal(await key('Overview').evaluate(b => getComputedStyle(b).outlineStyle), 'solid');
    await page.evaluate(() => state.uiLanguage = 'de'); await page.evaluate(() => brandProfileController.render()); assert((await key('Brand DNA').getAttribute('title')).includes('Vollständig')); assert.equal(await page.locator('#brand-section-status-1').textContent(), 'Vollständig');
    await page.evaluate(() => { brandProfileController.state.readOnly = true; brandProfileController.render(); }); assert.equal(await key('Confirm and save Brand Profile').count(), 0); await key('Brand Assets').click(); assert.equal(await key('file').count(), 0);
    assert.equal(nativeDialogs, 0); assert.deepEqual(errors, []);
    console.log('R5R3 Chromium production DOM: select–preview–upload–Storage/metadata–save–leave without dialog–full reload–validated catalog–Overview/sidebar/selector logo; separate avatar, readiness/selection/accessibility, stale/broken fallback, German, themes, mobile/reflow/keyboard/forced colors passed.');
  } finally { await browser.close(); }
}
module.exports = { browserJourney };
if (require.main === module) (async () => { readiness(); await boundaries(); await browserJourney(); })().catch(error => { console.error(error); process.exitCode = 1; });
