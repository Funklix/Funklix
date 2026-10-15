'use strict';
// Production Canvas + Advisor in Chromium. All HTTP stays inside this fixture;
// opening/preview never runs analysis or contacts an AI provider.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {runtime,D,EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
async function main(){
 fs.mkdirSync('work/bw36-19r8',{recursive:true});
 const r=runtime(),ROOT=path.resolve(__dirname,'..'),calls=[],writes=[],errors=[];
 r.db.boards[0].canvas_json.nodes=[{id:'learn-node',type:'Idea',title:'Saved idea',content:'Saved source text.',position:{x:60,y:80},tags:[],variants:[],images:[],postits:[],reactions:{},social:{platform:'Instagram',caption:'',hashtags:[],preview:'',scheduledAt:''},landingPage:{},contentFormat:'1:1'}];
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 let hold=null,release=null,deny=false,omit=false;
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'localhost');
   if(url.pathname.endsWith('/learning-advisor')){
    const body=req.method()==='POST'?req.postDataJSON():null;calls.push({url:url.href,body});
    if(hold===(body?'preview':'metadata'))await new Promise(resolve=>release=resolve);
    if(deny)return route.fulfill({status:403,json:{contract:'brand_learning_advisor_v1',error:{code:'BRAND_ACCESS_DENIED'}}});
    assert(!body||body.action==='preview','Entry never starts analysis/adoption');
    const brand=r.catalog().workspaces[0].brands[0];
    return route.fulfill({json:{contract:'brand_learning_advisor_v1',brand:{...brand,revision:'1'},...(body?{threads:[],coverage:{excluded:[]}}:{boards:omit?[]:[{id:D,name:'Saved Canvas Board',updated_at:'now'}]})}});
   }
   if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:{email:EMAIL,name:'Owner'}}});
   if(url.pathname==='/api/workspaces'){
    const catalog=r.catalog();catalog.request_id='0123456789abcdef01234567';catalog.workspaces=catalog.workspaces.map(w=>({...w,avatar_url:null,locale:null,brands:w.brands.map(({workspace_id,...b})=>b),boards:w.boards.map(({workspace_id,...b})=>b)}));return route.fulfill({json:catalog});
   }
   if(url.pathname==='/api/brands')return route.fulfill({json:{brands:r.catalog().workspaces[0].brands.map(b=>({...b,created_at:'now',updated_at:'now'}))}});
   if(url.pathname===`/api/boards/${D}`)return route.fulfill({json:(await r.request('GET',url.pathname)).body});
   if(url.pathname.startsWith('/api/')){if(req.method()!=='GET'&&!/presence|activity/.test(url.pathname))writes.push(url.pathname);return route.fulfill({json:{boards:r.db.boards,members:[],editors:[],nodes:[],presence:[]}});}
   const file=path.resolve(ROOT,url.pathname==='/'||url.pathname.startsWith('/boards/')?'index.html':'.'+url.pathname);
   return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
  });
  await page.goto(`http://localhost/boards/${D}`);
  await page.waitForFunction(()=>state.currentBoardId&&!state.isBoardLoading&&state.workspaceCatalog.status==='ready');
  await page.evaluate(()=>{setAppMode('canvas');setActiveView('board');});
  await page.locator('.node[data-id=learn-node] .type').click();await page.mouse.move(1300,800);
  await page.evaluate(()=>closeInspector({restoreFocus:false}));
  const button=page.getByRole('button',{name:'Learn',exact:true}),dialog=page.locator('[data-learning-advisor]'),status=page.locator('#canvas-learn-status');
  assert.deepEqual(await page.locator('.toolbar-row2-left > button').evaluateAll(es=>es.map(e=>e.id)),['filters-toggle-btn','utilities-toggle-btn','campaign-responsibilities-btn','canvas-compact-view-btn','canvas-learn-btn']);
  await button.focus();
  const initial=await page.evaluate(()=>({board:state.currentBoardId,nodes:JSON.stringify(state.nodes),edges:JSON.stringify(state.edges),dirty:state.isDirty,selection:[...state.selectedIds],primary:state.selectedPrimary,zoom:state.zoom,view:state.activeView,mode:state.appMode,adaptive:adaptiveCanvasView.snapshot()}));
  const position=await page.evaluate(()=>[el.canvas.scrollLeft,el.canvas.scrollTop]);
  const dbBefore=clone(r.db.boards);
  const open=async()=>{await button.click();await page.waitForFunction(()=>document.querySelector('[data-advisor-board]')?.value===state.currentBoardId&&!document.querySelector('[data-advisor-action=analyze]').disabled);};
  const close=async()=>{await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.id),'canvas-learn-btn');};
  await button.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-advisor-board]')?.value===state.currentBoardId&&!document.querySelector('[data-advisor-action=analyze]').disabled);
  assert.equal(await dialog.locator('select').inputValue(),D);assert.equal(calls.length,2);
  const catalog=r.catalog().workspaces[0];assert(calls[0].url.includes('/api/brands/'+catalog.brands[0].id+'/learning-advisor?workspace_id='+catalog.id));
  assert.equal(calls[1].body.scope.board_id,D);assert.equal(calls[1].body.scope.workspace_id,catalog.id);assert.equal(calls[1].body.scope.include_discussions,false);
  await close();assert.deepEqual(await page.evaluate(()=>[el.canvas.scrollLeft,el.canvas.scrollTop]),position);
  // Each unavailable state gives localized guidance without Advisor HTTP.
  for(const language of ['en','de'])for(const scenario of ['unsaved','loading','stale','associationError','unassociated','workspace','viewer','boardOnly','deniedBoard']){
   const before=calls.length;
   await page.evaluate(({scenario,language})=>{
    window.restoreLearn={board:state.currentBoardId,loading:state.isBoardLoading,association:{...state.boardBrandAssociation},catalog:state.workspaceCatalog.value,access:{...state.boardAccess}};state.uiLanguage=language;
    if(scenario==='unsaved')state.currentBoardId=null;
    if(scenario==='loading')state.isBoardLoading=true;
    if(scenario==='stale')state.boardBrandAssociation.boardId='old-board';
    if(scenario==='associationError')state.boardBrandAssociation.status='load-error';
    if(scenario==='unassociated')state.boardBrandAssociation.brandId=null;
    if(scenario==='workspace')state.workspaceCatalog.value={workspaces:[]};
    if(scenario==='viewer'||scenario==='boardOnly')state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:state.workspaceCatalog.value.workspaces.map(w=>({...w,brands:scenario==='boardOnly'?[]:w.brands.map(b=>({...b,role:'viewer'}))}))};
    if(scenario==='deniedBoard')state.boardAccess.canView=false;
   },{scenario,language});
   await button.click();assert(await status.isVisible());assert((await status.textContent()).length>20);assert.equal(calls.length,before);assert.equal(await dialog.count(),0);
   await page.evaluate(()=>{const b=restoreLearn;state.currentBoardId=b.board;state.isBoardLoading=b.loading;state.boardBrandAssociation=b.association;state.workspaceCatalog.value=b.catalog;state.boardAccess=b.access;});
  }
  // Board viewing permission plus Brand editing is allowed; Board edit is not required.
  await page.evaluate(()=>{state.uiLanguage='en';state.boardAccess.canEdit=false;});await open();await close();await page.evaluate(()=>state.boardAccess.canEdit=restoreLearn.access.canEdit);
  deny=true;await button.click();await dialog.getByRole('alert').waitFor();assert(await dialog.locator('[data-advisor-action=analyze]').isDisabled());await close();deny=false;
  omit=true;await button.click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.locator('select').inputValue(),'');assert(await dialog.locator('[data-advisor-action=analyze]').isDisabled());await close();omit=false;
  // Late metadata and preview responses cannot revive a switched account/Board/Brand/Workspace.
  for(const stage of ['metadata','preview'])for(const change of ['account','board','boardReturn','brand','workspace']){
   hold=stage;release=null;await button.click();
   while(!release)await page.waitForTimeout(10);
   const requestCount=calls.length;await page.evaluate(()=>document.getElementById('canvas-learn-btn').click());assert.equal(calls.length,requestCount,'Pending opening ignores duplicate clicks');
   await page.evaluate(change=>{window.raceRestore={user:state.user,board:state.currentBoardId,brand:state.boardBrandAssociation.brandId,workspace:state.workspaceCatalog.activeWorkspaceId};
    if(change==='account')state.user={email:'other@example.test'};
    if(change==='board')state.currentBoardId='other-board';
    if(change==='boardReturn')state.boardLoadGeneration++;
    if(change==='brand')state.boardBrandAssociation.brandId='other';
    if(change==='workspace')state.workspaceCatalog.activeWorkspaceId='other';
   },change);
   await dialog.waitFor({state:'detached'});release();hold=null;
   await page.waitForFunction(()=>!document.getElementById('canvas-learn-btn').hasAttribute('aria-busy'));
   assert.equal(await dialog.count(),0);
   await page.evaluate(()=>{state.user=raceRestore.user;state.currentBoardId=raceRestore.board;state.boardBrandAssociation.brandId=raceRestore.brand;state.workspaceCatalog.activeWorkspaceId=raceRestore.workspace;});
  }
  for(const language of ['en','de'])for(const theme of ['light','dark'])for(const width of [320,375,640,1280]){
   await page.setViewportSize({width,height:900});await page.evaluate(({language,theme})=>{state.uiLanguage=language;document.documentElement.dataset.theme=theme;translateInterface(document);},{language,theme});
   assert.equal(await button.innerText(),'Learn');assert.equal(await button.getAttribute('aria-label'),'Learn');assert.equal(await button.locator('svg[aria-hidden=true]').count(),1);
   await button.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('[data-advisor-board]')?.value===state.currentBoardId&&!document.querySelector('[data-advisor-action=analyze]').disabled);
   assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   if(language==='en'&&((theme==='light'&&width===1280)||(theme==='dark'&&width===375)))await dialog.screenshot({path:`work/bw36-19r8/${theme}-${width}-advisor.png`});
   await close();
   if(language==='en'&&((theme==='light'&&width===1280)||(theme==='dark'&&width===375)))await page.locator('.toolbar-row2-left').screenshot({path:`work/bw36-19r8/${theme}-${width}-toolbar.png`});
   assert(await button.evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height>=44;}));
  }
  const after=await page.evaluate(()=>({board:state.currentBoardId,nodes:JSON.stringify(state.nodes),edges:JSON.stringify(state.edges),dirty:state.isDirty,selection:[...state.selectedIds],primary:state.selectedPrimary,zoom:state.zoom,view:state.activeView,mode:state.appMode,adaptive:adaptiveCanvasView.snapshot()}));
  assert.deepEqual(after,initial);assert.deepEqual(clone(r.db.boards),dbBefore);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('PASS R8 production Canvas/Advisor: exact position, saved Board/Brand/Workspace, keyboard/focus, EN/DE unavailable guidance, viewer/Board-only boundaries, server denial, unavailable source, 10 pending context races, 16 language/theme/reflow combinations, no analysis/Canvas mutations/autosave.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
