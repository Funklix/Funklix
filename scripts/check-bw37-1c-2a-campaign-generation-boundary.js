#!/usr/bin/env node
'use strict';

// Actual signed sessions, handlers, SQL, identity validation and Board/Brand ACLs.
// Only database/provider transports are substituted; no production or paid I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const { PGlite } = require('@electric-sql/pglite');
const { createHash, randomUUID, createHmac } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const BOARD = '11111111-1111-4111-8111-111111111111', BRAND = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333', IDENTITY = '44444444-4444-4444-8444-444444444444';
const WORKSPACE = '55555555-5555-4555-8555-555555555555', FOREIGN = '66666666-6666-4666-8666-666666666666';
const OWNER = 'owner@example.invalid', ACTOR = 'editor@example.invalid';
const clone = value => JSON.parse(JSON.stringify(value));

async function database() {
  if (!process.env.BW37_GENERATION_TEST_URL) return new PGlite();
  const url = new URL(process.env.BW37_GENERATION_TEST_URL);
  assert.equal(process.env.BW37_GENERATION_DISPOSABLE, '1', 'Explicit disposable database opt-in required');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Local disposable fixture only');
  assert.equal(url.username, 'bw23_fixture_admin', 'Use the isolated fixture operator');
  const { Client } = require('pg'), admin = new Client({ connectionString: url.toString(), ssl: false });
  const name = `bw37_generation_${randomUUID().replaceAll('-', '')}`;
  await admin.connect();
  let client;
  try {
    await admin.query(`CREATE DATABASE ${name}`);
    url.pathname = `/${name}`;
    client = new Client({ connectionString: url.toString(), ssl: false }); await client.connect();
    const version = (await client.query('SHOW server_version')).rows[0].server_version;
    console.log(`Disposable PostgreSQL ${version}: campaign boundary SQL`);
    return { query: (sql, args) => client.query(sql, args), exec: sql => client.query(sql),
      async close() { try { await client.end(); await admin.query(`DROP DATABASE ${name}`); } finally { await admin.end(); } } };
  } catch (error) {
    try { await client?.end(); await admin.query(`DROP DATABASE IF EXISTS ${name}`); } finally { await admin.end(); }
    throw error;
  }
}

async function fixture() {
  const pg = await database();
  await pg.exec(`
    CREATE TABLE app_identities(id uuid PRIMARY KEY,canonical_email text,status text,revision bigint);
    CREATE TABLE workspaces(id uuid PRIMARY KEY,status text);
    CREATE TABLE workspace_memberships(workspace_id uuid,identity_id uuid,role text,status text);
    CREATE TABLE brands(id uuid PRIMARY KEY,workspace_id uuid,owner_email text,brand_core jsonb,revision bigint,updated_at timestamptz);
    CREATE TABLE brand_members(brand_id uuid,email text,role text);
    CREATE TABLE boards(id uuid PRIMARY KEY,owner_id text,owner_email text,workspace_id uuid,brand_id uuid,
      brand_core_snapshot jsonb,brand_core_source_revision bigint,brand_core_source_updated_at timestamptz,updated_at timestamptz);
    CREATE TABLE board_editors(board_id uuid,email text,role text);`);
  const f = { pg, calls: [], queries: [], transactions: 0, released: 0,
    env: { AUTH_SECRET: 'fictional-campaign-test-secret', OPENAI_API_KEY: 'mock-provider-only' } };
  const query = async (sql, args) => {
    f.queries.push(sql);
    assert.match(sql, /^(SELECT |BEGIN |SET LOCAL |COMMIT|ROLLBACK)/, 'Generation must not mutate domain data');
    if (f.beforeQuery) await f.beforeQuery(sql, args);
    const result = await pg.query(sql, args);
    result.rowCount = result.rows.length; // node-postgres SELECT transport contract
    if (/^BEGIN/.test(sql)) f.transactions++;
    if (/^(COMMIT|ROLLBACK)/.test(sql) && f.transactions > 0) f.transactions--;
    return f.rows ? f.rows(sql, result) : result;
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
      if (['api/_boards-storage.js', 'api/_brands-storage.js'].includes(resolved)) return { pool: db,
        ensureBrandsTable() { throw new Error('Runtime DDL forbidden'); } };
      return load(resolved);
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: requireFixture,
      Buffer, console, process: { env: f.env }, fetch: async (url, options) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(f.transactions, 0, 'No transaction held across provider inference');
        const body = JSON.parse(options.body); f.calls.push(body);
        assert.equal(body.model, 'gpt-4o-mini'); assert.equal(body.store, false);
        assert.equal(body.input.length, 2); assert.equal(body.text.format.type, 'json_schema');
        if (f.provider) return f.provider();
        return { ok: true, json: async () => ({ output_text: f.answer }) };
      } }, { filename });
    return module.exports;
  }
  const auth = load('api/_auth-session.js');
  const handlers = { generate: load('api/generate-campaign.js'), repair: load('api/refine-node.js') };
  load('api/_write-maintenance.js').guardPool(db);
  f.reset = async () => {
    delete f.env.TENDRA_WRITE_MAINTENANCE;
    f.beforeQuery = f.rows = f.provider = null; f.calls.length = f.queries.length = 0;
    f.answer = JSON.stringify({ nodes: [], edges: [] });
    await pg.exec('DELETE FROM board_editors; DELETE FROM boards; DELETE FROM brand_members; DELETE FROM brands; DELETE FROM workspace_memberships; DELETE FROM workspaces; DELETE FROM app_identities;');
    await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)', [IDENTITY, ACTOR, 'active']);
    await pg.query("INSERT INTO workspaces VALUES ($1,'active'),($2,'active')", [WORKSPACE, FOREIGN]);
    await pg.query("INSERT INTO workspace_memberships VALUES ($1,$2,'member','accepted')", [WORKSPACE, IDENTITY]);
    for (const [id, workspace, secret] of [[BRAND, WORKSPACE, 'HIDDEN_CANONICAL_X'], [OTHER, FOREIGN, 'HIDDEN_CANONICAL_Y']]) {
      await pg.query('INSERT INTO brands VALUES ($1,$2,$3,$4::jsonb,1,now())', [id, workspace, OWNER, JSON.stringify({ valueProposition: secret })]);
    }
    await pg.query('INSERT INTO boards VALUES ($1,$2,$3,$4,$5,$6::jsonb,1,now(),now())', [BOARD, 'owner-id', OWNER, WORKSPACE, BRAND, JSON.stringify({ valueProposition: 'AUTHORIZED_SAVED_SNAPSHOT' })]);
    await pg.query("INSERT INTO board_editors VALUES ($1,$2,'editor')", [BOARD, ACTOR]);
  };
  f.invoke = async (kind, body, { user = { email: ACTOR }, cookie, method = 'POST' } = {}) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, removeHeader(k) { delete this.headers[k]; },
      status(code) { this.statusCode = code; return this; }, json(body) { return this.end(JSON.stringify(body)); },
      end(body) { if (body) this.body = JSON.parse(body); return this; } };
    await handlers[kind]({ method, body, headers: { cookie: cookie ?? (user ? `funklix_session=${auth.createSessionToken(user)}` : '') } }, res);
    assert.equal(f.transactions, 0); assert.equal(res.headers['Cache-Control'], 'private, no-store');
    return res;
  };
  await f.reset(); return f;
}
const inputs = {
  generate: () => ({ boardId: BOARD, campaignIdea: 'Launch a fictional local service', additionalContext: 'A campaign for existing members', variationCount: 2, postsPerVariation: 3, campaignLanguage: 'en' }),
  repair: () => ({ boardId: BOARD, nodeType: 'Content', currentContent: { title: 'Fictional pillar', content: 'Draft pillar' }, instruction: 'Improve specificity', campaignContext: 'Fictional campaign brief' })
};

async function main() {
  const f = await fixture();
  try {
    for (const kind of Object.keys(inputs)) {
      const input = inputs[kind];
      await f.reset();
      for (const options of [{ user: null }, { cookie: 'funklix_session=forged.session' }, { user: { email: 'bad email' } }]) {
        assert.equal((await f.invoke(kind, input(), options)).statusCode, 401);
      }
      const expired = Buffer.from(JSON.stringify({ user: { email: ACTOR }, exp: 1 })).toString('base64url');
      const signature = createHmac('sha256', f.env.AUTH_SECRET).update(expired).digest('base64url');
      assert.equal((await f.invoke(kind, input(), { cookie: `funklix_session=${expired}.${signature}` })).statusCode, 401);
      assert.equal((await f.invoke(kind, input(), { method: 'GET' })).statusCode, 405);
      assert.equal(f.calls.length, 0);
      assert.equal((await f.invoke(kind, input())).statusCode, 200, `${kind}: Board-only editor`);
      let prompt = JSON.stringify(f.calls[0]);
      // Exact provider schemas captured from main 6c397e4c with this 2x3 setup.
      assert.equal(createHash('sha256').update(JSON.stringify(f.calls[0].text.format)).digest('hex'), kind === 'generate'
        ? 'fdd5b8a1e027a398abaa62c0e0b7294598c01b5ac9b95c819e15d937419d03cf'
        : '0deb33996365e55e575a27a187dc5445e0e62e20ba2473f25e14818249142945');
      assert.match(prompt, /AUTHORIZED_SAVED_SNAPSHOT/); assert.doesNotMatch(prompt, /HIDDEN_CANONICAL/);
      assert.match(prompt, /untrusted source data/);
      // Authorization is in the actual SQL predicate, before canonical values are returned.
      assert(f.queries.some(sql => /SELECT b.id.*b.brand_core/.test(sql) && /AND \(b.owner_email/.test(sql)));
      await f.pg.query("INSERT INTO brand_members VALUES ($1,$2,'viewer')", [BRAND, ACTOR]);
      f.calls.length = 0;
      assert.equal((await f.invoke(kind, { ...input(), brandBrainData: { valueProposition: 'TAMPERED_SIDEBAR_Y' } })).statusCode, 200);
      prompt = JSON.stringify(f.calls[0]);
      assert.match(prompt, /HIDDEN_CANONICAL_X/); assert.match(prompt, /AUTHORIZED_SAVED_SNAPSHOT/);
      assert.doesNotMatch(prompt, /TAMPERED_SIDEBAR_Y|HIDDEN_CANONICAL_Y/);
      await f.reset();
      await f.pg.exec('DELETE FROM board_editors');
      await f.pg.query("INSERT INTO brand_members VALUES ($1,$2,'editor')", [BRAND, ACTOR]);
      assert.equal((await f.invoke(kind, input())).statusCode, 200, 'Authorized Brand editor retains existing derived Board edit access');

      const denials = [
        ["DELETE FROM board_editors", 403],
        ["UPDATE board_editors SET role='viewer'", 403],
        ["UPDATE app_identities SET status='disabled'", 403],
        ["DELETE FROM app_identities", 403],
        ["INSERT INTO app_identities SELECT '77777777-7777-4777-8777-777777777777',canonical_email,status,revision FROM app_identities", 403],
        ["UPDATE workspace_memberships SET status='removed'", 403],
        ["UPDATE workspaces SET status='archived'", 403],
        [`UPDATE boards SET workspace_id='${FOREIGN}'`, 403],
        [`UPDATE brands SET workspace_id='${FOREIGN}' WHERE id='${BRAND}'`, 409],
        ["UPDATE boards SET brand_id=NULL", 409],
        ["UPDATE boards SET owner_id=NULL,owner_email=NULL", 403],
        ["DELETE FROM boards", 404]
      ];
      for (const [sql, status] of denials) {
        await f.reset(); await f.pg.exec(sql);
        const response = await f.invoke(kind, input()); assert.equal(response.statusCode, status, `${kind}: ${sql}`);
        assert.equal(f.calls.length, 0); assert.doesNotMatch(JSON.stringify(response.body), /HIDDEN_|AUTHORIZED_SAVED/);
      }
      await f.reset();
      assert.equal((await f.invoke(kind, input(), { user: { email: 'another-account@example.invalid', id: 'owner-id' } })).statusCode, 403);
      // Canonical membership for Y does not authorize Board X or confer canonical X access.
      await f.pg.query("INSERT INTO brand_members VALUES ($1,$2,'editor')", [OTHER, ACTOR]);
      assert.equal((await f.invoke(kind, input())).statusCode, 200);
      assert.doesNotMatch(JSON.stringify(f.calls.at(-1)), /HIDDEN_CANONICAL/);
      await f.pg.exec('DELETE FROM board_editors'); f.calls.length = 0;
      assert.equal((await f.invoke(kind, input())).statusCode, 403); assert.equal(f.calls.length, 0);

      for (const edit of [body => body.boardId = OTHER, body => body.boardId = '../boards', body => body.boardId = null,
        body => body.brandId = OTHER, body => body.workspaceId = FOREIGN, body => body.brandBrainData = [], body => body.untrusted = 'policy']) {
        await f.reset(); const body = input(); edit(body);
        assert([400, 404].includes((await f.invoke(kind, body)).statusCode)); assert.equal(f.calls.length, 0);
      }
      for (const body of [null, [], {}, { ...input(), campaignContext: 'x'.repeat(513 * 1024) }]) {
        assert([400, 413].includes((await f.invoke(kind, body)).statusCode));
      }
      // Incomplete ownership projections fail closed, even if a query double drops columns.
      await f.reset(); f.rows = (sql, result) => { if (/FROM boards WHERE/.test(sql)) delete result.rows[0]?.owner_email; return result; };
      assert.equal((await f.invoke(kind, input())).statusCode, 403); assert.equal(f.calls.length, 0);

      // Revoke/change between capture and dispatch: no provider call.
      await f.reset(); let commits = 0;
      f.beforeQuery = async sql => { if (sql.startsWith('BEGIN') && commits === 1) { commits++; await f.pg.exec('DELETE FROM board_editors'); } if (sql === 'COMMIT') commits++; };
      assert.equal((await f.invoke(kind, input())).statusCode, 409); assert.equal(f.calls.length, 0);
      // Post-inference changes suppress delivery, including values changed without a revision bump.
      for (const sql of ["DELETE FROM board_editors", "UPDATE workspace_memberships SET status='removed'",
        "UPDATE app_identities SET status='disabled'", `UPDATE boards SET brand_id='${OTHER}'`,
        "UPDATE boards SET brand_core_snapshot='{\"valueProposition\":\"CHANGED\"}'",
        "UPDATE boards SET updated_at=updated_at+interval '1 second'", "DELETE FROM brand_members",
        "UPDATE brands SET brand_core='{\"valueProposition\":\"CHANGED\"}'"]) {
        await f.reset(); await f.pg.query("INSERT INTO brand_members VALUES ($1,$2,'viewer')", [BRAND, ACTOR]);
        f.provider = async () => { await f.pg.exec(sql); return { ok: true, json: async () => ({ output_text: JSON.stringify({ title: 'HIDDEN_CANONICAL_X' }) }) }; };
        const response = await f.invoke(kind, input()); assert.equal(response.statusCode, 409, `${kind}: post-inference ${sql}`);
        assert.equal(f.calls.length, 1); assert.doesNotMatch(JSON.stringify(response.body), /HIDDEN_CANONICAL/);
      }
      await f.reset();
      f.beforeQuery = async () => { throw new Error('private database credentials'); };
      const unavailable = await f.invoke(kind, input()); assert.equal(unavailable.statusCode, 503);
      assert.doesNotMatch(JSON.stringify(unavailable.body), /private database/); assert.equal(f.calls.length, 0);

      for (const [provider, status, message] of [
        [async () => ({ ok: false, text: async () => 'HIDDEN_CANONICAL_X' }), 502, 'OpenAI API error'],
        [async () => ({ ok: true, json: async () => ({ output_text: '' , private: 'HIDDEN_CANONICAL_X' }) }), 500, 'OpenAI returned empty output'],
        [async () => ({ ok: true, json: async () => ({ output_text: 'HIDDEN_CANONICAL_X' }) }), 500, 'Failed to parse OpenAI JSON'],
        [async () => { throw new Error('HIDDEN_CANONICAL_X transport'); }, 500, 'Generation request failed']
      ]) {
        await f.reset(); f.provider = provider;
        const response = await f.invoke(kind, input()); assert.equal(response.statusCode, status); assert.equal(response.body.error, message);
        assert.equal(f.calls.length, 1, 'No automatic provider retry'); assert.doesNotMatch(JSON.stringify(response.body), /HIDDEN_CANONICAL/);
        f.provider = null; assert.equal((await f.invoke(kind, input())).statusCode, 200, 'Explicit retry uses fresh authorization');
        assert.equal(f.calls.length, 2);
      }
      console.log(`PASS ${kind}: signed auth, active identity, SQL ACLs, Workspace/Brand isolation, pre/post freshness, bounded inputs, safe errors, explicit retry, store:false`);
    }
    await f.reset();
    for (const change of [b => b.campaignIdea = '', b => b.campaignIdea = {}, b => b.campaignIdea = 'x'.repeat(2001),
      b => b.additionalContext = [], b => b.variationCount = {}, b => b.postsPerVariation = '3junk', b => b.campaignLanguage = ['en'],
      b => b.channel = 'custom', b => b.includeLandingPage = 'false', b => b.includeEmailCampaign = null]) {
      const body = inputs.generate(); change(body); assert.equal((await f.invoke('generate', body)).statusCode, 400);
    }
    assert.equal(f.calls.length, 0);
    for (const language of ['en', 'de', 'es']) {
      const result = await f.invoke('generate', { ...inputs.generate(), campaignLanguage: language }); assert.equal(result.statusCode, 200);
      assert.equal(result.body.setup.campaignLanguage, language);
      assert.match(f.calls.at(-1).input[1].content, new RegExp(`in ${{ en: 'English', de: 'German', es: 'Spanish' }[language]}`));
    }
    for (const change of [b => delete b.currentContent, b => b.nodeType = 'Strategy', b => b.instruction = [],
      b => b.currentContent = { hiddenBrandCore: 'untrusted' }, b => b.parentNode = [], b => b.campaignContext = {}]) {
      const body = inputs.repair(); change(body); assert.equal((await f.invoke('repair', body)).statusCode, 400);
    }
    f.answer = JSON.stringify({ title: 'Repaired pillar', content: 'Specific fictional copy', caption: '' });
    assert.deepEqual((await f.invoke('repair', inputs.repair())).body, JSON.parse(f.answer));
    // Shared Inspector refinement supports all existing Canvas types, not just V3's six.
    // Read the actual UI registry so adding/removing a supported type cannot evade this test.
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const registry = app.slice(app.indexOf('const NODE_TYPES = ') + 'const NODE_TYPES = '.length, app.indexOf('const NEXT_STEP_NODE_TYPE'));
    const types = Object.keys(vm.runInNewContext(`(${registry.trim().replace(/;$/, '')})`));
    assert(types.includes('Visual Concept')); assert(types.includes('Image Brief'));
    for (const nodeType of types) {
      const result = await f.invoke('repair', { ...inputs.repair(), nodeType });
      assert.equal(result.statusCode, 200, `${nodeType}: existing Inspector refinement`);
      assert.deepEqual(result.body, JSON.parse(f.answer));
    }
    await f.reset(); f.env.TENDRA_WRITE_MAINTENANCE = '1';
    for (const kind of Object.keys(inputs)) {
      assert.equal((await f.invoke(kind, inputs[kind](), { user: null })).statusCode, 401);
      const result = await f.invoke(kind, inputs[kind]());
      assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'TENDRA_WRITE_MAINTENANCE');
      assert.equal(result.headers['Retry-After'], '60'); assert.equal(f.calls.length, 0);
    }
    delete f.env.TENDRA_WRITE_MAINTENANCE;
    console.log('PASS generation EN/DE/ES, malformed/missing setup and repair fields, exact main provider schemas, unchanged repair JSON contract; zero domain writes');
    console.log('PASS existing central maintenance response and database gate: retryable 503, auth retained, no paid generation during maintenance');
  } finally { await f.pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
