'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { create } = require('../canonical-brand-reader');
const { contextualMessages } = require('../home-foundation');
const { acceptedAvatar } = require('../brand-profile-setup');
const { W, B, D } = require('./fixtures/bw36-13r5-local-runtime');
const Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const out = path.resolve(process.env.BW22B2_EVIDENCE || 'work/bw36-22b2-visuals'); fs.mkdirSync(out, { recursive: true });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const avatarCore = (approved = true, url = '/fixture-avatar.png') => ({ brandDNA: { userApproved: true, avatar: { userApproved: approved, imageUrl: url } } });
const refresh = p => p.evaluate(() => { canonicalBrandReader.retire(); window.dispatchEvent(new CustomEvent('funklix:canonical-brand-saved')); clearAutosaveTimer(); });
const state = p => p.evaluate(() => JSON.stringify({ nodes: state.nodes, core: state.brandCore, dirty: state.isDirty, revision: state.lastKnownUpdatedAt, association: state.boardBrandAssociation }));
const message = p => p.locator('.home-avatar-message');
async function captureStage(p, file) {
  try { await p.locator('.home-avatar-stage').screenshot({ path: path.join(out, file), animations: 'disabled' }); }
  catch (error) { if (!error.message.includes('not attached')) throw error; await p.locator('.home-avatar-stage').screenshot({ path: path.join(out, file), animations: 'disabled' }); }
}
const accepted = p => p.locator('[data-avatar-state=ready] img');
const ready = p => p.locator('[data-avatar-state=ready]').waitFor();
let groups = 0;
async function check(name, run) { await run(); groups++; console.log('PASS ' + name); }
(async () => {
  await check('shared canonical reader deduplicates and enforces every scope boundary before/after JSON, access, revision and timeout', async () => {
    const account = {}, catalog = {}, initial = { account, catalog, identity: 'me', generation: 1, workspaceId: W, selectedBrandId: B, brandId: B, revision: 1 };
    for (const stage of ['headers', 'json']) for (const key of ['account', 'catalog', 'identity', 'generation', 'workspaceId', 'selectedBrandId', 'brandId', 'revision']) {
      let scope = { ...initial }, calls = 0, signal;
      const hold = deferred(), entered = deferred();
      const reader = create({ context: () => scope, validate: b => b.id === B, fetchImpl: async (_, options) => {
        calls++; signal = options.signal;
        if (stage === 'headers') { entered.resolve(); await hold.promise; }
        return { ok: true, json: async () => { if (stage === 'json') { entered.resolve(); await hold.promise; } return { id: B, revision: 1 }; } };
      } });
      const a = reader.read(B), b = reader.read(B); assert.equal(a, b); assert.equal(reader.read(B, { force: true }), a, 'Freshness requests deduplicate pending Profile/Home reads'); const rejected = assert.rejects(a);
      await entered.promise; scope = { ...scope, [key]: {} }; reader.current(); assert.equal(signal.aborted, true); hold.resolve(); await rejected; assert.equal(calls, 1);
    }
    for (const status of [401, 403, 404, 500]) {
      const reader = create({ context: () => initial, validate: () => true, fetchImpl: async () => ({ ok: false, status }) });
      await assert.rejects(reader.read(B), e => e.status === status);
    }
    let calls = 0;
    const reader = create({ context: () => initial, validate: b => b.id === B, fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ id: Y, revision: 1 }) }; } });
    await assert.rejects(reader.read(B), e => e.status === 422);
    reader.accept({ id: B, revision: 2 }); assert.equal((await reader.read(B, { force: true })).revision, 2); assert.equal(calls, 1);
    const denied = create({ context: () => null, validate: () => true, fetchImpl: () => { throw Error('must not fetch'); } }); await assert.rejects(denied.read(B), e => e.status === 403);
    const timed = create({ context: () => initial, validate: () => true, timeout: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(Error(), { name: 'AbortError' })))) });
    await assert.rejects(timed.read(B), e => e.status === 408);
    assert.equal(acceptedAvatar({ brand_core: avatarCore(false) }), null);
    const core = avatarCore(); core.brandDNA.userApproved = false; assert.equal(acceptedAvatar({ brand_core: core }), null);
  });
  await check('message priority, honest fallback, Brand/Board labels, invalid scopes and no invented metrics', () => {
    const c = { account: { email: 'me' }, identity: 'me', status: 'ready', workspaceId: W, brandId: Y, boardId: D, boardGeneration: 2,
      catalog: { workspaces: [{ id: W, brands: [{ id: B, name: 'X' }, { id: Y, name: 'Y' }], boards: [{ id: D, name: 'Saved', brand_id: B }] }] },
      openBoard: { name: 'Board X', brandId: B }, campaign: { status: 'ready', findings: [{ code: 'structure', title: 'Missing destination' }] },
      responsibilities: { boardId: D, generation: 2, nodes: [{ id: 'mine', assigned: true, complete: false, ownerEmail: 'ME' }] } };
    const messages = contextualMessages(c, [], { canWrite: true, proposed: 3 }, 'ready');
    assert.deepEqual(messages.map(m => m.key.split(':')[0]), ['learning', 'finding', 'responsibility', 'saved', 'greeting']);
    assert.equal(messages[0].values.brand, 'Y'); assert.equal(messages[1].values.board, 'Board X');
    assert.equal(contextualMessages({ ...c, loading: true }, [], null, 'error').length, 2);
    for (const patch of [{ account: null }, { publicToken: 'public' }, { identity: 'foreign' }, { status: 'loading' }, { workspaceId: 'foreign' }])
      assert.deepEqual(contextualMessages({ ...c, ...patch }, [], null, 'error'), [{ key: 'neutral', text: 'Ready to explore your next idea?' }]);
    assert(!/growth|approved today|health|success|engagement|history/i.test(JSON.stringify(messages)));
  });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const fixture = require('./fixtures/home-browser')(browser);
  async function setup(options) {
    const f = await fixture(options);
    await f.page.route('**/fixture-avatar.png', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixtures/brand-avatar-original.png')) }));
    if (options?.root) await f.page.locator('#home-workspace-select').selectOption(W);
    if (options?.hidden) await f.page.locator('#home-brand-select').selectOption(Y);
    if (!options?.noBrand && !options?.root) await ready(f.page); return f;
  }
  try {
    await check('saved approved original image, missing and unapproved states; Image failure/retry; keyboard Profile Avatar entry and real save refresh', async () => {
      const f = await setup(), p = f.page, before = await state(p);
      assert((await p.locator('.home-avatar-slot').innerText()).includes('Bring your Brand to life.'));
      await p.screenshot({ path: path.join(out, 'home-missing-light-en.png') });
      f.r.db.brands[0].brand_core = { ...f.r.db.brands[0].brand_core, ...avatarCore(false) }; await refresh(p); await ready(p); assert.equal(await accepted(p).count(), 0);
      f.r.db.brands[0].brand_core.brandDNA.userApproved = false; f.r.db.brands[0].brand_core.brandDNA.avatar.userApproved = true;
      await refresh(p); await ready(p); assert.equal(await accepted(p).count(), 0);
      f.r.db.brands[0].brand_core.brandDNA.userApproved = true; await refresh(p); await accepted(p).waitFor();
      assert.equal(await accepted(p).getAttribute('src'), '/fixture-avatar.png');
      const size = await accepted(p).evaluate(e => ({ w: e.naturalWidth, h: e.naturalHeight, fit: getComputedStyle(e).objectFit })); assert.deepEqual(size, { w: 360, h: 240, fit: 'contain' });
      f.r.db.brands[0].brand_core.brandDNA.avatar.imageUrl = '/missing-avatar.png'; await refresh(p); await p.getByRole('button', { name: 'Retry Brand Avatar', exact: true }).waitFor();
      await p.screenshot({ path: path.join(out, 'home-image-error-light-en.png') });
      assert((await p.locator('.home-avatar-slot').innerText()).includes('unavailable')); assert.equal(await p.getByRole('button', { name: 'Open Brand Avatar', exact: true }).count(), 0);
      f.r.db.brands[0].brand_core.brandDNA.avatar.imageUrl = '/fixture-avatar.png'; await p.getByRole('button', { name: 'Retry Brand Avatar', exact: true }).press('Enter'); await accepted(p).waitFor();
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.homeFocus), 'avatar-slot', 'Manual retry retains keyboard focus while its control is replaced');
      assert.equal(await state(p), before);
      // Open the actual Profile workflow, accept a client draft, save through PUT
      // and canonical verification. No generation endpoint is permitted.
      f.r.db.brands[0].brand_core = { ...f.r.db.brands[0].brand_core, ...avatarCore(false) }; await refresh(p); await ready(p);
      await p.getByRole('button', { name: 'Open Brand Avatar', exact: true }).press('Enter');
      await p.waitForFunction(() => state.activeView === 'brand-profile' && brandProfileController?.state.section === 6);
      const reads = f.requests.filter(r => r.path === '/api/brands/' + B && r.method === 'GET').length;
      // Profile reuses the same authorized response as Home.
      await p.evaluate(() => { brandProfileController.state.core.brandDNA.avatar.userApproved = true; });
      f.writes.length = 0;
      await p.evaluate(async () => { if (!await brandProfileController.save()) throw Error(brandProfileController.state.message); });
      assert.equal(f.writes.filter(r => r.method === 'PUT').length, 1); f.writes.length = 0;
      assert.equal(f.requests.filter(r => r.path === '/api/brands/' + B && r.method === 'GET').length, reads + 1, 'Existing save verification GET only');
      await p.evaluate(() => { el.homeNavButton.click(); clearAutosaveTimer(); }); await accepted(p).waitFor();
      assert.equal(f.requests.filter(r => r.path === '/api/brands/' + B && r.method === 'GET').length, reads + 1, 'Home reuses the confirmed save response');
      assert.equal(await state(p), before); await f.close();
    });
    await check('canonical failure is not absence; optional loading does not block Home, Board or Brain; stale selected-Brand response is discarded', async () => {
      const f = await setup(), p = f.page;
      await p.route('**/api/brands/' + B, route => route.fulfill({ status: 503, json: { error: {} } }));
      await refresh(p); await p.getByRole('button', { name: 'Retry Brand Avatar', exact: true }).waitFor();
      assert.equal(await p.getByRole('button', { name: 'Open Brand Avatar', exact: true }).count(), 0);
      await p.unroute('**/api/brands/' + B);
      const hold = deferred(), entered = deferred();
      const response = await f.r.request('GET', '/api/brands/' + B); response.body.brand_core = avatarCore(true, '/retired-avatar.png');
      let intercepted = false;
        await p.route('**/api/brands/' + B, async route => { if (intercepted) return route.fallback(); intercepted = true; entered.resolve(); await hold.promise; await route.fulfill({ json: response.body }).catch(() => {}); });
      await refresh(p); await entered.promise; assert.equal(await p.locator('[data-home-action=stage-brain]').count(), 1);
      await p.locator('#home-brand-select').selectOption(Y); hold.resolve(); await ready(p);
      assert.equal(await p.locator('img[src="/retired-avatar.png"]').count(), 0);
      assert((await message(p).innerText()).startsWith('Selected Brand Y: 9'));
      assert((await p.locator('.home-avatar-context').innerText()).includes('Autumn Launch · Canvas Brand X'));
      await p.locator('[data-home-action=stage-brain]').press('Enter'); assert.equal(await p.evaluate(() => state.activeView), 'ai_brain');
      await f.close();
    });
    await check('accepted selected-Brand image stays independent of the open Board Brand and catalog logos', async () => {
      const f = await setup(), p = f.page;
      await p.route('**/brand-y-avatar.png', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixtures/brand-avatar-original.png')) }));
      f.r.db.brands[0].brand_core = { ...f.r.db.brands[0].brand_core, ...avatarCore() };
      f.r.db.brands[1].brand_core = { ...f.r.db.brands[1].brand_core, ...avatarCore(true, '/brand-y-avatar.png') };
      await refresh(p); await accepted(p).waitFor();
      assert.equal(await accepted(p).getAttribute('src'), '/fixture-avatar.png');
      await p.locator('#home-brand-select').selectOption(Y);
      await p.locator('[data-avatar-state=ready] img[src="/brand-y-avatar.png"]').waitFor();
      assert.equal(await p.locator('.home-avatar-slot img[src="/fixture-avatar.png"]').count(), 0);
      assert((await p.locator('.home-avatar-context').innerText()).includes('Autumn Launch · Canvas Brand X'));
      assert((await accepted(p).getAttribute('alt')).includes('Selected Brand Y'));
      await p.screenshot({ path: path.join(out, 'home-brand-board-mismatch-light-en.png') });
      await f.close();
    });
    await check('account, Workspace, catalog and revoked Brand retire pending identity; Board access never grants Brand access', async () => {
      for (const change of ['account', 'workspace', 'catalog', 'brand']) {
        const f = await setup(), p = f.page, hold = deferred(), entered = deferred();
        const response = await f.r.request('GET', '/api/brands/' + B); response.body.brand_core = avatarCore(true, '/retired-avatar.png');
        let intercepted = false;
        await p.route('**/api/brands/' + B, async route => { if (intercepted) return route.fallback(); intercepted = true; entered.resolve(); await hold.promise; await route.fulfill({ json: response.body }).catch(() => {}); });
        await refresh(p); await entered.promise;
        await p.evaluate(({ change, W2 }) => {
          if (change === 'account') state.user = { email: 'other@example.test' };
          if (change === 'workspace') state.workspaceCatalog.activeWorkspaceId = W2;
          if (change === 'catalog') state.workspaceCatalog.generation++;
          if (change === 'brand') state.workspaceCatalog.value = { ...state.workspaceCatalog.value, workspaces: state.workspaceCatalog.value.workspaces.map(w => ({ ...w, brands: [] })) };
          refreshDashboardIfVisible(); clearAutosaveTimer();
        }, { change, W2 });
        hold.resolve(); await p.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        assert.equal(await p.locator('img[src="/retired-avatar.png"]').count(), 0, change + ': ' + JSON.stringify(await p.evaluate(() => ({ generation: state.workspaceCatalog.generation, identity: state.workspaceCatalog.identity, selected: state.session.brandId, workspace: state.workspaceCatalog.activeWorkspaceId }))));
        await f.close();
      }
      const f = await setup({ noBrand: true }); assert.equal(f.requests.filter(r => /^\/api\/brands\/[^/]+$/.test(r.path)).length, 0);
      assert.equal(await f.page.locator('[data-home-action=stage-brain]').count(), 1); assert.equal(await accepted(f.page).count(), 0); await f.close();
      const hidden = await setup({ hidden: true });
      assert.equal(hidden.requests.filter(r => r.path === '/api/brands/' + B).length, 0, 'Board access with hidden Brand never fetches that Brand');
      assert.equal(await hidden.page.locator('[data-home-action=stage-brain]').count(), 1); await hidden.close();
    });
    await check('manual eligible messages, stable selection, EN/DE, keyboard and screen reader naming; no automatic inference or timed rotation', async () => {
      const f = await setup(), p = f.page;
      assert((await message(p).innerText()).includes('73 Learning proposals'));
      await p.getByRole('button', { name: 'Next message', exact: true }).press('Enter');
      const selected = await message(p).innerText(); assert(selected.startsWith('Board Autumn Launch:'));
      assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('.home-avatar-message')), true);
      await p.evaluate(() => { refreshDashboardIfVisible(); clearAutosaveTimer(); }); assert.equal(await message(p).innerText(), selected);
      assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('.home-avatar-message')), true);
      await p.getByRole('button', { name: 'Previous message', exact: true }).press('Space'); assert((await message(p).innerText()).includes('73 Learning proposals'));
      await p.evaluate(() => { FunklixLanguage.setUiLanguage('de'); state.uiLanguage = 'de'; refreshDashboardIfVisible(); });
      assert((await message(p).innerText()).includes('73 Learning-Vorschläge'));
      assert.equal(await p.getByRole('button', { name: 'Nächste Nachricht', exact: true }).getAttribute('aria-controls'), 'home-avatar-message');
      assert.equal(await p.locator('.home-avatar-bubble').getAttribute('aria-live'), null);
      assert.equal(f.requests.filter(r => /generate|ai-brain/.test(r.path)).length, 0); await f.close();
    });
    await check('Light desktop/mobile original asset fidelity, Dark baseline, no motion and contextual Brain eligibility', async () => {
      const geometry = [];
      const f = await setup(), p = f.page;
      f.r.db.brands[0].brand_core = { ...f.r.db.brands[0].brand_core, ...avatarCore() }; await refresh(p); await accepted(p).waitFor();
      for (const [width, height, theme, language] of [[1440,900,'light','en'],[375,812,'light','en'],[320,740,'light','de'],[1440,900,'dark','de']]) {
        await p.setViewportSize({ width, height }); await p.emulateMedia({ reducedMotion: 'reduce' });
        await p.evaluate(({ theme, language }) => { FunklixTheme.setPreference(theme); FunklixLanguage.setUiLanguage(language); state.uiLanguage = language; refreshDashboardIfVisible(); }, { theme, language });
        await accepted(p).waitFor(); await accepted(p).evaluate(e => e.decode());
        // Finish finite theme transitions before measuring/capturing their final
        // state. This changes capture timing only, never application CSS.
        await p.evaluate(async () => {
          await document.fonts.ready; await new Promise(requestAnimationFrame);
          for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish();
        });
        const result = await p.locator('.home-avatar-stage').evaluate(e => {
          const image = e.querySelector('img'), r = image.getBoundingClientRect(), s = e.getBoundingClientRect();
          return { image: r.toJSON(), stage: s.toJSON(), fit: getComputedStyle(image).objectFit, natural: [image.naturalWidth,image.naturalHeight], motion: [e,...e.querySelectorAll('*')].some(e => getComputedStyle(e).animationName !== 'none'), overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(result.fit, 'contain'); assert.equal(result.motion, false); assert.equal(result.overflow, false);
        assert(result.image.left >= result.stage.left && result.image.right <= result.stage.right);
        assert.equal(await p.locator('[data-home-action=stage-brain]').count(), 1);
        await p.locator('.home-hero').evaluate(e => e.scrollIntoView({ block:'start', behavior:'instant' }));
        await p.screenshot({ path: path.join(out, `home-${width}-${theme}-${language}.png`), animations: 'disabled' });
        await captureStage(p, `stage-${width}-${theme}-${language}.png`);
        if (width <= 375) {
          await p.locator('.home-avatar-bubble').evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
          await p.screenshot({ path: path.join(out, `avatar-${width}-${theme}-${language}.png`), animations: 'disabled' });
          await p.locator('[data-home-action=stage-brain]').focus();
          await p.screenshot({ path: path.join(out, `brain-${width}-${theme}-${language}.png`), animations: 'disabled' });
        }
        geometry.push({ width, height, theme, language, ...result });
      }
      fs.writeFileSync(path.join(out, 'geometry.json'), JSON.stringify(geometry, null, 2));
      await f.close();
      for (const options of [{ viewer:true }, { root:true }]) {
        const f = await setup(options); await f.page.locator('[data-home-action=stage-boards]').waitFor(); assert.equal(await f.page.locator('[data-home-action=stage-brain]').count(), 0); assert.equal(await f.page.locator('[data-home-action=stage-boards]').count(), 1); await f.close();
      }
    });
  } finally { await browser.close(); }
  console.log(groups + ' B2 acceptance groups passed');
})().catch(error => { console.error(error); if (process.env.GITHUB_ACTIONS === 'true') console.error('::error title=B2 Avatar regression::' + String(error.stack || error).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')); process.exitCode = 1; });
