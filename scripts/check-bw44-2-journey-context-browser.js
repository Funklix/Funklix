#!/usr/bin/env node
'use strict';
// Production app/DOM; fictional persisted nodes; real checked-reference SQL route.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const out = 'work/bw44-2';
fs.mkdirSync(out + '/screenshots', {recursive:true});
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const prepare = r => {
  r.db.boards[0].name = 'Northstar Launch';
  const base = r.db.boards[0].canvas_json.nodes[0];
  r.db.boards[0].canvas_json.nodes = ['Idea','Idea','Social Media Posting','Content','Landing Page'].map((type,i)=>({
    ...base, id:'journey-source-'+i, type, title:i===1?'A long campaign title '+ 'Northstar'.repeat(20):'Northstar introduction',
    goal:i===2?'A long goal '+ 'MeaningfulCustomerConversations'.repeat(12):'Campaign introduction',
    position:{x:180+i*600,y:240},social:{platform:'LinkedIn',caption:'Fictional campaign',hashtags:[],preview:'Explore the story'},
    landingPage:{cta:type==='Landing Page'?'Meet Northstar':'',trust:'Fictional product evidence'}
  }));
};
async function openFixture(browser) {
  const f = await require('./fixtures/home-browser')(browser)({prepare});
  await f.page.evaluate(()=>{setSidebarCollapsed(true);setActiveView('insights');});
  return f;
}
const disclosures = p => p.locator('.insights-stage-context');
const stage = (p,name) => p.locator(`.insights-stage-context[data-stage="${name}"]`);
async function noOverflow(p) {
  for(const selector of ['#insights-view','.insights-boundary','.insights-journey-contexts','.insights-stage-context[open]','.insights-stage-context[open] .insights-node-list','.insights-stage-context[open] .insights-node-list > li']) {
    assert(await p.locator(selector).evaluateAll(ns=>ns.every(n=>n.scrollWidth<=n.clientWidth+1)),selector+' has no overflow');
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
}
(async()=>{
  const browser = await chromium.launch({executablePath,args:['--no-sandbox']});
  const matrix=[];
  try {
    const f=await openFixture(browser), p=f.page;
    const retained=()=>p.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,core:state.brandCore,saved:state.lastSavedSnapshot,dirty:state.isDirty,board:state.currentBoardId,revision:state.lastKnownUpdatedAt}));
    const before=await retained();
    assert.equal(await disclosures(p).count(),5);
    assert.equal(await p.locator('.insights-campaign-journey > li').count(),5);
    assert.equal(await stage(p,'Awareness').locator('button').count(),3);
    assert.equal(await stage(p,'Interest').locator('button').count(),1);
    assert.equal(await stage(p,'Consideration').locator('button').count(),0);
    for(const theme of ['light','dark']) for(const language of ['en','de']) for(const width of [1440,1024,768,375,320]) {
      await p.setViewportSize({width,height:1100});
      await p.evaluate(({theme,language})=>{
        document.documentElement.dataset.theme=theme;
        state.uiLanguage=window.FunklixLanguage.setUiLanguage(language);translateInterface();renderInsightsSurface();
      },{theme,language});
      await stage(p,'Awareness').locator('summary').focus();await p.keyboard.press('Enter');
      assert(await stage(p,'Awareness').evaluate(n=>n.open));
      assert(await stage(p,'Awareness').locator('summary').evaluate(n=>getComputedStyle(n).outlineStyle!=='none'));
      await noOverflow(p);
      assert(await stage(p,'Awareness').locator('.insights-reference-status').evaluateAll(ns=>ns.every(n=>n.getAttribute('role')==='status'&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility==='visible')),'Empty live status regions remain rendered before their first message');
      const rects=await stage(p,'Awareness').locator('.insights-node-list > li').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));
      if(width>=1024) assert.equal(rects[0].y,rects[1].y,'Desktop uses multiple columns');
      if(width<=375) assert(rects[1].y>rects[0].y,'Mobile uses one column');
      assert(await stage(p,'Awareness').evaluate(n=>Math.abs(n.getBoundingClientRect().width-n.parentElement.getBoundingClientRect().width)<2),'Panel spans Journey context width');
      await stage(p,'Interest').locator('summary').click();
      await stage(p,'Consideration').locator('summary').click();
      assert.equal(await p.locator('.insights-stage-context[open]').count(),3,'Independent native disclosures');
      assert(await stage(p,'Interest').locator('button').isVisible());
      assert(await stage(p,'Consideration').locator('p').isVisible());
      await noOverflow(p);
      assert((await stage(p,'Awareness').locator('summary').textContent()).includes(language==='de'?'Bekanntheit':'Awareness'));
      if(language==='en'&&[1440,375,320].includes(width)||language==='de'&&theme==='dark'&&width===375) {
        if(width>=1024) await p.locator('.insights-journey-section').screenshot({path:`${out}/screenshots/journey-${theme}-${language}-${width}.png`});
        else {
          // Capture the actual scroll viewport: an over-tall element screenshot clips inside the app scroller.
          for(const [name,selector] of [['journey','.insights-journey-section'],['context','.insights-stage-context']]) {
            await p.locator(selector).first().evaluate(n=>{el.insightsView.scrollTop+=n.getBoundingClientRect().top-el.insightsView.getBoundingClientRect().top-12;});
            await p.screenshot({path:`${out}/screenshots/${name}-${theme}-${language}-${width}.png`});
          }
        }
      }
      await stage(p,'Awareness').locator('summary').focus();await p.keyboard.press('Space');
      assert.equal(await stage(p,'Awareness').evaluate(n=>n.open),false);
      await p.keyboard.press('Enter');assert(await stage(p,'Awareness').locator('button').first().isVisible());
      matrix.push({theme,language,width});
    }
    assert.equal(await retained(),before,'Presentation never changes Canvas, Brand, saved provenance or dirty state');
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.evaluate(()=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage('en');translateInterface();renderInsightsSurface();});
    await stage(p,'Awareness').locator('summary').click();
    assert.equal(await stage(p,'Awareness').evaluate(n=>getComputedStyle(n).animationName),'none');
    // Every displayed reference (including duplicate titles) resolves its own persisted ID and Inspector.
    const targets=await p.locator('.insights-stage-context button').evaluateAll(ns=>ns.map(n=>({stage:n.closest('details').dataset.stage,id:n.dataset.insightsNodeId})));
    for(const [i,target] of targets.entries()) {
      await p.evaluate(()=>{setActiveView('insights');});
      const detail=stage(p,target.stage);
      await detail.evaluate(n=>{n.open=true;});
      const button=detail.locator(`[data-insights-node-id="${target.id}"]`);
      if(i%2){await button.focus();await p.keyboard.press('Enter');}else await button.click();
      await p.waitForFunction(id=>state.activeView==='board'&&state.selectedPrimary===id&&el.inputs.title.value===state.nodes.find(n=>n.id===id).title,target.id);
      assert.equal(await p.evaluate(()=>state.currentBoardId),f.r.db.boards[0].id);
      assert(await p.locator('#node-title').isVisible(),'Inspector is visible');
    }
    const reset=async()=>{
      await p.evaluate(()=>{setActiveView('insights');renderCampaignIntelligence();});
      await stage(p,'Awareness').evaluate(n=>{n.open=true;});
      return stage(p,'Awareness').locator('button').first();
    };
    for(const status of [403,409,503]) {
      const button=await reset();
      await p.route('**/api/ai-brain/node-reference',route=>route.fulfill({status,json:{error:'unavailable'}}));
      await button.focus();await p.keyboard.press('Enter');
      await p.waitForFunction(()=>Array.from(document.querySelectorAll('.insights-stage-context .insights-reference-status')).some(n=>/unavailable|Try again/.test(n.textContent)));
      assert.equal(await p.evaluate(()=>state.activeView),'insights');assert(await button.isEnabled());
      await p.unroute('**/api/ai-brain/node-reference');
    }
    let release, started;
    const held=new Promise(r=>{release=r;}),pending=new Promise(r=>{started=r;});
    await p.route('**/api/ai-brain/node-reference',async route=>{started();await held;await route.fallback();});
    const button=await reset();await button.click();await pending;
    assert(await button.isDisabled());assert((await stage(p,'Awareness').innerText()).includes('Checking Canvas reference'));
    await p.evaluate(()=>{state.nodes[0].title+=' changed';});release();
    await p.waitForFunction(()=>Array.from(document.querySelectorAll('.insights-stage-context .insights-reference-status')).some(n=>/unavailable/.test(n.textContent)));
    assert.equal(await p.evaluate(()=>state.activeView),'insights');
    await p.unroute('**/api/ai-brain/node-reference');
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);
    await f.close();
    fs.writeFileSync(`${out}/results.json`,JSON.stringify({result:'PASS',matrix,exactIdReferences:targets,checks:'native multiple disclosures, keyboard, one/many/no nodes, long titles/goals, EN/DE, reduced motion, read-only, SQL exact-ID Canvas and Inspector navigation, pending/403/409/503/stale reference'},null,2));
  } finally {await browser.close();}
  // Actual browser 200% zoom, using only a disposable profile.
  const profile=fs.mkdtempSync(`${out}/zoom-profile-`);
  let context;
  try {
    context=await chromium.launchPersistentContext(profile,{executablePath,viewport:null,args:['--no-sandbox','--window-size=1440,1100']});
    const settings=await context.newPage();await settings.goto('chrome://settings/appearance');
    await settings.evaluate(()=>chrome.settingsPrivate.setDefaultZoom(2));await settings.close();
    const f=await openFixture({newPage:()=>context.newPage()}),p=f.page;
    assert.equal(await p.evaluate(()=>devicePixelRatio),2);
    assert(await p.evaluate(()=>innerWidth*2===outerWidth));
    await disclosures(p).evaluateAll(ns=>ns.forEach(n=>{n.open=true;}));await noOverflow(p);
    await p.locator('.insights-stage-context').first().evaluate(n=>{el.insightsView.scrollTop+=n.getBoundingClientRect().top-el.insightsView.getBoundingClientRect().top-12;});
    await p.screenshot({path:`${out}/screenshots/journey-native-200-percent.png`});
    await f.close();
  } finally {if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
  console.log(`PASS BW-44.2: ${matrix.length} responsive theme/language cases, real 200% zoom and exact-ID navigation`);
})().catch(e=>{console.error(e);process.exitCode=1;});
