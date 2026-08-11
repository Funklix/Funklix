#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
function source(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const nextFunction = app.indexOf("\nfunction ", start + 1);
  const nextAsyncFunction = app.indexOf("\nasync function ", start + 1);
  const candidates = [nextFunction, nextAsyncFunction].filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return app.slice(start, next < 0 ? app.length : next);
}

const key = source("brandSwitcherPreferenceKey");
const persist = source("persistBrandSwitcherPreference");
const restore = source("restoreBrandSwitcherPreference");
const select = source("selectEphemeralBrandFromSwitcher");
const clear = source("clearEphemeralBrandSwitcherSelection");
const load = source("loadCanonicalBrandCatalog");
const create = source("submitCanonicalBrandCreation");

assert.match(key, /subtle\.digest\("SHA-256"/, "account keys must use an opaque digest, not raw identity");
assert.doesNotMatch(key, /localStorage/, "identity must be transformed before storage access");
assert.match(persist, /JSON\.stringify\(\{ v: BRAND_SWITCHER_PREFERENCE_VERSION, brandId \}\)/, "payload must contain only version and Brand ID");
assert.doesNotMatch(persist, /JSON\.stringify\([^\n]*(?:name|brand_core|token|session|response|userEmail)/i, "payload must contain no summaries or authentication data");
assert.match(select, /state\.brandCatalog\.status !== "success"/, "explicit selection must originate in a successful catalog");
assert.match(select, /persistBrandSwitcherPreference/, "an explicit row selection must persist");
assert.match(clear, /persist && userEmail[\s\S]*removeBrandSwitcherPreference/, "explicit No Brand must remove persistence");
assert.match(restore, /JSON\.parse/, "storage must be parsed as untrusted input");
assert.match(restore, /Object\.keys\(parsed\)\.length === 2/, "extra stored summary data must be rejected");
assert.match(restore, /entries\.find\(\(\{ id \}\) => id === parsed\.brandId\)/, "catalog membership must validate restoration");
assert.match(restore, /state\.brandCatalog\.status !== "success"/, "restoration requires authoritative success");
assert.match(restore, /requestId !== state\.brandCatalog\.requestId/, "late requests must not restore");
assert.match(load, /await restoreBrandSwitcherPreference/, "lazy catalog success must trigger validation");
assert.match(load, /const preferenceGeneration = brandSwitcherPreferenceGeneration[\s\S]*restoreBrandSwitcherPreference\([^\n]*preferenceGeneration\)/, "explicit clearing or selection must invalidate pending restoration");
assert.doesNotMatch(create, /persistBrandSwitcherPreference|restoreBrandSwitcherPreference/, "creation must not select or persist");
assert.match(app, /brandSwitcherNoBrand\?\.addEventListener\("click"[\s\S]{0,140}persist: true/, "No Brand click must deliberately clear persistence");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|currentBrand|selectedBrand)/, "no authoritative Brand global may be introduced");
assert.doesNotMatch(`${persist}\n${restore}\n${select}`, /fetch\(|XMLHttpRequest|history\.|location\.|brand_id|brandCore|canvas|autosave|boardsLibrary/i, "persistence must remain presentation-only");

console.log("BW-4 durable Workspace Brand selection checks passed.");
