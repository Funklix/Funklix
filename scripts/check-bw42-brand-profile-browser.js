'use strict';
// Run the actual application and controllers; only transport/SQL/storage use local fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const {png} = require('./fixtures/bw36-13r5-local-runtime');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  fs.mkdirSync('work/bw42/screenshots',{recursive:true});
  try {
    const f = await require('./fixtures/home-browser')(browser)({empty:true,prepare(r) {
      const b=r.db.brands[0]; b.name='Northstar Studio';
      b.brand_core={...b.brand_core,brandCore:'We help small teams turn thoughtful ideas into useful products.',valueProposition:'Clear strategy and creative work for independent businesses.',brandAssets:{domain:'https://northstar.example',colors:['#7428ef','#17132b'],typography:'System sans serif',references:['Brand guidelines']},toneOfVoice:['Clear','Warm'],messagingPillars:['Build with purpose'],contentGuidelines:['Use concrete examples'],keywords:['Design'],dosAndDonts:{dos:['Be helpful'],donts:['Use jargon']},brandVoiceExamples:{good:'Start with one clear idea.',avoid:'Revolutionary solutions.'},personas:[{name:'Independent teams',note:'Small teams building useful products.'}],brandDNA:{userApproved:true,primaryArchetype:'Creator',secondaryArchetype:'Sage',avatar:{userApproved:true,imageUrl:'/scripts/fixtures/brand-avatar-original.png'}}};
    }});
    const p=f.page, key=k=>p.locator(`[data-profile-key="${k}"]`);
    // Binary delivery is served separately; production logo mutations still use the shared route fixture.
    await p.route('**/api/brands/*/logo?*',r=>r.fulfill({contentType:'image/png',body:png}));
    await p.evaluate(()=>{openRegularBrandProfile();});
    await p.waitForFunction(()=>brandProfileController && canonicalBrandDetail.status==='ready');
    assert.equal(await p.locator('.guided-brand-profile nav button').count(),11);
    const original=await p.evaluate(()=>JSON.stringify(brandProfileController.state.core));
    const states = [];
    for (const theme of ['light','dark']) for (const language of ['en','de']) for (const collapsed of [false,true]) for (const width of [1672,1366,768,375,320]) {
      await p.setViewportSize({width,height:940});
      await p.evaluate(({theme,language,collapsed})=>{document.documentElement.dataset.theme=theme;state.uiLanguage=window.FunklixLanguage.setUiLanguage(language);translateInterface();renderWorkspaceSidebar();setSidebarCollapsed(collapsed);brandProfileController.render();},{theme,language,collapsed});
      await p.emulateMedia({reducedMotion:'reduce'});
      await key('Overview').click();
      assert.equal(await p.locator('[data-section-title]').textContent(),language==='de'?'Überblick':'Overview','Visible locale follows current preference');
      await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      for (const selector of ['.guided-brand-profile','.profile-header','.profile-identity-cards','.profile-actions','.guided-brand-profile nav']) {
        assert(await p.locator(selector).evaluate(n=>n.scrollWidth<=n.clientWidth+1), `${selector} overflow ${theme}/${language}/${collapsed}/${width}`);
      }
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Document overflow ${width}`);
      const close=p.locator('#brand-workspace-detail-close'); await close.scrollIntoViewIfNeeded();
      assert.equal(await p.locator('#brand-workspace-detail > .brand-workspace-detail-header').evaluate(n=>getComputedStyle(n).position),'absolute','Ordinary Profile retains its positioned Close header');
      assert(await close.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Close is unobstructed');
      if(width>=1366) assert(await p.locator('#brand-workspace-detail').evaluate(n=>n.clientWidth>innerWidth-350),'Desktop uses available workspace');
      await key('Brand Assets').click(); assert(await key('brandAssets-typography').isVisible());
      await key('Voice & Messaging').click(); assert(await key('Tone of Voice').isVisible());
      if(theme==='light'&&language==='en'&&!collapsed&&width===1672) {
        await p.screenshot({path:'work/bw42/screenshots/voice-light-desktop.png'});
        await key('Brand Assets').click();await p.screenshot({path:'work/bw42/screenshots/assets-light-desktop.png'});
      }
      await key('Overview').click();
      await key('Advanced options').scrollIntoViewIfNeeded();
      assert(await key('Advanced options').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Management action clear of floating navigation');
      await p.locator('#brand-workspace-detail').evaluate(n=>{n.scrollTop=0;});
      if(language==='en'&&!collapsed&&((width===1672)||theme==='light'&&[768,375,320].includes(width))) {
        await p.locator('#brand-workspace-detail').evaluate(n=>{n.scrollTop=0;});
        await p.screenshot({path:`work/bw42/screenshots/overview-${theme}-${width}.png`});
      }
      if(theme==='light'&&language==='de'&&!collapsed&&width===768) await p.screenshot({path:'work/bw42/screenshots/navigation-de-tablet.png'});
      states.push(`${theme}/${language}/${collapsed}/${width}`);
    }
    assert.equal(await p.evaluate(()=>JSON.stringify(brandProfileController.state.core)),original,'Layout/navigation do not alter fields');
    await p.setViewportSize({width:720,height:450}); // 1440×900 at 200%: equivalent CSS viewport, not native browser zoom.
    await key('Overview').click();
    assert(await p.locator('.guided-brand-profile').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'200% equivalent reflow');
    await p.screenshot({path:'work/bw42/screenshots/overview-200-percent-equivalent.png'});
    await p.keyboard.press('Tab'); await key('Confirm and save Brand Profile').focus();
    assert(await key('Confirm and save Brand Profile').evaluate(n=>getComputedStyle(n).outlineStyle!=='none'),'Visible keyboard focus');
    await p.keyboard.press('Tab');
    await key('Overview').focus();
    assert(await key('Overview').evaluate(n=>getComputedStyle(n).outlineStyle!=='none'),'Active navigation retains keyboard focus');
    await p.setViewportSize({width:1440,height:1000});
    await p.evaluate(()=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage('en');translateInterface();renderWorkspaceSidebar();document.documentElement.dataset.theme='light';setSidebarCollapsed(false);brandProfileController.render();});
    for(const section of ['Brand DNA','Audience','Voice & Messaging','Offers & Proof','Brand Assets','Brand Avatar','Brand Learnings','Team and permissions','Campaign Sync','Review','Overview']) {
      await key(section).focus(); await p.keyboard.press('Enter'); assert(await p.locator('[data-section-title]').isVisible(),section+' reachable');
      assert(await p.locator('[data-section-title]').evaluate(n=>document.activeElement===n),section+' keyboard destination');
    }
    await key('Brand name').fill('Northstar Studio edited'); await key('Brand Assets').click();await key('Overview').click();
    assert.equal(await key('Brand name').inputValue(),'Northstar Studio edited','Edits survive section navigation');
    await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());
    assert.equal(await p.evaluate(()=>brandProfileController.state.dirty),false);
    await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());
    assert.equal(await key('Brand name').inputValue(),'Northstar Studio edited','Save/reload uses production endpoints');
    assert.equal(await key('Campaign Brand Snapshot').count(),1);
    await key('Campaign Brand Snapshot').click(); await p.locator('#brand-core-workspace').waitFor({state:'visible'});
    await p.locator('#campaign-snapshot-open-profile').click(); await p.waitForFunction(()=>brandProfileController && canonicalBrandDetail.status==='ready');
    await key('Advanced options').click(); await p.getByRole('button',{name:'Back to Brand Profile',exact:true}).waitFor({state:'visible'});
    await p.getByRole('button',{name:'Back to Brand Profile',exact:true}).click();
    // Reopening an already mounted Profile retains the legacy title and description while loading.
    await p.locator('#brand-workspace-detail-close').click();
    const brandId=f.r.db.brands[0].id; let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await p.route('**/api/brands/'+brandId,async route=>{await gate;await route.fallback();});
    await p.evaluate(()=>{canonicalBrandReader.retire();void openRegularBrandProfile();});
    try {
      await p.waitForFunction(()=>canonicalBrandDetail.status==='loading');
      assert(await p.locator('#brand-workspace-detail-title').evaluate(n=>n.getBoundingClientRect().width>10&&getComputedStyle(n).clipPath==='none'),'Loading title remains visible');
      assert(await p.locator('#brand-workspace-detail-context').evaluate(n=>n.getBoundingClientRect().height>1),'Loading description remains visible');
      assert(await p.locator('#brand-workspace-detail-close').isVisible());
    } finally {release();}
    await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
    assert.deepEqual(f.errors,[]);
    console.log(`PASS BW-42 actual app: ${states.length} theme/language/sidebar/viewport cases; 11 sections; field retention; save/reload; snapshot; advanced; keyboard; reduced motion; 200% equivalent reflow. Screenshots: work/bw42/screenshots.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
