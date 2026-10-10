#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), cp = require('node:child_process');
const { runtime, W, B, D, EMAIL, now, clone, png } = require('./fixtures/bw36-13r5-local-runtime');
const model = require('../campaign-responsibilities'), v3 = require('../campaign-v3'), contract = require('../campaign-creation');
let chromium; try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core')); }
const ROOT = path.resolve(__dirname, '..');
function server(r) {
  const editors = [{ email: 'editor@local.test', name: 'Board Editor', role: 'editor', avatar: '/fixture-avatar.png' }, { email: 'viewer@local.test', name: 'Viewer', role: 'viewer' }];
  const members = [{ email: 'admin@local.test', name: 'Brand Admin', role: 'admin' }, { email: 'brandeditor@local.test', name: 'Brand Editor', role: 'editor' }, { email: 'brandviewer@local.test', role: 'viewer' }];
  let writes = 0, fail = false, tx = null, tail = Promise.resolve();
  const rows = values => ({ rows: clone(values), rowCount: values.length });
  async function query(sql, args = []) {
    sql = sql.replace(/\s+/g, ' ').trim();
    if (sql === 'BEGIN') { tx = clone(r.db.boards); return rows([]); }
    if (sql === 'ROLLBACK') { tx = null; return rows([]); }
    if (sql === 'COMMIT') { r.db.boards = tx; tx = null; return rows([]); }
    const boards = tx || r.db.boards;
    if (sql.includes('canvas_json = $2::jsonb') && sql.startsWith('SELECT')) return rows(boards.filter(b => b.id === args[0] && JSON.stringify(b.canvas_json) === args[1]));
    if (sql.startsWith('UPDATE boards SET canvas_json')) { if (fail) throw new Error('Injected save error'); const b = boards.find(b => b.id === args[0]); b.canvas_json = JSON.parse(args[1]); b.updated_at = new Date(Date.parse(b.updated_at) + 1000).toISOString(); writes++; return rows([b]); }
    if (sql.includes('FROM boards WHERE id')) return rows(boards.filter(b => b.id === args[0]));
    if (sql.includes('INSERT INTO board_editors')) { let p = editors.find(p => p.email === args[1]); if (!p) { p = { email: args[1] }; editors.push(p); } p.role = args[2]; return rows([p]); }
    if (sql.includes('FROM board_editors')) {
      let list = editors;
      if (sql.includes('email = $2')) list = list.filter(p => p.email === args[1]);
      if (sql.includes("role = 'editor'")) list = list.filter(p => p.role === 'editor');
      return rows(list);
    }
    if (sql.includes('FROM brands b LEFT JOIN')) {
      const b = r.db.brands.find(b => b.id === args[0]); const role = b?.owner_email === args[1] ? 'owner' : members.find(p => p.email === args[1])?.role;
      return rows(role ? [{ role }] : []);
    }
    if (sql.includes('FROM brands WHERE id')) return rows(r.db.brands.filter(b => b.id === args[0]).map(b => ({ email: b.owner_email })));
    if (sql.includes('FROM brand_members')) return rows(members.filter(p => ['admin', 'editor'].includes(p.role)));
    throw new Error('Unexpected production query: ' + sql);
  }
  const pool = { query, async connect() { let unlock; const prior = tail; tail = new Promise(resolve => unlock = resolve); await prior; return { query, release: unlock }; } };
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(ROOT, relative); if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const requireLocal = name => {
      if (name.endsWith('_boards-storage')) return { pool, ensureBoardsTable: async () => {} };
      if (name.endsWith('_auth-session')) return { getSessionUser: req => req.user };
      if (name.startsWith('.')) return load(path.relative(ROOT, path.resolve(path.dirname(filename), name + (path.extname(name) ? '' : '.js'))));
      return require(name);
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: requireLocal, process: { env: { POSTGRES_URL: 'fixture', NODE_ENV: 'production' } }, console: { debug() {} } }, { filename }); return module.exports;
  }
  const api = load('api/_campaign-responsibilities.js'), roster = load('api/boards/[id]/editors/index.js'), access = load('api/_board-access.js');
  async function call(method, url, body, user = { email: EMAIL, name: 'Board Owner' }) {
    const u = new URL(url, 'http://localhost'); const req = { method, query: { id: D, ...Object.fromEntries(u.searchParams) }, body, user };
    const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = clone(b); return this; } };
    if (u.pathname.endsWith('/editors')) await roster(req, res);
    else { try { await api.saveResponsibilities(req, res, D, user); } catch { res.status(500).json({ error: 'Injected save error' }); } }
    return res;
  }
  return { call, api, access, editors, members, get writes() { return writes; }, set fail(value) { fail = value; } };
}
function protectedGenerator() {
  const base = cp.execFileSync('git', ['show', '4806fd3:campaign-v3.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); assert.equal(fs.readFileSync(path.join(ROOT, 'campaign-v3.js'), 'utf8'), base);
  for (const f of ['api/generate-campaign.js', 'api/_campaign-creation.js', 'campaign-creation.js', 'campaign-creation-dialog.js']) assert.equal(fs.readFileSync(path.join(ROOT, f), 'utf8'), cp.execFileSync('git', ['show', '4806fd3:' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), old = cp.execFileSync('git', ['show', '4806fd3:app.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  for (const [start, end] of [['async function runCampaignV3AICompatibility(', 'function centerViewportOnCampaignV3Result('], ['async function startCampaignV3Creation(', 'async function debugRunCampaignV3AI(']]) {
    const extract = s => s.slice(s.indexOf(start), s.indexOf(end, s.indexOf(start) + 1)); assert.equal(extract(app), extract(old));
  }
  for (const file of ['campaign-responsibilities.js', 'api/_campaign-responsibilities.js']) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, file), 'utf8'), /\b(?:alert|confirm|prompt)\s*\(/);
}
async function serverChecks() {
  const r = runtime(), s = server(r), url = `/api/boards/${D}/editors?assignable=true`;
  r.db.brands[0].owner_email = 'brandowner@local.test';
  let result = await s.call('GET', url); assert.equal(result.statusCode, 200);
  const emails = result.body.people.map(p => p.email); for (const e of [EMAIL, 'editor@local.test', 'brandowner@local.test', 'admin@local.test', 'brandeditor@local.test']) assert(emails.includes(e));
  for (const e of ['viewer@local.test','brandviewer@local.test','foreign@other.test']) assert(!emails.includes(e));
  for (const email of ['editor@local.test','brandowner@local.test','admin@local.test','brandeditor@local.test']) assert.equal((await s.call('GET', url, null, {email})).statusCode, 200);
  for (const user of [null, {email:'viewer@local.test'}, {email:'brandviewer@local.test'}, {email:'foreign@other.test'}]) assert([401,403].includes((await s.call('GET', url, null, user)).statusCode));
  assert.equal((await s.call('POST', `/api/boards/${D}/editors`, {email:'new@local.test',role:'editor'}, {email:'admin@local.test'})).statusCode,403);
  r.db.boards[0].canvas_json.nodes=[{id:'one',type:'Idea'},{id:'two',type:'Content'}];
  const body = {canvas_json:clone(r.db.boards[0].canvas_json),lastKnownUpdatedAt:now,responsibility_changes:[{id:'one',email:'editor@local.test'},{id:'two',email:'editor@local.test'}]}; body.canvas_json.nodes.forEach(n=>n.ownerEmail='editor@local.test');
  assert.equal((await s.call('PUT', `/api/boards/${D}`, body, {email:'viewer@local.test'})).statusCode,403);
  s.fail=true; assert.equal((await s.call('PUT', `/api/boards/${D}`, body)).statusCode,500); assert.equal(s.writes,0); assert(r.db.boards[0].canvas_json.nodes.every(n=>!n.ownerEmail));
  s.fail=false; assert.equal((await s.call('PUT', `/api/boards/${D}`, body)).statusCode,200); assert.equal(s.writes,1);
  assert.equal((await s.call('PUT', `/api/boards/${D}`, body)).statusCode,200); assert.equal(s.writes,1,'exact replay does not duplicate write');
  const stale=clone(body);stale.canvas_json.nodes[0].ownerEmail=EMAIL;stale.responsibility_changes[0].email=EMAIL;assert.equal((await s.call('PUT', `/api/boards/${D}`, stale)).statusCode,409);assert.equal(s.writes,1);
  const revoked=clone(body);revoked.lastKnownUpdatedAt=r.db.boards[0].updated_at;s.editors[0].role='viewer';assert.equal((await s.call('PUT', `/api/boards/${D}`, revoked)).statusCode,403);
  console.log('PASS production permission projection, invitation boundary, atomic save, rollback, replay, stale revision and revocation');
}
async function browserChecks() {
  const r=runtime(), s=server(r); const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}}); page.setDefaultTimeout(15000);
    const errors=[],dialogs=[],requests=[]; let writes=0;
    page.on('pageerror', e=>errors.push(e.message)); page.on('dialog',d=>{dialogs.push(d.type());void d.dismiss();});
    await page.route('**/*', async route=>{
      const req=route.request(),url=new URL(req.url()); assert.equal(url.hostname,'localhost','no provider/AI/storage/production request is allowed');requests.push(url.pathname);
      if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:{email:EMAIL,name:'Board Owner'}}});
      if(url.pathname==='/api/workspaces'){const c=r.catalog();c.request_id='0123456789abcdef01234567';c.workspaces=c.workspaces.map(w=>({...w,avatar_url:null,locale:null,brands:w.brands.map(({workspace_id,...b})=>b),boards:w.boards.map(({workspace_id,...b})=>b)}));return route.fulfill({json:c});}
      if(url.pathname==='/api/brands')return route.fulfill({json:{brands:r.catalog().workspaces[0].brands.map(b=>({...b,created_at:now,updated_at:now}))}});
      if(url.pathname.endsWith('/editors')){const response=await s.call(req.method(),url.href,req.postDataJSON());return route.fulfill({status:response.statusCode,json:response.body});}
      if(url.pathname===`/api/boards/${D}`){if(req.method()==='PUT'){writes++;const response=await s.call('PUT',url.href,req.postDataJSON());return route.fulfill({status:response.statusCode,json:response.body});}return route.fulfill({json:(await r.request('GET',url.pathname)).body});}
      if(url.pathname==='/api/generate-campaign')return route.fulfill({json:{nodes:v3.createCampaignV3MockNodes(req.postDataJSON(),'grouped')}});
      if(url.pathname==='/api/refine-node')throw new Error('Valid fixtures require no repair');
      if(url.pathname==='/api/campaigns'){
        const input=contract.request(req.postDataJSON()),board=r.db.boards[0];board.canvas_json=input.canvas_json;board.updated_at=new Date(Date.parse(board.updated_at)+1000).toISOString();
        const value={contract:contract.CONTRACT,ok:true,created:true,request_id:input.request_id,board:{...board,access:{role:'owner',canEdit:true,canView:true,canManagePermissions:true}},workspace:{id:W,name:'Local Workspace'},brand:{id:B,workspace_id:W,name:'Local Brand',revision:1},node_id:input.canvas_json.nodes.find(n=>n.type==='Idea').id,next_route:`/boards/${D}`};contract.validate(value,input);return route.fulfill({json:value});
      }
      if(url.pathname==='/fixture-avatar.png')return route.fulfill({contentType:'image/png',body:png});
      if(url.pathname.startsWith('/api/'))return route.fulfill({json:{boards:r.db.boards,members:[],editors:[],nodes:[],presence:[]}});
      const file=path.resolve(ROOT,url.pathname==='/'||url.pathname.startsWith('/boards/')?'index.html':'.'+url.pathname);return route.fulfill(fs.existsSync(file)&&fs.statSync(file).isFile()?{path:file}:{body:''});
    });
    async function boot(){await page.goto(`http://localhost/boards/${D}`);await page.waitForFunction(()=>state.currentBoardId&&state.workspaceCatalog.status==='ready'&&!state.isBoardLoading);await page.evaluate(()=>{setAppMode('canvas');setActiveView('board');});}
    await boot();await page.locator('#create-campaign-btn').click();const creation=page.locator('#campaign-creation-dialog');await creation.locator('#campaign-creation-idea').fill('Launch reliable local service');await creation.getByRole('button',{name:'Continue',exact:true}).click();await creation.locator('#campaign-v3-variations').fill('2');await creation.locator('#campaign-v3-posts').fill('3');await creation.getByRole('button',{name:'Generate Campaign',exact:true}).click();await creation.locator('#campaign-v3-assign').waitFor();assert(await creation.locator('#campaign-v3-reveal').isVisible());await creation.locator('#campaign-v3-assign').click();
    const dialog=page.locator('#campaign-responsibilities');await dialog.waitFor();await page.waitForFunction(()=>document.getElementById('campaign-responsibilities').getAttribute('aria-busy')==='false');
    assert.equal(await dialog.locator('[data-responsibility-node]').count(),13);assert.equal(await dialog.locator('.responsibility-variation').count(),2);assert.equal(await dialog.getByRole('heading',{name:'Shared funnel assets'}).count(),1);
    const groups=await page.evaluate(()=>FunklixCampaignResponsibilities.structure(state.nodes,state.edges));assert(groups.campaigns[0].variations.every(v=>v.contents.length===1&&v.contents[0].posts.length===3));assert.equal(groups.campaigns[0].shared.length,2);
    for (let i=0;i<groups.campaigns[0].variations.length;i++){const expected=model.variationNodes(groups.campaigns[0].variations[i]).map(n=>n.id);assert.deepEqual(await dialog.locator('.responsibility-variation').nth(i).locator('[data-responsibility-node]').evaluateAll(rows=>rows.map(row=>row.dataset.responsibilityNode)),expected);}
    const v=groups.campaigns[0].variations[0], ids=model.variationNodes(v).map(n=>n.id), shared=groups.campaigns[0].shared.map(n=>n.id);
    const saveCount=()=>writes;
    async function selectPerson(email){await dialog.locator(`.responsibility-people button[data-email="${email}"]`).click();}
    async function saved(){await dialog.locator('.responsibility-live').getByText('Saved',{exact:true}).waitFor();}
    await dialog.getByRole('button',{name:'Assign variation',exact:true}).first().click();await selectPerson('editor@local.test');const before=saveCount();await dialog.getByRole('button',{name:'Assign unassigned only',exact:true}).click();await saved();assert.equal(saveCount(),before+1);
    assert(await page.evaluate(({ids,shared})=>ids.every(id=>getNode(id).ownerEmail==='editor@local.test')&&shared.every(id=>!getNode(id).ownerEmail),{ids,shared}));
    const post=v.contents[0].posts[0].id;
    async function assignNode(id,email){await dialog.locator(`[data-responsibility-node="${id}"]`).getByRole('button').click();await selectPerson(email);await dialog.locator('.responsibility-picker').getByRole('button',{name:'Assign',exact:true}).click();await saved();}
    await assignNode(post,EMAIL);assert.equal(await page.evaluate(id=>getDashboardNodeOwnerLabel(getNode(id)),post),'Assigned to you');assert(await page.evaluate(id=>{state.nodeFilters.owner=new Set(['mine']);const match=nodeMatchesOwnerFilters(getNode(id));state.nodeFilters.owner.clear();return match;},post));
    assert(await page.locator(`.node[data-id="${post}"]`).innerText().then(t=>t.includes('Board Owner')));await page.evaluate(()=>updateListView());assert(await page.locator('#board-list-view').innerText().then(t=>t.includes('Board Owner')));
    await dialog.getByRole('button',{name:'Assign variation',exact:true}).first().click();assert(await dialog.getByText('5 assets already have a responsible person.').isVisible());await selectPerson('brandeditor@local.test');await dialog.getByRole('button',{name:'Assign unassigned only',exact:true}).click();assert.equal(await page.evaluate(id=>getNode(id).ownerEmail,post),EMAIL);
    await dialog.getByRole('button',{name:'Assign variation',exact:true}).first().click();await selectPerson('brandeditor@local.test');await dialog.getByRole('button',{name:'Replace all assignments',exact:true}).click();await saved();assert(await page.evaluate(ids=>ids.every(id=>getNode(id).ownerEmail==='brandeditor@local.test'),ids));assert(await page.evaluate(ids=>ids.every(id=>!getNode(id).ownerEmail),shared));
    await assignNode(shared[0],'admin@local.test');await assignNode(shared[1],EMAIL);
    await dialog.locator(`[data-responsibility-node="${post}"]`).getByRole('button').click();await dialog.getByRole('button',{name:'Remove responsibility',exact:true}).click();await saved();assert(!await page.evaluate(id=>getNode(id).ownerEmail,post));
    await dialog.getByRole('button',{name:/Assign all unassigned/}).click();assert(await dialog.getByText('7 assets will be assigned.').isVisible());await selectPerson('editor@local.test');await dialog.getByRole('button',{name:'Assign unassigned only',exact:true}).click();await saved();assert(await dialog.getByRole('button',{name:/Assign all unassigned/}).isDisabled());assert.equal(await page.evaluate(id=>getNode(id).ownerEmail,shared[0]),'admin@local.test');
    await dialog.getByRole('button',{name:'Add team member',exact:true}).click();await dialog.locator('input[type=email]').fill('new@local.test');await dialog.locator('form').getByRole('button',{name:'Add team member'}).click();await dialog.getByText('Team member added',{exact:true}).waitFor();await dialog.locator(`[data-responsibility-node="${post}"]`).getByRole('button').click();assert(await dialog.locator('[data-email="new@local.test"]').isVisible());await selectPerson('new@local.test');await dialog.locator('.responsibility-picker').getByRole('button',{name:'Assign',exact:true}).click();await saved();
    // Failed save retains the exact mutation and activity, and retries only that command.
    s.fail=true;await dialog.locator(`[data-responsibility-node="${post}"]`).getByRole('button').click();await selectPerson(EMAIL);await dialog.locator('.responsibility-picker').getByRole('button',{name:'Assign',exact:true}).click();await dialog.getByText('Not saved',{exact:true}).waitFor();const activity=await page.evaluate(()=>state.activityFeed.length), failed=saveCount();assert.equal(await page.evaluate(id=>getNode(id).ownerEmail,post),EMAIL);await page.waitForTimeout(3200);assert.equal(saveCount(),failed);s.fail=false;await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.locator('#utilities-toggle-btn').click();await page.locator('[data-utility-action="campaign-responsibilities"]').click();await dialog.getByText('Not saved',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Retry',exact:true}).click();await saved();assert.equal(saveCount(),failed+1);assert.equal(await page.evaluate(()=>state.activityFeed.length),activity);
    // A remote edit wins; local assignment must be explicitly reviewed again.
    r.db.boards[0].canvas_json.nodes.find(n=>n.id===post).title='Remote title survives';r.db.boards[0].updated_at=new Date(Date.parse(r.db.boards[0].updated_at)+1000).toISOString();await dialog.locator(`[data-responsibility-node="${post}"]`).getByRole('button').click();await selectPerson('editor@local.test');await dialog.locator('.responsibility-picker').getByRole('button',{name:'Assign',exact:true}).click();await dialog.getByRole('button',{name:'Load latest project'}).waitFor();assert.equal(r.db.boards[0].canvas_json.nodes.find(n=>n.id===post).ownerEmail,EMAIL);await dialog.getByRole('button',{name:'Load latest project'}).click();await dialog.getByText('Review your selection and confirm again.',{exact:true}).waitFor();assert.equal(await page.evaluate(id=>getNode(id).title,post),'Remote title survives');await dialog.locator('.responsibility-picker').getByRole('button',{name:'Assign',exact:true}).click();await saved();
    // Confirmed server save must remain successful after a local rendering failure.
    await page.evaluate(()=>{window.originalRefresh=refreshOwnershipDisplays;let calls=0;refreshOwnershipDisplays=()=>{if(++calls===2)throw new Error('Injected reconciliation fault');return window.originalRefresh();};});await dialog.locator(`[data-responsibility-node="${post}"]`).getByRole('button').click();await selectPerson(EMAIL);await dialog.locator('.responsibility-picker').getByRole('button',{name:'Assign',exact:true}).click();await dialog.getByText('Saved. Reload this project to refresh the display.',{exact:true}).waitFor();assert.equal(r.db.boards[0].canvas_json.nodes.find(n=>n.id===post).ownerEmail,EMAIL);await page.evaluate(()=>refreshOwnershipDisplays=window.originalRefresh);const confirmed=saveCount();await dialog.getByRole('button',{name:'Load latest project'}).click();await saved();assert.equal(saveCount(),confirmed);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>document.activeElement.id),'utilities-toggle-btn');await page.locator('#utilities-toggle-btn').click();await page.locator('[data-utility-action="campaign-responsibilities"]').click();await dialog.waitFor();await page.waitForFunction(()=>document.getElementById('campaign-responsibilities').getAttribute('aria-busy')==='false');
    for(const theme of ['light','dark'])for(const width of [1440,1024,768,480,375,320,720]){await page.setViewportSize({width,height:width===720?450:600});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));assert(await dialog.locator('button').evaluateAll(bs=>bs.every(b=>b.classList.contains('fk-btn')&&getComputedStyle(b).appearance==='none')));}
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});assert(await dialog.getByRole('heading',{name:'Campaign responsibilities'}).isVisible());await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
    await dialog.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Shift+Tab');const last=await dialog.locator('button:not([disabled])').last().evaluate(n=>n===document.activeElement);assert(last);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Close');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await boot();assert.equal(await page.evaluate(id=>getNode(id).ownerEmail,post),EMAIL);assert.equal(await page.evaluate(()=>state.nodes.length),13);assert.equal(await page.evaluate(()=>state.edges.length),17);
    await page.evaluate(()=>{state.boardAccess.canManagePermissions=false;state.boardAccess.canEdit=true;openCampaignResponsibilities();});await page.waitForFunction(()=>document.getElementById('campaign-responsibilities').getAttribute('aria-busy')==='false');assert.equal(await dialog.getByRole('button',{name:'Add team member'}).count(),0);assert(await dialog.locator('[data-responsibility-node] button').first().isEnabled());await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.evaluate(()=>{state.boardAccess.canEdit=false;state.boardAccess.reason='public_viewer';state.user=null;openCampaignResponsibilities();});await page.waitForFunction(()=>document.getElementById('campaign-responsibilities').getAttribute('aria-busy')==='false');assert(await dialog.locator('[data-responsibility-node] button').first().isDisabled());assert.equal(await dialog.getByRole('button',{name:'Add team member'}).count(),0);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.evaluate(()=>{language.setUiLanguage('de');state.uiLanguage='de';state.boardAccess.canEdit=true;state.boardAccess.reason='owner';state.user={email:'local-owner@example.test'};openCampaignResponsibilities();});assert(await dialog.getByRole('heading',{name:'Kampagnen-Verantwortlichkeiten'}).isVisible());
    assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);assert(requests.filter(p=>p==='/api/workspaces').length<6,'assignments never refetch workspaces');
    console.log('PASS real Chromium: V3 completion + Utilities, 13 nodes/17 edges, all groups, one-save bulk, individual/removal/chip/list/dashboard/filter/activity, invitation, retry, stale review, confirmed save, refresh, Viewer, EN/DE, Light/Dark, 7 viewport/reflow sizes, forced colors/reduced motion, keyboard/Escape/focus restoration; no external I/O');
  } finally {await browser.close();}
}
(async()=>{protectedGenerator();await serverChecks();await browserChecks();console.log('BW-36.15 checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});
