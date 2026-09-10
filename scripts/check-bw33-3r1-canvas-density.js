#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const densitySource = read("canvas-density.js");
const index = read("index.html");
const css = read("styles.css");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} missing`);
  const params = source.indexOf("(", start);
  let parenDepth = 0;
  let brace = -1;
  for (let i = params; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    if (source[i] === ")") parenDepth -= 1;
    if (parenDepth === 0) { brace = source.indexOf("{", i); break; }
  }
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is incomplete`);
}

// Preference module: exact-key schema, no evaluation-time read, session fallback on write failure.
const storageData = new Map();
const storage = { getItem: (key) => storageData.get(key) ?? null, setItem: (key, value) => storageData.set(key, value) };
const moduleContext = { globalThis: {} };
vm.runInNewContext(densitySource, moduleContext, { filename: "canvas-density.js" });
const density = moduleContext.globalThis.TendraOnePresentation.canvasDensity;
assert.strictEqual(storageData.size, 0, "module evaluation touched storage");
assert.strictEqual(density.readPreference(storage), "compact");
for (const mode of ["compact", "standard", "detailed"]) {
  assert.strictEqual(density.remember(mode, storage), mode);
  assert.deepStrictEqual(JSON.parse(storageData.get("tendra.canvasDensity.v1")), { version: 1, mode });
}
storageData.set(density.STORAGE_KEY, "not-json");
assert.strictEqual(density.readPreference(storage), "compact");
assert.strictEqual(density.remember("standard", { setItem() { throw new Error("quota"); } }), "standard");
assert.strictEqual(density.currentMode(), "standard");

// Execute the production activation/application functions with a deterministic browser-runtime shell.
const events = [];
const canvas = { setAttribute(name, value) { this[name] = value; events.push(`marker:${value}`); } };
const state = { currentBoardId: "board-a", boardLoadGeneration: 7, isBoardLoading: true, isBoardHydrating: true, boardAccess: { canView: true } };
const context = {
  state, document: {}, localStorage: storage, el: { canvas }, globalThis: { TendraOnePresentation: { canvasDensity: density } },
  requestAnimationFrame(callback) { events.push("redraw-scheduled"); callback(); },
  drawLinks() { events.push("redraw"); },
  setTimeout(callback) { context.pending = callback; },
  updateCanvasDensityMenuState() { events.push("menu"); }
};
vm.createContext(context);
for (const name of ["applyCanvasDensityPresentation", "schedulePostHydrationCanvasDensity"]) {
  vm.runInContext(`${functionSource(app, name)}; this.${name}=${name};`, context);
}
context.schedulePostHydrationCanvasDensity(7, "board-a");
assert.deepStrictEqual(events, [], "density touched DOM while hydration was pending");
context.pending();
assert.deepStrictEqual(events, [], "pending Board activated density");
state.isBoardLoading = false; state.isBoardHydrating = false;
context.schedulePostHydrationCanvasDensity(7, "board-a"); context.pending();
assert.strictEqual(canvas["data-tendra-canvas-density"], "compact");
assert.deepStrictEqual(events, ["marker:compact", "menu", "redraw-scheduled", "redraw"]);

const protectedSnapshot = JSON.stringify({ boardId: state.currentBoardId, nodes: [{ id: "node-1", position: { x: 10, y: 20 }, width: 320, height: 240 }], dirty: false, history: [], inspector: "node-1" });
for (const failure of ["preference-read", "marker", "menu", "redraw"]) {
  events.length = 0;
  const original = { read: density.readPreference, marker: density.applyMarker, menu: context.updateCanvasDensityMenuState, redraw: context.drawLinks };
  if (failure === "preference-read") context.globalThis.TendraOnePresentation.canvasDensity = { ...density, readPreference() { throw new Error(failure); } };
  if (failure === "marker") context.globalThis.TendraOnePresentation.canvasDensity = { ...density, applyMarker() { throw new Error(failure); } };
  if (failure === "menu") context.updateCanvasDensityMenuState = () => { throw new Error(failure); };
  if (failure === "redraw") context.drawLinks = () => { throw new Error(failure); };
  context.schedulePostHydrationCanvasDensity(7, "board-a");
  assert.doesNotThrow(() => context.pending(), `${failure} escaped density boundary`);
  assert.strictEqual(state.currentBoardId, "board-a");
  context.globalThis.TendraOnePresentation.canvasDensity = density;
  context.updateCanvasDensityMenuState = original.menu;
  context.drawLinks = original.redraw;
}
assert.strictEqual(JSON.stringify({ boardId: state.currentBoardId, nodes: [{ id: "node-1", position: { x: 10, y: 20 }, width: 320, height: 240 }], dirty: false, history: [], inspector: "node-1" }), protectedSnapshot);

const loadBody = functionSource(app, "loadBoardFromUrlIfPresent");
assert(loadBody.indexOf("applyCampaignState(normalizedCanvasState") < loadBody.indexOf("schedulePostHydrationCanvasDensity(loadGeneration, data.id)"));
for (const renderer of ["applyCampaignState", "renderNode", "updateNodeCard"]) {
  const body = functionSource(app, renderer);
  assert(!body.includes("CanvasDensity") && !body.includes("canvasDensity") && !body.includes("canvas-density"), `${renderer} owns density`);
}
assert(!functionSource(app, "bootApp").includes("CanvasDensity"), "boot activates density");
assert(!functionSource(app, "applyCanvasDensityPresentation").match(/applyCampaignState|renderNode|updateNodeCard|saveCampaignCanvasState|saveBoardToServer/));
assert(index.indexOf("/canvas-density.js") < index.indexOf("/app.js"));
assert(css.includes('#canvas[data-tendra-canvas-density="compact"] #zoom-layer > .node'));
assert(!css.includes('body[data-tendra-canvas-density') && !css.includes('html[data-tendra-canvas-density'));
assert(app.includes('role="menuitemradio"') && app.includes('aria-checked='));

// The locally auditable historical BW-33.3 tree must exhibit the unsafe renderer/boot coupling.
try {
  const historical = execFileSync("git", ["show", "783fda913254788d0832711bf086436dbeb89c73:app.js"], { cwd: root, encoding: "utf8" });
  assert(functionSource(historical, "bootApp").includes("applyCanvasDensity"), "historical pre-session activation was not detected");
  assert(functionSource(historical, "updateNodeCard").includes("canvasDensity"), "historical renderer coupling was not detected");
} catch (error) {
  if (error instanceof assert.AssertionError) throw error;
  throw new Error(`historical regression comparison unavailable: ${error.message}`);
}

console.log("BW-33.3R1 deterministic post-hydration Canvas-density regression checks passed.");
