#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const { runtime, W, B, D, EMAIL, clone, png } = require('./fixtures/bw36-13r5-local-runtime');
const profile = require('../brand-profile-setup');
const ROOT = path.resolve(__dirname, '..'), M = '55555555-5555-4555-8555-555555555555';
async function controllers() {
  const r = runtime();
  r.db.brands[0].brand_core.brandAssets.domain = 'https://example.test/';
  const account = {}, context = { account, generation: 1, brandId: B, workspaceId: W, authorized: true };
  const make = async extra => profile.createSession({ brand: (await r.request('GET', `/api/brands/${B}`)).body,
    getContext: () => context, validateBrand: (b,id) => b?.id === id && !!b.brand_core && !!b.access && Number.isSafeInteger(b.revision),
    requestId: () => 'r6-logo', onSave() {}, onLogo() {},
    fetchImpl: async (url, init = {}) => { const res = await r.request(init.method || 'GET', url, init.body ? JSON.parse(init.body) : undefined); return { ok: res.statusCode < 300, status: res.statusCode, json: async () => res.body }; }, ...extra });
  let s = await make({ website: 'example.test' }); assert(!s.dirty(), 'Same saved website is normalized');
  s.state.dirty = true; assert(!s.dirty(), 'Legacy writes cannot stick');
  s.state.core.brandCore = 'Manual'; assert(s.dirty()); s.state.core.brandCore = 'Original positioning'; assert(!s.dirty());
  s.state.name = 'Manual name'; assert(await s.save()); assert(!s.dirty());
  const start = r.requests.filter(q => q.method === 'PUT').length;
  r.suggestions.unknown = 'never import'; await s.analyze();
  assert.equal(r.requests.filter(q => q.method === 'PUT').length, start + 1, 'All empty details use one revision save');
  assert.equal(r.db.brands[0].brand_core.unknown, undefined); assert.equal(s.state.core.valueProposition, r.suggestions.valueProposition);
  assert.equal(s.state.core.brandCore, 'Original positioning'); assert.equal(s.state.proposals.brandCore, r.suggestions.brandCore); assert(!s.dirty());
  const count = r.requests.length; s.keepProposal('brandCore'); assert.equal(r.requests.length, count); assert(!s.state.proposals.brandCore);
  await s.analyze(); assert.deepEqual(Object.keys(s.state.proposals), ['brandCore'], 'Equal values do not generate comparisons');
  const before = r.requests.filter(q => q.method === 'PUT').length; assert(await s.applyProposal('brandCore')); assert(!s.state.proposals.brandCore); assert(!s.dirty());
  assert.equal(r.requests.filter(q => q.method === 'PUT').length, before + 1);
  await s.analyze(); assert.deepEqual(s.state.proposals, {}); assert.equal(r.requests.filter(q => q.method === 'PUT').length, before + 1);
  r.suggestions.brandCore = 'New suggestion'; await s.analyze(); r.db.failPut = true;
  assert.equal(await s.applyProposal('brandCore'), false); assert.equal(s.state.proposalChoices.brandCore, 'website'); assert(s.state.proposalErrors.brandCore); assert(s.state.proposals.brandCore); assert(!s.dirty());
  r.db.failPut = false; r.db.brands[0].revision++; r.db.brands[0].brand_core.brandCore = 'Concurrent value';
  assert.equal(await s.applyProposal('brandCore'), false); assert.equal(s.state.core.brandCore, 'Concurrent value'); assert.equal(r.db.brands[0].brand_core.brandCore, 'Concurrent value'); assert(s.state.proposals.brandCore); assert(!s.dirty());
  assert(await s.applyProposal('brandCore')); assert.equal(r.db.brands[0].brand_core.brandCore, 'New suggestion');
  // An automatic batch fails without reporting success, then retries once. Mixed assets keep existing colors.
  r.db.brands[0].brand_core.valueProposition = ''; r.db.brands[0].brand_core.keywords = [];
  r.db.brands[0].brand_core.brandAssets = { domain: 'https://example.test/', colors: ['#ffffff'], typography: '' };
  s = await make(); r.db.failPut = true; await s.analyze(); assert.equal(s.state.addedCount, 0); assert.equal(s.state.core.valueProposition, ''); assert(s.state.autoKeys.length);
  r.db.failPut = false; const retryCount = r.requests.filter(q => q.method === 'PUT').length; assert(await s.retryAutomatic());
  assert.equal(r.requests.filter(q => q.method === 'PUT').length, retryCount + 1); assert.deepEqual(r.db.brands[0].brand_core.brandAssets.colors, ['#ffffff']); assert.equal(s.state.proposals.brandAssets.colors[0], '#123456'); assert(!s.dirty());
  s.keepProposal('brandAssets');
  // Independent manual edits are never submitted by choosing a suggestion.
  r.suggestions.brandCore = 'Another suggestion'; await s.analyze(); s.state.name = 'Unsaved name'; s.state.core.keywords = ['Manual keyword'];
  assert(await s.applyProposal('brandCore')); assert.notEqual(r.db.brands[0].name, 'Unsaved name'); assert.equal(s.state.name, 'Unsaved name'); assert.deepEqual(s.state.core.keywords, ['Manual keyword']); assert(s.dirty());
  assert(await s.save()); assert(!s.dirty());
  r.suggestions.brandCore = 'First unresolved'; r.suggestions.valueProposition = 'Second unresolved';
  await s.analyze(); s.keepProposal('brandCore'); assert(s.state.proposals.valueProposition, 'Other conflicts survive a decision');
  assert(await s.applyProposal('valueProposition'));
  const suggestions = clone(r.suggestions);
  for (const key of Object.keys(r.suggestions)) delete r.suggestions[key];
  Object.assign(r.suggestions,{brandCore:'',toneOfVoice:[],messagingPillars:[],personas:[],brandAssets:{},valueProposition:'Only one automatic detail',unknown:'ignored'});
  r.db.brands[0].brand_core.valueProposition = ''; s = await make();
  const one = r.requests.filter(q=>q.method==='PUT').length;
  await s.analyze(); assert.equal(r.requests.filter(q=>q.method==='PUT').length, one+1); assert.equal(s.state.addedCount,1); assert(!s.dirty());
  Object.assign(r.suggestions,suggestions);
  await s.chooseFile({type:'image/png',size:png.length,name:'logo.png'},async()=>png.toString('base64')); assert(!s.dirty()); assert(await s.upload()); assert(!s.dirty());
  assert(await s.generateDna()); assert(!s.dirty()); assert(await s.acceptDna()); assert(!s.dirty()); assert(await s.generateAvatar()); assert(!s.dirty()); assert(await s.acceptAvatar()); assert(!s.dirty());
  assert(!(await make()).dirty(), 'Saved website, logo, DNA and avatar reopen clean');
  assert(s.belongsToAccount(account)); context.account = {}; assert(!s.belongsToAccount(context.account)); assert.equal(await s.applyProposal('brandCore'), false);
  assert(!JSON.stringify(r.logs).includes(EMAIL));
  console.log('R6 controllers: normalized clean close, reverting edits, batched/identical/conflicting suggestions, keep/use/error/retry/stale, mixed assets, manual edit isolation, saved logo/DNA/avatar passed.');
}
async function dom() {
  const r = runtime(); r.db.brands[0].brand_core.brandAssets.domain = 'https://example.test/';
  r.db.brands.push({ ...clone(r.db.brands[0]), id:M, name:'Other Brand' });
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : fs.existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium'} : {}), args:['--no-sandbox'] });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}}); page.setDefaultTimeout(10000);
    const errors = [], dialogs = [], calls = []; let pause = null;
    page.on('pageerror', e=>errors.push(e.message)); page.on('dialog', d=>{dialogs.push(d.type());void d.dismiss();});
    await page.route('**/*', async route=>{
      const req=route.request(), url=new URL(req.url()); calls.push({method:req.method(),path:url.pathname}); assert.equal(url.hostname,'localhost','Fixture cannot call providers');
      if(url.pathname.startsWith('/api/')) {
        if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:null}});
        if(url.pathname==='/api/workspaces/catalog')return route.fulfill({json:r.catalog()});
        if(url.pathname==='/api/brands'&&req.method()==='GET')return route.fulfill({json:{brands:r.catalog().workspaces[0].brands.map(b=>({...b,created_at:'2026-10-08T08:00:00.000Z',updated_at:'2026-10-08T08:00:00.000Z'}))}});
        if(/^\/api\/(brands\/[^/]+(?:\/logo)?|analyze-brand-domain|discover-brand-dna|generate-brand-avatar|projects|boards\/[^/]+)$/.test(url.pathname)) {
          if(req.method()==='PUT'&&pause)await new Promise(resolve=>{pause.release=resolve;});
          const res=await r.request(req.method(),url.pathname,req.postDataJSON()||undefined);
          return Buffer.isBuffer(res.body)?route.fulfill({status:res.statusCode,contentType:'image/png',body:res.body}):route.fulfill({status:res.statusCode,json:res.body});
        }
        return route.fulfill({json:{boards:[],members:[],editors:[],nodes:[],presence:[]}});
      }
      const file=path.resolve(ROOT,url.pathname==='/'?'index.html':'.'+url.pathname);
      return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
    });
    await page.goto('http://localhost/'); await page.waitForFunction(()=>typeof state!=='undefined'&&!!workspaceSidebarController);
    await page.evaluate(({catalog,W,B,EMAIL})=>{
      state.user={email:EMAIL};state.workspaceCatalog={...state.workspaceCatalog,value:catalog,status:'ready',activeWorkspaceId:W};
      state.session.workspaceId=W;state.session.brandId=B;state.currentBoardId=null;state.session.boardId=null;state.publicBoardToken=null;
      state.brandCatalog={...state.brandCatalog,status:'success',userEmail:EMAIL,entries:catalog.workspaces[0].brands};state.boardAccess={canView:true,canEdit:true,canViewBoardBrandCore:true};state.isDirty=false;
      setActiveView('home');setSidebarCollapsed(false);renderWorkspaceSidebar();
    },{catalog:r.catalog(),W,B,EMAIL});
    const key=k=>page.locator(`[data-profile-key="${k}"]`), ready=()=>page.waitForFunction(()=>!!brandProfileController&&canonicalBrandDetail.status==='ready'&&!brandProfileController.busy());
    await page.locator('#brand-core-nav-btn').click();await ready(); const writes=r.requests.filter(q=>q.method==='PUT').length;
    await page.locator('#home-nav-btn').click();assert.equal(await page.locator('#brand-leave-dialog').count(),0);assert.equal(await page.evaluate(()=>state.activeView),'home');assert.equal(r.requests.filter(q=>q.method==='PUT').length,writes);
    await page.locator('#brand-core-nav-btn').click();await ready();await key('Analyze website').click();await ready();
    assert(await page.getByText(/details added from the website\./).isVisible());assert(await page.locator('.profile-proposal').filter({hasText:'Brand description'}).isVisible());assert(await page.getByText('Original positioning',{exact:true}).isVisible());assert(await page.getByText(r.suggestions.brandCore,{exact:true}).isVisible());
    await page.locator('#home-nav-btn').click();assert.equal(await page.locator('#brand-leave-dialog').count(),0);
    await page.locator('#brand-core-nav-btn').click();await ready();await key('Review').click();assert(await key('keep-brandCore').isVisible());const kept=r.requests.filter(q=>q.method==='PUT').length;await key('keep-brandCore').click();assert.equal(await page.locator('.profile-proposal').count(),0);assert.equal(r.requests.filter(q=>q.method==='PUT').length,kept);
    await key('Overview').click();await key('Analyze website').click();await ready(); r.db.failPut=true;
    await key('proposal-brandCore').click();await ready();assert(await key('retry-brandCore').isVisible());assert.equal(await key('proposal-brandCore').getAttribute('aria-pressed'),'true');assert(await page.locator('.profile-proposal [role=alert]').isVisible());
    const decisionURL=page.url(), refetches=calls.filter(c=>/^\/api\/(workspaces\/catalog|boards)/.test(c.path)).length;
    r.db.failPut=false; pause={};await key('retry-brandCore').click();await page.waitForFunction(()=>brandProfileController.busy());assert.equal(await page.locator('.profile-proposal').count(),1);assert(await page.getByText('Saving website suggestion…',{exact:true}).first().isVisible());pause.release();pause=null;await ready();assert.equal(await page.locator('.profile-proposal').count(),0);assert.equal(await page.evaluate(()=>brandProfileController.dirty()),false);assert.equal(page.url(),decisionURL);assert.equal(calls.filter(c=>/^\/api\/(workspaces\/catalog|boards)/.test(c.path)).length,refetches,'Decisions do not refetch Workspace/Board surfaces');
    await key('Overview').click();await key('Brand description').fill('Manual edit');await page.locator('#home-nav-btn').click();assert(await page.locator('#brand-leave-dialog').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#brand-leave-dialog').count(),0);await page.locator('#home-nav-btn').click();await page.getByRole('button',{name:'Save and continue',exact:true}).click();await page.waitForFunction(()=>state.activeView==='home');
    // Own-row targeting, immediate block, plural and concurrent authoritative server block.
    const open=async id=>{await page.evaluate(id=>{const b=state.workspaceCatalog.value.workspaces.flatMap(w=>w.brands).find(b=>b.id===id);openBrandDeletion(b,document.getElementById('workspace-brand-manage'));},id);};
    await open(B);assert.equal(await page.locator('#brand-delete-confirmation').count(),0);assert(await page.getByText('This Brand is used by 1 project.',{exact:false}).isVisible());assert(await page.locator('#brand-delete-feedback[role=alert].brand-delete-blocked').isVisible());assert(!(await page.locator('#brand-delete-submit').isVisible()));
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'brand-delete-projects');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'brand-delete-cancel');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-brand-manage');
    await page.evaluate(({B,D})=>state.workspaceCatalog.value.workspaces[0].boards.push({id:D+'x',brand_id:B}),{B,D});await open(B);assert(await page.getByText('This Brand is used by 2 projects.',{exact:false}).isVisible());await page.locator('#brand-delete-cancel').click();
    await open(M);assert(await page.getByRole('heading',{name:'Delete Other Brand?'}).isVisible());assert(await page.locator('#brand-delete-submit').isVisible());r.db.boards.push({...clone(r.db.boards[0]),id:'concurrent',brand_id:M});const snapshot=clone(r.db.boards);
    await page.locator('#brand-delete-submit').click();await page.waitForFunction(()=>brandDeletion.status==='blocked');assert(await page.getByText('This Brand is used by 1 project.',{exact:false}).isVisible());assert(!(await page.locator('#brand-delete-submit').isVisible()));assert.deepEqual(clone(r.db.boards),snapshot);assert(r.db.brands.some(b=>b.id===M));await page.locator('#brand-delete-cancel').click();
    r.db.boards=r.db.boards.filter(b=>b.id!=='concurrent');
    for(const theme of ['light','dark'])for(const width of [1440,1024,768,480,375,320,720]) {
      await page.setViewportSize({width,height:width===720?450:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await open(B);
      const box=await page.locator('#brand-delete-dialog').boundingBox();assert(box,JSON.stringify({theme,width,context:await page.evaluate(()=>({status:state.workspaceCatalog.status,deletion:brandDeletion.status,brands:state.workspaceCatalog.value?.workspaces[0].brands}))}));assert(box.x>=0&&box.x+box.width<=width+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#brand-delete-dialog button:visible').evaluateAll(bs=>bs.every(b=>b.getBoundingClientRect().height>=44)));await page.keyboard.press('Escape');
      await page.locator('#brand-core-nav-btn').click();await ready();await key('Overview').click();await key('Brand name').fill('Responsive edit');await page.locator('#home-nav-btn').click();assert(await page.locator('#brand-leave-dialog').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Discard changes',exact:true}).click();
      await open(M);const confirm=await page.locator('#brand-delete-dialog').boundingBox();assert(confirm.x>=0&&confirm.x+confirm.width<=width+1);await page.keyboard.press('Escape');
    }
    await page.evaluate(()=>{state.uiLanguage=language.setUiLanguage('de');state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:state.workspaceCatalog.value.workspaces.map(w=>({...w,boards:[w.boards.find(b=>b.brand_id===w.brands[0].id),{id:'plural-fixture',brand_id:w.brands[0].id}]}))};renderWorkspaceSidebar();});await open(B);assert(await page.getByText('Diese Brand wird von 2 Projekten',{exact:false}).isVisible(),await page.locator('#brand-delete-feedback').textContent());assert(await page.getByRole('button',{name:'Projekte anzeigen',exact:true}).isVisible());await page.keyboard.press('Escape');
    await page.evaluate(()=>{state.uiLanguage=language.setUiLanguage('en');renderWorkspaceSidebar();});await open(B);await page.locator('#brand-delete-projects').click();await page.waitForFunction(()=>state.activeView==='boards_library');assert.equal(await page.evaluate(()=>getResolvedWorkspaceBrand().id),B);assert.equal(await page.evaluate(()=>state.boardsLibraryRequest.scope),'brand');
    // Keep active B while deleting non-active, boardless M, then refresh catalog/profile.
    await page.evaluate(B=>{state.session.brandId=B;setActiveView('home');renderWorkspaceSidebar();},B);await open(M);await page.locator('#brand-delete-submit').click();await page.waitForFunction(M=>!state.workspaceCatalog.value.workspaces[0].brands.some(b=>b.id===M),M);assert.equal(r.requests.filter(q=>q.method==='DELETE').at(-1).path,`/api/brands/${M}`);assert(r.db.brands.some(b=>b.id===B));assert.equal(await page.evaluate(()=>state.session.brandId),B);assert.equal(await page.evaluate(()=>state.session.workspaceId),W);
    await page.evaluate(c=>{state.workspaceCatalog.value=c;renderWorkspaceSidebar();},r.catalog());await page.locator('#brand-core-nav-btn').click();await ready();assert.equal(await page.evaluate(()=>brandProfileController.dirty()),false);await page.locator('#home-nav-btn').click();
    for(const role of ['viewer','editor','admin']) {await page.evaluate(role=>{state.workspaceCatalog.value.workspaces[0].brands[0].role=role;renderWorkspaceSidebar();openBrandDeletion(state.workspaceCatalog.value.workspaces[0].brands[0],document.getElementById('workspace-brand-manage'));},role);assert(!(await page.locator('#brand-delete-dialog').isVisible()));}
    await page.evaluate(B=>{pendingBrandProfileData.set(B,{account:state.user,proposals:{brandCore:'Private suggestion'}});state.user={email:'different-account@example.test'};clearWorkspaceCatalog();},B);assert.equal(await page.evaluate(()=>pendingBrandProfileData.size),0,'Account reset clears retained suggestions');
    assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);assert(!JSON.stringify(r.logs).includes(EMAIL));
    console.log('R6 Chromium: real production DOM/app, clean navigation/session retention, keep/use/error/retry/local saving, manual leave guard, own-row delete, singular/plural/concurrent blocks, existing project filter, roles, focus/Tab/Escape/restoration, EN/DE, light/dark at 1440/1024/768/480/375/320 and 720x450 reflow passed.');
  } finally {await browser.close();}
}
(async()=>{await controllers();await dom();console.log('BW-36.13R6 passed; fixtures made zero real provider/AI/storage/database calls.');})().catch(e=>{console.error(e);process.exitCode=1;});
