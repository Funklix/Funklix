#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { learningRuntime } = require('./fixtures/bw36-17-local-runtime');
const { B, W, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
let chromium;
try { ({chromium}=require('playwright-core')); } catch { ({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const ROOT=path.resolve(__dirname,'..'), URL_PATH=`/api/brands/${B}/learnings`;
async function contracts() {
  const r=learningRuntime(), s=r.service, before=clone(r.base.db);
  assert.equal(s.normalizeText('  Ｈello\n\tworld  ',2000),'Hello world');
  assert.equal(s.statementKey(s.normalizeText(' CAFÉ ',2000)),s.statementKey(s.normalizeText('cafe\u0301',2000)));
  for (const statement of ['', 'x'.repeat(2001), '\ud800', '\u0000'])assert.throws(()=>s.inputRequest({statement,expected_brand_revision:'1'},true));
  for(const forbidden of ['status','source_type','reviewed_by_identity_id','proposed_by_identity_id','source_board_id','source_node_id'])assert.throws(()=>s.inputRequest({statement:'Valid',expected_brand_revision:'1',[forbidden]:'approved'},true));
  assert.throws(()=>s.inputRequest({statement:'Valid'},true));
  assert.throws(()=>s.inputRequest({action:'approve',learning_id:B},false));
  assert.equal(s.revision('9223372036854775807'),'9223372036854775807');assert.throws(()=>s.revision('9223372036854775808'));
  const call=(method,body,user)=>r.request(method,URL_PATH,body,user);
  const create=async statement=>{const res=await call('POST',{statement,expected_brand_revision:'1',evidence_summary:'Human evidence'});assert.equal(res.statusCode,201,JSON.stringify(res.body));return res.body.learning;};
  const action=async (row,action,extra={})=>call('PATCH',{action,learning_id:row.id,expected_revision:row.revision,...extra});
  assert.equal((await call('GET',null,null)).statusCode,401);
  for(const identity of ['disabled','missing','ambiguous']){r.db.identity=identity;assert.equal((await call('GET')).body.error.code,'IDENTITY_INVALID');}r.db.identity='active';
  for(const role of ['owner','admin','editor','viewer']) {r.db.role=role;const res=await call('GET');assert.equal(res.statusCode,200);assert.equal(res.body.can_write,role!=='viewer');}
  assert.equal((await call('POST',{statement:'Viewer write',expected_brand_revision:'1'})).body.error.code,'BRAND_ACCESS_DENIED');
  r.db.role=null;assert.equal((await call('GET')).body.error.code,'BRAND_UNAVAILABLE');r.db.role='owner';
  assert.equal((await call('GET',null,{email:'board-only@example.test'})).statusCode,403);
  assert.equal((await call('GET',null,{email:'public-token@example.test'})).statusCode,403);
  const a=await create('Use confirmed examples');assert.equal(a.status,'proposed');assert.equal(a.revision,'0');assert.equal(r.db.events[0].event_type,'proposed');
  assert.equal((await call('POST',{statement:' USE\nCONFIRMED examples ',expected_brand_revision:'1'})).body.error.code,'DUPLICATE_PROPOSAL');
  let res=await action(a,'edit',{statement:'Use confirmed customer examples',evidence_summary:'Reviewed evidence'});assert.equal(res.statusCode,200);const edited=res.body.learning;assert.equal(edited.revision,'1');
  assert.equal((await action(a,'reject')).body.error.code,'STALE_LEARNING_REVISION');
  r.db.failEvent=true;assert.equal((await action(edited,'approve')).body.error.code,'INTERNAL_ERROR');assert.equal(r.db.learnings[0].status,'proposed');r.db.failEvent=false;
  res=await action(edited,'approve');assert.equal(res.statusCode,200);const approved=res.body.learning;assert.equal(approved.status,'approved');assert(r.db.learnings[0].reviewed_by_identity_id);assert(r.db.learnings[0].reviewed_at);
  assert.equal((await call('POST',{statement:'use confirmed customer examples',expected_brand_revision:'1'})).body.error.code,'DUPLICATE_APPROVED_LEARNING');
  res=await action(approved,'edit',{statement:'Use confirmed customer examples with context'});const successor=res.body.learning;assert.equal(successor.status,'proposed');assert.equal(successor.supersedes_learning_id,approved.id);assert.equal(r.db.learnings[0].status,'approved');assert.equal(r.db.learnings[0].statement,approved.statement);
  r.db.failCommit=true;assert.equal((await action(successor,'approve')).statusCode,503);assert.equal(r.db.learnings[0].status,'approved');assert.equal(r.db.learnings[1].status,'proposed');r.db.failCommit=false;
  res=await action(successor,'approve');assert.equal(res.statusCode,200);const successorApproved=res.body.learning;assert.equal(r.db.learnings[0].status,'archived');assert(r.db.events.some(e=>e.event_type==='superseded'));assert(r.db.events.some(e=>e.event_type==='archived'));
  const rejection=await create('Reject this proposal');res=await action(rejection,'reject');assert.equal(res.body.learning.status,'rejected');assert.equal((await action(res.body.learning,'approve')).body.error.code,'INVALID_LIFECYCLE_TRANSITION');
  const race=await create('Concurrent proposal');const raceResult=await Promise.all([action(race,'edit',{statement:'First update'}),action(race,'edit',{statement:'Second update'})]);assert.deepEqual(raceResult.map(r=>r.statusCode).sort(),[200,409]);
  assert.equal((await action(successorApproved,'archive')).body.learning.status,'archived');
  for(const role of ['admin','editor']){r.db.role=role;const p=await create(`Role ${role}`);assert.equal((await action(p,'approve')).statusCode,200);}r.db.role='owner';
  const evidenceOriginal=clone(r.db.learnings.at(-1));
  const evidenceSuccessor=(await action(evidenceOriginal,'edit',{statement:evidenceOriginal.statement,evidence_summary:'Updated confirmed evidence'})).body.learning;
  assert.equal(evidenceSuccessor.status,'proposed');
  const evidenceEdited=(await action(evidenceSuccessor,'edit',{statement:evidenceOriginal.statement,evidence_summary:'Final confirmed evidence'})).body.learning;
  assert.equal((await action(evidenceEdited,'approve')).statusCode,200,'Evidence-only successor archives its matching predecessor before approval');
  assert.equal(r.db.learnings.find(l=>l.id===evidenceOriginal.id).status,'archived');
  assert.equal((await r.request('GET',URL_PATH+'?status=invalid')).body.error.code,'INVALID_REQUEST');
  assert.equal((await r.request('GET',URL_PATH+'?offset=10001')).body.error.code,'INVALID_REQUEST');
  r.db.missingSchema=true;const missing=await call('GET');assert.equal(missing.statusCode,503);assert.equal(missing.body.error.code,'SCHEMA_UNAVAILABLE');assert(!JSON.stringify(missing.body).includes('private'));r.db.missingSchema=false;
  assert.deepEqual(clone(r.base.db),before,'No Brand/Board/Core/snapshot/catalog mutation');
  assert(r.db.queries.some(q=>q.sql.includes('FOR UPDATE OF b')));assert(r.db.queries.some(q=>q.sql.includes('FROM public.brand_members')&&q.sql.includes('FOR SHARE')));
  const sql=fs.readFileSync('migrations/20261011_bw36_17_governed_brand_learnings.sql','utf8');
  for(const contract of ['ENABLE ROW LEVEL SECURITY','FROM PUBLIC, anon, authenticated','ON DELETE CASCADE','learning_history_immutable','learning_approved_immutable','FOREIGN KEY (brand_id, supersedes_learning_id)','brand_learnings_approved_key','brand_learnings_proposal_key'])assert(sql.includes(contract),contract);
  assert(!/CREATE POLICY|auth\.uid|auth\.users|UPDATE public\.(brands|boards|workspaces)|INSERT INTO public\.(brands|boards|workspaces)/.test(sql));
  for(const code of ['AUTHENTICATION_REQUIRED','IDENTITY_INVALID','BRAND_UNAVAILABLE','BRAND_ACCESS_DENIED','LEARNING_UNAVAILABLE','INVALID_REQUEST','INVALID_STATEMENT','DUPLICATE_PROPOSAL','DUPLICATE_APPROVED_LEARNING','STALE_LEARNING_REVISION','INVALID_LIFECYCLE_TRANSITION','SCHEMA_UNAVAILABLE','DATABASE_UNAVAILABLE','INTERNAL_ERROR'])assert(require('../brand-learnings').COPY[code]);
  console.log('PASS BW-36.17 production route/service: signed sessions, active identity, Brand roles, strict input, Unicode, duplicates, atomic events, rollback, successor, stale race, schema failure, bounded privacy and unchanged related data.');
}
async function browserChecks() {
  const r=learningRuntime(), base=r.base;
  base.db.brands[0].brand_core.brandDNA={userApproved:true,primaryArchetype:'Sage',secondaryArchetype:'Creator',avatar:{userApproved:true,imageUrl:'/fixture-avatar.png'}};
  const before=clone({brands:base.db.brands,boards:base.db.boards,commands:base.db.commands}), dialogs=[], errors=[], network=[];
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    async function boot(context, readOnly=false) {
      const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.type());void d.dismiss();});
      await page.route('**/*',async route=>{
        const req=route.request(),url=new URL(req.url());network.push({method:req.method(),path:url.pathname});assert.equal(url.hostname,'localhost','No AI/provider/production traffic');
        if(url.pathname.endsWith('/learnings')){const res=await r.request(req.method(),url.href,req.postDataJSON()||undefined);return route.fulfill({status:res.statusCode,json:res.body});}
        if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:null}});
        if(url.pathname==='/api/workspaces/catalog')return route.fulfill({json:base.catalog()});
        if(url.pathname==='/api/brands'&&req.method()==='GET')return route.fulfill({json:{brands:base.catalog().workspaces[0].brands.map(b=>({...b,created_at:'2026-10-11T08:00:00Z',updated_at:'2026-10-11T08:00:00Z'}))}});
        if(/^\/api\/brands\/[^/]+$/.test(url.pathname)){const res=await base.request(req.method(),url.pathname,req.postDataJSON()||undefined);if(readOnly&&res.body?.access)res.body.access={...res.body.access,role:'viewer',canEditCanonicalBrand:false};return route.fulfill({status:res.statusCode,json:res.body});}
        if(url.pathname.startsWith('/api/'))return route.fulfill({json:{boards:[],members:[],nodes:[],editors:[],presence:[]}});
        if(url.pathname==='/fixture-avatar.png')return route.fulfill({contentType:'image/png',body:base.png});
        const file=path.resolve(ROOT,url.pathname==='/'?'index.html':'.'+url.pathname);return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
      });
      await page.goto('http://localhost/');await page.waitForFunction(()=>typeof state!=='undefined'&&!!workspaceSidebarController);
      await page.evaluate(({catalog,W,B,EMAIL})=>{state.user={email:EMAIL};state.workspaceCatalog={...state.workspaceCatalog,identity:EMAIL,value:catalog,status:'ready',activeWorkspaceId:W};state.session.workspaceId=W;state.session.brandId=B;state.currentBoardId=null;state.session.boardId=null;state.publicBoardToken=null;state.brandCatalog={...state.brandCatalog,status:'success',userEmail:EMAIL,entries:catalog.workspaces[0].brands};state.boardAccess={canView:true,canEdit:true,canViewBoardBrandCore:true};state.isDirty=false;setActiveView('home');setSidebarCollapsed(false);renderWorkspaceSidebar();},{catalog:base.catalog(),W,B,EMAIL});
      return page;
    }
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await boot(context);
    const key=k=>page.locator(`[data-profile-key="${k}"]`), library=page.locator('.brand-learnings'), dialog=page.locator('.brand-learning-dialog');
    const act=(scope,k)=>scope.locator(`[data-learning-action="${k}"]`);
    async function open() {await page.locator('#brand-core-nav-btn').click();await page.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready'&&!brandProfileController.busy());await key('Brand Learnings').click();await act(library,'add').waitFor();}
    async function create(text) {await act(library,'add').click();await dialog.locator('[data-learning-field="statement"]').fill(text);await dialog.locator('[data-learning-field="evidence"]').fill('Explicit human evidence');await act(dialog,'save').click();await dialog.waitFor({state:'detached'});}
    const card=id=>library.locator(`[data-learning-id="${id}"]`);
    await open();assert(await library.getByText('No learnings yet.',{exact:false}).isVisible());
    await create('Use clear customer examples');let row=r.db.learnings[0];assert(await card(row.id).getByText('Needs review',{exact:true}).isVisible());
    await page.locator('#home-nav-btn').click();assert.equal(await page.locator('#brand-leave-dialog').count(),0);await open();assert(await card(row.id).isVisible());
    await act(card(row.id),'edit').click();await dialog.locator('[data-learning-field="statement"]').fill('Use clear confirmed customer examples');await act(dialog,'save').click();await dialog.waitFor({state:'detached'});assert.equal(r.db.learnings[0].revision,'1');assert.equal(await page.evaluate(()=>brandProfileController.dirty()),false);
    await act(card(row.id),'approve').click();assert(await dialog.getByText(base.db.brands[0].name,{exact:true}).isVisible());assert(await dialog.getByText('It becomes reusable Brand knowledge.',{exact:true}).isVisible());await act(dialog,'approve').click();await dialog.waitFor({state:'detached'});assert.equal(r.db.learnings[0].status,'approved');
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined');await page.close();const fresh=await boot(context); // Full app reload with a fresh authorized context restores durable fixture state.
    // Continue with fresh app via the same production selectors.
    await fresh.locator('#brand-core-nav-btn').click();await fresh.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready');await fresh.locator('[data-profile-key="Brand Learnings"]').click();await fresh.locator('.brand-learnings [data-learning-action="add"]').waitFor();
    assert(await fresh.locator(`[data-learning-id="${row.id}"]`).getByText('Approved',{exact:true}).isVisible());
    const lib=fresh.locator('.brand-learnings'),dlg=fresh.locator('.brand-learning-dialog'),c=id=>lib.locator(`[data-learning-id="${id}"]`);
    await act(lib,'add').click();await dlg.locator('[data-learning-field="statement"]').fill(' USE clear CONFIRMED customer examples ');await act(dlg,'save').click();await dlg.getByText('This learning is already approved.',{exact:true}).waitFor();await act(dlg,'cancel').click();await act(dlg,'discardAction').click();
    await act(c(row.id),'update').click();await dlg.locator('[data-learning-field="statement"]').fill('Use clear confirmed customer examples with context');await act(dlg,'save').click();await dlg.waitFor({state:'detached'});assert.equal(r.db.learnings[0].status,'approved');let successor=r.db.learnings[1];assert.equal(successor.status,'proposed');await act(c(successor.id),'approve').click();await act(dlg,'approve').click();await dlg.waitFor({state:'detached'});assert.equal(r.db.learnings[0].status,'archived');assert.equal(r.db.learnings[1].status,'approved');
    await act(lib,'add').click();await dlg.locator('[data-learning-field="statement"]').fill('Unconfirmed proposal');await act(dlg,'save').click();await dlg.waitFor({state:'detached'});const rejected=r.db.learnings[2];await act(c(rejected.id),'reject').click();await fresh.keyboard.press('Escape');assert.equal(r.db.learnings[2].status,'proposed','Closing rejection is not rejection');await act(c(rejected.id),'reject').click();await act(dlg,'reject').click();await dlg.waitFor({state:'detached'});assert.equal(r.db.learnings[2].status,'rejected');
    await act(lib,'rejected').click();assert(await c(rejected.id).getByText('Inactive Brand knowledge',{exact:true}).isVisible());await act(lib,'active').click();
    await act(c(successor.id),'archive').click();assert(await dlg.getByText('It remains in history',{exact:false}).isVisible());await act(dlg,'archive').click();await dlg.waitFor({state:'detached'});assert.equal(r.db.learnings[1].status,'archived');await act(lib,'archived').click();assert(await c(successor.id).isVisible());await c(row.id).locator('summary').click();assert(await c(row.id).getByText('Superseded by an approved update',{exact:false}).isVisible());
    await act(lib,'active').click();await act(lib,'add').click();await dlg.locator('[data-learning-field="statement"]').fill('Concurrent example');await act(dlg,'save').click();await dlg.waitFor({state:'detached'});const concurrent=r.db.learnings[3];
    await act(c(concurrent.id),'edit').click();await dlg.locator('[data-learning-field="statement"]').fill('Unsaved local text');
    const secondContext=await browser.newContext(),second=await boot(secondContext);await second.locator('#brand-core-nav-btn').click();await second.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready');await second.locator('[data-profile-key="Brand Learnings"]').click();const secondCard=second.locator(`[data-learning-id="${concurrent.id}"]`);await act(secondCard,'edit').click();await second.locator('[data-learning-field="statement"]').fill('Saved from second context');await act(second.locator('.brand-learning-dialog'),'save').click();await second.locator('.brand-learning-dialog').waitFor({state:'detached'});
    await act(dlg,'save').click();await dlg.getByText('This learning changed.',{exact:false}).waitFor();assert.equal(r.db.learnings[3].statement,'Saved from second context');await act(dlg,'reload').click();await dlg.getByText('Your text is retained.',{exact:false}).waitFor();assert.equal(await dlg.locator('[data-learning-field="statement"]').inputValue(),'Unsaved local text');await act(dlg,'save').click();await dlg.waitFor({state:'detached'});assert.equal(r.db.learnings[3].statement,'Unsaved local text');await secondContext.close();
    // No-op editor cancellation, actual-dirty discard, keyboard focus restoration.
    await act(c(concurrent.id),'edit').click();await fresh.keyboard.press('Escape');assert.equal(await dlg.count(),0);assert.equal(await c(concurrent.id).locator('[data-learning-action="edit"]').evaluate(el=>el===document.activeElement),true);
    for(const lang of ['en','de'])for(const theme of ['light','dark'])for(const width of [1440,1024,768,480,375,320,720]) {
      await fresh.setViewportSize({width,height:width===720?450:900});await fresh.evaluate(({lang,theme})=>{state.uiLanguage=language.setUiLanguage(lang);document.documentElement.dataset.theme=theme;brandProfileController.render();},{lang,theme});
      assert(await lib.getByText(lang==='de'?'Bestätigtes Markenwissen aus Erfahrungen aufbauen.':'Build reusable Brand knowledge from confirmed experience.',{exact:true}).isVisible());
      await act(lib,'add').click();const box=await dlg.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await fresh.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await fresh.keyboard.press('Tab');assert(await dlg.evaluate(el=>el.contains(document.activeElement)));await fresh.keyboard.press('Shift+Tab');await fresh.keyboard.press('Escape');
      assert.equal(await fresh.evaluate(()=>brandProfileController.dirty()),false);
    }
    await fresh.evaluate(()=>{state.uiLanguage=language.setUiLanguage('en');brandProfileController.render();});
    await fresh.locator('[data-profile-key="Brand DNA"]').click();assert(await fresh.getByText('Sage',{exact:true}).first().isVisible());await fresh.locator('[data-profile-key="Brand Avatar"]').click();assert(await fresh.locator('.profile-brand-avatar').isVisible());assert(await fresh.locator('.guided-brand-profile .profile-logo').isVisible());await fresh.locator('[data-profile-key="Brand Learnings"]').click();await fresh.locator('#home-nav-btn').click();assert.equal(await fresh.locator('#brand-leave-dialog').count(),0);
    r.db.role='viewer';const viewerContext=await browser.newContext(),viewer=await boot(viewerContext,true);await viewer.locator('#brand-core-nav-btn').click();await viewer.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready');await viewer.locator('[data-profile-key="Brand Learnings"]').click();await viewer.getByText('You can view Learnings. Your access is read-only.',{exact:true}).waitFor();assert.equal(await viewer.locator('.brand-learnings [data-learning-action="add"]').count(),0);assert.equal(await viewer.locator('.learning-card .learning-actions').count(),0);await viewerContext.close();r.db.role='owner';
    // Missing migration has one bounded request, preserves the rest of the Profile.
    r.db.missingSchema=true;const missingContext=await browser.newContext(),missing=await boot(missingContext);await missing.locator('#brand-core-nav-btn').click();await missing.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready');const calls=r.requests.length;await missing.locator('[data-profile-key="Brand Learnings"]').click();await missing.getByText('Learnings are temporarily unavailable.',{exact:false}).waitFor();await missing.locator('[data-profile-key="Overview"]').click();assert(await missing.locator('.guided-brand-profile .profile-logo').isVisible());await missing.locator('[data-profile-key="Brand Learnings"]').click();assert.equal(r.requests.length,calls+1,'No repeated unavailable request loop');await missingContext.close();
    // The actual Profile entry resolver rejects Board-only and public-token contexts.
    for (const publicToken of [false,true]) {
      const deniedContext=await browser.newContext(),denied=await boot(deniedContext);
      await denied.evaluate(({B,publicToken})=>{state.workspaceCatalog.value.workspaces[0].brands=[];state.session.brandId=null;state.currentBoardId=state.workspaceCatalog.value.workspaces[0].boards[0].id;state.session.boardId=state.currentBoardId;state.publicBoardToken=publicToken?'invented-public-token':null;state.boardAccess={canView:true,canEdit:!publicToken,canViewBoardBrandCore:true};openRegularBrandProfile();},{B,publicToken});
      assert.equal(await denied.locator('.brand-learnings').count(),0,'No reusable Learning Library for Board-only/public-token context');
      await deniedContext.close();
    }
    assert.deepEqual(clone({brands:base.db.brands,boards:base.db.boards,commands:base.db.commands}),before);assert(!network.some(n=>/generate|openai|analyze|insights/.test(n.path)));assert(!network.some(n=>n.method!=='GET'&&!n.path.endsWith('/learnings')));assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
    console.log('PASS BW-36.17 authenticated Chromium: durable lifecycle, duplicate, successor, two-context stale recovery, viewer, clean navigation, schema-unavailable isolation, preserved DNA/Avatar/logo, EN/DE × light/dark × 1440/1024/768/480/375/320/720x450 reflow, keyboard/Escape/focus restoration, no overflow/native dialogs/provider calls/unrelated writes.');
  } finally {await browser.close();}
}
(async()=>{await contracts();await browserChecks();console.log('BW-36.17 passed. All rows are invented local fixtures; no production SQL, AI/provider requests or real data mutation.');})().catch(e=>{console.error(e);process.exitCode=1;});
