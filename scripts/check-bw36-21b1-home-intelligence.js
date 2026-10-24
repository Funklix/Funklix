#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { learningSummary, responsibilitySummary } = require('../home-foundation');
const { runtime, W, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '..'), Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defer = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return { promise, resolve }; };
const payload = (id = B, counts = {proposed:73,approved:121}, can_write = true) => ({contract:'brand_learnings_v1',brand:{id,name:'Authorized Brand',revision:'1'},counts,can_write,learnings:[],has_more:true,offset:0});
let passed = 0;
async function check(name, action) { await action(); passed++; console.log('PASS ' + name); }
async function main() {
  await check('aggregate projection: pagination, sparse zero, missing/malformed fields and exact Brand', () => {
    assert.deepEqual(learningSummary({...payload(),learnings:[{status:'rejected',statement:'PRIVATE'}]}, B),{proposed:73,approved:121,canWrite:true});
    assert.deepEqual(learningSummary(payload(B,{}),B),{proposed:0,approved:0,canWrite:true});
    assert.equal(learningSummary({...payload(),counts:undefined},B),null);
    assert.equal(learningSummary(payload(Y),B),null);
    for (const patch of [{contract:'unknown'},{can_write:undefined},{learnings:null},{counts:[]},{brand:null}]) assert.equal(learningSummary({...payload(),...patch},B),null);
    assert.equal(learningSummary(payload(B,{proposed:-1,approved:'4'}),B).proposed,null);
    assert.equal(learningSummary(payload(B,{approved:3}),B).proposed,0);
  });
  await check('real signed Learning route independently enforces identity and Brand roles; Board ownership gives no Learning access',async()=>{
    const {learningRuntime}=require('./fixtures/bw36-17-local-runtime');
    const r=learningRuntime();
    for(const role of ['owner','admin','editor','viewer',null]){
      r.db.role=role;const out=await r.request('GET','/api/brands/'+B+'/learnings?status=all&offset=0');
      assert.equal(out.statusCode,role?200:404);if(role)assert.equal(learningSummary(out.body,B).canWrite,role!=='viewer');else assert.equal(out.body.counts,undefined);
    }
    r.db.role='owner';for(const identity of ['missing','ambiguous','disabled']){r.db.identity=identity;const out=await r.request('GET','/api/brands/'+B+'/learnings');assert.notEqual(out.statusCode,200);assert.equal(out.body.counts,undefined);}
  });
  const browser = await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  async function fixture({viewer=false, hidden=false, noBrand=false, root=false, noWorkspace=false}={}) {
    const r=runtime();r.db.boards[0].name='Autumn Launch';
    r.db.brands[0].name='Canvas Brand X';r.db.brands.push({...clone(r.db.brands[0]),id:Y,name:'Selected Brand Y'});
    r.db.boards[0].canvas_json.nodes = [
      ['mine','Idea','Draft',EMAIL],['other','Content','In Review','teammate@example.test'],['changes','Social Media Posting','Needs Changes',EMAIL.toUpperCase()],
      ['approved','Landing Page','Approved',EMAIL],['published','Email Campaign','Published',EMAIL],['unassigned','Idea','Draft',''],['unsupported','Post-it','Draft',EMAIL]
    ].map(([id,type,status,ownerEmail])=>({id,type,status,ownerEmail,title:'Node '+id,content:'Fixture',position:{x:10,y:10},images:[],tags:[],postits:[],variants:[],reactions:{},social:{platform:'',caption:'',hashtags:[]},landingPage:{}}));
    const c=r.catalog();c.request_id='0123456789abcdef01234567';
    for(const w of c.workspaces){w.avatar_url=null;w.locale='en';for(const x of [...w.brands,...w.boards])delete x.workspace_id;}
    if(noBrand){c.workspaces[0].brands=[];c.workspaces[0].boards[0].brand_id=null;}
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
      if(u.pathname==='/api/boards/'+D){assert.equal(method,'GET','Rendering cannot autosave');const board=clone(r.db.boards[0]);board.access={role:viewer?'viewer':'owner',canView:true,canEdit:!viewer,canViewBoardBrandCore:!viewer,canViewPresence:false};if(hidden){board.brand_id=null;board.brand_visibility='hidden';}return route.fulfill({json:board});}
      if(u.pathname.startsWith('/api/brands')){const out=await r.request(method,u.pathname,q.postDataJSON());return route.fulfill({status:out.statusCode,json:out.body});}
      if(u.pathname.startsWith('/api/'))return route.fulfill({json:{members:[],editors:[],viewers:[],boards:[]}});
      const file=path.join(ROOT,u.pathname==='/'||u.pathname.startsWith('/boards/')?'index.html':u.pathname.slice(1));
      return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/javascript',body:fs.existsSync(file)?fs.readFileSync(file):''});
    });
    await page.goto('http://localhost'+(root||noWorkspace?'/':'/boards/'+D));
    await page.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating&&state.activeView);
    await page.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();setSidebarCollapsed(false);setActiveView('home');});
    f.close=async()=>{assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);await page.close();};
    return f;
  }
  const brand=p=>p.locator('[data-home-module="brand"]'),team=p=>p.locator('[data-home-module="responsibilities"]');
  const action=(p,a)=>p.locator('#home-foundation [data-home-action="'+a+'"]');
  const waitCount=(p,n)=>p.waitForFunction(n=>document.querySelector('[data-home-module="brand"] dd')?.textContent===String(n),n);
  const select=(p,id)=>p.evaluate(id=>selectSessionBrand(id),id);
  const refresh=p=>p.evaluate(()=>window.dispatchEvent(new CustomEvent('funklix:brand-learnings-changed',{detail:{brandId:state.session.brandId}})));
  const snapshot=p=>p.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,dirty:state.isDirty,saved:state.lastSavedSnapshot,association:state.boardBrandAssociation,revision:state.lastKnownUpdatedAt}));
  try {
    await check('selected Brand counts and current Board responsibilities remain separate, bounded and read-only composition',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);const before=await snapshot(p);
      assert.deepEqual(await team(p).locator('dd').allTextContents(),['2','3']);
      assert.deepEqual(await team(p).locator('.home-responsibility-open').allTextContents(),['Node mine','Node other','Node changes']);
      assert(!(await brand(p).innerText()).includes('PRIVATE'));
      await select(p,Y);await waitCount(p,9);assert((await brand(p).innerText()).includes('Selected Brand Y'));
      assert((await team(p).innerText()).includes('Autumn Launch · Canvas Brand X'));assert(!(await team(p).innerText()).includes('Selected Brand Y'));
      assert.equal(await snapshot(p),before);assert(f.reads.every(id=>id===B||id===Y));
      await p.emulateMedia({reducedMotion:'reduce'});await action(p,'responsibility-node').first().click();
      await p.waitForFunction(()=>state.activeView==='board'&&state.selectedPrimary==='mine');
      assert.equal(await snapshot(p),before);await p.evaluate(()=>setActiveView('home'));await waitCount(p,9);
      await action(p,'responsibilities').click();await p.locator('#campaign-responsibilities').waitFor();
      assert.equal(await p.locator('[data-responsibility-node="mine"]').count(),1);await p.locator('#campaign-responsibilities button').first().click();
      await p.waitForFunction(()=>document.activeElement===document.querySelector('#home-foundation [data-home-action="responsibilities"]'));
      assert.equal(await p.evaluate(()=>document.activeElement===document.querySelector('#home-foundation [data-home-action="responsibilities"]')),true,'Return focus to Home origin');
      await f.close();
    });
    await check('empty library, absent aggregate, malformed count and API error distinguish genuine zero',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);
      for(const [body,status,expected] of [[payload(B,{}),200,'No proposals awaiting review.'],[{...payload(),counts:undefined},200,'unavailable'],[payload(B,{proposed:null,approved:5}),200,'Unavailable'],[{},503,'unavailable'],[{},403,'access could not be confirmed']]){
        f.results.set(B,body);f.status=status;await refresh(p);await brand(p).getByText(expected,{exact:false}).first().waitFor();
        if(status!==200||!body.counts)assert.equal(await brand(p).locator('dd').count(),0);
        if(status!==200)assert(!(await brand(p).innerText()).includes('No proposals awaiting review.'));
        assert(await action(p,'boards').first().isEnabled());
      }
      await f.close();
    });
    await check('Brand viewer uses server capability and correct explicit Profile Learnings target; return refreshes without revision bump',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);f.results.set(Y,payload(Y,{proposed:8,approved:3},false));await select(p,Y);await waitCount(p,8);
      assert((await brand(p).innerText()).includes('read-only'));assert.equal(await action(p,'learnings').innerText(),'View Brand Learnings');
      await action(p,'learnings').click();await p.waitForFunction(Y=>state.activeView==='brand-profile'&&canonicalBrandDetail.brandId===Y&&canonicalBrandDetail.status==='ready',Y);
      assert.equal(await p.evaluate(()=>canonicalBrandDetail.initialSection),'Brand Learnings');
      f.results.set(Y,payload(Y,{proposed:0,approved:11},false));await p.evaluate(()=>setActiveView('home'));await waitCount(p,0);
      assert.deepEqual(await brand(p).locator('dd').allTextContents(),['0','11']);await f.close();
    });
    await check('Profile Learnings handoff preserves busy and dirty leave guards, Cancel and explicit Discard',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);await action(p,'learnings').click();
      await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready'&&!brandProfileController.busy());
      await p.locator('[data-profile-key="Overview"]').click();await p.locator('[data-profile-key="Brand description"]').fill('Unsaved Profile changes');
      await p.locator('#home-nav-btn').click();await p.locator('#brand-leave-dialog').waitFor();
      assert.equal(await p.evaluate(()=>state.activeView),'brand-profile');await p.keyboard.press('Escape');
      assert.equal(await p.evaluate(()=>brandProfileController.dirty()),true);
      await p.evaluate(()=>{canonicalBrandDetail.status='submitting';setActiveView('home');});assert.equal(await p.evaluate(()=>state.activeView),'brand-profile');
      await p.evaluate(()=>{canonicalBrandDetail.status='ready';});await p.locator('#home-nav-btn').click();
      await p.getByRole('button',{name:'Discard changes',exact:true}).click();await waitCount(p,73);await f.close();
    });
    for(const change of ['brand','workspace','logout','account'])await check('pending Learning read rejects stale '+change+' result',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);
      const hold={started:defer(),release:defer()};f.holds.push(hold);await refresh(p);await hold.started.promise;
      assert.equal(await brand(p).locator('dd').count(),0);
      if(change==='brand'){await select(p,Y);await waitCount(p,9);}
      else if(change==='workspace'){await p.evaluate(()=>{retireBoardForWorkspaceSwitch();state.workspaceCatalog.activeWorkspaceId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';state.workspaceCatalog.generation++;state.session.brandId=null;renderWorkspaceSidebar();});}
      else await p.evaluate(change=>{state.user=change==='logout'?null:{email:'replacement@example.test'};clearWorkspaceCatalog();refreshDashboardIfVisible();},change);
      hold.release.resolve();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const text=await p.locator('#home-foundation').innerText();assert(!text.includes('73'));assert(!text.includes('121'));
      if(change==='brand')assert((await brand(p).innerText()).includes('Selected Brand Y'));else assert.equal(await p.locator('#home-foundation dd').count(),0);
      await f.close();
    });
    await check('Board-only access, hidden association and no selected Brand never read its Learnings',async()=>{
      const f=await fixture({hidden:true}),p=f.page;await select(p,Y);await waitCount(p,9);
      assert(!f.reads.includes(B));assert(!(await team(p).innerText()).includes('Canvas Brand X'));assert((await team(p).innerText()).includes('No visible Brand association'));await f.close();
      const g=await fixture({noBrand:true});assert.equal(g.reads.length,0);assert((await brand(g.page).innerText()).includes('Select a Brand'));await g.close();
    });
    await check('no Workspace and no Board preserve useful navigation',async()=>{
      const f=await fixture({noWorkspace:true});assert.equal(f.reads.length,0);assert.equal(await f.page.locator('[data-home-module]').count(),0);await f.close();
      const g=await fixture({root:true}),p=g.page;await p.locator('#home-workspace-select').selectOption(W);await team(p).waitFor();assert((await team(p).innerText()).includes('Open a Board'));assert.equal(await team(p).locator('dd').count(),0);await g.close();
    });
    await check('live unsaved, replacement/deletion, completion aliases, ambiguous identity and Board generation guard',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);
      await p.evaluate(()=>{state.nodes=state.nodes.filter(n=>n.id!=='other');state.nodes.find(n=>n.id==='mine').status='done';state.nodes.find(n=>n.id==='changes').ownerEmail='';state.nodes.push({...state.nodes[0],id:'replacement',title:'Unsaved replacement',status:'Draft',ownerEmail:' '+state.user.email.toUpperCase()+' '});state.isDirty=true;refreshDashboardIfVisible();clearAutosaveTimer();});
      assert.deepEqual(await team(p).locator('dd').allTextContents(),['1','1']);assert((await team(p).innerText()).includes('includes unsaved changes'));
      // Direct object replacement is detected by the local presentation observer.
      await p.evaluate(()=>{state.nodes=state.nodes.filter(n=>n.id!=='replacement');});
      await p.waitForFunction(()=>document.querySelector('[data-home-module="responsibilities"] dd')?.textContent==='0');
      await p.evaluate(()=>{state.isBoardHydrating=true;refreshDashboardIfVisible();});assert.equal(await team(p).locator('dd').count(),0);
      await p.evaluate(()=>{state.isBoardHydrating=false;state.boardLoadGeneration++;refreshDashboardIfVisible();});assert.equal(await team(p).locator('dd').count(),0);
      await f.close();
    });
    await check('viewer Board manager remains view-only; revocation removes nodes',async()=>{
      const f=await fixture({viewer:true}),p=f.page;await team(p).locator('dd').first().waitFor();assert((await team(p).innerText()).includes('View-only Board'));
      await action(p,'responsibilities').click();await p.locator('#campaign-responsibilities').waitFor();
      for(const b of await p.locator('#campaign-responsibilities [aria-label^="Assign:"]').all())assert(await b.isDisabled());
      await p.locator('#campaign-responsibilities button').first().click();await p.evaluate(()=>{state.boardAccess.canView=false;refreshDashboardIfVisible();});
      assert.equal(await team(p).locator('dd').count(),0);assert(!(await team(p).innerText()).includes('Node mine'));await f.close();
    });
    await check('lifecycle event and focus resume refresh independently of canonical revision; unrelated Brand event does not',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);const reads=f.reads.length;
      await p.evaluate(Y=>window.dispatchEvent(new CustomEvent('funklix:brand-learnings-changed',{detail:{brandId:Y}})),Y);assert.equal(f.reads.length,reads);
      f.results.set(B,payload(B,{proposed:2,approved:5}));await refresh(p);await waitCount(p,2);
      f.results.set(B,payload(B,{proposed:1,approved:6}));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await waitCount(p,1);await f.close();
    });
    await check('EN/DE, Light/Dark/system, mobile, long names, reduced motion, native keyboard and screenshots',async()=>{
      const f=await fixture(),p=f.page;await waitCount(p,73);await select(p,Y);await waitCount(p,9);
      const dir=process.env.BW36_B1_SCREENSHOTS||path.join(ROOT,'work/bw36-21b1-visuals');fs.mkdirSync(dir,{recursive:true});const geometry=[];
      for(const [width,theme,lang]of[[1440,'light','en'],[1440,'dark','de'],[375,'light','en'],[320,'dark','de'],[768,'system','de']]){
        await p.setViewportSize({width,height:1100});await p.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
        await p.evaluate(({theme,lang})=>{FunklixTheme.setPreference(theme);state.uiLanguage=FunklixLanguage.setUiLanguage(lang);refreshDashboardIfVisible();},{theme,lang});
        assert((await team(p).innerText()).includes(lang==='de'?'Team-Verantwortlichkeiten':'Team Responsibilities'));
        const box=await p.locator('.home-intelligence').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,overflow:[...el.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left<0).map(e=>e.className)}));
        assert(box.scroll<=box.width+1,JSON.stringify(box));assert.deepEqual(box.overflow,[]);geometry.push({viewport:width,theme,lang,...box});
        await brand(p).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.screenshot({path:path.join(dir,`home-${width}-${theme}-${lang}.png`)});
        if(width<800){
          await team(p).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.screenshot({path:path.join(dir,`team-${width}-${theme}-${lang}.png`)});
          await action(p,'responsibilities').click();await p.locator('#campaign-responsibilities').waitFor();await p.locator('#campaign-responsibilities button').first().click();
          await p.locator('#campaign-responsibilities').waitFor({state:'detached'});
          await p.waitForFunction(()=>document.activeElement?.dataset.homeAction==='responsibilities');
        }
      }
      fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify(geometry,null,2));
      await p.evaluate(Y=>{const w=state.workspaceCatalog.value.workspaces[0];w.brands.find(b=>b.id===Y).name='VeryLongBrandName'.repeat(20);state.currentBoardName='LongBoardName'.repeat(30);refreshDashboardIfVisible();},Y);
      assert(await brand(p).evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert(await team(p).evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      // draw() replaces controls and restores their logical focus synchronously.
      // Locator.evaluate resolves an ElementHandle before evaluating it; a timer
      // redraw between those operations can leave that handle detached even
      // while the replacement is focused. Read both in one browser task, without
      // retrying a failed focus assertion or moving focus on the test's behalf.
      const learningFocused=()=>p.evaluate(()=>{
        const current=document.querySelector('#home-foundation [data-home-action="learnings"]');
        return !!current&&document.activeElement===current;
      });
      await action(p,'learnings').focus();assert.equal(await learningFocused(),true);
      const focusRead={started:defer(),release:defer()};f.holds.push(focusRead);
      await refresh(p);await focusRead.started.promise;assert.equal(await learningFocused(),true,'Focus remains on the bounded reauthorization placeholder');
      focusRead.release.resolve();await waitCount(p,9);
      // Deterministically exercise the runtime redraw that exposed the stale
      // handle race. A real loss of focus remains a failure after this redraw.
      await p.evaluate(()=>refreshDashboardIfVisible());
      assert.equal(await learningFocused(),true,'Focus remains on the refreshed Learnings control after replacement');
      await p.keyboard.press('Enter');await p.waitForFunction(()=>state.activeView==='brand-profile');await f.close();
    });
    await check('responsibility summary refuses stale/duplicate identity and matches only actual owner email',()=>{
      const context={account:{email:EMAIL},identity:EMAIL,status:'ready',workspaceId:W,brandId:B,boardId:D,boardGeneration:1,catalog:{workspaces:[{id:W,brands:[],boards:[]}]},openBoard:{name:'Board',canEdit:true},responsibilities:{boardId:D,generation:1,nodes:[{id:'a',assigned:true,ownerEmail:'Alex',complete:false},{id:'b',assigned:true,ownerEmail:EMAIL.toUpperCase(),complete:false},{id:'duplicate',assigned:true},{id:'duplicate',assigned:true}]}};
      assert.equal(responsibilitySummary(context).mine,1);assert.equal(responsibilitySummary(context).items.length,2);
      for(const patch of [{loading:true},{responsibilities:{...context.responsibilities,boardId:Y}},{boardGeneration:2},{account:null},{openBoard:null},{identity:'foreign@test.invalid'}])assert.equal(responsibilitySummary({...context,...patch}),null);
    });
  } finally { await browser.close(); }
  console.log(`BW-36.21B1 PASS ${passed} groups (all I/O mocked, zero production SQL or paid AI)`);
}
main().catch(e=>{console.error(e);if(process.env.GITHUB_ACTIONS==='true')console.error('::error title=Home Intelligence regression::'+String(e.stack||e).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));process.exitCode=1;});
