# Current-source browser evidence recipe

This is a documentation archive of the temporary capture harness, not a product or CI script. Run from repository root at the audit baseline. It reuses B2's existing fixture setup verbatim; the only additions are screenshots, geometry, theme/viewport changes, repeated existing labels for stress, and native Brain activation. No new business data or AI results are created.

To reproduce, save the following fenced code as `work/bw36-22/capture.cjs` (the relative paths assume this location), then run `NODE_PATH=/opt/codex/runtimes/cua/lib/node_modules node work/bw36-22/capture.cjs` in this environment, or use your locally installed `playwright-core` with `CHROMIUM_PATH` if needed. Create `work/bw36-22/` first. Chromium must be allowed to launch. Captures use all-local intercepted transport. The archived `geometry.json` has eleven configurations; the temporary `full-home-light.png` is deliberately not archived because nested scrolling clips it.

```javascript
#!/usr/bin/env node
'use strict';
// Real root/Board boot, deterministic engine, Home delegation and view adapters.
// Transport is intercepted before navigation: no provider or production access.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { runtime, W, B, D, EMAIL, clone } = require('../../scripts/fixtures/bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '../..'), Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defer = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; };
const payload = (id = B, counts = {proposed:73,approved:121}) => ({contract:'brand_learnings_v1',brand:{id},counts,can_write:true,learnings:[],has_more:false,offset:0});
let passed = 0;
async function check(name, action) { await action(); passed++; console.log('PASS ' + name); }
async function main() {
  const browser = await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : fs.existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium'} : {}),args:['--no-sandbox']});
  async function fixture({viewer=false, hidden=false, noBrand=false, root=false, noWorkspace=false, empty=false, analyzed=false}={}) {
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
    if (!root && !noWorkspace && !empty) await page.waitForFunction(()=>homeCampaignInsights()?.status==='ready');
    f.close=async()=>{assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);await page.close();};
    return f;
  }

  const out=path.join(ROOT,'work/bw36-22'); const results=[];
  try {
    const f=await fixture(),p=f.page; await p.evaluate(Y=>selectSessionBrand(Y),Y);
    for(const [width,height,theme,lang,collapsed] of [[1920,1080,'light','en',false],[1440,900,'light','en',false],[1440,900,'dark','de',true],[1280,800,'light','de',false],[1024,768,'dark','en',false],[768,1024,'light','en',false],[768,1024,'system','de',true],[375,812,'light','en',true],[375,812,'dark','de',false],[320,740,'light','en',true],[320,740,'dark','de',false]]) {
      await p.setViewportSize({width,height}); await p.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
      await p.evaluate(({theme,lang,collapsed})=>{FunklixTheme.setPreference(theme); state.uiLanguage=FunklixLanguage.setUiLanguage(lang);setSidebarCollapsed(collapsed);refreshDashboardIfVisible();}, {theme,lang,collapsed});
      await p.waitForTimeout(100);
      await p.locator('.home-hero').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
      const key=`${width}-${theme}-${lang}-${collapsed?'collapsed':'expanded'}`;
      const data=await p.evaluate(()=>{const selectors=['#home-foundation','.home-hero','.home-context','.home-brands','[data-home-context]','[data-home-module="brand"]','[data-home-module="responsibilities"]','[data-home-module="insights"]','[data-home-module="brain"]','.home-continue','.home-board-card'];return {theme:document.documentElement.dataset.theme,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,boxes:Object.fromEntries(selectors.map(s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return [s,{x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height),scrollWidth:e.scrollWidth}]})),focus:document.activeElement?.outerHTML.slice(0,180)};});
      results.push({key,height,...data});await p.screenshot({path:path.join(out,key+'.png')});
      if(width===1440&&theme==='light')await p.locator('#home-foundation').screenshot({path:path.join(out,'full-home-light.png')});
    }
    for(const [width,theme,lang] of [[1440,'light','en'],[375,'dark','de']]) {
      await p.setViewportSize({width,height:900});await p.evaluate(({theme,lang})=>{FunklixTheme.setPreference(theme);state.uiLanguage=FunklixLanguage.setUiLanguage(lang);refreshDashboardIfVisible();},{theme,lang});
      for(const module of ['insights','brain']) {await p.locator('[data-home-module="'+module+'"]').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.screenshot({path:path.join(out,`${module}-${width}-${theme}-${lang}.png`)});}
    }
    await p.setViewportSize({width:1280,height:800});
    await p.evaluate(()=>{document.documentElement.style.zoom='2';setSidebarCollapsed(false);state.currentBoardName=state.currentBoardName.repeat(12);refreshDashboardIfVisible();});
    await p.locator('.home-hero').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    await p.screenshot({path:path.join(out,'zoom-200-long-label.png')});
    console.log('ZOOM',await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,home:document.querySelector('#home-foundation').scrollWidth})));
    await p.evaluate(()=>{document.documentElement.style.zoom='1';});
    await p.setViewportSize({width:1440,height:900});
    const k=p.locator('[data-home-action="brain"]');await k.focus();
    console.log('FOCUS',await k.evaluate(e=>({outline:getComputedStyle(e).outline,minHeight:getComputedStyle(e).minHeight,active:document.activeElement===e})));
    await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>state.activeView),'ai_brain');
    await f.close();
    fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

```
