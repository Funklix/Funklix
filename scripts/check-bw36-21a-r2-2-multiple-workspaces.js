#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { createHandler } = require('../api/workspaces');
const EMAIL = 'r22@example.test';
// Disposable PostgreSQL engine. PGlite has one connection: the pool checkout
// serializes transactions (not SQL statements); actual advisory SQL still runs.
async function main() {
  const realPostgres = process.env.BW36_R22_LOCAL_POSTGRES === '1';
  let admin, pool;
  const database = 'r22_' + randomUUID().replaceAll('-', '');
  if (realPostgres) {
    const { Pool } = require('pg');
    const local = { host: '127.0.0.1', port: 55432, user: 'agent' };
    admin = new Pool({ ...local, database: 'postgres' });
    await admin.query('CREATE DATABASE ' + database);
    pool = new Pool({ ...local, database });
  }
  const pg = pool ? { exec: sql => pool.query(sql), query: (sql, args) => pool.query(sql, args) } : new PGlite(); let tail = Promise.resolve(), fail = '', passed = 0;
  const db = { async connect() {
    if (pool) {
      const client = await pool.connect();
      return { release: () => client.release(), query: (sql, args) => {
        if (fail && sql.includes(fail)) throw new Error('injected rollback failure');
        return client.query(sql, args);
      } };
    }
    const before = tail; let unlock; tail = new Promise(resolve => { unlock = resolve; }); await before;
    return { release: unlock, async query(sql, args) {
      if (fail && sql.includes(fail)) throw new Error('injected rollback failure');
      return pg.query(sql, args);
    } };
  } };
  async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
  try {
    await pg.exec(`CREATE TABLE app_identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),canonical_email text NOT NULL,status text NOT NULL,revision bigint NOT NULL);
      CREATE TABLE workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,locale text NOT NULL,status text NOT NULL,created_by_identity_id uuid REFERENCES app_identities(id),revision bigint NOT NULL DEFAULT 1);
      CREATE TABLE workspace_memberships (workspace_id uuid REFERENCES workspaces(id),identity_id uuid REFERENCES app_identities(id),role text NOT NULL,status text NOT NULL,revision bigint NOT NULL,UNIQUE(workspace_id,identity_id));`);
    const handler = createHandler({ db, sessionReader: () => ({ email: EMAIL }) });
    async function call(body, h = handler) {
      const r = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; } };
      await h({ method: 'POST', body, headers: {} }, r); return r;
    }
    const command = (name = 'Independent', id = randomUUID()) => ({ contract: 'workspace_create_v2', workspace_id: id, name, request_id: randomUUID() });
    const count = async table => (await pg.query('SELECT count(*)::int AS n FROM ' + table)).rows[0].n;
    let initial;
    await check('v2 first creation bootstraps identity and atomic owner', async () => {
      initial = command(' First '); const r = await call(initial); assert.equal(r.statusCode, 201); assert.equal(r.body.workspace.name, 'First');
      assert.equal(await count('app_identities'), 1); assert.equal(await count('workspace_memberships'), 1);
    });
    const identity = (await pg.query('SELECT id FROM app_identities')).rows[0].id;
    await check('second and multiple distinct UUIDs with identical names remain independent', async () => {
      for (let i = 0; i < 3; i++) assert.equal((await call(command())).statusCode, 201);
      assert.equal(await count('workspaces'), 4); assert.equal(await count('workspace_memberships'), 4);
    });
    await check('viewer and member can create independently owned Workspaces', async () => {
      for (const role of ['viewer', 'member']) {
        const actor = randomUUID(), workspace = randomUUID(), email = role + '@example.test';
        await pg.query("INSERT INTO app_identities VALUES ($1,$2,'active',0)", [actor,email]);
        await pg.query("INSERT INTO workspaces (id,name,locale,status,created_by_identity_id) VALUES ($1,$2,'en','active',$3)", [workspace,'Owned by another identity',identity]);
        await pg.query("INSERT INTO workspace_memberships VALUES ($1,$2,'owner','accepted',1),($1,$3,$4,'accepted',1)", [workspace,identity,actor,role]);
        const h = createHandler({ db, sessionReader: () => ({ email }) });
        const r = await call(command(),h); assert.equal(r.body.workspace.role,'owner'); assert.equal(r.statusCode,201);
        const original = (await pg.query('SELECT role FROM workspace_memberships WHERE workspace_id=$1 AND identity_id=$2',[workspace,actor])).rows[0];
        assert.equal(original.role,role,'Unrelated read-only/member access is preserved');
        assert.equal((await pg.query("SELECT count(*)::int AS n FROM workspace_memberships WHERE workspace_id=$1 AND role='owner' AND status='accepted'",[workspace])).rows[0].n,1);
        assert.equal((await pg.query('SELECT created_by_identity_id FROM workspaces WHERE id=$1',[r.body.workspace.id])).rows[0].created_by_identity_id,actor);
      }
    });
    let replay;
    await check('concurrent identical requests and repeated/lost-response replay create exactly one row', async () => {
      replay = command('Café 🚀'); const before = await count('workspaces');
      const results = await Promise.all([call(replay), call(replay)]);
      assert.deepEqual(results.map(r => r.body.created).sort(), [false, true]);
      assert.equal(await count('workspaces'), before + 1); assert.equal((await call(replay)).body.created, false);
      assert.equal((await call({ ...replay, name: '  Cafe\u0301   🚀  ' })).body.created, false);
    });
    await check('concurrent competing creators and differing inputs cannot share or overwrite a UUID', async () => {
      const c = command(), foreign = createHandler({ db, sessionReader: () => ({ email: 'competing@example.test' }) });
      const results = await Promise.all([call(c), call(c, foreign)]);
      assert.deepEqual(results.map(r => r.statusCode).sort(), [201, 409]);
      assert.equal(results.find(r => r.statusCode === 409).body.workspace, undefined);
      const collision = command();
      const names = await Promise.all([call(collision), call({ ...collision, name: 'Different' })]);
      assert.deepEqual(names.map(r => r.statusCode).sort(), [201, 409]);
    });
    await check('changed input, foreign UUID, archived and revoked targets return identical metadata-free conflict', async () => {
      async function conflict(input, h) { const r = await call(input, h); assert.equal(r.statusCode, 409); assert.equal(r.body.error.code, 'WORKSPACE_CREATE_CONFLICT'); assert.equal(r.body.workspace, undefined); }
      await conflict({ ...replay, name: 'Different' });
      const foreign = createHandler({ db, sessionReader: () => ({ email: 'foreign@example.test' }) }); await conflict(replay, foreign);
      await pg.query("UPDATE workspaces SET status='archived' WHERE id=$1", [replay.workspace_id]); await conflict(replay);
      await pg.query("UPDATE workspaces SET status='active' WHERE id=$1", [replay.workspace_id]);
      await pg.query("UPDATE workspace_memberships SET status='revoked' WHERE workspace_id=$1", [replay.workspace_id]); await conflict(replay);
      await pg.query("UPDATE workspace_memberships SET status='accepted',revision=2 WHERE workspace_id=$1", [replay.workspace_id]); await conflict(replay);
    });
    await check('renamed target cannot turn current mutable name into original request input', async () => {
      const c = command('Original'); await call(c);
      await pg.query('UPDATE workspaces SET name=$2, revision=2 WHERE id=$1', [c.workspace_id, 'Renamed']);
      for (const name of ['Original', 'Renamed']) assert.equal((await call({ ...c, name })).body.error.code, 'WORKSPACE_CREATE_CONFLICT');
    });
    await check('failed membership transaction rolls back Workspace and bootstrapped identity, then retries same UUID', async () => {
      const before = await count('workspaces'), c = command(); fail = 'INSERT INTO public.workspace_memberships';
      const h = createHandler({ db, sessionReader: () => ({ email: 'rollback@example.test' }) });
      assert.equal((await call(c, h)).statusCode, 500); assert.equal(await count('workspaces'), before);
      assert.equal((await pg.query("SELECT * FROM app_identities WHERE canonical_email='rollback@example.test'")).rows.length, 0);
      fail = ''; assert.equal((await call(c, h)).statusCode, 201);
    });
    await check('disabled, ambiguous, invalid and unauthenticated identities reject creation', async () => {
      await pg.query("UPDATE app_identities SET status='disabled' WHERE id=$1", [identity]); assert.equal((await call(command())).body.error.code, 'IDENTITY_DISABLED');
      await pg.query("UPDATE app_identities SET status='active' WHERE id=$1", [identity]);
      const duplicate = randomUUID(); await pg.query("INSERT INTO app_identities VALUES ($1,$2,'active',0)", [duplicate, EMAIL]);
      assert.equal((await call(command())).body.error.code, 'IDENTITY_AMBIGUOUS'); await pg.query('DELETE FROM app_identities WHERE id=$1', [duplicate]);
      await pg.query("UPDATE app_identities SET status='invalid' WHERE id=$1", [identity]); assert.equal((await call(command())).body.error.code, 'IDENTITY_INVALID');
      await pg.query("UPDATE app_identities SET status='active' WHERE id=$1", [identity]);
      assert.equal((await call(command(), createHandler({ db, sessionReader: () => null }))).statusCode, 401);
    });
    await check('v1 first-only safety and compatibility remain enforced', async () => {
      assert.equal((await call({ contract: 'workspace_create_v1', name: 'Another', request_id: 'v1' })).body.error.code, 'WORKSPACE_ALREADY_EXISTS');
      const h = createHandler({ db, sessionReader: () => ({ email: 'v1@example.test' }) });
      const c = { contract: 'workspace_create_v1', name: 'Legacy', request_id: 'v1-new' };
      assert.equal((await call(c, h)).statusCode, 201); assert.equal((await call(c, h)).body.created, false);
    });
    await check('strict v2 UUID, name, version and request validation', async () => {
      for (const c of [{ ...command(), workspace_id: 'bad' }, { ...command(), name: '---' }, { ...command(), extra: true }, { ...command(), request_id: '' }]) assert([400, 422].includes((await call(c)).statusCode));
    });
    await check('catalog appends without dropping populated descendants and validates exact UUID', async () => {
      const sandbox = { globalThis: { FunklixWorkspaceName: require('../workspace-name') } };
      vm.runInNewContext(fs.readFileSync('workspace-catalog.js', 'utf8'), sandbox); const c = sandbox.globalThis.FunklixWorkspaceCatalog;
      const input = command(), result = (await call(input)).body;
      const checked = c.validateCreate(result, input.request_id, input.workspace_id);
      assert.throws(() => c.validateCreate(result, input.request_id, randomUUID()));
      await assert.rejects(c.create(input.name,input.request_id,async()=>({ok:true,json:async()=>({...result,workspace:{...result.workspace,name:'Wrong name'}})}),input.workspace_id),{code:'RESPONSE_INVALID'});
      assert.throws(() => c.validateCreate({ ...result, contract: 'workspace_create_v1' }, input.request_id, input.workspace_id));
      const old = { workspaces: [{ id: initial.workspace_id, brands: [{ id: 'retained' }], boards: [{ id: 'saved' }] }] };
      const appended = c.reconcileCreate(old, checked); assert.equal(appended.workspaces.length, 2); assert.equal(appended.workspaces[0], old.workspaces[0]);
      const populated = { workspaces: [{ ...checked.workspace, brands: [{ id: 'brand' }], boards: [{ id: 'board' }] }] };
      assert.equal(c.reconcileCreate(populated, checked), populated);
    });
    console.log(`PASS R2.2 ${passed} server/client groups; ${realPostgres ? 'real PostgreSQL concurrent sessions' : 'disposable PGlite PostgreSQL SQL'}, no production or provider calls.`);
  } finally {
    if (pool) { await pool.end(); await admin.query('DROP DATABASE ' + database); await admin.end(); }
    else await pg.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
