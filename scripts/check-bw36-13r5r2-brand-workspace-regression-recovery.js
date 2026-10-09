#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { runtime, W, B, D, EMAIL, png, clone } = require('./fixtures/bw36-13r5-local-runtime');
const profile = require('../brand-profile-setup');
const M = '55555555-5555-4555-8555-555555555555';
function seed(r) {
  r.db.brands[0].name='Appics';
  Object.assign(r.db.brands[0].brand_core, {
    brandDNA: {primaryArchetype:'Sage',secondaryArchetype:'Creator',personality:'Wise',positioning:'Trusted',userApproved:true,signals:{toneSignals:['Clear']},avatar:{imageUrl:'https://example.test/accepted.png',prompt:'Wise guide',style:'editorial',userApproved:true,unknownAsset:{keep:true}},futureDna:{keep:['all']}},
    positioning:{strategy:'Trusted'},personas:[{name:'Audience',note:'Needs',unknown:{keep:true}}],
    offers:[{proof:'Evidence'}],references:['https://example.test/'],provenance:{source:'fixture',revision:10},unknown:{deep:['preserve',{x:1}]}
  });
  r.db.brands.push({...clone(r.db.brands[0]),id:M,name:'markmans',brand_core:{unknown:{incomplete:true}}});
}
async function boundaries() {
  const r=runtime();seed(r);const snapshot=clone(r.db.boards), initial=clone(r.db.brands[0].brand_core);
  const fetchImpl=async(url,init={})=>{const res=await r.request(init.method||'GET',url,init.body?JSON.parse(init.body):undefined);return{status:res.statusCode,ok:res.statusCode<300,json:async()=>res.body};};
  let context={account:{},generation:1,brandId:B,workspaceId:W,authorized:true};
  const make=async(overrides={})=>profile.createSession({brand:(await r.request('GET',`/api/brands/${B}`)).body,getContext:()=>context,fetchImpl,validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision)&&b.brand_core&&b.access,requestId:()=> 'recovery-logo',onSave(){},onLogo(){},...overrides});
  let s=await make();assert.equal(s.dirty(),false);s.state.name='Appics updated';assert(await s.save());assert.equal(s.dirty(),false);assert.deepEqual(r.db.brands[0].brand_core,initial);assert.deepEqual(clone(r.db.boards),snapshot);
  s.state.core.brandDNA.positioning='Confirmed DNA';assert(s.dirty());assert(await s.save());assert.equal((await make()).state.core.brandDNA.positioning,'Confirmed DNA');
  const accepted=clone(s.state.core.brandDNA.avatar);assert(await s.generateDna());assert.deepEqual(s.state.core.brandDNA.avatar,accepted);assert(await s.acceptDna());assert.deepEqual(s.state.core.brandDNA.avatar,accepted);assert.deepEqual(s.state.core.brandDNA.futureDna,{keep:['all']});
  assert(await s.generateAvatar());assert.deepEqual(s.state.core.brandDNA.avatar,accepted,'Generation is a proposal and keeps accepted asset');assert.equal(s.state.avatarDraft.userApproved,false);assert(!s.dirty());assert(await s.acceptAvatar());assert.equal(s.dirty(),false);assert.equal((await make()).state.core.brandDNA.avatar.imageUrl,'https://example.test/generated-avatar.png');assert.deepEqual(s.state.core.brandDNA.avatar.unknownAsset,{keep:true});assert.equal(s.state.brand.logo_url,null,'Avatar is not a logo');
  const file={type:'image/png',size:png.length,name:'logo.png'};await s.chooseFile(file,async()=>png.toString('base64'));r.setMissingSecret(true);assert.equal(await s.upload(),false);assert.equal(s.state.file,file);assert(!s.dirty());r.setMissingSecret(false);assert(await s.upload());assert.equal(s.state.file,null);assert.equal(s.dirty(),false);assert.equal(s.state.brand.logo_revision,1);assert.equal(r.objects.size,1);assert.equal((await make()).state.brand.logo_url,`/api/brands/${B}/logo?revision=1`);assert.equal(r.catalog().workspaces[0].brands[0].logo_url,s.state.brand.logo_url);
  s=await make({onSave(){throw Error('renderer');}});s.state.core.brandCore='Persisted despite renderer';assert(await s.save());assert(!s.dirty());assert(s.state.message.includes('Refresh'));
  s=await make({fetchImpl:async(url,init)=>init?.method==='PUT'?fetchImpl(url,init):{ok:false,status:503,json:async()=>({})}});s.state.name='Stored but unverified';assert.equal(await s.save(),false);assert(s.dirty());assert.equal(r.db.brands[0].name,'Stored but unverified');
  s=await make();s.state.website='https://example.test/';assert(await s.analyze());assert(s.state.candidate);assert.equal(r.db.brands[0].logo_revision,1,'Unconfirmed candidate cannot overwrite');assert.equal(await s.useLogo(),false,'Manual upload retains priority');assert.equal(r.db.brands[0].logo_revision,1);assert(await s.removeLogo());assert(await s.useLogo()===false,'Remove clears old candidate');
  s=await make();s.state.website='https://example.test/';assert(await s.analyze());assert(await s.useLogo());assert.equal(r.db.brands[0].logo_source,'discovered');assert.equal(r.db.brands[0].logo_revision,3);
  const before=clone(r.db);const blocked=await r.request('DELETE',`/api/brands/${B}`,{confirmationName:r.db.brands[0].name,boardCount:0});assert.equal(blocked.statusCode,409);assert.equal(blocked.body.boardCount,1);assert.deepEqual(clone(r.db.brands),before.brands);assert.deepEqual(clone(r.db.boards),snapshot);
  const mark=await r.request('DELETE',`/api/brands/${M}`,{confirmationName:'markmans'});assert.equal(mark.body.deletedBrandId,M);assert.equal(r.db.brands.length,1);assert.deepEqual(clone(r.db.boards),snapshot);
  for(const role of ['admin','editor','viewer']){r.db.brands[0].owner_email='other@example.test';r.db.brandRole=role;const next=await make();next.state.name='Role '+role;assert.equal(await next.save(),role!=='viewer');const result=await r.request('POST','/api/generate-brand-avatar',{brandId:B,revision:r.db.brands[0].revision});assert.equal(result.statusCode,role==='viewer'?403:200);assert.equal((await r.request('DELETE',`/api/brands/${B}`,{confirmationName:r.db.brands[0].name})).statusCode,404);}
  r.db.brandRole='viewer';r.db.workspaceRole='owner';assert.equal((await r.request('POST','/api/discover-brand-dna',{brandId:B,revision:r.db.brands[0].revision})).statusCode,403,'Workspace owner cannot infer Brand rights');assert.equal((await r.request('POST','/api/generate-brand-avatar',{brandId:B,revision:1},null)).statusCode,401);
  s=await make();context={...context,account:{}};assert.equal(await s.save(),false);s.invalidate();assert.equal(s.state.avatarDraft,null);assert.deepEqual(s.state.core,{});
  const reads=r.requests.filter(x=>x.method==='GET'&&x.path===`/api/brands/${B}`);assert(reads.length>10);assert.deepEqual(clone(r.db.boards),snapshot);assert(r.db.queries.every(q=>!/CREATE TABLE|ALTER TABLE|DROP TABLE|UPDATE boards SET brand_id/.test(q)));
  const deletionRuntime=runtime();seed(deletionRuntime);const brandBeforeBoardDeletion=clone(deletionRuntime.db.brands);
  assert.equal((await deletionRuntime.request('DELETE',`/api/boards/${D}`)).statusCode,200);
  assert.deepEqual(clone(deletionRuntime.db.brands),brandBeforeBoardDeletion,'Board deletion leaves Brands and DNA/avatar/logo intact');
  assert.equal((await r.request('POST','/api/generate-brand-avatar',{boardId:D},null)).statusCode,401,'No anonymous provider bypass');
  console.log('R5R2 production controllers/routes: canonical/unknown round-trip, DNA save/generate/review, accepted Avatar preservation/reload, logo storage/revision/re-read/retry, website confirmation, dirty baseline, renderer/read failure, roles/session/deletion/snapshot isolation passed.');
}
async function browserJourney() {
  let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core'));}
  const r=runtime();seed(r);const root=path.resolve(__dirname,'..');const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];let native=0;
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{native++;void d.dismiss();});
    await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
      if(url.hostname==='example.test')return route.fulfill({contentType:'image/png',body:png});
      assert.equal(url.hostname,'localhost','No external traffic');
      if(url.pathname.startsWith('/api/')){
        if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:null}});
        if(/^\/api\/(brands\/[^/]+(?:\/logo)?|discover-brand-dna|generate-brand-avatar|analyze-brand-domain)$/.test(url.pathname)){
          const res=await r.request(req.method(),url.pathname,req.postDataJSON()||undefined);return Buffer.isBuffer(res.body)?route.fulfill({status:res.statusCode,contentType:'image/png',body:res.body}):route.fulfill({status:res.statusCode,json:res.body});}
        return route.fulfill({json:{boards:[],brands:r.catalog().workspaces[0].brands,members:[],nodes:[],presence:[]}});
      }
      const file=path.resolve(root,url.pathname==='/'?'index.html':'.'+url.pathname);return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
    });
    async function context(){await page.evaluate(({catalog,W,B,EMAIL})=>{state.user={email:EMAIL};state.publicBoardToken=null;state.currentBoardId=null;state.session.boardId=null;state.session.workspaceId=W;state.session.brandId=B;state.workspaceCatalog={...state.workspaceCatalog,value:catalog,status:'ready',activeWorkspaceId:W};state.brandCatalog={...state.brandCatalog,status:'success',entries:catalog.workspaces[0].brands,userEmail:EMAIL};state.boardAccess={canView:true,canEdit:true};state.isDirty=false;history.replaceState({},'','/');setActiveView('home');setSidebarCollapsed(false);renderWorkspaceSidebar();},{catalog:r.catalog(),W,B,EMAIL});}
    await page.goto('http://localhost/');await page.waitForFunction(()=>typeof state!=='undefined'&&workspaceSidebarController);await context();
    const before=clone(r.db.brands[0]), snapshot=clone(r.db.boards);
    await page.locator('#workspace-brand-trigger').click();await page.locator(`[data-brand-action-id="${M}"]`).click();assert.equal(await page.evaluate(()=>state.session.brandId),B);assert(await page.locator('#brand-context-menu').getAttribute('aria-label').then(x=>x.includes('markmans')));
    await page.getByRole('menuitem',{name:'Delete Brand',exact:true}).click();assert((await page.locator('#brand-delete-title').textContent()).includes('markmans'));
    assert(await page.evaluate(()=>Object.isFrozen(brandDeletion.brand)));await page.locator('#brand-delete-submit').click();await page.waitForFunction(id=>!state.workspaceCatalog.value.workspaces[0].brands.some(b=>b.id===id),M);
    assert.equal(r.requests.find(x=>x.method==='DELETE').path,`/api/brands/${M}`);assert.deepEqual(clone(r.db.brands[0]),before);assert.deepEqual(clone(r.db.boards),snapshot);assert.equal(await page.evaluate(()=>state.session.brandId),B);assert.equal(await page.evaluate(()=>state.activeView),'home');
    await page.locator('#workspace-brand-manage').click();await page.getByRole('menuitem',{name:'Delete Brand',exact:true}).click();assert(!(await page.locator('#brand-delete-submit').isVisible()));await page.waitForFunction(()=>document.querySelector('#brand-delete-feedback').textContent.includes('1 project.'));assert.deepEqual(clone(r.db.boards),snapshot);await page.locator('#brand-delete-cancel').click();
    await page.locator('#brand-core-nav-btn').click();await page.waitForFunction(B=>brandProfileController?.state.brand.id===B,B);
    const key=k=>page.locator(`[data-profile-key="${k}"]`);assert.equal(r.requests.filter(x=>/generate-brand-avatar|discover-brand-dna/.test(x.path)).length,0);
    await key('Brand DNA').click();assert(await key('dna-primaryArchetype').isVisible());await key('dna-positioning').fill('Reviewed positioning');await key('Confirm and save Brand Profile').click();await page.waitForFunction(()=>!brandProfileController.dirty());
    await key('Generate Brand DNA').click();
    if (await key('Continue anyway').count()) await key('Continue anyway').click();
    await page.waitForFunction(()=>!!brandProfileController.state.dnaDraft);
    assert.equal(r.db.brands[0].brand_core.brandDNA.avatar.imageUrl,'https://example.test/accepted.png');
    await key('Save Brand DNA').click();await page.waitForFunction(()=>!brandProfileController.dirty());
    await key('Brand Avatar').click();assert.equal(await page.locator('.profile-brand-avatar').getAttribute('src'),'https://example.test/accepted.png');await key('Regenerate Avatar').click();await page.waitForFunction(()=>!!brandProfileController.state.avatarDraft);assert.equal(r.db.brands[0].brand_core.brandDNA.avatar.imageUrl,'https://example.test/accepted.png');await key('Save Avatar').click();await page.waitForFunction(()=>!brandProfileController.dirty());
    await key('Brand Assets').click();await page.locator('[data-profile-key=file]').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});await key('Upload logo').click();await page.waitForFunction(()=>brandProfileController.state.logo==='Logo saved');await key('Confirm and save Brand Profile').click();await page.waitForFunction(()=>!brandProfileController.busy());await page.locator('#home-nav-btn').click();assert.equal(await page.locator('#brand-leave-dialog').count(),0);
    assert.equal(await page.locator('#workspace-brand-avatar img').getAttribute('src'),`/api/brands/${B}/logo?revision=1`);
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&workspaceSidebarController);await context();await page.locator('#brand-core-nav-btn').click();await page.waitForFunction(B=>brandProfileController?.state.brand.id===B,B);
    assert.equal(await page.locator('.profile-logo img').getAttribute('src'),`/api/brands/${B}/logo?revision=1`);assert.equal(await page.evaluate(()=>brandProfileController.state.core.brandDNA.positioning),'Reviewed positioning');await key('Brand Avatar').click();assert.equal(await page.locator('.profile-brand-avatar').getAttribute('src'),'https://example.test/generated-avatar.png');
    for(const theme of ['light','dark'])for(const width of [320,375,768,1440,720]){await page.setViewportSize({width,height:width===720?450:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await key('Brand DNA').click();await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement));}
    await page.evaluate(()=>{state.uiLanguage='de';brandProfileController.render();});assert(await page.getByRole('button',{name:'Markenavatar',exact:true}).isVisible());await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});assert(await page.locator('.guided-brand-profile').isVisible());assert.deepEqual(errors,[]);assert.equal(native,0);assert.deepEqual(clone(r.db.boards),snapshot);
    console.log('R5R2 Chromium: Appics selected/markmans row-target deletion without Board/reload; immutable confirmation; authoritative associated-Board block; structured DNA edits; explicit Avatar review/save; distinct logo; durable reload/sidebar/clean leave; EN/DE, desktop/mobile, themes, keyboard, reflow, forced colors/reduced motion. Mocked I/O only.');
  } finally {await browser.close();}
}
(async()=>{await boundaries();await browserJourney();console.log('BW-36.13R5R2 passed. Migration/SQL: none.');})().catch(e=>{console.error(e);process.exitCode=1;});
