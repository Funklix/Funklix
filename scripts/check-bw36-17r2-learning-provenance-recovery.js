#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const original = fs.readFileSync('migrations/20261011_bw36_17_governed_brand_learnings.sql', 'utf8');
const r1 = fs.readFileSync('migrations/20261011_bw36_17r1_learning_provenance_schema.sql', 'utf8');
const repair = fs.readFileSync('migrations/20261012_bw36_17r2_learning_provenance_recovery.sql', 'utf8');
const verification = fs.readFileSync('scripts/sql/bw36-17r2-learning-provenance-recovery-verification.sql', 'utf8');
const { B, I, EMAIL } = require('./fixtures/bw36-13r5-local-runtime');
const BOARD = '77777777-7777-4777-8777-777777777777';
const NODE = '88888888-8888-4888-8888-888888888888';
const keys = ['source_board_name_snapshot', 'source_node_title_snapshot', 'source_node_type_snapshot'];
const lifecycle = r1.slice(r1.indexOf('CREATE OR REPLACE FUNCTION'), r1.indexOf('END $lifecycle$;') + 'END $lifecycle$;'.length);
const oldLifecycle = original.slice(original.indexOf('CREATE FUNCTION public.guard_brand_learning_lifecycle'), original.indexOf('END $$;') + 'END $$;'.length).replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
let checks = 0, networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw new Error('Network forbidden'); };
for (const name of ['node:http', 'node:https']) {
  const transport = require(name);
  transport.request = transport.get = () => { networkCalls++; throw new Error('Network forbidden'); };
}
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function setup() {
  const notices = [];
  const pg = new PGlite();
  pg.notices = notices;
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.app_identities(id uuid PRIMARY KEY,canonical_email text,status text,revision bigint);
    CREATE TABLE public.brands(id uuid PRIMARY KEY,owner_email text,name text,revision bigint);
    CREATE TABLE public.boards(id uuid PRIMARY KEY,brand_id uuid REFERENCES brands(id));`);
  await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)', [I, EMAIL, 'active']);
  await pg.query('INSERT INTO brands VALUES ($1,$2,$3,1)', [B, EMAIL, 'Invented Brand']);
  await pg.query('INSERT INTO boards VALUES ($1,$2)', [BOARD, B]);
  await pg.exec(original);
  return pg;
}
async function apply(pg, sql = repair) {
  try { await pg.exec(sql, { onNotice: n => pg.notices?.push(n.message) }); } catch (error) { await pg.exec('ROLLBACK'); throw error; }
}
async function rows(pg) {
  // JSONB text captures the stored values, including timestamp precision, rather than JS Date conversions.
  return (await pg.query(`SELECT 'learning' kind, id, (to_jsonb(l)-ARRAY['${keys.join("','")}'])::text data FROM brand_learnings l
    UNION ALL SELECT 'event', id, to_jsonb(e)::text FROM brand_learning_events e ORDER BY kind,id`)).rows;
}
async function catalog(pg) {
  // OIDs and complete catalog rows expose even an equivalent DROP/CREATE or function replacement.
  return (await pg.query(`SELECT 'relation' kind, c.oid, to_jsonb(c)::text data FROM pg_class c WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'attribute', a.attrelid, to_jsonb(a)::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'constraint', c.oid, to_jsonb(c)::text FROM pg_constraint c WHERE c.connamespace='public'::regnamespace
    UNION ALL SELECT 'trigger', t.oid, to_jsonb(t)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'function', p.oid, to_jsonb(p)::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    UNION ALL SELECT 'policy', p.oid, to_jsonb(p)::text FROM pg_policy p ORDER BY kind,oid,data`)).rows;
}
async function insert(pg, provenance = false) {
  return (await pg.query(`INSERT INTO brand_learnings (brand_id,statement,statement_key,proposed_by_identity_id,source_type,source_board_id,source_node_id${provenance ? ',' + keys.join(',') : ''})
    VALUES ($1,'Invented observation',$2,$3,'campaign_observation',$4,$5${provenance ? ",$6,$7,$8" : ''}) RETURNING *`,
  [B, 'a'.repeat(64), I, BOARD, NODE, ...(provenance ? ['Invented Board', 'Invented node', 'content'] : [])])).rows[0];
}
async function event(pg, learning, snapshot = { statement: 'Invented observation', source_type: 'campaign_observation' }) {
  return pg.query(`INSERT INTO brand_learning_events (brand_id,learning_id,event_type,actor_identity_id,next_status,learning_revision,snapshot)
    VALUES ($1,$2,'proposed',$3,'proposed',0,$4::jsonb)`, [B, learning.id, I, JSON.stringify(snapshot)]);
}
async function readiness(pg, expected = 'ok') {
  const result = (await pg.query(verification)).rows[0];
  assert.equal(result.overall_readiness, expected, JSON.stringify(result));
  return result;
}
async function main() {
  await test('historical SQL unchanged; single procedural transaction; no staging, DML or access expansion', async () => {
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), 'cbb8998793444a128118aff57e47618fb02005bd6fec072ccf42f67592d00bee');
    assert.equal(crypto.createHash('sha256').update(r1).digest('hex'), '749615765bfac9f34314d72a171f10c3aa2cd730e7192c223ceb8af7a3fa037f');
    assert.equal((repair.match(/^DO /gm) || []).length, 1);
    assert.match(repair, /^BEGIN;[\s\S]*COMMIT;\s*$/m);
    assert.doesNotMatch(repair, /CREATE\s+(?:(?:TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE|\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\.|CREATE POLICY|DISABLE ROW LEVEL SECURITY|GRANT\s/i);
    assert.equal((verification.replace(/--[^\n]*/g, '').match(/;/g) || []).length, 1);
    assert.doesNotMatch(verification.replace(/'[^']*'/g, "''").replace(/--[^\n]*/g, ''), /expected_baseline|baseline_required|NULL::bigint|\b(?:ALTER|CREATE|DROP|UPDATE|INSERT|DELETE)\b/i);
    assert.equal(require('../package.json').scripts['check:bw36.17r2'], 'node scripts/check-bw36-17r2-learning-provenance-recovery.js');
    const contract = verification.slice(verification.indexOf('WITH fingerprints'), verification.indexOf('\nSELECT c.*, f.*'));
    assert.equal(repair.split(contract).length, 3, 'migration reuses exact verification contract before/after DDL');
  });
  await test('manual editor commit reproduces R1 missing preservation table (42P01)', async () => {
    const pg = await setup();
    try {
      const split = r1.indexOf('ALTER TABLE public.brand_learnings\n  ADD COLUMN');
      await pg.exec(r1.slice(0, split) + '\nCOMMIT;');
      const preserve = r1.indexOf('DO $preserve$');
      await pg.exec(r1.slice(split, preserve));
      await assert.rejects(() => pg.exec(r1.slice(preserve)), error => error.code === '42P01' && /bw36_17r1_preservation/.test(error.message));
      // The already committed statements leave the exact R1 schema applied, as in the supplied diagnostics.
      const result = await readiness(pg); assert.equal(result.learning_count, 0); assert.equal(result.event_count, 0);
      await apply(pg); assert(pg.notices.includes('bw36_17r2_already_ready'));
    } finally { await pg.close(); }
  });
  await test('State A upgrades directly and preserves invented Learning/event bytes without a baseline', async () => {
    const pg = await setup();
    try {
      const learning = await insert(pg); await event(pg, learning);
      const before = await rows(pg);
      await apply(pg);
      assert(pg.notices.includes('bw36_17r2_upgraded_preserved'));
      assert.deepEqual(await rows(pg), before);
      const result = await readiness(pg);
      assert.equal(result.learning_count, 1); assert.equal(result.event_count, 1);
      assert.deepEqual((await pg.query(`SELECT ${keys.join(',')} FROM brand_learnings`)).rows[0], Object.fromEntries(keys.map(k => [k, null])));
      const schema = await catalog(pg);
      await apply(pg); assert(pg.notices.includes('bw36_17r2_already_ready'));
      assert.deepEqual(await catalog(pg), schema); assert.deepEqual(await rows(pg), before);
    } finally { await pg.close(); }
  });
  await test('exact completed R1 State B is a catalog/row no-op with zero or nonzero rows', async () => {
    const pg = await setup();
    try {
      await apply(pg, r1); const schema = await catalog(pg);
      await apply(pg); await readiness(pg);
      assert.deepEqual(await catalog(pg), schema);
      const learning = await insert(pg); await event(pg, learning);
      const before = await rows(pg); const populatedSchema = await catalog(pg);
      await apply(pg); await readiness(pg);
      assert.deepEqual(await catalog(pg), populatedSchema); assert.deepEqual(await rows(pg), before);
      assert(pg.notices.includes('bw36_17r2_already_ready'));
    } finally { await pg.close(); }
  });
  // Missing + duplicate constraints keep the old aggregate sum/total unchanged.
  // Exercise every expected relationship in both supported input states.
  const relationships = [
    ['brand_learnings', 'brand_learnings_brand_id_fkey', 'brand_id', 'brands(id) ON DELETE CASCADE'],
    ['brand_learnings', 'brand_learnings_proposed_by_identity_id_fkey', 'proposed_by_identity_id', 'app_identities(id) ON DELETE RESTRICT'],
    ['brand_learnings', 'brand_learnings_reviewed_by_identity_id_fkey', 'reviewed_by_identity_id', 'app_identities(id) ON DELETE RESTRICT'],
    ['brand_learnings', 'brand_learnings_brand_id_supersedes_learning_id_fkey', 'brand_id,supersedes_learning_id', 'brand_learnings(brand_id,id)'],
    ['brand_learning_events', 'brand_learning_events_brand_id_fkey', 'brand_id', 'brands(id) ON DELETE CASCADE'],
    ['brand_learning_events', 'brand_learning_events_actor_identity_id_fkey', 'actor_identity_id', 'app_identities(id) ON DELETE RESTRICT'],
    ['brand_learning_events', 'brand_learning_events_brand_id_learning_id_fkey', 'brand_id,learning_id', 'brand_learnings(brand_id,id) ON DELETE CASCADE']
  ];
  // Use the production relationship query to expose why sum=7 was insufficient:
  // the cardinalities are 0,2,1,1,1,1,1, although the total remains seven.
  const relationshipQuery = verification.slice(verification.indexOf('(SELECT bool_and(matches.n=1)'), verification.indexOf(' AS exact_ownership_relationships,'));
  const aggregateWitness = 'SELECT ' + relationshipQuery.replace('bool_and(matches.n=1)', 'sum(matches.n)=7').replace('count(*)=7 FROM pg_constraint', 'count(*)=EXPECTED_TOTAL FROM pg_constraint') + ' AS old_aggregate_accepts';
  const conflict = (missing, duplicate) => `ALTER TABLE ${missing[0]} DROP CONSTRAINT ${missing[1]}; ALTER TABLE ${duplicate[0]} ADD CONSTRAINT adversarial_duplicate FOREIGN KEY(${duplicate[2]}) REFERENCES ${duplicate[3]};`;
  for (const completed of [false, true]) for (const missing of relationships) {
    const duplicate = relationships[missing[2] === 'brand_id' ? (missing[0] === 'brand_learnings' ? 4 : 0) : (missing[2] === 'proposed_by_identity_id' ? 2 : 1)];
    await test(`State ${completed ? 'B' : 'A'} rejects missing ${missing[1]} compensated by duplicate ${duplicate[1]}`, async () => {
      const pg = await setup();
      try {
        const learning = await insert(pg); await event(pg, learning);
        if (completed) await apply(pg, r1);
        await pg.exec(conflict(missing, duplicate));
        assert.equal((await pg.query(aggregateWitness.replace('EXPECTED_TOTAL', completed ? '7' : '8'))).rows[0].old_aggregate_accepts, true);
        const current = (await pg.query(verification)).rows[0];
        assert.equal(current.exact_ownership_relationships, false);
        assert.equal(current.overall_readiness, 'not_ready');
        const schema = await catalog(pg), before = await rows(pg);
        await assert.rejects(() => apply(pg), /bw36_17r2_partial_or_conflicting_schema/);
        assert.deepEqual(await catalog(pg), schema); assert.deepEqual(await rows(pg), before);
      } finally { await pg.close(); }
    });
  }
  await test('post-DDL missing-plus-duplicate FK drift fails final validation and rolls back schema/rows', async () => {
    const pg = await setup();
    try {
      const learning = await insert(pg); await event(pg, learning);
      const schema = await catalog(pg), before = await rows(pg);
      const tampered = repair.replace('  -- Reinspect the exact final contract', conflict(relationships[2], relationships[1]) + '\n  -- Reinspect the exact final contract');
      await assert.rejects(() => apply(pg, tampered), /bw36_17r2_partial_or_conflicting_schema/);
      assert.deepEqual(await catalog(pg), schema); assert.deepEqual(await rows(pg), before);
      await apply(pg); await readiness(pg);
    } finally { await pg.close(); }
  });
  const oldEvent = `ALTER TABLE brand_learning_events DROP CONSTRAINT brand_learning_events_snapshot_bounded;
    ALTER TABLE brand_learning_events ADD CHECK (${original.split('snapshot jsonb NOT NULL CHECK (')[1].split('),\n  created_at')[0]});`;
  const cases = [
    ['missing one snapshot column', true, `ALTER TABLE brand_learnings DROP COLUMN ${keys[2]}`],
    ['removed FK but old lifecycle', false, 'ALTER TABLE brand_learnings DROP CONSTRAINT brand_learnings_source_board_id_fkey'],
    ['new lifecycle but old event constraint', false, lifecycle],
    ['completed columns/new lifecycle but old event constraint', true, oldEvent],
    ['completed columns but old lifecycle', true, oldLifecycle],
    ['unexpected additional FK', false, 'ALTER TABLE brand_learnings ADD FOREIGN KEY(source_board_id) REFERENCES boards(id)'],
    ['unexpected additional non-source FK', true, 'ALTER TABLE brand_learnings ADD FOREIGN KEY(brand_id) REFERENCES brands(id)'],
    ['weakened RLS', false, 'ALTER TABLE brand_learnings DISABLE ROW LEVEL SECURITY'],
    ['weakened completed RLS', true, 'ALTER TABLE brand_learning_events DISABLE ROW LEVEL SECURITY'],
    ['browser table grant', false, 'GRANT SELECT ON brand_learnings TO authenticated'],
    ['browser column grant', true, 'GRANT UPDATE(statement) ON brand_learnings TO anon'],
    ['PUBLIC column grant', true, 'GRANT SELECT(statement) ON brand_learnings TO PUBLIC'],
    ['browser guard function grant', true, 'GRANT EXECUTE ON FUNCTION guard_brand_learning_lifecycle() TO authenticated'],
    ['PUBLIC guard function grant', false, 'GRANT EXECUTE ON FUNCTION guard_brand_learning_history() TO PUBLIC'],
    ['browser policy', true, 'CREATE POLICY unexpected ON brand_learnings FOR SELECT TO anon USING (true)'],
    ['wrong history trigger type', true, 'DROP TRIGGER brand_learning_no_delete ON brand_learnings; CREATE TRIGGER brand_learning_no_delete AFTER DELETE ON brand_learnings FOR EACH ROW EXECUTE FUNCTION guard_brand_learning_history()'],
    ['conditional lifecycle trigger', true, "DROP TRIGGER brand_learning_lifecycle ON brand_learnings; CREATE TRIGGER brand_learning_lifecycle BEFORE INSERT OR UPDATE ON brand_learnings FOR EACH ROW WHEN (NEW.revision>0) EXECUTE FUNCTION guard_brand_learning_lifecycle()"],
    ['weakened statement bound', false, 'ALTER TABLE brand_learnings DROP CONSTRAINT brand_learnings_statement_check'],
    ['missing duplicate guard', true, 'DROP INDEX brand_learnings_proposal_key'],
    ['unexpected column', false, 'ALTER TABLE brand_learnings ADD COLUMN unexpected text'],
    ['additional event restriction', true, "ALTER TABLE brand_learning_events ADD CHECK (snapshot <> '{}'::jsonb)"],
    ['snapshot default', true, `ALTER TABLE brand_learnings ALTER COLUMN ${keys[0]} SET DEFAULT 'unexpected'`],
    ['security definer lifecycle', true, 'ALTER FUNCTION guard_brand_learning_lifecycle() SECURITY DEFINER'],
    ['wrong Brand target', true, 'ALTER TABLE brand_learnings DROP CONSTRAINT brand_learnings_brand_id_fkey; ALTER TABLE brand_learnings ADD FOREIGN KEY(brand_id) REFERENCES app_identities(id) ON DELETE CASCADE']
  ];
  for (const [name, completed, change] of cases) {
    await test(`partial/conflicting state refuses and rolls back: ${name}`, async () => {
      const pg = await setup();
      try {
        if (completed) await apply(pg, r1);
        await pg.exec(change); const schema = await catalog(pg); const before = await rows(pg);
        await assert.rejects(() => apply(pg), /bw36_17r2_partial_or_conflicting_schema/);
        assert.deepEqual(await catalog(pg), schema); assert.deepEqual(await rows(pg), before);
      } finally { await pg.close(); }
    });
  }
  await test('mid-DDL failure and row rewrite each roll back complete State A correction', async () => {
    const pg = await setup();
    try {
      await insert(pg); const before = await rows(pg); const schema = await catalog(pg);
      for (const [injected, pattern] of [
        ["RAISE EXCEPTION 'invented_failure';", /bw36_17r2_partial_or_conflicting_schema/],
        ["UPDATE public.brand_learnings SET statement='Invented rewrite',revision=revision+1;", /bw36_17r2_preservation_failed/]
      ]) {
        const tampered = repair.replace('  -- Reinspect the exact final contract', injected + '\n  -- Reinspect the exact final contract');
        await assert.rejects(() => apply(pg, tampered), pattern);
        assert.deepEqual(await rows(pg), before); assert.deepEqual(await catalog(pg), schema);
      }
      await apply(pg); await readiness(pg);
    } finally { await pg.close(); }
  });
  await test('corrected Board deletion, immutable provenance, bounded events, Brand cascade and append-only history', async () => {
    const pg = await setup();
    try {
      await apply(pg); const learning = await insert(pg, true);
      const source = { source_board_id: BOARD, source_node_id: NODE, source_board_name_snapshot: 'Invented Board', source_node_title_snapshot: 'Invented node', source_node_type_snapshot: 'content' };
      const snapshot = { statement: 'Invented observation', source_type: 'campaign_observation', ...source };
      await event(pg, learning, snapshot);
      const before = await rows(pg);
      const complete = (await pg.query('SELECT to_jsonb(l)::text data FROM brand_learnings l')).rows;
      await pg.query('DELETE FROM boards WHERE id=$1', [BOARD]);
      assert.deepEqual(await rows(pg), before);
      assert.deepEqual((await pg.query('SELECT to_jsonb(l)::text data FROM brand_learnings l')).rows, complete);
      for (const key of Object.keys(source)) {
        await assert.rejects(() => pg.query(`UPDATE brand_learnings SET ${key}=NULL,revision=revision+1`), /learning_revision_or_ownership/);
      }
      for (const bad of [{ ...snapshot, unknown: 'x' }, { ...snapshot, source_board_id: {} }, { ...snapshot, source_node_title_snapshot: [] },
        { ...snapshot, source_board_name_snapshot: 'x'.repeat(201) }, { ...snapshot, statement: 'x'.repeat(2001) },
        { ...snapshot, evidence_summary: 'x'.repeat(4001) }, { ...snapshot, source_node_type_snapshot: 'x'.repeat(40001) }]) {
        await assert.rejects(() => event(pg, learning, bad), /check constraint/);
      }
      for (const sql of ['UPDATE brand_learning_events SET learning_revision=1', 'DELETE FROM brand_learning_events', 'DELETE FROM brand_learnings', 'TRUNCATE brand_learning_events', 'TRUNCATE brand_learnings CASCADE']) {
        await assert.rejects(() => pg.exec(sql), /learning_history_immutable/);
      }
      await readiness(pg, 'not_ready'); // Synthetic future provenance is deliberately not pre-activation readiness.
      await pg.query('DELETE FROM brands WHERE id=$1', [B]);
      const empty = await readiness(pg); assert.equal(empty.learning_count, 0); assert.equal(empty.event_count, 0);
    } finally { await pg.close(); }
  });
  await test('missing prerequisites refuse with bounded error', async () => {
    const pg = new PGlite();
    try { await assert.rejects(() => apply(pg), /bw36_17r2_partial_or_conflicting_schema/); } finally { await pg.close(); }
  });
  assert.equal(networkCalls, 0);
  console.log(`BW-36.17R2: ${checks} disposable PostgreSQL checks passed; zero production/provider/AI/network requests.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
