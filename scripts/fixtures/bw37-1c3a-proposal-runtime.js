'use strict';
// Fictional projection-aware SQL transport. Real signed sessions, route, scope,
// Board and Brand ACL helpers; only persistence transport and provider are mocked.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const BOARD = '11111111-1111-4111-8111-111111111111', BRAND = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '33333333-3333-4333-8333-333333333333', IDENTITY = '44444444-4444-4444-8444-444444444444';
function fixture() {
  const r = { board: { id: BOARD, owner_id: 'owner-id', owner_email: 'owner@example.test', workspace_id: WORKSPACE, brand_id: BRAND, updated_at: '2026-10-27T10:00:00.000Z' },
    user: { id: 'owner-id', email: 'owner@example.test' }, role: null, brandRole: null,
    identity: { id: IDENTITY, canonical_email: 'owner@example.test', status: 'active', revision: '1' },
    workspace: { id: WORKSPACE, status: 'active', revision: '1' }, membership: { role: 'member', status: 'accepted' },
    association: { id: BRAND, workspace_id: WORKSPACE }, queries: [], calls: [], capture: 0, fault: null, before: null };
  const rows = values => ({ rows: values, rowCount: values.length });
  async function query(sql, args) {
    sql = sql.replace(/\s+/g, ' ').trim(); r.queries.push(sql);
    assert.match(sql, /^(SELECT |BEGIN|SET LOCAL|COMMIT|ROLLBACK)/, 'conversion must be read-only');
    assert(!/brand_core|brand_learnings|canvas_json/.test(sql), 'no hidden knowledge retrieval');
    if (sql.startsWith('BEGIN')) { r.capture++; await r.before?.(r.capture); return rows([]); }
    if (/^(SET LOCAL|COMMIT|ROLLBACK)/.test(sql)) return rows([]);
    if (sql.includes('FROM public.app_identities')) return rows(r.identity ? [r.identity] : []);
    if (sql.includes('FROM boards WHERE')) {
      if (!r.board) return rows([]);
      const columns = sql.match(/^SELECT (.+) FROM boards WHERE/)[1].split(',').map(k => k.trim());
      const board = Object.fromEntries(columns.map(k => { assert(Object.hasOwn(r.board, k), 'unknown projected column '+k); return [k, r.board[k]]; }));
      r.fault?.(board); return rows([board]);
    }
    if (sql.includes('FROM board_editors')) return rows(r.role ? [{role:r.role}] : []);
    if (sql.includes('FROM brands b')) return rows(r.brandRole ? [{role:r.brandRole}] : []);
    if (sql.includes('FROM public.workspaces')) return rows(r.workspace ? [r.workspace] : []);
    if (sql.includes('FROM public.workspace_memberships')) return rows(r.membership ? [r.membership] : []);
    if (sql.includes('FROM public.brands')) return rows(r.association ? [r.association] : []);
    throw new Error('Unexpected SQL');
  }
  const pool = { query, connect: async () => ({ query, release() {} }) }, cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative), m = new Module(filename, module); cache.set(relative, m);
    const original = Module.createRequire(filename);
    m.require = name => {
      if (!name.startsWith('.')) return original(name);
      const target = path.relative(ROOT, original.resolve(name));
      if (target === 'api/_boards-storage.js') return {pool};
      if (target === 'api/_brands-storage.js') return {pool, ensureBrandsTable:async()=>{}};
      return load(target);
    };
    m._compile(fs.readFileSync(filename,'utf8'), filename); return m.exports;
  }
  r.handler = load('api/ai-brain/propose-node.js');
  r.scopeHandler = load('api/ai-brain/content-scope.js');
  r.auth = load('api/_auth-session.js');
  r.access = load('api/_board-access.js');
  r.request = { action:'propose_content_node', board_id:BOARD, source_turn_id:'turn-1', source_answer:'Content idea: Fictional useful copy for a local test.',
    selected_node_id:null, canvas_context:{nodes:[],edges:[]}, response_language:'en',content_language:'en',
    expected_scope:{updated_at:r.board.updated_at,brand_id:BRAND,workspace_id:WORKSPACE} };
  r.invoke = async (body=r.request, method='POST', handler=r.handler) => {
    const cookie = r.user ? 'funklix_session='+r.auth.createSessionToken(r.user) : '';
    const res = {statusCode:0,body:null,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};
    r.pendingRequest = {method,body,headers:{cookie}};
    await handler(r.pendingRequest,res); return res;
  };
  return r;
}
module.exports = {fixture, BOARD, BRAND, WORKSPACE, IDENTITY};
