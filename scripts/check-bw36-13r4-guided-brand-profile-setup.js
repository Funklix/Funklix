#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
globalThis.fetch = () => { throw new Error('Real network forbidden'); };
const profile = require('../brand-profile-setup');
const language = require('../language');
const command = require('../project-command');
const registry = require('../knowledge-module-registry');
const W = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', D = '33333333-3333-4333-8333-333333333333';
const now = '2026-10-07T09:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
const brand = { id: B, workspace_id: W, name: '😀 Über', brand_core: { brandCore: '', valueProposition: '', personas: [], toneOfVoice: [], messagingPillars: [], customTiles: [], unknown: { preserve: true } }, revision: 1, logo_url: null, logo_revision: 0, created_at: now, updated_at: now, access: { role: 'owner', canEditCanonicalBrand: true } };
const png = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(32,16); png.writeUInt32BE(32,20);
const candidate = { status: 'candidate_found', candidate_url: 'https://example.com/logo.png', mime_type: 'image/png', image_base64: png.toString('base64'), image_sha256: createHash('sha256').update(png).digest('hex') };
const suggestions = { brandCore: 'Positioning', valueProposition: 'Benefit', personas: [{ name: 'Audience', note: 'Needs' }], toneOfVoice: ['Clear'], messagingPillars: ['Message'], brandAssets: { logo: 'https://evil.example/image.png' }, unknown: 'must not enter' };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => clone(payload) });
function makeSession(overrides = {}) {
  let context = { account: {}, generation: 1, workspaceId: W, brandId: B, authorized: true };
  const calls = [], saves = [], logos = [];
  const options = { brand: clone(brand), getContext: () => context, validateBrand: value => value?.id === B && Number.isSafeInteger(value.revision) && value.access && value.brand_core,
    requestId: () => `test-${calls.length}`, onSave: value => saves.push(value), onLogo: (...args) => logos.push(args),
    fetchImpl: async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : null; calls.push({ url, init, body });
      if (url === '/api/analyze-brand-domain') return response({ suggestions, logoDiscovery: candidate });
      if (url.endsWith('/logo')) return response({ contract: 'brand_logo_v1', request_id: body.request_id, logo: { logo_url: `/api/brands/${B}/logo?revision=${body.expected_revision + 1}`, logo_revision: body.expected_revision + 1, source: body.action === 'upload' ? 'uploaded' : 'discovered' } });
      if (init.method === 'PUT') return response({ ...brand, name: body.name, brand_core: body.brand_core, revision: body.revision + 1 });
      return response({ ...brand, revision: 2 });
    }, ...overrides };
  return { options, session: profile.createSession(options), calls, saves, logos, change(value) { context = { ...context, ...value }; } };
}
class Element {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}; this.dataset = {}; this.listeners = {}; this.hidden = false; this.disabled = false; this.value = ''; this.isConnected = true;
    const classes = new Set(); this.classList = { add: (...items) => items.forEach(item => classes.add(item)), remove: item => classes.delete(item), toggle: (item, yes) => { if (yes) classes.add(item); else classes.delete(item); }, contains: item => classes.has(item) };
  }
  append(...nodes) { nodes.forEach(n => { n.parentElement = this; this.children.push(n); }); }
  prepend(n) { n.parentElement = this; this.children.unshift(n); }
  replaceChildren(...nodes) { this.children.forEach(n => { n.isConnected = false; }); this.children = []; this.append(...nodes); }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return [this.text || '', ...this.children.map(n => n.textContent)].join(''); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  async emit(type, values = {}) { const event = { preventDefault() { this.prevented = true; }, ...values }; for (const fn of this.listeners[type] || []) await fn(event); return event; }
  click() { if (!this.disabled) return this.emit('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  close() { this.open = false; }
  showModal() { this.open = true; }
  remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); }
  matches(selector) {
    if (selector === '*') return true;
    if (selector.startsWith('.')) return this.className === selector.slice(1);
    const match = selector.match(/^(\w+)?(?:\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\])?$/);
    if (!match) return false;
    if (match[1] && this.tagName !== match[1]) return false;
    if (!match[2]) return true;
    let value = match[2] === 'hidden' ? this.hidden ? 'true' : undefined : this.attributes[match[2]];
    if (match[2].startsWith('data-')) value = this.dataset[match[2].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    return value !== undefined && (match[3] === undefined || String(value) === match[3]);
  }
  querySelectorAll(selectors) { return this.children.flatMap(n => [...(selectors.split(',').some(s => n.matches(s)) ? [n] : []), ...n.querySelectorAll(selectors)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
}
function documentFixture() { const doc = { createElement: tag => new Element(tag, doc) }; doc.body = doc.createElement('body'); doc.activeElement = doc.createElement('button'); doc.querySelector = selector => doc.body.querySelector(selector); return doc; }
function loadBoundary(file, overrides, env = {}) {
  const location = path.resolve(__dirname, '..', file), requireFile = createRequire(location), module = { exports: {} };
  const localRequire = name => { if (Object.hasOwn(overrides, name)) return overrides[name]; if (name === 'pg') throw new Error('Real database forbidden'); return requireFile(name); };
  vm.runInNewContext(fs.readFileSync(location, 'utf8'), { module, exports: module.exports, require: localRequire, Buffer, URL, process: { env }, fetch: globalThis.fetch, console: { error() {} } }, { filename: file });
  return module.exports;
}
async function checkLogoBoundary() {
  const trace = [], objects = new Map(); let role = 'owner', failure = false, savedRow = { id: B, workspace_id: W, logo_object_path: null, logo_source: null, logo_revision: 0 };
  const client = { release() {}, async query(sql, args = []) {
    trace.push(sql);
    if (sql.includes('SELECT b.id')) return { rows: [{ ...savedRow, role }] };
    if (sql.includes('SELECT 1 FROM workspace_memberships')) return { rowCount: 1, rows: [{}] };
    if (sql.includes('UPDATE brands SET logo_object_path=$2')) { savedRow = { ...savedRow, logo_object_path: args[1], logo_mime_type: args[2], logo_source: args[3], logo_revision: savedRow.logo_revision + 1 }; return { rowCount: 1 }; }
    if (sql.startsWith('SELECT id,')) return { rows: [savedRow] };
    return { rows: [] };
  } };
  const realLogo = require('../api/_brand-logo');
  const handler = loadBoundary('api/brands/[id]/logo.js', {
    '../../_auth-session': { getSessionUser: req => req.user }, '../../_brands-storage': { pool: { connect: async () => client } },
    '../../_brand-access': { isBrandId: id => id === B, getBrandAccess: async () => ({ brand: savedRow, access: { canReadBrand: role !== 'unrelated' } }) },
    '../../_brand-logo': { ...realLogo, discoverLogo: async () => ({ status: 'found', candidate: { url: candidate.candidate_url }, image: { buffer: png, mimeType: 'image/png' }, sourceHost: 'example.com' }) },
    '../../_brand-logo-storage': {
      upload: async ({ revision, buffer }) => { if (failure) throw new Error('storage unavailable'); const key = `${B}/${revision}.png`; objects.set(key, buffer); return key; },
      read: async key => objects.get(key), remove: async key => { objects.delete(key); }
    }
  });
  const invoke = async body => { const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; }, send(body) { this.body = body; } }; await handler({ method: 'POST', query: { id: B }, user: { email: 'fixture@example.com' }, body }, res); return res; };
  const input = { contract: 'brand_logo_v1', action: 'upload', expected_revision: 0, request_id: 'upload-1', workspace_id: W, mime_type: 'image/png', image_base64: png.toString('base64') };
  role = 'viewer'; assert.equal((await invoke(input)).code, 403); assert.equal(objects.size, 0);
  role = 'unrelated'; assert.equal((await invoke(input)).code, 403); assert.equal(objects.size, 0);
  role = 'editor'; failure = true; assert.equal((await invoke(input)).code, 500); assert.equal(objects.size, 0); assert.equal(savedRow.logo_revision, 0);
  failure = false; let result = await invoke(input); assert.equal(result.code, 200); assert.equal(objects.size, 1); assert.equal(result.body.logo.logo_revision, 1); assert(trace.includes('COMMIT'));
  assert.equal((await invoke(input)).code, 409); assert.equal(objects.size, 1);
  result = await invoke({ ...input, expected_revision: 1, action: 'discover', candidate_url: candidate.candidate_url, image_sha256: candidate.image_sha256 });
  assert.equal(result.body.error.code, 'UPLOADED_LOGO_PRESERVED'); assert.equal(objects.size, 1);
  savedRow = { ...savedRow, logo_source: 'discovered' };
  result = await invoke({ ...input, expected_revision: 1, action: 'discover', candidate_url: candidate.candidate_url, image_sha256: '0'.repeat(64) });
  assert.equal(result.body.error.code, 'CANDIDATE_CHANGED'); assert.equal(savedRow.logo_revision, 1);
  const policy = require('../api/_website-url-policy');
  for (const url of ['http://example.com', 'https://127.0.0.1', 'https://user:pass@example.com', 'https://example.com:444']) assert.throws(() => policy.validateWebsiteUrl(url));
}
async function checkAnalyzer() {
  let authority = true;
  const analyzer = loadBoundary('api/analyze-brand-domain.js', {
    './_auth-session': { getSessionUser: req => req.user },
    './_brand-access': { isBrandId: id => id === B, getBrandAccess: async () => ({ brand: authority ? { id: B } : null, access: { canEditCanonicalBrand: authority } }) }
  }, { OPENAI_API_KEY: 'fixture-key-never-sent' });
  authority = false;
  const denied = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await analyzer({ method: 'POST', user: { email: 'fixture@example.com' }, body: { brandId: B, domainUrl: 'example.com' } }, denied);
  assert.equal(denied.code, 403); authority = true;
  let providers = 0, discoveries = 0;
  const html = '<title>Brand</title><h1>A useful brand for a clear audience</h1><p>' + 'Evidence of products and benefits. '.repeat(30) + '</p><script type="application/ld+json">{"@type":"Organization","logo":"/logo.png"}</script>';
  const deps = { previewLogo: true, retrieveWebsiteText: async () => ({ source: { url: 'https://example.com/' }, internalHtml: html }),
    fetch: async () => { providers++; return response({ choices: [{ message: { content: JSON.stringify({ ...suggestions, contentGuidelines: [], brandAssets: {} }) } }] }); },
    discoverLogo: async (_url, injected) => { discoveries++; assert.equal((await injected.retrieveWebsiteText()).internalHtml, html); assert.equal(injected.logoOnly, true); return { status: 'found', candidate: { url: candidate.candidate_url }, image: { buffer: png, mimeType: 'image/png' } }; }
  };
  let result = await analyzer.analyzeBrandDomain('example.com', deps);
  assert.equal(providers, 1); assert.equal(discoveries, 1); assert.equal(result.logoDiscovery.image_sha256, candidate.image_sha256); assert.equal(result.suggestions.brandAssets.logo, '');
  result = await analyzer.analyzeBrandDomain('example.com', { ...deps, discoverLogo: async () => ({ status: 'not_found' }) }); assert.equal(result.logoDiscovery.status, 'not_found'); assert(result.suggestions.brandCore);
  const logo = require('../api/_brand-logo'); let requests = 0;
  result = await logo.discoverLogo('https://example.com', { logoOnly: true, retrieveWebsiteText: async () => ({ source: { url: 'https://example.com' }, internalHtml: '<link rel="icon" href="/icon.png"><meta property="og:image" content="/hero.png">' }), retrievePublicImage: async () => { requests++; return { buffer: png, mimeType: 'image/png' }; } });
  assert.equal(result.status, 'not_found'); assert.equal(requests, 0);
}
async function checkAuthoritativeCreation() {
  const db = { brands: [], boards: [], commands: [] };
  let tx = null;
  db.connect = async () => {
    tx = { brands: [], boards: [], commands: [] };
    return { release() {}, async query(sql, args = []) {
      if (sql === 'COMMIT') { for (const key of ['brands', 'boards', 'commands']) db[key].push(...tx[key]); return { rows: [] }; }
      if (sql === 'ROLLBACK' || sql === 'BEGIN' || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('FROM public.app_identities')) return { rows: [{ id: D, canonical_email: 'fixture@example.com', status: 'active', revision: 1 }] };
      if (sql.includes('FROM public.workspaces')) return { rows: [{ id: W, name: 'Workspace', status: 'active', revision: 1 }] };
      if (sql.includes('FROM public.workspace_memberships')) return { rows: [{ role: 'owner', status: 'accepted' }] };
      if (sql.includes('FROM public.project_commands')) return { rows: db.commands.filter(c => c.request_id === args[1]) };
      if (sql.includes('SELECT id FROM public.brands')) return { rows: db.brands.filter(b => b.id === args[0]) };
      if (sql.includes('INSERT INTO public.brands')) { const row = { ...clone(brand), name: args[2], workspace_id: args[0], brand_core: JSON.parse(args[3]) }; assert.equal(args[0], W); tx.brands.push(row); return { rows: [row] }; }
      if (sql.includes('INSERT INTO public.boards')) { const row = { id: D, name: args[2], workspace_id: args[0], brand_id: args[1], canvas_json: JSON.parse(args[3]), brand_core_snapshot: JSON.parse(args[4]), brand_core_source_revision: args[5], brand_core_source_updated_at: args[6], brand_core_snapshot_copied_at: now, created_at: now, updated_at: now }; assert.equal(args[0], W); assert.equal(args[1], B); tx.boards.push(row); return { rows: [row] }; }
      if (sql.includes('INSERT INTO public.project_commands')) { tx.commands.push({ request_id: args[1], fingerprint: args[2], outcome: JSON.parse(args[6]) }); return { rows: [] }; }
      throw new Error('Unexpected fixture query');
    } };
  };
  const access = { role: 'owner', ...Object.fromEntries(['canRead','canView','canEdit','canViewBoardBrandCore','canManageMembers','canManagePermissions','canRename','canDelete','canChangeBrandAssociation','canRefreshFromCanonical','canRestoreBrandCore','canCompareBrandCores','canViewPresence'].map(key => [key, true])), publicView: false };
  const service = loadBoundary('api/_project-command.js', {
    './_app-identity': { validateIdentityRow: () => ({ ok: true, identityId: D }), compareIdentityToSessionEmail: () => ({ ok: true }), APP_IDENTITY_ERRORS: {} },
    './_brand-access': { getBrandAccess: async id => ({ brand: db.brands.find(b => b.id === id), access: { role: 'owner', canCreateBrandBoards: true, canEditCanonicalBrand: true } }) },
    './_board-access': { getBoardAccess: async id => ({ board: [...db.boards, ...tx.boards].find(b => b.id === id), access }) },
    './_workspace-catalog': { projectBrandLogo: () => ({ logo_url: null, logo_revision: 0 }) }
  });
  const input = command.build(W, 'Project', { new_name: 'New Brand' }, 'create-r4');
  const run = () => service.execute({ db, user: { email: 'fixture@example.com' }, canonicalEmail: 'fixture@example.com', input });
  const outcome = await run(); command.validate(outcome, input); assert.equal(outcome.setup_required, true);
  assert.equal((await run()).created, false); assert.equal(db.brands.length, 1); assert.equal(db.boards.length, 1); assert.equal(db.commands.length, 1);
  assert.equal(db.boards[0].workspace_id, db.brands[0].workspace_id);
  const initial = { workspaces: [{ id: W, brands: [], boards: [] }] }, reconciled = command.reconcile(initial, [], outcome);
  assert.equal(reconciled.catalog.workspaces[0].brands[0].id, B); assert.equal(reconciled.library[0].brand_id, B);
  let posts = 0, opens = 0, release;
  const context = { account: {}, generation: 1, workspaceId: W };
  const boundary = command.createBoundary({ context: () => context, fetchImpl: () => { posts++; return new Promise(resolve => { release = resolve; }); }, reconcile() {}, navigate: value => { opens++; assert(value.setup_required); } });
  const pending = boundary.submit(input); assert.equal(boundary.submit(input), pending); release(response(outcome)); await pending; assert.equal(posts, 1); assert.equal(opens, 1);
}
async function checkDialogAndReturn() {
  const doc = documentFixture(), root = { FunklixLanguage: language, FunklixProjectCommand: command, FunklixBrandProfileSetup: profile };
  vm.runInNewContext(fs.readFileSync('brand-logo.js', 'utf8'), { globalThis: root });
  vm.runInNewContext(fs.readFileSync('project-dialog.js', 'utf8'), { globalThis: root });
  for (const brands of [[], [{ id: B, name: '😀 Über', role: 'owner', logo_url: null }, { id: D, name: 'Logo Brand', role: 'editor', logo_url: `/api/brands/${D}/logo?revision=1` }]]) {
    let posts = 0, release, metadata;
    const origin = doc.activeElement;
    const dialog = root.FunklixProjectDialog.mount({ document: doc, language: 'de', workspace: { id: W, name: 'Workspace', role: 'owner', brands }, requestId: () => 'project-1', submit: (_command, setup) => { posts++; metadata = setup; return new Promise(resolve => { release = resolve; }); } });
    const all = dialog.dialog.querySelectorAll('*'), form = all.find(n => n.tagName === 'form'), name = all.find(n => n.id === 'project-name'), radios = all.filter(n => n.attributes.role === 'radio');
    assert.equal(radios.length, brands.length + 1); assert(radios.at(-1).textContent.includes('Mit einer neuen Marke starten'));
    name.value = 'Project'; await form.emit('submit');
    if (brands.length) { await radios[0].click(); assert.equal(radios[0].getAttribute('aria-checked'), 'true'); await radios[0].emit('keydown', { key: 'ArrowRight' }); assert.equal(radios[1].getAttribute('aria-checked'), 'true'); assert(radios[0].querySelectorAll('span').some(n => n.textContent === '😀Ü')); dialog.reconcileBrand(B, { logo_url: `/api/brands/${B}/logo?revision=1`, logo_revision: 1 }); assert.equal(radios[0].querySelectorAll('img').length, 1); assert.equal(radios[1].getAttribute('aria-checked'), 'true'); }
    await radios.at(-1).click(); all.find(n => n.id === 'project-brand-name').value = 'Brand'; all.find(n => n.id === 'project-brand-website').value = 'example.com';
    const flight = form.emit('submit'); await form.emit('submit'); assert.equal(posts, 1); assert.equal(metadata.website, 'https://example.com/'); release(); await flight; assert.equal(doc.activeElement, origin);
  }
  const app = fs.readFileSync('app.js', 'utf8');
  const source = app.slice(app.indexOf('async function continueBrandProfileProject()'), app.indexOf('const BRAND_LOGO_MUTATIONS_ENABLED'));
  const account = {}, context = { account, generation: 1, outcome: { board: { id: D }, workspace: { id: W }, brand: { id: B } } };
  let opened = [], routes = [], fail = false;
  const fixture = { projectSetupContext: context, state: { user: account, workspaceCatalog: { generation: 1 }, currentBoardId: D, boardBrandAssociation: { brandId: B } }, brandProfileController: null, canonicalBrandDraftDirty: () => false, canonicalBrandDetail: { brandId: B }, el: { brandWorkspaceDetailStatus: {} }, uiText: key => key,
    loadBoardFromUrlIfPresent: async id => { opened.push(id); return !fail; }, closeCanonicalBrandDetail: () => true, history: { pushState: (_a, _b, route) => routes.push(route) }, document: { getElementById() { return null; } }, setAppMode() {}, setActiveView() {}, renderWorkspaceSidebar() {} };
  vm.createContext(fixture); vm.runInContext(source + '\nthis.run=continueBrandProfileProject;', fixture);
  await fixture.run(); assert.deepEqual(opened, [D]); assert.deepEqual(routes, [`/boards/${D}`]); assert.equal(fixture.projectSetupContext, null);
  fail = true; fixture.projectSetupContext = context; await fixture.run(); assert(fixture.el.brandWorkspaceDetailStatus.textContent.includes('no longer available')); assert.equal(routes.length, 1);
  fixture.state.user = {}; await fixture.run(); assert.equal(opened.length, 2); assert(fixture.el.brandWorkspaceDetailStatus.textContent.includes('context'));
  assert(!/POST|projectCommandBoundary|localStorage|sessionStorage/.test(source));
  const logoPatch = app.slice(app.indexOf('function patchCatalogBrandLogo('), app.indexOf('async function mutateBrandLogo('));
  let sidebar = 0, identities = 0, dialogUpdates = 0;
  const patch = { state: { workspaceCatalog: { value: { workspaces: [{ id: W, brands: [{ id: B, name: 'Brand', logo_url: null, logo_revision: 0 }] }] } }, brandCatalog: { entries: [{ id: B }] } },
    projectDialogController: { reconcileBrand(id) { assert.equal(id, B); dialogUpdates++; } }, renderWorkspaceSidebar() { sidebar++; }, renderBoardBrandAssociation() { identities++; } };
  vm.createContext(patch); vm.runInContext(logoPatch + `\npatchCatalogBrandLogo('${B}',{logo_url:'/api/brands/${B}/logo?revision=1',logo_revision:1,source:'uploaded',image_base64:'must-not-enter-catalog'});`, patch);
  const projected = patch.state.workspaceCatalog.value.workspaces[0].brands[0];
  assert.equal(projected.logo_revision, 1); assert.equal(projected.image_base64, undefined); assert.equal(projected.source, undefined); assert.equal(sidebar, 1); assert.equal(identities, 1); assert.equal(dialogUpdates, 1);
}
async function checkProfileUI() {
  const doc = documentFixture(), root = { FunklixLanguage: language };
  vm.runInNewContext(fs.readFileSync('brand-logo.js', 'utf8'), { globalThis: root });
  vm.runInNewContext(fs.readFileSync('brand-profile-setup.js', 'utf8'), { globalThis: root, URL });
  const host = doc.createElement('div'); doc.body.append(host);
  for (const viewer of [false, true]) {
    const fixture = makeSession({ brand: { ...clone(brand), access: { role: viewer ? 'viewer' : 'owner', canEditCanonicalBrand: !viewer } } });
    const mounted = root.FunklixBrandProfileSetup.mount(host, { ...fixture.options, language: () => 'de', hasProject: () => true, onContinue() {}, onAdvanced() {}, moduleDefinition: registry.getModuleDefinition, createTile: type => ({ id: 'module-fixture', title: type, content: '', moduleType: type }) });
    assert(host.textContent.includes('Markengrundlagen')); assert(host.textContent.includes('Fundament')); assert(!host.textContent.includes('Canonical')); assert(!host.textContent.includes('$.')); assert(!host.textContent.includes('"preserve"'));
    const buttons = host.querySelectorAll('button').map(n => n.textContent);
    assert.equal(buttons.includes('Logo hochladen'), !viewer); assert.equal(buttons.includes('Website analysieren'), !viewer); assert.equal(buttons.includes('Markenprofil bestätigen und speichern'), !viewer);
    if (viewer) { assert.equal(host.querySelectorAll('input').some(n => n.type === 'file'), false); assert(host.querySelectorAll('input').every(n => n.disabled)); }
    else {
      const nameInput = host.querySelectorAll('[data-profile-key]').find(n => n.dataset.profileKey === 'Brand name'); nameInput.focus(); mounted.render(); assert.equal(doc.activeElement.dataset.profileKey, 'Brand name');
      const mark = host.querySelector('.profile-logo'); assert.equal(mark.textContent, '😀Ü');
      mounted.state.brand.logo_url = `/api/brands/${B}/logo?revision=1`; mounted.render(); const image = host.querySelector('.profile-logo').querySelector('img'); await image.emit('error'); assert.equal(host.querySelector('.profile-logo').textContent, '😀Ü');
    }
    mounted.invalidate();
  }
  const css = fs.readFileSync('brand-profile-setup.css', 'utf8');
  for (const token of ['1024px', '768px', '480px', '375px', '320px', 'min-height:44px', ':focus-visible', 'var(--fk-color-surface-elevated)', 'flex-wrap:wrap', 'forced-colors:active', 'overflow:auto']) assert(css.includes(token), token);
  // Source/DOM assertions support the visual acceptance plan; they do not claim screenshots or zoom rendering.
  for (const key of [...profile.SECTIONS, 'Analyze website', 'Upload logo', 'Use this logo', 'Continue to project', 'Start with a new Brand']) assert.notEqual(language.t(key, 'de'), key, key);
  const app = fs.readFileSync('app.js', 'utf8'), start = app.indexOf("el.brandWorkspaceDetail?.addEventListener('keydown'");
  const handler = app.slice(start, app.indexOf('el.brandWorkspaceDetailRetry', start));
  const dialog = doc.createElement('dialog'); dialog.classList.add('profile-guided-mode');
  const first = doc.createElement('button'), last = doc.createElement('button'); dialog.append(first, last);
  vm.runInNewContext(handler, { el: { brandWorkspaceDetail: dialog }, document: doc });
  last.focus(); await dialog.emit('keydown', { key: 'Tab' }); assert.equal(doc.activeElement, first);
  await dialog.emit('keydown', { key: 'Tab', shiftKey: true }); assert.equal(doc.activeElement, last);
  const html = fs.readFileSync('index.html', 'utf8'); assert(html.indexOf('id="brand-workspace-detail"') < html.indexOf('id="left-sidebar"'), 'Profile remains outside the mobile-hidden sidebar');
}
(async () => {
  let fixture = makeSession({ website: 'example.com' });
  const flight = fixture.session.analyze(); assert.equal(fixture.session.analyze(), flight); await flight;
  assert.equal(fixture.calls.length, 1); assert.equal(fixture.saves.length, 0); assert.equal(fixture.logos.length, 0); assert.equal(fixture.session.state.core.brandCore, 'Positioning'); assert(profile.validCandidate(fixture.session.state.candidate)); assert.equal(fixture.session.state.core.unknown.preserve, true); assert.equal(fixture.session.state.core.brandAssets, undefined);
  await fixture.session.save(); assert.equal(fixture.saves.length, 1); assert.equal(fixture.calls[1].body.brand_core.brandAssets.domain, 'https://example.com/'); assert.equal(fixture.saves[0].brand_core.unknown.preserve, true);
  await fixture.session.useLogo(); assert.equal(fixture.logos.length, 1); assert.equal(fixture.calls.at(-1).body.action, 'discover'); assert.equal(fixture.calls.at(-1).body.image_sha256, candidate.image_sha256);
  fixture = makeSession({ brand: { ...clone(brand), brand_core: { ...brand.brand_core, brandCore: 'Confirmed' } }, website: 'example.com' });
  await fixture.session.analyze(); assert.equal(fixture.session.state.core.brandCore, 'Confirmed'); assert.equal(fixture.session.state.proposals.brandCore, 'Positioning'); assert.equal(fixture.saves.length, 0); fixture.session.applyProposal('brandCore'); assert.equal(fixture.session.state.core.brandCore, 'Positioning'); assert.equal(fixture.saves.length, 0);
  fixture = makeSession({ website: 'example.com', fetchImpl: async () => response({ suggestions, logoDiscovery: { status: 'not_found' } }) });
  await fixture.session.analyze(); assert.equal(fixture.session.state.candidate, null); assert(fixture.session.state.logo.includes('Upload'));
  const file = { type: 'image/png', size: png.length, name: 'fixture.png' };
  fixture = makeSession(); assert.equal(await fixture.session.chooseFile({ ...file, type: 'image/svg+xml' }, async () => ''), false);
  await fixture.session.chooseFile(file, async () => png.toString('base64')); assert.equal(fixture.calls.length, 0); await fixture.session.upload(); assert.equal(fixture.logos.length, 1); assert.equal(fixture.session.state.file, null); assert.equal(fixture.session.state.logo, 'Logo saved');
  let failUpload = true;
  fixture = makeSession({ fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); return failUpload ? response({ error: { code: 'UPDATE_FAILED' } }, 500) : response({ contract: 'brand_logo_v1', request_id: body.request_id, logo: { logo_url: `/api/brands/${B}/logo?revision=1`, logo_revision: 1, source: 'uploaded' } }); } });
  await fixture.session.chooseFile(file, async () => png.toString('base64')); assert.equal(await fixture.session.upload(), false); assert.equal(fixture.session.state.file, file); assert.equal(fixture.session.state.brand.id, B); assert.equal(fixture.logos.length, 0); failUpload = false; assert.equal(await fixture.session.upload(), true);
  for (const change of [{ account: {} }, { generation: 2 }, { authorized: false }]) {
    let release; fixture = makeSession({ website: 'example.com', fetchImpl: () => new Promise(resolve => { release = resolve; }) }); const pending = fixture.session.analyze(); fixture.change(change); fixture.session.invalidate(); release(response({ suggestions, logoDiscovery: candidate })); await pending; assert.equal(fixture.session.state.candidate, null); assert.equal(fixture.session.state.fileData, null); assert.equal(fixture.session.state.website, ''); assert.equal(fixture.saves.length, 0);
  }
  fixture = makeSession({ fetchImpl: async () => response({}, 409) }); fixture.session.state.name = 'Draft'; await fixture.session.save(); assert.equal(fixture.session.state.name, 'Draft'); assert(fixture.session.state.message.includes('changed elsewhere'));
  fixture = makeSession({ fetchImpl: async () => response({}, 403) }); await fixture.session.save(); assert.equal(fixture.session.state.readOnly, true); assert(fixture.session.state.message.includes('permission'));
  fixture = makeSession({ website: 'example.com', fetchImpl: async () => { throw new Error('offline'); } }); await fixture.session.analyze(); assert.equal(fixture.session.state.analysis, 'Analysis failed'); assert.equal(fixture.session.state.website, 'example.com');
  fixture = makeSession({ website: 'example.com', fetchImpl: async () => response({ suggestions: {}, logoDiscovery: {} }) }); await fixture.session.analyze(); assert.equal(fixture.session.state.analysis, 'No usable information found');
  fixture = makeSession({ brand: { ...clone(brand), access: { role: 'viewer', canEditCanonicalBrand: false } }, website: 'example.com' });
  await fixture.session.analyze(); await fixture.session.save(); await fixture.session.chooseFile(file, async () => png.toString('base64')); await fixture.session.upload(); assert.equal(fixture.calls.length, 0); assert.equal(fixture.session.state.fileData, null);
  await checkAuthoritativeCreation(); await checkLogoBoundary(); await checkAnalyzer(); await checkDialogAndReturn(); await checkProfileUI();
  assert(!/localStorage|sessionStorage|supabase|console\./i.test(fs.readFileSync('brand-profile-setup.js', 'utf8')));
  console.log('BW-36.13R4 passed: guided draft/review, single-flight analysis, explicit confirmed logo storage boundary, upload recovery, viewer/authority, account isolation, keyboard dialog, original Board return, localization and responsive source/DOM checks. Zero real network/provider/AI/storage/database calls. Visual browser acceptance remains pending.');
})().catch(error => { console.error(error); process.exitCode = 1; });
