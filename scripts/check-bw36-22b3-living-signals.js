'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { livingSignals, contextualOnboarding } = require('../home-foundation');
const { readiness, SECTIONS } = require('../brand-profile-setup');
const { W, B, D, EMAIL } = require('./fixtures/bw36-13r5-local-runtime');
const Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const out = path.resolve(process.env.BW22B3_EVIDENCE || 'work/bw36-22b3-visuals'); fs.mkdirSync(out, { recursive: true });
const records = [], geometry = [];
const defer = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function check(name, fn) { await fn(); records.push(name); console.log('PASS ' + name); }
const canonicalRefresh = p => p.evaluate(() => { canonicalBrandReader.retire(); window.dispatchEvent(new CustomEvent('funklix:canonical-brand-saved')); clearAutosaveTimer(); });
const learningRefresh = p => p.evaluate(() => window.dispatchEvent(new CustomEvent('funklix:brand-learnings-changed')));
const signal = (p, source) => p.locator('[data-signal-source=' + source + ']');
const onboarding = p => p.locator('.home-profile-next');
const settled = p => p.waitForFunction(() => document.querySelector('[data-avatar-state=ready]') && document.querySelector('[data-home-module=brand] dl'));
const snapshot = p => p.evaluate(() => JSON.stringify({ nodes: state.nodes, edges: state.edges, core: state.brandCore, dirty: state.isDirty, saved: state.lastSavedSnapshot, association: state.boardBrandAssociation, revision: state.lastKnownUpdatedAt }));
const fullBrand = () => ({ id: B, name: 'Complete Brand', logo_revision: 1, logo_object_path: 'fixture/logo.png', logo_mime_type: 'image/png', logo_source: 'uploaded', logo_url: `/api/brands/${B}/logo?revision=1`, access: { role: 'editor', canEditCanonicalBrand: true }, brand_core: {
  brandAssets: { domain: 'fixture.test', colors: ['blue'], typography: 'Sans' }, brandCore: 'Description', valueProposition: 'Value',
  brandDNA: { userApproved: true, primaryArchetype: 'Creator', secondaryArchetype: 'Sage', avatar: { userApproved: true, imageUrl: '/fixture-avatar.png' } },
  personas: [{ name: 'Customer', note: 'Needs support' }], customTiles: [{ moduleType: 'icp', content: 'Customer profile' }],
  toneOfVoice: ['Warm'], messagingPillars: ['Clear'], contentGuidelines: ['Useful'], keywords: ['Care'], dosAndDonts: ['Be clear'], brandVoiceExamples: ['Welcome'], offers: ['Offer'], proof: ['Evidence']
} });
(async () => {
  await check('eligible evidence is bounded, precisely scoped and immutable; exact responsibility ownership and duplicate rejection', () => {
    const c = { account: { email: 'me@test' }, identity: 'me@test', status: 'ready', workspaceId: W, brandId: Y, boardId: D, boardGeneration: 3,
      catalog: { workspaces: [{ id: W, brands: [{ id: B, name: 'Brand X' }, { id: Y, name: 'Brand Y' }], boards: [{ id: D, name: 'Saved name', brand_id: B }] }] },
      openBoard: { name: 'Real Board', brandId: B }, campaign: { status: 'ready', key: 'fresh', findings: [{ code: 'structure', title: 'Missing destination' }] },
      responsibilities: { boardId: D, generation: 3, nodes: [
        { id: 'mine', assigned: true, complete: false, ownerEmail: ' ME@test ' }, { id: 'similar', assigned: true, complete: false, ownerEmail: 'me@test.evil' },
        { id: 'done', assigned: true, complete: true, ownerEmail: 'me@test' }, { id: 'unassigned', assigned: false, complete: false, ownerEmail: 'me@test' },
        { id: 'duplicate', assigned: true, complete: false, ownerEmail: 'me@test' }, { id: 'duplicate', assigned: true, complete: false, ownerEmail: 'me@test' }
      ] } };
    const learning = { canWrite: true, proposed: 7 }, before = JSON.stringify([c, learning]);
    const signals = livingSignals(c, [], learning, 'ready');
    assert.deepEqual(signals.map(s => s.source), ['learning', 'diagnostic']);
    assert.equal(signals[0].name, 'Brand Y'); assert.equal(signals[1].name, 'Real Board');
    assert.equal(livingSignals({ ...c, campaign: { status: 'stale' } }, [], null, 'error')[0].values.count, 1);
    assert.equal(JSON.stringify([c, learning]), before);
    for (const patch of [{ account: null }, { publicToken: 'public' }, { identity: 'foreign' }, { status: 'loading' }, { workspaceId: 'foreign' }]) assert.deepEqual(livingSignals({ ...c, ...patch }, [], learning, 'ready'), []);
    for (const status of ['loading', 'stale', 'denied', 'error', 'idle']) assert(!livingSignals(c, [], learning, status).some(s => s.source === 'learning'));
    for (const invalid of [{ canWrite: false, proposed: 7 }, { canWrite: true, proposed: null }, { canWrite: true, proposed: -1 }, { canWrite: true, proposed: NaN }, { canWrite: true, proposed: '7' }]) assert(!livingSignals(c, [], invalid, 'ready').some(s => s.source === 'learning'));
    for (const status of ['loading', 'analyzing', 'stale', 'denied', 'error', 'missing', 'empty']) assert(!livingSignals({ ...c, campaign: { ...c.campaign, status } }, [], null, 'error').some(s => s.source === 'diagnostic'));
    for (const responsibilities of [null, { ...c.responsibilities, boardId: 'foreign' }, { ...c.responsibilities, generation: 2 }]) assert(!livingSignals({ ...c, responsibilities }, [], null, 'error').some(s => s.source === 'responsibility'));
    assert.deepEqual(livingSignals({ ...c, loading: true }, [], null, 'error'), []);
    assert.deepEqual(livingSignals({ ...c, boardId: 'foreign', catalog: { workspaces: [{ ...c.catalog.workspaces[0], boards: [] }] } }, [], null, 'error'), []);
    assert.equal(livingSignals({ ...c, openBoard: null }, [], null, 'error')[0].source, 'saved');
  });
  await check('canonical readiness selects one real section, complete/neutral never incomplete; permission and unknown failures', () => {
    const complete = fullBrand(); assert(readiness(complete).every(s => ['complete', 'neutral'].includes(s.status)));
    assert.equal(contextualOnboarding(complete, readiness), null);
    const incomplete = { ...complete, brand_core: { ...complete.brand_core, personas: [], customTiles: [] } };
    assert.deepEqual(contextualOnboarding(incomplete, readiness), { section: 'Audience', canEdit: true });
    assert.deepEqual(contextualOnboarding({ ...incomplete, access: { canEditCanonicalBrand: false } }, readiness), { section: 'Audience', canEdit: false });
    assert.deepEqual(contextualOnboarding({ ...incomplete, access: { role: 'viewer', canEditCanonicalBrand: true } }, readiness), { section: 'Audience', canEdit: false });
    for (const detail of [null, {}, { brand_core: {} }, { ...incomplete, access: {} }]) assert.equal(contextualOnboarding(detail, readiness), null);
    assert.equal(contextualOnboarding(incomplete), null);
    assert.equal(contextualOnboarding(incomplete, () => { throw Error('Unavailable readiness'); }), null);
    for (const section of SECTIONS.slice(0, 7)) assert.equal(contextualOnboarding(incomplete, () => [{ section, status: 'partial' }]).section, section);
  });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const fixture = require('./fixtures/home-browser')(browser);
  try {
    await check('real signal destinations, selected Brand/Board mismatch, keyboard navigation, redraw and origin focus; no writes or added reads', async () => {
      const f = await fixture(), p = f.page; await settled(p); const before = await snapshot(p);
      assert.equal(await p.locator('.home-signal').count(), 2);
      assert.match(await signal(p, 'learning').innerText(), /73.*\nSelected Brand · Canvas Brand X · Learning reviews/);
      assert.match(await signal(p, 'diagnostic').innerText(), /Current Board · Autumn Launch · Canvas diagnostics/);
      const reads = f.requests.length;
      await p.locator('[data-home-action=onboarding-profile]').focus();
      await p.evaluate(() => { refreshDashboardIfVisible(); clearAutosaveTimer(); });
      assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('[data-home-action=onboarding-profile]')), true);
      assert.equal(f.requests.length, reads, 'Presentation redraw adds no reads');
      await p.keyboard.press('Enter'); await p.waitForFunction(() => state.activeView === 'brand-profile' && brandProfileController);
      assert.equal(await p.evaluate(() => brandProfileController.state.section), 0);
      // Exercise the actual confirmed-read reconciliation that also follows a
      // Profile save. No additional write is needed to verify catalog replacement.
      await p.evaluate(() => reconcileConfirmedBrand(brandProfileController.state.brand));
      await p.evaluate(() => closeCanonicalBrandDetail()); await settled(p);
      assert.equal(await p.evaluate(() => ['onboarding-profile:' + state.session.brandId, 'living-title'].includes(document.activeElement?.dataset.homeFocus)), true, 'Origin or stable Home heading while canonical readiness refreshes');
      await signal(p, 'diagnostic').locator('button').press('Enter');
      await p.waitForFunction(() => state.activeView === 'insights' && document.activeElement?.closest('#insights-view'));
      await p.evaluate(() => setActiveView('home')); await settled(p);
      const hold = { started: defer(), release: defer() }; f.holds.push(hold);
      await signal(p, 'learning').locator('button').focus(); await learningRefresh(p); await hold.started.promise;
      assert.equal(await signal(p, 'learning').count(), 0);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.homeFocus), 'living-title', 'Retired signals retain a safe keyboard focus destination during reauthorization');
      hold.release.resolve(); await settled(p);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.homeFocus), 'living-title');
      await p.locator('#home-brand-select').selectOption(Y); await settled(p);
      assert.match(await signal(p, 'learning').innerText(), /9.*\nSelected Brand · Selected Brand Y/);
      assert.match(await signal(p, 'diagnostic').innerText(), /Current Board · Autumn Launch/);
      await signal(p, 'learning').locator('button').press('Enter'); await p.waitForFunction(() => state.activeView === 'brand-profile' && brandProfileController?.state.section === 7);
      assert.equal(await p.evaluate(() => brandProfileController.state.brand.id), Y);
      assert.equal(await snapshot(p), before); await f.close();
    });
    await check('canonical section deep links, complete readiness, read-only guidance, loading and denied/failed reads', async () => {
      const f = await fixture(), p = f.page; await settled(p);
      // A real canonical response with every earlier section complete.
      Object.assign(f.r.db.brands[0], fullBrand());
      f.r.db.brands[0].brand_core.personas = []; f.r.db.brands[0].brand_core.customTiles = [];
      await p.locator('[data-home-action=onboarding-profile]').focus();
      await canonicalRefresh(p); await settled(p); assert.match(await onboarding(p).innerText(), /Audience/);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.homeFocus), 'living-title', 'Readiness refresh preserves focus while the old next step is removed');
      await p.locator('[data-home-action=onboarding-profile]').press('Enter');
      await p.waitForFunction(() => brandProfileController?.state.section === 2);
      await p.evaluate(() => closeCanonicalBrandDetail()); await settled(p);
      // Route through actual session/validator to inspect canonical viewer capability.
      const response = await f.r.request('GET', '/api/brands/' + B);
      response.body.access.canEditCanonicalBrand = false; response.body.access.role = 'viewer';
      await p.route('**/api/brands/' + B, route => route.fulfill({ json: response.body }));
      await canonicalRefresh(p); await settled(p);
      assert.match(await onboarding(p).innerText(), /A Brand editor can complete it/);
      assert.equal(await p.getByRole('button', { name: 'Open Profile section', exact: true }).count(), 0);
      await p.getByRole('button', { name: 'View Profile section', exact: true }).press('Enter');
      await p.waitForFunction(() => brandProfileController?.state.section === 2); assert.equal(await p.evaluate(() => brandProfileController.state.brand.access.canEditCanonicalBrand), false);
      await p.evaluate(() => closeCanonicalBrandDetail());
      await p.unroute('**/api/brands/' + B);
      for (const status of [401, 403, 404, 503]) {
        await p.route('**/api/brands/' + B, route => route.fulfill({ status, json: { error: {} } }));
        await canonicalRefresh(p); await p.locator('[data-avatar-state=denied], [data-avatar-state=error]').waitFor();
        assert.equal(await onboarding(p).count(), 0); await p.unroute('**/api/brands/' + B);
      }
      Object.assign(f.r.db.brands[0], fullBrand()); await canonicalRefresh(p); await settled(p); assert.equal(await onboarding(p).count(), 0);
      const hold = defer(), entered = defer();
      await p.route('**/api/brands/' + B, async route => { entered.resolve(); await hold.promise; await route.fulfill({ json: response.body }).catch(() => {}); });
      await canonicalRefresh(p); await entered.promise; assert.equal(await onboarding(p).count(), 0); hold.resolve(); await settled(p);
      await f.close();
    });
    await check('Learning capability, invalid aggregates, loading/denial; responsibility and saved continuation fallbacks', async () => {
      const f = await fixture(), p = f.page; await settled(p);
      for (const patch of [{ can_write: false }, { counts: { proposed: null } }, { counts: { proposed: 0 } }]) {
        Object.assign(f.results.get(B), patch); await learningRefresh(p);
        await p.waitForFunction(() => document.querySelector('[data-home-module=brand] dl'));
        assert.equal(await signal(p, 'learning').count(), 0);
      }
      assert.match(await signal(p, 'responsibility').innerText(), /3 incomplete responsibilities assigned to you/);
      await signal(p, 'responsibility').locator('button').press('Enter');
      await p.waitForFunction(() => { const dialog = document.querySelector('#campaign-responsibilities'); return dialog?.open && dialog.getAttribute('aria-busy') === 'false'; });
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => document.activeElement === document.querySelector('[data-home-action=signal-responsibilities]'));
      assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('[data-home-action=signal-responsibilities]')), true);
      for (const status of [403, 503]) {
        f.status = status; await learningRefresh(p);
        await p.waitForFunction(() => !document.querySelector('[data-home-module=brand] [aria-busy=true]') && /unavailable|could not be confirmed/.test(document.querySelector('[data-home-module=brand]').innerText));
        assert.equal(await signal(p, 'learning').count(), 0);
      }
      const hold = { started: defer(), release: defer() }; f.status = 200; f.holds.push(hold);
      await learningRefresh(p); await hold.started.promise; assert.equal(await signal(p, 'learning').count(), 0); hold.release.resolve();
      await p.waitForFunction(() => document.querySelector('[data-home-module=brand] dl'));
      await p.evaluate(() => { state.nodes.forEach(n => n.ownerEmail = 'someone-else@example.test'); refreshDashboardIfVisible(); clearAutosaveTimer(); });
      await signal(p, 'saved').waitFor(); assert.match(await signal(p, 'saved').innerText(), /Autumn Launch/);
      await signal(p, 'saved').locator('button').press('Enter');
      await p.waitForFunction(() => state.activeView === 'board');
      await f.close();
    });
    await check('Brand, Workspace, catalog and account switches retire pending onboarding and Learning results; detached/forged controls cannot navigate', async () => {
      for (const change of ['brand', 'workspace', 'catalog', 'account']) {
        const f = await fixture(), p = f.page; await settled(p);
        const response = await f.r.request('GET', '/api/brands/' + B), hold = defer(), entered = defer();
        const learningHold = { started: defer(), release: defer() }; f.holds.push(learningHold);
        let intercepted = false;
        await p.route('**/api/brands/' + B, async route => { if (intercepted) return route.fallback(); intercepted = true; entered.resolve(); await hold.promise; await route.fulfill({ json: response.body }).catch(() => {}); });
        await p.evaluate(() => { window.retiredSignal = document.querySelector('[data-home-action=signal-learnings]'); window.retiredOnboarding = document.querySelector('[data-home-action=onboarding-profile]'); });
        await canonicalRefresh(p); await entered.promise; await learningRefresh(p); await learningHold.started.promise;
        assert.equal(await onboarding(p).count(), 0);
        await p.evaluate(({ change, Y, W2 }) => {
          if (change === 'brand') state.session.brandId = Y;
          if (change === 'workspace') state.workspaceCatalog.activeWorkspaceId = W2;
          if (change === 'catalog') state.workspaceCatalog.value = { ...state.workspaceCatalog.value, workspaces: state.workspaceCatalog.value.workspaces.map(w => ({ ...w, brands: [] })) };
          if (change === 'account') state.user = { email: 'other@example.test' };
          refreshDashboardIfVisible(); clearAutosaveTimer();
          for (const old of [window.retiredSignal, window.retiredOnboarding]) { if (old) { document.querySelector('#home-foundation').append(old); old.click(); old.remove(); } }
          const forged = document.createElement('button'); forged.dataset.homeAction = 'onboarding-profile'; forged.dataset.homeId = Y; document.querySelector('#home-foundation').append(forged); forged.click(); forged.remove();
        }, { change, Y, W2 });
        hold.resolve(); learningHold.release.resolve();
        if (change === 'brand') { await settled(p); assert.match(await onboarding(p).innerText(), /Selected Brand Y/); assert.match(await signal(p, 'learning').innerText(), /9 Learning/); }
        else { await p.evaluate(() => new Promise(requestAnimationFrame)); assert.equal(await onboarding(p).count(), 0); assert.equal(await signal(p, 'learning').count(), 0); }
        assert.equal(await p.evaluate(() => state.activeView), 'home'); await f.close();
      }
    });
    await check('Light/Dark, EN/DE, desktop/mobile and text enlargement: readable signals, accepted Avatar, keyboard focus and static composition', async () => {
      const f = await fixture(), p = f.page; await settled(p);
      await p.route('**/fixture-avatar.png', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixtures/brand-avatar-original.png')) }));
      f.r.db.brands[0].brand_core.brandDNA = fullBrand().brand_core.brandDNA; await canonicalRefresh(p); await settled(p);
      for (const [width, height, theme, language] of [[1600,900,'light','en'],[1440,900,'dark','de'],[375,812,'light','en'],[320,740,'dark','de']]) {
        await p.setViewportSize({ width, height }); await p.emulateMedia({ reducedMotion: 'reduce' });
        await p.evaluate(({ theme, language }) => { FunklixTheme.setPreference(theme); FunklixLanguage.setUiLanguage(language); state.uiLanguage = language; refreshDashboardIfVisible(); }, { theme, language });
        await settled(p);
        assert.equal(await p.locator('.home-signal').count(), 2); assert.equal(await p.locator('.home-avatar-slot img').getAttribute('src'), '/fixture-avatar.png');
        if (language === 'de') { assert.match(await signal(p, 'learning').innerText(), /Learning-Vorschläge.*\nAusgewählte Brand/); assert.match(await onboarding(p).innerText(), /Vervollständige.*Überblick/); }
        await p.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) a.finish(); });
        const metrics = await p.evaluate(() => {
          const controls = [...document.querySelectorAll('.home-signal, .home-profile-next button')];
          return { overflow: document.documentElement.scrollWidth > innerWidth,
            controls: controls.map(e => { const r = e.getBoundingClientRect(); return { height: r.height, contained: r.left >= 0 && r.right <= innerWidth }; }),
            animations: [...document.querySelectorAll('.home-living *')].filter(e => getComputedStyle(e).animationName !== 'none').length };
        });
        assert.equal(metrics.overflow, false); assert.equal(metrics.animations, 0); assert(metrics.controls.every(r => r.height >= 44 && r.contained));
        await p.locator('.home-living').evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await p.screenshot({ path: path.join(out, `home-${width}-${theme}-${language}.png`), animations: 'disabled' });
        await p.locator('.home-living-signals').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await p.screenshot({ path: path.join(out, `signals-${width}-${theme}-${language}.png`), animations: 'disabled' });
        await p.evaluate(() => {
          const control = document.querySelector('[data-home-action=onboarding-profile]'); control.focus(); control.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('[data-home-action=onboarding-profile]')), true);
        await p.screenshot({ path: path.join(out, `next-step-${width}-${theme}-${language}.png`), animations: 'disabled' });
        geometry.push({ width, height, theme, language, ...metrics });
      }
      await p.setViewportSize({ width: 720, height: 1000 });
      await p.evaluate(() => { document.documentElement.style.fontSize = '200%'; refreshDashboardIfVisible(); });
      await signal(p, 'learning').locator('button').hover();
      assert.equal(await signal(p, 'learning').locator('button').evaluate(e => getComputedStyle(e).transform), 'none', 'Signals must not inherit global hover scaling');
      assert.equal(await p.locator('#home-foundation').evaluate(e => e.scrollWidth > e.getBoundingClientRect().width + 1), false, 'Hovered signals contain enlarged text in Home');
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.emulateMedia({ forcedColors: 'active' }); await p.locator('[data-home-action=onboarding-profile]').focus();
      assert.notEqual(await p.locator('[data-home-action=onboarding-profile]').evaluate(e => getComputedStyle(e).outlineStyle), 'none');
      await f.close();
    });
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify({ groups: records, geometry }, null, 2));
  console.log(records.length + ' B3 acceptance groups passed');
})().catch(error => { console.error(error); if (process.env.GITHUB_ACTIONS === 'true') console.error('::error title=B3 Living Signals regression::' + String(error.stack || error).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')); process.exitCode = 1; });
