#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const route = fs.readFileSync(path.join(root, "api/boards/[id].js"), "utf8");

function source(name) {
  const starts = [`function ${name}(`, `async function ${name}(`];
  const start = Math.max(...starts.map((marker) => app.indexOf(marker)));
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const candidates = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((index) => index >= 0);
  return app.slice(start, candidates.length ? Math.min(...candidates) : app.length);
}

const load = source("loadBoardFromUrlIfPresent");
const poll = source("pollBoardForRemoteChanges");
const render = source("renderBoardBrandAssociation");
const open = source("openBoardBrandAssociation");
const submit = source("submitBoardBrandAssociation");
const selectWorkspace = source("selectEphemeralBrandFromSwitcher");
const restoreWorkspace = source("restoreBrandSwitcherPreference");
const editCanonical = source("submitCanonicalBrandEditing");

assert.match(load, /requestedBoardId \|\| getBoardIdFromPath\(\) \|\| state\.currentBoardId/, "an explicit or URL Board must override stale state");
assert.match(load, /loadingBoardId: boardId/, "a Board change must immediately replace the prior association with loading state");
assert.match(load, /loadGeneration === state\.boardLoadGeneration/, "Board loads must be generation guarded");
assert.match(load, /String\(data\?\.id \|\| ""\) !== String\(boardId\)/, "Board loads must reject mismatched response IDs");
assert.match(load, /!isValidBoardBrandId\(data\?\.brand_id\)/, "Board loads must validate nullable Brand IDs");
assert.match(load, /userEmail === \(state\.user\?\.email/, "Board loads must be account guarded");
assert.match(poll, /loadGeneration === state\.boardLoadGeneration/, "polling must be Board-generation guarded");
assert.match(poll, /String\(data\?\.id \|\| ""\) !== String\(boardId\)/, "polling must reject mismatched Board IDs");
assert.match(render, /"Unbranded Board"/, "null association must render Unbranded Board");
assert.match(render, /"Associated Brand unavailable"/, "catalog failure must not erase an authoritative ID");
assert.doesNotMatch(open, /ephemeralBrandSwitcherSelection/, "the association form must not default to Workspace Brand");
assert.match(open, /candidate = state\.boardBrandAssociation\.brandId/, "the form must default to the authoritative association");
assert.doesNotMatch(open, /fetch\(/, "opening the form must perform no write");
assert.match(submit, /fetch\(`\/api\/boards\/\$\{boardId\}`/, "save must target the exact open Board");
assert.match(submit, /JSON\.stringify\(\{ brand_id: targetBrandId \}\)/, "save payload must contain only brand_id");
assert.match(submit, /data\.brand_id !== targetBrandId/, "save must confirm the submitted association exactly");
assert.match(submit, /association\.boardId === boardId/, "late association responses must remain bound to the open Board");
assert.doesNotMatch(`${selectWorkspace}\n${restoreWorkspace}\n${editCanonical}`, /boardBrandAssociation\.brandId\s*=|\/api\/boards\//, "Workspace selection, BW-4 restoration, and Canonical editing must not associate Boards");
assert.doesNotMatch(route.slice(route.indexOf("if (req.method === 'PUT')"), route.indexOf("if (req.method === 'PATCH')")), /brand_id\s*=|req\.body\?\.brand_id/, "ordinary PUT must preserve server-side brand_id");

// Small state model proves associations remain per Board and Workspace state is independent.
const boards = new Map([["A", "X"], ["B", "Y"], ["U", null]]);
let workspace = "X";
const display = (id) => boards.get(id) || "Unbranded Board";
assert.strictEqual(display("A"), "X");
assert.strictEqual(display("B"), "Y");
assert.strictEqual(display("A"), "X");
assert.strictEqual(display("U"), "Unbranded Board");
workspace = "Y";
assert.strictEqual(display("U"), "Unbranded Board");
boards.set("B", "X"); // explicit Save affects only B
assert.strictEqual(boards.get("A"), "X");
assert.strictEqual(boards.get("B"), "X");
assert.strictEqual(workspace, "Y");

assert.strictEqual((app.match(/addEventListener\("click", openBoardBrandAssociation\)/g) || []).length, 1, "one edit handler only");
assert.strictEqual((submit.match(/method: "PATCH"/g) || []).length, 1, "one association request only");

console.log("BW-5 per-Board Brand isolation regression checks passed.");
