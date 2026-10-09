'use strict';
// External I/O only: all auth, access, handlers, serializers, core and contracts are production code.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const W = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', D = '33333333-3333-4333-8333-333333333333', I = '44444444-4444-4444-8444-444444444444';
const EMAIL = 'local-fixture@example.test', now = '2026-10-08T08:00:00.000Z';
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
// Image safety checks require >=16 px. This local PNG has a real 32x32 IHDR.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAM0lEQVR4nO3OMQEAMAjEwKdzFVYxrooMlouBXN3XP4udzTkAAAAAAAAAAAAAAAAAAECSDCTXAm0ec9xNAAAAAElFTkSuQmCC', 'base64');
function runtime() {
  const db = { brands: [], boards: [], commands: [], workspaceRole: 'owner', brandRole: null, membershipStatus: 'accepted', identityStatus: 'active', failPut: false, failConnect: false, queries: [] };
  const objects = new Map(), logs = [], requests = [], storageRequests = [];
  let tx = null, missingSecret = false;
  const rows = values => ({ rows: clone(values), rowCount: values.length });
  const state = () => tx || db;
  async function query(sql, args = []) {
    sql = sql.replace(/\s+/g, ' ').trim(); db.queries.push(sql);
    const used = new Set([...sql.matchAll(/\$(\d+)/g)].map(m => +m[1]));
    for (let i = 1; i <= args.length; i++) if (!used.has(i)) { const error = new Error('untyped SQL parameter'); error.code = '42P18'; throw error; }
    if (sql === 'BEGIN') { assert.equal(tx, null, 'No overlapping fixture transaction'); tx = clone({ brands: db.brands, boards: db.boards, commands: db.commands }); return rows([]); }
    if (sql === 'COMMIT') { if (tx) Object.assign(db, tx); tx = null; return rows([]); }
    if (sql === 'ROLLBACK') { tx = null; return rows([]); }
    if (sql.includes('pg_advisory_xact_lock')) return rows([]);
    if (sql.includes('FROM public.app_identities')) return rows([{ id: I, canonical_email: EMAIL, status: db.identityStatus, revision: 1 }]);
    if (sql.includes('FROM public.workspaces')) return rows(args[0] === W ? [{ id: W, name: 'Local Workspace', status: 'active', revision: 1 }] : []);
    if (sql.includes('FROM public.workspace_memberships')) return rows([{ role: db.workspaceRole, status: db.membershipStatus }]);
    if (sql.includes('SELECT 1 FROM workspace_memberships')) return rows(db.membershipStatus === 'accepted' ? [{}] : []);
    if (sql.includes('FROM public.project_commands')) return rows(state().commands.filter(c => c.request_id === args[1]));
    if (sql.includes('INSERT INTO public.project_commands')) { state().commands.push({ request_id: args[1], fingerprint: args[2], outcome: JSON.parse(args[6]) }); return rows([]); }
    if (/INSERT INTO public\.brands/.test(sql)) {
      const explicit = /\(id,workspace_id/.test(sql);
      const brand = { id: explicit ? args[0] : randomUUID(), workspace_id: explicit ? args[1] : args[0], owner_email: explicit ? args[2] : args[1], name: explicit ? args[3] : args[2], brand_core: JSON.parse(explicit ? args[4] : args[3]), revision: 1, logo_revision: 0, created_at: now, updated_at: now };
      state().brands.push(brand); return rows([brand]);
    }
    if (/INSERT INTO public\.boards/.test(sql)) {
      const board = { id: randomUUID(), workspace_id: args[0], brand_id: args[1], name: args[2], canvas_json: JSON.parse(args[3]), brand_core_snapshot: JSON.parse(args[4]), brand_core_source_revision: args[5], brand_core_source_updated_at: args[6], brand_core_snapshot_copied_at: now, owner_email: args[7], owner_id: args[7], created_at: now, updated_at: now };
      state().boards.push(board); const { owner_email, owner_id, ...returned } = board; return rows([returned]);
    }
    if (/UPDATE brands SET name/.test(sql)) {
      if (db.failPut) { const e = new Error('private SQL/provider failure MUST NOT LEAK'); e.code = 'ECONNREFUSED'; throw e; }
      const brand = state().brands.find(b => b.id === args[0] && b.revision === args[3]);
      if (!brand) return rows([]);
      Object.assign(brand, { name: args[1], brand_core: JSON.parse(args[2]), revision: brand.revision + 1, updated_at: now }); return rows([brand]);
    }
    if (/UPDATE brands SET logo_object_path/.test(sql)) {
      if (db.failLogoMetadata) throw new Error('local metadata write failure');
      const brand = state().brands.find(b => b.id === args[0]);
      Object.assign(brand, { logo_object_path: args[1] || null, logo_mime_type: args[2] || null, logo_source: args[3] || null, logo_source_host: args[4] || null, logo_updated_at: now, logo_revision: brand.logo_revision + 1 }); return rows([brand]);
    }
    if (sql.includes('SELECT COUNT(*)::integer AS count FROM boards')) return rows([{count: state().boards.filter(b => b.brand_id === args[0]).length}]);
    if (/UPDATE boards SET brand_id = NULL/.test(sql)) { const affected = state().boards.filter(b => b.brand_id === args[0]); affected.forEach(b => { b.brand_id = null; }); return rows(affected); }
    if (sql.includes('FROM brand_documents WHERE board_id')) return rows([]);
    if (/DELETE FROM boards WHERE id/.test(sql)) { const affected=state().boards.filter(b=>b.id===args[0]);state().boards=state().boards.filter(b=>b.id!==args[0]);return rows(affected); }
    if (/DELETE FROM brand_members/.test(sql)) return rows([]);
    if (/DELETE FROM brands/.test(sql)) { const affected = state().brands.filter(b => b.id === args[0] && b.owner_email === args[1]); state().brands = state().brands.filter(b => !affected.includes(b)); return rows(affected); }
    if (/FROM board_editors/.test(sql)) return rows([]);
    if (/FROM boards WHERE id/.test(sql)) return rows(state().boards.filter(b => b.id === args[0]));
    if (/FROM (?:public\.)?brands(?: b)? WHERE/.test(sql) || /FROM brands b LEFT JOIN brand_members/.test(sql)) {
      const found = state().brands.find(b => b.id === args[0]);
      if (!found) return rows([]);
      if (sql.includes('owner_email = $2 FOR UPDATE') && found.owner_email !== args[1]) return rows([]);
      const role = found.owner_email === (args[1] || EMAIL) ? 'owner' : db.brandRole;
      if (sql.includes('AND (b.owner_email') && !['owner','admin','editor','viewer'].includes(role)) return rows([]);
      return rows([{ ...found, role, brand_access_role: role }]);
    }
    if (/FROM brand_members/.test(sql)) return rows([]);
    throw new Error(`Unimplemented local query: ${sql}`);
  }
  const pool = { query, connect: async () => { if (db.failConnect) throw new Error('private connection details'); return { query, release() {} }; } };
  const env = { AUTH_SECRET: 'fictional-local-session-secret', POSTGRES_URL: 'postgres://unused@db.fixture.supabase.co/local', OPENAI_API_KEY: 'fictional-provider-token', SUPABASE_SERVICE_ROLE_KEY: 'fictional-storage-token', NODE_ENV: 'production' };
  const suggestions = { brandCore: 'Local website positioning', valueProposition: 'Local website benefit', toneOfVoice: ['Clear'], messagingPillars: ['Reliable'], personas: [{ name: 'Local audience', note: 'Local needs' }], contentGuidelines: ['Concise'], dosAndDonts: { dos: ['Be clear'], donts: [] }, brandVoiceExamples: { good: 'Clear copy', avoid: '' }, keywords: ['local'], brandAssets: { domain: 'https://example.test/', logo: '', colors: ['#123456'], typography: 'Sans', references: [] } };
  const website = { source: { url: 'https://example.test/' }, internalHtml: '<html><head><title>Local Brand</title><link rel="logo" href="/logo.png"></head><body><header><img class="logo" src="/logo.png"></header><h1>Reliable local Brand</h1><p>' + 'Useful local brand information. '.repeat(20) + '</p></body></html>' };
  async function externalFetch(url, init) {
    if (url === 'https://api.openai.com/v1/images/generations') return { ok: true, json: async () => ({ data: [{ b64_json: png.toString('base64') }] }) };
    if (url === 'https://api.openai.com/v1/responses') return { ok: true, json: async () => ({ output_text: JSON.stringify({primaryArchetype:'Sage',secondaryArchetype:'Creator',primaryConfidence:90,secondaryConfidence:80,reasoning:'Local reasoning',signals:{toneSignals:['Clear']},recommendedVoice:'Clear',recommendedVisualDirection:'Blue'}) }) };
    if (url === 'https://api.openai.com/v1/chat/completions') return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(suggestions) } }] }) };
    assert(url.startsWith('https://fixture.supabase.co/storage/v1/object/brand-logos'), 'Only the local storage adapter may be reached');
    storageRequests.push(init.method);
    const key = url.split('/brand-logos/')[1];
    if (init.method === 'POST') { objects.set(key, Buffer.from(init.body)); return { ok: true }; }
    if (init.method === 'DELETE') { objects.delete(key); return { ok: true }; }
    const image = objects.get(key); return { ok: !!image, headers: { get: () => String(image?.length || 0) }, arrayBuffer: async () => image };
  }
  const modules = new Map();
  function load(file) {
    const location = path.resolve(ROOT, file);
    if (modules.has(location)) return modules.get(location).exports;
    const module = { exports: {} }; modules.set(location, module);
    const localRequire = createRequire(location);
    function req(name) {
      if (name === 'pg') throw new Error('Real database forbidden');
      if (!name.startsWith('.')) return localRequire(name);
      const resolved = localRequire.resolve(name), relative = path.relative(ROOT, resolved);
      if (relative === 'api/_boards-storage.js') return { pool, ensureBoardsTable: async () => {}, reconcileBrandRelationship: async () => {} };
      if (relative === 'api/_image-storage.js') return { uploadGeneratedImage: async () => ({imageUrl:'https://example.test/generated-avatar.png'}) };
      if (relative === 'api/_document-records.js') return { pool, ensureDocumentTables: async () => {} };
      if (relative === 'api/_document-storage.js') return { deletePrivate: async () => { throw new Error('Document operations forbidden'); } };
      if (relative === 'api/_website-retrieval.js') { const real = localRequire(name); return { ...real, retrieveWebsiteText: async () => clone(website) }; }
      if (relative === 'api/_website-image-retrieval.js') { const real = localRequire(name); return { ...real, retrievePublicImage: async () => ({ buffer: png, mimeType: 'image/png', url: 'https://example.test/logo.png' }) }; }
      const result = load(relative);
      if (relative === 'api/_brands-storage.js') return { ...result, ensureBrandsTable: async () => {} };
      return result;
    }
    vm.runInNewContext(fs.readFileSync(location, 'utf8'), { module, exports: module.exports, require: req, process: { env }, Buffer, URL, AbortSignal, setTimeout, clearTimeout, fetch: externalFetch, console: { error: (...v) => logs.push(v), debug: (...v) => logs.push(v), log() {} } }, { filename: relativeName(location) });
    return module.exports;
  }
  function relativeName(location) { return path.relative(ROOT, location); }
  const auth = load('api/_auth-session.js');
  const handlers = { dna: load('api/discover-brand-dna.js'), avatar: load('api/generate-brand-avatar.js'), collection: load('api/brands/index.js'), item: load('api/brands/[id].js'), logo: load('api/brands/[id]/logo.js'), analyze: load('api/analyze-brand-domain.js'), project: load('api/projects.js'), board: load('api/boards/[id].js') };
  function seed() {
    const core = load('api/_project-command.js').core();
    db.brands = [{ id: B, workspace_id: W, owner_email: EMAIL, name: 'Local Brand', brand_core: { ...core, brandCore: 'Original positioning' }, revision: 1, logo_revision: 0, created_at: now, updated_at: now }];
    db.boards = [{ id: D, workspace_id: W, brand_id: B, name: 'Original Project', canvas_json: require('../../project-command').blankCanvas(now), brand_core_snapshot: { ...core, brandCore: 'Stable campaign snapshot' }, brand_core_source_revision: 1, brand_core_source_updated_at: now, brand_core_snapshot_copied_at: now, owner_email: EMAIL, owner_id: EMAIL, created_at: now, updated_at: now }];
  }
  seed();
  async function request(method, url, body, user = { email: EMAIL }) {
    const route = new URL(url, 'http://localhost'), id = route.pathname.split('/')[3];
    const kind = route.pathname === '/api/discover-brand-dna' ? 'dna' : route.pathname === '/api/generate-brand-avatar' ? 'avatar' : route.pathname === '/api/brands' ? 'collection' : route.pathname === '/api/projects' ? 'project' : route.pathname === '/api/analyze-brand-domain' ? 'analyze' : route.pathname.startsWith('/api/boards/') ? 'board' : route.pathname.endsWith('/logo') ? 'logo' : 'item';
    const req = { method, query: { id, ...Object.fromEntries(route.searchParams) }, body, headers: { cookie: user ? `funklix_session=${auth.createSessionToken(user)}` : '' } };
    const res = { statusCode: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.statusCode=code;return this; }, json(value) { this.body=clone(value);return this; }, send(value) { this.body=value;return this; } };
    requests.push({ method, path: route.pathname, body: clone(body) });
    if (missingSecret) delete env.SUPABASE_SERVICE_ROLE_KEY; else env.SUPABASE_SERVICE_ROLE_KEY = 'fictional-storage-token';
    await handlers[kind](req,res); return res;
  }
  function catalog() { return { contract: 'workspace_catalog_v1', workspaces: [{ id: W, name: 'Local Workspace', role: db.workspaceRole, revision: 1, brands: db.brands.map(b => ({ id: b.id, workspace_id: W, name: b.name, revision: b.revision, role: b.owner_email === EMAIL ? 'owner' : db.brandRole, logo_url: b.logo_object_path ? `/api/brands/${b.id}/logo?revision=${b.logo_revision}` : null, logo_revision: b.logo_revision })), boards: db.boards.map(b => ({ id: b.id, workspace_id: W, brand_id: b.brand_id, name: b.name, role: 'owner' })) }] }; }
  return { db, request, load, catalog, objects, logs, requests, storageRequests, png, seed, suggestions, setMissingSecret(value) { missingSecret = value; }, env };
}
module.exports = { runtime, W, B, D, I, EMAIL, now, png, clone };
