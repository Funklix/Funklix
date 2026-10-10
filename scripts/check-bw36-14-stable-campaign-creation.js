#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {runtime,W,B,D,I,EMAIL,now,clone,png}=require('./fixtures/bw36-13r5-local-runtime');
const contract=require('../campaign-creation');
let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core'));}
const ROOT=path.resolve(__dirname,'..'),R='55555555-5555-4555-8555-555555555555';
function fixture(){
  const r=runtime(),options={};let tail=Promise.resolve(),writes=0;
  const trace=[];
  const pool={async connect(){let unlock;const prior=tail;tail=new Promise(resolve=>unlock=resolve);await prior;let tx=null;
    return {async query(sql,args=[]){
      sql=sql.replace(/\s+/g,' ').trim();trace.push(sql);const rows=v=>({rows:clone(v),rowCount:v.length});
      if(sql==='BEGIN'){tx=clone(r.db.boards);return rows([]);}
      if(sql==='ROLLBACK'){tx=null;return rows([]);}
      if(sql==='COMMIT'){r.db.boards=tx;tx=null;if(options.lostCommit)throw new Error('Transport after commit');return rows([]);}
      if(/FROM public.app_identities/.test(sql))return rows([{id:I,canonical_email:EMAIL,status:options.disabled?'disabled':'active',revision:1}]);
      if(/FROM public.workspaces/.test(sql))return rows([{id:W,name:'Local Workspace',status:'active'}]);
      if(/FROM public.workspace_memberships/.test(sql))return rows([{role:'owner',status:options.noMembership?'removed':'accepted'}]);
      if(/FROM (?:public\.)?boards WHERE id/.test(sql))return rows(tx.filter(b=>b.id===args[0]));
      if(/FROM board_editors/.test(sql))return rows(options.role?[{role:options.role}]:[]);
      if(/FROM brand_members/.test(sql))return rows([]);
      if(/FROM brands b LEFT JOIN/.test(sql)){const b=r.db.brands.find(b=>b.id===args[0]),role=b?.owner_email===args[1]?'owner':options.brandRole;return rows(role?[{role}]:[]);}
      if(/FROM public.brands WHERE id/.test(sql))return rows(r.db.brands.filter(b=>b.id===args[0]));
      if(/UPDATE public.boards/.test(sql)){if(options.saveFail)throw new Error('Injected save failure');writes++;const b=tx.find(b=>b.id===args[0]);b.canvas_json=JSON.parse(args[1]);b.updated_at=new Date(Date.parse(b.updated_at)+1000).toISOString();return rows([b]);}
      throw new Error('Unexpected query '+sql);
    },release(){unlock();}};
  }};
  const modules=new Map();
  function load(file){const location=path.join(ROOT,file);if(modules.has(file))return modules.get(file).exports;const module={exports:{}};modules.set(file,module);const req=createRequire(location);
    const custom=name=>{if(name==='pg')throw new Error('Real database forbidden');if(!name.startsWith('.'))return req(name);const relative=path.relative(ROOT,req.resolve(name));if(relative==='api/_boards-storage.js')return {pool};return ['api/_campaign-creation.js','campaign-creation.js'].includes(relative)?load(relative):r.load(relative);};
    vm.runInNewContext(fs.readFileSync(location,'utf8'),{module,exports:module.exports,require:custom,console,Date,Buffer},{filename:file});return module.exports;
  }
  const handler=load('api/campaigns.js').createHandler({db:pool,sessionReader:r.load('api/_auth-session.js').getSessionUser}),auth=r.load('api/_auth-session.js');
  async function call(input,user={email:EMAIL}){const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=clone(body);return this;}};await handler({method:'POST',body:input,headers:{cookie:user?`funklix_session=${auth.createSessionToken(user)}`:''}},res);return res;}
  return {...r,options,trace,call,writes:()=>writes};
}
const input=extra=>({contract:contract.CONTRACT,request_id:R,board_id:D,workspace_id:W,brand_id:B,board_revision:now,idea:'Launch our service',context:'Reach new customers',...extra});
async function server(){
  let r=fixture();assert.equal((await r.call(input(),null)).body.error.code,'AUTHENTICATION_REQUIRED');assert.equal((await r.call(input({idea:''}))).body.error.code,'VALIDATION');
  for(const [setup,code] of [[r=>r.db.boards=[],'BOARD_MISSING'],[r=>r.options.disabled=true,'PERMISSION_DENIED'],[r=>r.options.noMembership=true,'PERMISSION_DENIED'],[r=>{r.db.boards[0].owner_email='other';r.db.boards[0].owner_id='other';r.db.brands[0].owner_email='other';r.options.role='viewer';},'PERMISSION_DENIED'],[r=>r.db.boards[0].brand_id=null,'BRAND_MISSING'],[r=>r.db.boards[0].brand_id=R,'CONFLICT'],[r=>r.db.brands[0].workspace_id=R,'CONFLICT'],[r=>r.db.boards[0].updated_at='2026-10-09T00:00:00Z','STALE_REVISION'],[r=>r.options.saveFail=true,'SAVE_FAILED']]){r=fixture();setup(r);const before=clone(r.db.boards);const res=await r.call(input());assert.equal(res.body.error.code,code);assert.deepEqual(clone(r.db.boards),before);assert(r.trace.includes('ROLLBACK'));}
  for(const role of ['editor','brand_editor']){r=fixture();r.db.boards[0].owner_email=r.db.boards[0].owner_id='other';r.db.brands[0].owner_email='other';if(role==='editor')r.options.role=role;else r.options.brandRole='editor';assert.equal((await r.call(input())).statusCode,201);}
  r=fixture();const before=clone(r.db.boards[0]),results=await Promise.all([r.call(input()),r.call(input())]);assert.deepEqual(results.map(v=>v.body.created).sort(),[false,true]);assert.equal(r.writes(),1);assert.equal(r.db.boards.length,1);assert.equal(r.db.boards[0].canvas_json.nodes.length,1);assert.deepEqual(clone(r.db.boards[0].brand_core_snapshot),before.brand_core_snapshot);assert.equal(r.db.boards[0].brand_core_snapshot_copied_at,before.brand_core_snapshot_copied_at);assert.equal(r.trace.filter(q=>q==='COMMIT').length,2);
  assert.equal((await r.call(input({idea:'Different'}))).body.error.code,'CONFLICT');
  const outcome=contract.validate(results[0].body,input());for(const change of [v=>v.board.id=R,v=>v.brand.id=R,v=>v.workspace.id=R,v=>v.node_id='other',v=>v.next_route='/boards',v=>v.board.canvas_json.nodes=[]]){const bad=clone(outcome);change(bad);assert.throws(()=>contract.validate(bad,input()));}
  r.db.boards[0].canvas_json.nodes=[];assert.equal((await r.call(input())).body.error.code,'STALE_REVISION','Deleted seed cannot be recreated by a retry');
  r=fixture();r.options.lostCommit=true;assert.equal((await r.call(input())).body.error.code,'OUTCOME_UNKNOWN');r.options.lostCommit=false;assert.equal((await r.call(input())).body.created,false);assert.equal(r.writes(),1);
  r=fixture();const saved=(await r.call(input())).body;let calls=0,opens=0,current={account:{},generation:1,workspaceId:W,brandId:B,boardId:D};
  const boundary=contract.createBoundary({context:()=>current,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>saved};},open:async()=>{if(++opens===1)throw new Error('Rendering failed');}});
  await assert.rejects(boundary.submit(input()),e=>e.code==='OPEN_FAILED');await boundary.submit(input());assert.equal(calls,1);assert.equal(opens,2);current={...current,account:{}};await assert.rejects(boundary.submit(input()),e=>e.code==='CONFLICT');
  console.log('BW-36.14 server: production signed auth/access/transaction/rollback, roles, conflict/stale, concurrent replay, lost commit, deleted seed and confirmed reconciliation recovery passed.');
}
async function browser(){
  const r=fixture(),browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(10000);const errors=[],dialogs=[],posts=[],calls=[];let networkFail=false,pause=null,invalidResponse=false;
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.type());void d.dismiss();});
    await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'localhost','No real external calls');calls.push(url.pathname);
      if(url.pathname==='/api/campaigns'){posts.push(req.postDataJSON());if(networkFail)return route.abort('failed');if(pause)await new Promise(resolve=>pause.release=resolve);const result=await r.call(req.postDataJSON());return route.fulfill({status:result.statusCode,json:invalidResponse?{broken:true}:result.body});}
      if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:{email:EMAIL}}});
      if(url.pathname==='/api/workspaces'){const c=r.catalog();c.request_id='0123456789abcdef01234567';c.workspaces=c.workspaces.map(w=>({...w,avatar_url:null,locale:null,brands:w.brands.map(({workspace_id,...b})=>b),boards:w.boards.map(({workspace_id,...b})=>b)}));return route.fulfill({json:c});}
      if(url.pathname==='/api/brands')return route.fulfill({json:{brands:r.catalog().workspaces[0].brands.map(b=>({...b,created_at:now,updated_at:now}))}});
      if(url.pathname===`/api/boards/${D}`)return route.fulfill({json:(await r.request('GET',url.pathname)).body});
      if(url.pathname===`/api/brands/${B}/logo`)return route.fulfill({contentType:'image/png',body:png});
      if(url.pathname.startsWith('/api/'))return route.fulfill({json:{boards:r.db.boards,members:[],editors:[],nodes:[],presence:[]}});
      const file=path.resolve(ROOT,url.pathname==='/'||url.pathname.startsWith('/boards/')?'index.html':'.'+url.pathname);return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
    });
    await page.goto(`http://localhost/boards/${D}`);await page.waitForFunction(()=>state.currentBoardId&&state.workspaceCatalog.status==='ready'&&!state.isBoardLoading).catch(async e=>{console.error('Boot diagnostic',errors,await page.evaluate(()=>({user:state.user,catalog:state.workspaceCatalog,board:state.currentBoardId,loading:state.isBoardLoading})));throw e;});
    await page.evaluate(()=>{window.bw14Views=[];const original=setActiveView;setActiveView=view=>{window.bw14Views.push(view);return original(view);};setAppMode('canvas');setActiveView('board');state.isDirty=false;});
    const cta=page.locator('#create-campaign-btn'),dialog=page.locator('#campaign-creation-dialog'),submit=dialog.locator('button[type=submit]');
    const open=async()=>{await cta.click();await dialog.waitFor();};
    await open();assert(await dialog.getByRole('heading',{name:'Create campaign'}).isVisible());assert(await dialog.getByText('Project: Original Project').isVisible());assert(await dialog.getByText('Brand: Local Brand').isVisible());assert(await dialog.getByText('Workspace: Local Workspace').isVisible());assert.equal(await dialog.locator('.brand-logo-initials').textContent(),'LB');
    await page.evaluate(()=>{el.createCampaignButton.click();el.createCampaignButton.click();});assert.equal(await dialog.count(),1);assert.equal(posts.length,0);assert(!/11111111|22222222|33333333|snapshot|UUID/.test(await dialog.innerText()));
    await submit.click();assert(await page.locator('#campaign-creation-status').getByText('Enter a campaign goal or idea.').isVisible());await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>document.activeElement.id),'create-campaign-btn');
    await open();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.type),'submit');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'campaign-creation-idea');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'create-campaign-btn');
    for(const [mutate,code] of [[()=>state.currentBoardId=null,'BOARD_MISSING'],[()=>state.boardBrandAssociation.brandId=null,'BRAND_MISSING'],[()=>state.boardAccess.canEdit=false,'PERMISSION_DENIED']]){
      await page.evaluate(mutate);await cta.click({force:true});assert.equal(await dialog.count(),0);assert(await page.locator('#campaign-creation-feedback').isVisible());assert.equal(posts.length,0);
      await page.evaluate(({D,B})=>{state.currentBoardId=D;state.boardBrandAssociation.brandId=B;state.boardAccess.canEdit=true;document.getElementById('campaign-creation-feedback')?.remove();}, {D,B});
    }
    await page.evaluate(({B})=>{state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:state.workspaceCatalog.value.workspaces.map(w=>({...w,brands:w.brands.map(b=>b.id===B?{...b,logo_url:`/api/brands/${B}/logo?revision=1`,logo_revision:1}:b)}))};}, {B});await open();assert.equal(await dialog.locator('.brand-logo img').count(),1);await page.keyboard.press('Escape');
    for(const theme of ['light','dark'])for(const width of [1440,1024,768,480,375,320,720]){await page.setViewportSize({width,height:width===720?450:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await open();const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await dialog.locator('button').evaluateAll(bs=>bs.every(b=>b.getBoundingClientRect().height>=44)));assert(await dialog.evaluate(d=>d.scrollHeight>=d.clientHeight));await page.keyboard.press('Escape');}
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await page.setViewportSize({width:320,height:280});await open();assert(await dialog.evaluate(d=>d.scrollHeight>d.clientHeight));await submit.scrollIntoViewIfNeeded();assert(await submit.isVisible());await page.screenshot({path:'work/bw36-14-short-height.png'});await page.keyboard.press('Escape');await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>state.uiLanguage=language.setUiLanguage('de'));await open();assert(await dialog.getByRole('heading',{name:'Kampagne erstellen'}).isVisible());assert(await dialog.getByText('Zusätzlicher Kontext (optional)').isVisible());await page.keyboard.press('Escape');await page.evaluate(()=>state.uiLanguage=language.setUiLanguage('en'));
    await open();await page.locator('#campaign-creation-idea').fill('Launch our service');await page.locator('#campaign-creation-context').fill('Reach new customers');networkFail=true;await submit.click();await page.waitForFunction(()=>document.getElementById('campaign-creation-status').textContent.includes('server could not'));assert.equal(await page.locator('#campaign-creation-idea').inputValue(),'Launch our service');assert.equal(r.writes(),0);networkFail=false;pause={};await submit.click();await page.waitForFunction(()=>document.getElementById('campaign-creation-dialog').getAttribute('aria-busy')==='true');await page.evaluate(()=>{document.querySelector('#campaign-creation-dialog form').requestSubmit();document.querySelector('#campaign-creation-dialog form').requestSubmit();});await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);assert.equal(posts.length,2);pause.release();pause=null;await page.waitForFunction(()=>!document.getElementById('campaign-creation-dialog'));
    assert.equal(r.writes(),1);assert.equal(r.db.boards.length,1);assert.equal(r.db.boards[0].canvas_json.nodes.length,1);assert.deepEqual(posts[0],posts[1]);assert.equal(page.url(),`http://localhost/boards/${D}`);assert.deepEqual(await page.evaluate(()=>({board:state.currentBoardId,brand:state.session.brandId,workspace:state.session.workspaceId,view:state.activeView,selected:state.selectedPrimary})),{board:D,brand:B,workspace:W,view:'board',selected:`campaign-${posts[1].request_id}`});assert(!(await page.evaluate(()=>window.bw14Views)).includes('boards_library'));assert.equal(await page.evaluate(()=>document.activeElement.id),'node-title');
    await page.reload();await page.waitForFunction(()=>state.currentBoardId&&state.workspaceCatalog.status==='ready'&&!state.isBoardLoading);assert.equal(await page.evaluate(()=>state.nodes.length),1);assert.equal(await page.evaluate(()=>state.boardBrandAssociation.brandId),B);assert.equal(await page.evaluate(()=>state.session.brandId),B);assert.equal(await page.evaluate(()=>state.session.workspaceId),W);
    // Confirmed server success with a render failure: retry only opens, never saves again.
    await page.evaluate(()=>{window.bw14OriginalOpen=openCreatedCampaign;openCreatedCampaign=()=>{throw new Error('Local reconciliation fixture');};state.isDirty=false;});await open();await page.locator('#campaign-creation-idea').fill('Second campaign');const count=posts.length;await submit.click();await page.waitForFunction(()=>document.getElementById('campaign-creation-status').textContent.includes('was created'));assert.equal(posts.length,count+1);assert(await dialog.getByRole('link',{name:'Reload campaign'}).isVisible());assert.equal(await dialog.getByRole('link').getAttribute('href'),`/boards/${D}`);await page.evaluate(()=>openCreatedCampaign=window.bw14OriginalOpen);await submit.click();await page.waitForFunction(()=>!document.getElementById('campaign-creation-dialog'));assert.equal(posts.length,count+1);assert.equal(r.writes(),2);
    // Successful save with unusable response: replay the identical command to recover.
    invalidResponse=true;await open();await page.locator('#campaign-creation-idea').fill('Recover response');await submit.click();await page.waitForFunction(()=>document.getElementById('campaign-creation-status').textContent.includes('could not be confirmed'));const last=posts.at(-1);invalidResponse=false;await submit.click();await page.waitForFunction(()=>!document.getElementById('campaign-creation-dialog'));assert.deepEqual(posts.at(-1),last);assert.equal(r.writes(),3);
    assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);assert(!calls.includes('/api/generate-campaign'));assert.equal(r.storageRequests.length,0);assert.equal((fs.readFileSync('app.js','utf8').match(/createCampaignButton\.addEventListener\("click"/g)||[]).length,1);console.log('BW-36.14 Chromium: real production app/DOM, single CTA/dialog, auth context/logo/initials, double submit, retained retry, direct Canvas/route/identity, refresh, response recovery, confirmed save/open failure, Escape/Cancel/Tab/focus, EN/DE, light/dark 1440/1024/768/480/375/320, reflow/short height/forced colors/reduced motion passed.');
  }finally{await browser.close();}
}
(async()=>{await server();await browser();console.log('BW-36.14 passed; zero real provider/AI/storage/production database calls.');})().catch(error=>{console.error(error);process.exitCode=1;});
