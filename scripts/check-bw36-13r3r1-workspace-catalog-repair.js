#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Module = require('node:module');
const originalLoad = Module._load;
class GuardPool { query() { throw new Error('Real database forbidden'); } connect() { throw new Error('Real database forbidden'); } }
Module._load = function(request, parent, isMain) {
  if (request === 'pg') return { Pool: GuardPool };
  return originalLoad.call(this, request, parent, isMain);
};
let route, boardCollection, brandCollection, getBoardAccess, session, projects;
try {
  route = require('../api/workspaces');
  boardCollection = require('../api/boards/index');
  brandCollection = require('../api/brands/index');
  ({ getBoardAccess } = require('../api/_board-access'));
  session = require('../api/_auth-session');
  projects = require('../api/projects');
} finally { Module._load = originalLoad; }
const command = require('../project-command');
const ids = Array.from({ length: 8 }, (_, i) => `${i + 1}`.repeat(8) + '-' + `${i + 1}`.repeat(4) + '-4' + `${i + 1}`.repeat(3) + '-8' + `${i + 1}`.repeat(3) + '-' + `${i + 1}`.repeat(12));
const [I, A, B, BRAND_A, BRAND_B, BOARD_A, BOARD_B, LEGACY] = ids;
const email = 'owner@example.com';
const membership = { id: A, name: 'Workspace A', avatar_url: null, locale: 'en', revision: '1', role: 'owner' };
const brand = { id: BRAND_A, workspace_id: A, name: 'Brand A', revision: '1', role: 'owner', owner_email: email };
const board = { id: BOARD_A, workspace_id: A, brand_id: BRAND_A, name: 'Board A', role: 'owner', owner_email: email };
const shared = { id: BOARD_B, workspace_id: B, brand_id: BRAND_B, name: 'Shared Board B', role: 'viewer', owner_email: 'other@example.com' };
const legacy = { id: LEGACY, workspace_id: null, brand_id: null, name: 'Legacy', role: 'editor', owner_email: 'other@example.com' };
const externalBrand = { ...brand, id: BRAND_B, workspace_id: B, name: 'Brand B', owner_email: 'other@example.com' };
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k,v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return v; } });
// Invented PostgreSQL adapter evaluates scope and established independent roles.
function database(options = {}) {
  const memberships = options.memberships || [membership];
  const brands = options.brands || [brand, externalBrand];
  const boards = options.boards || [board];
  return { calls: [], async query(sql, params) {
    this.calls.push({ sql, params });
    assert(!/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(sql));
    if (sql.includes('FROM public.app_identities')) return { rows: options.identities || [{ id: I, canonical_email: email, status: 'active', revision: '1' }] };
    if (sql.includes('FROM public.workspace_memberships')) {
      assert(sql.includes("m.status = 'accepted' AND w.status = 'active'"));
      assert.deepEqual(params, [I]);
      return { rows: memberships };
    }
    if (sql.includes('FROM public.brands b') || sql.includes('FROM public.boards b')) {
      assert(sql.includes('b.workspace_id = ANY($2::uuid[])'));
      assert.deepEqual(params, [email, memberships.map(w => w.id)]);
      const scoped = rows => options.unscopedAdapter ? rows : rows.filter(r => params[1].includes(r.workspace_id));
      if (sql.includes('FROM public.brands b')) {
        assert(sql.includes("AND (lower(b.owner_email) = $1 OR bm.role IN ('admin','editor','viewer'))"));
        return { rows: scoped(brands.filter(r => r.role)) };
      }
      assert(sql.includes("AND (lower(coalesce(b.owner_email, '')) = $1 OR be.email IS NOT NULL OR br.owner_email = $1 OR bm.email IS NOT NULL)"));
      assert(sql.includes('br.workspace_id AS brand_workspace_id'));
      return { rows: scoped(boards.filter(r => r.role)).map(r => ({ ...r, brand_workspace_id: brands.find(b => b.id === r.brand_id)?.workspace_id ?? null })) };
    }
    throw new Error('Unexpected read');
  } };
}
async function catalog(options = {}) {
  const db = database(options), res = response(), logs = [];
  const oldInfo = console.info, oldError = console.error;
  console.info = console.error = (...args) => logs.push(args);
  try { await route.createHandler({ db })({ method: 'GET', headers: { cookie } }, res); }
  finally { console.info = oldInfo; console.error = oldError; }
  assert(!JSON.stringify(logs).includes(email));
  for (const id of ids) assert(!JSON.stringify(logs).includes(id));
  assert(!JSON.stringify(logs).includes('Workspace A'));
  return { db, res };
}
class Element {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}; this.listeners = {}; this.hidden = false; this.disabled = false; this.dataset = {}; this.value = ''; this.isConnected = true;
    this.classList = { add() {}, remove() {}, toggle() {} }; this.style = { setProperty() {} };
  }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  prepend(n) { n.parent = this; this.children.unshift(n); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(k,v) { this.attributes[k] = v; } getAttribute(k) { return this.attributes[k]; }
  addEventListener(k,fn) { (this.listeners[k] ||= []).push(fn); }
  async emit(k,event={}) { const e = { preventDefault() {}, target: this, ...event }; for (const fn of this.listeners[k] || []) await fn(e); }
  click() { if (!this.disabled) return this.onclick ? this.onclick() : this.emit('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; } close() { this.open = false; }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); }
  getBoundingClientRect() { return { left: 16, right: 216, top: 300, bottom: 344, width: 200 }; }
  querySelectorAll(selector) { const all = this.children.flatMap(n => [n, ...n.querySelectorAll('*')]); return selector === '*' ? all : all.filter(n => selector.split(',').includes(n.tagName)); }
  querySelector(selector) { return this.querySelectorAll('*').find(n => n.id === selector.slice(1)) || null; }
  closest(selector) { let n = this; while (n) { if (selector === 'section[hidden]' && n.tagName === 'section' && n.hidden) return n; n = n.parent; } return null; }
}
function documentFixture() {
  const doc = { nodes: {}, documentElement: { clientWidth: 1200, clientHeight: 800 }, addEventListener() {}, createElement(tag) { return new Element(tag, doc); }, createTextNode(textContent) { const n = new Element('text', doc); n.textContent = textContent; return n; }, getElementById(id) { return doc.nodes[id] ||= doc.createElement('div'); }, querySelector() { return null; } };
  doc.body = doc.createElement('body'); doc.activeElement = doc.createElement('button'); return doc;
}
function loadBrowser(doc) {
  const root = { document: doc, innerWidth: 1200, innerHeight: 800, addEventListener() {}, FunklixProjectCommand: command };
  for (const file of ['workspace-catalog.js', 'workspace-sidebar.js', 'project-dialog.js']) vm.runInNewContext(fs.readFileSync(file, 'utf8'), { globalThis: root });
  return root;
}
const app = fs.readFileSync('app.js', 'utf8');
function functionSource(name, next) { return app.slice(app.indexOf(`function ${name}(`), app.indexOf(`function ${next}(`)); }
let cookie;
(async () => {
  const previousSecret = process.env.AUTH_SECRET, previousDb = process.env.POSTGRES_URL;
  process.env.AUTH_SECRET = 'invented-r3r1-regression-secret';
  process.env.POSTGRES_URL = 'invented-never-connected';
  try {
    cookie = 'funklix_session=' + session.createSessionToken({ email });
    let result = await catalog();
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.body.workspaces[0].brands[0].id, BRAND_A);
    assert.equal(result.res.body.workspaces[0].boards[0].id, BOARD_A);
    const success = result.res.body;
    for (const boards of [[board, shared], [board, legacy], [board, shared, legacy]]) {
      for (const unscopedAdapter of [false, true]) {
        result = await catalog({ boards, brands: [brand, { ...externalBrand, role: 'owner' }, { ...brand, id: LEGACY, workspace_id: null }], unscopedAdapter });
        assert.equal(result.res.statusCode, 200);
        assert.equal(result.res.body.workspaces.length, 1);
        assert.equal(result.res.body.workspaces[0].brands.length, 1);
        assert.equal(result.res.body.workspaces[0].boards.length, 1);
        assert(!JSON.stringify(result.res.body).includes(B)); assert(!JSON.stringify(result.res.body).includes(LEGACY));
      }
    }
    // Independent Board-only and legacy authority still works outside the catalog.
    for (const row of [shared, legacy]) {
      const db = { async query(sql) { if (sql.includes('FROM boards WHERE')) return { rows: [row], rowCount: 1 }; if (sql.includes('FROM board_editors')) return { rows: [{ role: row.role }] }; if (sql.includes('FROM brands')) return { rows: [] }; throw new Error('Unexpected authority query'); } };
      const access = await getBoardAccess(row.id, { email }, { client: db });
      assert.equal(access.access.canRead, true); assert.equal(access.access.role, row.role);
    }
    assert.deepEqual((await catalog({ memberships: [], boards: [shared, legacy] })).res.body.workspaces, []);
    // A hidden cross-Workspace Brand must still cause relationship conflict.
    for (const role of [null, 'owner']) {
      result = await catalog({ brands: [brand, { ...externalBrand, role }], boards: [{ ...board, brand_id: BRAND_B }] });
      assert.equal(result.res.statusCode, 409); assert.equal(result.res.body.error.code, 'WORKSPACE_CATALOG_CONFLICT');
      assert.equal(result.res.body.error.stage, 'relationship_validation');
    }
    for (const options of [
      { memberships: [membership, membership] }, { memberships: [{ ...membership, id: 'malformed' }] },
      { brands: [brand, brand] }, { brands: [{ ...brand, id: 'malformed' }] },
      { boards: [board, board] }, { boards: [{ ...board, id: 'malformed' }] },
      { boards: [{ ...board, brand_id: 'malformed' }] }, { brands: [], boards: [board] },
      { brands: [{ ...brand, role: 'member' }] }, { boards: [{ ...board, role: 'admin' }] }
    ]) {
      result = await catalog(options); assert.equal(result.res.body.error.code, 'WORKSPACE_CATALOG_CONFLICT');
      assert(['workspace_projection', 'brand_projection', 'board_projection', 'relationship_validation'].includes(result.res.body.error.stage));
    }
    const unauthorized = await catalog({ brands: [{ ...brand, role: null }], boards: [{ ...board, role: null }] });
    assert.deepEqual(unauthorized.res.body.workspaces[0].brands, []); assert.deepEqual(unauthorized.res.body.workspaces[0].boards, []);
    // A same-Workspace hidden Brand is validated but its UUID stays private.
    const hidden = await catalog({ brands: [{ ...brand, role: null }] });
    assert.equal(hidden.res.statusCode, 200); assert.equal(hidden.res.body.workspaces[0].boards[0].brand_id, null);

    const doc = documentFixture(), root = loadBrowser(doc);
    const checked = root.FunklixWorkspaceCatalog.validate(success);
    const sidebar = root.FunklixWorkspaceSidebar.create({ document: doc, language: () => 'en', onCreate() {} });
    const model = sidebar.render({ signedIn: true, status: 'ready', catalog: checked, activeWorkspaceId: A });
    assert.equal(doc.nodes['workspace-context-name'].textContent, 'Workspace A');
    assert.equal(doc.nodes['workspace-brand-name'].textContent, 'Brand A'); assert.equal(model.brands.length, 1);
    const state = { activeView: 'boards_library', user: { email }, uiLanguage: 'en', isDirty: false, boardCreation: { status: 'idle' }, workspaceCatalog: { status: 'ready', value: checked, activeWorkspaceId: A, generation: 1, identity: email, promise: null }, session: {} };
    let gets = 0, release;
    root.FunklixWorkspaceCatalog = { ...root.FunklixWorkspaceCatalog, load: () => { gets++; return new Promise(resolve => { release = resolve; }); } };
    const context = { state, guardBrandProfileLeave: () => true, window: root, document: doc, workspaceSidebarController: sidebar, projectDialogController: null, createdProjectContext: null,
      crypto: { randomUUID: () => 'launch-1' }, projectCommandBoundary: { submit() { assert.fail('No mutation on launch'); } }, getBoardIdFromPath: () => null,
      renderWorkspaceSidebar() { sidebar.render({ signedIn: !!state.user, status: state.workspaceCatalog.status, catalog: state.workspaceCatalog.value, activeWorkspaceId: state.workspaceCatalog.activeWorkspaceId }); },
      setSaveStatus() { assert.fail('Invisible status'); }, setAuthMessage() { assert.fail('Invisible auth'); }, fetch() { assert.fail('Unexpected fetch'); } };
    vm.createContext(context);
    vm.runInContext(functionSource('retryWorkspaceCatalog', 'refreshActiveWorkspaceContext') + functionSource('showProjectLaunchFeedback', 'getResolvedWorkspaceBrand'), context);
    await context.createNewBoardFlow(); assert.equal(context.projectDialogController.dialog.open, true); assert.equal(gets, 0);
    context.projectDialogController.invalidate(); context.projectDialogController = null;
    for (const language of ['en', 'de']) for (const status of ['error', 'stale']) {
      state.uiLanguage = language; state.workspaceCatalog.status = status;
      await context.createNewBoardFlow(); assert.equal(doc.nodes['project-launch-feedback'].hidden, false);
      assert.equal(doc.nodes['project-launch-action'].hidden, false); assert.equal(doc.nodes['project-launch-action'].textContent, language === 'de' ? 'Erneut versuchen' : 'Retry');
      assert(doc.nodes['project-launch-status'].textContent.includes(language === 'de' ? 'nicht verfügbar' : 'unavailable'));
    }
    const action = doc.nodes['project-launch-action']; const retries = [action.click(), action.click()];
    assert.equal(gets, 1); assert.equal(state.workspaceCatalog.status, 'refreshing');
    const flight = state.workspaceCatalog.promise; release(checked); await flight; await Promise.all(retries);
    assert.equal(state.workspaceCatalog.status, 'ready'); assert.equal(doc.nodes['project-launch-feedback'].hidden, true);
    await context.createNewBoardFlow(); assert.equal(context.projectDialogController.dialog.open, true); assert.equal(gets, 1);
    context.projectDialogController.invalidate(); context.projectDialogController = null;
    state.workspaceCatalog.status = 'loading'; await context.createNewBoardFlow(); assert.equal(doc.nodes['project-launch-action'].hidden, true); assert(doc.nodes['project-launch-status'].textContent.includes('geladen'));
    state.workspaceCatalog = { ...state.workspaceCatalog, status: 'ready', value: { ...checked, workspaces: [] }, activeWorkspaceId: null };
    context.renderWorkspaceSidebar(); await context.createNewBoardFlow(); assert.equal(action.textContent, 'Workspace erstellen'); action.click();
    assert(doc.body.children.some(n => n.id === 'workspace-create-dialog')); sidebar.close(false);
    state.workspaceCatalog.value = { ...checked, workspaces: [checked.workspaces[0], { ...checked.workspaces[0], id: B }] }; await context.createNewBoardFlow(); assert(doc.nodes['project-launch-status'].textContent.includes('Wähle links'));
    // Retry failure remains local; a late response after account change cannot render or reconcile.
    state.workspaceCatalog.status = 'error'; await context.createNewBoardFlow(); action.click(); const oldFlight = state.workspaceCatalog.promise;
    state.user = { email: 'changed@example.com' }; state.workspaceCatalog = { status: 'idle', value: null, activeWorkspaceId: null, generation: 99 };
    context.showProjectLaunchFeedback(null); release(checked); await oldFlight; await Promise.resolve();
    assert.equal(state.workspaceCatalog.value, null); assert.equal(doc.nodes['project-launch-feedback'].hidden, true);
    state.user = { email }; state.workspaceCatalog = { status: 'error', value: null, activeWorkspaceId: null, generation: 100, identity: email };
    root.FunklixWorkspaceCatalog.load = async () => { gets++; throw Object.assign(new Error('invented'), { code: 'DATABASE_UNAVAILABLE' }); };
    await context.createNewBoardFlow(); await action.click();
    assert.equal(doc.nodes['project-launch-feedback'].hidden, false); assert.equal(action.hidden, false);
    state.activeView = 'board'; await context.createNewBoardFlow();
    const visible = context.showProjectLaunchFeedback.surface;
    assert.equal(visible.host.open, true); assert.equal(visible.host.hidden, false); assert.equal(visible.action.hidden, false);
    context.showProjectLaunchFeedback(null); assert.equal(visible.host.isConnected, false);
    state.activeView = 'boards_library';
    assert(fs.readFileSync('index.html', 'utf8').includes('id="project-launch-status" role="status" aria-live="polite"'));

    // Legacy inputs stay rejected before any query/schema write; R5 adds an explicit workspace Brand contract.
    for (const handler of [boardCollection, brandCollection]) for (const body of [{}, { brand_id: BRAND_A, workspace_id: A }, { name: 'Legacy new row', canvas_json: {} }]) {
      const res = response(); await handler({ method: 'POST', body, headers: { cookie } }, res);
      if (handler === boardCollection) { assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'PROJECT_CREATION_REQUIRED'); assert(res.body.error.includes('New project')); }
      else { assert.equal(res.statusCode, 422); assert.equal(res.body.code, 'INVALID_REQUEST'); }
    }
    // Execute the authoritative service against the existing invented transaction fixture.
    const r3 = fs.readFileSync('scripts/check-bw36-13r3-authoritative-project-creation.js', 'utf8');
    const transaction = { structuredClone, Promise, command }; vm.createContext(transaction);
    vm.runInContext(r3.slice(r3.indexOf("const I='"), r3.indexOf('const input=')) + '\nthis.MemoryDb=MemoryDb;this.W=W;this.B=B;', transaction);
    for (const brandChoice of [{ existing_id: transaction.B }, { new_name: 'New Brand' }]) {
      const db = new transaction.MemoryDb({ empty: !!brandChoice.new_name }), input = command.build(transaction.W, 'Project', brandChoice, 'write-1'), res = response();
      await projects.createHandler({ db })({ method: 'POST', body: input, headers: { cookie } }, res);
      assert.equal(res.statusCode, 201); assert.equal(db.boards[0].workspace_id, transaction.W); assert.equal(db.brands[0].workspace_id, transaction.W);
      assert.equal(db.boards[0].brand_id, db.brands[0].id); assert.equal(db.trace.at(-1), 'COMMIT');
    }
    const db = new transaction.MemoryDb({ crossWorkspace: true }), res = response();
    await projects.createHandler({ db })({ method: 'POST', body: command.build(transaction.W, 'Project', { existing_id: transaction.B }, 'cross-1'), headers: { cookie } }, res);
    assert.equal(res.body.error.code, 'CROSS_WORKSPACE_BRAND'); assert.equal(db.boards.length, 0); assert(db.trace.includes('ROLLBACK'));
    console.log('BW-36.13R3R1 passed: scoped signed-session catalog, independent Board-only/legacy access, hidden cross-Workspace conflict, integrity/privacy, real sidebar/dialog glue, visible localized feedback, single-flight Retry/account isolation, atomic R3 and blocked legacy writes. No real database/network/provider/AI activity. Browser visuals unverified.');
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previousSecret;
    if (previousDb === undefined) delete process.env.POSTGRES_URL; else process.env.POSTGRES_URL = previousDb;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
