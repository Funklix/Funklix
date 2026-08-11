#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const route = fs.readFileSync(path.join(root, "api/brands/[id].js"), "utf8");
const access = fs.readFileSync(path.join(root, "api/_brand-access.js"), "utf8");

function source(name) {
  const patterns = [`function ${name}(`, `async function ${name}(`];
  const start = Math.min(...patterns.map((pattern) => app.indexOf(pattern)).filter((index) => index >= 0));
  assert.ok(Number.isFinite(start), `missing ${name}`);
  const candidates = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((index) => index >= 0);
  return app.slice(start, candidates.length ? Math.min(...candidates) : app.length);
}

const open = source("openCanonicalBrandDetail");
const load = source("loadCanonicalBrandDetail");
const close = source("closeCanonicalBrandDetail");
const render = source("renderCanonicalBrandDetail");
const catalog = source("loadCanonicalBrandCatalog");
const restore = source("restoreBrandSwitcherPreference");
const create = source("submitCanonicalBrandCreation");
const associate = source("submitBoardBrandAssociation");

assert.match(html, /<dialog[^>]+id="brand-workspace-detail"[^>]+aria-labelledby="brand-workspace-detail-title"/, "detail must be an accessible dialog");
assert.match(html, /Read-only Workspace Brand details\. This is separate from Current Board Brand/, "detail must be distinct from Board content");
assert.match(html, /id="brand-workspace-detail-close"[^>]+aria-label=/, "detail must have an explicit accessible close action");
assert.match(app, /brandWorkspaceDetailOpen\?\.addEventListener\("click", openCanonicalBrandDetail\)/, "detail fetch must begin from a deliberate open action");
assert.doesNotMatch(catalog, /\/api\/brands\/\$\{|loadCanonicalBrandDetail|openCanonicalBrandDetail/, "catalog/switcher opening must not request details");
assert.doesNotMatch(restore, /fetch\(|loadCanonicalBrandDetail|openCanonicalBrandDetail/, "BW-4 restoration must not request details");
assert.doesNotMatch(create, /loadCanonicalBrandDetail|openCanonicalBrandDetail|brandWorkspaceDetail/, "creation must not open or fetch detail");
assert.doesNotMatch(associate, /loadCanonicalBrandDetail|openCanonicalBrandDetail|brandWorkspaceDetail|\/api\/brands\//, "BW-5 association must not affect detail");
assert.match(open, /state\.brandCatalog\.status !== "success"/, "open must require a successful authenticated catalog");
assert.match(open, /state\.brandCatalog\.userEmail !== userEmail/, "open must bind catalog validation to the authenticated account");
assert.match(open, /entries\.some\(\(\{ id \}\) => id === selection\.id\)/, "open target must be catalog-validated");
assert.match(load, /fetch\(`\/api\/brands\/\$\{encodeURIComponent\(selection\.id\)\}`/, "detail must reuse authenticated GET /api/brands/:id");
assert.doesNotMatch(load, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|\/api\/boards|brandCore|canvas|autosave|localStorage|sessionStorage|location\.|history\./, "detail loading must perform no writes, Board work, synchronization, or navigation");
assert.doesNotMatch(`${open}\n${close}\n${render}`, /fetch\([^)]*,\s*\{[^}]*method:|\/api\/boards|save|persistBrandSwitcherPreference|removeBrandSwitcherPreference|brandCore|canvas|autosave/, "detail actions must be read-only and isolated");
assert.match(load, /response\.status === 401/, "expired authentication must be handled");
assert.match(app, /\[403, 404\]\.includes\(status\)/, "forbidden and missing Brands must be unavailable without disclosure");
assert.match(load, /isCanonicalBrandDetail\(brand, selection\.id\)/, "authoritative response must be validated before rendering");
assert.match(load, /canonicalBrandDetail\.requestId !== requestId/, "late and superseded responses must be rejected");
assert.match(load, /ephemeralBrandSwitcherSelection\?\.id === selection\.id/, "selection changes must invalidate visible results");
assert.match(close, /controller\?\.abort\(\)/, "close must abort an in-flight request");
assert.doesNotMatch(close, /persist|localStorage|sessionStorage|brandSwitcherPreference|\/api\//, "close must preserve selection and perform no write");
assert.match(app, /clearEphemeralBrandSwitcherSelection[\s\S]{0,280}closeCanonicalBrandDetail/, "no selection must clear detail locally");
assert.match(app, /brandWorkspaceDetailRetry\?\.addEventListener\("click"/, "retry must require a deliberate click");
assert.match(render, /textContent = readableBrandCoreValue/, "authorized Brand Core fields must render through textContent only");
assert.doesNotMatch(render, /input|textarea|contenteditable|submit|Save/, "ready detail must expose no editing path");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|currentBrand|selectedBrand)/, "no authoritative active Brand global may be introduced");
assert.match(route, /const user = getSessionUser\(req\)/, "Brand item route must authenticate the request");
assert.match(route, /getOwnedBrand\(id, user\)/, "Brand item route must enforce owned access");
assert.match(access, /WHERE id = \$1 AND owner_email = \$2/, "Brand ownership must not derive from Board association");
assert.doesNotMatch(access, /boards|brand_id|editor/, "Board access must not grant Canonical Brand access");
assert.match(app, /addEventListener\("cancel"/, "Escape must use the dialog cancel lifecycle");

console.log("BW-6 read-only Canonical Brand Workspace detail checks passed.");
