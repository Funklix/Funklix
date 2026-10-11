#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { learningRuntime } = require('./fixtures/bw36-17-local-runtime');
const { B, I, EMAIL } = require('./fixtures/bw36-13r5-local-runtime');
const originalPath = 'migrations/20261011_bw36_17_governed_brand_learnings.sql';
const repairPath = 'migrations/20261011_bw36_17r1_learning_provenance_schema.sql';
const original = fs.readFileSync(originalPath, 'utf8');
const repair = fs.readFileSync(repairPath, 'utf8');
const verification = fs.readFileSync('scripts/sql/bw36-17r1-learning-provenance-verification.sql', 'utf8');
const BOARD = '77777777-7777-4777-8777-777777777777';
const NODE = '88888888-8888-4888-8888-888888888888';
const service = learningRuntime().service;
const provenance = { source_board_id: BOARD, source_node_id: NODE, source_board_name_snapshot: 'Invented campaign',
  source_node_title_snapshot: 'Invented node', source_node_type_snapshot: 'content' };
let checks = 0, networkCalls = 0;
// No network transport is needed by this disposable WASM PostgreSQL fixture.
globalThis.fetch = () => { networkCalls++; throw new Error('Network forbidden by provenance fixture'); };
for (const name of ['node:http', 'node:https']) {
  const transport = require(name);
  transport.request = transport.get = () => { networkCalls++; throw new Error('Network forbidden by provenance fixture'); };
}
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function setup() {
  const pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.app_identities(id uuid PRIMARY KEY,canonical_email text,status text,revision bigint);
    CREATE TABLE public.brands(id uuid PRIMARY KEY,owner_email text,name text,revision bigint);
    CREATE TABLE public.brand_members(brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,email text,role text,name text,UNIQUE(brand_id,email));
    CREATE TABLE public.boards(id uuid PRIMARY KEY,brand_id uuid REFERENCES brands(id));`);
  await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)', [I, EMAIL, 'active']);
  await pg.query('INSERT INTO brands VALUES ($1,$2,$3,1)', [B, EMAIL, 'Invented Brand']);
  await pg.query('INSERT INTO boards VALUES ($1,$2)', [BOARD, B]);
  await pg.exec(original);
  return pg;
}
async function apply(pg, sql = repair) {
  try { await pg.exec(sql); } catch (error) { await pg.exec('ROLLBACK'); throw error; }
}
function baselineQuery(row) {
  return verification.replace('NULL::bigint, NULL::text, NULL::bigint, NULL::text',
    `${row.learning_count}::bigint, '${row.learning_fingerprint}'::text, ${row.event_count}::bigint, '${row.event_fingerprint}'::text`);
}
const snapshot = extra => ({ statement: 'Human observation', source_type: 'campaign_observation', ...extra });
async function insertCampaign(pg, overrides = {}) {
  const p = { ...provenance, ...overrides };
  return (await pg.query(`INSERT INTO public.brand_learnings
    (brand_id,statement,statement_key,proposed_by_identity_id,source_type,source_board_id,source_node_id,
    source_board_name_snapshot,source_node_title_snapshot,source_node_type_snapshot)
    VALUES ($1,$2,$3,$4,'campaign_observation',$5,$6,$7,$8,$9) RETURNING *`,
  [B, 'Human observation', service.statementKey('Human observation'), I, ...Object.values(p)])).rows[0];
}
async function event(pg, learning, payload) {
  return pg.query(`INSERT INTO public.brand_learning_events
    (brand_id,learning_id,event_type,actor_identity_id,next_status,learning_revision,snapshot)
    VALUES ($1,$2,'proposed',$3,'proposed',0,$4::jsonb)`, [B, learning.id, I, JSON.stringify(payload)]);
}
async function main() {
  await test('historical migration is byte-identical; one ordered transaction; no data or application activation', async () => {
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), 'cbb8998793444a128118aff57e47618fb02005bd6fec072ccf42f67592d00bee');
    assert.equal(fs.readdirSync('migrations').filter(n => n.includes('bw36_17r1')).join(), repairPath.split('/').at(-1));
    assert.match(repair, /^BEGIN;[\s\S]*COMMIT;\s*$/m);
    assert.doesNotMatch(repair, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\./i);
    assert.doesNotMatch(repair, /CREATE POLICY|DISABLE ROW LEVEL SECURITY|GRANT\s/i);
    assert.equal(require('../package.json').scripts['check:bw36.17r1'], 'node scripts/check-bw36-17r1-learning-provenance-schema.js');
  });
  const pg = await setup();
  try {
    const db = { connect: async () => ({ query: (q, a) => pg.query(q, a), release() {} }) };
    const run = input => service.operate({ db, user: { email: EMAIL }, brandId: B, input });
    const create = statement => run(service.inputRequest({ statement, expected_brand_revision: '1' }, true));
    const act = (row, action, more = {}) => run(service.inputRequest({ action, learning_id: row.id, expected_revision: row.revision, ...more }, false));
    const manual = (await create('Existing manual conclusion')).learning;
    const manualBefore = (await pg.query('SELECT * FROM brand_learnings WHERE id=$1', [manual.id])).rows[0];
    const eventsBefore = (await pg.query('SELECT * FROM brand_learning_events ORDER BY id')).rows;
    let baseline;
    await test('baseline query is one read-only statement and cannot claim preservation without a baseline', async () => {
      assert.equal((verification.replace(/--[^\n]*/g, '').match(/;/g) || []).length, 1);
      baseline = (await pg.query(verification)).rows[0];
      assert.equal(baseline.overall_readiness, 'baseline_required');
      assert.equal(baseline.existing_rows_unchanged, false);
    });
    await test('original SET NULL foreign key reproduces the lifecycle conflict', async () => {
      const row = (await pg.query(`INSERT INTO brand_learnings
        (brand_id,statement,statement_key,source_type,source_board_id,source_node_id,proposed_by_identity_id)
        VALUES ($1,'Pre-repair source',$2,'campaign_observation',$3,$4,$5) RETURNING *`,
      [B, service.statementKey('Pre-repair source'), BOARD, NODE, I])).rows[0];
      await assert.rejects(() => pg.query('DELETE FROM boards WHERE id=$1', [BOARD]), /learning_revision_or_ownership/);
      assert.equal((await pg.query('SELECT source_board_id FROM brand_learnings WHERE id=$1', [row.id])).rows[0].source_board_id, BOARD);
      // Include every actual pre-migration row in the preservation baseline.
      baseline = (await pg.query(verification)).rows[0];
    });
    await test('forward migration preserves all manual Learning and append-only event values', async () => {
      await apply(pg);
      const after = (await pg.query('SELECT * FROM brand_learnings WHERE id=$1', [manual.id])).rows[0];
      for (const [k, v] of Object.entries(manualBefore)) assert.deepEqual(after[k], v, k);
      for (const k of Object.keys(provenance).filter(k => k.endsWith('_snapshot'))) assert.equal(after[k], null);
      assert.deepEqual((await pg.query('SELECT * FROM brand_learning_events ORDER BY id')).rows, eventsBefore);
      const result = (await pg.query(baselineQuery(baseline))).rows[0];
      assert.equal(result.overall_readiness, 'ok', JSON.stringify(result));
      assert(Object.values(result).slice(0, 14).every(v => v === true));
    });
    await test('replay refuses and rolls back without changing valid provenance', async () => {
      await assert.rejects(() => apply(pg), /bw36_17r1_unexpected_or_already_applied/);
      assert.equal((await pg.query(baselineQuery(baseline))).rows[0].overall_readiness, 'ok');
    });
    let campaign;
    await test('proposed campaign observation and bounded creation event retain server-shaped provenance', async () => {
      campaign = await insertCampaign(pg);
      assert.equal(campaign.status, 'proposed'); assert.equal(campaign.revision, 0);
      assert.equal(campaign.reviewed_by_identity_id, null); assert.equal(campaign.reviewed_at, null);
      await event(pg, campaign, snapshot(provenance));
      const saved = (await pg.query('SELECT snapshot FROM brand_learning_events WHERE learning_id=$1', [campaign.id])).rows[0].snapshot;
      assert.deepEqual(saved, snapshot(provenance));
    });
    await test('Board deletion succeeds and preserves immutable source UUID, node ID, snapshots and history', async () => {
      const before = (await pg.query('SELECT * FROM brand_learnings WHERE id=$1', [campaign.id])).rows[0];
      const history = (await pg.query('SELECT * FROM brand_learning_events WHERE learning_id=$1', [campaign.id])).rows;
      await pg.query('DELETE FROM boards WHERE id=$1', [BOARD]);
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM boards')).rows[0].n, 0);
      assert.deepEqual((await pg.query('SELECT * FROM brand_learnings WHERE id=$1', [campaign.id])).rows[0], before);
      assert.deepEqual((await pg.query('SELECT * FROM brand_learning_events WHERE learning_id=$1', [campaign.id])).rows, history);
    });
    await test('every ownership/provenance field is immutable even with the correct revision increment', async () => {
      for (const [key, value] of Object.entries(provenance)) {
        const changed = key.endsWith('_id') ? B : `${value} changed`;
        await assert.rejects(() => pg.query(`UPDATE brand_learnings SET ${key}=$2, revision=revision+1 WHERE id=$1`, [campaign.id, changed]), /learning_revision_or_ownership/);
        await assert.rejects(() => pg.query(`UPDATE brand_learnings SET ${key}=NULL, revision=revision+1 WHERE id=$1`, [campaign.id]), /learning_revision_or_ownership/);
      }
      for (const [key, value] of [['brand_id', BOARD], ['proposed_by_identity_id', BOARD], ['source_type', 'manual']]) {
        await assert.rejects(() => pg.query(`UPDATE brand_learnings SET ${key}=$2, revision=revision+1 WHERE id=$1`, [campaign.id, value]), /learning_revision_or_ownership/);
      }
      await assert.rejects(() => pg.query("UPDATE brand_learnings SET created_at=created_at+interval '1 second',revision=revision+1 WHERE id=$1", [campaign.id]), /learning_revision_or_ownership/);
      await assert.rejects(() => pg.query('UPDATE brand_learnings SET revision=revision+2 WHERE id=$1', [campaign.id]), /learning_revision_or_ownership/);
    });
    await test('column checks reject empty, whitespace, controls and oversized display snapshots', async () => {
      await pg.query('BEGIN');
      try {
        await pg.query("UPDATE brand_learnings SET status='rejected',reviewed_by_identity_id=$2,reviewed_at=now(),revision=revision+1 WHERE id=$1", [campaign.id, I]);
        for (const [key, max] of [['source_board_name_snapshot', 200], ['source_node_title_snapshot', 300], ['source_node_type_snapshot', 100]]) {
          for (const value of ['', ' \t\n', '\u00a0\u2003\u202f', '\u0001', 'Visible\u0001', 'x'.repeat(max + 1)]) {
            await pg.query('SAVEPOINT invalid_value');
            await assert.rejects(() => insertCampaign(pg, { [key]: value }), /check constraint/);
            await pg.query('ROLLBACK TO SAVEPOINT invalid_value');
          }
          await pg.query('SAVEPOINT valid_boundary');
          const atLimit = await insertCampaign(pg, { [key]: 'x'.repeat(max) });
          assert.equal(atLimit[key].length, max);
          await pg.query('ROLLBACK TO SAVEPOINT valid_boundary');
        }
      } finally { await pg.query('ROLLBACK'); }
    });
    await test('event allowlist rejects unknown keys, non-UUID sources, nested/raw payloads and every text overflow', async () => {
      const invalid = [snapshot({ raw_board: {} }), snapshot({ email: 'invented@example.test' }), snapshot({ prompt: 'raw' }),
        snapshot({ model_output: 'raw' }), snapshot({ source_board_id: 'not-a-uuid' }), snapshot({ source_node_id: 'node-1' }),
        { source_type: 'campaign_observation' }, { statement: 'Human observation' },
        { statement: null, source_type: 'campaign_observation' }, snapshot({ source_type: null }),
        snapshot({ statement: 'x'.repeat(2001) }), snapshot({ evidence_summary: 'x'.repeat(4001) })];
      for (const [key, max] of [['source_board_name_snapshot', 200], ['source_node_title_snapshot', 300], ['source_node_type_snapshot', 100]]) {
        for (const value of ['', '   ', '\u00a0\u2003', '\u0001', 'x'.repeat(max + 1), {}, [], 4, false]) invalid.push(snapshot({ [key]: value }));
      }
      for (const key of ['source_board_id', 'source_node_id']) for (const value of [{}, [], 4, false]) invalid.push(snapshot({ [key]: value }));
      for (const value of invalid) await assert.rejects(() => event(pg, campaign, value), /check constraint/);
      await assert.rejects(() => event(pg, campaign, []), /check constraint/);
      await assert.rejects(() => event(pg, campaign, { ...snapshot({ statement: 'x'.repeat(2000), evidence_summary: 'x'.repeat(4000) }), raw: 'x'.repeat(40001) }), /check constraint/);
      // All optional nulls and exact bounds are legal; avoid the existing append-only event uniqueness guard.
      const probe = (await pg.query('INSERT INTO brand_learnings (brand_id,statement,statement_key,proposed_by_identity_id) VALUES ($1,$2,$3,$4) RETURNING *', [B, 'Bounded event fixture', service.statementKey('Bounded event fixture'), I])).rows[0];
      await pg.query('BEGIN');
      try {
        await event(pg, probe, snapshot({ source_board_id: null, source_node_id: null, source_board_name_snapshot: null, source_node_title_snapshot: null, source_node_type_snapshot: null }));
      } finally { await pg.query('ROLLBACK'); }
      await pg.query('BEGIN');
      try { await event(pg, probe, snapshot({ ...provenance, source_board_name_snapshot: 'b'.repeat(200), source_node_title_snapshot: 'n'.repeat(300), source_node_type_snapshot: 't'.repeat(100) })); }
      finally { await pg.query('ROLLBACK'); }
    });
    await test('existing manual approval, edit/successor, rejection and archive remain governed', async () => {
      const approved = (await act(manual, 'approve')).learning;
      const successor = (await act(approved, 'edit', { statement: 'Confirmed successor conclusion' })).learning;
      const successorApproved = (await act(successor, 'approve')).learning;
      assert.equal((await pg.query('SELECT status FROM brand_learnings WHERE id=$1', [manual.id])).rows[0].status, 'archived');
      assert.equal((await act(successorApproved, 'archive')).learning.status, 'archived');
      const rejected = (await act((await create('Explicit rejection')).learning, 'reject')).learning;
      assert.equal(rejected.status, 'rejected');
      await assert.rejects(() => act(rejected, 'approve'), /INVALID_LIFECYCLE_TRANSITION/);
      const approvedCampaign = (await act(campaign, 'approve')).learning;
      assert.equal(approvedCampaign.status, 'approved');
      const retained = (await pg.query('SELECT * FROM brand_learnings WHERE id=$1', [campaign.id])).rows[0];
      for (const [key, value] of Object.entries(provenance)) assert.equal(retained[key], value);
      await assert.rejects(() => pg.query(`INSERT INTO brand_learnings
        (brand_id,statement,statement_key,proposed_by_identity_id,status,reviewed_by_identity_id,reviewed_at)
        VALUES ($1,'Direct approval',$2,$3,'approved',$3,now())`, [B, service.statementKey('Direct approval'), I]), /learning_insert_state/);
    });
    await test('append-only events, no individual deletion/TRUNCATE and browser grants remain closed', async () => {
      await assert.rejects(() => pg.query("UPDATE brand_learning_events SET snapshot='{}'::jsonb"), /learning_history_immutable/);
      await assert.rejects(() => pg.query('DELETE FROM brand_learning_events'), /learning_history_immutable/);
      await assert.rejects(() => pg.query('DELETE FROM brand_learnings'), /learning_history_immutable/);
      await assert.rejects(() => pg.exec('TRUNCATE brand_learning_events'), /learning_history_immutable/);
      await assert.rejects(() => pg.exec('TRUNCATE brand_learnings, brand_learning_events'), /learning_history_immutable/);
      for (const role of ['anon', 'authenticated']) {
        await pg.exec(`SET ROLE ${role}`);
        try {
          for (const table of ['brand_learnings', 'brand_learning_events']) {
            await assert.rejects(() => pg.query(`SELECT * FROM ${table}`), /permission denied/);
            await assert.rejects(() => pg.query(`DELETE FROM ${table}`), /permission denied/);
          }
        } finally { await pg.exec('RESET ROLE'); }
      }
      const current = (await pg.query(verification)).rows[0];
      for (const key of ['rls_enabled', 'no_browser_policies', 'browser_grants_closed', 'public_grants_closed', 'append_only_history_preserved']) assert.equal(current[key], true, key);
      assert.equal((await pg.query(baselineQuery(baseline))).rows[0].overall_readiness, 'not_ready', 'Changed rows cannot claim baseline preservation');
    });
    await test('Brand deletion still cascades owned Learnings and events', async () => {
      await pg.query('DELETE FROM brands WHERE id=$1', [B]);
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM brand_learnings')).rows[0].n, 0);
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM brand_learning_events')).rows[0].n, 0);
    });
  } finally { await pg.close(); }
  for (const [name, change, pattern] of [
    ['wrong source FK action', "ALTER TABLE brand_learnings DROP CONSTRAINT brand_learnings_source_board_id_fkey; ALTER TABLE brand_learnings ADD FOREIGN KEY(source_board_id) REFERENCES boards(id) ON DELETE CASCADE", /source_fk_mismatch/],
    ['missing source FK', 'ALTER TABLE brand_learnings DROP CONSTRAINT brand_learnings_source_board_id_fkey', /source_fk_mismatch/],
    ['changed lifecycle', "CREATE OR REPLACE FUNCTION guard_brand_learning_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$", /lifecycle_mismatch/],
    ['open browser grant', 'GRANT SELECT ON brand_learnings TO authenticated', /governance_mismatch/],
    ['open column grant', 'GRANT SELECT(statement) ON brand_learnings TO authenticated', /governance_mismatch/],
    ['changed history guard', "CREATE OR REPLACE FUNCTION guard_brand_learning_history() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN OLD; END$$", /history_mismatch/],
    ['changed event allowlist', 'ALTER TABLE brand_learning_events DROP CONSTRAINT brand_learning_events_snapshot_check; ALTER TABLE brand_learning_events ADD CHECK (snapshot IS NOT NULL)', /event_check_mismatch/]
  ]) {
    await test(`unexpected schema refuses atomically: ${name}`, async () => {
      const pg = await setup();
      try {
        await pg.exec(change);
        await assert.rejects(() => apply(pg), pattern);
        assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid='brand_learnings'::regclass AND attname='source_board_name_snapshot' AND NOT attisdropped")).rows[0].n, 0);
      } finally { await pg.close(); }
    });
  }
  await test('catalog discovery supports renamed generated FK and event constraints', async () => {
    const pg = await setup();
    try {
      await pg.exec('ALTER TABLE brand_learnings RENAME CONSTRAINT brand_learnings_source_board_id_fkey TO invented_source_fk; ALTER TABLE brand_learning_events RENAME CONSTRAINT brand_learning_events_snapshot_check TO invented_snapshot_check');
      const baseline = (await pg.query(verification)).rows[0];
      await apply(pg);
      assert.equal((await pg.query(baselineQuery(baseline))).rows[0].overall_readiness, 'ok');
    } finally { await pg.close(); }
  });
  await test('missing prerequisite and mid-migration failure both roll back', async () => {
    const missing = new PGlite();
    try { await assert.rejects(() => apply(missing), /schema_missing/); } finally { await missing.close(); }
    const pg = await setup();
    try {
      await assert.rejects(() => apply(pg, repair.replace('COMMIT;', () => "DO $$ BEGIN RAISE EXCEPTION 'invented_failure'; END $$;\nCOMMIT;")), /invented_failure/);
      assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid='brand_learnings'::regclass AND attname='source_board_name_snapshot' AND NOT attisdropped")).rows[0].n, 0);
      assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='brand_learnings'::regclass AND confrelid='boards'::regclass")).rows[0].n, 1);
      await apply(pg);
    } finally { await pg.close(); }
  });
  await test('preservation guard detects a row rewrite and rolls the whole migration back', async () => {
    const pg = await setup();
    try {
      const before = (await pg.query('INSERT INTO brand_learnings (brand_id,statement,statement_key,proposed_by_identity_id) VALUES ($1,$2,$3,$4) RETURNING *', [B, 'Preservation fixture', service.statementKey('Preservation fixture'), I])).rows[0];
      const tampered = repair.replace('DO $preserve$', () => "UPDATE public.brand_learnings SET statement='Invented rewrite', revision=revision+1;\nDO $preserve$");
      await assert.rejects(() => apply(pg, tampered), /bw36_17r1_preservation_failed/);
      assert.deepEqual((await pg.query('SELECT * FROM brand_learnings WHERE id=$1', [before.id])).rows[0], before);
      assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='brand_learnings'::regclass AND confrelid='boards'::regclass")).rows[0].n, 1);
    } finally { await pg.close(); }
  });
  assert.equal(networkCalls, 0);
  console.log(`BW-36.17R1: ${checks} disposable PostgreSQL checks passed. Zero provider/AI/network requests; zero production SQL/data mutations.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
