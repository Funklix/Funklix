"use strict";

const assert = require("assert");
const fs = require("fs");
const { execFileSync } = require("child_process");
process.env.AUTH_SECRET = "canonical-brand-foundation-test-secret";
process.env.POSTGRES_URL = "postgres://test.invalid/funklix";

const { createSessionToken } = require("../api/_auth-session");
const boardsStorage = require("../api/_boards-storage");
const brandCollection = require("../api/brands/index");
const brandItem = require("../api/brands/[id]");
const boardCollection = require("../api/boards/index");
const boardItem = require("../api/boards/[id]");
const { isBrandId } = require("../api/_brand-access");

const owner = { email: "Owner@Example.com", name: "Owner" };
const other = { email: "other@example.com", name: "Other" };
const viewer = { email: "viewer@example.com", name: "Viewer" };
const ownerEmail = "owner@example.com";
const brandId = "11111111-1111-4111-8111-111111111111";
const otherBrandId = "22222222-2222-4222-8222-222222222222";
const linkedBoardId = "55555555-5555-4555-8555-555555555555";
const legacyBoardId = "66666666-6666-4666-8666-666666666666";
const canonicalCore = { brandCore: "CANONICAL PRIVATE KNOWLEDGE", customTiles: [] };
const boardSnapshot = { brandCore: "Campaign baseline", customTiles: [] };
const now = "2026-01-01T00:00:00.000Z";
const originalQuery = boardsStorage.pool.query.bind(boardsStorage.pool);
const brands = new Map([
  [brandId, { id: brandId, owner_email: ownerEmail, name: "Acme", brand_core: canonicalCore, revision: 2, created_at: now, updated_at: now }],
  [otherBrandId, { id: otherBrandId, owner_email: "other@example.com", name: "Other Brand", brand_core: { brandCore: "Other" }, revision: 1, created_at: now, updated_at: now }]
]);
const boards = new Map([
  [linkedBoardId, { id: linkedBoardId, name: "Linked", canvas_json: { nodes: [], edges: [] }, brand_core_snapshot: boardSnapshot, brand_id: brandId, owner_id: ownerEmail, owner_email: ownerEmail, created_at: now, updated_at: now }],
  [legacyBoardId, { id: legacyBoardId, name: "Legacy", canvas_json: { nodes: [], edges: [] }, brand_core_snapshot: { brandCore: "Legacy knowledge" }, brand_id: null, owner_id: ownerEmail, owner_email: ownerEmail, created_at: now, updated_at: now }]
]);
const editors = new Set([`${linkedBoardId}:viewer@example.com`]);
const queries = [];
let injectedFailure = null;
let boardSequence = 0;

function req(method, user, body = {}, query = {}) {
  const token = user ? createSessionToken(user) : "";
  return { method, body, query, headers: token ? { cookie: `funklix_session=${token}` } : {} };
}

function res() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function publicBrand(row, columns) {
  const fields = columns.split(",").map((field) => field.trim());
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}

boardsStorage.pool.query = async (sql, params = []) => {
  const text = String(sql);
  queries.push({ text, params });
  if (injectedFailure && injectedFailure.test(text)) {
    injectedFailure = null;
    throw new Error("postgres secret: constraint brands_internal_key SQL SELECT * FROM private_schema");
  }
  if (/^(\s*CREATE|\s*ALTER|\s*DO)/.test(text)) return { rowCount: 0, rows: [] };
  if (text.includes("to_regclass('boards')")) return { rowCount: 1, rows: [{ boards_exist: true, brands_exist: true }] };
  if (text.includes("INSERT INTO brands")) {
    const row = { id: `33333333-3333-4333-8333-${String(brands.size).padStart(12, "0")}`, owner_email: params[0], name: params[1], brand_core: JSON.parse(params[2]), revision: 1, created_at: now, updated_at: now };
    brands.set(row.id, row); return { rowCount: 1, rows: [row] };
  }
  if (text.includes("FROM brands WHERE owner_email")) {
    const columns = text.match(/SELECT (.+?) FROM brands/)?.[1] || "id";
    return { rows: [...brands.values()].filter((brand) => brand.owner_email === params[0]).map((brand) => publicBrand(brand, columns)), rowCount: 1 };
  }
  if (text.includes("FROM brands WHERE id")) {
    const row = brands.get(params[0]);
    if (!row || row.owner_email !== params[1]) return { rowCount: 0, rows: [] };
    const columns = text.match(/SELECT (.+?) FROM brands/)?.[1] || "id";
    return { rowCount: 1, rows: [publicBrand(row, columns)] };
  }
  if (text.includes("UPDATE brands SET")) {
    const row = brands.get(params[0]);
    if (!row || row.owner_email !== params[1] || row.revision !== params[4]) return { rowCount: 0, rows: [] };
    Object.assign(row, { name: params[2], brand_core: JSON.parse(params[3]), revision: row.revision + 1, updated_at: now });
    return { rowCount: 1, rows: [{ ...row }] };
  }
  if (text.includes("INSERT INTO boards")) {
    const row = { id: `board-created-${++boardSequence}`, name: params[0], canvas_json: JSON.parse(params[1]), brand_core_snapshot: JSON.parse(params[2]), brand_id: params[3], brand_core_source_revision: params[4], brand_core_source_updated_at: params[5], brand_core_snapshot_copied_at: params[3] ? now : null, owner_id: params[6], owner_email: params[7], owner_name: params[8], owner_avatar: params[9], created_by: params[10], created_at: now, updated_at: now };
    boards.set(row.id, row); return { rowCount: 1, rows: [row] };
  }
  if (text.includes("FROM boards WHERE id")) {
    const row = boards.get(params[0]);
    return row ? { rowCount: 1, rows: [{ ...row }] } : { rowCount: 0, rows: [] };
  }
  if (text.includes("FROM board_editors")) return { rowCount: editors.has(`${params[0]}:${params[1]}`) ? 1 : 0, rows: [] };
  if (text.includes("UPDATE board_editors")) return { rowCount: 0, rows: [] };
  if (text.includes("UPDATE boards") && text.includes("canvas_json")) {
    const row = boards.get(params[0]);
    if (!row) return { rowCount: 0, rows: [] };
    if (params[1]) row.name = params[1];
    row.canvas_json = JSON.parse(params[2]); row.brand_core_snapshot = JSON.parse(params[3]); row.updated_at = now;
    return { rowCount: 1, rows: [{ ...row }] };
  }
  throw new Error(`Unexpected query: ${text}`);
};

async function call(route, request) { const response = res(); await route(request, response); return response; }

(async () => {
  // Authentication and validation contracts.
  for (const [route, request] of [
    [brandCollection, req("GET", null)], [brandCollection, req("POST", null, { name: "Acme", brand_core: {} })],
    [brandItem, req("GET", null, {}, { id: brandId })], [brandItem, req("PUT", null, {}, { id: brandId })]
  ]) assert.strictEqual((await call(route, request)).statusCode, 401);
  assert.strictEqual((await call(brandItem, req("GET", owner, {}, { id: "invalid" }))).statusCode, 400);
  for (const revision of [null, 0, -1, 1.5, "2"]) assert.strictEqual((await call(brandItem, req("PUT", owner, { name: "Valid", brand_core: {}, revision }, { id: brandId }))).statusCode, 400);
  for (const name of ["", " ", "x".repeat(161)]) assert.strictEqual((await call(brandItem, req("PUT", owner, { name, brand_core: {}, revision: 2 }, { id: brandId }))).statusCode, 400);
  for (const brand_core of [null, [], "text", 1, true]) assert.strictEqual((await call(brandItem, req("PUT", owner, { name: "Valid", brand_core, revision: 2 }, { id: brandId }))).statusCode, 400);
  for (const name of ["", " ", "x".repeat(161)]) assert.strictEqual((await call(brandCollection, req("POST", owner, { name, brand_core: {} }))).statusCode, 400);
  for (const brand_core of [null, [], "text", 1, true]) assert.strictEqual((await call(brandCollection, req("POST", owner, { name: "Valid", brand_core }))).statusCode, 400);

  // Owner-only collection, item, and body-ownership behavior.
  let response = await call(brandCollection, req("GET", owner));
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.body.brands.map(({ id }) => id), [brandId]);
  assert.deepStrictEqual(Object.keys(response.body.brands[0]).sort(), ["created_at", "id", "name", "revision", "updated_at"]);
  assert(!JSON.stringify(response.body).includes("CANONICAL PRIVATE KNOWLEDGE"));
  response = await call(brandCollection, req("GET", other));
  assert.deepStrictEqual(response.body.brands.map(({ id }) => id), [otherBrandId]);
  response = await call(brandCollection, req("POST", owner, { name: "Created", brand_core: {}, owner_email: other.email, owner_id: "forged" }));
  assert.strictEqual(response.statusCode, 201);
  assert.strictEqual(brands.get(response.body.id).owner_email, ownerEmail);
  assert(!Object.hasOwn(response.body, "owner_email"));

  for (const method of ["GET", "PUT"]) {
    const body = method === "PUT" ? { name: "Stolen", brand_core: {}, revision: 2 } : {};
    response = await call(brandItem, req(method, other, body, { id: brandId }));
    assert.strictEqual(response.statusCode, 404);
    assert.deepStrictEqual(response.body, { error: "Brand not found" });
  }
  // Knowing brand_id and having linked-board editor access still grants no Brand access.
  for (const method of ["GET", "PUT"]) {
    const body = method === "PUT" ? { name: "Viewer edit", brand_core: {}, revision: 2 } : {};
    response = await call(brandItem, req(method, viewer, body, { id: brandId }));
    assert.strictEqual(response.statusCode, 404);
  }

  // Exact-once revision update, stale conflict immutability, and owner immutability.
  const beforeOwner = brands.get(brandId).owner_email;
  response = await call(brandItem, req("PUT", owner, { name: "Updated", brand_core: { brandCore: "Updated core" }, revision: 2, owner_email: other.email }, { id: brandId }));
  assert.strictEqual(response.statusCode, 200); assert.strictEqual(response.body.revision, 3);
  assert.strictEqual(brands.get(brandId).owner_email, beforeOwner);
  const beforeStale = JSON.parse(JSON.stringify(brands.get(brandId)));
  response = await call(brandItem, req("PUT", owner, { name: "Stale overwrite", brand_core: { brandCore: "Stale" }, revision: 2 }, { id: brandId }));
  assert.strictEqual(response.statusCode, 409);
  assert.strictEqual(brands.get(brandId).name, beforeStale.name);
  assert.deepStrictEqual(brands.get(brandId).brand_core, beforeStale.brand_core);

  // Unexpected Brand storage errors are logged internally but sanitized to clients.
  const originalConsoleError = console.error; const logged = [];
  console.error = (...args) => logged.push(args);
  injectedFailure = /FROM brands WHERE owner_email/;
  response = await call(brandCollection, req("GET", owner));
  assert.strictEqual(response.statusCode, 500); assert.deepStrictEqual(response.body, { error: "Failed to persist Brand" });
  assert(!JSON.stringify(response.body).includes("postgres secret"));
  injectedFailure = /FROM brands WHERE id/;
  response = await call(brandItem, req("GET", owner, {}, { id: brandId }));
  assert.strictEqual(response.statusCode, 500); assert.deepStrictEqual(response.body, { error: "Failed to load Brand" });
  assert(logged.some((entry) => JSON.stringify(entry).includes("postgres secret")));
  console.error = originalConsoleError;

  // Create-from-Brand is server-authoritative and never partially inserts on auth/load failure.
  const insertCount = () => queries.filter(({ text }) => text.includes("INSERT INTO boards")).length;
  const forged = { brandCore: "FORGED CLIENT SNAPSHOT" };
  response = await call(boardCollection, req("POST", owner, { name: "Linked campaign", canvas_json: { nodes: [], edges: [] }, brand_id: brandId, brand_core_snapshot: forged, owner_email: other.email }));
  assert.strictEqual(response.statusCode, 200); assert.strictEqual(response.body.brand_id, brandId);
  assert.deepStrictEqual(response.body.brand_core_snapshot, brands.get(brandId).brand_core);
  assert.notDeepStrictEqual(response.body.brand_core_snapshot, forged);
  assert.strictEqual(response.body.brand_core_source_revision, brands.get(brandId).revision);
  assert.strictEqual(response.body.brand_core_source_updated_at, brands.get(brandId).updated_at);
  assert.strictEqual(response.body.brand_core_snapshot_copied_at, now);
  assert(!Object.keys(response.body).some((key) => key.includes("backup") || key === "brand_core_restore_available"));
  assert.strictEqual(response.body.owner_email, ownerEmail);
  let beforeInsert = insertCount();
  assert.strictEqual((await call(boardCollection, req("POST", other, { name: "No", canvas_json: {}, brand_id: brandId }))).statusCode, 404);
  assert.strictEqual(insertCount(), beforeInsert);
  assert.strictEqual((await call(boardCollection, req("POST", owner, { name: "No", canvas_json: {}, brand_id: "invalid" }))).statusCode, 400);
  assert.strictEqual(insertCount(), beforeInsert);
  injectedFailure = /FROM brands WHERE id/;
  response = await call(boardCollection, req("POST", owner, { name: "No", canvas_json: {}, brand_id: brandId }));
  assert.strictEqual(response.statusCode, 500); assert.deepStrictEqual(response.body, { error: "Failed to save board" });
  assert(!JSON.stringify(response.body).includes("postgres secret"));
  assert.strictEqual(insertCount(), beforeInsert);
  assert.strictEqual(injectedFailure, null, "Board Brand lookup failure must be consumed by its intended request");
  assert.match(queries.at(-1).text, /SELECT id, brand_core, revision, updated_at FROM brands WHERE id/);

  // Generic create/copy/save-as-new paths omit brand_id and preserve their supplied snapshot.
  for (const actor of [owner, other]) {
    const copiedSnapshot = { brandCore: `Copied for ${actor.email}` };
    response = await call(boardCollection, req("POST", actor, { name: "Generic copy", canvas_json: { nodes: [], edges: [] }, brand_core_snapshot: copiedSnapshot }));
    assert.strictEqual(response.statusCode, 200); assert.strictEqual(response.body.brand_id, null);
    assert.deepStrictEqual(response.body.brand_core_snapshot, copiedSnapshot);
    assert.strictEqual(response.body.brand_core_source_revision, null);
    assert.strictEqual(response.body.brand_core_source_updated_at, null);
    assert.strictEqual(response.body.brand_core_snapshot_copied_at, null);
  }

  // Legacy, linked, shared-read, save, restore, and immutable brand_id compatibility.
  response = await call(boardItem, req("GET", owner, {}, { id: legacyBoardId }));
  assert.strictEqual(response.statusCode, 200); assert.strictEqual(response.body.brand_id, null);
  assert.deepStrictEqual(response.body.brand_core_snapshot, { brandCore: "Legacy knowledge" });
  assert.strictEqual(response.body.brand_core_restore_available, false);
  response = await call(boardItem, req("GET", viewer, {}, { id: linkedBoardId }));
  assert.strictEqual(response.statusCode, 200); assert.strictEqual(response.body.brand_id, brandId);
  assert.deepStrictEqual(response.body.brand_core_snapshot, boardSnapshot);
  assert(!JSON.stringify(response.body).includes("CANONICAL PRIVATE KNOWLEDGE"));
  for (const attemptedBrandId of [null, otherBrandId, "44444444-4444-4444-8444-444444444444"]) {
    response = await call(boardItem, req("PUT", owner, { canvas_json: { nodes: [{ id: "restored" }], edges: [] }, brand_core_snapshot: boardSnapshot, brand_id: attemptedBrandId }, { id: linkedBoardId }));
    assert.strictEqual(response.statusCode, 200); assert.strictEqual(response.body.brand_id, brandId);
    assert.deepStrictEqual(response.body.brand_core_snapshot, boardSnapshot);
  }

  // Static schema/API contracts: nullable additive relation, no backfill/snapshot rewrite, no PUT mutation.
  const boardStorageSource = fs.readFileSync(require.resolve("../api/_boards-storage"), "utf8");
  const boardItemSource = fs.readFileSync(require.resolve("../api/boards/[id]"), "utf8");
  assert(boardStorageSource.includes("ADD COLUMN IF NOT EXISTS brand_id UUID"));
  assert(!boardStorageSource.includes("brand_id UUID NOT NULL"));
  assert(boardStorageSource.includes("ON DELETE SET NULL"));
  assert(!/UPDATE boards[\s\S]*SET brand_id/.test(boardStorageSource));
  assert(!boardStorageSource.includes("UPDATE boards SET brand_core_snapshot"));
  assert(!boardStorageSource.includes("ensureBrandsTable"));
  const putSection = boardItemSource.slice(boardItemSource.indexOf("if (req.method === 'PUT')"), boardItemSource.indexOf("if (req.method === 'PATCH')"));
  assert(!putSection.includes("brand_id =")); assert(!putSection.includes("req.body?.brand_id"));

  // Retry behavior is checked in isolated processes because initialization promises are module-local caches.
  const retryProbe = `
    process.env.POSTGRES_URL='postgres://test.invalid/funklix';
    const storage=require('./api/_boards-storage'); const brands=require('./api/_brands-storage');
    let brandCreates=0,fail=true; storage.pool.query=async(sql)=>{const text=String(sql);if(text.includes('CREATE TABLE IF NOT EXISTS brands')){brandCreates++;if(fail){fail=false;throw new Error('first failure')}}if(text.includes("to_regclass('boards')"))return {rows:[{boards_exist:false,brands_exist:true}]};return {rows:[]}};
    (async()=>{let rejected=false; try{await brands.ensureBrandsTable()}catch(e){rejected=true} if(!rejected)throw new Error('brand first call must fail'); await brands.ensureBrandsTable(); if(brandCreates!==2)throw new Error('brand retry missing'); await brands.ensureBrandsTable(); if(brandCreates!==2)throw new Error('brand initialization is not idempotent')})().catch(e=>{console.error(e);process.exit(1)});`;
  execFileSync(process.execPath, ["-e", retryProbe], { cwd: require("path").resolve(__dirname, ".."), stdio: "pipe" });
  const boardRetryProbe = `
    process.env.POSTGRES_URL='postgres://test.invalid/funklix';
    const storage=require('./api/_boards-storage');
    let failed=false,boardCreates=0; storage.pool.query=async(sql)=>{const text=String(sql);if(text.includes('CREATE TABLE IF NOT EXISTS boards')){boardCreates++;if(!failed){failed=true;throw new Error('first board failure')}}if(text.includes("to_regclass('boards')"))return {rows:[{boards_exist:true,brands_exist:false}]};return {rows:[]}};
    (async()=>{let rejected=false;try{await storage.ensureBoardsTable()}catch(e){rejected=true}if(!rejected)throw new Error('board first call must fail');await storage.ensureBoardsTable();if(boardCreates!==2)throw new Error('board retry missing');const completedCalls=boardCreates;await storage.ensureBoardsTable();if(boardCreates!==completedCalls)throw new Error('board initialization is not idempotent')})().catch(e=>{console.error(e);process.exit(1)});`;
  execFileSync(process.execPath, ["-e", boardRetryProbe], { cwd: require("path").resolve(__dirname, ".."), stdio: "pipe" });

  const brandFailureIsolationProbe = `
    process.env.POSTGRES_URL='postgres://test.invalid/funklix';
    const storage=require('./api/_boards-storage');const brands=require('./api/_brands-storage');
    let boardCreates=0;
    storage.pool.query=async(sql)=>{const text=String(sql);if(text.includes('CREATE TABLE IF NOT EXISTS brands'))throw new Error('brand bootstrap failure');if(text.includes('CREATE TABLE IF NOT EXISTS boards'))boardCreates++;if(text.includes("to_regclass('boards')"))return {rows:[{boards_exist:true,brands_exist:false}]};return {rows:[]}};
    (async()=>{let brandRejected=false;try{await brands.ensureBrandsTable()}catch{brandRejected=true}if(!brandRejected)throw new Error('brand failure did not propagate');await storage.ensureBoardsTable();if(boardCreates!==1)throw new Error('brand failure blocked board initialization')})().catch(e=>{console.error(e);process.exit(1)});`;
  execFileSync(process.execPath, ["-e", brandFailureIsolationProbe], { cwd: require("path").resolve(__dirname, ".."), stdio: "pipe" });

  const relationshipProbe = `
    process.env.POSTGRES_URL='postgres://test.invalid/funklix';
    const storage=require('./api/_boards-storage');const brands=require('./api/_brands-storage');
    let boards=false,brand=false,relationAttempts=0,failRelation=true,boardCreates=0,brandCreates=0;
    storage.pool.query=async(sql)=>{const text=String(sql);if(text.includes('CREATE TABLE IF NOT EXISTS boards')){boards=true;boardCreates++}if(text.includes('CREATE TABLE IF NOT EXISTS brands')){brand=true;brandCreates++}if(text.includes("to_regclass('boards')"))return {rows:[{boards_exist:boards,brands_exist:brand}]};if(text.includes('ADD CONSTRAINT boards_brand_id_fkey')){relationAttempts++;if(failRelation){failRelation=false;throw new Error('relationship failure')}}return {rows:[]}};
    (async()=>{await storage.ensureBoardsTable();if(boardCreates!==1||relationAttempts!==0)throw new Error('boards-first availability failed');await brands.ensureBrandsTable();if(brandCreates!==1||relationAttempts!==1)throw new Error('boards-first reconciliation was not attempted');await storage.ensureBoardsTable();if(relationAttempts!==2)throw new Error('relationship retry missing');await storage.ensureBoardsTable();if(relationAttempts!==2)throw new Error('relationship reconciliation not idempotent')})().catch(e=>{console.error(e);process.exit(1)});`;
  execFileSync(process.execPath, ["-e", relationshipProbe], { cwd: require("path").resolve(__dirname, ".."), stdio: "pipe" });

  const brandsFirstProbe = `
    process.env.POSTGRES_URL='postgres://test.invalid/funklix';
    const storage=require('./api/_boards-storage');const brands=require('./api/_brands-storage');
    let boards=false,brand=false,relations=0;
    storage.pool.query=async(sql)=>{const text=String(sql);if(text.includes('CREATE TABLE IF NOT EXISTS boards'))boards=true;if(text.includes('CREATE TABLE IF NOT EXISTS brands'))brand=true;if(text.includes("to_regclass('boards')"))return {rows:[{boards_exist:boards,brands_exist:brand}]};if(text.includes('ADD CONSTRAINT boards_brand_id_fkey'))relations++;return {rows:[]}};
    (async()=>{await brands.ensureBrandsTable();if(relations!==0)throw new Error('missing boards was not safe');await storage.ensureBoardsTable();if(relations!==1)throw new Error('brands-first relationship was not reconciled')})().catch(e=>{console.error(e);process.exit(1)});`;
  execFileSync(process.execPath, ["-e", brandsFirstProbe], { cwd: require("path").resolve(__dirname, ".."), stdio: "pipe" });

  console.log("Canonical Brand Phase 1A.1 hardening checks passed (mock/contract coverage; no live PostgreSQL integration)." );
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { boardsStorage.pool.query = originalQuery; });
