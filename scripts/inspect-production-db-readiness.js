#!/usr/bin/env node
'use strict';

// BW-15: this module is deliberately not imported by application runtime code.
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const COMMAND_VERSION = 'BW-15.1';
const ALLOWED_TABLES = Object.freeze(['brands', 'boards', 'board_editors']);
const ALLOWED_SCHEMA = 'public';
const FINAL_STATUSES = Object.freeze(['verified_match', 'verified_drift', 'partial', 'unavailable', 'failed_safe']);
const CLASSIFICATIONS = Object.freeze(['verified', 'missing', 'different', 'unexpected', 'unavailable']);
const EXIT_CODES = Object.freeze({ ok: 0, failedSafe: 1, strictDrift: 2, invocation: 3, partial: 4 });

const EXPECTED_SCHEMA = Object.freeze({
  brands: {
    columns: {
      id: ['uuid', false, 'gen_random_uuid()'], owner_email: ['text', false, null], name: ['text', false, null],
      brand_core: ['jsonb', false, "'{}'::jsonb"], revision: ['bigint', false, '1'],
      created_at: ['timestamp with time zone', false, 'now()'], updated_at: ['timestamp with time zone', false, 'now()']
    },
    primaryKey: ['id'], unique: [], foreignKeys: [],
    checks: ['owner_email = lower(owner_email)', 'length(btrim(name)) >= 1 AND length(btrim(name)) <= 160', "jsonb_typeof(brand_core) = 'object'::text", 'revision >= 1'],
    indexes: [{ name: 'brands_owner_email_idx', unique: false, columns: ['owner_email'], predicate: null }]
  },
  boards: {
    columns: {
      id: ['uuid', false, 'gen_random_uuid()'], name: ['text', false, null], canvas_json: ['jsonb', false, null],
      brand_core_snapshot: ['jsonb', true, null], order_index: ['integer', true, null],
      created_at: ['timestamp with time zone', false, 'now()'], updated_at: ['timestamp with time zone', false, 'now()'],
      owner_id: ['text', true, null], owner_email: ['text', true, null], owner_name: ['text', true, null], owner_avatar: ['text', true, null],
      created_by: ['text', true, null], brand_id: ['uuid', true, null],
      brand_core_source_revision: ['bigint', true, null], brand_core_source_updated_at: ['timestamp with time zone', true, null],
      brand_core_snapshot_copied_at: ['timestamp with time zone', true, null], brand_core_snapshot_backup: ['jsonb', true, null],
      brand_core_backup_source_revision: ['bigint', true, null], brand_core_backup_source_updated_at: ['timestamp with time zone', true, null],
      brand_core_backup_snapshot_copied_at: ['timestamp with time zone', true, null],
      brand_core_snapshot_backup_created_at: ['timestamp with time zone', true, null]
    },
    primaryKey: ['id'], unique: [],
    foreignKeys: [{ columns: ['brand_id'], targetTable: 'brands', targetColumns: ['id'], deleteAction: 'SET NULL' }],
    checks: ['brand_core_source_revision IS NULL OR brand_core_source_revision > 0', 'brand_core_backup_source_revision IS NULL OR brand_core_backup_source_revision > 0'],
    indexes: [{ name: 'boards_brand_id_idx', unique: false, columns: ['brand_id'], predicate: null }]
  },
  board_editors: {
    columns: {
      board_id: ['uuid', false, null], email: ['text', false, null], role: ['text', false, "'editor'::text"],
      created_at: ['timestamp with time zone', false, 'now()'], created_by: ['text', true, null], name: ['text', true, null], avatar: ['text', true, null]
    },
    primaryKey: [], unique: [],
    foreignKeys: [{ columns: ['board_id'], targetTable: 'boards', targetColumns: ['id'], deleteAction: 'CASCADE' }],
    checks: ['email = lower(email)', "role = 'editor'::text"],
    indexes: [
      { name: 'board_editors_board_email_uidx', unique: true, columns: ['board_id', 'email'], predicate: null },
      { name: 'board_editors_email_idx', unique: false, columns: ['email'], predicate: null },
      { name: 'board_editors_board_id_idx', unique: false, columns: ['board_id'], predicate: null }
    ]
  }
});

const simple = rows => rows.map(row => ({ ...row }));
const QUERY_REGISTRY = Object.freeze({
  begin_read_only: { sql: 'BEGIN READ ONLY', params: () => [], sanitize: simple, control: true },
  set_statement_timeout: { sql: "SET LOCAL statement_timeout = '8s'", params: () => [], sanitize: simple, control: true },
  set_lock_timeout: { sql: "SET LOCAL lock_timeout = '2s'", params: () => [], sanitize: simple, control: true },
  verify_read_only: { sql: "SELECT current_setting('transaction_read_only') AS transaction_read_only", params: () => [], sanitize: simple },
  session_metadata: { sql: "SELECT current_setting('server_version') AS server_version, current_schema() AS current_schema, current_setting('search_path') AS search_path", params: () => [], sanitize: simple },
  role_capabilities: { sql: "SELECT r.rolname AS current_role, r.rolsuper, r.rolinherit, r.rolcreaterole, r.rolcreatedb, r.rolcanlogin, r.rolreplication, r.rolbypassrls, has_schema_privilege(r.rolname, $1, 'CREATE') AS schema_create FROM pg_catalog.pg_roles r WHERE r.rolname = current_user", params: () => [ALLOWED_SCHEMA], sanitize: simple },
  tables: { sql: 'SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls, owner.rolname AS owner_role, owner.rolname = current_user AS current_role_is_owner FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_roles owner ON owner.oid = c.relowner WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) AND c.relkind IN ($3, $4) ORDER BY c.relname', params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES, 'r', 'p'], sanitize: simple },
  columns: { sql: 'SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = $1 AND table_name = ANY($2::text[]) ORDER BY table_name, ordinal_position', params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES], sanitize: simple },
  constraints: { sql: "SELECT rel.relname AS table_name, con.conname AS constraint_name, con.contype AS constraint_type, pg_get_constraintdef(con.oid, true) AS definition, target.relname AS target_table, con.confdeltype AS delete_action FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace LEFT JOIN pg_catalog.pg_class target ON target.oid = con.confrelid WHERE n.nspname = $1 AND rel.relname = ANY($2::text[]) AND con.contype = ANY($3::char[]) ORDER BY rel.relname, con.contype, con.conname", params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES, ['p', 'u', 'f', 'c']], sanitize: simple },
  indexes: { sql: 'SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition FROM pg_catalog.pg_indexes WHERE schemaname = $1 AND tablename = ANY($2::text[]) ORDER BY tablename, indexname', params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES], sanitize: simple },
  grants: { sql: 'SELECT table_name, grantee, privilege_type, is_grantable FROM information_schema.role_table_grants WHERE table_schema = $1 AND table_name = ANY($2::text[]) ORDER BY table_name, grantee, privilege_type', params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES], sanitize: simple },
  table_privileges: { sql: "SELECT c.relname AS table_name, has_table_privilege(current_user, c.oid, 'SELECT') AS can_select, has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert, has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update, has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete, has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_references, has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) ORDER BY c.relname", params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES], sanitize: simple },
  policies: { sql: 'SELECT tablename AS table_name, policyname AS policy_name, permissive, roles, cmd, qual, with_check FROM pg_catalog.pg_policies WHERE schemaname = $1 AND tablename = ANY($2::text[]) ORDER BY tablename, policyname', params: () => [ALLOWED_SCHEMA, ALLOWED_TABLES], sanitize: simple },
  rollback: { sql: 'ROLLBACK', params: () => [], sanitize: simple, control: true }
});

function validateRegistry() {
  const allowedStarts = /^(SELECT|WITH|SHOW|BEGIN READ ONLY|SET LOCAL|ROLLBACK)\b/i;
  const forbidden = /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT|COPY|CALL|DO|VACUUM|ANALYZE|REFRESH|REINDEX|CLUSTER|LOCK\s+TABLE|SET\s+ROLE|COMMIT)\b/i;
  for (const [id, entry] of Object.entries(QUERY_REGISTRY)) {
    const structuralSql = typeof entry.sql === 'string' ? entry.sql.replace(/'(?:''|[^'])*'/g, "''") : '';
    if (!/^[a-z][a-z0-9_]*$/.test(id) || typeof entry.sql !== 'string' || typeof entry.params !== 'function' || typeof entry.sanitize !== 'function' || !allowedStarts.test(entry.sql.trim()) || forbidden.test(structuralSql) || entry.sql.includes(';')) throw new Error('unsafe_query_registry');
  }
}
validateRegistry();

function parseArgs(argv) {
  const options = { json: false, pretty: false, strict: false, acknowledge: false, help: false, environment: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') options.help = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--acknowledge-read-only') options.acknowledge = true;
    else if (arg === '--environment') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw invocationError('missing_environment_label');
      options.environment = argv[++i];
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(options.environment)) throw invocationError('invalid_environment_label');
    } else throw invocationError('unknown_flag');
  }
  return options;
}
function invocationError(classification) { const error = new Error(classification); error.safeClassification = classification; return error; }
function helpText() { return `BW-15 sanitized read-only database readiness inspector\n\nUsage:\n  node scripts/inspect-production-db-readiness.js --environment <label> --acknowledge-read-only [--json] [--pretty] [--strict]\n\n--environment is a non-secret label and does not prove database identity.\n--acknowledge-read-only is required before connecting. No SQL, table, schema, or output-file argument is accepted.\nExit codes: 0 match/non-strict drift; 1 failed-safe; 2 strict drift; 3 invocation; 4 partial.\n`; }

function fingerprint(urlText) {
  const parsed = new URL(urlText);
  if (!/^postgres(ql)?:$/.test(parsed.protocol) || !parsed.hostname || !parsed.pathname || parsed.pathname === '/') throw invocationError('malformed_connection_url');
  const normalized = [parsed.protocol.toLowerCase(), parsed.hostname.toLowerCase(), parsed.port || '5432', parsed.pathname, decodeURIComponent(parsed.username || '')].join('|');
  return `sha256:${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}
function redactLiterals(value) {
  if (value == null) return null;
  return String(value).replace(/'(?:''|[^'])*'/g, "'<redacted>'").replace(/\b\d+(?:\.\d+)?\b/g, '<number>');
}
function normalize(value) { return value == null ? null : String(value).replace(/[()"\s]+/g, ' ').trim().toLowerCase(); }
function roleMapper() {
  const values = new Map();
  return role => { if (!values.has(role)) values.set(role, `role_${values.size + 1}`); return values.get(role); };
}
function safeCommit() { try { return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } }
function safeError(error, stage, queryId, rollbackSucceeded, connectionClosed) {
  return { stage, classification: error?.safeClassification || classifyPgError(error), sqlstate: /^[0-9A-Z]{5}$/.test(error?.code || '') ? error.code : null, queryRegistryId: queryId || null, rollbackSucceeded, connectionClosed };
}
function classifyPgError(error) {
  if (error?.code === '42501') return 'metadata_permission_denied';
  if (error?.code === '57014') return 'statement_timeout';
  if (['28P01', '28000'].includes(error?.code)) return 'authentication_failed';
  if (String(error?.code || '').startsWith('08')) return 'connection_failed';
  return 'operational_failure';
}
async function execute(client, id) {
  const entry = QUERY_REGISTRY[id];
  if (!entry) throw Object.assign(new Error('unknown_registry_id'), { safeClassification: 'unknown_registry_id' });
  const result = await client.query({ text: entry.sql, values: entry.params() });
  if (!result || !Array.isArray(result.rows)) throw Object.assign(new Error('shape'), { safeClassification: 'unexpected_metadata_shape' });
  return entry.sanitize(result.rows);
}

function compare(actual) {
  const output = {};
  let drift = false;
  for (const table of ALLOWED_TABLES) {
    const expected = EXPECTED_SCHEMA[table];
    const exists = actual.tables.some(row => row.table_name === table);
    const columns = [];
    for (const [name, spec] of Object.entries(expected.columns)) {
      const row = actual.columns.find(item => item.table_name === table && item.column_name === name);
      let classification = 'verified';
      if (!exists || !row) classification = 'missing';
      else if (normalize(row.data_type) !== normalize(spec[0]) || (row.is_nullable === 'YES') !== spec[1] || normalize(row.column_default) !== normalize(spec[2])) classification = 'different';
      if (classification !== 'verified') drift = true;
      columns.push({ name, expected: { type: spec[0], nullable: spec[1], default: redactLiterals(spec[2]) }, observed: row ? { type: row.data_type, nullable: row.is_nullable === 'YES', default: redactLiterals(row.column_default) } : null, classification });
    }
    for (const row of actual.columns.filter(item => item.table_name === table && !expected.columns[item.column_name])) { columns.push({ name: row.column_name, expected: null, observed: { type: row.data_type, nullable: row.is_nullable === 'YES', default: redactLiterals(row.column_default) }, classification: 'unexpected' }); drift = true; }
    const constraintRows = actual.constraints.filter(row => row.table_name === table);
    const constraints = [];
    const expectedConstraintDefs = [expected.primaryKey.length ? `PRIMARY KEY (${expected.primaryKey.join(', ')})` : null, ...expected.unique.map(x => `UNIQUE (${x.join(', ')})`), ...expected.foreignKeys.map(x => `FOREIGN KEY (${x.columns.join(', ')}) REFERENCES ${x.targetTable}(${x.targetColumns.join(', ')}) ON DELETE ${x.deleteAction}`), ...expected.checks.map(x => `CHECK (${x})`)].filter(Boolean);
    for (const definition of expectedConstraintDefs) {
      const hit = constraintRows.find(row => normalize(row.definition) === normalize(definition));
      const classification = hit ? 'verified' : 'missing'; if (!hit) drift = true;
      constraints.push({ definition: redactLiterals(definition), classification });
    }
    for (const row of constraintRows.filter(row => !expectedConstraintDefs.some(def => normalize(def) === normalize(row.definition)))) { constraints.push({ definition: redactLiterals(row.definition), classification: 'unexpected' }); drift = true; }
    const indexRows = actual.indexes.filter(row => row.table_name === table);
    const indexes = expected.indexes.map(item => { const hit = indexRows.find(row => row.index_name === item.name); if (!hit) drift = true; return { name: item.name, classification: hit ? 'verified' : 'missing' }; });
    for (const row of indexRows.filter(row => !expected.indexes.some(item => item.name === row.index_name) && !String(row.index_name).endsWith('_pkey'))) { indexes.push({ name: row.index_name, classification: 'unexpected' }); drift = true; }
    output[table] = { existence: exists ? 'verified' : 'missing', columns, constraints, indexes };
    if (!exists) drift = true;
  }
  return { tables: output, drift };
}

function buildReport(raw, context) {
  const mapRole = roleMapper();
  const comparison = compare(raw);
  const role = raw.role_capabilities[0] || {};
  const tables = raw.tables.map(row => ({ table: row.table_name, owner: mapRole(row.owner_role), currentRoleIsOwner: !!row.current_role_is_owner, rlsEnabled: !!row.rls_enabled, forceRlsEnabled: !!row.force_rls }));
  const grants = raw.grants.map(row => ({ table: row.table_name, grantee: mapRole(row.grantee), privilege: row.privilege_type, grantable: row.is_grantable === 'YES' }));
  const policies = raw.policies.map(row => ({ table: row.table_name, name: row.policy_name, permissive: String(row.permissive).toUpperCase() === 'PERMISSIVE', command: row.cmd, roles: (row.roles || []).map(mapRole), using: redactLiterals(row.qual), withCheck: redactLiterals(row.with_check) }));
  const currentRole = mapRole(role.current_role);
  const capabilities = { currentRole, superuser: !!role.rolsuper, bypassRls: !!role.rolbypassrls, createRoles: !!role.rolcreaterole, createDatabases: !!role.rolcreatedb, schemaCreate: !!role.schema_create, source: 'metadata indicates capability; no operation was tested', tables: raw.table_privileges.map(row => ({ table: row.table_name, select: !!row.can_select, insert: !!row.can_insert, update: !!row.can_update, delete: !!row.can_delete, references: !!row.can_references, trigger: !!row.can_trigger })) };
  return { commandVersion: COMMAND_VERSION, inspectionTimestamp: context.timestamp, environmentLabel: context.environment, repositoryCommit: context.commit, connectionFingerprint: context.fingerprint, fingerprintMeaning: 'same configured target only; not proof of production identity or data correctness', transactionReadOnlyConfirmed: true, postgresVersion: raw.session_metadata[0]?.server_version || null, session: { currentSchema: raw.session_metadata[0]?.current_schema === ALLOWED_SCHEMA ? ALLOWED_SCHEMA : 'other', searchPath: String(raw.session_metadata[0]?.search_path || '').split(',').map(x => x.trim() === ALLOWED_SCHEMA ? ALLOWED_SCHEMA : '<redacted>') }, inspectedTables: ALLOWED_TABLES, schemaComparison: comparison.tables, constraints: Object.fromEntries(ALLOWED_TABLES.map(t => [t, comparison.tables[t].constraints])), indexes: Object.fromEntries(ALLOWED_TABLES.map(t => [t, comparison.tables[t].indexes])), ownership: tables, grants, rls: tables.map(t => ({ table: t.table, enabled: t.rlsEnabled, forced: t.forceRlsEnabled, policyCount: policies.filter(p => p.table === t.table).length, currentRoleOwnsTable: t.currentRoleIsOwner, currentRoleSuperuser: capabilities.superuser, currentRoleBypassesRls: capabilities.bypassRls, currentRoleOrdinarilySubject: !capabilities.superuser && !capabilities.bypassRls && !t.currentRoleIsOwner })).map(t => ({ ...t, policies: policies.filter(p => p.table === t.table) })), currentRoleCapabilities: capabilities, runtimeDdlCapability: { schemaCreate: capabilities.schemaCreate, alterRelevantOwnership: tables.filter(t => t.currentRoleIsOwner).map(t => t.table), operationTested: false }, unknowns: ['environment label does not prove target identity', 'backup/PITR and deployed application commit are outside this metadata inspection'], warnings: [], finalStatus: comparison.drift ? 'verified_drift' : 'verified_match' };
}

async function inspect(options, dependencies = {}) {
  const connectionString = dependencies.connectionString;
  const createClient = dependencies.createClient || (() => { const { Client } = require('pg'); return new Client({ connectionString, connectionTimeoutMillis: 5000 }); });
  let client; let connected = false; let transactionStarted = false; let rollbackSucceeded = false; let connectionClosed = false; let stage = 'connection'; let queryId = null; let outcome;
  try {
    client = createClient(); await client.connect(); connected = true;
    queryId = 'begin_read_only'; stage = 'read_only_transaction'; await execute(client, queryId); transactionStarted = true;
    for (const id of ['set_statement_timeout', 'set_lock_timeout']) { queryId = id; stage = 'timeouts'; await execute(client, id); }
    queryId = 'verify_read_only'; stage = 'read_only_confirmation'; const confirmation = await execute(client, queryId);
    if (confirmation[0]?.transaction_read_only !== 'on') throw Object.assign(new Error('not readonly'), { safeClassification: 'read_only_unconfirmed' });
    const raw = {};
    for (const id of ['session_metadata', 'role_capabilities', 'tables', 'columns', 'constraints', 'indexes', 'grants', 'table_privileges', 'policies']) { queryId = id; stage = 'metadata'; raw[id] = await execute(client, id); }
    queryId = 'rollback'; stage = 'rollback'; await execute(client, queryId); rollbackSucceeded = true; transactionStarted = false;
    outcome = { report: buildReport(raw, { timestamp: dependencies.now || new Date().toISOString(), environment: options.environment, commit: dependencies.commit === undefined ? safeCommit() : dependencies.commit, fingerprint: dependencies.fingerprint }), error: null };
  } catch (error) {
    if (transactionStarted && client) { try { await execute(client, 'rollback'); rollbackSucceeded = true; } catch { rollbackSucceeded = false; } }
    outcome = { report: null, error: safeError(error, stage, queryId, rollbackSucceeded, false) };
  } finally {
    if (connected && client) { try { await client.end(); connectionClosed = true; } catch { connectionClosed = false; } }
    if (dependencies.lifecycle) Object.assign(dependencies.lifecycle, { rollbackSucceeded, connectionClosed });
  }
  if (connected && !connectionClosed) return { report: null, error: { stage: 'close', classification: 'close_failed', sqlstate: null, queryRegistryId: null, rollbackSucceeded, connectionClosed: false } };
  if (outcome.error) outcome.error.connectionClosed = connectionClosed;
  return outcome;
}

function failureReport(options, error, fingerprintValue) { return { commandVersion: COMMAND_VERSION, inspectionTimestamp: new Date().toISOString(), environmentLabel: options?.environment || null, repositoryCommit: safeCommit(), connectionFingerprint: fingerprintValue || null, transactionReadOnlyConfirmed: false, inspectedTables: ALLOWED_TABLES, schemaComparison: {}, constraints: {}, indexes: {}, ownership: [], grants: [], rls: [], currentRoleCapabilities: null, runtimeDdlCapability: null, unknowns: ['metadata inspection did not complete'], warnings: [], error, finalStatus: error?.classification === 'metadata_permission_denied' ? 'partial' : 'failed_safe' }; }
function renderHuman(report) { return [`BW-15 read-only database readiness inspection`, `Status: ${report.finalStatus}`, `Environment label: ${report.environmentLabel || 'unavailable'} (not proof of identity)`, `Configured-target fingerprint: ${report.connectionFingerprint || 'unavailable'}`, `Transaction read-only confirmed: ${report.transactionReadOnlyConfirmed}`, `PostgreSQL version: ${report.postgresVersion || 'unavailable'}`, `Allowlisted tables: ${report.inspectedTables.join(', ')}`, `Schema comparison: ${JSON.stringify(report.schemaComparison)}`, `Ownership/grants/RLS: ${JSON.stringify({ ownership: report.ownership, grants: report.grants, rls: report.rls })}`, `Capabilities: ${JSON.stringify(report.currentRoleCapabilities)}`, `Unknowns: ${report.unknowns.join('; ')}`].join('\n'); }
function emit(report, options, streams = { stdout: process.stdout, stderr: process.stderr }) { const value = options.json ? JSON.stringify(report, null, options.pretty ? 2 : 0) : renderHuman(report); (report.finalStatus === 'failed_safe' || report.finalStatus === 'unavailable' ? streams.stderr : streams.stdout).write(`${value}\n`); }

async function main(argv = process.argv.slice(2), env = process.env, dependencies = {}) {
  let options;
  try { options = parseArgs(argv); } catch (error) { const report = failureReport({}, safeError(error, 'invocation', null, false, true)); emit(report, { json: argv.includes('--json'), pretty: argv.includes('--pretty') }, dependencies.streams); return EXIT_CODES.invocation; }
  if (options.help) { process.stdout.write(helpText()); return EXIT_CODES.ok; }
  if (!options.acknowledge) { emit(failureReport(options, { stage: 'invocation', classification: 'acknowledgement_required', sqlstate: null, queryRegistryId: null, rollbackSucceeded: false, connectionClosed: true }), options, dependencies.streams); return EXIT_CODES.invocation; }
  if (!options.environment) { emit(failureReport(options, { stage: 'invocation', classification: 'environment_label_required', sqlstate: null, queryRegistryId: null, rollbackSucceeded: false, connectionClosed: true }), options, dependencies.streams); return EXIT_CODES.invocation; }
  if (!env.POSTGRES_URL) { emit(failureReport(options, { stage: 'configuration', classification: 'postgres_url_missing', sqlstate: null, queryRegistryId: null, rollbackSucceeded: false, connectionClosed: true }), options, dependencies.streams); return EXIT_CODES.invocation; }
  let fingerprintValue;
  try { fingerprintValue = fingerprint(env.POSTGRES_URL); } catch (error) { emit(failureReport(options, safeError(error, 'configuration', null, false, true)), options, dependencies.streams); return EXIT_CODES.invocation; }
  const result = await inspect(options, { ...dependencies, connectionString: env.POSTGRES_URL, fingerprint: fingerprintValue });
  const report = result.report || failureReport(options, { ...result.error, connectionClosed: dependencies.lifecycle?.connectionClosed ?? result.error.connectionClosed }, fingerprintValue);
  emit(report, options, dependencies.streams);
  if (report.finalStatus === 'partial') return EXIT_CODES.partial;
  if (report.finalStatus === 'failed_safe' || report.finalStatus === 'unavailable') return EXIT_CODES.failedSafe;
  if (report.finalStatus === 'verified_drift' && options.strict) return EXIT_CODES.strictDrift;
  return EXIT_CODES.ok;
}

module.exports = { ALLOWED_TABLES, CLASSIFICATIONS, COMMAND_VERSION, EXIT_CODES, EXPECTED_SCHEMA, FINAL_STATUSES, QUERY_REGISTRY, buildReport, compare, execute, fingerprint, helpText, inspect, main, parseArgs, redactLiterals, renderHuman, validateRegistry };
if (require.main === module) main().then(code => { process.exitCode = code; });
