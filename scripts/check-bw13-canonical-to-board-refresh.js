#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (path) => fs.readFileSync(path, 'utf8');
const storage = read('api/_boards-storage.js');
const route = read('api/boards/[id].js');
const list = read('api/boards/index.js');
const brands = read('api/brands/[id].js');
const app = read('app.js');
const html = read('index.html');

for (const column of ['brand_core_snapshot_backup JSONB', 'brand_core_backup_source_revision BIGINT', 'brand_core_backup_source_updated_at TIMESTAMPTZ', 'brand_core_backup_snapshot_copied_at TIMESTAMPTZ', 'brand_core_snapshot_backup_created_at TIMESTAMPTZ']) {
  assert.match(storage, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`), `nullable additive ${column}`);
}
assert.match(storage, /brand_core_backup_source_revision IS NULL OR brand_core_backup_source_revision > 0/);
assert.doesNotMatch(storage, /UPDATE boards/, 'runtime initialization has no backfill');
assert.doesNotMatch(list, /SELECT[^`]*brand_core_snapshot_backup/, 'library never selects recovery JSON');
assert.match(route, /refresh_brand_core_from_canonical:[^\n]*canonical_revision[^\n]*board_updated_at/);
assert.match(route, /restore_previous_brand_core_snapshot:[^\n]*board_updated_at/);
assert.match(route, /Object\.keys\(body\)\.length !== expectedKeys\.length/);
assert.match(route, /SELECT \$\{BOARD_COLUMNS\} FROM boards WHERE id = \$1 FOR UPDATE/);
assert.match(route, /board_editors[\s\S]*role = 'editor'/);
assert.match(route, /FROM brands WHERE id = \$1 AND owner_email = \$2/);
assert.match(route, /board\.brand_id !== body\.brand_id/);
assert.match(route, /Number\(brand\.revision\) !== body\.canonical_revision/);
assert.match(route, /new Date\(board\.updated_at\).*new Date\(body\.board_updated_at\)/);
assert.match(route, /await client\.query\('BEGIN'\)[\s\S]*brand_core_snapshot_backup = brand_core_snapshot[\s\S]*brand_core_snapshot = \$2::jsonb[\s\S]*await client\.query\('COMMIT'\)/);
assert.match(route, /await client\.query\('ROLLBACK'\)/);
assert.match(route, /brand_core_source_revision = \$3[\s\S]*brand_core_source_updated_at = \$4[\s\S]*brand_core_snapshot_copied_at = NOW/);
assert.match(route, /brand_core_snapshot = brand_core_snapshot_backup[\s\S]*brand_core_snapshot_backup = brand_core_snapshot/);
assert.match(route, /brand_core_restore_available: isPlainObject/);
assert.match(route, /brand_core_snapshot_backup = NULL[\s\S]*brand_core_snapshot_backup_created_at = NULL/);
assert.doesNotMatch(route.match(/if \(req\.method === 'PUT'\)[\s\S]*?if \(req\.method === 'PATCH'\)/)[0], /brand_core_snapshot_backup\s*=/, 'ordinary edits retain recovery');
assert.doesNotMatch(brands, /UPDATE boards|brand_core_snapshot_backup/, 'Canonical edits do not synchronize Boards');
assert.match(app, /comparison\.result\?\.matches === false/);
assert.match(app, /!state\.isDirty/);
assert.match(html, /Update Board Brand Core from Canonical/);
assert.match(html, /Restore previous Board Brand Core/);
assert.match(app, /comparison\.operationController/);
assert.match(app, /current\.userEmail[\s\S]*current\.boardId[\s\S]*current\.brandId[\s\S]*current\.boardLoadGeneration/);
assert.match(app, /network outcome is uncertain/i);
assert.match(app, /JSON\.stringify\(canonicalJson\(board\.brand_core_snapshot\)\)[\s\S]*canonicalJson\(current\.canonical\.brand_core\)/);
assert.match(app, /clearAutosaveTimer\(\); state\.isDirty = false/);
assert.doesNotMatch(app.match(/async function submitBoardBrandCoreOperation[\s\S]*?\n}\n/)[0], /canvas_json|pushState|replaceState|\/api\/brands\//, 'write UI isolates Canvas, navigation, association, and Canonical writes');
assert.match(app, /no ongoing synchronization is created/);
assert.doesNotMatch(app, /setInterval\([^)]*refresh_brand_core_from_canonical|mergeBrandCore/, 'no automatic synchronization or field merge');
assert.equal((app.match(/boardBrandCoreRefreshOpen\?\.addEventListener/g) || []).length, 1, 'one update handler');
assert.equal((app.match(/boardBrandCoreRestoreOpen\?\.addEventListener/g) || []).length, 1, 'one restore handler');
console.log('BW-13 controlled Canonical-to-Board refresh checks passed.');
