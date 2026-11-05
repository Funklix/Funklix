#!/usr/bin/env node
'use strict';
// Actual app boot, deterministic production calculations/rendering and existing actions.
// All transport is intercepted by the provider-free fixture; only fictional Canvas data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const out = 'work/bw43/screenshots';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  fs.mkdirSync(out,{recursive:true});
  const results = [];
  let diagnosticPage=null, diagnosticCase="initial";
  try {
    const f = await require('./fixtures/home-browser')(browser)({prepare(r){r.db.boards[0].name='Northstar Launch';}});
    const p = f.page;diagnosticPage=p;
    const original = await p.evaluate(()=>JSON.parse(JSON.stringify(state.nodes)));
    const nodes = await p.evaluate(()=>Array.from({length:13},(_,i)=>({...JSON.parse(JSON.stringify(state.nodes[0])),id:'fictional-'+i,
      type:i===0?'Social Media Posting':i===1?'Landing Page':i===2?'Content':'Idea',
      title:['Introduce Northstar','Campaign destination','Product story'][i]||'Campaign idea '+i,
      content:'Fictional campaign content',audience:'Independent teams',tone:'Clear',
      social:{platform:'LinkedIn',preview:i===0?'Explore the story':'',caption:'Fictional product introduction',hashtags:[]},
      landingPage:{cta:i===1?'Meet Northstar':'',trust:i===1?'Fictional product evidence':''}})));
    const apply = async (value, dirty=false) => p.evaluate(({value,dirty})=>{
      clearAutosaveTimer();state.nodes=JSON.parse(JSON.stringify(value));state.edges=[];
      state.currentBoardName='Northstar Launch';state.isDirty=dirty;
      refreshLastSavedSnapshot();renderCampaignIntelligence();clearAutosaveTimer();
    },{value,dirty});
    const retained = () => p.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,core:state.brandCore,
      saved:state.lastSavedSnapshot,dirty:state.isDirty,board:state.currentBoardId,association:state.boardBrandAssociation,revision:state.lastKnownUpdatedAt}));
    const shot = async name => p.screenshot({path:`${out}/${name}.png`});
    await p.evaluate(()=>{setActiveView('insights');setSidebarCollapsed(true);});
    await apply(nodes);
    const before=await retained();
    const a=await p.evaluate(()=>state.insightsDiagnosticSnapshot.analysis);
    assert.equal(a.healthScore,90);assert.equal(a.funnel.confidence,60);
    assert.deepEqual(a.funnel.missingStages,['Consideration','Retention']);
    assert.equal(await p.locator('.insights-readiness-ring strong').textContent(),'90');
    assert.equal(await p.locator('.insights-readiness-ring').getAttribute('aria-label'),'Campaign readiness: 90/100, Strong');
    assert.equal(await p.locator('.insights-quality-label').textContent(),'Strong');
    assert.deepEqual((await p.locator('.insights-score').allTextContents()).map(s=>Number(s.split('/')[0])),[90,60,90,90,80,100]);
    assert.equal(await p.locator('.insights-diagnostic-group').count(),4);
    assert.equal(await p.locator('.insights-calculation').count(),6);
    assert.equal(await p.locator('.insights-campaign-journey > li.is-covered').count(),3);
    assert.equal(await p.locator('.insights-campaign-journey > li.is-missing').count(),2);
    assert((await p.locator('.insights-journey-summary').innerText()).includes('3 stages covered · 2 stages missing'));
    assert.equal(await p.locator('.insights-attention-list button').first().textContent(),'Funnel-stage gaps remain');
    assert.equal(await p.locator('.insights-channel-row').first().innerText(),'LinkedIn · 1');
    assert.equal(await p.locator('.insights-diagnostic-bar[aria-hidden="true"]').count(),6);
    assert.equal(await p.locator('.insights-stage-symbol[aria-hidden="true"]').count(),5);
    // Status classes match original thresholds, including trust's qualitative Good foundation.
    assert.equal(await p.locator('.insights-diagnostic-row.status-good-foundation').count(),1);
    for(const summary of await p.locator('.insights-calculation summary').all()) {
      await summary.focus();await p.keyboard.press('Enter');
      assert(await summary.evaluate(n=>n.parentElement.open));
      assert(await summary.evaluate(n=>getComputedStyle(n).outlineStyle!=='none'));
      assert(await summary.locator('..').locator('p').first().isVisible());
      assert((await summary.locator('..').innerText()).includes('Scope: Current Board · Method:'));
      await p.keyboard.press('Enter');
    }
    await p.evaluate(()=>document.activeElement?.blur());
    await p.setViewportSize({width:1440,height:1100});
    await p.evaluate(()=>{document.documentElement.dataset.theme='light';el.insightsView.scrollTop=0;});
    await shot('insights-light-desktop');
    await p.locator('.insights-journey-section').screenshot({path:`${out}/journey-light.png`});
    await p.locator('.insights-diagnostics').screenshot({path:`${out}/diagnostics-compact.png`});
    await p.locator('.insights-calculation summary').first().click();
    await p.locator('.insights-diagnostics').screenshot({path:`${out}/diagnostics-expanded.png`});
    await p.locator('.insights-calculation summary').first().click();
    await p.locator('.insights-disclosure-section').first().scrollIntoViewIfNeeded();
    await shot('measured-performance-empty');
    await p.locator('.insights-methodology summary').click();
    assert.equal(await p.locator('.insights-classifications dt').count(),6);
    assert.equal(await p.locator('.insights-method-list li').count(),7);
    assert((await p.locator('.insights-methodology').innerText()).includes('They do not measure audience response'));
    await p.locator('.insights-methodology').screenshot({path:`${out}/methodology-expanded.png`});
    await p.locator('.insights-methodology summary').click();
    for(const theme of ['light','dark']) for(const language of ['en','de']) for(const collapsed of [false,true]) for(const width of [1672,1440,1150,768,375,320]) {
      diagnosticCase={theme,language,collapsed,width};
      await p.setViewportSize({width,height:1100});
      await p.evaluate(({theme,language,collapsed})=>{
        document.documentElement.dataset.theme=theme;
        state.uiLanguage=window.FunklixLanguage.setUiLanguage(language);translateInterface();
        setSidebarCollapsed(collapsed);renderInsightsSurface();el.insightsView.scrollTop=0;
      },{theme,language,collapsed});
      await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      // Measure final layout, not an intermediate frame of the existing 180ms shell transition.
      await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.target?.matches?.('.app-shell,#left-sidebar')).map(a=>a.finished.catch(()=>{}))));
      for(const selector of ['#insights-view','.insights-boundary','.insights-executive-panel','.insights-campaign-journey','.insights-diagnostics']) {
        assert(await p.locator(selector).evaluate(n=>n.scrollWidth<=n.clientWidth+1),`${selector} overflow: ${theme}/${language}/${collapsed}/${width}`);
      }
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document overflow');
      if(width>=1440)assert(await p.locator('#insights-view').evaluate((n,collapsed)=>n.clientWidth>innerWidth-(collapsed?100:300),collapsed),'Desktop fills available workspace');
      assert.equal(await p.locator('.insights-readiness-ring strong').textContent(),'90');
      assert.equal(await p.locator('.insights-campaign-journey > li').count(),5);
      assert.equal(await p.locator('.insights-campaign-journey > li').first().getAttribute('aria-label'),language==='de'?'Bekanntheit: Abgedeckt':'Awareness: Covered');
      assert.equal(await p.locator('.insights-refresh').textContent(),language==='de'?'Erkenntnisse aktualisieren':'Refresh insights');
      if(language==='en'&&collapsed&&(([1672,1440].includes(width))||theme==='light'&&[768,375,320].includes(width))) await shot(`insights-${theme}-${width}`);
      if(language==='de'&&theme==='dark'&&collapsed&&width===375) await shot('insights-dark-de-375');
      await p.locator('.insights-methodology summary').focus();
      assert(await p.locator('.insights-methodology summary').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Last disclosure remains clear of navigation');
      await p.evaluate(()=>document.activeElement?.blur());
      results.push({theme,language,collapsed,width});
    }
    assert.equal(await retained(),before,'Layout/localization never changes Canvas or saved provenance');
    await p.setViewportSize({width:720,height:450});
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.evaluate(()=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage('en');translateInterface();document.documentElement.dataset.theme='light';renderInsightsSurface();});
    assert(await p.locator('.insights-boundary').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'200% equivalent CSS reflow');
    assert.equal(await p.locator('#insights-view').evaluate(n=>getComputedStyle(n).scrollBehavior),'auto');
    // Existing attention link honors reduced motion without changing finding identity.
    await p.evaluate(()=>{window.bw43Scroll=[];window.bw43NativeScroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){window.bw43Scroll.push({id:this.dataset.findingId,options});};});
    await p.locator('.insights-attention-list button').first().click();
    assert.deepEqual(await p.evaluate(()=>window.bw43Scroll.at(-1)),{id:'FUNNEL_STAGE_GAPS',options:{behavior:'auto',block:'center'}});
    await p.evaluate(()=>{Element.prototype.scrollIntoView=window.bw43NativeScroll;el.insightsView.scrollTop=0;});
    await shot('insights-200-percent-equivalent');
    const oldTime=await p.evaluate(()=>state.insightsDiagnosticSnapshot.analyzedAt);
    await p.locator('.insights-refresh').click();
    assert(Date.parse(await p.evaluate(()=>state.insightsDiagnosticSnapshot.analyzedAt))>=Date.parse(oldTime));
    assert.equal(await retained(),before,'Refresh is deterministic/read-only');
    await p.locator('.insights-finding button').filter({hasText:'Ask AI Brain'}).first().click();
    assert.equal(await p.evaluate(()=>state.activeView),'ai_brain');
    const handoff=await p.locator('#ai-brain-question').inputValue();
    for(const text of ['Funnel-stage gaps remain','Consideration','Retention','Current saved Canvas','Analysis time:']) assert(handoff.includes(text));
    assert.equal(await p.evaluate(()=>state.aiBrain.messages.length),0,'Handoff does not submit a prompt');
    await p.evaluate(()=>{setActiveView('insights');});
    const multiple=nodes.map((n,i)=>i<3?{...n,type:'Social Media Posting',social:{...n.social,platform:['LinkedIn','Instagram','YouTube'][i],preview:'Next step '+i}}:n);
    await apply(multiple);await p.setViewportSize({width:1440,height:1100});
    assert.deepEqual(await p.locator('.insights-channel-row').allTextContents(),['LinkedIn · 1','Instagram · 1','YouTube · 1']);
    await p.locator('.insights-overview').screenshot({path:`${out}/multiple-channels.png`});
    await apply(nodes.map(n=>n.type==='Social Media Posting'?{...n,type:'Idea'}:n));
    assert.equal(await p.locator('.insights-channel-row').count(),0);
    assert(await p.locator('.insights-channel-empty').isVisible());
    const healthy=nodes.map((n,i)=>({...n,funnelStage:['Awareness','Interest','Consideration','Conversion','Retention'][i%5]}));
    await apply(healthy);
    assert.equal(await p.locator('.insights-finding').count(),0);
    assert((await p.locator('.insights-opportunities').innerText()).includes('No current findings'));
    await p.locator('.insights-opportunities').screenshot({path:`${out}/no-opportunities.png`});
    await apply(original);
    const findings=await p.evaluate(()=>state.insightsDiagnosticSnapshot.findings);
    assert(findings.length>1);
    assert.deepEqual(await p.locator('.insights-finding').evaluateAll(ns=>ns.map(n=>n.dataset.findingId)),findings.map(f=>f.code),'Every ranked opportunity remains in source order');
    assert.equal(await p.locator('.insights-finding button').filter({hasText:'Ask AI Brain'}).count(),findings.length);
    await p.locator('.insights-opportunities').screenshot({path:`${out}/multiple-opportunities.png`});
    assert(await p.locator('[data-finding-id="CTA_MISSING"] .insights-source-fields').count());
    assert((await p.locator('[data-finding-id="CTA_MISSING"]').innerText()).includes('CTA field is blank'));
    assert.equal(await p.locator('[data-finding-id="FUNNEL_STAGE_GAPS"] .insights-node-reference').count(),0);
    assert.equal(await p.locator('.insights-verification').count(),findings.length);
    // The original bounded preview remains compact, with every further source reachable.
    const sources=original.map((node,i)=>({...node,audience:i%2?'Fictional visitors':'Fictional members'}));
    await apply(sources);
    const audience=p.locator('[data-finding-id="ICP_VARIATION"]');
    assert.equal(await audience.locator('[data-insights-node-id]').count(),sources.length);
    await audience.locator('.insights-more-sources summary').click();
    assert(await audience.locator('[data-insights-node-id]').last().isVisible());
    await p.evaluate(()=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage('de');renderInsightsSurface();});
    assert((await p.locator('[data-finding-id="ICP_VARIATION"] .insights-observation').textContent()).includes('Audience-Bezeichnungen'));
    const firstSourceId=await p.locator('[data-finding-id="ICP_VARIATION"] [data-insights-node-id]').first().getAttribute('data-insights-node-id');
    assert((await p.locator('[data-finding-id="ICP_VARIATION"] .insights-source-fields').first().textContent()).includes(sources.find(node=>node.id===firstSourceId).audience),'Authored values remain unchanged in DE');
    await p.evaluate(()=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage('en');});
    await apply(original);
    diagnosticCase='Canvas finding handoff';
    const target=findings.find(f=>f.affectedNodeIds.length);
    await p.locator(`[data-finding-id="${target.code}"] button`).filter({hasText:'Show on Canvas'}).click();
    await p.waitForFunction(ids=>state.activeView==='board'&&ids.includes(state.selectedPrimary),target.affectedNodeIds);
    assert.equal(await p.evaluate(()=>state.activeView),'board');
    assert(target.affectedNodeIds.includes(await p.evaluate(()=>state.selectedPrimary)));
    await p.evaluate(()=>{setActiveView('insights');});
    await apply(nodes,true);
    assert((await p.locator('.insights-context').innerText()).includes('Includes unsaved Canvas changes'));
    // Unavailable, stale, loading and permission states display no progress results.
    await apply(nodes);
    const scenarios=[
      ['state.insightsDiagnosticSnapshot=null','could not be calculated'],
      ['state.insightsDiagnosticSnapshot.identity="outgoing-board"','could not be calculated'],
      ['state.insightsDiagnosticSnapshot.analysis.healthScore=NaN','could not be calculated'],
      ['state.boardLoadState="loading"','Board is loading'],
      ['state.boardAccess.canView=false','unavailable for this Board'],
      ['state.currentBoardId=null','No Board is open'],
      ['state.nodes=[]','This Canvas is empty']
    ];
    for(const [change,copy] of scenarios) {
      await p.evaluate(change=>{window.bw43Original={board:state.currentBoardId,access:{...state.boardAccess},load:state.boardLoadState,nodes:state.nodes};(0,eval)(change);renderInsightsSurface();clearAutosaveTimer();},change);
      assert.equal(await p.locator('.insights-readiness-ring').count(),0);
      assert.equal(await p.locator('.insights-stage-symbol').count(),0);
      assert.equal(await p.locator('.insights-diagnostic-bar').count(),0);
      assert((await p.locator('.insights-diagnostic-state').innerText()).includes(copy));
      assert.equal(await p.locator('.insights-methodology summary').count(),1);
      await p.evaluate(()=>{state.currentBoardId=window.bw43Original.board;state.boardAccess=window.bw43Original.access;state.boardLoadState=window.bw43Original.load;state.nodes=window.bw43Original.nodes;renderCampaignIntelligence();clearAutosaveTimer();});
    }
    await p.evaluate(()=>{state.boardAccess.canEdit=false;state.publicBoardToken='fictional-public';renderInsightsSurface();});
    assert.equal(await p.locator('.insights-finding button').filter({hasText:'Ask AI Brain'}).count(),0);
    await p.evaluate(()=>{state.boardAccess.canEdit=true;state.publicBoardToken=null;renderInsightsSurface();});
    assert.equal(await p.getByRole('button',{name:'Connect analytics',exact:true}).count(),0);
    assert.equal(await p.getByRole('button',{name:/^View (all|details)$/}).count(),0);
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);
    fs.writeFileSync('work/bw43/browser-results.json',JSON.stringify({result:'PASS',matrix:results,checks:'production scores, classification, journey, priority, all findings, multi/zero channels, six original methods/explanations, methodology, refresh, Canvas/Brain handoffs, source ownership, unavailable states, authorization, keyboard, reduced motion, equivalent 200% reflow, no new AI/analytics calls or writes',screenshots:fs.readdirSync(out)},null,2));
    await f.close();
    console.log(`PASS BW-43: ${results.length} theme/language/sidebar/viewport cases; original scores, diagnostics, actions and provenance; screenshots in ${out}.`);
  } catch(error) {
    const failure={case:diagnosticCase,message:error.message,stack:error.stack};
    if(diagnosticPage&&!diagnosticPage.isClosed()) {
      failure.geometry=await diagnosticPage.evaluate(()=>({innerWidth,innerHeight,active:document.activeElement?.outerHTML?.slice(0,800),view:el.insightsView?.getBoundingClientRect().toJSON(),last:document.querySelector('.insights-methodology summary')?.getBoundingClientRect().toJSON()})).catch(()=>null);
      await diagnosticPage.screenshot({path:`${out}/failure.png`}).catch(()=>{});
    }
    fs.writeFileSync('work/bw43/failure.json',JSON.stringify(failure,null,2));
    throw error;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
