'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {advisorRuntime}=require('./bw36-19-advisor-runtime');
const {B,W,EMAIL,clone}=require('./bw36-13r5-local-runtime');
let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core'));}
const ROOT=path.resolve(__dirname,'../..');
async function browserChecks({canvas,expectedThreads=1,hydrationCanvases=[]}={}){
 const f=advisorRuntime(),{r}=f,base=r.base,errors=[],traffic=[];
 if(canvas)f.board.canvas_json=clone(canvas);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'localhost','No real network');traffic.push({path:url.pathname,method:req.method(),body:req.postDataJSON()});
   if(url.pathname.endsWith('/learning-advisor')){const out=await f.request(req.method()==='POST'?req.postDataJSON():null);return route.fulfill({status:out.statusCode,json:out.body});}
   if(url.pathname.endsWith('/learnings')){const out=await r.request(req.method(),url.href,req.postDataJSON()||undefined);return route.fulfill({status:out.statusCode,json:out.body});}
   if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:null}});
   if(url.pathname==='/api/workspaces/catalog')return route.fulfill({json:base.catalog()});
   if(url.pathname==='/api/brands')return route.fulfill({json:{brands:base.catalog().workspaces[0].brands}});
   if(/^\/api\/brands\/[^/]+$/.test(url.pathname)){const out=await base.request(req.method(),url.pathname,req.postDataJSON()||undefined);return route.fulfill({status:out.statusCode,json:out.body});}
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{boards:[],members:[],nodes:[],editors:[],presence:[]}});
   const file=path.resolve(ROOT,url.pathname==='/'?'index.html':'.'+url.pathname);return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
  });
  await page.goto('http://localhost/');await page.waitForFunction(()=>typeof state!=='undefined'&&!!workspaceSidebarController);
  await page.evaluate(({catalog,W,B,EMAIL})=>{
   state.user={email:EMAIL};state.workspaceCatalog={...state.workspaceCatalog,value:catalog,status:'ready',activeWorkspaceId:W};state.session.workspaceId=W;state.session.brandId=B;
   state.currentBoardId=null;state.session.boardId=null;state.publicBoardToken=null;state.brandCatalog={...state.brandCatalog,status:'success',userEmail:EMAIL,entries:catalog.workspaces[0].brands};
   state.boardAccess={canView:true,canEdit:true,canViewBoardBrandCore:true};state.isDirty=false;setActiveView('home');setSidebarCollapsed(false);renderWorkspaceSidebar();
  },{catalog:base.catalog(),W,B,EMAIL});
  await page.locator('#brand-core-nav-btn').click();await page.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready');
  await page.locator('[data-profile-key="Brand Learnings"]').click();
  if(canvas) {
   for(const historical of hydrationCanvases) {
    const restored=await page.evaluate(canvas=>{applyCampaignState(canvas,'Synthetic historical Board',{memoryOnly:true});return serializeState();},historical);
    assert.deepEqual(restored.edges,historical.edges);assert.deepEqual(restored.nodes.map(n=>[n.id,n.type]),historical.nodes.map(n=>[n.id,n.type]));
   }
   const persisted=await page.evaluate(canvas=>{applyCampaignState(canvas,'Synthetic saved Board',{memoryOnly:true});return serializeState();},canvas);
   assert.deepEqual(persisted.edges,canvas.edges,'Production Canvas hydration/serialization retains canonical tuple relationships');
  }
  const find=page.locator('[data-learning-advisor-open]'),dialog=page.locator('dialog[data-learning-advisor]');
  const action=k=>dialog.locator('[data-advisor-action="'+k+'"]');
  const snapshot=()=>page.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,undo:state.undoStack,history:state.history,dirty:state.isDirty,saved:state.lastSavedSnapshot,activity:state.activityFeed,presence:state.presenceEditingNodeId,storage:{...localStorage}}));
  const before=clone(base.db);
  await find.waitFor();assert.equal(f.config.providerCalls.length,0);
  await find.click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});
  assert.equal(await dialog.locator('[data-advisor-discussions]').isChecked(),false);assert.equal(f.config.providerCalls.length,0);
  await dialog.locator('select').selectOption(f.board.id);await page.waitForFunction(()=>!document.querySelector('[data-advisor-action="analyze"]').disabled);
  assert.equal(f.config.providerCalls.length,0);assert.equal(await page.locator('#node-form dialog').count(),0);
  const initial=await snapshot();
  await dialog.locator('[data-advisor-discussions]').check();await dialog.locator('[data-advisor-thread]').first().waitFor();
  assert.equal(await dialog.locator('[data-advisor-thread]').count(),expectedThreads);await dialog.locator('[data-advisor-thread]').first().uncheck();
  await action('analyze').click();await action('review').waitFor();assert.equal(f.config.providerCalls.length,1);
  assert(!f.config.providerCalls[0].body.input[1].content.includes('slogan'));assert.equal(await snapshot(),initial);
  await action('review').click();const statement=dialog.locator('[data-advisor-field="statement"]');await statement.fill('Human-reviewed browser guidance');
  assert.equal(await snapshot(),initial);assert.deepEqual(clone(base.db),before);
  await statement.press('Escape');await action('keep').click();assert.equal(await statement.inputValue(),'Human-reviewed browser guidance');
  await action('cancel').click();await action('discardAction').click();await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.dataset.learningAdvisorOpen),'true');
  for(const language of ['en','de'])for(const theme of ['light','dark'])for(const width of [1440,768,375,320]){
   await page.setViewportSize({width,height:800});await page.evaluate(({language,theme})=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);document.documentElement.dataset.theme=theme;brandProfileController.render();},{language,theme});
   await find.click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});
   assert((await dialog.textContent()).includes(language==='de'?'Ausgewählte Quellen analysieren':'Analyze selected sources'));
   assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'No horizontal overflow');
   await action('cancel').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SELECT');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  if(canvas) {
   const notes=clone(f.board.canvas_json.nodes[0].postits);f.board.canvas_json.nodes[0].postits='Unsupported optional data';
   for(const language of ['en','de']) {
    await page.evaluate(language=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);brandProfileController.render();},language);
    const calls=f.config.providerCalls.length;await find.click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});
    await dialog.locator('select').selectOption(f.board.id);await page.waitForFunction(()=>!document.querySelector('[data-advisor-action="analyze"]').disabled);
    assert((await dialog.textContent()).includes(language==='de'?'Die Abdeckung ist begrenzt':'Coverage is limited'));
    assert((await dialog.textContent()).includes(language==='de'?'Nicht unterstützte optionale Diskussionsdaten':'Unsupported optional discussion data'));
    assert.equal(f.config.providerCalls.length,calls);await action('cancel').click();
   }
   f.board.canvas_json.nodes[0].postits=notes;
  }
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{state.uiLanguage=FunklixLanguage.setUiLanguage('en');brandProfileController.render();});
  await find.click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});await dialog.locator('select').selectOption(f.board.id);await page.waitForFunction(()=>!document.querySelector('[data-advisor-action="analyze"]').disabled);
  await action('analyze').click();await action('review').click();await statement.fill('Retain stale draft');f.board.canvas_json.nodes[0].content='Changed after analysis';
  await action('save').click();await dialog.getByText(/Saved sources changed/).waitFor();assert.equal(await statement.inputValue(),'Retain stale draft');assert.equal(r.db.learnings.length,0);
  await action('cancel').click();await action('discardAction').click();
  f.board.canvas_json.nodes[0].content='Use a clear next step.';
  await find.click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});await dialog.locator('select').selectOption(f.board.id);await page.waitForFunction(()=>!document.querySelector('[data-advisor-action="analyze"]').disabled);
  await action('analyze').click();await action('review').click();await statement.fill('Explicit human adoption');await action('save').click();
  await dialog.getByText(/Saved as proposed/).waitFor();assert.equal(r.db.learnings[0].status,'proposed');assert.equal(r.db.learnings[0].source_node_id,'node-1');
  await action('cancel').click();await find.click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});
  await page.evaluate(()=>{state.user={email:'switched@example.test'};});await dialog.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);assert(!traffic.some(q=>q.method!=='GET'&&!q.path.endsWith('/learning-advisor')&&!q.path.endsWith('/learnings')));
  const finalSnapshot=JSON.parse(await snapshot()),initialSnapshot=JSON.parse(initial);
  delete finalSnapshot.storage['funklix.languagePreferences.v1'];
  assert.deepEqual(finalSnapshot,initialSnapshot,'Only explicit test language preference changes are allowed');
  console.log('PASS BW-36.19 real Profile/Advisor Chromium: explicit inference, discussions/exclusion, edited adoption, stale preservation, context discard, zero Canvas writes, EN/DE, themes, 1440/768/375/320, focus/Tab/Escape.');
 }catch(e){console.error('Advisor browser errors:',errors);throw e;}finally{await browser.close();}
}
module.exports={browserChecks};
