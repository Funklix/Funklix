const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const storage = read('api/_boards-storage.js');
const collection = read('api/boards/index.js');
const item = read('api/boards/[id].js');
const app = read('app.js');
const workflow = read('.github/workflows/runtime-boot-safety.yml');

const fields = ['brand_core_source_revision', 'brand_core_source_updated_at', 'brand_core_snapshot_copied_at'];
for (const field of fields) {
  assert.match(storage, new RegExp(`ADD COLUMN IF NOT EXISTS ${field} (?:BIGINT|TIMESTAMPTZ)`), `${field} is additive and nullable`);
  assert(item.includes(field), `${field} is returned by authoritative Board reads`);
}
assert.match(storage, /brand_core_source_revision IS NULL OR brand_core_source_revision > 0/);
assert.doesNotMatch(storage, /UPDATE boards[\s\S]*brand_core_source_(?:revision|updated_at)|UPDATE boards[\s\S]*brand_core_snapshot_copied_at/, 'schema setup never backfills provenance');
assert.match(storage, /schemaReadyPromise = null[\s\S]*\.catch\(\(error\) => \{[\s\S]*schemaReadyPromise = null/, 'initialization remains retryable');

assert.match(collection, /getOwnedBrand\(requestedBrandId, user, \{ columns: 'id, brand_core, revision, updated_at' \}\)/);
assert.match(collection, /sourceRevision = brand\.revision[\s\S]*sourceUpdatedAt = brand\.updated_at/);
assert.match(collection, /brand_core_snapshot_copied_at[\s\S]*CASE WHEN \$4::uuid IS NULL THEN NULL ELSE NOW\(\) END/);
assert.match(collection, /sourceRevision, sourceUpdatedAt/);
assert.doesNotMatch(collection, /req\.body\?\.brand_core_source_|const \{[^}]*brand_core_source_/, 'client provenance is never read');
assert.match(collection, /let sourceRevision = null;[\s\S]*let sourceUpdatedAt = null;/, 'unbranded provenance stays null');

const association = item.slice(item.indexOf("if (req.method === 'PATCH')"), item.indexOf("if (req.method === 'DELETE')"));
for (const field of fields) assert.match(association, new RegExp(`${field} = NULL`), 'association clears provenance atomically');
assert.doesNotMatch(association, /brand_core_snapshot\s*=/, 'association does not replace the snapshot');
const put = item.slice(item.indexOf("if (req.method === 'PUT')"), item.indexOf("if (req.method === 'PATCH')"));
assert.doesNotMatch(put, /brand_core_source_(?:revision|updated_at)\s*=|brand_core_snapshot_copied_at\s*=/, 'Board Core edits retain provenance');
assert.doesNotMatch(read('api/brands/[id].js'), /UPDATE boards|brand_core_source_|brand_core_snapshot_copied_at/, 'Canonical edits do not mutate Boards');

assert.match(collection, /const \{ brand_core_snapshot, \.\.\.safeRow \} = row/, 'list rows redact full snapshots');
const listQuery = collection.match(/SELECT b\.id,[\s\S]*?FROM boards b/)?.[0] || '';
for (const field of fields) assert(!listQuery.includes(field), 'list query remains lightweight without provenance');
assert.match(app, /function normalizeBoardSnapshotProvenance/);
assert.match(app, /Number\.isSafeInteger\(revision\).*revision < 1/);
assert.match(app, /Number\.isNaN\(Date\.parse\(sourceUpdatedAt\)\)/);
assert.match(app, /Number\.isNaN\(Date\.parse\(copiedAt\)\)/);
assert.match(app, /Snapshot origin unavailable/);
assert.match(app, /Initialized from Canonical revision \$\{provenance\.sourceRevision\}/);
assert.match(app, /Canonical Brand is currently revision \$\{comparison\.canonical\.revision\}/);
assert.match(app, /provenanceSection[\s\S]*explanation/, 'provenance and content comparison render separately');
assert.match(app, /authoritativeBoardBrandCore = \{ boardId: String\(data\.id\), loadGeneration, value:[^\n]*provenance:/);
assert.match(app, /provenance: snapshot\.provenance \? \{ \.\.\.snapshot\.provenance \} : null/);
assert.match(app, /current\.boardLoadGeneration === state\.authoritativeBoardBrandCore\.loadGeneration/);
assert.doesNotMatch(app.slice(app.indexOf('async function submitCanonicalBrandCoreInitialization'), app.indexOf('async function loadBoardBrandCoreComparison')), /authoritativeBoardBrandCore\.provenance\s*=|brand_core_source_/, 'BW-9 does not fabricate provenance');
assert.match(app, /const validProvenance = choice\.mode === "brand" \? provenance !== null/);
assert.match(app, /data\.brand_id !== brandId/);
assert.match(workflow, /check-bw11-create-board-from-canonical-brand\.js[\s\S]*check-bw12-canonical-snapshot-provenance\.js/);
assert.strictEqual((workflow.match(/check-bw12-canonical-snapshot-provenance\.js/g) || []).length, 1, 'BW-12 handler is registered once');

for (const forbidden of ['synchroniz', 'refresh snapshot', 'publish snapshot', 'merge snapshot', 'rollback snapshot']) {
  assert(!`${storage}\n${collection}\n${item}`.toLowerCase().includes(forbidden), `no ${forbidden} action`);
}

console.log('BW-12 Canonical Brand snapshot provenance checks passed.');
