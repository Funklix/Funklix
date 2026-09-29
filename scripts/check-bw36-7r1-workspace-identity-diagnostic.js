'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const relativeSql = 'scripts/sql/bw36-7r1-workspace-identity-diagnostic.sql';
const sql = fs.readFileSync(path.join(root, relativeSql), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/implementation/2026-09-29-bw36-7r1-workspace-identity-diagnostic.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');

function executableSql(source) {
  let output = '';
  let state = 'code';
  let dollarTag = '';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const pair = source.slice(index, index + 2);
    if (state === 'line-comment') {
      if (char === '\n') { state = 'code'; output += '\n'; }
      continue;
    }
    if (state === 'block-comment') {
      if (pair === '*/') { state = 'code'; index += 1; }
      continue;
    }
    if (state === 'single' || state === 'escaped-single') {
      if (state === 'escaped-single' && char === '\\') { index += 1; continue; }
      if (char === "'" && source[index + 1] === "'") { index += 1; continue; }
      if (char === "'") state = 'code';
      output += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (state === 'identifier') {
      if (char === '"' && source[index + 1] === '"') { index += 1; continue; }
      if (char === '"') state = 'code';
      output += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (state === 'dollar') {
      if (source.startsWith(dollarTag, index)) {
        output += ' '.repeat(dollarTag.length);
        index += dollarTag.length - 1;
        state = 'code';
      } else output += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (pair === '--') { state = 'line-comment'; output += '  '; index += 1; continue; }
    if (pair === '/*') { state = 'block-comment'; output += '  '; index += 1; continue; }
    const dollar = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
    if (dollar) { state = 'dollar'; dollarTag = dollar; output += ' '.repeat(dollar.length); index += dollar.length - 1; continue; }
    if ((char === 'E' || char === 'e') && source[index + 1] === "'") {
      state = 'escaped-single'; output += '  '; index += 1; continue;
    }
    if (char === "'") { state = 'single'; output += ' '; continue; }
    if (char === '"') { state = 'identifier'; output += ' '; continue; }
    output += char;
  }
  assert.ok(['code', 'line-comment'].includes(state), `unterminated SQL ${state}`);
  return output;
}

function statements(source) {
  return executableSql(source).split(';').map((part) => part.trim()).filter(Boolean);
}

function digest(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

const executable = executableSql(sql);
const parsed = statements(sql);
const finalProjection = /SELECT\s+category\s*,\s*check_name\s*,\s*status\s*,\s*record_count\s*,\s*notes\s+FROM\s+checks\s+ORDER\s+BY\s+sort_group\s*,\s*sort_item\s*,\s*check_name\s*$/i;
let passed = 0;
function test(name, callback) { callback(); passed += 1; process.stdout.write(`✓ ${name}\n`); }

test('scanner removes comments, literals, escaped strings, identifiers and dollar strings', () => {
  const fixture = `-- DELETE\nWITH "UPDATE" AS (SELECT 'INSERT', E'DROP\\'x', $$ALTER$$, $tag$GRANT$tag$) SELECT 1;`;
  const scanned = executableSql(fixture);
  for (const hidden of ['DELETE','UPDATE','INSERT','DROP','ALTER','GRANT']) assert.doesNotMatch(scanned, new RegExp(`\\b${hidden}\\b`));
  assert.match(scanned, /\bWITH\b[\s\S]*\bSELECT\b/i);
  assert.match(executableSql('WITH x AS (SELECT 1) DELETE FROM x'), /\bDELETE\b/);
});

test('diagnostic is exactly one read-only CTE and final SELECT statement', () => {
  assert.equal(parsed.length, 1);
  assert.match(parsed[0], /^WITH\b/i);
  assert.match(parsed[0], finalProjection);
});

test('all mutation, DDL, privilege, procedural, transaction, temporary and remote operations are rejected', () => {
  const forbidden = ['INSERT','UPDATE','DELETE','MERGE','UPSERT','CREATE','ALTER','DROP','TRUNCATE','GRANT','REVOKE','CALL','DO','EXECUTE','COPY','BEGIN','COMMIT','ROLLBACK','SAVEPOINT','VACUUM','ANALYZE','LOCK','SET','RESET','PREPARE','DEALLOCATE','LISTEN','NOTIFY','LOAD','IMPORT','TEMP','TEMPORARY','FUNCTION','PROCEDURE','TRIGGER','POLICY','DATABASE','EXTENSION','FDW','DBLINK'];
  for (const keyword of forbidden) assert.doesNotMatch(executable, new RegExp(`\\b${keyword}\\b`, 'i'), keyword);
  assert.doesNotMatch(sql, /https?:\/\/|postgres_fdw|foreign\s+data\s+wrapper|openai|anthropic|fetch\s*\(|axios/i);
});

test('five-column output is bounded and cannot project raw identity or payload fields', () => {
  const final = parsed[0].match(/SELECT\s+category[\s\S]*$/i)?.[0];
  assert.ok(final);
  assert.match(final, finalProjection);
  assert.doesNotMatch(final, /\b(?:id|uuid|email|token|name|content|snapshot|caption|prompt|metadata|json|provider|subject|payload|hash|avatar)\b/i);
  assert.doesNotMatch(sql, /SELECT\s+[^;]*(?:public_view_token_hash|canvas_json|brand_core_snapshot\s+AS|owner_name\s+AS|owner_avatar\s+AS)/i);
  assert.ok(sql.includes('public_view_enabled'));
  assert.doesNotMatch(sql, /public_view_token_hash/);
});

test('status vocabulary and deterministic ordering are fixed', () => {
  assert.match(executable, /ORDER\s+BY\s+sort_group\s*,\s*sort_item\s*,\s*check_name/i);
  const statuses = [...sql.matchAll(/(?:THEN|ELSE)\s+'(ok|info|review|blocked)'|,\s*'(ok|info|review|blocked)'\s*,/gi)]
    .flatMap((match) => match.slice(1).filter(Boolean));
  assert.deepEqual([...new Set(statuses)].sort(), ['blocked','info','ok','review']);
});

test('all identity schema checks and repository authorities are explicit', () => {
  for (const token of ['brand_owner_column','brand_member_identity_column','board_owner_email_column','board_owner_id_column','board_share_identity_column','application_identity_authority','assumed_auth_relation_exists','assumed_auth_relation_accessible','brand_member_unique_authority','board_share_unique_authority','unexpected_nullable_authority_columns']) assert.ok(sql.includes(token), token);
  assert.ok(sql.includes("signed Google session"));
  assert.ok(sql.includes("does not persist an application user/profile table"));
});

test('each relationship has every required stored-shape aggregate', () => {
  for (const relation of ['brand_owner','brand_member','board_owner','board_share']) assert.ok(sql.includes(`'${relation}'::text AS relation_type`), relation);
  for (const suffix of ['_total','_nonempty','_empty_or_null','_email_shaped','_uuid_shaped','_unsupported_shape','_normalized_duplicate_records','_distinct_normalized']) assert.ok(sql.includes(`relation_type||'${suffix}'`), suffix);
});

test('every supported resolution path is separately counted', () => {
  for (const token of ['_exact_canonical_match','_normalized_case_match','_uuid_match','_application_session_match','_assumed_auth_email_match','_ambiguous_multiple_matches','_genuinely_unresolved','_competing_paths','_application_only_email']) assert.ok(sql.includes(token), token);
  assert.doesNotMatch(sql, /display_name|raw_user_meta_data|user_metadata|provider_subject/i);
});

test('relationship semantics preserve Brand, Board-only and public isolation', () => {
  for (const token of ['primary_brand_owners','brand_admins','brand_editors','brand_viewers','primary_board_owners','board_editors','board_viewers','board_only_collaborators','collaborators_with_brand_access','public_token_boards','workspace_owner_membership_candidates','minimal_workspace_visibility_candidates','must_remain_board_only','must_never_create_catalog_access']) assert.ok(sql.includes(token), token);
  assert.ok(sql.includes('must not become Workspace membership or Brand access'));
  assert.ok(sql.includes('anonymous public access never imply catalog access'));
});

test('blocker reconstruction is explicit, typed, deduplicated and non-naive', () => {
  for (const token of ['brand_owner_blockers','board_owner_blockers','brand_member_blockers','board_editor_share_blockers','missing_brand_association_blockers','ambiguous_identity_blockers','genuine_ownerless_record_blockers','review_only_incorrectly_included','overlapping_component_records','raw_blocker_component_sum','typed_unique_old_blocking_records','unique_blocking_records']) assert.ok(sql.includes(token), token);
  assert.match(sql, /SELECT\s+relation_type\s+AS\s+kind\s*,\s*entity_key[\s\S]*?UNION[\s\S]*?actual_blockers/i);
  assert.ok(sql.includes('Arithmetic component sum only; it is not asserted to be a disjoint record population.'));
  assert.doesNotMatch(sql, /raw_sum[^\n]*AS actual_unique/i);
});

test('all derived conclusion states and evidence-only readiness are supported', () => {
  for (const token of ['identity_model_confirmed','preflight_join_defect','production_identity_anomalies','mixed_identity_state','schema_parity_blocked','diagnostic_readiness']) assert.ok(sql.includes(token), token);
  assert.match(sql, /CASE WHEN auth_access[\s\S]*preflight_join_defect/i);
  assert.ok(sql.includes('never a backfill'));
});

test('no migration exists and protected BW-36.6, BW-36.7, BW-36.4/runtime files are byte-identical', () => {
  assert.ok(relativeSql.startsWith('scripts/sql/'));
  assert.deepEqual(fs.readdirSync(path.join(root, 'migrations')).sort(), [
    '20260911_bw33_5_supabase_rls_hardening.rollback.sql',
    '20260911_bw33_5_supabase_rls_hardening.sql',
    '20260914_bw33_5_1_social_publishing_destinations_rls.rollback.sql',
    '20260914_bw33_5_1_social_publishing_destinations_rls.sql',
    '20260914_bw33_5_1_social_publishing_destinations_rls.verify.sql',
    '20260928_bw36_6_workspace_schema_foundation.sql'
  ]);
  const baselines = {
    'migrations/20260928_bw36_6_workspace_schema_foundation.sql': 'd7832add0dd280a05a420fad42c90b81929dae5e72eae9ccc5a7377b1d49a35c',
    'scripts/sql/bw36-7-workspace-backfill-preflight.sql': '617b23351d89a99966d7aa86c98bfd0dde0a02e7e94f90b2716c2b41baabd234',
    'brand-sidebar.js': '1c9dc05ca3dea04cd7a78538db3b958e35ade0441184a8234a456d4ce2bb22f0',
    'scripts/check-bw36-4-simplified-brand-sidebar.js': '2d8cfe6e01c8e604bde5aff70c02872eb4c7ad2797c0082400ceeb3dcf7129a5',
    'app.js': '1814a8cf8b939399812787a405e5c74d51fe532c501af03f8e77f1e7a50c1756',
    'api/_auth-session.js': '2ee41ebe695a761c9aa05cc1c9a0df1a0dc81649f9150a6a083b6139c3e26e28',
    'api/_brand-access.js': '8f146c7b6fe07d4bb99a249ea24b14e801132c9ead1c617b7eb63b6bdbd9b95e',
    'api/_board-access.js': '84620c66037f2ff039c414032056b3e452f09e524cf481efa68c865cee59daef'
  };
  for (const [file, expected] of Object.entries(baselines)) assert.equal(digest(file), expected, file);
});

test('package and Runtime Boot Safety register R1 immediately after BW-36.7', () => {
  assert.equal(pkg.scripts['check:bw36.7r1'], 'node scripts/check-bw36-7r1-workspace-identity-diagnostic.js');
  const packageKeys = Object.keys(pkg.scripts);
  assert.equal(packageKeys.indexOf('check:bw36.7r1'), packageKeys.indexOf('check:bw36.7') + 1);
  assert.match(workflow, /Check BW-36\.7 Workspace backfill preflight[\s\S]*?check:bw36\.7\n\s+- name: Check BW-36\.7R1 Workspace identity diagnostic\n\s+run: npm run check:bw36\.7r1/);
});

test('runbook captures evidence, exact manual procedure and stop boundaries', () => {
  for (const phrase of ['Records preventing automatic backfill: **38**','hypothesis, not a conclusion','Repository-proven identity model','Privacy boundaries','Blocker reconstruction','Merge and deploy BW-36.7R1','Copy the complete raw file without modification','Execute it exactly once','Do not rerun BW-36.7 with modifications','Do not proceed to BW-36.8','Remaining limitations']) assert.ok(docs.includes(phrase), phrase);
});

test('regression is dependency-free and contains no database, provider, AI or network client', () => {
  const source = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(source, /require\(['"](?:pg|https?|axios|node-fetch|openai|@supabase)/);
  for (const file of [relativeSql, 'scripts/check-bw36-7r1-workspace-identity-diagnostic.js', 'docs/implementation/2026-09-29-bw36-7r1-workspace-identity-diagnostic.md', 'package.json', '.github/workflows/runtime-boot-safety.yml']) assert.ok(fs.existsSync(path.join(root,file)), file);
});

process.stdout.write(`BW-36.7R1 Workspace identity diagnostic: ${passed} deterministic groups passed; zero database writes, provider requests, AI requests, or network requests.\n`);
