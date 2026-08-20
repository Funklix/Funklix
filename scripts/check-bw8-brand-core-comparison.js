#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/runtime-boot-safety.yml"), "utf8");
const brandRoute = fs.readFileSync(path.join(root, "api/brands/[id].js"), "utf8");
const brandAccess = fs.readFileSync(path.join(root, "api/_brand-access.js"), "utf8");

function source(name) {
  const starts = [`function ${name}(`, `async function ${name}(`].map((text) => app.indexOf(text)).filter((index) => index >= 0);
  assert.ok(starts.length, `missing ${name}`);
  const start = Math.min(...starts);
  const ends = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((index) => index >= 0);
  return app.slice(start, ends.length ? Math.min(...ends) : app.length);
}

const open = source("openBoardBrandCoreComparison");
const load = source("loadBoardBrandCoreComparison");
const close = source("closeBoardBrandCoreComparison");
const render = source("renderBoardBrandCoreComparison");
const associationRender = source("renderBoardBrandAssociation");
const boardLoad = source("loadBoardFromUrlIfPresent");
const associate = source("submitBoardBrandAssociation");
const compareSource = `${source("isPlainJsonObject")}\n${source("compareBrandCoreDocuments")}`.replace("window.compareBrandCoreDocuments = compareBrandCoreDocuments;", "");
const context = {}; vm.createContext(context); vm.runInContext(`${compareSource}; this.compare = compareBrandCoreDocuments;`, context);
const compare = (a, b) => { context.left = JSON.stringify(a); context.right = JSON.stringify(b); return JSON.parse(vm.runInContext("JSON.stringify(compare(JSON.parse(left), JSON.parse(right)))", context)); };

assert.match(html, /id="board-brand-core-compare-open"[^>]*>Compare Brand Cores</, "comparison has an explicit action");
assert.doesNotMatch(boardLoad, /\/api\/brands\//, "Board loading does not fetch Brand details");
assert.doesNotMatch(`${open}\n${load}`, /ephemeralBrandSwitcherSelection|brandSwitcherPreference|Workspace/, "Workspace selection does not target comparison");
assert.match(load, /const brandId = association\.brandId/, "target comes from authoritative Board association");
assert.match(associationRender, /hasAssociation[\s\S]*canCompare[\s\S]*catalogBrand/, "unbranded and unresolved Boards cannot compare");
assert.match(load, /fetch\(`\/api\/brands\/\$\{encodeURIComponent\(brandId\)\}`[\s\S]*method: "GET"/, "GET /api/brands/:id is reused");
assert.doesNotMatch(`${open}\n${load}\n${close}\n${render}`, /method:\s*"(?:PUT|PATCH|POST|DELETE)"|\/api\/boards|saveBoard|markUnsaved|autosave|state\.brandCore\s*=|canvas|localStorage|sessionStorage|history\.|location\./i, "comparison lifecycle has no write or unrelated state effect");
assert.equal(compare({ a: 1 }, { a: 1 }).matches, true);
assert.equal(compare({ a: 1, b: 2 }, { b: 2, a: 1 }).matches, true, "object ordering is ignored");
assert.equal(compare({ a: 1 }, { a: 2 }).different[0].path, "$.a");
assert.equal(compare({ a: null }, {}).canonicalOnly[0].value, null, "null differs from missing");
for (const value of [false, 0, "", [], {}]) assert.equal(compare({ value }, {}).canonicalOnly.length, 1, `${JSON.stringify(value)} remains present`);
assert.equal(compare({ future: { nested: true } }, { future: { nested: false } }).different[0].path, "$.future.nested", "unknown nested fields are compared");
assert.equal(compare({ list: [1, 2] }, { list: [2, 1] }).matches, false, "array order is significant");
assert.equal(compare({ canonical: 1 }, { board: 2 }).canonicalOnly[0].path, "$.canonical");
assert.equal(compare({ canonical: 1 }, { board: 2 }).boardOnly[0].path, "$.board");
assert.deepEqual([compare({}, {}).canonicalEmpty, compare({}, {}).boardEmpty], [true, true]);
assert.deepEqual([compare({}, { a: 1 }).canonicalEmpty, compare({}, { a: 1 }).boardEmpty], [true, false]);
assert.deepEqual([compare({ a: 1 }, {}).canonicalEmpty, compare({ a: 1 }, {}).boardEmpty], [false, true]);
assert.match(render, /textContent/g, "Brand-provided values render via textContent");
assert.doesNotMatch(render, /innerHTML|insertAdjacentHTML/, "comparison does not inject HTML");
assert.match(brandRoute, /const brand = await getOwnedBrand\(id, user\)/, "comparison retains owner-scoped Brand authorization");
assert.match(brandAccess, /owner_email = \$2/, "Brand ownership is enforced in storage lookup");
assert.match(brandRoute, /if \(!brand\) return res\.status\(404\)/, "inaccessible Brands remain non-disclosing 404s");
assert.match(load, /response\.status === 401[\s\S]*\[403, 404\][\s\S]*"unavailable"[\s\S]*"error"/, "HTTP failures are safely categorized");
assert.match(load, /!isPlainJsonObject\(brand\.brand_core\)/, "malformed Brand Core is rejected");
assert.match(html, /id="board-brand-core-comparison-retry"[^>]*>Retry comparison</, "retry is deliberate");
assert.match(close, /controller\?\.abort[\s\S]*requestId: previous\.requestId \+ 1/, "close aborts and invalidates pending responses");
assert.match(app, /invalidateBoardBrandAssociation[\s\S]*closeBoardBrandCoreComparison/, "Board and association lifecycle invalidates comparison");
assert.match(load, /userEmail === \(state\.user[\s\S]*current\.boardId ===[\s\S]*current\.brandId === state\.boardBrandAssociation\.brandId[\s\S]*boardLoadGeneration/, "late responses are account, Board, association, and Board-load guarded");
assert.match(boardLoad, /authoritativeBoardBrandCore = \{ boardId: String\(data\.id\), loadGeneration, value: clonePlainObject\(snapshot \|\| \{\}\) \}/, "comparison retains the raw authoritative Board snapshot including unknown fields");
assert.match(html, /last saved Board Brand Core snapshot loaded from the server/, "unsaved Board edits are explicitly disclosed");
assert.doesNotMatch(`${open}\n${load}\n${close}`, /ephemeralBrandSwitcherSelection|brandCatalog\.entries\s*=|brand_id\s*=|intendedBrandId|canonicalBrandDetail/, "comparison is isolated from Workspace, association candidates, and Canonical drafts");
assert.doesNotMatch(html.match(/<dialog class="brand-workspace-detail brand-core-comparison"[\s\S]*?<\/dialog>/)[0], />\s*(Copy|Merge|Publish|Pull|Push|Synchronize|Reset)\b/i, "comparison offers no synchronization action");
assert.equal((app.match(/boardBrandCoreCompareOpen\?\.addEventListener\("click"/g) || []).length, 1, "handlers are registered once");
assert.match(workflow, /node scripts\/check-bw8-brand-core-comparison\.js/, "BW-8 check is registered in runtime CI");
assert.doesNotMatch(associate, /loadBoardBrandCoreComparison/, "association writes never implicitly fetch comparison details");

console.log("BW-8 read-only Brand Core comparison checks passed.");
