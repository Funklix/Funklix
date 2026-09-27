"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const journey = fs.readFileSync("persona-journey-simulator.js", "utf8");
const pkg = require("../package.json");
const workflow = fs.readFileSync(".github/workflows/runtime-boot-safety.yml", "utf8");

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  process.stdout.write(`✓ ${name}\n`);
}
function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function element(source, start, close) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `${start} exists`);
  const to = source.indexOf(close, from);
  assert.notEqual(to, -1, `${close} exists`);
  return source.slice(from, to + close.length);
}
function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = source.indexOf("{", start);
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is incomplete`);
}

const topbar = element(html, '<header class="topbar" id="canvas-topbar">', "</header>");
const visibilitySource = functionSource(app, "activeSurfaceIsCanvas");
const toolbarClasses = new Set();
const visibilityContext = {
  state: { activeView: "home", appMode: "canvas" },
  el: { canvasTopbar: { classList: { toggle(name, force) { if (force) toolbarClasses.add(name); else toolbarClasses.delete(name); } } } }
};
vm.runInNewContext(`${visibilitySource}\n${functionSource(app, "synchronizeCanvasToolbarVisibility")}; this.decide = activeSurfaceIsCanvas; this.applyVisibility = synchronizeCanvasToolbarVisibility;`, visibilityContext);
const activeSurfaceIsCanvas = visibilityContext.decide;
const sections = ["home", "boards_library", "list", "calendar", "content_workspace", "brand-core", "ai_brain", "insights", "funnel_simulator", "settings", "bounded_unknown"];

function projectedToolbar(view, appMode = "canvas") {
  visibilityContext.state.activeView = view;
  visibilityContext.state.appMode = appMode;
  visibilityContext.applyVisibility(view);
  const hidden = toolbarClasses.has("hidden");
  return { hidden, display: hidden ? "none" : "flex", offsetHeight: hidden ? 0 : 96 };
}

check("restored pre-BW-36.1 toolbar DOM is byte-for-byte preserved", () => {
  assert.equal(sha(topbar), "140fd2043d605c8a7f69493c05dac806ed318962578bb8e4bfab9abcd4e589d1");
  assert.equal((html.match(/id="canvas-topbar"/g) || []).length, 1);
  assert.equal((html.match(/class="actions canvas-toolbar"/g) || []).length, 1);
});

check("reverted contextual architecture and forbidden Canvas labels stay absent", () => {
  assert.doesNotMatch(html, /contextual-header|contextual-open-canvas|header-account-controls/);
  assert.doesNotMatch(app, /deriveHeaderModel|renderContextualHeader|HEADER_MODE_BY_VIEW/);
  assert.doesNotMatch(topbar, /ACCOUNT|HOME|CURRENT BRAND|CURRENT BOARD/i);
});

check("Canvas retains every restored toolbar control and account placement", () => {
  ["create-campaign-btn", "add-node-btn", "undo-btn", "node-search-input", "filters-toggle-btn", "utilities-toggle-btn", "board-access-cluster", "presence-lite", "copy-board-link-btn", "theme-quick-control", "auth-panel", "auth-avatar", "auth-name", "auth-email", "auth-signout-btn"].forEach((id) => assert.match(topbar, new RegExp(`id="${id}"`), id));
  assert.deepEqual(projectedToolbar("board"), { hidden: false, display: "flex", offsetHeight: 96 });
});

check("visibility is exactly the established active section's Canvas predicate", () => {
  assert.match(visibilitySource, /return view === "board" && state\.appMode !== "brand"/);
  assert.match(functionSource(app, "synchronizeCanvasToolbarVisibility"), /canvasTopbar\?\.classList\.toggle\("hidden", !activeSurfaceIsCanvas\(view\)\)/);
  assert.match(functionSource(app, "setActiveView"), /canvasTopbar\?\.classList\.toggle\("hidden", view !== "board" \|\| state\.appMode === "brand"\)/);
  visibilityContext.state.activeView = "home";
  assert.equal(activeSurfaceIsCanvas(), false, "default reads state.activeView");
  assert.equal(activeSurfaceIsCanvas("board"), true);
  visibilityContext.state.appMode = "brand";
  assert.equal(activeSurfaceIsCanvas("board"), false, "Brand mode cannot expose Canvas commands");
  visibilityContext.state.appMode = "canvas";
});

check("all mapped and fallback non-Canvas sections contribute zero toolbar layout", () => {
  for (const section of sections) {
    assert.deepEqual(projectedToolbar(section), { hidden: true, display: "none", offsetHeight: 0 }, section);
  }
});

check("Settings uses the same visibility boundary and restores the active section", () => {
  assert.match(app, /synchronizeCanvasToolbarVisibility\("settings"\)/);
  assert.match(app, /synchronizeAppShell\(\{ view: "settings" \}\)/);
  assert.match(app, /settingsDialog\?\.addEventListener\("close",[\s\S]*?synchronizeCanvasToolbarVisibility\(\)[\s\S]*?synchronizeAppShell\(\)/);
});

check("navigation and resize do not recreate the toolbar, duplicate listeners, fetch Boards, or alter section state", () => {
  assert.equal((html.match(/id="canvas-topbar"/g) || []).length, 1);
  assert.equal((app.match(/addEventListener\(["']resize["']/g) || []).length, 2, "unchanged bounded resize listeners");
  const resizeBlocks = [...app.matchAll(/addEventListener\(["']resize["'][\s\S]{0,240}/g)].map((match) => match[0]).join("\n");
  assert.doesNotMatch(resizeBlocks, /setActiveView|loadBoard|fetch\(/);
  assert.doesNotMatch(functionSource(app, "setActiveView"), /cloneNode|insertAdjacentHTML|addEventListener/);
});

check("page-owned actions remain in their existing owners", () => {
  ["dashboard-view", "boards-library-view", "content-workspace-view", "brand-core-workspace", "ai-brain-view", "insights-view", "funnel-simulator-view", "settings-dialog"].forEach((id) => assert.match(html, new RegExp(`id="${id}"`), id));
  assert.match(app, /renderContentWorkspace\(\)/);
  assert.match(app, /renderCalendarView\(\)/);
  assert.match(app, /renderCampaignIntelligence\(\)/);
  assert.match(app, /renderFunnelSimulator\(\)/);
});

check("only the audited compact journey navigation rule changed presentation CSS", () => {
  const repaired = ".journey-nav{position:static;inset:auto;min-height:0;height:auto;padding:8px 8px max(8px,env(safe-area-inset-bottom,0px));background:transparent;border-radius:0}";
  const baseline = ".journey-nav{position:sticky;bottom:4px;padding:8px;background:var(--fk-color-surface-elevated);border-radius:12px}";
  assert.match(css, new RegExp(repaired.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(sha(css.replace(repaired, baseline)), "06771fe0f41453d3afa5661e593866fba37fc1c6315699283532732c138bb755", "all non-Funnel CSS remains at the restored baseline");
});

check("compact journey actions are in flow, bounded, transparent, safe-area padded, and reachable", () => {
  assert.match(css, /@media\(max-width:768px\)[\s\S]*?\.journey-nav\{position:static;inset:auto;min-height:0;height:auto;/);
  assert.doesNotMatch(css, /@media\(max-width:768px\)[^@]*?\.journey-nav\{[^}]*position:(?:sticky|fixed)/);
  assert.match(css, /\.journey-nav\{[^}]*padding:8px 8px max\(8px,env\(safe-area-inset-bottom,0px\)\);background:transparent/);
  assert.match(css, /\.journey-nav button\{flex:1\}/);
  assert.match(css, /\.journey-nav button,.journey-playback-controls button,.journey-run\{min-height:44px\}/);
  const navRenderer = journey.slice(journey.indexOf("const nav=node('div','journey-nav')"), journey.indexOf("shell.append(nav", journey.indexOf("const nav=node('div','journey-nav')")));
  assert.ok(navRenderer.indexOf("button(c.back") < navRenderer.indexOf("const next=button(c.next"), "Back remains before Continue");
  assert.match(navRenderer, /next\.disabled=/, "disabled semantics remain");
});

check("Funnel state survives theme/resize and both themes retain compatible tokens", () => {
  assert.doesNotMatch(journey, /addEventListener\(["'](?:resize|change)["']/);
  assert.doesNotMatch(journey, /localStorage|sessionStorage/);
  assert.match(css, /html\[data-theme=dark\] \.journey-simulator-shell/);
  assert.match(css, /color:var\(--fk-color-text-primary\)/);
  assert.match(css, /html \{ overflow-x: clip; \}/);
});

check("visibility is presentation-only and leaves planning/export sessions untouched", () => {
  assert.doesNotMatch(visibilitySource, /fetch|render|reset|invalidate|currentBoardId|proposal|export/i);
  assert.doesNotMatch(visibilitySource, /state\.[A-Za-z_$][\w$]*\s*=/, "predicate does not mutate application state");
  const synchronization = functionSource(app, "synchronizeAppShell");
  assert.doesNotMatch(synchronization, /fetch\(|saveBoard|updateBoard|localStorage|sessionStorage/);
});

check("no dependency, migration, provider, AI, or mutation boundary was added", () => {
  assert.equal(pkg.scripts["check:bw36.1r1"], "node scripts/check-bw36-1r1-canvas-toolbar-visibility-and-funnel-footer.js");
  assert.equal(pkg.scripts["check:bw36.1"], undefined, "reverted check stays unregistered");
  assert.match(workflow, /run: npm run check:bw36\.1r1/);
  const productionDelta = `${visibilitySource}\n${css.match(/\.journey-nav\{position:static;[^}]+\}/)?.[0] || ""}`;
  assert.doesNotMatch(productionDelta, /fetch|XMLHttpRequest|provider|openai|anthropic|INSERT|UPDATE|DELETE|migration|schedule|approval|publication|social/i);
  assert.deepEqual(pkg.dependencies, { "@vercel/blob": "latest", pg: "^8.13.1" }, "runtime dependencies remain at the restored baseline");
});

assert.ok(checks >= 13, `expected focused coverage, received ${checks}`);
console.log(`BW-36.1R1 Canvas toolbar visibility and Funnel footer checks passed (${checks} groups).`);
