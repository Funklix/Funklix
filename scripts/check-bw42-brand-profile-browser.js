'use strict';
// Production app, DOM, handlers and signed-session endpoints; disposable SQL/storage only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { randomUUID } = require('node:crypto');
const { runtime, W, B, EMAIL, png } = require('./fixtures/bw36-13r5-local-runtime');
const profile = require('../brand-profile-setup');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const r = runtime({ postgresLogo: true });
  const brand = r.db.brands[0]; brand.name = 'Northstar Studio';
  Object.assign(brand.brand_core, {
    brandCore: 'A fictional creative studio helping small teams communicate clearly.',
    valueProposition: 'Clear ideas and practical guidance for independent creative teams.',
    brandAssets: { domain: 'https://example.test', colors: ['#7047eb', '#eee9ff'], typography: 'System sans serif', references: ['Fictional fixture — no customer data'] },
    toneOfVoice: ['Friendly and clear'], messagingPillars: ['Make useful ideas easy to understand'],
    contentGuidelines: ['Use concrete examples. Keep the next step clear.'], keywords: ['creative teams'],
    dosAndDonts: { dos: ['Write clearly'], donts: ['Overpromise'] }, brandVoiceExamples: { good: 'Build your next idea with a clear plan.', avoid: 'Guaranteed results.' },
    brandDNA: { primaryArchetype: 'Creator', secondaryArchetype: 'Sage', userApproved: true,
      avatar: { imageUrl: '/scripts/fixtures/brand-avatar-original.png', userApproved: true } }
  });
  const initial = await r.request('POST', `/api/brands/${B}/logo`, { contract: 'brand_logo_v1', request_id: randomUUID(), action: 'upload', workspace_id: W, expected_revision: 0, mime_type: 'image/png', image_base64: png.toString('base64') });
  assert.equal(initial.statusCode, 200);
  const catalog = () => ({ contract: 'workspace_catalog_v1', request_id: 'abcdefabcdefabcdefabcdef', workspaces: require('../api/_workspace-catalog').projectCatalog({ memberships: [{ id: W, name: 'Example Workspace', role: 'owner', revision: 1 }], brands: r.db.brands.map(b => ({...b, role:'owner'})), boards: r.db.boards.map(b => ({...b, role:'owner'})) }) });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1672, height: 1000 } }); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => { assert.match(d.message(), /^Review (?:these Brand changes:|logo change:)/); void d.accept(); });
    await page.route('**/*', async route => {
      const q = route.request(), u = new URL(q.url()); assert.equal(u.hostname, 'localhost');
      if (u.pathname.startsWith('/api/')) {
        if (u.pathname === '/api/auth/session') return route.fulfill({ json: { user: null } });
        if (u.pathname === '/api/workspaces/catalog') return route.fulfill({ json: catalog() });
        if (/^\/api\/brands\/[^/]+(?:\/(?:logo|write-preview))?$/.test(u.pathname)) {
          const out = await r.request(q.method(), u.pathname + u.search, q.postDataJSON() || undefined, undefined, q.headers());
          return Buffer.isBuffer(out.body) ? route.fulfill({ status: out.statusCode, contentType: 'image/png', body: out.body }) : route.fulfill({ status: out.statusCode, json: out.body });
        }
        return route.fulfill({ json: { boards: [], brands: [], members: [], nodes: [], presence: [] } });
      }
      const file = path.resolve(ROOT, u.pathname === '/' ? 'index.html' : '.' + u.pathname);
      return route.fulfill(fs.existsSync(file) && fs.statSync(file).isFile() ? { path: file } : { body: '' });
    });
    async function boot() {
      await page.goto('http://localhost/'); await page.waitForFunction(() => typeof state !== 'undefined' && workspaceSidebarController);
      await page.evaluate(({ W, B, EMAIL, catalog }) => {
        state.user = { email: EMAIL, name: 'Alex Example' }; state.publicBoardToken = null; state.currentBoardId = null; state.session.boardId = null;
        state.session.workspaceId = W; state.session.brandId = B; state.boardAccess = { canView: true, canEdit: true }; state.isDirty = false;
        const value = FunklixWorkspaceCatalog.validate(catalog);
        state.workspaceCatalog = { ...state.workspaceCatalog, identity: EMAIL, status: 'ready', value, generation: 100, activeWorkspaceId: W };
        state.brandCatalog = { ...state.brandCatalog, status: 'success', entries: value.workspaces[0].brands };
        clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setActiveView('home'); setSidebarCollapsed(false); renderWorkspaceSidebar();
      }, { W, B, EMAIL, catalog: catalog() });
      await page.locator('#brand-core-nav-btn').click();
      await page.waitForFunction(B => brandProfileController?.state.brand.id === B && canonicalBrandDetail.status === 'ready', B);
    }
    const key = name => page.locator(`[data-profile-key="${name}"]`);
    const shots = 'work/bw42'; fs.mkdirSync(shots, { recursive: true });
    await boot(); await page.emulateMedia({ reducedMotion: 'reduce' });
    const readiness = await key('Overview').getAttribute('data-readiness');
    // Every section remains reachable, exposes saved readiness, and focuses its heading.
    for (const name of profile.SECTIONS) {
      await key(name).click(); assert.equal(await key(name).getAttribute('aria-current'), 'step');
      assert(await key(name).getAttribute('aria-describedby'));
      assert.equal(await page.locator('[data-section-title]').evaluate(n => n === document.activeElement), true);
    }
    assert.equal(await key('Overview').getAttribute('data-readiness'), readiness);
    const surfaces = new Set();
    for (const theme of ['light', 'dark']) for (const [width, height] of [[1672,1000],[1366,900],[768,1024],[375,812],[320,740],[720,450]]) for (const collapsed of [false,true]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(({theme,collapsed}) => { document.documentElement.dataset.theme = theme; setSidebarCollapsed(collapsed); }, {theme,collapsed});
      if(width>=1366) assert(await page.locator('#brand-workspace-detail').evaluate(n=>n.getBoundingClientRect().width>=n.parentElement.getBoundingClientRect().width*.9),'Fluid full-width page');
      for (const name of ['Overview', 'Brand Assets', 'Voice & Messaging']) {
        await key(name).click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow ${theme}/${width}/${collapsed}/${name}`);
        for (const selector of ['.guided-brand-profile','.profile-header','.profile-section','.profile-actions','nav[aria-label]']) {

          const target = selector === '.guided-brand-profile' ? page.locator(selector) : page.locator('.guided-brand-profile').locator(selector);
          const fits = await target.evaluate(n => n.scrollWidth <= n.clientWidth + 1);

          assert(fits, `Inner overflow ${selector}/${theme}/${width}/${name}`);
        }
        const close = page.locator('#brand-workspace-detail-close');
        await close.scrollIntoViewIfNeeded();
        assert(await close.evaluate(n => { const r=n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), 'Close is not overlapped');
        if (width === 1672 && !collapsed && theme === 'light') await page.screenshot({ path: `${shots}/${name === 'Overview' ? 'overview' : name === 'Brand Assets' ? 'assets' : 'voice'}-light-desktop.png` });
      }
      const advanced = key('Advanced options'); await advanced.scrollIntoViewIfNeeded();
      assert(await advanced.evaluate(n => { const r=n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), `Management actions clear of mobile navigation ${width}`);
      await key('Overview').click(); surfaces.add(await page.locator('.profile-header').evaluate(n => getComputedStyle(n).backgroundImage));
      if (!collapsed && ((theme === 'dark' && width === 1672) || (theme === 'light' && [768,375,320].includes(width)))) {
        await page.locator('.profile-header').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${shots}/overview-${theme}-${width}.png` });
        if(width===375){await page.locator('.profile-identity-cards').scrollIntoViewIfNeeded();await page.screenshot({path:`${shots}/overview-light-mobile-content.png`});}
      }
      await page.keyboard.press('Tab'); await key('Brand Assets').focus(); assert(await key('Brand Assets').evaluate(n => getComputedStyle(n).outlineStyle === 'solid')); await page.keyboard.press('Enter');
      assert.equal(await key('Brand Assets').getAttribute('aria-current'), 'step');
    }
    assert.equal(surfaces.size, 2, 'Light/Dark use distinct theme-native surfaces');
    for(const width of [1440,768,320]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(() => { document.documentElement.dataset.theme='light';setSidebarCollapsed(false);state.uiLanguage='de';brandProfileController.render(); });
      for(const name of profile.SECTIONS){await key(name).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'German reflow');}
    }
    await page.evaluate(() => { const s=brandProfileController.state;window.bw42SavedBrand=s.brand;s.brand={...s.brand,name:'Ein außergewöhnlich langer Markenname für internationale kreative Zusammenarbeit',logo_url:null,brand_core:{...s.brand.brand_core,brandAssets:{...s.brand.brand_core.brandAssets,domain:''}}};brandProfileController.render(); });
    await key('Overview').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Long name / missing logo and URL reflow');
    assert.equal(await page.locator('.profile-logo img').count(),0);
    await page.evaluate(() => {brandProfileController.state.brand=window.bw42SavedBrand;delete window.bw42SavedBrand;state.uiLanguage='en';brandProfileController.render();});
    await page.setViewportSize({width:1440,height:1000});
    await key('Overview').click(); await key('Brand name').fill('Northstar Edited');
    await key('Confirm and save Brand Profile').click(); await page.waitForFunction(() => !brandProfileController.busy() && brandProfileController.state.message === 'Brand Profile saved');
    assert.equal(r.db.brands[0].name,'Northstar Edited');
    await key('Reload latest Brand').click(); await page.waitForFunction(() => !brandProfileController.busy()); assert.equal(await key('Brand name').inputValue(),'Northstar Edited');
    await key('Brand Assets').click(); await key('file').setInputFiles({name:'fictional-logo.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(() => !!brandProfileController.state.fileData); r.db.failStorageUpload=true;
    await key('Change logo').click(); await page.waitForFunction(() => !brandProfileController.busy());
    assert(await page.evaluate(() => !!brandProfileController.state.fileData)); assert(await page.locator('.profile-logo-candidate').isVisible());
    await page.screenshot({path:`${shots}/upload-failure-retained.png`});
    r.db.failStorageUpload=false; await key('Change logo').click(); await page.waitForFunction(() => !brandProfileController.busy() && brandProfileController.state.logo === 'Logo saved');
    assert.equal(r.db.brands[0].logo_revision,2); await boot();
    assert.equal(await page.locator('.profile-official-logo img').getAttribute('src'),`/api/brands/${B}/logo?revision=2`);
    // Existing overview action opens the same Avatar section, without modifying the asset.
    await key('Open Brand Avatar').click(); assert.equal(await key('Brand Avatar').getAttribute('aria-current'),'step');
    assert.equal(await page.locator('.profile-brand-avatar').getAttribute('src'),'/scripts/fixtures/brand-avatar-original.png');
    await key('Advanced options').click(); await page.getByRole('button',{name:'Back to Brand Profile',exact:true}).waitFor();
    await page.getByRole('button',{name:'Back to Brand Profile',exact:true}).click(); await key('Overview').waitFor();
    await page.emulateMedia({forcedColors:'active'}); await key('Overview').focus(); assert(await key('Overview').evaluate(n=>getComputedStyle(n).outlineStyle==='solid'));
    assert.deepEqual(errors,[]);
    console.log('PASS BW-42 production app: all sections, header/Close, saved readiness, editing/save/reload, Avatar, Advanced, upload failure/retention/retry/full boot persistence, EN/DE, Light/Dark, expanded/collapsed sidebar, 1672/1366/768/375/320 and 720x450 (200% reflow equivalent), keyboard/reduced-motion/forced colors, German section reflow, long-name/missing-logo/URL states and reachable mobile management actions. Screenshots: work/bw42. No real provider/storage/customer data.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
