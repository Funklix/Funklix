#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const route = fs.readFileSync(path.join(root, "api/boards/[id].js"), "utf8");

function source(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const candidates = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((index) => index >= 0);
  return app.slice(start, candidates.length ? Math.min(...candidates) : app.length);
}

const open = source("openBoardBrandAssociation");
const submit = source("submitBoardBrandAssociation");
const invalidate = source("invalidateBoardBrandAssociation");
const selectWorkspace = source("selectEphemeralBrandFromSwitcher");
const restoreWorkspace = source("restoreBrandSwitcherPreference");
const createBrand = source("submitCanonicalBrandCreation");

assert.match(html, /aria-labelledby="board-brand-association-title"/, "association surface must have an accessible name");
assert.match(html, /<label for="board-brand-association-choice">Canonical Brand<\/label>/, "choice must have a real label");
assert.match(app, /No Brand — remove association/, "association removal must be explicit");
assert.match(html, /type="submit">Save association/, "association must require an explicit save");
assert.doesNotMatch(open, /fetch\(|XMLHttpRequest/, "opening association must not write");
assert.doesNotMatch(invalidate, /fetch\(|XMLHttpRequest/, "cancelling association must not write");
assert.match(submit, /status === "submitting"\) return/, "duplicate submissions must be blocked");
assert.match(submit, /state\.brandCatalog\.status !== "success"/, "submission must require an authoritative catalog");
assert.match(submit, /entries\.some\(\(\{ id \}\) => id === targetBrandId\)/, "target ID must be catalog-confirmed");
assert.match(submit, /fetch\(`\/api\/boards\/\$\{boardId\}`/, "association must reuse the Board item API");
assert.match(submit, /method: "PATCH"/, "association must use the existing authenticated PATCH path");
assert.match(submit, /JSON\.stringify\(\{ brand_id: targetBrandId \}\)/, "request must contain only brand_id");
assert.match(submit, /data\.brand_id !== targetBrandId/, "server response must confirm the exact association");
assert.match(submit, /association === state\.boardBrandAssociation/, "late responses must not update replaced state");
assert.doesNotMatch(submit, /localStorage|sessionStorage|location\.|history\.|reload|brandCore|canvas|autosave|saveBoardToServer|persistBrandSwitcherPreference/, "association must not affect Workspace persistence, navigation, Canvas, or unrelated saves");
assert.doesNotMatch(`${selectWorkspace}\n${restoreWorkspace}\n${createBrand}`, /brand_id|submitBoardBrandAssociation|\/api\/boards\//, "selection, restoration, and Brand creation must not associate a Board");
assert.match(route, /hasBrandAssociationUpdate/, "Board route must recognize the focused association update");
assert.match(route, /Object\.keys\(req\.body \|\| \{\}\)\.some\(\(key\) => key !== 'brand_id'\)/, "server must reject mixed association updates");
assert.match(route, /!access\?\.canEdit/, "server must enforce existing Board edit permission");
assert.match(route, /getOwnedBrand\(brandId, user/, "server must validate Brand access from authenticated identity");
assert.match(route, /SET brand_id = \$2, updated_at = NOW\(\)/, "server must persist nullable brand_id");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|currentBrand|selectedBrand)/, "no authoritative active Brand global may be introduced");

console.log("BW-5 explicit Board Brand association checks passed.");
