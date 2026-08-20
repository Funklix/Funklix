#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function source(name) {
  const starts = [`function ${name}(`, `async function ${name}(`];
  const start = Math.max(...starts.map((marker) => app.indexOf(marker)));
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const next = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((index) => index >= 0);
  return app.slice(start, next.length ? Math.min(...next) : app.length);
}

const render = source("renderBoardBrandAssociation");
const catalog = source("loadCanonicalBrandCatalog");
const boardLoad = source("loadBoardFromUrlIfPresent");
const poll = source("pollBoardForRemoteChanges");

// Dependency-free state model for every display transition.
function resolve({ board = true, loading = false, brandId = "brand-1", catalogStatus = "idle", entries = [], authenticated = true }) {
  if (!board) return "No Board open";
  if (loading) return "Loading Board Brand…";
  if (brandId === null) return "Unbranded Board";
  const match = catalogStatus === "success" && entries.find(({ id }) => id === brandId);
  if (match) return match.name;
  if (catalogStatus === "success") return "Associated Brand unavailable";
  if (catalogStatus === "unauthenticated" || (catalogStatus === "idle" && !authenticated)) return "Sign in to resolve Board Brand";
  if (["error", "forbidden", "malformed"].includes(catalogStatus)) return "Board Brand name unavailable";
  return "Loading associated Brand…";
}

assert.strictEqual(resolve({ catalogStatus: "idle" }), "Loading associated Brand…");
assert.strictEqual(resolve({ catalogStatus: "loading" }), "Loading associated Brand…");
assert.strictEqual(resolve({ catalogStatus: "success", entries: [{ id: "brand-1", name: "TLDR" }] }), "TLDR");
assert.strictEqual(resolve({ catalogStatus: "success" }), "Associated Brand unavailable");
assert.strictEqual(resolve({ catalogStatus: "error" }), "Board Brand name unavailable");
assert.strictEqual(resolve({ catalogStatus: "unauthenticated" }), "Sign in to resolve Board Brand");
for (const catalogStatus of ["idle", "loading", "success", "error", "unauthenticated"]) {
  assert.strictEqual(resolve({ brandId: null, catalogStatus }), "Unbranded Board");
}
assert.strictEqual(resolve({ board: false }), "No Board open");
assert.strictEqual(resolve({ loading: true }), "Loading Board Brand…");

assert.match(render, /catalog\.status === "success" && catalogBrand/, "a successful match must resolve the Canonical Brand name");
assert.match(render, /catalog\.status === "success"[\s\S]*currentLabel = "Associated Brand unavailable"/, "unavailable must require a successful catalog miss");
assert.match(render, /currentLabel = "Board Brand name unavailable"/, "catalog failure must have a distinct safe label");
assert.match(render, /currentLabel = "Sign in to resolve Board Brand"/, "authentication loss must not fabricate a name");
assert.match(render, /Brand \$\{association\.brandId\}/, "resolution details must preserve the authoritative Brand ID");
assert.match(render, /hasAssociation && catalog\.status === "idle" && state\.user\?\.email\) void loadCanonicalBrandCatalog/, "an authenticated branded Board must lazily reuse the catalog loader");
assert.doesNotMatch(render, /ephemeralBrandSwitcherSelection|brandSwitcherPreference/, "Workspace selection must not resolve Board Brand identity");
assert.doesNotMatch(render, /fetch\(|method:\s*"PATCH"|brand_core/, "render-time resolution must make no Board write or detail/Core request");
assert.match(catalog, /\["loading", "success"\]\.includes\(state\.brandCatalog\.status\)\) return/, "the existing account-scoped loader must deduplicate repeated renders");
assert.strictEqual((catalog.match(/fetch\("\/api\/brands"/g) || []).length, 1, "resolution must use only the catalog request");
assert.doesNotMatch(catalog, /\/api\/brands\/\$|brand_core/, "catalog resolution must not request Brand detail or Brand Core");
assert.doesNotMatch(boardLoad, /await loadCanonicalBrandCatalog|brandCatalog\.status === "success"/, "Board and Canvas hydration must not wait for catalog resolution");
assert.doesNotMatch(poll, /method:\s*"PATCH"|ephemeralBrandSwitcherSelection/, "polling must preserve association and Workspace isolation");
assert.match(html, /board-brand-association-current" role="status" aria-live="polite" aria-atomic="true"/, "display transitions must be announced accessibly");

console.log("BW-5 Board Brand resolution state checks passed.");
