#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

for (const label of ["Workspace", "Brand", "No Brand selected", "Boards", "Campaign Canvas"]) {
  assert(html.includes(label), `missing passive hierarchy label: ${label}`);
}

assert.match(html, /aria-label="Workspace Brand context"/, "Workspace/Brand context must be semantic");
assert.match(html, /Boards remain available in this Workspace/, "no-Brand state must leave Boards available");
assert.match(html, /Board Brand Core/, "Brand Core must be identified as Board-scoped");
assert.match(html, /Saved with the current Board\./, "Brand Core snapshot persistence must be explained");
assert.match(html, /without changing a Canonical Brand/, "Board editor must not imply Canonical Brand mutation");

// These are every pre-existing ID in the sidebar and the affected Brand Core shell.
for (const id of [
  "left-sidebar", "sidebar-toggle-btn", "home-nav-btn", "campaign-canvas-nav-btn",
  "boards-nav-btn", "brand-core-nav-btn", "ai-brain-nav-btn", "insights-nav-btn",
  "activity-panel", "activity-toggle-btn", "activity-count", "activity-feed",
  "brand-core-workspace", "brand-workspace-avatar", "brand-workspace-title",
  "brand-workspace-name", "brand-workspace-readiness-label",
  "brand-workspace-readiness-detail", "reset-brand-core-btn", "brand-core-canvas",
  "bc-editor-title", "bc-editor-panel"
]) {
  assert(html.includes(`id="${id}"`), `affected pre-existing DOM ID missing: ${id}`);
}

assert.doesNotMatch(app, /\/api\/brands/, "app.js must not request Canonical Brands");
assert.doesNotMatch(html + app, /BrandClientFoundation/, "Brand client global must not exist");
assert.doesNotMatch(html, /<script[^>]+(?:brand-client|brand_client)[^>]*>/i, "Brand client script must not be added");

const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
assert.strictEqual(scripts.at(-1), "/app.js", "app.js must remain the final application script");
assert.strictEqual(scripts.filter((src) => src === "/app.js").length, 1, "app.js must load exactly once");
assert.doesNotMatch(html, /data-(?:active-)?brand-id|data-workspace-id/, "passive shell must not declare active runtime state");

console.log("Workspace / Brand passive shell contract checks passed.");
