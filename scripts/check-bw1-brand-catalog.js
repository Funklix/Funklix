#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

assert.match(html, /id="brand-switcher-details"/, "existing switcher must expose the lazy catalog trigger");
assert.match(html, /id="brand-switcher-catalog" role="status"/, "catalog states must be announced");
assert.match(html, /aria-current="true"[\s\S]*No Brand selected/, "No Brand selected must remain effective");
assert.match(styles, /\.brand-switcher-catalog-entry[\s\S]*cursor: pointer/, "catalog entries must remain visibly available");

const loader = functionSource("loadCanonicalBrandCatalog");
const renderer = functionSource("renderBrandCatalog");
assert.match(loader, /fetch\("\/api\/brands", \{ headers: \{ Accept: "application\/json" \} \}\)/, "catalog must use the existing summary API");
assert.doesNotMatch(loader, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/, "catalog must never write Brands");
assert.doesNotMatch(loader, /\/api\/brands\//, "catalog must never load Canonical Brand details");
assert.match(loader, /response\.status === 401/, "expired authentication must be handled");
assert.match(loader, /response\.status === 403/, "authorization failure must be handled");
assert.match(loader, /Array\.isArray\(data\.brands\)/, "empty and populated summary arrays must be validated");
assert.match(loader, /requestId !== state\.brandCatalog\.requestId/, "late requests must be ignored");
assert.doesNotMatch(renderer, /entry\.disabled = true/, "BW-2 may make summary rows explicitly selectable");
assert.doesNotMatch(loader + renderer, /localStorage|sessionStorage|document\.cookie|history\.|location\./, "catalog must not restore or persist selection");
assert.doesNotMatch(loader + renderer, /state\.session|state\.brandCore|boardsLibrary|canvas|autosave/i, "catalog must remain independent of active context, Boards, and Canvas");
assert.doesNotMatch(app, /brandCatalog[^\n]*(?:active|selected)Brand|activeBrand[^\n]*brandCatalog/i, "catalog must not become active Brand authority");

const boot = functionSource("bootApp");
assert.doesNotMatch(boot, /loadCanonicalBrandCatalog|\/api\/brands/, "browser startup and direct Board loading must not wait for the catalog");
assert.match(app, /brandSwitcherDetails\?\.addEventListener\("toggle"[\s\S]{0,180}\.open\) void loadCanonicalBrandCatalog/, "catalog must load lazily when opened");
assert.match(app, /state\.brandCatalog = \{ status: "unauthenticated"[\s\S]{0,160}renderBrandCatalog\(\)/, "sign-out must invalidate late catalog state");

console.log("BW-1 read-only Canonical Brand catalog checks passed.");
