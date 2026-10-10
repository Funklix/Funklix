#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const { runtime, W, B, D, EMAIL, png, clone } = require('./fixtures/bw36-13r5-local-runtime');
const profile = require('../brand-profile-setup'), command = require('../project-command');
const ROOT = path.resolve(__dirname, '..');
async function boundaries() {
  const r = runtime();
  const fetchImpl = async (url, init = {}) => {
    const response = await r.request(init.method || 'GET', url, init.body ? JSON.parse(init.body) : undefined);
    return { status: response.statusCode, ok: response.statusCode < 300, json: async () => response.body };
  };
  const opened = (await r.request('GET', `/api/brands/${B}`)).body;
  const account = {}, options = { brand: opened, getContext: () => ({ account, generation: 1, brandId: B, workspaceId: W, authorized: true }), fetchImpl,
    validateBrand: (b,id) => b?.id === id && b.brand_core && b.access?.canEditCanonicalBrand === true && Number.isSafeInteger(b.revision), requestId: () => 'local-logo', onSave() {}, onLogo() {} };
  const session = profile.createSession(options);
  session.state.website = 'https://example.test/';
  assert.equal(await session.analyze(), true); assert(session.state.candidate); for (const key of Object.keys(session.state.proposals)) await session.applyProposal(key);
  assert.equal(await session.save(), true);
  let loaded = (await r.request('GET', `/api/brands/${B}`)).body;
  assert.equal(loaded.brand_core.brandCore, r.suggestions.brandCore); assert.equal(loaded.brand_core.valueProposition, r.suggestions.valueProposition);
  const snapshot = clone(r.db.boards[0]);
  const discovered = await session.useLogo(); assert.equal(discovered, true); assert.equal(r.objects.size, 1);
  assert.equal(await session.removeLogo(), true); assert.equal(r.objects.size, 0);
  await session.chooseFile({ type: 'image/png', size: png.length, name: 'local-logo.png' }, async () => png.toString('base64'));
  r.setMissingSecret(true);
  assert.equal(await session.upload(), false); assert.equal(session.state.file.name, 'local-logo.png');
  assert.equal(session.state.message, 'Logo storage is temporarily unavailable. Your Brand information can still be saved.');
  const missing = await r.request('POST', `/api/brands/${B}/logo`, { contract: 'brand_logo_v1', request_id: 'missing-secret', action: 'upload', workspace_id: W, expected_revision: 2, mime_type: 'image/png', image_base64: png.toString('base64') });
  assert.equal(missing.statusCode, 503); assert.equal(missing.body.error.code, 'STORAGE_UNAVAILABLE');
  session.state.core.keywords.push('After logo failure'); session.state.dirty = true;
  assert.equal(await session.save(), true); assert(session.state.fileData, 'Optional logo failure retains preview and does not block core save');
  r.setMissingSecret(false); assert.equal(await session.upload(), true); assert.equal(session.state.file, null);
  assert.equal((await r.request('GET', `/api/brands/${B}/logo`)).statusCode, 200);
  assert.deepEqual(r.db.boards[0], snapshot, 'Core and logo writes leave Canvas, sharing and campaign snapshot untouched');
  loaded = (await r.request('GET', `/api/brands/${B}`)).body;
  const localFailure = profile.createSession({ ...options, brand: loaded, onSave: async () => { throw new Error('deliberate local projection'); }, onLogo: async () => { throw new Error('deliberate local logo projection'); } });
  localFailure.state.core.brandCore = 'Confirmed despite projection failure'; localFailure.state.dirty = true;
  assert.equal(await localFailure.save(), true); assert.equal(localFailure.dirty(), false); assert(localFailure.state.message.startsWith('Brand Profile saved.'));
  assert.equal((await r.request('GET', `/api/brands/${B}`)).body.brand_core.brandCore, 'Confirmed despite projection failure');
  await localFailure.chooseFile({ type: 'image/png', size: png.length }, async () => png.toString('base64'));
  assert.equal(await localFailure.upload(), true); assert(localFailure.state.message.startsWith('Logo saved.'));
  localFailure.state.core.personas.push({ name: 'Full retained draft', note: 'Retained' }); localFailure.state.dirty = true;
  const retained = clone(localFailure.state.core); r.db.failPut = true;
  assert.equal(await localFailure.save(), false); assert.deepEqual(localFailure.state.core, retained); assert(localFailure.dirty());
  assert(localFailure.state.message.includes('database')); r.db.failPut = false;
  r.db.brands[0].revision++; assert.equal(await localFailure.save(), false); assert.deepEqual(localFailure.state.core, retained); assert(localFailure.state.message.includes('changed elsewhere'));
  assert.equal(await localFailure.reload(), true); assert.deepEqual(localFailure.state.core, retained); assert.equal(await localFailure.save(), true);
  const invalid = profile.createSession({ ...options, brand: (await r.request('GET', `/api/brands/${B}`)).body, fetchImpl: async () => ({ ok:true, status:200, json:async()=>({}) }) });
  invalid.state.core.personas.push({name:'Retained after invalid response',note:'Full draft'});invalid.state.dirty=true;
  const invalidDraft=clone(invalid.state.core);assert.equal(await invalid.save(),false);assert.deepEqual(invalid.state.core,invalidDraft);assert(invalid.state.message.includes('could not be verified'));assert(invalid.dirty());
  const input = { contract: 'brand_creation_v1', id: '55555555-5555-4555-8555-555555555555', workspace_id: W, name: '  Created   Brand  ' };
  for (const role of ['member','viewer']) { r.db.workspaceRole = role; assert.equal((await r.request('POST','/api/brands',input)).statusCode,403); }
  r.db.workspaceRole = 'admin'; r.db.membershipStatus = 'pending'; assert.equal((await r.request('POST','/api/brands',input)).statusCode,403); r.db.membershipStatus = 'accepted';
  assert.equal((await r.request('POST','/api/brands',input,null)).statusCode,401);
  r.db.identityStatus = 'disabled'; assert.equal((await r.request('POST','/api/brands',input)).statusCode,403); r.db.identityStatus = 'active';
  const created = await r.request('POST','/api/brands',input); assert.equal(created.statusCode,201); assert.equal(created.body.brand.name,'Created Brand');
  const replay = await r.request('POST','/api/brands',input); assert.equal(replay.body.created,false); assert.equal(replay.body.brand.id,created.body.brand.id);
  const renamed = created.body.brand;
  assert.equal((await r.request('PUT',`/api/brands/${renamed.id}`,{name:'Edited name',brand_core:renamed.brand_core,revision:1})).statusCode,200);
  assert.equal((await r.request('POST','/api/brands',input)).body.created,false,'Original creation input remains idempotent after edits');
  assert.equal((await r.request('POST','/api/brands',{...input,name:'Different input'})).statusCode,409);
  assert.equal(r.db.boards.length,1,'Standalone creation makes no Board');
  r.db.workspaceRole = 'owner';
  const project = command.build(W,'Local new Project',{new_name:'Project Brand'},'stable-project-attempt');
  const result = await r.request('POST','/api/projects',project); assert.equal(result.statusCode,201); command.validate(result.body,project);
  assert.equal((await r.request('POST','/api/projects',project)).body.created,false); assert.equal(r.db.boards.length,2); assert.equal(r.db.brands.length,3);
  const admin = {email:'unrelated-admin@example.test'}; r.db.brandRole='admin';
  assert.equal((await r.request('DELETE',`/api/brands/${B}`,{confirmationName:r.db.brands[0].name},admin)).statusCode,404);
  assert.equal((await r.request('DELETE',`/api/brands/${B}`,{confirmationName:'wrong'})).statusCode,409);
  const blocked = await r.request('DELETE',`/api/brands/${B}`,{confirmationName:r.db.brands[0].name}); assert.equal(blocked.body.code,'BRAND_IN_USE'); assert.equal(blocked.body.boardCount,1);
  assert.equal(r.db.boards[0].brand_id,B); assert.deepEqual(r.db.boards[0].brand_core_snapshot,snapshot.brand_core_snapshot); assert.deepEqual(r.db.boards[0].canvas_json,snapshot.canvas_json);
  assert.equal((await r.request('GET',`/api/boards/${D}`)).statusCode,200);
  assert(!JSON.stringify(r.logs).includes(EMAIL)); assert(!JSON.stringify(r.logs).includes('private SQL'));
  assert(r.db.queries.every(sql => !/CREATE TABLE|ALTER TABLE|DROP TABLE/.test(sql)),'No migration or runtime schema change');
  console.log('R5 handlers/controllers: signed sessions, real access/analysis/PUT/reload/logo/storage/config/create/replay/project/delete, bounded failures and snapshot isolation passed.');
}
async function browserJourney() {
  const r = runtime(), browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.setDefaultTimeout(12000);
    const errors = [], dialogs = []; let dropCreationResponse = false, dropProjectResponse = false, pausePut = null, nativeFail = false;
    page.on('dialog', dialog => { nativeFail = true; dialogs.push(dialog.type()); void dialog.dismiss(); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/.test(message.text())) errors.push(message.text()); });
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()); assert.equal(url.hostname,'localhost','No external browser calls');
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/auth/session') return route.fulfill({json:{user:null}});
        if (url.pathname === '/api/workspaces/catalog') return route.fulfill({json:r.catalog()});
        if (/^\/api\/(brands(?:\/[^/]+(?:\/logo)?)?|analyze-brand-domain|projects|boards\/[^/]+)$/.test(url.pathname) && !(url.pathname === '/api/brands' && req.method() === 'GET')) {
          if (req.method() === 'PUT' && pausePut) await new Promise(resolve => { pausePut.release = resolve; });
          const res = await r.request(req.method(),url.pathname,req.postDataJSON() || undefined);
          if (url.pathname === '/api/projects' && dropProjectResponse) { dropProjectResponse=false; return route.abort('failed'); }
          if (url.pathname === '/api/brands' && req.method() === 'POST' && dropCreationResponse) { dropCreationResponse=false; return route.abort('failed'); }
          return Buffer.isBuffer(res.body) ? route.fulfill({status:res.statusCode,contentType:'image/png',body:res.body}) : route.fulfill({status:res.statusCode,json:res.body});
        }
        if (url.pathname === '/api/brands') return route.fulfill({json:{brands:r.catalog().workspaces[0].brands.map(b=>({...b,created_at:'2026-10-08T08:00:00.000Z',updated_at:'2026-10-08T08:00:00.000Z'}))}});
        // Background surfaces are local empty fixtures and cannot touch a provider.
        return route.fulfill({json:{boards:[],members:[],editors:[],nodes:[],presence:[]}});
      }
      const file = path.resolve(ROOT,url.pathname === '/' ? 'index.html' : '.'+url.pathname);
      return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
    });
    await page.goto('http://localhost/'); await page.waitForFunction(()=>typeof state!=='undefined'&&!!workspaceSidebarController);
    async function context() {
      await page.evaluate(({catalog,W,B,EMAIL})=>{
        if(brandProfileController){brandProfileController.state.dirty=false;brandProfileController.state.deferred=true;}
        canonicalBrandDetail.draft=null;closeCanonicalBrandDetail({restoreFocus:false});
        state.user={email:EMAIL};state.workspaceCatalog={...state.workspaceCatalog,value:catalog,status:'ready',activeWorkspaceId:W};
        state.session.workspaceId=W;state.session.brandId=B;state.currentBoardId=null;state.session.boardId=null;state.publicBoardToken=null;
        state.brandCatalog={...state.brandCatalog,status:'success',userEmail:EMAIL,entries:catalog.workspaces[0].brands};
        state.boardAccess={canView:true,canEdit:true,canViewBoardBrandCore:true};state.isDirty=false;
        history.replaceState({},'', '/');setActiveView('home');setSidebarCollapsed(false);renderWorkspaceSidebar();
      },{catalog:r.catalog(),W,B,EMAIL});
    }
    const clickKey = key => page.locator(`[data-profile-key="${key}"]`).click();
    const ready = () => page.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready');
    await context(); await page.locator('#brand-core-nav-btn').click(); await ready();
    await page.locator('[data-profile-key="Website"]').fill('https://example.test/'); await clickKey('Analyze website');
    await page.waitForFunction(()=>brandProfileController.state.analysis==='Review website suggestions'&&!brandProfileController.busy());
    while (await page.locator('[data-profile-key^="proposal-"]').count()) { await page.locator('[data-profile-key^="proposal-"]').first().click(); await page.waitForFunction(()=>!brandProfileController.busy()); }
    await clickKey('Confirm and save Brand Profile');
    await page.waitForFunction(()=>brandProfileController.state.message==='Brand Profile saved');
    assert.equal(r.db.brands[0].brand_core.brandCore,r.suggestions.brandCore); assert.deepEqual(r.db.brands[0].brand_core.brandAssets.colors,r.suggestions.brandAssets.colors);
    await page.locator('#home-nav-btn').click(); assert.equal(await page.locator('#brand-leave-dialog').count(),0);
    await page.waitForFunction(()=>state.activeView==='home'); await page.locator('#brand-core-nav-btn').click(); await ready();
    assert.equal(await page.evaluate(()=>brandProfileController.state.core.brandCore),r.suggestions.brandCore);
    await clickKey('Analyze website'); await page.waitForFunction(()=>!!brandProfileController.state.candidate); await clickKey('Use this logo');
    await page.waitForFunction(()=>brandProfileController.state.logo==='Logo saved'); assert.equal(r.db.brands[0].logo_source,'discovered');
    while (await page.locator('[data-profile-key^="proposal-"]').count()) { await page.locator('[data-profile-key^="proposal-"]').first().click(); await page.waitForFunction(()=>!brandProfileController.busy()); }
    await clickKey('Remove logo'); await page.waitForFunction(()=>brandProfileController.state.message==='Logo removed');
    await clickKey('Brand Assets');
    await page.locator('.guided-brand-profile input[type=file]').setInputFiles({name:'local-logo.png',mimeType:'image/png',buffer:png});
    r.setMissingSecret(true); await clickKey('Upload logo');
    await page.waitForFunction(()=>brandProfileController.state.message.includes('Logo storage is temporarily unavailable'));
    assert(await page.locator('.profile-logo-candidate').isVisible());
    await clickKey('Overview'); await page.locator('[data-profile-key="Brand description"]').fill('Saved with unavailable optional logo');
    await clickKey('Confirm and save Brand Profile'); await page.waitForFunction(()=>!brandProfileController.state.dirty);
    assert.equal(await page.evaluate(()=>brandProfileController.dirty()),false,'R6 optional file is retained in account memory, without a profile save warning');
    await page.locator('#home-nav-btn').click();assert.equal(await page.locator('#brand-leave-dialog').count(),0);
    await page.waitForFunction(()=>state.activeView==='home');await page.locator('#brand-core-nav-btn').click();await ready();
    assert.equal(await page.evaluate(()=>brandProfileController.state.file.name),'local-logo.png','Optional file retained in account memory across navigation');
    r.setMissingSecret(false);await clickKey('Brand Assets');assert(await page.locator('.profile-logo-candidate').isVisible());await clickKey('Upload logo');await page.waitForFunction(()=>brandProfileController.state.logo==='Logo saved');
    const logoURL=`/api/brands/${B}/logo?revision=${r.db.brands[0].logo_revision}`;
    assert.equal(await page.locator('#workspace-brand-avatar img').getAttribute('src'),logoURL);
    await page.locator('#home-nav-btn').click();await page.locator('#brand-core-nav-btn').click();await ready();
    assert.equal(await page.locator('.profile-header .profile-logo img').getAttribute('src'),logoURL);
    await page.waitForFunction(()=>document.querySelector('.profile-header .profile-logo img')?.naturalWidth===32);
    await clickKey('Overview');await page.locator('[data-profile-key="Brand description"]').fill('Retained across a catalog refresh');
    await page.evaluate(()=>{state.workspaceCatalog.status='stale';state.workspaceCatalog.generation++;renderCanonicalBrandDetail();});
    assert.equal(await page.evaluate(()=>brandProfileController.state.core.brandCore),'Retained across a catalog refresh');
    await clickKey('Confirm and save Brand Profile');assert.equal(await page.evaluate(()=>brandProfileController.state.core.brandCore),'Retained across a catalog refresh');
    await page.evaluate(()=>{state.workspaceCatalog.status='ready';renderCanonicalBrandDetail();});
    await clickKey('Confirm and save Brand Profile');await page.waitForFunction(()=>!brandProfileController.dirty());
    // An intentionally failing local renderer after a confirmed PUT remains saved.
    await clickKey('Overview');await page.locator('[data-profile-key="Brand description"]').fill('Saved despite local rendering failure');
    await page.evaluate(()=>{globalThis.r5OriginalSidebar=renderWorkspaceSidebar;renderWorkspaceSidebar=()=>{throw new Error('deliberate reconciliation error');};});
    await clickKey('Confirm and save Brand Profile');await page.waitForFunction(()=>brandProfileController.state.message.startsWith('Brand Profile saved.'));
    assert.equal(await page.evaluate(()=>brandProfileController.dirty()),false);
    await page.evaluate(()=>{renderWorkspaceSidebar=globalThis.r5OriginalSidebar;renderWorkspaceSidebar();});
    // The Advanced editor uses the same real PUT boundary and internal dirty decisions.
    await clickKey('Advanced options');await page.locator('#brand-workspace-edit-open').click();
    const advancedCore=JSON.parse(await page.locator('#brand-workspace-edit-core').inputValue());advancedCore.brandCore='Advanced confirmed profile';
    await page.locator('#brand-workspace-edit-core').fill(JSON.stringify(advancedCore));
    await page.locator('#home-nav-btn').click();await page.getByRole('button',{name:'Save and continue',exact:true}).click();
    await page.waitForFunction(()=>state.activeView==='home');assert.equal(r.db.brands[0].brand_core.brandCore,'Advanced confirmed profile');
    await page.locator('#brand-core-nav-btn').click();await ready();await clickKey('Overview');
    // Dirty navigation: default/Escape keep editing, failed save stays, confirmed save waits.
    await page.locator('[data-profile-key="Brand description"]').fill('Retain complete draft');await page.locator('#home-nav-btn').click();
    await page.locator('#brand-leave-dialog').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Keep editing');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#brand-leave-dialog').count(),0);assert.equal(await page.evaluate(()=>state.activeView),'brand-profile');
    await page.locator('#home-nav-btn').click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await page.evaluate(()=>brandProfileController.state.core.brandCore),'Retain complete draft');
    r.db.failPut=true;await page.locator('#home-nav-btn').click();await page.getByRole('button',{name:'Save and continue',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#brand-leave-dialog button').disabled);assert.equal(await page.evaluate(()=>state.activeView),'brand-profile');assert(await page.locator('#brand-leave-dialog').isVisible());
    r.db.failPut=false;pausePut={};await page.getByRole('button',{name:'Save and continue',exact:true}).click();
    await page.waitForFunction(()=>brandProfileController.busy());assert.equal(await page.evaluate(()=>state.activeView),'brand-profile');
    assert(pausePut.release);pausePut.release();pausePut=null;await page.waitForFunction(()=>state.activeView==='home');assert.equal(r.db.brands[0].brand_core.brandCore,'Retain complete draft');
    await page.locator('#brand-core-nav-btn').click();await ready();await clickKey('Overview');await page.locator('[data-profile-key="Brand description"]').fill('Explicit discard only');
    await page.locator('#home-nav-btn').click();assert.equal(await page.evaluate(()=>state.activeView),'brand-profile');await page.getByRole('button',{name:'Discard changes',exact:true}).click();
    await page.waitForFunction(()=>state.activeView==='home');assert.equal(r.db.brands[0].brand_core.brandCore,'Retain complete draft');
    // Sidebar create timeout: the first server response is deliberately lost, retry has the same ID.
    await page.locator('#workspace-brand-manage').click();await page.getByRole('menuitem',{name:'Create Brand',exact:true}).click();
    await page.locator('#brand-create-dialog input').fill('Sidebar Brand');dropCreationResponse=true;
    const count=r.db.brands.length;await page.locator('#brand-create-dialog button[type=submit]').click();await page.locator('#brand-create-dialog button[type=submit]').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#brand-create-dialog input').disabled&&document.querySelector('#brand-create-dialog [role=status]').textContent.length>0);
    assert.equal(r.db.brands.length,count+1);await page.locator('#brand-create-dialog button[type=submit]').click();await ready();
    await page.waitForFunction(()=>canonicalBrandDetail.brand.name==='Sidebar Brand');
    const createdId=await page.evaluate(()=>canonicalBrandDetail.brandId);assert.equal(await page.evaluate(()=>state.session.brandId),createdId);
    const createRequests=r.requests.filter(q=>q.path==='/api/brands'&&q.method==='POST');assert.equal(createRequests.length,2);assert.equal(createRequests[0].body.id,createRequests[1].body.id);assert.equal(r.db.brands.length,count+1);assert.equal(r.db.boards.length,1);
    // Brand switching uses actual selector clicks; deletion reuses the authoritative transaction.
    await page.locator('#workspace-brand-trigger').click();await page.locator(`[data-brand-id="${B}"]`).click();await ready();await page.waitForFunction(B=>canonicalBrandDetail.brandId===B,B);
    await page.locator('#workspace-brand-trigger').click();await page.locator(`[data-brand-id="${createdId}"]`).click();await ready();await page.waitForFunction(id=>canonicalBrandDetail.brandId===id,createdId);
    // Attach a local Board fixture to the created Brand, preserving its campaign data.
    r.db.boards[0].brand_id=createdId;await page.evaluate(({createdId,D})=>{state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:state.workspaceCatalog.value.workspaces.map(w=>({...w,boards:w.boards.map(b=>b.id===D?{...b,brand_id:createdId}:b)}))};}, {createdId,D});
    const stableBoard=clone(r.db.boards[0]);await page.locator('#workspace-brand-manage').click();await page.getByRole('menuitem',{name:'Delete Brand',exact:true}).click();
    assert(!(await page.locator('#brand-delete-submit').isVisible()));
    await page.waitForFunction(()=>document.querySelector('#brand-delete-feedback').textContent.includes('1 project.'));
    assert.equal(r.db.boards[0].brand_id,createdId);assert.deepEqual(r.db.boards[0].canvas_json,stableBoard.canvas_json);assert.deepEqual(r.db.boards[0].brand_core_snapshot,stableBoard.brand_core_snapshot);
    await page.locator('#brand-delete-cancel').click();
    // Reassign first; only a Board-less Brand may then be deleted.
    r.db.boards[0].brand_id=B;
    await page.evaluate(({B,D})=>{state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:state.workspaceCatalog.value.workspaces.map(w=>({...w,boards:w.boards.map(b=>b.id===D?{...b,brand_id:B}:b)}))};},{B,D});
    await page.locator('#workspace-brand-manage').click();await page.getByRole('menuitem',{name:'Delete Brand',exact:true}).click();
    await page.locator('#brand-delete-submit').click();
    await page.waitForFunction(id=>!state.workspaceCatalog.value.workspaces[0].brands.some(b=>b.id===id),createdId);
    assert.equal(r.db.boards[0].brand_id,B);assert.equal(await page.evaluate(()=>canonicalBrandDetail.status),'closed');
    await page.evaluate(({D})=>{state.currentBoardId=D;state.boardBrandAssociation={...state.boardBrandAssociation,boardId:D,brandId:null};}, {D});
    await page.locator('#campaign-canvas-nav-btn').click();assert.equal(await page.evaluate(()=>state.activeView),'board');
    // Real project dialog -> real project handler -> saved profile -> exact Board read.
    await context();await page.locator('#boards-nav-btn').click();await page.locator('#boards-create-btn').click();
    await page.locator('#project-name').fill('Browser Project');await page.locator('.project-dialog button[type=submit]').click();
    await page.getByRole('radio',{name:/Start with a new Brand/}).click();await page.locator('#project-brand-name').fill('Browser Project Brand');await page.locator('#project-brand-website').fill('https://example.test/');
    dropProjectResponse=true;const originalCounts=[r.db.boards.length,r.db.brands.length];
    await page.locator('.project-dialog button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('.project-dialog button[type=submit]').disabled&&document.querySelector('.project-status').textContent.includes('not confirmed'));
    assert.deepEqual([r.db.boards.length,r.db.brands.length],[originalCounts[0]+1,originalCounts[1]+1]);
    await page.locator('.project-dialog button[type=submit]').click();await ready();
    const projectAttempts=r.requests.filter(q=>q.path==='/api/projects');assert.equal(projectAttempts.length,2);assert.deepEqual(projectAttempts[0].body,projectAttempts[1].body);
    const projectId=await page.evaluate(()=>projectSetupContext.outcome.board.id), projectBrandId=await page.evaluate(()=>canonicalBrandDetail.brandId);
    const beforeProjectCounts=[r.db.boards.length,r.db.brands.length], posts=r.requests.filter(q=>q.path==='/api/projects').length;
    await clickKey('Overview');await page.locator('[data-profile-key="Brand description"]').fill('Project reusable profile');r.db.failPut=true;await clickKey('Save Brand Profile and continue');
    await page.waitForFunction(()=>brandProfileController.state.message.includes('database'));assert.equal(await page.evaluate(()=>!!projectSetupContext),true);assert.deepEqual([r.db.boards.length,r.db.brands.length],beforeProjectCounts);
    r.db.failPut=false;await clickKey('Save Brand Profile and continue');await page.waitForFunction(()=>!projectSetupContext);
    assert.equal(await page.evaluate(()=>state.currentBoardId),projectId);assert.equal(new URL(page.url()).pathname,`/boards/${projectId}`);assert.equal(r.db.brands.find(b=>b.id===projectBrandId).brand_core.brandCore,'Project reusable profile');
    assert.equal(r.requests.filter(q=>q.path==='/api/projects').length,posts);assert.deepEqual([r.db.boards.length,r.db.brands.length],beforeProjectCounts);
    // Roles/status, one portal at a time, keyboard, focus, both themes and six widths/reflow.
    await context();
    for(const role of ['member','viewer']){await page.evaluate(role=>{state.workspaceCatalog.value.workspaces[0].role=role;state.workspaceCatalog.value.workspaces[0].brands[0].role='viewer';renderWorkspaceSidebar();},role);assert(!(await page.locator('#workspace-brand-manage').isVisible()));}
    await context();
    for(const status of ['stale','loading','error']){await page.evaluate(status=>{state.workspaceCatalog.status=status;renderWorkspaceSidebar();},status);assert(!(await page.locator('#workspace-brand-manage').isVisible()));}await context();
    for(const theme of ['light','dark'])for(const width of [320,375,480,768,1024,1440,720]){
      await page.setViewportSize({width,height:width===720?450:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.locator('#workspace-brand-manage').click();let box=await page.locator('#brand-context-menu').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await page.locator('#brand-context-menu button').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));
      await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-brand-manage');
      await page.locator('#workspace-brand-manage').click();await page.locator('#workspace-context-manage').click();assert.equal(await page.locator('#brand-context-menu').count(),0);await page.keyboard.press('Escape');
      await page.locator('#brand-core-nav-btn').click();await ready();await page.locator('[data-profile-key="Brand name"]').fill('Dirty responsive name');await page.locator('#home-nav-btn').click();
      box=await page.locator('#brand-leave-dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.getByRole('button',{name:'Keep editing',exact:true}).click();
      await page.locator('#home-nav-btn').click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();
    }
    await page.setViewportSize({width:375,height:900});await page.evaluate(()=>{state.uiLanguage='de';renderWorkspaceSidebar();});await page.locator('#workspace-brand-manage').click();assert(await page.getByRole('menuitem',{name:'Marke erstellen',exact:true}).isVisible());await page.keyboard.press('Escape');
    await page.locator('#brand-core-nav-btn').click();await ready();await page.locator('[data-profile-key="Brand name"]').fill('Ungespeichert');await page.locator('#home-nav-btn').click();assert(await page.getByRole('heading',{name:'Änderungen vor dem Verlassen speichern?'}).isVisible());await page.getByRole('button',{name:'Weiter bearbeiten',exact:true}).click();
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});assert(await page.locator('.guided-brand-profile').isVisible());
    assert.equal(nativeFail,false,`No native dialogs: ${dialogs}`);assert.deepEqual(errors,[]);assert(!JSON.stringify(r.logs).includes(EMAIL));
    console.log('R5 Chromium: real HTML/app/sidebar/profile/CSS clicks, save/reload/logo retry, local projection failure, internal dirty decisions, idempotent Sidebar create/delete, Board survival, new-project save/handoff, roles, EN/DE, themes, widths, reflow, forced colors and reduced motion passed.');
  } finally { await browser.close(); }
}
(async()=>{await boundaries();await browserJourney();console.log('BW-36.13R5 passed. Zero production database, real provider/AI/storage calls; no migration/SQL.');})().catch(error=>{console.error(error);process.exitCode=1;});
