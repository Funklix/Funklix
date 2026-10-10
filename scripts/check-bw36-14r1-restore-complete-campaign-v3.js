#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {runtime,W,B,D,I,EMAIL,now,clone,png}=require('./fixtures/bw36-13r5-local-runtime');
const contract=require('../campaign-creation'),v3=require('../campaign-v3');
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
const setup=v3.normalizeCampaignV3Setup({variationCount:2,postsPerVariation:3});
function input(extra={}){
  const raw=v3.createCampaignV3MockNodes(setup,'grouped'),plan=v3.buildCampaignV3PlanFromNodes(raw,setup),layout=v3.layoutCampaignV3Plan(plan.plan,setup);
  const nodes=layout.positionedNodes.map(n=>({...n,id:n.tempId,position:{x:n.x,y:n.y}}));
  return {contract:contract.CONTRACT,request_id:R,board_id:D,workspace_id:W,brand_id:B,board_revision:now,idea:'Launch our service',context:'Reach new customers',setup:{...setup},
    canvas_json:{nodes,edges:layout.edges.map(e=>[e.fromTempId,e.toTempId]),nodeCounter:14},campaign_node_ids:nodes.map(n=>n.id),...extra};
}
async function server(){
  assert.throws(()=>contract.request({...input(),contract:'campaign_creation_v1'}));
  for(const change of [c=>c.canvas_json.nodes.pop(),c=>c.canvas_json.edges.pop(),c=>c.setup.variationCount=0,c=>c.setup.postsPerVariation=21,c=>c.campaign_node_ids.push(c.campaign_node_ids[0])]){const c=input();change(c);assert.throws(()=>contract.request(c));}
  let r=fixture();assert.equal((await r.call(input(),null)).body.error.code,'AUTHENTICATION_REQUIRED');assert.equal((await r.call(input({idea:''}))).body.error.code,'VALIDATION');
  for(const [setup,code] of [[r=>r.db.boards=[],'BOARD_MISSING'],[r=>r.options.disabled=true,'PERMISSION_DENIED'],[r=>r.options.noMembership=true,'PERMISSION_DENIED'],[r=>{r.db.boards[0].owner_email='other';r.db.boards[0].owner_id='other';r.db.brands[0].owner_email='other';r.options.role='viewer';},'PERMISSION_DENIED'],[r=>r.db.boards[0].brand_id=null,'BRAND_MISSING'],[r=>r.db.boards[0].brand_id=R,'CONFLICT'],[r=>r.db.brands[0].workspace_id=R,'CONFLICT'],[r=>r.db.boards[0].updated_at='2026-10-09T00:00:00Z','STALE_REVISION'],[r=>r.options.saveFail=true,'SAVE_FAILED']]){r=fixture();setup(r);const before=clone(r.db.boards);const res=await r.call(input());assert.equal(res.body.error.code,code);assert.deepEqual(clone(r.db.boards),before);assert(r.trace.includes('ROLLBACK'));}
  for(const role of ['editor','brand_editor']){r=fixture();r.db.boards[0].owner_email=r.db.boards[0].owner_id='other';r.db.brands[0].owner_email='other';if(role==='editor')r.options.role=role;else r.options.brandRole='editor';assert.equal((await r.call(input())).statusCode,201);}
  r=fixture();const before=clone(r.db.boards[0]),results=await Promise.all([r.call(input()),r.call(input())]);assert.deepEqual(results.map(v=>v.body.created).sort(),[false,true]);assert.equal(r.writes(),1);assert.equal(r.db.boards.length,1);assert.equal(r.db.boards[0].canvas_json.nodes.length,13);assert.deepEqual(clone(r.db.boards[0].brand_core_snapshot),before.brand_core_snapshot);assert.equal(r.db.boards[0].brand_core_snapshot_copied_at,before.brand_core_snapshot_copied_at);assert.equal(r.trace.filter(q=>q==='COMMIT').length,2);
  assert.equal((await r.call(input({idea:'Different'}))).body.error.code,'CONFLICT');
  const outcome=contract.validate(results[0].body,input());for(const change of [v=>v.board.id=R,v=>v.brand.id=R,v=>v.workspace.id=R,v=>v.node_id='other',v=>v.next_route='/boards',v=>v.board.canvas_json.nodes=[]]){const bad=clone(outcome);change(bad);assert.throws(()=>contract.validate(bad,input()));}
  r.db.boards[0].canvas_json.nodes=[];assert.equal((await r.call(input())).body.error.code,'STALE_REVISION','Deleted complete campaign cannot be recreated by a retry');
  r=fixture();r.options.lostCommit=true;assert.equal((await r.call(input())).body.error.code,'OUTCOME_UNKNOWN');r.options.lostCommit=false;assert.equal((await r.call(input())).body.created,false);assert.equal(r.writes(),1);
  r=fixture();const saved=(await r.call(input())).body;let calls=0,opens=0,current={account:{},generation:1,workspaceId:W,brandId:B,boardId:D,canEdit:true};
  const boundary=contract.createBoundary({context:()=>current,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>saved};},open:async()=>{if(++opens===1)throw new Error('Rendering failed');}});
  await assert.rejects(boundary.submit(input()),e=>e.code==='OPEN_FAILED');await boundary.submit(input());assert.equal(calls,1);assert.equal(opens,2);current={...current,account:{}};await assert.rejects(boundary.submit(input()),e=>e.code==='CONFLICT');
  for(const s of [{variationCount:1,postsPerVariation:1},{variationCount:10,postsPerVariation:20},{variationCount:2,postsPerVariation:3,includeLandingPage:false,includeEmailCampaign:false}]){
    const normalized=v3.normalizeCampaignV3Setup(s),plan=v3.buildCampaignV3PlanFromNodes(v3.createCampaignV3MockNodes(normalized),normalized);
    assert.equal(plan.ok,true);assert.equal(v3.campaignV3PlanNodes(plan.plan).length,1+normalized.variationCount*(2+normalized.postsPerVariation)+(normalized.includeLandingPage?1:0)+(normalized.includeEmailCampaign?1:0));
    const layout=v3.layoutCampaignV3Plan(plan.plan,normalized),nodes=layout.positionedNodes.map(n=>({...n,id:n.tempId,position:{x:n.x,y:n.y}}));
    const cmd=input({setup:normalized,canvas_json:{nodes,edges:layout.edges.map(e=>[e.fromTempId,e.toTempId]),nodeCounter:nodes.length+1},campaign_node_ids:nodes.map(n=>n.id)});
    const fixtureRuntime=fixture();assert.equal((await fixtureRuntime.call(cmd)).statusCode,201);assert.equal(fixtureRuntime.db.boards[0].canvas_json.nodes.length,nodes.length);
  }
  r=fixture();const legacy={contract:'campaign_creation_v1',request_id:R,board_id:D,workspace_id:W,brand_id:B,board_revision:now,idea:'Old seed request',context:''};assert.equal((await r.call(legacy)).statusCode,422);assert.equal(r.writes(),0);
  r=fixture();const seed={id:'existing-user-idea',type:'Idea',content:'Keep this user asset',position:{x:10,y:10}};r.db.boards[0].canvas_json.nodes.push(seed);assert.equal((await r.call(input())).statusCode,201);assert.deepEqual(clone(r.db.boards[0].canvas_json.nodes[0]),seed);
  console.log('BW-36.14R1 server: production signed auth/access/transaction/rollback, roles, conflict/stale, concurrent replay, lost commit, deleted campaign and confirmed reconciliation recovery passed.');
}
async function browser({baseline=false}={}){
  const r=fixture(),browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  fs.mkdirSync('work',{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(15000);
    const errors=[],dialogs=[],posts=[],ai=[],repairs=[],boardWrites=[];
    let aiFail=false,aiHold=null,saveHold=null,invalidResponse=false;
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.type());void d.dismiss();});
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'localhost','Fixtures forbid every external call');
      if(url.pathname==='/api/generate-campaign'){
        ai.push(req.postDataJSON());if(aiHold)await new Promise(resolve=>aiHold.release=resolve);
        if(aiFail)return route.fulfill({status:503,json:{error:'Local AI failure'}});
        const nodes=v3.createCampaignV3MockNodes(req.postDataJSON(),'grouped');const incomplete=nodes.find(n=>n.type==='Content');incomplete.content='';incomplete.description='';return route.fulfill({json:{nodes}});
      }
      if(url.pathname==='/api/refine-node'){
        const body=req.postDataJSON();repairs.push(body);const n=body.currentContent;
        return route.fulfill({json:{title:n.title,content:n.content||'Local business owners can save time with dependable service. Learn how our process supports predictable delivery and book a consultation.',caption:n.social?.caption||n.content}});
      }
      if(url.pathname==='/api/campaigns'){
        posts.push(req.postDataJSON());if(saveHold)await new Promise(resolve=>saveHold.release=resolve);
        const res=await r.call(req.postDataJSON());return route.fulfill({status:res.statusCode,json:invalidResponse?{broken:true}:res.body});
      }
      if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:{email:EMAIL}}});
      if(url.pathname==='/api/workspaces'){
        const c=r.catalog();c.request_id='0123456789abcdef01234567';
        c.workspaces=c.workspaces.map(w=>({...w,avatar_url:null,locale:null,brands:w.brands.map(({workspace_id,...b})=>b),boards:w.boards.map(({workspace_id,...b})=>b)}));return route.fulfill({json:c});
      }
      if(url.pathname==='/api/brands')return route.fulfill({json:{brands:r.catalog().workspaces[0].brands.map(b=>({...b,created_at:now,updated_at:now}))}});
      if(url.pathname===`/api/boards/${D}`){
        if(req.method()!=='GET')boardWrites.push(req.method());
        return route.fulfill({json:(await r.request(req.method(),url.pathname,req.postDataJSON())).body});
      }
      if(url.pathname===`/api/brands/${B}/logo`||url.pathname==='/fixture-avatar.png')return route.fulfill({contentType:'image/png',body:png});
      if(url.pathname.startsWith('/api/'))return route.fulfill({json:{boards:r.db.boards,members:[],editors:[],nodes:[],presence:[]}});
      const file=path.resolve(ROOT,url.pathname==='/'||url.pathname.startsWith('/boards/')?'index.html':'.'+url.pathname);
      return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
    });
    const boot=async()=>{
      await page.goto(`http://localhost/boards/${D}`);
      await page.waitForFunction(()=>state.currentBoardId&&state.workspaceCatalog.status==='ready'&&!state.isBoardLoading);
      await page.evaluate(()=>{setAppMode('canvas');setActiveView('board');state.isDirty=false;window.testViews=[];const original=setActiveView;setActiveView=v=>{window.testViews.push(v);return original(v);};});
    };
    await boot();
    const dialog=page.locator('#campaign-creation-dialog'),cta=page.locator('#create-campaign-btn');
    const open=async()=>{await cta.click();await dialog.waitFor();};
    const brief=async()=>{await open();await dialog.locator('#campaign-creation-idea').fill('Launch a reliable local service');await dialog.locator('#campaign-creation-context').fill('Reach business owners seeking time savings');await dialog.getByRole('button',{name:'Continue',exact:true}).click();};
    const structure=async()=>{await brief();await dialog.locator('#campaign-v3-variations').fill('2');await dialog.locator('#campaign-v3-posts').fill('3');};
    const generate=()=>dialog.getByRole('button',{name:'Generate Campaign',exact:true}).click();
    const reveal=async()=>{await dialog.locator('#campaign-v3-reveal').waitFor().catch(async e=>{console.error('Reveal diagnostic',await dialog.innerText(),await page.evaluate(()=>({identity:campaignCreationIdentity(),dirty:state.isDirty,nodes:state.nodes.length})),posts.length,ai.length);throw e;});await dialog.locator('#campaign-v3-reveal').click();assert.equal(await dialog.count(),0);};
    const counts=()=>page.evaluate(()=>campaignV3NodeCounts(state.nodes));
    const expected={Idea:1,'Campaign Variation':2,Content:2,'Social Media Posting':6,'Landing Page':1,'Email Campaign':1};
    await open();
    assert(await dialog.getByText('Workspace: Local Workspace').isVisible());assert(await dialog.getByText('Project: Original Project').isVisible());assert(await dialog.getByText('Brand: Local Brand').isVisible());assert.equal(await dialog.locator('.brand-logo-initials').textContent(),'LB');
    await page.evaluate(()=>{el.createCampaignButton.click();el.createCampaignButton.click();});assert.equal(await dialog.count(),1);assert.equal(ai.length,0);assert.equal(posts.length,0);
    await dialog.getByRole('button',{name:'Continue',exact:true}).click();assert(await dialog.getByText('Enter a campaign goal or idea.').isVisible());
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'create-campaign-btn');
    await open();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.type),'submit');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'campaign-creation-idea');await page.keyboard.press('Escape');
    for(const mutate of [()=>state.currentBoardId=null,()=>state.boardBrandAssociation.brandId=null,()=>state.boardAccess.canEdit=false,()=>state.workspaceCatalog.activeWorkspaceId='other']){
      await page.evaluate(mutate);await cta.click({force:true});assert.equal(await dialog.count(),0);assert(await page.locator('#campaign-creation-feedback').isVisible());
      await page.evaluate(({D,B,W})=>{state.currentBoardId=D;state.boardBrandAssociation.brandId=B;state.boardAccess.canEdit=true;state.workspaceCatalog.activeWorkspaceId=W;document.getElementById('campaign-creation-feedback')?.remove();},{D,B,W});
    }
    await page.evaluate(({B})=>{state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:state.workspaceCatalog.value.workspaces.map(w=>({...w,brands:w.brands.map(b=>b.id===B?{...b,logo_url:`/api/brands/${B}/logo?revision=1`,logo_revision:1}:b)}))};},{B});
    await open();assert.equal(await dialog.locator('.brand-logo img').count(),1);await page.keyboard.press('Escape');
    const checkReflow=async()=>{for(const theme of ['light','dark'])for(const width of [1440,1024,768,480,375,320,720]){await page.setViewportSize({width,height:width===720?450:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await dialog.locator('.campaign-builder-modal').evaluate(n=>n.scrollWidth<=n.clientWidth+1));assert(await dialog.locator('button').evaluateAll(bs=>bs.every(b=>b.classList.contains('fk-btn')&&getComputedStyle(b).appearance==='none')));}await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='light');};
    for(const theme of ['light','dark'])for(const width of [1440,1024,768,480,375,320,720]){
      await page.setViewportSize({width,height:width===720?450:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await brief();
      assert.equal(await dialog.locator('#campaign-v3-channel option').count(),6);
      assert(await dialog.locator('#campaign-v3-include-landing').isChecked());assert(await dialog.locator('#campaign-v3-include-email').isChecked());
      for(const [v,p] of [[1,1],[10,20],[2,3]]){
        await dialog.locator('#campaign-v3-variations').fill(String(v));await dialog.locator('#campaign-v3-posts').fill(String(p));
        assert((await dialog.locator('#campaign-creation-estimate').innerText()).endsWith(`Total assets: ${1+v*(2+p)+2}`));
      }
      const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await dialog.locator('button').evaluateAll(bs=>bs.filter(b=>b.getClientRects().length).every(b=>b.classList.contains('fk-btn')&&getComputedStyle(b).appearance==='none'&&parseFloat(getComputedStyle(b).borderRadius)>0)));
      await dialog.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await dialog.locator('#campaign-creation-idea').inputValue(),'Launch a reliable local service');
      await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    }
    await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await brief();await dialog.locator('#campaign-v3-variations').fill('11');await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).click();assert(await dialog.getByText('Choose 1–10 variations and 1–20 posts per variation.').isVisible());assert.equal(ai.length,0);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.evaluate(()=>state.uiLanguage=language.setUiLanguage('de'));await open();assert(await dialog.getByRole('heading',{name:'Kampagne erstellen',exact:true}).isVisible());await page.keyboard.press('Escape');await page.evaluate(()=>state.uiLanguage=language.setUiLanguage('en'));
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await page.setViewportSize({width:320,height:280});await brief();await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).scrollIntoViewIfNeeded();assert(await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).isVisible());await page.keyboard.press('Escape');await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:900});
    if(baseline){assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);console.log('BW-36.14 context/logo/roles/singleton/two-step DOM/themes/reflow regression passed.');return;}
    await page.evaluate(()=>{
      window.r1Trace={steps:[],quality:0,repair:0,scroll:0,commit:0};
      const q=evaluateCampaignV3Quality;evaluateCampaignV3Quality=(...args)=>{window.r1Trace.quality++;return q(...args);};
      const repair=runCampaignV3QualityRepairLoop;runCampaignV3QualityRepairLoop=(...args)=>{window.r1Trace.repair++;return repair(...args);};
      const progress=updateCampaignV3CreationProgress;updateCampaignV3CreationProgress=(...args)=>{window.r1Trace.steps.push(args[1]);return progress(...args);};
      const scroll=scrollCampaignV3ActiveStepIntoView;scrollCampaignV3ActiveStepIntoView=(...args)=>{window.r1Trace.scroll++;return scroll(...args);};
      const commit=CampaignGeneratorV3.commitCampaignV3PlanToCanvas;CampaignGeneratorV3.commitCampaignV3PlanToCanvas=(...args)=>{window.r1Trace.commit++;return commit(...args);};
      state.brandCore.brandDNA={userApproved:true,avatar:{userApproved:true,imageUrl:'/fixture-avatar.png'}};
    });
    await structure();aiFail=true;await generate();await dialog.locator('#campaign-v3-error-retry').waitFor();assert.equal(await page.evaluate(()=>state.nodes.length),0);assert.equal(posts.length,0);
    aiFail=false;r.options.saveFail=true;await dialog.locator('#campaign-v3-error-retry').click();
    await dialog.getByText('Campaign generated, but not saved yet.',{exact:true}).waitFor();
    assert.deepEqual(await counts(),expected);assert.equal(ai.length,2);assert.equal(posts.length,1);assert.equal(r.db.boards[0].canvas_json.nodes.length,0);assert.equal(await dialog.locator('#campaign-v3-reveal').count(),0);
    assert.equal(await dialog.locator('#campaign-v3-error-retry').innerText(),'Retry Save');assert(await dialog.locator('#campaign-v3-error-close').isDisabled());
    await page.screenshot({path:'work/bw36-14r1-save-retry.png'});await checkReflow();r.options.saveFail=false;saveHold={};
    await dialog.locator('#campaign-v3-error-retry').click();await page.waitForFunction(()=>document.querySelector('[data-campaign-v3-live-status]')?.textContent==='Saving campaign...');
    await page.waitForFunction(()=>window.r1Trace.commit===1);assert.equal(await dialog.locator('.campaign-v3-avatar img').count(),1);
    assert.equal(await dialog.locator('[data-campaign-v3-step]').count(),9);assert.equal(await dialog.locator('#campaign-v3-reveal').count(),0);
    await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);
    await checkReflow();await page.screenshot({path:'work/bw36-14r1-loading.png'});await page.waitForTimeout(100);assert(saveHold.release);saveHold.release();saveHold=null;await dialog.locator('#campaign-v3-reveal').waitFor();assert(await dialog.getByRole('heading',{name:'Your campaign is ready'}).isVisible());await checkReflow();await page.screenshot({path:'work/bw36-14r1-ready.png'});await reveal();await page.waitForTimeout(4500);assert.deepEqual(boardWrites,[]);
    assert.equal(ai.length,2);assert.equal(posts.length,2);assert.deepEqual(posts[0],posts[1]);assert.equal(r.writes(),1);
    assert.deepEqual(await counts(),expected);assert.equal(r.db.boards[0].canvas_json.nodes.length,13);assert.equal(r.db.boards[0].canvas_json.edges.length,17);
    const trace=await page.evaluate(()=>window.r1Trace);assert(trace.quality>0);assert(trace.repair>0);assert(repairs.length>0);assert(trace.scroll>=9);assert.equal(trace.commit,1);assert.deepEqual([...new Set(trace.steps)].sort(),[0,1,2,3,4,5,6,7,8]);
    assert.equal(page.url(),`http://localhost/boards/${D}`);assert(!(await page.evaluate(()=>window.testViews)).includes('boards_library'));assert.deepEqual(boardWrites,[]);
    await page.screenshot({path:'work/bw36-14r1-complete-canvas.png'});
    await page.reload();await page.waitForFunction(()=>state.currentBoardId&&!state.isBoardLoading&&state.workspaceCatalog.status==='ready');assert.deepEqual(await counts(),expected);assert.equal(await page.evaluate(()=>state.edges.length),17);
    await page.evaluate(()=>{setAppMode('canvas');setActiveView('board');state.isDirty=false;window.originalOpen=openCreatedCampaign;openCreatedCampaign=()=>{throw new Error('Fixture local reconciliation failure');};});
    await structure();await generate();await dialog.getByText('Your campaign is saved. Try opening it again.',{exact:true}).waitFor();const sent=posts.length,generated=ai.length;assert.equal(r.writes(),2);assert(await dialog.getByRole('link',{name:'Open campaign',exact:true}).isVisible());
    await page.evaluate(()=>openCreatedCampaign=window.originalOpen);await dialog.locator('#campaign-v3-error-retry').click();await reveal();assert.equal(posts.length,sent);assert.equal(ai.length,generated);
    // Double-submit through the actual form/button during a delayed AI request.
    await structure();aiHold={};await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).evaluate(b=>{const f=b.form;b.click();b.click();f.requestSubmit();f.requestSubmit();});await page.waitForTimeout(100);
    const aiCount=ai.length;await page.evaluate(()=>{el.createCampaignButton.click();el.createCampaignButton.click();});assert.equal(await dialog.count(),1);assert.equal(ai.length,aiCount);
    await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);assert(aiHold.release);aiHold.release();aiHold=null;await reveal();assert.equal(ai.length,aiCount);assert.equal(r.writes(),3);
    // An unusable save response replays only the immutable complete save, never AI.
    invalidResponse=true;await structure();await generate();await dialog.getByText('Campaign generated, but not saved yet.',{exact:true}).waitFor();const retryInput=posts.at(-1),beforeAi=ai.length;invalidResponse=false;await dialog.locator('#campaign-v3-error-retry').click();await reveal();assert.deepEqual(posts.at(-1),retryInput);assert.equal(ai.length,beforeAi);assert.equal(r.writes(),4);
    // A changed identity while awaiting AI may not commit or persist stale nodes.
    for(const mutate of [()=>state.boardLoadGeneration++,()=>state.user={...state.user},()=>state.workspaceCatalog.activeWorkspaceId='other',()=>state.boardBrandAssociation.brandId='other',()=>state.session.brandId='other',()=>state.user.email='other@example.test',()=>state.workspaceCatalog.generation++]){
      await page.reload();await page.waitForFunction(()=>state.currentBoardId&&!state.isBoardLoading&&state.workspaceCatalog.status==='ready');await page.evaluate(()=>{setAppMode('canvas');setActiveView('board');state.isDirty=false;});
      const before=await page.evaluate(()=>state.nodes.length),savedCount=posts.length;await structure();aiHold={};await generate();await page.waitForTimeout(100);await page.evaluate(mutate);assert(aiHold.release);aiHold.release();aiHold=null;await dialog.locator('#campaign-v3-error-close').waitFor();assert.equal(await page.evaluate(()=>state.nodes.length),before);assert.equal(posts.length,savedCount);assert(await dialog.locator('#campaign-v3-error-retry').isDisabled());await dialog.locator('#campaign-v3-error-close').click();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);assert.equal(r.storageRequests.length,0);assert.deepEqual(boardWrites,[]);
    console.log('BW-36.14R1 Chromium passed: 13 nodes / 17 edges, real V3 adapter, quality/repair, nine animated steps/avatar/scroll, AI retry, save-only retry, confirmed reconciliation retry, immutable response replay, refresh hydration, context changes, themes/reflow, zero external calls.');
  }finally{await browser.close();}
}
module.exports={server,browser};
if(require.main===module)(async()=>{await server();await browser();})().catch(e=>{console.error(e);process.exitCode=1;});
