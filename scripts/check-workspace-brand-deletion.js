'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const routePath = path.join(root, 'api/brands/[id].js');
const storagePath = path.join(root, 'api/_brands-storage.js');
const accessPath = path.join(root, 'api/_brand-access.js');
const authPath = path.join(root, 'api/_auth-session.js');
const IDS = { target: '11111111-1111-4111-8111-111111111111', other: '22222222-2222-4222-8222-222222222222' };
process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://invented.invalid/test';

function fixture({ actor = 'owner@example.test', failAt = '' } = {}) {
  const durable = {
    brands: [{ id: IDS.target, owner_email: 'owner@example.test', name: 'Invented Alpine' }, { id: IDS.other, owner_email: 'owner@example.test', name: 'Invented Other' }],
    boards: [{ id: 'board-a', brand_id: IDS.target, canvas_json: { nodes: [{ id: 'node-a', content: 'invented' }] } }],
    members: [{ brand_id: IDS.target, email: 'member@example.test' }]
  };
  let tx = null;
  const current = () => tx || durable;
  const client = {
    async query(sql, params = []) {
      if (sql === 'BEGIN') { tx = structuredClone(durable); return { rows: [], rowCount: 0 }; }
      if (sql === 'COMMIT') { Object.keys(durable).forEach(k => { durable[k] = tx[k]; }); tx = null; return { rows: [], rowCount: 0 }; }
      if (sql === 'ROLLBACK') { tx = null; return { rows: [], rowCount: 0 }; }
      if (failAt && sql.includes(failAt)) throw new Error('invented transaction failure');
      if (sql.includes('SELECT id, name FROM brands')) { const row = current().brands.find(b => b.id === params[0] && b.owner_email === params[1]); return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }; }
      if (sql.includes('UPDATE boards SET brand_id = NULL')) { let count = 0; current().boards.forEach(b => { if (b.brand_id === params[0]) { b.brand_id = null; count++; } }); return { rows: [], rowCount: count }; }
      if (sql.includes('DELETE FROM brand_members')) { const before = current().members.length; current().members = current().members.filter(m => m.brand_id !== params[0]); return { rows: [], rowCount: before - current().members.length }; }
      if (sql.includes('DELETE FROM brands')) { const before = current().brands.length; current().brands = current().brands.filter(b => !(b.id === params[0] && b.owner_email === params[1])); return { rows: [], rowCount: before - current().brands.length }; }
      throw new Error(`unexpected SQL: ${sql}`);
    }, release() {}
  };
  [routePath, storagePath, accessPath, authPath].forEach(p => delete require.cache[p]);
  require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: { pool: { connect: async () => client }, BRAND_COLUMNS: '', MAX_BRAND_NAME_LENGTH: 160, ensureBrandsTable: async () => {}, serializeBrand: x => x } };
  require.cache[accessPath] = { id: accessPath, filename: accessPath, loaded: true, exports: { getBrandOwnerEmail: u => u?.email || '', getBrandAccess: async () => ({}), isBrandId: value => /^[0-9a-f-]{36}$/i.test(value) } };
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { getSessionUser: () => ({ email: actor }) } };
  return { durable, handler: require(routePath) };
}
async function invoke(handler, { id = IDS.target, confirmationName = 'Invented Alpine' } = {}) {
  const req = { method: 'DELETE', query: { id }, body: { confirmationName } };
  const result = {};
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  await handler(req, res); return result;
}
(async () => {
  let f = fixture(); const originalCanvas = structuredClone(f.durable.boards[0].canvas_json); let r = await invoke(f.handler);
  assert.equal(r.status, 200); assert.equal(r.body.code, 'BRAND_DELETED'); assert.match(r.body.requestId, /^[0-9a-f-]{36}$/);
  assert(!f.durable.brands.some(b => b.id === IDS.target), 'owner deletes owned Brand');
  assert(f.durable.brands.some(b => b.id === IDS.other), 'other Brands unchanged');
  assert.equal(f.durable.boards.length, 1); assert.equal(f.durable.boards[0].brand_id, null); assert.deepEqual(f.durable.boards[0].canvas_json, originalCanvas, 'Board and nodes unchanged');
  r = await invoke(f.handler); assert.equal(r.status, 404, 'duplicate request is consistent');
  f = fixture({ actor: 'viewer@example.test' }); r = await invoke(f.handler); assert.equal(r.status, 404); assert.equal(f.durable.brands.length, 2, 'non-owner retains Brand');
  f = fixture(); r = await invoke(f.handler, { id: 'bad' }); assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_BRAND_ID');
  f = fixture({ failAt: 'DELETE FROM brands' }); const before = structuredClone(f.durable); r = await invoke(f.handler); assert.equal(r.status, 500); assert.deepEqual(f.durable, before, 'failure rolls back detach and membership deletion');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8'); const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8'); const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(app.includes('if (!response.ok || result?.ok !== true'), 'client waits for authoritative success');
  assert(app.includes('state.brandCatalog.entries = state.brandCatalog.entries.filter'), 'success removes only confirmed row');
  assert(app.includes('brandDeletion.status = "confirming"') && app.includes('setBrandDeletionPending(false)'), 'failure restores usable UI');
  assert(app.includes('clearEphemeralBrandSwitcherSelection({ persist: true })'), 'selected deletion has deterministic No Brand fallback');
  assert(html.includes('Boards, Board content, nodes, approvals, publications, social connections, and user accounts will remain available.'));
  assert(css.includes('background: color-mix(in srgb, var(--fk-color-surface-input) 72%, transparent)') && css.includes('.brand-switcher-details[open] .brand-switcher-summary'), 'selector uses token surfaces for default/open states');
  assert(!css.match(/\.brand-switcher-summary[\s\S]{0,500}background:\s*rgba\(255,\s*255,\s*255/), 'light-only trigger rule removed');
  console.log('Workspace Brand deletion and selector regression passed (16 contracts).');
})().catch(error => { console.error(error); process.exitCode = 1; });
