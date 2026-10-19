#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { runtime, W, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const { model } = require('../home-foundation');
const ROOT = path.resolve(__dirname, '..'), Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  let passed = 0;
  async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
  async function fixture({ association = B, singleton = false, empty = false, role = 'owner', shared = false, catalogDelay = false, rich = false, inaccessible = false, readOnly = false, catalogPending = false, catalogFailure = null, allowSave = false } = {}) {
    const r = runtime(); r.db.boards[0].brand_id = association === 'hidden' ? null : association; if(association==='hidden')r.db.boards[0].brand_visibility='hidden';
    r.db.boards[0].canvas_json.nodes = [{id:'saved-r22-node',type:'Idea',title:'Saved Board A',content:'Preserve this campaign',position:{x:10,y:10},images:[],tags:[],postits:[],variants:[],reactions:{},social:{},landingPage:{}}];
    if (!singleton) r.db.brands.push({ ...clone(r.db.brands[0]), id: Y, name: 'Navigation Brand Y' });
    if (role === 'viewer') { r.db.brandRole = 'viewer'; r.db.brands.forEach(b => { b.owner_email = 'independent-owner@example.test'; }); }
    if(rich) {
      r.db.boards[0].updated_at='2026-10-17T10:00:00Z';
      for(const [id,name,brand_id,updated_at,hidden] of [
        ['55555555-5555-4555-8555-555555555555','Autumn campaign',Y,'2026-10-16T12:00:00Z'],
        ['66666666-6666-4666-8666-666666666666','Product launch',Y,'2026-10-12T12:00:00Z'],
        ['77777777-7777-4777-8777-777777777777','Unassigned ideas',null,'2026-10-17T12:00:00Z'],
        ['88888888-8888-4888-8888-888888888888','Shared project',null,'2026-10-15T12:00:00Z',true]])
        r.db.boards.push({...clone(r.db.boards[0]),id,name,brand_id,updated_at,...(hidden?{brand_visibility:'hidden'}:{})});
    }
    const c = r.catalog(); c.request_id = '0123456789abcdef01234567';
    c.workspaces.forEach(w => { w.avatar_url = null; w.locale = 'en'; w.role = role; [...w.brands, ...w.boards].forEach(x => { delete x.workspace_id; if (role === 'viewer') x.role = 'viewer'; }); });
    if(inaccessible){c.workspaces[0].brands=c.workspaces[0].brands.filter(b=>b.id!==B);c.workspaces[0].boards[0].brand_id=null;}
    if (empty) c.workspaces = [];
    if (shared) c.workspaces[0].boards = [];
    const f = { r, catalog: c, writes: [], errors: [], posts: [], gets: 0, timeout: false, hold: null };
    if (catalogPending) f.catalogHold = defer();
    f.failCatalog = catalogFailure === '503';
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); f.page = page; page.setDefaultTimeout(12000);
    page.on('pageerror', e => f.errors.push(e.message));
    await page.addInitScript(() => {
      const interval = window.setInterval;
      window.setInterval = function(callback, ...args) {
        if (callback.name === 'detectDirtyFromSnapshot') window.autosaveWatcherStarted = true;
        return interval.call(this, callback, ...args);
      };
    });
    await page.route('**/*', async route => {
      const q = route.request(), u = new URL(q.url()), method = q.method(); assert.equal(u.hostname, 'localhost');
      if (u.pathname.startsWith('/api/') && method !== 'GET' && !u.pathname.includes('/presence/')) f.writes.push({ path: u.pathname, method });
      if (u.pathname === '/api/auth/session') return route.fulfill({ json: { user: { email: EMAIL } } });
      if (u.pathname === '/api/workspaces') {
        if (method === 'GET') { f.gets++; if(catalogDelay)await new Promise(r=>setTimeout(r,200));if(f.catalogHold)await f.catalogHold.promise;if(catalogFailure==='network')return route.abort('failed');return route.fulfill(f.failCatalog?{status:503,json:{error:{code:'DATABASE_UNAVAILABLE'}}}:{json:f.catalog}); }
        const body = q.postDataJSON(); f.posts.push(body);
        if(f.conflict)return route.fulfill({status:409,json:{contract:'workspace_create_v2',error:{code:'WORKSPACE_CREATE_CONFLICT'}}});
        const existing = f.catalog.workspaces.find(w => w.id === body.workspace_id);
        const workspace = { id: body.workspace_id, name: body.name, role: 'owner', revision: 1, brands: [], boards: [] };
        if (!existing) f.catalog.workspaces.push({ ...workspace, avatar_url: null, locale: 'en' });
        if (f.hold) await f.hold.promise;
        if (f.timeout) { f.timeout = false; return route.abort('timedout'); }
        return route.fulfill({ status: existing ? 200 : 201, json: { contract: 'workspace_create_v2', request_id: body.request_id, ok: true, created: !existing, workspace } });
      }
      if (u.pathname === '/api/boards') return route.fulfill({ json: { boards: r.db.boards } });
      if (u.pathname.startsWith('/api/boards/presence/')) return route.fulfill({ json: { viewers: [] } });
      if (/\/editors|\/sharing/.test(u.pathname)) return route.fulfill({ json: { editors: [] } });
      if (u.pathname === '/api/boards/' + D || u.pathname === '/api/boards/' + Y) {
        if (method === 'PUT' && allowSave) {
          const body = q.postDataJSON();
          Object.assign(r.db.boards[0], {canvas_json: body.canvas_json, updated_at: new Date().toISOString()});
          return route.fulfill({json: clone(r.db.boards[0])});
        }
        assert.equal(method, 'GET', 'Navigation cannot mutate a Board');
        if (f.boardHold) { const hold=f.boardHold; f.boardHold=null; hold.started.resolve(); await hold.release.promise; if(hold.response)return route.fulfill({json:hold.response}); }
        const board = clone(r.db.boards[0]); board.id = u.pathname.split('/').pop(); board.brand_id = association === 'hidden' ? null : board.id === Y ? Y : association;if(association==='hidden')board.brand_visibility='hidden';
        board.access = { role: readOnly?'viewer':'owner', canView: true, canEdit: !readOnly, canViewBoardBrandCore: !readOnly, canViewPresence: false };
        return route.fulfill({ json: board });
      }
      if (u.pathname==='/api/brands' && f.legacyBrands) return route.fulfill({json:{brands:f.legacyBrands}});
      if (u.pathname.startsWith('/api/brands')) { const out = await r.request(method, u.pathname, q.postDataJSON()); return route.fulfill({ status: out.statusCode, json: out.body }); }
      if (u.pathname.startsWith('/api/')) return route.fulfill({ json: { members: [], editors: [], connections: [] } });
      const file = path.join(ROOT, u.pathname === '/' || u.pathname.startsWith('/boards/') ? 'index.html' : u.pathname.slice(1));
      return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : file.endsWith('.ico') ? 'image/x-icon' : 'application/javascript', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    await page.goto('http://localhost' + (empty ? '/' : '/boards/' + D));
    await page.waitForFunction(() => window.autosaveWatcherStarted && !state.isBoardLoading && !state.isBoardHydrating);
    if (!catalogPending) await page.waitForFunction(failed => state.workspaceCatalog.status === (failed ? 'error' : 'ready'), Boolean(catalogFailure));
    await page.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setSidebarCollapsed(false); });
    f.writes = [];
    f.snapshot = () => page.evaluate(() => JSON.stringify({ id: state.currentBoardId, nodes: state.nodes, edges: state.edges, association: state.boardBrandAssociation, snapshot: state.authoritativeBoardBrandCore, core: state.brandCore, dirty: state.isDirty, revision: state.lastKnownUpdatedAt }));
    f.close = async () => { assert.deepEqual(f.errors, []); await page.close(); };
    return f;
  }

  const canvas = p => p.evaluate(() => JSON.stringify({id:state.currentBoardId,nodes:state.nodes,edges:state.edges,core:state.brandCore,snapshot:state.authoritativeBoardBrandCore,association:state.boardBrandAssociation,access:state.boardAccess,revision:state.lastKnownUpdatedAt}));
  const pick = (p,id) => p.evaluate(id => selectSessionBrand(id),id);
  const holdBoard = f => { const hold = { started:defer(),release:defer() }; f.boardHold=hold; return hold; };
  const settle = p => p.waitForFunction(() => !state.isBoardLoading && !state.isBoardHydrating);
  try {
    await check('composition: Brand groups, saved dates, active foreign Board, private projection and incomplete metadata',async()=>{
      const x={id:B,name:'X'},y={id:Y,name:'Y'};
      const rows=[{id:'x-old',brand_id:B},{id:'y-old',brand_id:Y},{id:'x-new',brand_id:B},{id:'unknown',brand_id:null},{id:'unassigned',brand_id:null},{id:'y-new',brand_id:Y},{id:'x-missing',brand_id:B}];
      const c={account:{email:EMAIL},identity:EMAIL,status:'ready',workspaceId:W,brandId:B,boardId:'y-new',catalog:{workspaces:[{id:W,brands:[x,y],boards:rows}]}};
      const metadata=[...['x-old','y-old','x-new','unknown','unassigned','y-new'].map((id,i)=>({id,updated_at:`2026-10-${10+i}T00:00:00Z`,unassigned:id==='unassigned'})),{id:'PRIVATE',updated_at:'2026-11-01',brand_display:{name:'SECRET'}}];
      const before=clone(rows),m=model(c,metadata);
      assert.deepEqual(m.boards.map(b=>b.id),['x-new','x-old','x-missing','y-new','y-old','unassigned','unknown']);
      assert(m.boards.find(b=>b.id==='y-new').active);assert(m.partial);assert(!JSON.stringify(m).includes('SECRET'));assert.deepEqual(rows,before);
      assert.deepEqual(model(c,metadata,'brand').boards.map(b=>b.id),['x-new','x-old','x-missing']);
      assert.deepEqual(model({...c,brandId:null},metadata).boards.map(b=>b.id),['y-new','unassigned','unknown','x-new','y-old','x-old','x-missing']);
      assert.equal(model(c,[]).boards.length,rows.length);assert.equal(model(c,[{id:'x-old',updated_at:'invalid'}]).boards[0].id,'x-old');
      assert.equal(model({...c,status:'stale'},metadata).boards.length,0);
    });
    for(const catalogDelay of [false,true]) await check('direct URL and reload adopt independently authorized saved Brand; catalogDelay='+catalogDelay,async()=>{
      const f=await fixture({catalogDelay}),p=f.page;
      assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),B);assert.equal(await p.locator('#workspace-brand-name').textContent(),f.r.db.brands[0].name);
      await pick(p,Y);await p.reload();await settle(p);await p.waitForFunction(()=>state.workspaceCatalog.status==='ready');
      assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),B);
      if(!catalogDelay){f.r.db.boards[0].workspace_id=W2;await p.reload();await settle(p);assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),null,'A conflicting response Workspace cannot borrow stale catalog association authority');}
      assert.deepEqual(f.writes,[]);await f.close();
    });
    for (const failure of [null, '503', 'network']) await check('deferred catalog ' + (failure || 'success') + ' cannot block boot, rendering or an ordinary autosave', async () => {
      const f = await fixture({catalogPending:true, catalogFailure:failure, allowSave:true}), p = f.page;
      assert.equal(await p.evaluate(() => state.workspaceCatalog.status), 'loading');
      assert.equal(await p.locator('.node').count(), 1);
      assert.equal(await p.evaluate(() => state.activeView), 'board');
      assert.equal(await p.evaluate(() => selectedBrandPreferenceId()), null);
      assert.deepEqual(f.writes, []);
      const before = await canvas(p);
      if (failure) {
        f.catalogHold.resolve();
        await p.waitForFunction(() => state.workspaceCatalog.status === 'error');
        assert.equal(await canvas(p), before);
        assert.equal(await p.evaluate(() => selectedBrandPreferenceId()), null);
      }
      // Change ordinary Canvas data; let the real watcher detect and save it.
      await p.evaluate(() => { state.nodes[0].title = 'Edited while catalog unavailable'; });
      await p.waitForFunction(() => !state.isDirty && !state.isSaving && state.lastSavedSnapshot.includes('Edited while catalog unavailable'));
      assert.deepEqual(f.writes, [{path:'/api/boards/'+D, method:'PUT'}]);
      assert.equal(f.r.db.boards[0].canvas_json.nodes[0].title, 'Edited while catalog unavailable');
      f.writes = [];
      const edited = await canvas(p);
      if (!failure) {
        f.catalogHold.resolve();
        await p.waitForFunction(B => selectedBrandPreferenceId() === B, B);
        assert.equal(await canvas(p), edited);
      }
      assert.deepEqual(f.writes, []);
      await f.close();
    });
    await check('never-settling catalog leaves boot, hydration and autosave watcher complete', async () => {
      const f = await fixture({catalogPending:true}), p = f.page;
      assert.equal(await p.evaluate(() => state.workspaceCatalog.status), 'loading');
      assert.equal(await p.evaluate(() => state.initialServerLoadInFlight), false);
      assert.equal(await p.locator('.node').count(), 1);
      assert.deepEqual(f.writes, []);
      await f.close(); // No catalog release: success cannot depend on eventual settlement.
    });
    for (const change of ['board', 'same-board-generation', 'selection', 'workspace', 'account', 'visibility']) await check('late catalog revalidates ' + change + ' before preference adoption', async () => {
      const f = await fixture({catalogPending:true}), p = f.page;
      await p.evaluate(() => { window.pendingCatalogForTest = state.workspaceCatalog.promise; });
      if (change === 'board') {
        assert.equal(await p.evaluate(Y => { history.replaceState({}, '', '/boards/'+Y); return loadBoardFromUrlIfPresent(Y); }, Y), true);
      } else if (change === 'same-board-generation') {
        const hold = holdBoard(f);
        hold.response = {...clone(f.r.db.boards[0]), brand_id:Y, access:{role:'owner',canView:true,canEdit:true,canViewBoardBrandCore:true}};
        const load = p.evaluate(D => loadBoardFromUrlIfPresent(D), D);
        await hold.started.promise; hold.release.resolve();
        assert.equal(await load, true);
      } else if (change === 'selection') {
        // The explicit neutral Brand choice remains available during catalog loading.
        assert.equal(await p.evaluate(() => clearEphemeralBrandSwitcherSelection()), true);
      } else if (change === 'workspace') {
        await p.evaluate(() => { retireBoardForWorkspaceSwitch(); state.workspaceCatalog.generation++; });
      } else if (change === 'account') {
        await p.evaluate(() => { state.user = {email:'replacement@example.test'}; clearWorkspaceCatalog(); });
      } else {
        f.catalog.workspaces[0].brands = f.catalog.workspaces[0].brands.filter(b => b.id !== B);
        f.catalog.workspaces[0].boards[0].brand_id = null;
      }
      const before = await canvas(p);
      f.catalogHold.resolve();
      // Await the actual catalog + reconciliation microtasks, without a timing guess.
      await p.evaluate(async () => { await window.pendingCatalogForTest; await Promise.resolve(); });
      if (change === 'board' || change === 'same-board-generation') {
        await p.waitForFunction(Y => selectedBrandPreferenceId() === Y, Y);
        assert.equal(await p.evaluate(() => state.currentBoardId), change === 'board' ? Y : D);
      } else {
        assert.equal(await p.evaluate(() => selectedBrandPreferenceId()), null);
      }
      assert.equal(await canvas(p), before);
      assert.deepEqual(f.writes, []);
      await f.close();
    });
    await check('explicit Brand Y selection wins over a pending catalog refresh', async () => {
      const f = await fixture(), p = f.page;
      const hold = holdBoard(f), load = p.evaluate(D => loadBoardFromUrlIfPresent(D), D);
      await hold.started.promise;
      assert.equal(await p.evaluate(Y => selectSessionBrand(Y), Y), true);
      f.catalogHold = defer();
      await p.evaluate(() => { void retryWorkspaceCatalog(); });
      hold.release.resolve();
      assert.equal(await load, true);
      const before = await canvas(p);
      f.catalogHold.resolve();
      await p.evaluate(async () => { await state.workspaceCatalog.promise; await Promise.resolve(); });
      assert.equal(await p.evaluate(() => selectedBrandPreferenceId()), Y);
      assert.equal(await canvas(p), before);
      assert.deepEqual(f.writes, []);
      await f.close();
    });
    await check('deferred hidden independently shared Board never borrows visible Brand authority', async () => {
      const f = await fixture({catalogPending:true, association:'hidden', shared:true, singleton:true}), p = f.page;
      const before = await canvas(p);
      f.catalogHold.resolve();
      await p.evaluate(async () => { await state.workspaceCatalog.promise; await Promise.resolve(); });
      assert.equal(await p.evaluate(() => selectedBrandPreferenceId()), null);
      assert.equal(await canvas(p), before);
      assert.deepEqual(f.writes, []);
      await f.close();
    });
    await check('selection mismatch, actual labels, same Canvas/snapshot, campaign/Brain authority, return to X clears notice',async()=>{
      const f=await fixture(),p=f.page,before=await canvas(p);await pick(p,Y);
      const notice=p.locator('#brand-board-context-notice');assert(await notice.isVisible());assert((await notice.innerText()).includes('Navigation Brand Y'));assert((await notice.innerText()).includes(f.r.db.brands[0].name));assert((await notice.innerText()).includes(f.r.db.boards[0].name));
      assert.equal(await canvas(p),before);assert.equal(await p.evaluate(()=>resolveCampaignCreationContext().brand.id),B);
      assert.equal(await p.evaluate(()=>captureAiBrainAdvisorIdentity().brandId),B);
      await p.evaluate(Y=>{const c=state.workspaceCatalog.value;state.workspaceCatalog.value={...c,workspaces:c.workspaces.map(w=>({...w,brands:w.brands.map(b=>b.id===Y?{...b,name:'Y $& {brand} <img>'}:b)}))};renderWorkspaceSidebar();},Y);
      assert((await notice.innerText()).includes('Y $& {brand} <img>'));assert.equal(await notice.locator('img').count(),0);
      await p.locator('#home-nav-btn').click();assert(!(await notice.isVisible()));assert(await p.locator('[data-home-context]').isVisible());
      await p.locator('[data-home-context] [data-context-action=continue]').click();assert.equal(await canvas(p),before);
      await pick(p,B);assert(!(await notice.isVisible()));assert.equal(await canvas(p),before);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('Home prioritizes connected Y Boards; current X remains reachable and explicit Brand filter is separate',async()=>{
      const f=await fixture(),p=f.page;
      await p.evaluate(({B,Y,W})=>{const w=state.workspaceCatalog.value.workspaces.find(w=>w.id===W);state.workspaceCatalog.value={...state.workspaceCatalog.value,workspaces:[{...w,boards:[...w.boards,{id:'55555555-5555-4555-8555-555555555555',name:'Y connected',brand_id:Y,workspace_id:W,role:'owner'}]}]};}, {B,Y,W});
      await pick(p,Y);await p.locator('#home-nav-btn').click();
      assert.equal(await p.locator('.home-board-card h3').first().textContent(),'Y connected');assert.equal(await p.locator('.home-board-card').count(),2);
      assert((await p.locator('.home-board-card').last().innerText()).includes('Currently open'));
      await p.locator('[data-home-action=filtered]').click();assert.equal(await p.locator('.home-board-card').count(),1);
      await p.locator('[data-home-action=all]').click();assert.equal(await p.locator('.home-board-card').count(),2);assert.deepEqual(f.writes,[]);await f.close();
    });
    for(const association of [null,'hidden']) await check('neutral '+association+' association and independently shared access stay private',async()=>{
      const f=await fixture({association,shared:association==='hidden',singleton:true}),p=f.page;
      assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),null);assert(!(await p.locator('#brand-board-context-notice').isVisible()));
      // Add Y through the ready authorized catalog, independent of Board access.
      await p.evaluate(({Y})=>{const c=state.workspaceCatalog.value,w=c.workspaces[0];state.workspaceCatalog.value={...c,workspaces:[{...w,brands:[...w.brands,{...w.brands[0],id:Y,name:'Navigation Brand Y'}]}]};renderWorkspaceSidebar();},{Y});
      const before=await canvas(p);await pick(p,Y);const text=await p.locator('#brand-board-context-notice').innerText();
      assert(text.includes(association===null?'has no Brand connected':'is not available'));assert(!text.includes('belongs to'));assert(!text.includes(f.r.db.brands[0].name));assert.equal(await canvas(p),before);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('inaccessible associated Brand never becomes navigation authority or visible notice content',async()=>{
      const f=await fixture({inaccessible:true}),p=f.page;assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),null);await pick(p,Y);
      const text=await p.locator('#brand-board-context-notice').innerText();assert(!text.includes(f.r.db.brands[0].name));assert(!text.includes(B));assert(text.includes('not available'));assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('read-only shared Board with hidden association retains viewing contract',async()=>{
      const f=await fixture({association:'hidden',role:'viewer',readOnly:true}),p=f.page;assert.equal(await p.evaluate(()=>state.boardAccess.canEdit),false);assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),null);const before=await canvas(p);await pick(p,Y);assert((await p.locator('#brand-board-context-notice [data-context-action=continue]').innerText()).includes('viewing'));assert.equal(await canvas(p),before);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('Profile Y and filtered Boards actions reuse adapters and keep Board A/X intact',async()=>{
      const f=await fixture(),p=f.page,before=await canvas(p);await pick(p,Y);
      await p.locator('#brand-board-context-notice [data-context-action=profile]').click();await p.waitForFunction(Y=>canonicalBrandDetail.status==='ready'&&canonicalBrandDetail.brandId===Y,Y);assert.equal(await canvas(p),before);
      await p.locator('#campaign-canvas-nav-btn').click();await p.locator('#brand-board-context-notice [data-context-action=boards]').click();await p.waitForFunction(()=>state.activeView==='boards_library'&&state.boardsLibraryRequest.scope==='brand');assert.equal(await canvas(p),before);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('Profile Y cannot supply the avatar for Board X Brain, campaigns or AI Review metadata',async()=>{
      const f=await fixture(),p=f.page;await pick(p,Y);
      await p.locator('#brand-board-context-notice [data-context-action=profile]').click();await p.waitForFunction(()=>canonicalBrandDetail.status==='ready');
      const result=await p.evaluate(()=>{
        const approved=url=>({userApproved:true,avatar:{userApproved:true,imageUrl:url}});
        state.brandCore.brandDNA=approved('http://localhost/board-avatar.png');canonicalBrandDetail.brand.brand_core.brandDNA=approved('http://localhost/profile-avatar.png');
        const profile=getApprovedBrandAvatarUrl(),brain=captureAiBrainAdvisorIdentity().avatarSource,campaign=campaignV3AvatarMarkup();
        const note=addAiReviewPostitToNode(state.nodes[0],{summary:'Mocked review'});clearAutosaveTimer();
        return {profile,brain,campaign,note:note.authorAvatar,activity:state.activityFeed.find(entry=>entry.type==='ai_reviewed_node')?.user?.avatar};
      });
      assert.equal(result.profile,'http://localhost/profile-avatar.png');assert.equal(result.brain,'http://localhost/board-avatar.png');assert(result.campaign.includes('http://localhost/board-avatar.png'));assert(!result.campaign.includes('profile-avatar'));assert.equal(result.note,'http://localhost/board-avatar.png');assert.equal(result.activity,'http://localhost/board-avatar.png');assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('late Board response cannot overwrite a newer intentional selection',async()=>{
      const f=await fixture(),p=f.page,h=holdBoard(f);
      const load=p.evaluate(D=>loadBoardFromUrlIfPresent(D),D);await h.started.promise;await pick(p,Y);h.release.resolve();assert.equal(await load,true);assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),Y);assert.equal(await p.evaluate(()=>state.boardBrandAssociation.brandId),B);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('rejected Workspace attempt during loading cannot suppress authorized Board Brand adoption',async()=>{
      const f=await fixture(),p=f.page;await pick(p,Y);
      await p.evaluate(W2=>{const c=state.workspaceCatalog.value;state.workspaceCatalog.value={...c,workspaces:[...c.workspaces,{id:W2,name:'Other Workspace',role:'viewer',revision:1,brands:[],boards:[]}]};},W2);
      const h=holdBoard(f),load=p.evaluate(D=>loadBoardFromUrlIfPresent(D),D);await h.started.promise;
      assert.equal(await p.evaluate(W2=>selectSessionWorkspace(W2),W2),false);h.release.resolve();assert.equal(await load,true);assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),B);assert.deepEqual(f.writes,[]);await f.close();
    });
    for(const change of ['account','workspace','board']) await check('late response after '+change+' retirement cannot adopt preference',async()=>{
      const f=await fixture(),p=f.page,h=holdBoard(f);const load=p.evaluate(D=>loadBoardFromUrlIfPresent(D),D);await h.started.promise;
      await p.evaluate(({change,Y})=>{selectSessionBrand(Y);if(change==='account')state.user={email:'replacement@example.test'};else if(change==='workspace')state.workspaceCatalog.generation+=1;else state.boardLoadGeneration+=1;},{change,Y});h.release.resolve();await load;
      assert.equal(await p.evaluate(()=>state.session.brandId),change==='account'?null:Y);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('invalid Canvas hydration never adopts Board Brand',async()=>{
      const f=await fixture(),p=f.page;await pick(p,Y);const h=holdBoard(f);h.response={...clone(f.r.db.boards[0]),canvas_json:{nodes:'invalid'}};
      const load=p.evaluate(D=>loadBoardFromUrlIfPresent(D),D);await h.started.promise;h.release.resolve();assert.equal(await load,false);assert.equal(await p.evaluate(()=>selectedBrandPreferenceId()),Y);assert.deepEqual(f.writes,[]);await f.close();
    });
    await check('EN/DE, Light/Dark, mobile, collapsed sidebar, keyboard, reduced motion and screenshots',async()=>{
      const f=await fixture({rich:true}),p=f.page;await pick(p,Y);
      const dir=process.env.BW36_R23_SCREENSHOTS;if(dir)fs.mkdirSync(dir,{recursive:true});
      for(const [width,theme,language,collapsed] of [[1440,'light','en',false],[1440,'dark','de',true],[390,'dark','de',false],[768,'light','en',true]]){
        await p.setViewportSize({width,height:1000});await p.emulateMedia({reducedMotion:'reduce'});
        await p.evaluate(({theme,language,collapsed})=>{FunklixTheme.setPreference(theme);state.uiLanguage=FunklixLanguage.setUiLanguage(language);setSidebarCollapsed(collapsed);setActiveView('board');},{theme,language,collapsed});
        const notice=p.locator('#brand-board-context-notice');assert(await notice.isVisible());assert((await notice.innerText()).includes(language==='de'?'Ausgewählte Marke':'Viewing'));
        assert(await notice.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await notice.locator('button').first().focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.contextAction),'boards');
        if(dir)await p.screenshot({path:path.join(dir,`canvas-${width}-${theme}-${language}.png`),fullPage:true});
        await p.locator('#home-nav-btn').click();assert(await p.locator('[data-home-context]').isVisible());assert(!(await notice.isVisible()));
        await p.locator('[data-home-context] [data-context-action=profile]').focus();await p.evaluate(()=>refreshDashboardIfVisible());assert.equal(await p.evaluate(()=>document.activeElement.dataset.contextAction),'profile');
        await p.waitForFunction(()=>document.querySelectorAll('#home-foundation .home-board-card time').length===5);
        assert((await p.locator('.home-board-card').first().innerText()).includes('Autumn campaign'));
        assert((await p.locator('.home-board-card').filter({hasText:'Shared project'}).innerText()).includes(language==='de'?'Keine sichtbare':'No visible'));
        assert((await p.locator('.home-board-card').filter({hasText:'Unassigned ideas'}).innerText()).includes(language==='de'?'Keine Marke verbunden':'No Brand connected'));
        if(dir){await p.setViewportSize({width,height:width<600?3600:2400});await p.screenshot({path:path.join(dir,`home-${width}-${theme}-${language}.png`),fullPage:true});}
      }
      assert.deepEqual(f.writes,[]);await f.close();
    });
    console.log(`PASS R2.3 ${passed} groups; mocked local transport, no production SQL or provider calls.`);
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
