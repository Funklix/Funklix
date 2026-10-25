'use strict';
// Real Home fixture, local transport only; baseline capture uses an exact main checkout.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const out = path.resolve(process.env.BW22B4_EVIDENCE || 'work/bw36-22b4/evidence');
fs.mkdirSync(out, { recursive: true });
const baseline = process.env.BW22B4_BASELINE === '1';
const measures = [];
const actions = '.home-living-resume .fk-btn-primary, .home-avatar-entry .fk-btn-primary';
async function imageSnapshot(p) {
  return (await p.waitForFunction(() => {
    const e = document.querySelector('[data-avatar-state=ready] img');
    if (!e?.isConnected || !e.complete || !e.naturalWidth) return null;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { src: e.getAttribute('src'), w: e.naturalWidth, h: e.naturalHeight, fit: s.objectFit,
      transform: s.transform, animation: s.animationName, filter: s.filter, opacity: s.opacity,
      x: r.x - e.parentElement.getBoundingClientRect().x, y: r.y - e.parentElement.getBoundingClientRect().y, width: r.width, height: r.height };
  })).jsonValue();
}
async function decorativeAnimations(p) {
  // Home can redraw while the browser is registering CSS/pseudo-element motion.
  // Re-resolve the connected decoration each frame; never retain a replaced node.
  return (await p.waitForFunction(() => {
    const art = document.querySelector('.home-avatar-art');
    if (!art?.isConnected) return null;
    const animations = art.getAnimations({ subtree: true });
    const names = animations.filter(a => a.playState === 'running' && !a.pending).map(a => a.animationName);
    return names.includes('home-b4-orbit') && names.includes('home-b4-glow') ? names : null;
  }, null, { polling: 'raf', timeout: 15000 })).jsonValue();
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const fixture = require('./fixtures/home-browser')(browser);
    for (const width of [1440, 1280, 375, 320]) for (const theme of ['light', 'dark']) {
      const f = await fixture(), p = f.page;
      await p.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
      if (baseline) {
        for (const file of ['home-foundation.css', 'home-foundation.js']) await p.route('**/' + file, r => r.fulfill({
          contentType: file.endsWith('css') ? 'text/css' : 'application/javascript',
          body: fs.readFileSync(path.resolve('work/bw36-22b4/baseline.' + file.split('.').pop()))
        }));
        // Both baseline files are applied on a fresh navigation, not hot-swapped.
        await p.reload();
        await p.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating);
        await p.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setSidebarCollapsed(false); setActiveView('home'); });
      }
      await p.setViewportSize({ width, height: width >= 1280 ? 900 : 812 });
      await p.evaluate(theme => { document.documentElement.dataset.theme = theme; localStorage.setItem('funklix-theme', theme); }, theme);
      await p.route('**/fixture-avatar.png', r => r.fulfill({contentType:'image/png', body:fs.readFileSync(path.join(__dirname,'fixtures/brand-avatar-original.png'))}));
      f.r.db.brands[0].brand_core.brandDNA = { userApproved:true, avatar:{userApproved:true,imageUrl:'/fixture-avatar.png'} };
      await p.evaluate(() => { canonicalBrandReader.retire(); window.dispatchEvent(new CustomEvent('funklix:canonical-brand-saved')); clearAutosaveTimer(); });
      await p.waitForFunction(() => document.querySelector('[data-avatar-state=ready] img')?.complete && document.querySelector('[data-home-module=brand] dl'));
      // Finish pre-existing shell resize transitions before measuring Living motion.
      await p.waitForTimeout(400);
      let image = await imageSnapshot(p);
      assert.deepEqual([image.src,image.w,image.h,image.fit,image.transform,image.animation,image.filter,image.opacity], ['/fixture-avatar.png',360,240,'contain','none','none','none','1']);
      if (!baseline) {
        // Check live motion before screenshots temporarily cancel/restart infinite
        // animations. Keep the required orbit/glow assertion on every viewport.
        const animations = await decorativeAnimations(p);
        assert(animations.includes('home-b4-orbit') && animations.includes('home-b4-glow'));
      }
      const prefix = `${baseline?'before':'after'}-${width}-${theme}`;
      await p.screenshot({path:path.join(out,prefix+'.png'),animations:'disabled'});
      for (let attempt=0; ; attempt++) {
        try { await p.locator('.home-avatar-stage').screenshot({path:path.join(out,prefix+'-stage.png'),animations:'disabled'}); break; }
        catch (error) { if (attempt===2 || !/not attached/.test(error.message)) throw error; }
      }
      image = await imageSnapshot(p);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const geometry = await p.locator('.home-living').evaluate(e => {
        const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};
      });
      if (!baseline) {
        const initialRequests=f.requests.length;
        const initialText=await p.locator('#home-avatar-message').textContent();
        assert.equal(await p.locator('#home-avatar-message').getAttribute('data-manual-change'), null);
        await p.waitForTimeout(260);
        assert.equal(await p.locator('#home-avatar-message').textContent(),initialText, 'No automatic message change');
        assert.deepEqual(await imageSnapshot(p),image, 'Decorative motion cannot move or transform image');
        await p.getByRole('button',{name:'Next message',exact:true}).press('Enter');
        await p.waitForFunction(() => document.activeElement?.id === 'home-avatar-message');
        assert.notEqual(await p.locator('#home-avatar-message').textContent(),initialText);
        const transition=await p.locator('#home-avatar-message').evaluate(e=>({name:getComputedStyle(e).animationName,opacity:+getComputedStyle(e).opacity}));
        assert.equal(transition.name,'home-b4-message'); assert(transition.opacity>=.94);
        await p.getByRole('button',{name:'Previous message',exact:true}).press('Enter');
        assert.equal(await p.locator('#home-avatar-message').textContent(),initialText);
        await p.waitForTimeout(250);
        for (const control of await p.locator(actions).all()) {
          await control.scrollIntoViewIfNeeded();
          const box=await control.boundingBox();
          await control.hover(); await p.waitForTimeout(200);
          const hover=await control.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,transform:getComputedStyle(e).transform}));
          assert.equal(hover.transform,'none'); assert.deepEqual(await control.boundingBox(),box);
          await control.evaluate(e => e.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); }, {capture:true,once:true}));
          await p.mouse.down();
          await p.waitForTimeout(200);
          const pressed=await control.evaluate(e=>getComputedStyle(e).boxShadow);
          await p.mouse.up(); // Cancel this isolated state probe; B1/B2/B3 cover real destinations.
          assert.notEqual(pressed,hover.shadow);
          if (await p.locator('.home-living').count()===0) throw Error('State probe must not navigate');
          await control.focus(); await control.press('Tab'); await p.keyboard.press('Shift+Tab');
          const focus=await control.evaluate(e=>({visible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));
          assert(focus.visible && focus.outline==='solid' && focus.width==='3px');
          await p.screenshot({path:path.join(out,prefix+'-focus-'+(await control.getAttribute('data-home-action'))+'.png'),animations:'disabled'});
          await control.evaluate(e=>e.disabled=true);
          assert.equal(await control.evaluate(e=>getComputedStyle(e).opacity),'.55'.replace(/^\./,'0.'));
          await control.evaluate(e=>e.disabled=false);
        }
        await p.emulateMedia({reducedMotion:'reduce'});
        assert.equal(await p.locator('.home-living').evaluate(e=>e.getAnimations({subtree:true}).length),0);
        await p.getByRole('button',{name:'Next message',exact:true}).press('Enter');
        assert.equal(await p.locator('#home-avatar-message').evaluate(e=>getComputedStyle(e).animationName),'none');
        assert.equal(await p.locator('.home-avatar-art').evaluate(e=>getComputedStyle(e,'::before').animationName),'none');
        assert.equal(f.requests.length,initialRequests,'Motion and manual messages add no API calls');
        assert.equal(f.writes.length,0);
        await p.emulateMedia({forcedColors:'active'});
        const primary=p.locator(actions).first(); await primary.focus();
        assert.equal(await primary.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
      }
      measures.push({width,theme,geometry,image});
      await f.close();
      console.log('PASS '+prefix+' original image, responsive layout'+(baseline?'':' / manual-only speech / states / reduced motion / zero requests'));
    }
    fs.writeFileSync(path.join(out,(baseline?'before':'after')+'-geometry.json'),JSON.stringify(measures,null,2)+'\n');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
