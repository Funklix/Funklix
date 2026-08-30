#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("styles.css");
const app = read("app.js");
const html = read("index.html");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const packageJson = JSON.parse(read("package.json"));
const has = (source, value, message) => assert(source.includes(value), message || `Missing ${value}`);

const darkStart = css.indexOf('html[data-theme="dark"] {');
const darkEnd = css.indexOf("}\n", darkStart);
assert(darkStart >= 0 && darkEnd > darkStart, "Missing authoritative Dark Mode token block");
const dark = css.slice(darkStart, darkEnd + 1);
const token = (name) => {
  const match = dark.match(new RegExp(`${name}:([^;]+)`));
  assert(match, `Missing ${name}`);
  return match[1].trim();
};
const rgb = (hex) => {
  assert(/^#[0-9a-f]{6}$/i.test(hex), `Expected hex fixture for ${hex}`);
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
};
const luminance = (hex) => rgb(hex).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
const expectContrast = (label, foreground, background, minimum = 4.5) => assert(contrast(foreground, background) >= minimum, `${label} contrast is below ${minimum}:1`);

// 1–3: premium palette and genuinely distinct hierarchy.
const exactTokens = {
  "--fk-color-app-bg":"#0b1020", "--fk-color-nav-bg":"#0f1528", "--fk-color-canvas-bg":"#0c1222", "--fk-color-page-bg":"#0d1324",
  "--fk-color-surface-panel":"#121a2e", "--fk-color-surface-card":"#161f35", "--fk-color-surface-elevated":"#1b2540", "--fk-color-surface-input":"#11192d",
  "--fk-color-text-primary":"#f4f6fc", "--fk-color-text-secondary":"#bac3d8", "--fk-color-text-muted":"#8894ae", "--fk-color-text-subtle":"#69758e",
  "--fk-color-primary-action":"#7c5cff", "--fk-color-primary-hover":"#8b72ff", "--fk-color-primary-active":"#6e4fea",
  "--fk-color-success":"#4fd1a1", "--fk-color-warning":"#e8bd63", "--fk-color-danger":"#f27d8a", "--fk-color-information":"#69a7ff"
};
Object.entries(exactTokens).forEach(([name, value]) => assert.strictEqual(token(name), value, `${name} drifted`));
assert.strictEqual(new Set(["--fk-color-app-bg","--fk-color-page-bg","--fk-color-surface-panel","--fk-color-surface-card","--fk-color-surface-elevated","--fk-color-surface-input"].map(token)).size, 6, "Surface levels must remain distinct");

// 4–34: authoritative, product-scoped Dark Mode treatment.
[
  "premium Dark Mode shell", ".app-shell", "--fk-color-page-bg", "Campaign Canvas", "--fk-color-canvas-grid", ".node {", "data-node-role", "--fk-color-role-visual-accent", "color-mix(in srgb,var(--node-role-accent", ".ai-review-card", ".ai-review-section-strengths", ".postit {",
  "Inspector:", ".inspector .inspector-section.fk-card", ".inspector .node-form :is(.fk-input,.fk-select,.fk-textarea)",
  "Dashboard:", "#dashboard-view .mission-hero", "#dashboard-view :is(.dashboard-continue-working,.mission-card,.mission-focus)", ".dashboard-campaign-progress",
  "Brand Workspace:", ".brand-core-workspace .brand-workspace-hero", ".brand-core-workspace :is(.brand-workspace-group,.brand-core-side)", ".brand-core-workspace :is(.bc-node,.bc-main", ".brand-core-workspace :is(input,textarea,select)",
  "AI Brain:", "#ai-brain-view { min-height:100%", ".ai-brain-header h3", ".ai-brain-composer textarea", ".ai-brain-empty,.ai-brain-unavailable",
  "AI Insights:", "#insights-view { min-height:100%", ".insights-section h3", ".insight-card,.insights-diagnostic-state", "#boards-library-view .board-row", ".settings-dialog", ".fk-btn-destructive"
].forEach((value) => has(css, value));

// 35–41: guardrails preserve scoped theming, geometry, DOM, state isolation, and Light Mode.
assert(!/html\[data-theme="dark"\][^{]*\{[^}]*color\s*:\s*(?:#fff(?:fff)?|white)\s*;/s.test(css), "Global white foreground override introduced");
assert(!/html\[data-theme="dark"\]\s+\*/.test(css), "Universal Dark Mode override introduced");
assert(!/body[^{}]*\{[^}]*!important/s.test(css), "Body-wide important patch introduced");
["width: 285px", "min-height: 220px", "max-height: 52vh"].forEach((fixture) => has(css, fixture, `Canvas geometry fixture changed: ${fixture}`));
["canvas","canvas-scroll-surface","inspector-panel","dashboard-view","boards-library-view","insights-view","ai-brain-view","brand-core-workspace"].forEach((id) => has(html, `id="${id}"`));
assert(!/funklix:themechange[\s\S]{0,500}(?:saveCampaignCanvasState|markBoardDirty|generateCampaign)/.test(app), "Theme switching mutates product state");
has(css, ':root, html[data-theme="light"]');

// 42–45: regression scripts, browser integrity, and adjacent workflow registration.
["check:bw26","check:bw26.3","check:bw26.4","check:bw26.5","check:bw26.6","check:bw26.6.1","check:bw26.6.2","check:bw27","check:bw27.1"].forEach((name) => assert(packageJson.scripts[name], `Missing compatibility script ${name}`));
has(read("scripts/check-browser-script-integrity.js"), "app.js");
assert.strictEqual(packageJson.scripts["check:bw27.2"], "node scripts/check-bw27-2-premium-dark-mode.js");
const bw271 = workflow.indexOf("node scripts/check-bw27-1-dark-mode-surface-contrast.js");
const bw272 = workflow.indexOf("node scripts/check-bw27-2-premium-dark-mode.js");
assert(bw271 >= 0 && bw272 > bw271 && workflow.slice(bw271, bw272).split("\n").length <= 4, "BW-27.2 must follow BW-27.1 directly");

// Deterministic token contrast fixtures support, but do not substitute for, visual review.
const pairs = [
  ["app primary", token("--fk-color-text-primary"), token("--fk-color-app-bg"), 4.5], ["panel primary", token("--fk-color-text-primary"), token("--fk-color-surface-panel"), 4.5],
  ["panel secondary", token("--fk-color-text-secondary"), token("--fk-color-surface-panel"), 4.5], ["card primary", token("--fk-color-text-primary"), token("--fk-color-surface-card"), 4.5],
  ["card secondary", token("--fk-color-text-secondary"), token("--fk-color-surface-card"), 4.5], ["input entered", token("--fk-color-text-primary"), token("--fk-color-surface-input"), 4.5],
  ["input placeholder", token("--fk-color-text-muted"), token("--fk-color-surface-input"), 4.5], ["primary button", token("--fk-color-button-primary-text"), token("--fk-color-primary-action"), 4.5],
  ["focus on app", token("--fk-color-focus-ring"), token("--fk-color-app-bg"), 3], ["focus on panel", token("--fk-color-focus-ring"), token("--fk-color-surface-panel"), 3]
];
pairs.forEach(([label, foreground, background, minimum]) => expectContrast(label, foreground, background, minimum));
["success","warning","danger","information"].forEach((state) => expectContrast(state, token(`--fk-color-${state}`), token("--fk-color-surface-panel"), 3));

console.log("BW-27.2 premium Dark Mode checks passed (45 contracts plus 14 contrast fixtures). Visual quality still requires human review.");
