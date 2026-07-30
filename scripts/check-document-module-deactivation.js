"use strict";

const assert = require("assert");
const fs = require("fs");

const registry = require("../knowledge-module-registry");
const { DOCUMENT_IMPORT_DISABLED_ERROR, documentImportDisabled } = require("../api/_document-feature");

assert.strictEqual(registry.isKnownModule("pitch_deck"), true);
assert.strictEqual(registry.isKnownModule("whitepaper"), true);
assert.strictEqual(registry.isActiveCreatableModule("pitch_deck"), false);
assert.strictEqual(registry.isActiveCreatableModule("whitepaper"), false);
assert.strictEqual(registry.getModuleDefinition("pitch_deck").id, "pitch_deck");
assert.strictEqual(registry.getModuleDefinition("whitepaper").id, "whitepaper");
assert(!registry.getModulesForSection("deployment").some(({ id }) => ["pitch_deck", "whitepaper"].includes(id)));
assert(registry.getModulesForSection("deployment", { includeInactive: true }).some(({ id }) => id === "pitch_deck"));

const response = { statusCode: 0, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
documentImportDisabled(response);
assert.strictEqual(response.statusCode, 410);
assert.deepStrictEqual(response.payload, { error: { code: "DOCUMENT_IMPORT_DISABLED", message: "Document import is no longer available." } });
assert.deepStrictEqual(Object.keys(DOCUMENT_IMPORT_DISABLED_ERROR).sort(), ["code", "message"]);

const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
const documentRoute = fs.readFileSync(require.resolve("../api/_document-route.js"), "utf8");
const processingRoute = fs.readFileSync(require.resolve("../api/_document-processing-route.js"), "utf8");
const context = fs.readFileSync(require.resolve("../api/_brand-brain-context.js"), "utf8");
const boardCreate = fs.readFileSync(require.resolve("../api/boards/index.js"), "utf8");
const packageJson = require("../package.json");
const records = require("../api/_document-records");
const storage = require("../api/_document-storage");
const { cancelDisabledUploadIntent } = require("../api/_document-route");

const dashboardInputs = app.match(/const DASHBOARD_KNOWLEDGE_INPUTS = \[([^\]]+)\]/)?.[1] || "";
const missingModules = app.match(/const BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
for (const removed of ["Pitch Deck", "Whitepaper", "pitch_deck", "whitepaper"]) {
  assert(!dashboardInputs.includes(removed), `${removed} must not be in Dashboard discovery`);
  assert(!missingModules.includes(removed), `${removed} must not be in Missing Knowledge`);
}
for (const retained of ["Founder Story", "Market Research", "Business Plan"]) assert(dashboardInputs.includes(retained));
for (const retained of ["founder_story", "market_research", "business_plan"]) assert(missingModules.includes(retained));

assert(app.includes("isActiveCreatableModule?.(options.moduleType) !== false"));
assert(!app.includes('id="brand-document-file"'));
assert(!app.includes('id="brand-document-upload"'));
assert(app.includes("data-document-download") && app.includes("data-document-delete") && app.includes('id="bc-custom-delete"'));
assert(app.includes("getDocumentSourceType(tile)") && app.includes("renderDocumentSourceEditor(tile, idx)"));
assert(documentRoute.includes("return documentImportDisabled(res)") && documentRoute.includes("cancelDisabledUploadIntent(auth, requestId)"));
assert(documentRoute.includes("request_id=$1 AND board_id=$2 AND tile_id=$3 AND source_type=$4"));
assert(documentRoute.includes("id=$1 AND request_id=$2 AND board_id=$3 AND tile_id=$4 AND source_type=$5"));
assert(processingRoute.match(/async function start[\s\S]*?return documentImportDisabled\(res\)/));
assert(processingRoute.match(/async function retry[\s\S]*?return documentImportDisabled\(res\)/));
assert(processingRoute.match(/async function run[\s\S]*?internalAuthorized[\s\S]*?return documentImportDisabled\(res\)/));
assert(processingRoute.includes("async function status") && processingRoute.includes("async function cancel"));

assert(context.includes("PRIVATE_DOCUMENT_SOURCE_MODULES = new Set(['pitch_deck', 'whitepaper'])"));
assert(context.includes("PRIVATE_DOCUMENT_SOURCE_MODULES.has(tile?.moduleType)"));
assert(!boardCreate.includes("brand_documents") && !boardCreate.includes("brand_document_processing_jobs"));
for (const dependency of ["pdfjs-dist", "pdf-parse", "pdf-lib", "unpdf"]) assert(!Object.hasOwn(packageJson.dependencies || {}, dependency));
assert(!app.includes("DOCUMENT_IMPORT_DISABLED") || app.includes("documentImportDisabled"), "No client-side parser or processing implementation was added");

(async () => {
  const originalEnsure = records.ensureDocumentTables;
  const originalQuery = records.pool.query;
  const originalDelete = storage.deletePrivate;
  const queries = [];
  const deleted = [];
  records.ensureDocumentTables = async () => {};
  records.pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (String(sql).startsWith("SELECT")) return { rows: [{ id: "intent-a", status: "pending" }] };
    return { rows: [{ storage_key: "documents/board-a/km_pitch_12345678/exact.pdf" }] };
  };
  storage.deletePrivate = async (key) => { deleted.push(key); };
  try {
    await cancelDisabledUploadIntent({ boardId: "board-a", tileId: "km_pitch_12345678", sourceType: "pitch_deck" }, "request-123456");
    assert.deepStrictEqual(deleted, ["documents/board-a/km_pitch_12345678/exact.pdf"]);
    assert.deepStrictEqual(queries[0].params, ["request-123456", "board-a", "km_pitch_12345678", "pitch_deck"]);
    assert.deepStrictEqual(queries[1].params, ["intent-a", "request-123456", "board-a", "km_pitch_12345678", "pitch_deck"]);
  } finally {
    records.ensureDocumentTables = originalEnsure;
    records.pool.query = originalQuery;
    storage.deletePrivate = originalDelete;
  }
  console.log("Document module soft-deactivation discovery, legacy compatibility, route-guard, cleanup-scope, context, and dependency checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
