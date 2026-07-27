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
assert.match(app, /saveFounderStoryModuleData\(latest\.tile, next\);[\s\S]*saveBoardToServer\("founder-story-source-facts"\)/);
assert.doesNotMatch(app.slice(app.indexOf("function renderFounderStoryWebsiteImportReview"), app.indexOf("async function startFounderStoryWebsiteImport")), /persistFounderStoryAcceptance/, "website suggestions must not accept a Founder Story");
assert.doesNotMatch(app.slice(app.indexOf("function openFounderStoryWebsiteImport"), app.indexOf("function renderFounderStoryCustomTileEditor")), /tile\.content\s*=/);
assert.match(app, /if \(event\.key === "Escape"\)/);
assert.match(app, /if \(event\.target === overlay\) close\(\)/);
assert.match(app, /controller\.draft = null/);
for (const message of [
  "The URL is invalid.", "This destination cannot be accessed securely.",
  "The webpage redirected to an unsupported destination.", "The webpage took too long to respond.",
  "The webpage response was too large.", "This page does not provide supported HTML content.",
  "No usable text could be extracted from this page.", "The webpage rejected the retrieval request.",
  "The webpage could not be reached. Please try again."
]) assert.ok(app.includes(message), `missing stable client message: ${message}`);
const retrievalFailureHandler = app.slice(app.indexOf("} catch (failure) {", app.indexOf("async function startFounderStoryWebsiteImport")), app.indexOf("function openFounderStoryWebsiteImport"));
assert.doesNotMatch(retrievalFailureHandler, /saveFounderStoryModuleData|saveBrandBrainState/, "retrieval failures must produce zero Founder Story mutation");
console.log("Founder Story website import lifecycle checks passed (draft, apply, cancellation, and stale identity guards).");
