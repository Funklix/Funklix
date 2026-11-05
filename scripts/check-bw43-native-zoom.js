#!/usr/bin/env node
'use strict';
// Real Chromium browser zoom, configured through its own local Settings API.
// This changes a disposable browser profile only; no product code or settings.
const assert = require('node:assert/strict'), fs = require('node:fs');
const {chromium} = require('playwright-core');
(async()=>{
  fs.mkdirSync('work/bw43/screenshots',{recursive:true});
  const profile=fs.mkdtempSync('work/bw43/zoom-profile-');
  let context;
  try {
    context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',viewport:null,args:['--no-sandbox','--window-size=1440,1100']});
    const settings=await context.newPage();await settings.goto('chrome://settings/appearance');
    await settings.evaluate(()=>chrome.settingsPrivate.setDefaultZoom(2));await settings.close();
    const f=await require('./fixtures/home-browser')({newPage:()=>context.newPage()})({prepare(r){r.db.boards[0].name='Northstar Launch';}});
    const p=f.page;
    await p.evaluate(()=>{document.documentElement.dataset.theme='light';setSidebarCollapsed(true);setActiveView('insights');});
    const geometry=await p.evaluate(()=>({cssWidth:innerWidth,outerWidth,devicePixelRatio,visualScale:visualViewport.scale}));
    assert.equal(geometry.devicePixelRatio,2,'Native browser zoom changes DPR');
    assert.equal(geometry.cssWidth*2,geometry.outerWidth,'200% browser zoom halves actual CSS viewport');
    assert.equal(geometry.visualScale,1,'Native browser zoom, not pinch zoom');
    for(const selector of ['#insights-view','.insights-boundary','.insights-campaign-journey','.insights-diagnostics'])assert(await p.locator(selector).evaluate(n=>n.scrollWidth<=n.clientWidth+1),selector+' at native 200%');
    await p.locator('.insights-calculation summary').first().focus();await p.keyboard.press('Enter');
    assert.equal(await p.locator('.insights-calculation[open]').count(),1);
    await p.keyboard.press('Enter');
    await p.locator('.insights-methodology summary').focus();
    assert(await p.locator('.insights-methodology summary').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Last disclosure remains unobstructed at native 200%');
    await p.evaluate(()=>{document.activeElement?.blur();el.insightsView.scrollTop=0;});
    await p.screenshot({path:'work/bw43/screenshots/insights-native-200-percent.png'});
    await f.close();
    fs.writeFileSync('work/bw43/native-zoom-results.json',JSON.stringify({result:'PASS',...geometry},null,2));
    console.log('PASS BW-43 native Chromium 200% zoom: '+JSON.stringify(geometry));
  } finally {if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
