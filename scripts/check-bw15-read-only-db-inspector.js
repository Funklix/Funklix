#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const inspector = require('./inspect-production-db-readiness');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'inspect-production-db-readiness.js'), 'utf8');
const runbook = fs.readFileSync(path.join(root, 'docs/runbooks/production-schema-verification.md'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');

function expectedRows() {
  const tables = inspector.ALLOWED_TABLES.map(table_name => ({ table_name, rls_enabled: false, force_rls: false, owner_role: 'runtime_private', current_role_is_owner: true }));
  const columns = [];
  for (const [table, contract] of Object.entries(inspector.EXPECTED_SCHEMA)) for (const [column_name, spec] of Object.entries(contract.columns)) columns.push({ table_name: table, column_name, data_type: spec[0], is_nullable: spec[1] ? 'YES' : 'NO', column_default: spec[2] });
  const constraints = [];
  for (const [table, contract] of Object.entries(inspector.EXPECTED_SCHEMA)) {
    if (contract.primaryKey.length) constraints.push({ table_name: table, constraint_name: `${table}_pkey`, constraint_type: 'p', definition: `PRIMARY KEY (${contract.primaryKey.join(', ')})` });
    contract.unique.forEach((x, i) => constraints.push({ table_name: table, constraint_name: `${table}_unique_${i}`, constraint_type: 'u', definition: `UNIQUE (${x.join(', ')})` }));
    contract.foreignKeys.forEach((x, i) => constraints.push({ table_name: table, constraint_name: `${table}_fk_${i}`, constraint_type: 'f', definition: `FOREIGN KEY (${x.columns.join(', ')}) REFERENCES ${x.targetTable}(${x.targetColumns.join(', ')}) ON DELETE ${x.deleteAction}` }));
    contract.checks.forEach((x, i) => constraints.push({ table_name: table, constraint_name: `${table}_check_${i}`, constraint_type: 'c', definition: `CHECK (${x})` }));
  }
  const indexes = Object.entries(inspector.EXPECTED_SCHEMA).flatMap(([table, contract]) => contract.indexes.map(index => ({ table_name: table, index_name: index.name, definition: 'sanitized fixture' })));
  return { verify_read_only: [{ transaction_read_only: 'on' }], session_metadata: [{ server_version: 'fixture-version', current_schema: 'public', search_path: 'public' }], role_capabilities: [{ current_role: 'runtime_private', rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolbypassrls: false, schema_create: false }], tables, columns, constraints, indexes, grants: [], table_privileges: tables.map(x => ({ table_name: x.table_name, can_select: true, can_insert: true, can_update: true, can_delete: true, can_references: false, can_trigger: false })), policies: [] };
}
function mockClient(rows, failure = {}) {
  const calls = [];
  return { calls, async connect() { calls.push('connect'); }, async query(query) { const id = Object.keys(inspector.QUERY_REGISTRY).find(key => inspector.QUERY_REGISTRY[key].sql === query.text); calls.push(id); if (failure[id]) throw Object.assign(new Error('SECRET raw host db user password'), failure[id]); if (id === 'rollback' && failure.rollback) throw new Error('SECRET rollback'); return { rows: rows[id] || [] }; }, async end() { calls.push('end'); if (failure.end) throw new Error('SECRET close'); } };
}
async function captureMain(args, env, client) {
  let stdout = ''; let stderr = ''; const lifecycle = {};
  const code = await inspector.main(args, env, { createClient: () => client, now: '2026-01-01T00:00:00.000Z', commit: 'fixturecommit', lifecycle, streams: { stdout: { write: x => { stdout += x; } }, stderr: { write: x => { stderr += x; } } } });
  return { code, stdout, stderr, lifecycle };
}

(async () => {
  const help = spawnSync(process.execPath, [path.join(__dirname, 'inspect-production-db-readiness.js'), '--help'], { env: {}, encoding: 'utf8' });
  assert.strictEqual(help.status, 0); assert.match(help.stdout, /acknowledge-read-only/);
  assert.throws(() => inspector.parseArgs(['--sql', 'SELECT 1']), /unknown_flag/);
  assert.deepStrictEqual(inspector.ALLOWED_TABLES, ['brands', 'boards', 'board_editors']);
  inspector.validateRegistry();
  assert(!/\bCOMMIT\b/.test(Object.values(inspector.QUERY_REGISTRY).map(x => x.sql).join('\n')));
  assert.strictEqual(inspector.QUERY_REGISTRY.begin_read_only.sql, 'BEGIN READ ONLY');
  assert(source.includes("current_setting('transaction_read_only')"));
  assert(source.includes('SET LOCAL statement_timeout') && source.includes('SET LOCAL lock_timeout'));
  assert(!/SELECT\s+\*\s+FROM\s+(boards|brands|board_editors)/i.test(source));
  assert(!/count\s*\(/i.test(Object.values(inspector.QUERY_REGISTRY).map(x => x.sql).join('\n')));
  assert.strictEqual(inspector.redactLiterals("owner = 'private-user' AND tenant_id = 728"), "owner = '<redacted>' AND tenant_id = <number>");
  assert(inspector.EXPECTED_SCHEMA.boards.columns.brand_core_source_revision, 'BW-12 provenance contract');
  assert(inspector.EXPECTED_SCHEMA.boards.columns.brand_core_snapshot_backup_created_at, 'BW-13 recovery contract');
  assert.deepStrictEqual(inspector.CLASSIFICATIONS, ['verified', 'missing', 'different', 'unexpected', 'unavailable']);
  assert.deepStrictEqual(inspector.FINAL_STATUSES, ['verified_match', 'verified_drift', 'partial', 'unavailable', 'failed_safe']);

  const never = mockClient(expectedRows());
  const noAck = await captureMain(['--environment', 'production', '--json'], { POSTGRES_URL: 'postgres://secret@private/db' }, never);
  assert.strictEqual(noAck.code, 3); assert.deepStrictEqual(never.calls, []);
  const missing = await captureMain(['--environment', 'production', '--acknowledge-read-only', '--json'], {}, never);
  assert.strictEqual(missing.code, 3); assert.deepStrictEqual(never.calls, []);

  const successClient = mockClient(expectedRows());
  const success = await captureMain(['--environment', 'production', '--acknowledge-read-only', '--json'], { POSTGRES_URL: 'postgres://private-user:private-password@private-host/private-db?sslmode=require' }, successClient);
  assert.strictEqual(success.code, 0); assert.strictEqual(JSON.parse(success.stdout).finalStatus, 'verified_match');
  assert(successClient.calls.includes('rollback') && successClient.calls.at(-1) === 'end');
  assert(!success.stdout.includes('private-host') && !success.stdout.includes('private-user') && !success.stdout.includes('private-db'));

  const driftRows = expectedRows(); driftRows.columns = driftRows.columns.filter(x => !(x.table_name === 'boards' && x.column_name === 'brand_core_source_revision'));
  const drift = await captureMain(['--environment', 'production', '--acknowledge-read-only', '--json', '--strict'], { POSTGRES_URL: 'postgres://u:p@h/db' }, mockClient(driftRows));
  assert.strictEqual(drift.code, 2); assert.strictEqual(JSON.parse(drift.stdout).finalStatus, 'verified_drift');

  const partialClient = mockClient(expectedRows(), { grants: { code: '42501' } });
  const partial = await captureMain(['--environment', 'production', '--acknowledge-read-only', '--json'], { POSTGRES_URL: 'postgres://u:p@h/db' }, partialClient);
  assert.strictEqual(partial.code, 4); assert.strictEqual(JSON.parse(partial.stdout).finalStatus, 'partial'); assert(!partial.stdout.includes('SECRET'));

  const rollbackClient = mockClient(expectedRows(), { columns: { code: 'XX000' }, rollback: true });
  const failed = await captureMain(['--environment', 'production', '--acknowledge-read-only', '--json'], { POSTGRES_URL: 'postgres://u:p@h/db' }, rollbackClient);
  assert.strictEqual(failed.code, 1); assert.strictEqual(JSON.parse(failed.stderr).finalStatus, 'failed_safe'); assert(!failed.stderr.includes('SECRET'));

  const human = inspector.renderHuman(JSON.parse(success.stdout)); assert.match(human, /Status: verified_match/); assert.match(human, /not proof of identity/);
  assert(runbook.includes('results must not be committed') && runbook.includes('Exit codes'));
  assert(workflow.indexOf('check-bw15-read-only-db-inspector.js') > workflow.indexOf('check-bw13-canonical-to-board-refresh.js'));
  assert(!fs.readFileSync(path.join(root, 'api/_boards-storage.js'), 'utf8').includes('inspect-production-db-readiness'));
  assert(!fs.readFileSync(path.join(root, 'vercel.json'), 'utf8').includes('inspect-production-db-readiness'));
  for (let i = 1; i <= 13; i += 1) assert(fs.readdirSync(__dirname).some(name => name.startsWith(`check-bw${i}-`)), `BW-${i} compatibility check missing`);
  assert(fs.existsSync(path.join(root, 'docs/audits/bw14-production-database-authorization-readiness.md')));
  console.log('BW-15 read-only database inspector checks passed (mock match, drift, partial, rollback failure; no database connection).');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
