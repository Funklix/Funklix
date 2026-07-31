"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const BrandClient = require("../brand-client");

const brandA = "11111111-1111-4111-8111-111111111111";
const brandB = "22222222-2222-4222-8222-222222222222";

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

(async () => {
  // Anonymous sessions never request owned Brands; authenticated summary loads are deduplicated and summary-only.
  let calls = [];
  const state = BrandClient.createState();
  const controller = BrandClient.createController({ state, fetchImpl: async (url) => {
    calls.push(url);
    return response(200, { brands: [{ id: brandA, name: "A", revision: 1, created_at: "c", updated_at: "u", brand_core: { secret: true } }] });
  } });
  assert.deepStrictEqual(await controller.loadSummaries({ authenticated: false }), []);
  assert.strictEqual(calls.length, 0);
  controller.resetSession("owner@example.com");
  await Promise.all([controller.loadSummaries({ authenticated: true }), controller.loadSummaries({ authenticated: true })]);
  assert.deepStrictEqual(calls, ["/api/brands"]);
  assert.deepStrictEqual(Object.keys(state.summaries[0]).sort(), ["created_at", "id", "name", "revision", "updated_at"]);
  assert(!Object.hasOwn(state.summaries[0], "brand_core"));
  await controller.loadSummaries({ authenticated: true });
  assert.strictEqual(calls.length, 1);
  await controller.loadSummaries({ authenticated: true, force: true });
  assert.strictEqual(calls.length, 2);

  // Empty and failed lists are non-throwing and do not create active/canonical data.
  const emptyState = BrandClient.createState();
  const emptyController = BrandClient.createController({ state: emptyState, fetchImpl: async () => response(200, { brands: [] }) });
  emptyController.resetSession("empty@example.com");
  assert.deepStrictEqual(await emptyController.loadSummaries({ authenticated: true }), []);
  const failedState = BrandClient.createState();
  const failedController = BrandClient.createController({ state: failedState, fetchImpl: async () => response(500, { error: "internal" }) });
  failedController.resetSession("failed@example.com");
  assert.deepStrictEqual(await failedController.loadSummaries({ authenticated: true }), []);
  assert.strictEqual(failedState.summariesError, "request_failed");
  assert.strictEqual(failedState.activeBrand, null);

  // Activation requires a full successful owner API response; inaccessible loads expose no stale Brand.
  const activeState = BrandClient.createState();
  const activeController = BrandClient.createController({ state: activeState, fetchImpl: async (url) => url.endsWith(brandA)
    ? response(200, { id: brandA, name: "A", brand_core: { canonical: "A" }, revision: 1 })
    : response(404, { error: "Brand not found" }) });
  activeController.resetSession("owner@example.com");
  assert.strictEqual((await activeController.activateBrand(brandA)).id, brandA);
  assert.strictEqual(activeState.activeBrandVerified, true);
  assert.strictEqual(await activeController.activateBrand(brandB), null);
  assert.strictEqual(activeState.activeBrand, null);
  assert.strictEqual(activeState.activeBrandVerified, false);
  assert.strictEqual(activeState.activeBrandError, "not_found_or_inaccessible");

  // Older Brand loads and previous-session loads cannot overwrite newer state.
  const first = deferred(); const second = deferred();
  const staleState = BrandClient.createState(); let requestNumber = 0;
  const staleController = BrandClient.createController({ state: staleState, fetchImpl: () => (++requestNumber === 1 ? first.promise : second.promise) });
  staleController.resetSession("owner@example.com");
  const oldLoad = staleController.activateBrand(brandA);
  const newLoad = staleController.activateBrand(brandB);
  second.resolve(response(200, { id: brandB, name: "B", brand_core: { canonical: "B" } }));
  await newLoad;
  first.resolve(response(200, { id: brandA, name: "A", brand_core: { canonical: "A" } }));
  await oldLoad;
  assert.strictEqual(staleState.activeBrandId, brandB);
  const sessionLoad = deferred();
  const sessionState = BrandClient.createState();
  const sessionController = BrandClient.createController({ state: sessionState, fetchImpl: () => sessionLoad.promise });
  sessionController.resetSession("first@example.com");
  const pending = sessionController.activateBrand(brandA);
  sessionController.resetSession("second@example.com");
  sessionLoad.resolve(response(200, { id: brandA, brand_core: { private: "first-user" } }));
  await pending;
  assert.strictEqual(sessionState.activeBrand, null);
  assert.strictEqual(sessionState.activeBrandVerified, false);

  // Board association is passive and independent from active canonical state.
  assert.strictEqual(sessionController.setCurrentBoardBrandId(undefined), null);
  sessionController.cancelActiveLoad();
  assert.strictEqual(sessionController.setCurrentBoardBrandId(brandA), brandA);
  assert.strictEqual(sessionState.activeBrand, null);
  sessionController.resetSession(null);
  assert.deepStrictEqual(sessionState, BrandClient.createState());

  // Static integration contracts protect Canvas/snapshot authority and generic-copy semantics.
  const app = fs.readFileSync(path.resolve(__dirname, "../app.js"), "utf8");
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
  assert(html.indexOf('/brand-client.js') < html.indexOf('/app.js'));
  assert(app.includes("if (state.user?.email) void loadOwnedBrandSummaries()"));
  assert(app.includes("resetCanonicalBrandSession(null)"));
  const boardLoad = app.slice(app.indexOf("async function loadBoardFromUrlIfPresent"), app.indexOf("function renderCampaignCanvasFromStateIfNeeded"));
  assert(boardLoad.indexOf("applyCampaignState(normalizedCanvasState") < boardLoad.indexOf("observeBoardBrandAssociation(data)"));
  assert(!boardLoad.includes("await activateOwnedCanonicalBrand"));
  assert(boardLoad.includes("state.brandCore = snapshot ? normalizeBrandCoreState(snapshot"));
  const create = app.slice(app.indexOf("async function createNewBoardFlow"), app.indexOf("async function loadBoardsLibrary"));
  assert(create.includes("...(requestedBrandId ? { brand_id: requestedBrandId } : { brand_core_snapshot: defaultBrandCoreState() })"));
  assert(!create.includes("state.canonicalBrand.activeBrand.brand_core"));
  assert(create.includes("window.createNewBoardFromBrand"));
  const duplicate = app.slice(app.indexOf("async function duplicateCurrentBoard"), app.indexOf("function getActivityUserName"));
  assert(duplicate.includes("brand_core_snapshot: serializeBrandCoreSnapshot()"));
  assert(!duplicate.includes("brand_id"));
  assert(duplicate.includes("observeBoardBrandAssociation(data)"));
  const saveAsNew = app.slice(app.indexOf("async function saveBoardAsNew"), app.indexOf("function buildDuplicateBoardName"));
  assert(saveAsNew.includes("delete saveAsNewPayload.brand_id"));
  assert(saveAsNew.includes("observeBoardBrandAssociation(data)"));
  const autosave = app.slice(app.indexOf("async function saveBoardToServer"), app.indexOf("async function loadBoardFromUrlIfPresent"));
  assert(autosave.includes("brand_core_snapshot: serializeBrandCoreSnapshot()"));
  assert(!autosave.includes("brand_id"));
  assert(app.includes("brandBrainData: state.brandCore"));

  console.log("Canonical Brand Phase 1B client foundation checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
