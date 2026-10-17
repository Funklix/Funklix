'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {learningRuntime}=require('./bw36-17-local-runtime');
const {B,D,W,EMAIL,clone}=require('./bw36-13r5-local-runtime');
const ROOT=path.resolve(__dirname,'../..');
async function browserChecks(){
 const r=learningRuntime(),base=r.base,errors=[],traffic=[];
 base.db.boards[0].canvas_json.nodes=[{id:'node-1',type:'Content',title:'Persisted selected node',content:'Hidden source text',position:{x:100,y:100},status:'Draft',tags:[],variants:[],images:[],postits:[],reactions:{},social:{platform:'Instagram',caption:'',hashtags:[],preview:'',scheduledAt:''},landingPage:{},contentFormat:'1:1'}];
 const before=clone(base.db);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'localhost','No provider or production calls');traffic.push({method:req.method(),path:url.pathname});
   if(url.pathname.endsWith('/learnings')||url.pathname.endsWith('/learning-source')){const res=await r.request(req.method(),url.href,req.postDataJSON()||undefined);return route.fulfill({status:res.statusCode,json:res.body});}
   if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:null}});
   if(url.pathname==='/api/workspaces/catalog')return route.fulfill({json:base.catalog()});
   if(url.pathname==='/api/brands')return route.fulfill({json:{brands:base.catalog().workspaces[0].brands}});
   if(/^\/api\/(brands|boards)\/[^/]+$/.test(url.pathname)){if(url.pathname.includes('/boards/'))return route.fulfill({json:{...base.db.boards[0],access:{canView:true,canRead:true,canEdit:true,role:'owner'}}});const res=await base.request(req.method(),url.pathname,req.postDataJSON()||undefined);return route.fulfill({status:res.statusCode,json:res.body});}
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{boards:[],members:[],nodes:[],editors:[],presence:[]}});
   const file=path.resolve(ROOT,url.pathname==='/'?'index.html':'.'+url.pathname);return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
  });
  await page.goto('http://localhost/');await page.waitForFunction(()=>typeof state!=='undefined'&&!!workspaceSidebarController);
  await page.evaluate(({catalog,board,email,W})=>{
   state.user={email,name:'Fixture'};state.workspaceCatalog={...state.workspaceCatalog,identity:email,status:'ready',value:catalog,generation:10,activeWorkspaceId:W};
   state.currentBoardId=board.id;state.lastKnownUpdatedAt=board.updated_at;state.boardBrandAssociation={brandId:board.brand_id};state.boardAccess={canView:true,canRead:true,canEdit:true,role:'owner'};
   state.nodes=board.canvas_json.nodes;state.edges=[];state.selectedIds=new Set(['node-1']);state.selectedPrimary='node-1';state.isDirty=false;state.isBoardLoading=false;state.isBoardHydrating=false;state.initialServerLoadInFlight=false;
   state.session.workspaceId=W;state.session.brandId=board.brand_id;state.brandCatalog={...state.brandCatalog,status:'success',userEmail:email,entries:catalog.workspaces[0].brands};setActiveView('board');setSidebarCollapsed(false);renderAuthState();state.nodes.forEach(renderNode);fillInspector(state.nodes[0]);refreshLastSavedSnapshot();updateInspectorActionVisibility();
  },{catalog:base.catalog(),board:base.db.boards[0],email:EMAIL,W});
  await page.locator('.node[data-id="node-1"] .type').click();
  await page.evaluate(()=>{state.isDirty=false;refreshLastSavedSnapshot();updateCanvasLearningAction();});
  const action=page.locator('#propose-brand-learning-btn'),dialog=page.locator('dialog[data-canvas-learning-proposal]'),statement=dialog.locator('[data-proposal-field="statement"]'),evidence=dialog.locator('[data-proposal-field="evidence"]');
  async function open(){await page.evaluate(()=>updateCanvasLearningAction());await action.click();await statement.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-proposal-field="statement"]').disabled);}
  const snapshot=()=>page.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,dirty:state.isDirty,saved:state.lastSavedSnapshot,storage:{...localStorage},undo:state.undoStack,activity:state.activityFeed,presence:buildPresencePayloadSignature(),history:state.history,selected:[...state.selectedIds]}));
  await action.focus();await page.mouse.move(1400,700);
  await page.waitForFunction(()=>!state.presenceEditingNodeId&&!state.presenceSelectionPingTimer&&!state.presencePingInFlight&&!state.presenceCursorPublishTimer);
  const writesBeforeOpen=traffic.filter(q=>q.method!=='GET').length;
  await open();assert.equal(await page.locator('#node-form dialog').count(),0);assert.equal(await statement.inputValue(),'');assert(!(await dialog.textContent()).includes('Hidden source text'));
  const initial=await snapshot();await statement.fill('Human-written observation');await evidence.fill('Human evidence');assert.equal(await snapshot(),initial);
  await statement.press('Escape');await dialog.locator('[data-proposal-action="keep"]').click();assert.equal(await statement.inputValue(),'Human-written observation');
  await dialog.locator('[data-proposal-action="cancel"]').click();await dialog.locator('[data-proposal-action="discardAction"]').click();await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.id),'propose-brand-learning-btn');assert.equal(await snapshot(),initial);
  assert.equal(r.db.learnings.length,0);assert.equal(traffic.filter(q=>q.method!=='GET').length,writesBeforeOpen,'opening, typing, cancelling do not write presence or Board data');
  await open();await statement.fill('Preserve text after stale rejection');base.db.boards[0].updated_at='2026-10-12T11:00:00.000Z';
  await dialog.locator('[data-proposal-action="pending"]').click();await dialog.getByText(/saved source changed/).waitFor();assert.equal(await statement.inputValue(),'Preserve text after stale rejection');assert(await dialog.locator('[data-proposal-action="pending"]').isDisabled());
  await dialog.locator('[data-proposal-action="fresh"]').click();await page.waitForFunction(()=>!document.querySelector('[data-proposal-action="pending"]').disabled);assert.equal(r.db.learnings.length,0);assert.equal(await statement.inputValue(),'Preserve text after stale rejection');
  await dialog.locator('[data-proposal-action="pending"]').click();await dialog.getByText(/awaits human review/).waitFor();assert.equal(r.db.learnings[0].source_node_id,'node-1');assert.equal(r.db.learnings[0].status,'proposed');
  await dialog.locator('[data-proposal-action="cancel"]').click();
  await page.evaluate(updatedAt=>{state.lastKnownUpdatedAt=updatedAt;},base.db.boards[0].updated_at);
  for(const language of ['en','de'])for(const theme of ['light','dark'])for(const width of [1440,768,375,320]){
   await page.setViewportSize({width,height:800});await page.evaluate(({language,theme})=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage(language);document.documentElement.dataset.theme=theme;updateCanvasLearningAction();},{language,theme});
   await open();assert.equal(await statement.inputValue(),'');assert.equal(await action.textContent(),language==='de'?'Markenwissen vorschlagen':'Propose Brand Learning');
   await statement.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.proposalAction),'cancel');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.proposalField),'statement');
   assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'responsive dialog has no horizontal overflow');await statement.press('Escape');await dialog.waitFor({state:'detached'});
  }
  await page.setViewportSize({width:1440,height:1000});
  for(const switchType of ['board','account','node']) {
   await open();await statement.fill(`Retained during ${switchType} switching`);
   await page.evaluate(type=>{if(type==='board')state.boardLoadGeneration++;if(type==='account')state.user={email:'switched@example.test'};if(type==='node')state.selectedPrimary='node-2';},switchType);
   await page.waitForFunction(()=>document.querySelector('[data-proposal-action="pending"]').disabled);
   assert.equal(await statement.inputValue(),`Retained during ${switchType} switching`);
   await dialog.locator('[data-proposal-action="cancel"]').click();await dialog.locator('[data-proposal-action="discardAction"]').click();
   await page.evaluate(()=>{state.user={email:'local-fixture@example.test'};state.selectedPrimary='node-1';state.selectedIds=new Set(['node-1']);updateCanvasLearningAction();});
  }
  await page.evaluate(()=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage('en');});
  await open();await statement.fill('Retained after save-time revocation');r.db.role='viewer';
  const count=r.db.learnings.length;await dialog.locator('[data-proposal-action="pending"]').click();await dialog.getByText(/Brand access does not allow/).waitFor();assert.equal(r.db.learnings.length,count);assert.equal(await statement.inputValue(),'Retained after save-time revocation');r.db.role='owner';
  await dialog.locator('[data-proposal-action="cancel"]').click();await dialog.locator('[data-proposal-action="discardAction"]').click();
  for(const mutation of ['viewer','multiple','dirty','public','account']){
   await page.evaluate(m=>{state.selectedIds=new Set(['node-1']);state.selectedPrimary='node-1';state.isDirty=false;state.publicBoardToken=null;state.user={email:'local-fixture@example.test'};state.workspaceCatalog.value.workspaces[0].brands[0].role='owner';
    if(m==='viewer')state.workspaceCatalog.value.workspaces[0].brands[0].role='viewer';if(m==='multiple')state.selectedIds.add('node-2');if(m==='dirty')state.isDirty=true;if(m==='public')state.publicBoardToken='token';if(m==='account')state.user=null;updateCanvasLearningAction();},mutation);assert(await action.isHidden(),mutation);
  }
  await page.evaluate(()=>{state.user={email:'local-fixture@example.test'};state.selectedIds=new Set(['node-1']);state.selectedPrimary='node-1';state.isDirty=false;state.publicBoardToken=null;state.workspaceCatalog.value.workspaces[0].brands[0].role='owner';updateCanvasLearningAction();});
  await open();await statement.fill('Explicit Profile handoff');await dialog.locator('[data-proposal-action="pending"]').click();await dialog.getByText(/awaits human review/).waitFor();await dialog.locator('[data-proposal-action="open"]').click();
  await page.waitForFunction(()=>brandProfileController?.state.section===7&&canonicalBrandDetail.brandId==='22222222-2222-4222-8222-222222222222');await page.locator('.brand-learnings').getByRole('heading',{name:'Explicit Profile handoff',exact:true}).waitFor();assert(await page.locator('.brand-learnings').getByText('Original Project · Persisted selected node',{exact:true}).first().isVisible());
  assert.deepEqual(clone(base.db.brands),before.brands);assert.deepEqual(clone(base.db.commands),before.commands);assert.deepEqual(clone(base.db.boards[0].canvas_json),before.boards[0].canvas_json);
  assert(!traffic.some(q=>q.method!=='GET'&&!q.path.endsWith('/learnings')&&!q.path.startsWith('/api/boards/presence/')),'no Board/Brand/Canvas data mutations during proposal and navigation; existing presence timers remain active');assert.deepEqual(errors,[]);
  console.log('PASS BW-36.18 authenticated Chromium: Inspector eligibility, empty manual statement, no Canvas/storage/undo changes, stale preservation and explicit resubmission, switching, EN/DE light/dark responsive dialogs, keyboard/Escape/focus, no external traffic.');
 }finally{await browser.close();}
}
module.exports={browserChecks};
