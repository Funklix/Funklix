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
  async function fixture({viewer=false, hidden=false, noBrand=false, root=false, noWorkspace=false, empty=false, analyzed=true}={}) {
    const r=runtime();r.db.boards[0].name='Autumn Launch';
    r.db.brands[0].name='Canvas Brand X';r.db.brands.push({...clone(r.db.brands[0]),id:Y,name:'Selected Brand Y'});
    r.db.boards[0].canvas_json.nodes = [
      ['mine','Idea','Draft',EMAIL],['other','Content','In Review','teammate@example.test'],['changes','Social Media Posting','Needs Changes',EMAIL.toUpperCase()],
      ['approved','Landing Page','Approved',EMAIL],['published','Email Campaign','Published',EMAIL],['unassigned','Idea','Draft',''],['unsupported','Post-it','Draft',EMAIL]
    ].map(([id,type,status,ownerEmail])=>({id,type,status,ownerEmail,title:'Node '+id,content:'Fixture',position:{x:10,y:10},images:[],tags:[],postits:[],variants:[],reactions:{},social:{platform:'',caption:'',hashtags:[]},landingPage:{cta:'',trust:''}}));
    if(empty)r.db.boards[0].canvas_json.nodes=[];
    r.db.boards[0].canvas_json.nodes.push(...(empty?[]:[{...r.db.boards[0].canvas_json.nodes[0],id:'landing',type:'Landing Page',title:'Campaign destination',landingPage:{cta:'',trust:''},audience:'Audience B'}]));
    const c=r.catalog();c.request_id='0123456789abcdef01234567';
    for(const w of c.workspaces){w.avatar_url=null;w.locale='en';for(const x of [...w.brands,...w.boards])delete x.workspace_id;}
    if(noBrand){r.db.boards[0].brand_id=null;c.workspaces[0].brands=[];c.workspaces[0].boards[0].brand_id=null;}
    if(hidden){c.workspaces[0].brands=c.workspaces[0].brands.filter(b=>b.id!==B);c.workspaces[0].boards[0].brand_id=null;}
    c.workspaces.push({id:W2,name:'Second Workspace',role:'viewer',revision:1,avatar_url:null,locale:'en',brands:[],boards:[]});
    if(noWorkspace)c.workspaces=[];
    const f={r,c,reads:[],writes:[],errors:[],results:new Map([[B,payload()],[Y,payload(Y,{proposed:9,approved:4})]]),status:200,holds:[]};
    const page=await browser.newPage({viewport:{width:1440,height:1100}});f.page=page;page.setDefaultTimeout(15000);
    page.on('pageerror',e=>f.errors.push(e.message));
    await page.route('**/*',async route=>{
      const q=route.request(),u=new URL(q.url()),method=q.method();assert.equal(u.hostname,'localhost','All transport must be local; no providers');
      assert(!(u.pathname.startsWith('/api/') && /\/(?:generate|ai-brain|analytics|learning-advisor)/.test(u.pathname)),'Home must not invoke AI or analytics endpoints: '+u.pathname);
      if(u.pathname.startsWith('/api/')&&method!=='GET'&&!u.pathname.includes('/presence/'))f.writes.push({path:u.pathname,method});
      if(u.pathname==='/api/auth/session')return route.fulfill({json:{user:{email:EMAIL,name:'Alex'}}});
      if(u.pathname==='/api/workspaces')return route.fulfill({json:f.c});
      if(/\/learnings$/.test(u.pathname)){
        assert.equal(method,'GET','Home cannot mutate Learnings');const id=u.pathname.split('/')[3];
        assert.equal(u.search,'?status=all&offset=0','One bounded page, no pagination scan');f.reads.push(id);
        const body=clone(f.results.get(id)),status=f.status,hold=f.holds.shift();
        if(hold){hold.started.resolve();await hold.release.promise;}
        return route.fulfill({status,json:body||{error:{code:'BRAND_UNAVAILABLE'}}}).catch(()=>{});
      }
      if(u.pathname==='/api/boards')return route.fulfill({json:{boards:r.db.boards}});
      if(/\/editors|\/sharing/.test(u.pathname))return route.fulfill({json:{people:[],editors:[]}});
      if(u.pathname==='/api/boards/'+D){if(f.boardHold){const hold=f.boardHold;f.boardHold=null;hold.started.resolve();await hold.release.promise;}assert.equal(method,'GET','Rendering cannot autosave');const board=clone(r.db.boards[0]);board.access={role:viewer?'viewer':'owner',canView:true,canEdit:!viewer,canViewBoardBrandCore:!viewer,canViewPresence:false};if(hidden){board.brand_id=null;board.brand_visibility='hidden';}return route.fulfill({json:board});}
      if(u.pathname.startsWith('/api/brands')){const out=await r.request(method,u.pathname,q.postDataJSON());return route.fulfill({status:out.statusCode,json:out.body});}
      if(u.pathname.startsWith('/api/'))return route.fulfill({json:{members:[],editors:[],viewers:[],boards:[]}});
      const file=path.join(ROOT,u.pathname==='/'||u.pathname.startsWith('/boards/')?'index.html':u.pathname.slice(1));
      return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/javascript',body:fs.existsSync(file)?fs.readFileSync(file):''});
    });
    await page.goto('http://localhost'+(root||noWorkspace?'/':'/boards/'+D));
    await page.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating&&state.activeView);
    await page.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();setSidebarCollapsed(false);setActiveView('home');});
    if(analyzed && !root && !noWorkspace) await page.evaluate(()=>{setActiveView('insights');setActiveView('home');});
    f.close=async()=>{assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);await page.close();};
    return f;
  }
  const insights=p=>p.locator('[data-home-module="insights"]'), brain=p=>p.locator('[data-home-module="brain"]');
  const action=(p,a)=>p.locator('#home-foundation [data-home-action="'+a+'"]');
  const refresh=p=>p.evaluate(()=>{refreshDashboardIfVisible();clearAutosaveTimer();});
  const snapshot=p=>p.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,core:state.brandCore,dirty:state.isDirty,saved:state.lastSavedSnapshot,association:state.boardBrandAssociation,revision:state.lastKnownUpdatedAt}));
  const recalculate=p=>p.evaluate(()=>{renderCampaignIntelligence();refreshDashboardIfVisible();clearAutosaveTimer();});
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
    await check('Home observes snapshot; missing, stale Canvas, stale Board, failure and provenance transitions never imply all-clear',async()=>{
      const f=await fixture(),p=f.page;
      for(const [change,expected] of [
        ['state.insightsDiagnosticSnapshot=null','No diagnostic snapshot'],
        ['state.nodes[0].content+=" changed"','out of date'],
        ['state.insightsDiagnosticSnapshot.identity="foreign-board"','out of date'],
        ['state.insightsDiagnosticSnapshot={identity:currentInsightsIdentity(),analysis:null}','could not be calculated'],
        ['state.insightsDiagnosticSnapshot.analysis={}','could not be calculated'],
        ['state.insightsDiagnosticSnapshot.analyzedAt="invalid"','could not be calculated'],
        ['state.isDirty=true','out of date']
      ]){
        await recalculate(p);await p.evaluate(change=>{(0,eval)(change);refreshDashboardIfVisible();clearAutosaveTimer();},change);
        assert((await insights(p).innerText()).includes(expected),change+': '+await insights(p).innerText());
        assert.equal(await insights(p).locator('[data-finding-code]').count(),0);
        assert.equal(await action(p,'insights').count(),1);assert.equal(await action(p,'brain').count(),1);
        await p.evaluate(()=>{state.isDirty=false;});
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
    await check('live-unsaved snapshot and relevant fingerprint fields; no silent recalculation on Home',async()=>{
      const f=await fixture(),p=f.page;
      await p.evaluate(()=>{state.isDirty=true;renderCampaignIntelligence();refreshDashboardIfVisible();clearAutosaveTimer();});
      assert((await insights(p).innerText()).includes('includes unsaved changes'));
      assert.equal(await p.evaluate(()=>homeCampaignInsights().source),'live_unsaved');
      for(const field of ['goal','social.cta','landingPage.cta','audience','tone','funnelStage','title']){
        await recalculate(p);const before=await p.evaluate(()=>state.insightsDiagnosticSnapshot.analyzedAt);
        await p.evaluate(field=>{const n=state.nodes.find(n=>n.id==='landing');if(field.includes('.')){const [a,b]=field.split('.');n[a][b]+=' changed';}else n[field]+=' changed';refreshDashboardIfVisible();clearAutosaveTimer();},field);
        assert((await insights(p).innerText()).includes('out of date'),field);
        assert.equal(await insights(p).locator('[data-finding-code]').count(),0);
        assert.equal(await p.evaluate(()=>state.insightsDiagnosticSnapshot.analyzedAt),before);
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
