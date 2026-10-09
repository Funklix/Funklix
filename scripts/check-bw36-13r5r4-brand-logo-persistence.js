'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { runtime, W, B, EMAIL, png, clone } = require('./fixtures/bw36-13r5-local-runtime');
const { normalizeLogoRevision, projectLogo } = require('../api/_brand-logo');
const { projectCatalog } = require('../api/_workspace-catalog');
const profile = require('../brand-profile-setup');
const { browserJourney } = require('./check-bw36-13r5r3-durable-brand-logo-and-readiness');
require('../workspace-catalog');
const body = (revision, action = 'upload') => ({ contract: 'brand_logo_v1', request_id: `persistence-${revision}`, action,
  expected_revision: revision, workspace_id: W, mime_type: 'image/png', image_base64: png.toString('base64') });
const upload = (r, revision, action) => r.request('POST', `/api/brands/${B}/logo`, body(revision, action));
const metadata = r => clone(Object.fromEntries(Object.entries(r.db.brands[0]).filter(([key]) => key.startsWith('logo_'))));
function revisions() {
  for (const value of [0, 1, '0', '1', '9007199254740991']) assert.equal(normalizeLogoRevision(value), Number(value));
  for (const value of [null, undefined, '', ' 0', '0 ', '01', '+1', '-1', '1.0', '1e0', true, false, [], {}, -1, 0.5, NaN, Infinity, '9007199254740992', Number.MAX_SAFE_INTEGER + 1, 1n]) assert.throws(() => normalizeLogoRevision(value));
  assert.deepEqual(projectLogo({ id: B, logo_revision: '0', logo_object_path: null, logo_source_host: null, logo_updated_at: null }), { logo_url: null, logo_revision: 0 });
  assert.throws(() => projectLogo({ id: B, logo_revision: null }));
  assert.throws(() => projectLogo({ id: 'invalid', logo_revision: '0' }));
  const row = { id: B, logo_revision: '1', logo_object_path: `${B}/1.png`, logo_mime_type: 'image/png', logo_source: 'uploaded', logo_source_host: null, logo_updated_at: null };
  assert.equal(projectLogo(row).logo_revision, 1);
  assert.equal(projectLogo({ ...row, logo_updated_at: new Date() }).logo_revision, 1);
  for (const patch of [{ logo_mime_type: 'image/svg+xml' }, { logo_source: 'unknown' }, { logo_source_host: {} }, { logo_updated_at: 'invalid' }, { logo_revision: '01' }]) assert.throws(() => projectLogo({ ...row, ...patch }));
}
async function persistence() {
  // Reproduce the exact production SQL defect without any real database I/O.
  const broken = runtime({ postgresLogo: true, originalLogoLock: true });
  const failed = await upload(broken, 0);
  assert.equal(failed.statusCode, 500); assert.equal(failed.body.error.code, 'UPDATE_FAILED');
  assert(broken.db.queries.some(sql => /LEFT JOIN.*FOR UPDATE$/.test(sql)));
  assert.equal(broken.objects.size, 0); assert.equal(broken.db.brands[0].logo_revision, 0);
  assert.deepEqual(clone(broken.logs), [['[BRAND_LOGO_FAILURE]', { stage: 'authorization' }]]);
  const r = runtime({ postgresLogo: true });
  const initial = await r.load('api/_brands-storage.js').pool.query('SELECT id,logo_object_path,logo_revision FROM brands WHERE id=$1', [B]);
  assert.equal(initial.rows[0].logo_revision, '0'); assert.equal(initial.rowCount, 1);
  const board = clone(r.db.boards), core = clone(r.db.brands[0].brand_core);
  const result = await upload(r, 0);
  assert.equal(result.statusCode, 200); assert.equal(result.body.contract, 'brand_logo_v1');
  assert.equal(result.body.request_id, body(0).request_id); assert.equal(result.body.logo.brand_id, B);
  assert.equal(result.body.logo.changed, true); assert.equal(result.body.logo.logo_revision, 1);
  assert.equal(result.body.logo.logo_url, `/api/brands/${B}/logo?revision=1`);
  assert.equal(result.body.logo.source, 'uploaded'); assert.equal(r.db.brands[0].logo_source_host, null);
  assert.equal(r.objects.size, 1); assert(r.objects.has(`${B}/1.png`));
  const stored = await r.load('api/_brands-storage.js').pool.query('SELECT id,logo_object_path,logo_revision FROM brands WHERE id=$1', [B]);
  assert.equal(stored.rows[0].logo_revision, '1');
  const get = await r.request('GET', result.body.logo.logo_url);
  assert.equal(get.statusCode, 200); assert.deepEqual(get.body, png); assert.equal(get.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal((await r.request('GET', result.body.logo.logo_url, undefined, null)).statusCode, 401);
  // A fresh profile/catalog projection receives pg BIGINT text, then safe numeric wire revisions.
  const reload = await r.request('GET', `/api/brands/${B}`);
  assert.equal(reload.statusCode, 200); assert.equal(reload.body.logo_revision, 1);
  const projected = globalThis.FunklixWorkspaceCatalog.validate({ contract: 'workspace_catalog_v1', request_id: 'abcdefabcdefabcdefabcdef',
    workspaces: projectCatalog({ memberships: [{ id: W, name: 'Workspace', revision: '1', role: 'owner' }],
      brands: [{ ...r.db.brands[0], logo_revision: '1', role: 'owner' }], boards: [] }) });
  assert.equal(projected.workspaces[0].brands[0].logo_url, reload.body.logo_url);
  assert.deepEqual(r.db.boards, board); assert.deepEqual(r.db.brands[0].brand_core, core);
  const old = metadata(r); const attempts = r.storageRequests.length;
  assert.equal((await upload(r, 0)).statusCode, 409); assert.equal(r.storageRequests.length, attempts); assert.deepEqual(metadata(r), old);
  for (const flag of ['failLogoMetadata', 'zeroLogoUpdate', 'failLogoReadback', 'corruptLogoReadback', 'failCommit']) {
    r.db[flag] = true;
    const failure = await upload(r, 1);
    assert.equal(failure.statusCode, 500, flag);
    assert.equal(failure.body.error.code, /Readback/.test(flag) ? 'READBACK_FAILED' : 'UPDATE_FAILED');
    assert.deepEqual(metadata(r), old); assert.equal(r.objects.size, 1); assert(r.objects.has(`${B}/1.png`)); assert(!r.objects.has(`${B}/2.png`));
    r.db[flag] = false;
  }
  r.db.failLogoReadback = true; assert.equal((await upload(r, 1, 'remove')).statusCode, 500); r.db.failLogoReadback = false;
  assert.deepEqual(metadata(r), old); assert(r.objects.has(`${B}/1.png`));
  r.db.failStorageUpload = true; assert.equal((await upload(r, 1)).body.error.code, 'STORAGE_UNAVAILABLE'); r.db.failStorageUpload = false;
  assert.deepEqual(metadata(r), old);
  const start = r.events.length; assert.equal((await upload(r, 1)).statusCode, 200);
  const events = r.events.slice(start), index = token => events.findIndex(e => e.includes(token));
  assert(index('FOR UPDATE OF b') < index('storage_POST'));
  assert(index('storage_POST') < index('UPDATE brands SET logo_object_path'));
  assert(index('UPDATE brands SET logo_object_path') < index('SELECT id,logo_object_path'));
  assert(index('SELECT id,logo_object_path') < index('COMMIT')); assert(index('COMMIT') < index('storage_DELETE'));
  assert.equal(r.objects.size, 1); assert(r.objects.has(`${B}/2.png`)); assert(!r.objects.has(`${B}/1.png`));
  assert.equal((await r.request('GET', `/api/brands/${B}/logo?revision=1`)).statusCode, 409);
  assert.equal((await r.request('GET', `/api/brands/${B}/logo?revision=2`)).statusCode, 200);
  assert.equal((await upload(r, 2, 'remove')).statusCode, 200); assert.equal(r.objects.size, 0);
  for (const role of ['admin', 'editor', 'viewer', null]) {
    const member = runtime({ postgresLogo: true }); member.db.brands[0].owner_email = 'another-owner@example.test'; member.db.brandRole = role;
    assert.equal((await upload(member, 0)).statusCode, ['admin', 'editor'].includes(role) ? 200 : 403);
    if (!['admin', 'editor'].includes(role)) { assert.equal((await upload(member, 0, 'remove')).statusCode, 403); assert.equal(member.storageRequests.length, 0); }
  }
  const compensation = runtime({ postgresLogo: true }); compensation.db.failLogoMetadata = true; compensation.db.failStorageDelete = true;
  const compensationResponse = await upload(compensation, 0); assert.equal(compensationResponse.body.error.code, 'UPDATE_FAILED');
  assert(compensation.logs.some(entry => entry[1].stage === 'storage_compensation')); assert.equal(compensation.db.brands[0].logo_revision, 0);
  const responseFailure = runtime({ postgresLogo: true }); responseFailure.db.failLogoResponse = true;
  const response = await upload(responseFailure, 0); assert.equal(response.body.error.code, 'RESPONSE_INVALID');
  assert.equal(responseFailure.db.brands[0].logo_revision, 1); assert(responseFailure.objects.has(`${B}/1.png`));
  assert(!responseFailure.storageRequests.includes('DELETE'), 'A committed write cannot be compensated for a response failure');
  for (const value of [null, '', '01', true, '9007199254740992']) {
    const invalid = runtime({ postgresLogo: true }); invalid.db.brands[0].logo_revision = value;
    assert.equal((await upload(invalid, 0)).statusCode, 503); assert.equal(invalid.storageRequests.length, 0);
  }
  const schema = fs.readFileSync('migrations/20261001_bw36_12_brand_logo.sql', 'utf8');
  for (const sql of r.db.queries.filter(q => q.startsWith('UPDATE brands SET logo_object_path'))) {
    for (const column of [...sql.matchAll(/\b(logo_\w+)\s*=/g)].map(m => m[1])) assert(schema.includes(`ADD COLUMN IF NOT EXISTS ${column} `), column);
    assert.match(sql, /AND logo_revision=\$[26]::bigint/);
  }
  assert(!JSON.stringify(result.body).includes('supabase.co')); assert(!JSON.stringify(result.body).includes('logo_object_path'));
  assert(r.logs.every(entry => entry[0] === '[BRAND_LOGO_FAILURE]' && Object.keys(entry[1]).join() === 'stage'));
  console.log('R5R4: reproduced nullable LEFT JOIN lock rejection; pg rows/BIGINT strings, schema SQL, private upload/readback/delivery/reload, CAS, roles, rollback/compensation and replacement ordering passed.');
}
async function browserState() {
  const r = runtime({ postgresLogo: true });
  const before = clone(r.db.brands[0].brand_core);
  const brand = (await r.request('GET', `/api/brands/${B}`)).body;
  const context = { account: {}, generation: 1, brandId: B, workspaceId: W, authorized: true };
  const fetchImpl = async (url, init = {}) => { const response = await r.request(init.method || 'GET', url, init.body ? JSON.parse(init.body) : undefined); return { ok: response.statusCode === 200, status: response.statusCode, json: async () => response.body }; };
  const s = profile.createSession({ brand, getContext: () => context, fetchImpl, requestId: () => 'logo-reconciliation',
    validateBrand: b => b.id === B && Number.isSafeInteger(b.logo_revision), onSave() {}, onLogo() { throw new Error('Local renderer failure'); } });
  await s.chooseFile({ name: 'logo.png', type: 'image/png', size: png.length }, async () => png.toString('base64'));
  assert(s.dirty()); assert(await s.upload()); assert(!s.dirty()); assert.equal(s.state.file, null);
  assert(s.state.message.startsWith('Logo saved.')); assert.equal(r.objects.size, 1);
  s.state.core.brandCore = 'Updated profile'; assert(await s.save()); assert.equal(r.db.brands[0].logo_revision, 1);
  assert.equal(r.db.brands[0].logo_object_path, `${B}/1.png`);
  assert.deepEqual(r.db.brands[0].brand_core.brandDNA, before.brandDNA);
  assert.equal((await r.request('GET', `/api/brands/${B}`)).body.logo_url, `/api/brands/${B}/logo?revision=1`);
  console.log('R5R4: committed success survives local reconciliation failure; dirty reset and later profile PUT preserve logo/DNA/avatar.');
}
(async () => { revisions(); await persistence(); await browserState(); await browserJourney({ postgresLogo: true }); })().catch(error => { console.error(error); process.exitCode = 1; });
