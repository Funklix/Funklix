#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

const render = functionSource("renderBrandCatalog");
const select = functionSource("selectEphemeralBrandFromSwitcher");
const clear = functionSource("clearEphemeralBrandSwitcherSelection");
const load = functionSource("loadCanonicalBrandCatalog");
const boot = functionSource("bootApp");
const selectionScope = `${select}\n${clear}`;

assert.match(html, /id="brand-switcher-current-name">No Brand selected</, "fresh initialization must visibly begin unselected");
assert.match(html, /id="brand-switcher-no-brand"[^>]*aria-current="true"/, "No Brand must be an explicit initial option");
assert.match(app, /let ephemeralBrandSwitcherSelection = null;/, "selection must begin only in browser memory");
assert.match(render, /entry\.addEventListener\("click", \(\) => selectEphemeralBrandFromSwitcher\(brand\)\)/, "only an explicit row click may select a Brand");
assert.match(clear, /ephemeralBrandSwitcherSelection = null/, "the explicit No Brand option must clear selection");
assert.match(app, /brandSwitcherNoBrand\?\.addEventListener\("click"/, "No Brand must remain selectable");
assert.doesNotMatch(load, /ephemeralBrandSwitcherSelection\s*=|selectEphemeralBrandFromSwitcher/, "catalog results must never automatically select first or only Brand");
assert.match(load, /!state\.brandCatalog\.entries\.some[\s\S]{0,180}clearEphemeralBrandSwitcherSelection/, "catalog invalidation must clear a missing selection");
assert.match(app, /previousUserEmail !== currentUserEmail\) clearEphemeralBrandSwitcherSelection/, "account changes must clear selection");
assert.match(load, /response\.status === 401[\s\S]{0,160}clearEphemeralBrandSwitcherSelection/, "catalog authentication loss must clear selection");
assert.match(app, /state\.user = null;[\s\S]{0,220}clearEphemeralBrandSwitcherSelection/, "sign-out must clear before its request can complete");
assert.doesNotMatch(selectionScope, /fetch\(|XMLHttpRequest|sessionStorage|document\.cookie|indexedDB|history\.|location\.|brandCore|boardsLibrary|currentBoard|canvas|autosave/i, "selection must not navigate, read details, write APIs, or affect Boards and Canvas");
assert.doesNotMatch(boot, /loadCanonicalBrandCatalog|selectEphemeralBrandFromSwitcher|ephemeralBrandSwitcherSelection/, "startup and direct Board loading must remain independent");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|selectedBrand|ephemeralBrandSwitcherSelection)/, "selection must not become application-wide authority");
assert.match(render, /replaceChildren\(\)/, "rerenders must replace rather than duplicate catalog entries");
assert.strictEqual((app.match(/brandSwitcherNoBrand\?\.addEventListener\("click"/g) || []).length, 1, "No Brand must have exactly one static handler");
for (const state of ["loading", "unauthenticated", "forbidden", "error", "malformed", "success"]) {
  assert.match(render, new RegExp(`catalog\\.status === "${state}"`), `${state} must have a safe presentation`);
}

console.log("BW-2 ephemeral Canonical Brand selection checks passed.");
