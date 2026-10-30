'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const { PGlite } = require('@electric-sql/pglite');
const ROOT = path.resolve(__dirname, '../..');
const BOARD = '11111111-1111-4111-8111-111111111111', BRAND = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333', IDENTITY = '44444444-4444-4444-8444-444444444444';
const OWNER = 'owner@example.invalid', ACTOR = 'actor@example.invalid';
async function fixture({ goals = false, signedSession = false } = {}) {
  const pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE app_identities(id uuid PRIMARY KEY, canonical_email text, status text, revision bigint);
    CREATE TABLE workspaces(id uuid PRIMARY KEY, status text);
    CREATE TABLE workspace_memberships(workspace_id uuid, identity_id uuid, status text, role text);
    CREATE TABLE brands(id uuid PRIMARY KEY, owner_email text, name text, revision bigint, brand_core jsonb, updated_at timestamptz);
    CREATE TABLE brand_members(brand_id uuid REFERENCES brands(id) ON DELETE CASCADE, email text, role text, name text, UNIQUE(brand_id,email));
    CREATE TABLE boards(id uuid PRIMARY KEY, name text, owner_id text, owner_email text, brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
      brand_core_snapshot jsonb, brand_core_source_revision bigint, brand_core_source_updated_at timestamptz, updated_at timestamptz);
    CREATE TABLE board_editors(board_id uuid, email text, role text);`);
  await pg.exec(fs.readFileSync('scripts/fixtures/bw36-23a-r3-lock.sql','utf8'));
  for (const file of ['20261011_bw36_17_governed_brand_learnings.sql', '20261011_bw36_17r1_learning_provenance_schema.sql', '20261012_bw36_17r2_learning_provenance_recovery.sql']) {
    await pg.exec(fs.readFileSync(path.join(ROOT, 'migrations', file), 'utf8'));
  }
  const f = { pg, user: { email: ACTOR }, calls: [], queries: [], active: 0, released: 0, onProvider: null, onQuery: null,
    env: { OPENAI_API_KEY: 'mock-only' }, answer: 'Advice', BOARD, BRAND, OTHER, IDENTITY, OWNER, ACTOR };
  const query = async (sql, args) => {
    f.queries.push({ sql, args });
    if (f.onQuery) await f.onQuery(sql, args);
    if (/^BEGIN/.test(sql)) f.active++;
    try { const result = await pg.query(sql, args); return f.onRows ? f.onRows(sql, result) : result; }
    finally { if (/^(COMMIT|ROLLBACK)/.test(sql)) f.active--; }
  };
  const db = { query, connect: async () => ({ query, release() { f.released++; } }) };
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative), local = createRequire(filename), module = { exports: {} };
    cache.set(relative, module);
    const requireFixture = name => {
      if (!name.startsWith('.')) return local(name);
      const resolved = path.relative(ROOT, local.resolve(name));
      if (resolved === 'api/_auth-session.js' && !signedSession) return { getSessionUser: () => f.user };
      if (resolved === 'api/_boards-storage.js' || resolved === 'api/_brands-storage.js') return { pool: db, ensureBrandsTable() { throw new Error('Runtime DDL forbidden'); } };
      return load(resolved);
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: requireFixture,
      Buffer, Date, console, AbortController, setTimeout, clearTimeout, process: { env: f.env },
      fetch: async (url, options) => {
        assertProviderRequest(url, options);
        if (f.active) throw new Error('Locks held during inference');
        f.calls.push(JSON.parse(options.body));
        if (f.onProvider) await f.onProvider();
        if (f.transportResponse) return f.transportResponse;
        return { ok: true, json: async () => f.providerResponse || ({ output_text: f.answer }) };
      }
    }, { filename });
    return module.exports;
  }
  f.context = load('api/_ai-brain-learning-context.js');
  f.load = load;
  f.handler = load('api/ai-brain/advice.js');
  f.learning = load('api/_brand-learnings.js');
  f.db = db;
  f.reset = async () => {
    await pg.exec('DELETE FROM board_editors; DELETE FROM boards; DELETE FROM brands; DELETE FROM workspace_memberships; DELETE FROM workspaces; DELETE FROM app_identities');
    await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)', [IDENTITY, ACTOR, 'active']);
    for (const id of [BRAND, OTHER]) await pg.query('INSERT INTO brands(id,owner_email,name,revision,brand_core,updated_at) VALUES ($1,$2,$3,1,$4::jsonb,now())', [id, OWNER, 'Canonical brand', JSON.stringify({ positioning: 'Premium' })]);
    await pg.query('INSERT INTO boards(id,name,owner_id,owner_email,brand_id,brand_core_snapshot,brand_core_source_revision,brand_core_source_updated_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,1,now(),now())', [BOARD, 'Campaign', 'owner-id', OWNER, BRAND, JSON.stringify({ campaign: 'Introductory offer' })]);
    await pg.query('INSERT INTO board_editors VALUES ($1,$2,$3)', [BOARD, ACTOR, 'editor']);
    await pg.query('INSERT INTO brand_members(brand_id,email,role) VALUES ($1,$2,$3)', [BRAND, ACTOR, 'viewer']);
    f.user = { email: ACTOR }; f.onProvider = null; f.onQuery = null; f.onRows = null; f.calls.length = 0; f.queries.length = 0;
    for (const key of Object.keys(f.env)) if (key !== 'OPENAI_API_KEY') delete f.env[key];
    f.answer = 'Advice'; f.providerResponse = null; f.transportResponse = null;
  };
  f.insert = async ({ statement = 'Community engagement improves with a clear invitation.', status = 'approved', brand = BRAND, sourceBoard = null, sourceNode = null } = {}) => {
    const id = require('node:crypto').randomUUID();
    await pg.query(`INSERT INTO brand_learnings(id,brand_id,statement,statement_key,status,proposed_by_identity_id,reviewed_by_identity_id,reviewed_at,source_type,source_board_id,source_node_id)
      VALUES ($1,$2,$3,$4,'proposed',$5,NULL,NULL,$6,$7,$8)`, [id, brand, statement, f.learning.statementKey(statement), IDENTITY, sourceBoard ? 'campaign_observation' : 'manual', sourceBoard, sourceNode]);
    if (status !== 'proposed') {
      if (status === 'archived') await pg.query("UPDATE brand_learnings SET status='approved',revision=revision+1,reviewed_by_identity_id=$2,reviewed_at=now() WHERE id=$1", [id, IDENTITY]);
      if (status === 'archived') await pg.query("UPDATE brand_learnings SET status='archived',revision=revision+1 WHERE id=$1", [id]);
      else await pg.query('UPDATE brand_learnings SET status=$2,revision=revision+1,reviewed_by_identity_id=$3,reviewed_at=now() WHERE id=$1', [id, status, IDENTITY]);
    }
    return id;
  };
  f.invoke = async (overrides = {}) => {
    const response = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    const headers = signedSession && f.user ? { cookie: 'funklix_session=' + load('api/_auth-session.js').createSessionToken(f.user) } : {};
    await f.handler({ method: 'POST', headers, body: { board_id: BOARD, question: 'How could community engagement improve?', response_language: 'en', selected_node_id: null,
      canvas_context: { nodes: [{ id: 'idea', type: 'Idea', title: 'Community participation', audience: 'Members', channel: 'Forum' }], edges: [] }, ...overrides } }, response);
    return response;
  };
  await f.reset();
  if (goals) await pg.exec(`ALTER TABLE boards ADD COLUMN canvas_json jsonb, ADD COLUMN workspace_id uuid;
    ALTER TABLE brands ADD COLUMN workspace_id uuid;
    ALTER TABLE workspaces ADD COLUMN revision bigint DEFAULT 1;`);
  return f;
}
module.exports = { fixture };

function assertProviderRequest(url, options) {
  const assert = require('node:assert/strict');
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal(JSON.parse(options.body).store, false, 'Every Advice request must disable provider storage');
}
