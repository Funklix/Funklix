#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync(require("path").join(__dirname, "..", "app.js"), "utf8");

assert.match(app, /id="brand-core-founder-story-website-import-button"/);
assert.match(app, /fetch\("\/api\/extract-website-text"/);
assert.match(app, /fetch\("\/api\/map-founder-story-website"/);
assert.match(app, /let activeFounderStoryWebsiteImport = null/);
assert.match(app, /controller\.abortController\?\.abort\(\)/);
assert.match(app, /activeFounderStoryWebsiteImport !== controller/);
assert.match(app, /tile !== controller\.tile/);
assert.match(app, /state\.currentBoardId \|\| getBoardIdFromPath/);
assert.match(app, /if \(!context\.ok \|\| controller\.inFlight\) return/);
assert.match(app, /selected: !getMeaningfulFounderStoryValue\(current\[key\]\)/);
assert.match(app, /if \(!textarea\.value\.trim\(\)\) \{ checkbox\.checked = false/);
assert.match(app, /saveFounderStoryModuleData\(latest\.tile, next\);\s*saveBrandBrainState\(\)/);
assert.doesNotMatch(app.slice(app.indexOf("function openFounderStoryWebsiteImport"), app.indexOf("function renderFounderStoryCustomTileEditor")), /tile\.content\s*=/);
assert.match(app, /if \(event\.key === "Escape"\)/);
assert.match(app, /if \(event\.target === overlay\) close\(\)/);
assert.match(app, /controller\.draft = null/);
console.log("Founder Story website import lifecycle checks passed (draft, apply, cancellation, and stale identity guards).");
