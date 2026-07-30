"use strict";

const assert = require("assert");
process.env.AUTH_SECRET = "canonical-brand-foundation-test-secret";
process.env.POSTGRES_URL = "postgres://test.invalid/funklix";

const { createSessionToken } = require("../api/_auth-session");
const boardsStorage = require("../api/_boards-storage");
const brandsStorage = require("../api/_brands-storage");
const brandCollection = require("../api/brands/index");
const brandItem = require("../api/brands/[id]");
const boardCollection = require("../api/boards/index");
const { isBrandId } = require("../api/_brand-access");

const owner = { email: "Owner@Example.com", name: "Owner" };
const other = { email: "other@example.com", name: "Other" };
const brandId = "11111111-1111-4111-8111-111111111111";
const canonicalCore = { brandCore: "Canonical positioning", customTiles: [] };
const queries = [];
const originalQuery = boardsStorage.pool.query.bind(boardsStorage.pool);

function req(method, user, body = {}, query = {}) {
  const token = user ? createSessionToken(user) : "";
  return { method, body, query, headers: token ? { cookie: `funklix_session=${token}` } : {} };
}

function res() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

boardsStorage.pool.query = async (sql, params = []) => {
  const text = String(sql);
  queries.push({ text, params });
  if (/^(\s*CREATE|\s*ALTER|\s*DO)/.test(text)) return { rowCount: 0, rows: [] };
  if (text.includes("INSERT INTO brands")) return { rowCount: 1, rows: [{ id: brandId, owner_email: params[0], name: params[1], brand_core: JSON.parse(params[2]), revision: "1", created_at: "2026-01-01", updated_at: "2026-01-01" }] };
  if (text.includes("FROM brands WHERE id") && params[1] === "owner@example.com") return { rowCount: 1, rows: [{ id: brandId, owner_email: params[1], name: "Acme", brand_core: canonicalCore, revision: "2", created_at: "2026-01-01", updated_at: "2026-01-02" }] };
  if (text.includes("FROM brands WHERE id")) return { rowCount: 0, rows: [] };
  if (text.includes("FROM brands WHERE owner_email")) return { rowCount: 1, rows: [{ id: brandId, owner_email: params[0], name: "Acme", brand_core: canonicalCore, revision: "1", created_at: "2026-01-01", updated_at: "2026-01-01" }] };
  if (text.includes("UPDATE brands")) {
    if (params[4] !== 2) return { rowCount: 0, rows: [] };
    return { rowCount: 1, rows: [{ id: brandId, owner_email: params[1], name: params[2], brand_core: JSON.parse(params[3]), revision: "3", created_at: "2026-01-01", updated_at: "2026-01-03" }] };
  }
  if (text.includes("INSERT INTO boards")) return { rowCount: 1, rows: [{ id: "board-1", name: params[0], canvas_json: JSON.parse(params[1]), brand_core_snapshot: JSON.parse(params[2]), brand_id: params[3], owner_email: params[5], updated_at: "2026-01-03" }] };
  throw new Error(`Unexpected query: ${text}`);
};

(async () => {
  assert.strictEqual(brandCollection.validBrandName(" Acme "), "Acme");
  assert.strictEqual(brandCollection.validBrandName(" "), null);
  assert.strictEqual(brandCollection.validBrandCore({}), true);
  assert.strictEqual(brandCollection.validBrandCore([]), false);
  assert.strictEqual(isBrandId(brandId), true);
  assert.strictEqual(isBrandId("not-a-uuid"), false);

  let response = res();
  await brandCollection(req("POST", null, { name: "Acme", brand_core: {} }), response);
  assert.strictEqual(response.statusCode, 401);

  response = res();
  await brandCollection(req("POST", owner, { name: " Acme ", brand_core: canonicalCore, owner_email: other.email }), response);
  assert.strictEqual(response.statusCode, 201);
  assert.strictEqual(response.body.revision, 1);
  assert.strictEqual(queries.find(({ text }) => text.includes("INSERT INTO brands")).params[0], "owner@example.com");

  response = res();
  await brandCollection(req("GET", owner), response);
  assert.strictEqual(response.statusCode, 200, JSON.stringify(response.body));
  assert.strictEqual(response.body.brands.length, 1);
  assert(!Object.hasOwn(response.body.brands[0], "owner_email"));

  response = res();
  await brandItem(req("GET", other, {}, { id: brandId }), response);
  assert.strictEqual(response.statusCode, 404);

  response = res();
  await brandItem(req("PUT", owner, { name: "Acme 2", brand_core: canonicalCore, revision: 2 }, { id: brandId }), response);
  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(response.body.revision, 3);

  response = res();
  await brandItem(req("PUT", owner, { name: "Acme 3", brand_core: canonicalCore, revision: 1 }, { id: brandId }), response);
  assert.strictEqual(response.statusCode, 409);
  assert.strictEqual(response.body.revision, 2);

  response = res();
  await boardCollection(req("POST", owner, { name: "Campaign", canvas_json: { nodes: [], edges: [] }, brand_id: brandId, brand_core_snapshot: { brandCore: "Untrusted" } }), response);
  assert.strictEqual(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepStrictEqual(response.body.brand_core_snapshot, canonicalCore);
  assert.strictEqual(response.body.brand_id, brandId);

  response = res();
  await boardCollection(req("POST", other, { name: "Forbidden Campaign", canvas_json: { nodes: [], edges: [] }, brand_id: brandId }), response);
  assert.strictEqual(response.statusCode, 404);

  const legacySnapshot = { brandCore: "Legacy board knowledge" };
  response = res();
  await boardCollection(req("POST", owner, { name: "Legacy Campaign", canvas_json: { nodes: [], edges: [] }, brand_core_snapshot: legacySnapshot }), response);
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.body.brand_core_snapshot, legacySnapshot);
  assert.strictEqual(response.body.brand_id, null);

  const schemaText = queries.filter(({ text }) => /CREATE|ALTER|DO/.test(text)).map(({ text }) => text).join("\n");
  assert(schemaText.includes("brand_core JSONB NOT NULL"));
  assert(schemaText.includes("revision BIGINT NOT NULL DEFAULT 1"));
  assert(schemaText.includes("ADD COLUMN IF NOT EXISTS brand_id UUID"));
  assert(schemaText.includes("ON DELETE SET NULL"));

  console.log("Canonical Brand Phase 1A schema, ownership, API, revision, and board snapshot checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  boardsStorage.pool.query = originalQuery;
});
