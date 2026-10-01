'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const relativeSql = 'scripts/sql/bw36-7-workspace-backfill-preflight.sql';
const sql = fs.readFileSync(path.join(root, relativeSql), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/implementation/2026-09-28-bw36-7-workspace-backfill-preflight.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');

// Remove comments and quoted/dollar-quoted literals while retaining executable SQL.
function executableSql(source) {
  let output = '', quote = null, dollar = null, lineComment = false, blockComment = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i], pair = source.slice(i, i + 2);
    if (lineComment) { if (char === '\n') { lineComment = false; output += '\n'; } continue; }
    if (blockComment) { if (pair === '*/') { blockComment = false; i += 1; } continue; }
    if (!quote && !dollar && pair === '--') { lineComment = true; i += 1; continue; }
    if (!quote && !dollar && pair === '/*') { blockComment = true; i += 1; continue; }
    if (!quote && char === '$') {
      const tag = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/)?.[0];
      if (tag) { dollar = dollar === tag ? null : (dollar || tag); output += ' '; i += tag.length - 1; continue; }
    }
    if (!dollar && (char === "'" || char === '"')) {
      if (quote === char && source[i + 1] === char) { i += 1; continue; }
      quote = quote === char ? null : (quote || char); output += ' '; continue;
    }
    output += quote || dollar ? (char === '\n' ? '\n' : ' ') : char;
  }
  assert.equal(quote, null, 'unterminated SQL quote');
  assert.equal(dollar, null, 'unterminated dollar quote');
  assert.equal(blockComment, false, 'unterminated block comment');
  return output;
}

function statements(source) {
  return executableSql(source).split(';').map((part) => part.trim()).filter(Boolean);
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}

const executable = executableSql(sql);
const parsed = statements(sql);
const normalized = sql.replace(/\s+/g, ' ');
let passed = 0;
function test(name, callback) { callback(); passed += 1; process.stdout.write(`✓ ${name}\n`); }

test('preflight lives outside migrations and permits only the later BW-36.12 migration', () => {
  assert.ok(relativeSql.startsWith('scripts/sql/'));
  assert.equal(relativeSql.includes('migrations/'), false);
  const changedMigrations = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'migrations'], { cwd: root, encoding: 'utf8' }).trim();
  assert.deepEqual(changedMigrations.split('\n').filter(Boolean).filter((file) => file !== 'migrations/20261001_bw36_12_brand_logo.sql'), []);
});
test('parser sees exactly one read-only CTE/SELECT statement', () => {
  assert.equal(parsed.length, 1);
  assert.match(parsed[0], /^WITH\b/i);
  assert.match(parsed[0], /\bSELECT\s+category\s*,\s*check_name\s*,\s*status\s*,\s*record_count\s*,\s*notes\b/i);
});
test('all write, DDL, privilege, procedural and copy operations are absent', () => {
  for (const keyword of ['INSERT','UPDATE','DELETE','MERGE','UPSERT','CREATE','ALTER','DROP','TRUNCATE','GRANT','REVOKE','CALL','DO','EXECUTE','COPY']) {
    assert.doesNotMatch(executable, new RegExp(`\\b${keyword}\\b`, 'i'), keyword);
  }
});
test('remote and provider operations are absent', () => {
  assert.doesNotMatch(sql, /https?:\/\/|dblink|postgres_fdw|foreign data wrapper|openai|anthropic|provider endpoint/i);
});
test('result projection is privacy-safe and bounded', () => {
  const finalProjection = parsed[0].match(/SELECT\s+category,\s*check_name,\s*status,\s*record_count,\s*notes\s+FROM checks\s+ORDER BY/is)?.[0];
  assert.ok(finalProjection);
  assert.doesNotMatch(finalProjection, /\b(?:id|uuid|email|name|token|content|payload)\b/i);
  assert.doesNotMatch(sql, /SELECT\s+(?:b|bo|bf)\.name\b|canvas_json|brand_core\s*(?:,|FROM)|public_view_token_hash\s*(?:,|FROM)/i);
});
test('status vocabulary is bounded', () => {
  const statuses = [...sql.matchAll(/THEN\s+'([^']+)'|ELSE\s+'([^']+)'|,\s*'(info|review|blocked|ok)'\s*,/gi)].flatMap((match) => match.slice(1).filter(Boolean));
  assert.ok(statuses.length > 0);
  assert.deepEqual([...new Set(statuses)].sort(), ['blocked', 'info', 'ok', 'review']);
});
test('schema and adoption checks are complete', () => {
  for (const token of ['workspaces_table_exists','workspace_memberships_table_exists','brands_workspace_column','boards_workspace_column','workspace_rls_enabled','workspace_membership_rls_enabled','authorization_helpers','last_owner_guard','workspace_indexes','brand_workspace_index','board_workspace_index','existing_workspaces','existing_workspace_memberships','brands_with_workspace_reference','boards_with_workspace_reference']) assert.ok(sql.includes(token), token);
});
test('Brand inventory and membership diagnostics are complete', () => {
  for (const token of ['total_reusable_brands','active_brands','archived_or_deleted_brands','brands_with_primary_owner','brands_without_primary_owner','brand_owner_identity_anomalies','distinct_primary_brand_owners','brands_with_accepted_members','brands_with_multiple_owner_members','brands_without_memberships','brand_members_requiring_workspace_visibility','invalid_brand_member_identities','duplicate_brand_memberships']) assert.ok(sql.includes(token), token);
});
test('Board inventory, sharing, public and snapshot diagnostics are complete', () => {
  for (const token of ['total_boards','active_boards','archived_or_deleted_boards','boards_with_current_owner','ownerless_boards','board_owner_identity_anomalies','boards_with_brand_association','boards_without_brand_association','resolved_brand_associations','missing_brand_associations','snapshot_only_boards','boards_without_brand_or_snapshot','board_brand_owner_mismatches','boards_with_accepted_editors','boards_with_collaborators','board_only_collaborators','active_public_token_boards']) assert.ok(sql.includes(token), token);
});
test('migration risks use conservative quarantine projections', () => {
  for (const token of ['owners_with_brands_and_boards','board_owners_without_brands','brand_owners_without_boards','public_token_users_outside_catalogs','potential_access_expansion_cases','potential_access_loss_cases','cross_owner_board_shares','contradictory_ownership_shapes','records_preventing_automatic_backfill','brand_quarantine','board_quarantine']) assert.ok(sql.includes(token), token);
});
test('access-preservation aggregate baselines are present', () => {
  for (const token of ['owned_brand_relationships','accepted_brand_admin_relationships','accepted_brand_editor_relationships','accepted_brand_viewer_relationships','owned_board_relationships','board_editor_relationships','board_share_relationships','active_public_token_boards','snapshot_only_access_cases']) assert.ok(sql.includes(token), token);
});
test('prospective backfill summary is complete and non-mutating', () => {
  for (const token of ['default_owner_workspaces_to_create','workspace_owner_memberships_to_create','additional_visibility_memberships_to_create','brands_safe_for_automatic_assignment','brands_requiring_quarantine','branded_boards_safe_for_inherited_assignment','unbranded_boards_safe_for_owner_assignment','boards_requiring_quarantine','records_already_unexpectedly_migrated','total_blocking_anomalies']) assert.ok(sql.includes(token), token);
});
test('final readiness and deterministic category order are explicit', () => {
  assert.ok(sql.includes("'final readiness','workspace_backfill_readiness'"));
  assert.match(executable, /ORDER BY\s+sort_group\s*,\s*sort_item/i);
  const categories = ['schema','adoption state','brands','boards','memberships/access','migration risks','projected backfill','final readiness'];
  const positions = categories.map((category, index) => sql.search(new RegExp(`\\(${index + 1},\\d+,'${category.replace('/', '\\/')}'`)));
  assert.ok(positions.every((position) => position >= 0));
  for (let i = 1; i < positions.length; i += 1) assert.ok(positions[i] > positions[i - 1]);
});
test('browser preference, UI, provider and AI boundaries are untouched', () => {
  assert.doesNotMatch(sql, /localStorage|sessionStorage|ephemeralBrand|browser preference/i);
  const allowed = new Set([relativeSql, 'scripts/check-bw36-7-workspace-backfill-preflight.js', 'docs/implementation/2026-09-28-bw36-7-workspace-backfill-preflight.md', 'package.json', '.github/workflows/runtime-boot-safety.yml', 'scripts/check-bw36-7r3-corrected-workspace-backfill-preflight.js', 'scripts/check-bw36-7r2-application-identity-bridge.js']);
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  // This historical implementation-scope assertion applies only before the
  // chronologically later BW-36.9 runtime cutover exists.
  if (!fs.existsSync(path.join(root, 'workspace-catalog.js'))) {
    for (const file of changed) assert.ok(allowed.has(file), `unexpected changed file: ${file}`);
  }
});
test('BW-36.6 migration and BW-36.4 sidebar remain byte-identical', () => {
  assert.equal(digest('migrations/20260928_bw36_6_workspace_schema_foundation.sql'), 'd7832add0dd280a05a420fad42c90b81929dae5e72eae9ccc5a7377b1d49a35c');
  assert.equal(digest('brand-sidebar.js'), '10a42a42f4319eff9858f59333cb67b15d52ed22ea6b17b17000b5638bd6891f');
  assert.equal(digest('scripts/check-bw36-4-simplified-brand-sidebar.js'), '2d8cfe6e01c8e604bde5aff70c02872eb4c7ad2797c0082400ceeb3dcf7129a5');
});
test('package and Runtime Boot Safety register BW-36.7 immediately after BW-36.6', () => {
  assert.equal(pkg.scripts['check:bw36.7'], 'node scripts/check-bw36-7-workspace-backfill-preflight.js');
  assert.ok(workflow.indexOf('check:bw36.7') > workflow.indexOf('check:bw36.6'));
  assert.ok(workflow.indexOf('check:bw36.7') < workflow.indexOf('dynamic AI Insights'));
});
test('runbook states privacy, manual execution, review and no-backfill boundaries', () => {
  for (const phrase of ['GitHub Raw','Supabase SQL Editor','zero adoption','`ok`','`review`','`blocked`','BW-36.8','row-level transaction logic','UI remains unchanged','Do not edit production data']) assert.ok(docs.includes(phrase), phrase);
});
test('tracked-files-only execution needs no dependencies or external activity', () => {
  const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n'));
  for (const file of [relativeSql, 'scripts/check-bw36-7-workspace-backfill-preflight.js', 'docs/implementation/2026-09-28-bw36-7-workspace-backfill-preflight.md', 'package.json', '.github/workflows/runtime-boot-safety.yml']) assert.ok(tracked.has(file), `${file} must be tracked`);
  assert.doesNotMatch(fs.readFileSync(__filename, 'utf8'), /require\(['"](?:pg|https?|axios|node-fetch|openai)/);
  assert.equal(fs.existsSync(path.join(root, 'node_modules', '.bw36-7-required')), false);
});

process.stdout.write(`BW-36.7 Workspace backfill preflight: ${passed} deterministic groups passed; zero database writes, provider requests, AI requests, or network requests.\n`);
