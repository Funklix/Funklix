#!/usr/bin/env node
'use strict';
// Real root/Board boot, deterministic engine, Home delegation and view adapters.
// Transport is intercepted before navigation: no provider or production access.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { runtime, W, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '..'), Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defer = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; };
const payload = (id = B, counts = {proposed:73,approved:121}) => ({contract:'brand_learnings_v1',brand:{id},counts,can_write:true,learnings:[],has_more:false,offset:0});
let passed = 0;
async function check(name, action) { await action(); passed++; console.log('PASS ' + name); }
async function main() {
  const browser = await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : fs.existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium'} : {}),args:['--no-sandbox']});
  const fixture = require('./fixtures/home-browser')(browser);
  const insights=p=>p.locator('[data-home-module="insights"]'), brain=p=>p.locator('[data-home-module="brain"]');
  const action=(p,a)=>p.locator('#home-foundation [data-home-action="'+a+'"]');
  const refresh=p=>p.evaluate(()=>{refreshDashboardIfVisible();clearAutosaveTimer();});
  const snapshot=p=>p.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,core:state.brandCore,dirty:state.isDirty,saved:state.lastSavedSnapshot,association:state.boardBrandAssociation,revision:state.lastKnownUpdatedAt}));
  const recalculate=p=>p.evaluate(()=>{renderCampaignIntelligence();refreshDashboardIfVisible();clearAutosaveTimer();});
  const pauseAnalysis=p=>p.evaluate(()=>{
    cancelHomeInsightsRequest();window.b2Idle=new Map();window.b2IdleId=0;
    window.requestIdleCallback=fn=>{const id=++window.b2IdleId;window.b2Idle.set(id,fn);return id;};
    window.cancelIdleCallback=id=>window.b2Idle.delete(id);
  });
  const finishAnalysis=p=>p.evaluate(()=>{const work=[...window.b2Idle.values()];window.b2Idle.clear();work.forEach(fn=>fn());});
  try {
    await check('fresh saved Board: real deterministic findings, identifiers, severities, provenance; render makes no writes or AI requests',async()=>{
      const f=await fixture(),p=f.page,before=await snapshot(p);
      const diagnostic=await p.evaluate(()=>({home:homeCampaignInsights(),raw:state.insightsDiagnosticSnapshot,board:state.currentBoardId}));
      assert.equal(diagnostic.board,D);assert.equal(diagnostic.home.status,'ready');assert.equal(diagnostic.home.source,'loaded_saved');
      assert((await insights(p).innerText()).includes('Autumn Launch · Canvas Brand X'));
      assert((await insights(p).innerText()).includes('currently loaded saved Canvas'));
      for(const row of await insights(p).locator('[data-finding-code]').all()){
        const code=await row.getAttribute('data-finding-code'),source=diagnostic.raw.findings.find(x=>x.code===code);
        assert(source);assert.equal(await row.getAttribute('data-severity'),source.severity);
        assert((await row.innerText()).includes(source.title));assert((await row.innerText()).includes(source.description));
      }
      assert.equal(await insights(p).locator('[data-finding-code]').count(),Math.min(3,diagnostic.home.findings.length));
      assert.equal(await brain(p).locator('[data-home-action="brain"]').count(),1);
      assert(!(await insights(p).innerText()).match(/\b\d+\s*(?:%|\/100)\b/));
      await refresh(p);assert.equal(await snapshot(p),before);await f.close();
    });
    await check('Home refreshes missing/stale evidence; failures and pending work never imply all-clear',async()=>{
      const f=await fixture(),p=f.page;
      for(const [change,expected] of [
        ['state.insightsDiagnosticSnapshot=null','Analyzing'],
        ['state.nodes[0].content+=" changed";state.isDirty=true','Analyzing'],
        ['state.insightsDiagnosticSnapshot.identity="foreign-board"','Analyzing'],
        ['state.insightsDiagnosticSnapshot={identity:currentInsightsIdentity(),canvasIdentity:currentInsightsCanvasIdentity(),canvasState:state.isDirty?"live_unsaved":"loaded_saved",analysis:null}','could not be calculated'],
        ['state.insightsDiagnosticSnapshot.analysis={}','could not be calculated'],
        ['state.insightsDiagnosticSnapshot.analyzedAt="invalid"','could not be calculated'],
        ['state.isDirty=true','Analyzing']
      ]){
        await recalculate(p);await pauseAnalysis(p);await p.evaluate(change=>{(0,eval)(change);refreshDashboardIfVisible();clearAutosaveTimer();},change);
        assert((await insights(p).innerText()).includes(expected),change+': '+await insights(p).innerText());
        assert.equal(await insights(p).locator('[data-finding-code]').count(),0);
        assert.equal(await action(p,'insights').count(),1);assert.equal(await action(p,'brain').count(),1);
        if(expected==='Analyzing') {
          await finishAnalysis(p);assert.equal(await p.evaluate(()=>homeCampaignInsights().status),'ready');
          assert((await insights(p).locator('[data-finding-code]').count())>0);
        }
        await p.evaluate(()=>{state.isDirty=false;refreshLastSavedSnapshot();});
      }
      await f.close();
    });
    await check('actual diagnostic exception and malformed snapshot are isolated from other Home modules',async()=>{
      const f=await fixture(),p=f.page;
      await p.evaluate(()=>{state.nodes.find(n=>n.type==='Landing Page').landingPage={};renderCampaignIntelligence();refreshDashboardIfVisible();});
      assert.equal(await p.evaluate(()=>state.insightsDiagnosticSnapshot.analysis),null);
      assert((await insights(p).innerText()).includes('could not be calculated'));assert.equal(await action(p,'brain').count(),1);
      await p.evaluate(()=>{state.nodes.find(n=>n.type==='Landing Page').landingPage.cta='';renderCampaignIntelligence();state.insightsDiagnosticSnapshot.findings=[{code:'TRUST_PROOF_MISSING'}];refreshDashboardIfVisible();});
      assert((await insights(p).innerText()).includes('could not be calculated'));assert.equal(await action(p,'brain').count(),1);
      assert.equal(await p.locator('[data-home-module="responsibilities"]').count(),1);
      // A deterministic diagnostic exception must not prevent Brain navigation.
      await p.evaluate(()=>{state.nodes.find(n=>n.type==='Landing Page').landingPage={};});
      await action(p,'brain').click();assert.equal(await p.evaluate(()=>state.activeView),'ai_brain');
      assert.equal(await p.locator('#ai-brain-question').count(),1);assert.equal(await p.locator('#ai-brain-question').inputValue(),'');
      await f.close();
    });
    await check('pending Board rehydration hides outgoing findings and does not accept the previous generation',async()=>{
      const f=await fixture(),p=f.page;const hold={started:defer(),release:defer()};f.boardHold=hold;
      f.r.db.boards[0].name='Reloaded Board';f.r.db.boards[0].canvas_json.nodes=[];
      await p.evaluate(()=>{window.b2PendingLoad=loadBoardFromUrlIfPresent();});await hold.started.promise;
      await p.evaluate(()=>setActiveView('home'));
      assert.equal(await insights(p).locator('[data-finding-code]').count(),0);assert.equal(await action(p,'brain').count(),0);
      assert((await insights(p).innerText()).includes('Board is loading'));
      hold.release.resolve();await p.evaluate(()=>window.b2PendingLoad);await refresh(p);
      assert((await insights(p).innerText()).includes('Reloaded Board'));assert((await insights(p).innerText()).includes('Canvas is empty'));
      assert.equal(await insights(p).locator('[data-finding-code]').count(),0);await f.close();
    });
    await check('live-unsaved snapshot and every relevant fingerprint edit automatically refreshes on Home',async()=>{
      const f=await fixture(),p=f.page;
      await p.evaluate(()=>{state.isDirty=true;renderCampaignIntelligence();refreshDashboardIfVisible();clearAutosaveTimer();});
      assert((await insights(p).innerText()).includes('includes unsaved changes'));
      assert.equal(await p.evaluate(()=>homeCampaignInsights().source),'live_unsaved');
      for(const field of ['goal','social.cta','landingPage.cta','audience','tone','funnelStage','title']){
        await recalculate(p);await pauseAnalysis(p);const before=await p.evaluate(()=>state.insightsDiagnosticSnapshot.analyzedAt);
        await p.evaluate(field=>{const n=state.nodes.find(n=>n.id==='landing');if(field.includes('.')){const [a,b]=field.split('.');n[a][b]+=' changed';}else n[field]+=' changed';refreshDashboardIfVisible();clearAutosaveTimer();},field);
        assert((await insights(p).innerText()).includes('Analyzing'),field);
        assert.equal(await insights(p).locator('[data-finding-code]').count(),0);
        assert.equal(await p.evaluate(()=>state.insightsDiagnosticSnapshot.analyzedAt),before);
        await finishAnalysis(p);assert.equal(await p.evaluate(()=>homeCampaignInsights().source),'live_unsaved');
        assert.equal(await p.evaluate(()=>isCurrentInsightsSnapshot(state.insightsDiagnosticSnapshot)),true);
      }
      await f.close();
    });
    await check('empty Canvas, no applicable nodes and valid snapshot without findings remain distinct',async()=>{
      const f=await fixture({empty:true}),p=f.page;
      assert((await insights(p).innerText()).includes('Canvas is empty'));assert.equal(await insights(p).locator('li').count(),0);
      await p.evaluate(()=>{state.nodes=[{id:'note',type:'Post-it',title:'Note'}];renderCampaignIntelligence();refreshDashboardIfVisible();});
      assert((await insights(p).innerText()).includes('No applicable structural findings'));
      assert.equal(await insights(p).locator('[data-finding-code]').count(),0);
      // Full real campaign covering all stages, with varied CTAs and trust.
      await p.evaluate(()=>{state.nodes=['Awareness','Interest','Consideration','Conversion','Retention'].map((stage,i)=>({id:'n'+i,type:'Landing Page',funnelStage:stage,audience:'A',tone:'Calm',landingPage:{cta:'CTA '+i,trust:'Evidence'}}));renderCampaignIntelligence();refreshDashboardIfVisible();});
      assert.deepEqual(await p.evaluate(()=>state.insightsDiagnosticSnapshot.findings),[]);
      assert((await insights(p).innerText()).includes('No applicable structural findings'));await f.close();
    });
    await check('global trust and CTA diagnostics without eligible nodes are not presented as affected campaign items',async()=>{
      const f=await fixture(),p=f.page;
      await p.evaluate(()=>{state.nodes=state.nodes.filter(n=>n.type==='Idea');renderCampaignIntelligence();refreshDashboardIfVisible();});
      assert(await p.evaluate(()=>state.insightsDiagnosticSnapshot.findings.some(f=>f.code==='TRUST_PROOF_MISSING')));
      assert.equal(await insights(p).locator('[data-finding-code="TRUST_PROOF_MISSING"]').count(),0);
      assert.equal(await insights(p).locator('[data-finding-code="CTA_VARIATIONS_MISSING"]').count(),0);
      assert.equal(await insights(p).locator('[data-finding-code="FUNNEL_STAGE_GAPS"]').count(),1);
      assert.equal(await action(p,'insight-node').count(),0);await f.close();
    });
    await check('Insights and AI Brain navigation use existing adapters, retain Canvas and focus; no automatic question or provider submission',async()=>{
      const f=await fixture(),p=f.page,before=await snapshot(p);
      await action(p,'insights').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>state.activeView==='insights');
      assert.equal(await p.evaluate(()=>document.activeElement.closest('#insights-view')!==null),true);
      assert.equal(await snapshot(p),before);
      await p.evaluate(()=>setActiveView('home'));await action(p,'brain').focus();await p.keyboard.press('Space');
      await p.waitForFunction(()=>state.activeView==='ai_brain');assert.equal(await p.locator('#ai-brain-question').inputValue(),'');
      assert.equal(await p.locator('#ai-brain-question').evaluate(e=>document.activeElement===e),true);
      assert.deepEqual(await p.evaluate(()=>state.aiBrain.messages),[]);assert.equal(await snapshot(p),before);
      await p.locator('#ai-brain-question').fill('A draft question');await p.evaluate(()=>setActiveView('home'));await action(p,'brain').click();
      assert.equal(await p.locator('#ai-brain-question').inputValue(),'A draft question');assert.deepEqual(await p.evaluate(()=>state.aiBrain.messages),[]);
      assert.equal(await snapshot(p),before);await f.close();
    });
    await check('existing finding-node adapter focuses its exact current target without Canvas mutation or reduced-motion pulse',async()=>{
      const f=await fixture(),p=f.page,before=await snapshot(p);
      await p.emulateMedia({reducedMotion:'reduce'});
      const code=await action(p,'insight-node').first().getAttribute('data-home-id');
      const id=await p.evaluate(code=>homeCampaignInsights().findings.find(f=>f.code===code).nodeId,code);
      await action(p,'insight-node').first().click();await p.waitForFunction(id=>state.activeView==='board'&&state.selectedPrimary===id,id);
      assert.equal(await p.evaluate(()=>document.activeElement===el.inputs.title),true);
      assert.equal(await p.locator('.activity-focus-pulse').count(),0);assert.equal(await snapshot(p),before);await f.close();
    });
    for(const change of ['delete','replace','duplicate','fingerprint','board','generation','permission','hydrating','account','logout','workspace','edit'])await check('stale click rejected before observer refresh: '+change,async()=>{
      const f=await fixture(),p=f.page;
      const result=await p.evaluate(change=>{
        const button=document.querySelector('[data-home-action="'+(change==='edit'?'brain':'insight-node')+'"]');
        const code=button.dataset.homeId, id=homeCampaignInsights()?.findings.find(f=>f.code===code)?.nodeId;
        if(change==='delete')state.nodes=state.nodes.filter(n=>n.id!==id);
        if(change==='replace'){const n=state.nodes.find(n=>n.id===id);n.id='replaced';}
        if(change==='duplicate')state.nodes.push({...state.nodes.find(n=>n.id===id)});
        if(change==='fingerprint')state.nodes[0].content+='modified';
        if(change==='board')state.currentBoardId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        if(change==='generation')state.boardLoadGeneration++;
        if(change==='permission')state.boardAccess.canView=false;
        if(change==='hydrating')state.isBoardHydrating=true;
        if(change==='account')state.user={email:'other@example.test'};
        if(change==='logout')state.user=null;
        if(change==='workspace')state.workspaceCatalog.activeWorkspaceId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        if(change==='edit')state.boardAccess.canEdit=false;
        button.click();clearAutosaveTimer();return {view:state.activeView,selected:state.selectedPrimary};
      },change);
      assert.equal(result.view,'home');assert.equal(result.selected,null);await f.close();
    });
    await check('selected Brand Y never substitutes for current Board X; authorized labels, B1 and mismatch notice preserved',async()=>{
      const f=await fixture(),p=f.page;await p.evaluate(Y=>selectSessionBrand(Y),Y);
      assert((await insights(p).innerText()).includes('Autumn Launch · Canvas Brand X'));
      assert((await brain(p).innerText()).includes('Autumn Launch · Canvas Brand X'));
      for(const module of [insights(p),brain(p)])assert(!(await module.innerText()).includes('Selected Brand Y'));
      assert((await p.locator('[data-home-module="responsibilities"]').innerText()).includes('Canvas Brand X'));
      assert((await p.locator('[data-home-context]').innerText()).includes('Viewing Selected Brand Y'));
      await p.waitForFunction(()=>document.querySelector('[data-home-module="brand"]')?.textContent.includes('Selected Brand Y'));
      assert(f.reads.every(id=>id===B||id===Y));await f.close();
    });
    await check('hidden and absent Brand association stay neutral; Brain remains Board-edit scoped without independent knowledge fetch',async()=>{
      for(const options of [{hidden:true},{noBrand:true}]){
        const f=await fixture(options),p=f.page;
        for(const module of [insights(p),brain(p)]){
          assert(!(await module.innerText()).includes('Canvas Brand X'));
          assert((await module.innerText()).includes(options.hidden?'No visible Brand association':'No Brand connected'),await module.innerText());
        }
        assert.equal(await action(p,'brain').count(),1);assert(!f.reads.includes(B));
        await action(p,'brain').click();assert.equal(await p.evaluate(()=>state.activeView),'ai_brain');await f.close();
      }
    });
    await check('Board viewer, revoked access, no saved Board, hydration and public token have no Brain action',async()=>{
      const viewer=await fixture({viewer:true});assert.equal(await action(viewer.page,'brain').count(),0);
      assert((await brain(viewer.page).innerText()).includes('read-only'));assert.equal(await action(viewer.page,'insights').count(),1);await viewer.close();
      const f=await fixture(),p=f.page;
      for(const change of ['state.isBoardHydrating=true','state.boardAccess.canView=false','state.currentBoardId=null;state.boardBrandAssociation.boardId=null','state.publicBoardToken="public-fixture"']){
        await p.evaluate(change=>{state.isBoardHydrating=false;state.currentBoardId='33333333-3333-4333-8333-333333333333';state.boardAccess.canView=true;state.boardBrandAssociation.boardId=state.currentBoardId;(0,eval)(change);refreshDashboardIfVisible();},change);
        assert.equal(await action(p,'brain').count(),0);assert.equal(await insights(p).locator('[data-finding-code]').count(),0);
      }
      await f.close();
    });
    await check('root Home/no Workspace useful; direct route and reload rehydrate Board; account replacement/logout clear private findings',async()=>{
      const root=await fixture({root:true}),p=root.page;await p.locator('#home-workspace-select').selectOption(W);
      assert((await insights(p).innerText()).includes('Open a Board'));assert.equal(await action(p,'brain').count(),0);await root.close();
      const none=await fixture({noWorkspace:true});assert.equal(await none.page.locator('[data-home-module]').count(),0);await none.close();
      const f=await fixture(),q=f.page;await q.reload();await q.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating&&state.activeView==='board');
      await q.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();setActiveView('home');});
      assert((await insights(q).innerText()).includes('Autumn Launch'));
      for(const account of [{email:'replacement@example.test'},null]){
        await q.evaluate(account=>{state.user=account;refreshDashboardIfVisible();},account);
        assert.equal(await q.locator('[data-home-module]').count(),0);assert(!(await q.locator('#home-foundation').innerText()).includes('Campaign destination'));
      }
      await f.close();
    });
    await check('automatic Home work discards pending Board/account/Workspace/access/hydration/Canvas changes before calculation',async()=>{
      for(const change of [
        'state.currentBoardId="other-board"',
        'state.boardLoadGeneration++',
        'state.user={email:state.user.email}',
        'state.user={email:"other@example.test"}',
        'state.user=null',
        'state.workspaceCatalog.activeWorkspaceId="other-workspace"',
        'state.workspaceCatalog.generation++',
        'state.boardAccess.canView=false',
        'state.boardAccess=null',
        'state.isBoardHydrating=true',
        'state.initialServerLoadInFlight=true',
        'state.nodes[0].content+=" edited while pending"',
        'state.isDirty=true',
        'state.publicBoardToken="public"',
        'state.activeView="board"'
      ]) {
        const f=await fixture(),p=f.page;await pauseAnalysis(p);
        const result=await p.evaluate(change=>{
          const original=analyzeCampaign;window.b2Calculations=0;
          analyzeCampaign=(...args)=>{window.b2Calculations++;return original(...args);};
          state.insightsDiagnosticSnapshot=null;refreshDashboardIfVisible();
          const pending=[...window.b2Idle.values()][0];if(!pending)throw new Error('Missing scheduled work');
          (0,eval)(change);pending();
          return {calls:window.b2Calculations,snapshot:state.insightsDiagnosticSnapshot};
        },change);
        assert.equal(result.calls,0,change);assert.equal(result.snapshot,null,change);await f.close();
      }
    });
    await check('large Canvas: deferred once, exact Insights parity, reused snapshot, bounded render cost, zero mutation/writes/providers',async()=>{
      const f=await fixture(),p=f.page;await pauseAnalysis(p);
      const initial=await p.evaluate(()=>{
        const base=state.nodes.find(n=>n.id==='landing');
        state.nodes=Array.from({length:20000},(_,i)=>({...structuredClone(base),id:'large-'+i}));
        state.isDirty=true;clearAutosaveTimer();state.insightsDiagnosticSnapshot=null;window.b2Calculations=0;
        const original=analyzeCampaign;analyzeCampaign=(...args)=>{window.b2Calculations++;const start=performance.now();const result=original(...args);window.b2EngineMs=performance.now()-start;return result;};
        const start=performance.now();refreshDashboardIfVisible();
        const elapsed=performance.now()-start;
        for(let i=0;i<10;i++)homeCampaignInsights();
        return {status:homeCampaignInsights().status,calls:window.b2Calculations,pending:window.b2Idle.size,elapsed};
      });
      assert.equal(initial.status,'analyzing');assert.equal(initial.calls,0);assert.equal(initial.pending,1);
      assert(initial.elapsed<1000,'Initial Home render should yield before analysis: '+initial.elapsed);
      const before=await snapshot(p);await finishAnalysis(p);
      const result=await p.evaluate(()=>{
        const actual=JSON.stringify(state.insightsDiagnosticSnapshot.findings),stamp=state.insightsDiagnosticSnapshot.analyzedAt;
        const start=performance.now();for(let i=0;i<5;i++)refreshDashboardIfVisible();
        const elapsed=performance.now()-start;
        return {actual,expected:JSON.stringify(buildInsightsFindings(analyzeCampaign(state.nodes,state.edges,state.brandCore))),
          calls:window.b2Calculations,stamp,after:state.insightsDiagnosticSnapshot.analyzedAt,elapsed,engineMs:window.b2EngineMs,pending:window.b2Idle.size};
      });
      assert.equal(result.actual,result.expected);assert.equal(result.calls,2,'One scheduled analysis plus the parity oracle');
      assert.equal(result.stamp,result.after);assert.equal(result.pending,0);assert(result.elapsed<3000);
      assert.equal(await snapshot(p),before);
      console.log('PERF 20,000 nodes '+JSON.stringify({initialMs:initial.elapsed,engineMs:result.engineMs,fiveRendersMs:result.elapsed}));
      await f.close();
    });
    await check('automatic calculation failure is unavailable and deduplicated; Canvas edit recovers; timeout fallback works',async()=>{
      const f=await fixture(),p=f.page;await pauseAnalysis(p);
      await p.evaluate(()=>{
        const original=analyzeCampaign;window.b2Calculations=0;
        analyzeCampaign=(...args)=>{window.b2Calculations++;return original(...args);};
        state.isDirty=true;state.nodes.find(n=>n.id==='landing').landingPage={};state.insightsDiagnosticSnapshot=null;refreshDashboardIfVisible();
      });
      await finishAnalysis(p);
      assert.equal(await p.evaluate(()=>homeCampaignInsights().status),'error');
      assert((await insights(p).innerText()).includes('could not be calculated'));
      await p.evaluate(()=>{for(let i=0;i<10;i++)refreshDashboardIfVisible();});
      assert.equal(await p.evaluate(()=>window.b2Calculations),1);assert.equal(await p.evaluate(()=>window.b2Idle.size),0);
      await p.evaluate(()=>{state.nodes.find(n=>n.id==='landing').landingPage.cta='';window.requestIdleCallback=undefined;refreshDashboardIfVisible();});
      await p.waitForFunction(()=>homeCampaignInsights().status==='ready');
      assert.equal(await p.evaluate(()=>window.b2Calculations),2);assert.equal(await action(p,'insights').count(),1);await f.close();
    });
    await check('pending analyzing state is localized in EN/DE and Light/Dark',async()=>{
      const f=await fixture(),p=f.page;await pauseAnalysis(p);
      for(const [language,theme]of[['en','light'],['de','dark']]) {
        await p.evaluate(({language,theme})=>{state.insightsDiagnosticSnapshot=null;state.uiLanguage=FunklixLanguage.setUiLanguage(language);FunklixTheme.setPreference(theme);refreshDashboardIfVisible();},{language,theme});
        assert((await insights(p).innerText()).includes(language==='de'?'Die aktuelle Canvas-Struktur wird analysiert':'Analyzing the current Canvas structure'));
        assert.equal(await insights(p).locator('[data-finding-code]').count(),0);assert.equal(await action(p,'insights').count(),1);
      }
      await f.close();
    });
    await check('EN/DE, Light/Dark/system, desktop/tablet/mobile, long labels, native keyboard, focus stability and visual evidence',async()=>{
      const f=await fixture(),p=f.page;await p.evaluate(Y=>selectSessionBrand(Y),Y);
      const dir=process.env.BW36_B2_SCREENSHOTS||path.join(ROOT,'work/bw36-21b2-visuals');fs.mkdirSync(dir,{recursive:true});const geometry=[];
      for(const [width,theme,lang]of[[1440,'light','en'],[1440,'dark','de'],[375,'light','en'],[320,'dark','de'],[768,'system','de']]){
        await p.setViewportSize({width,height:1100});await p.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
        await p.evaluate(({theme,lang})=>{FunklixTheme.setPreference(theme);state.uiLanguage=FunklixLanguage.setUiLanguage(lang);refreshDashboardIfVisible();},{theme,lang});
        assert((await insights(p).innerText()).includes(lang==='de'?'Kampagnen-Insights':'Campaign Insights'));
        if(lang==='de')assert((await insights(p).innerText()).includes('Mindestens ein geeigneter Canvas-Node'));
        const box=await p.locator('.home-board-intelligence').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,overflow:[...el.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left<0).map(e=>e.className)}));
        assert(box.scroll<=box.width+1,JSON.stringify(box));assert.deepEqual(box.overflow,[]);geometry.push({viewport:width,theme,lang,...box});
        for(const [label,loc]of[['insights',insights(p)],['brain',brain(p)]]){await loc.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.screenshot({path:path.join(dir,`${label}-${width}-${theme}-${lang}.png`)});}
        assert.equal(await insights(p).getAttribute('aria-labelledby'),'home-insights-title');
      }
      fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify(geometry,null,2));
      await p.evaluate(()=>{state.currentBoardName='LongBoardName'.repeat(30);const w=state.workspaceCatalog.value.workspaces[0];w.brands.find(b=>b.id===state.boardBrandAssociation.brandId).name='LongBrandName'.repeat(30);refreshDashboardIfVisible();});
      for(const module of [insights(p),brain(p)])assert(await module.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      await action(p,'brain').focus();await refresh(p);assert.equal(await action(p,'brain').evaluate(e=>document.activeElement===e),true);
      await p.keyboard.press('Enter');await p.waitForFunction(()=>state.activeView==='ai_brain');await f.close();
    });
  } finally { await browser.close(); }
  console.log(`BW-36.21B2 PASS ${passed} groups (real diagnostics, all transport mocked, zero provider calls/writes)`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
