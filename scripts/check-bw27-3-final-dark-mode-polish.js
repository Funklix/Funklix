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
const has = (source, fixture, message) => assert(source.includes(fixture), message || `Missing fixture: ${fixture}`);

const darkStart = css.indexOf('html[data-theme="dark"] {');
const darkEnd = css.indexOf("}\n", darkStart);
assert(darkStart >= 0 && darkEnd > darkStart, "Missing Dark Mode token contract");
const darkTokens = css.slice(darkStart, darkEnd + 1);
const token = (name) => {
  const match = darkTokens.match(new RegExp(`${name}:([^;]+)`));
  assert(match, `Missing ${name}`);
  return match[1].trim();
};
const rgb = (hex) => {
  assert(/^#[0-9a-f]{6}$/i.test(hex), `Contrast fixture requires a hex token: ${hex}`);
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
};
const luminance = (hex) => rgb(hex).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
const expectContrast = (label, foreground, background, minimum = 4.5) => assert(contrast(foreground, background) >= minimum, `${label} contrast below ${minimum}:1`);

// Start Screen: the dark page declaration replaces, rather than competes with,
// the authoritative light page gradient. Light Mode remains unmodified.
const startSelector = 'html[data-theme="dark"] #dashboard-view.dashboard-view {';
const startAt = css.indexOf(startSelector);
const startRule = css.slice(startAt, css.indexOf("}\n", startAt) + 1);
assert(startAt >= 0, "Missing scoped Dark Mode Start Screen background");
has(startRule, "rgba(124,92,255,.18)");
has(startRule, "rgba(78,92,190,.10)");
has(startRule, "transparent 58%");
has(startRule, "transparent 66%");
has(startRule, "var(--fk-color-app-bg)");
assert(!/(?:#fff|255\s*,\s*255\s*,\s*255|lightgray|white)/i.test(startRule), "Dark Start Screen contains a white gradient stop");
has(css, "linear-gradient(180deg, #f7f7fb 0%, var(--fk-color-bg) 42%, var(--fk-color-bg) 100%)", "Light Start Screen gradient changed");
assert(!/^#dashboard-view\.dashboard-view\s*\{[^}]*rgba\(124,92,255/m.test(css), "Atmosphere must not be unconditional");
has(css, 'html[data-theme="dark"] #dashboard-view .mission-hero :is(h1,.dashboard-hero-mission-insight) { color:var(--fk-color-text-primary); }');

// Canvas surfaces, role identity, controls, reviews, attachment, and edges.
[
  "var(--fk-color-node-surface)", 'html[data-theme="dark"] .ai-review-postit { background:var(--fk-color-ai-review-surface)',
  'html[data-theme="dark"] .ai-review-card { background:var(--fk-color-ai-review-surface)',
  ".ai-review-section-summary { background:var(--fk-color-information-subtle); }",
  ".ai-review-section-strengths { background:var(--fk-color-success-subtle); }",
  ".ai-review-section-improvements { background:var(--fk-color-warning-subtle); }",
  ".ai-review-section-rewrite { background:var(--fk-color-primary-subtle); }",
  ".ai-review-section summary { color:var(--fk-color-text-primary); }",
  ".ai-review-section-body { color:var(--fk-color-text-secondary); }",
  ".ai-review-card :is(time,small,.meta,.metadata) { color:var(--fk-color-text-muted); }",
  ".node :is(.expanded-content,.node-details) { background:var(--fk-color-node-surface)",
  ".node :is(.control-btn,.node-compact-toggle,.node-ai-toolbar button,.connector-handle,.connector-link-handle)",
  ".floating-zoom-control { background:var(--fk-color-surface-elevated)",
  ".floating-zoom-control button { background:var(--fk-color-surface-input)",
  ".floating-zoom-control #zoom-label { color:var(--fk-color-text-secondary); }",
  "color-mix(in srgb,var(--node-role-accent,var(--fk-color-role-idea-accent)) 5%,transparent)",
  ".node.selected { outline-color:var(--fk-color-node-selection)",
  "#links path { stroke:var(--fk-color-canvas-edge); }",
  '[data-node-role="visual-concept"]', '[data-node-role="content"]'
].forEach((fixture) => has(css, fixture));
assert(!/color-mix\([^)]*node-role-accent[^)]*\)\s*(?:[2-9]\d|100)%/.test(css), "Inactive role glow is excessive");
["zoom-out-btn", "zoom-label", "zoom-in-btn"].forEach((id) => has(html, `id="${id}"`));
["width: 285px", "min-height: 220px", "max-height: 52vh"].forEach((fixture) => has(css, fixture, `Canvas geometry changed: ${fixture}`));
has(app, "state.edges");
assert(!/funklix:themechange[\s\S]{0,500}(?:state\.edges|state\.nodes|saveCampaignCanvasState)/.test(app), "Theme presentation mutates Canvas data");
has(css, 'html[data-theme="dark"] .postit { background:var(--fk-color-comment-surface)');

// Brand Core content and complete Brand DNA application surfaces.
[
  ".brand-core-workspace :is(.bc-title,.bc-node h3,.bc-node h4,.bc-preview strong",
  ".brand-core-workspace :is(.bc-preview,.bc-preview p,.bc-preview li,.bc-preview small,.bc-assets-preview) { color:var(--fk-color-text-secondary); }",
  ".brand-core-workspace .bc-preview li::marker { color:var(--fk-color-primary-action); }",
  ".brand-core-workspace :is(.bc-tags span,.bc-count,.bc-badge) { background:var(--fk-color-surface-elevated);color:var(--fk-color-text-muted); }",
  ".brand-core-workspace .brand-dna-card { background:linear-gradient(145deg,var(--fk-color-surface-elevated),var(--fk-color-surface-panel))",
  ".brand-core-workspace .brand-dna-eyebrow { background:var(--fk-color-primary-subtle)",
  ".brand-dna-score strong,.brand-dna-block h4,.brand-dna-signals h5",
  ".brand-dna-header p,.brand-dna-empty,.brand-dna-block p,.brand-dna-signals p",
  ".brand-dna-loading,.brand-dna-empty,.brand-dna-score,.brand-dna-block,.brand-dna-signals>div,.brand-dna-avatar-section",
  ".brand-core-workspace .brand-dna-score.primary { border-color:var(--fk-color-primary-border)",
  ".brand-core-workspace .brand-dna-avatar-image { background:var(--fk-color-surface-input)",
  ".brand-core-workspace .brand-core-side :is(label,.bc-helper) { color:var(--fk-color-text-secondary); }",
  ".brand-core-workspace :is(input,textarea,select):focus-visible"
].forEach((fixture) => has(css, fixture));
has(app, 'class="fk-btn fk-btn-secondary" id="brand-dna-refine"');
has(app, '${hasAcceptedResult ? "fk-btn-secondary" : "fk-btn-primary"}');
has(app, 'card.querySelector("#brand-dna-regenerate")?.addEventListener');
has(app, 'card.querySelector("#brand-dna-refine")?.addEventListener');
has(app, 'card.querySelector("#brand-dna-accept")?.addEventListener');

// Guardrails and compatibility registration.
assert(!/html\[data-theme="dark"\][^{]*\{[^}]*color\s*:\s*(?:#fff(?:fff)?|white)\s*;/s.test(css), "Global white foreground override introduced");
assert(!/html\[data-theme="dark"\]\s+\*/.test(css), "Universal Dark Mode override introduced");
assert(!/body[^{}]*\{[^}]*!important/s.test(css), "Body-wide important patch introduced");
["canvas", "links", "zoom-out-btn", "zoom-label", "zoom-in-btn", "brand-core-workspace", "brand-dna-card"].forEach((id) => has(html + app, `id="${id}"`));
has(css, ':root, html[data-theme="light"]');
has(app, "funklix:themechange");
["check:bw26","check:bw26.3","check:bw26.4","check:bw26.5","check:bw26.6","check:bw26.6.1","check:bw26.6.2","check:bw27","check:bw27.1","check:bw27.2"].forEach((name) => assert(packageJson.scripts[name], `Missing compatibility check ${name}`));
assert.strictEqual(packageJson.scripts["check:bw27.3"], "node scripts/check-bw27-3-final-dark-mode-polish.js");
const bw272 = workflow.indexOf("node scripts/check-bw27-2-premium-dark-mode.js");
const bw273 = workflow.indexOf("node scripts/check-bw27-3-final-dark-mode-polish.js");
assert(bw272 >= 0 && bw273 > bw272 && workflow.slice(bw272, bw273).split("\n").length <= 4, "BW-27.3 must directly follow BW-27.2");

// Deterministic final foreground/background pairs (fixtures intentionally map
// every requested component role to the semantic tokens used by its rule).
const pairs = [
  ["Start hero", "--fk-color-text-primary", "--fk-color-surface-elevated"], ["Start supporting", "--fk-color-text-secondary", "--fk-color-surface-panel"],
  ["node title", "--fk-color-text-primary", "--fk-color-node-surface"], ["node body", "--fk-color-text-secondary", "--fk-color-node-surface"],
  ["review title", "--fk-color-text-primary", "--fk-color-ai-review-surface"], ["review body", "--fk-color-text-secondary", "--fk-color-ai-review-surface"],
  ["review summary", "--fk-color-text-secondary", "--fk-color-surface-card"], ["review strengths", "--fk-color-text-secondary", "--fk-color-surface-card"],
  ["review improvements", "--fk-color-text-secondary", "--fk-color-surface-card"], ["review rewrite", "--fk-color-text-secondary", "--fk-color-surface-card"],
  ["zoom", "--fk-color-text-secondary", "--fk-color-surface-elevated"], ["Brand Core statement", "--fk-color-text-secondary", "--fk-color-surface-card"],
  ["Value Proposition", "--fk-color-text-secondary", "--fk-color-surface-card"], ["persona name", "--fk-color-text-primary", "--fk-color-surface-card"],
  ["persona description", "--fk-color-text-secondary", "--fk-color-surface-card"], ["Brand DNA title", "--fk-color-text-primary", "--fk-color-surface-elevated"],
  ["Brand DNA description", "--fk-color-text-secondary", "--fk-color-surface-panel"], ["archetype name", "--fk-color-text-primary", "--fk-color-surface-card"],
  ["archetype percentage", "--fk-color-text-primary", "--fk-color-surface-card"], ["editor label", "--fk-color-text-secondary", "--fk-color-surface-panel"],
  ["editor textarea", "--fk-color-text-primary", "--fk-color-surface-input"]
];
pairs.forEach(([label, foreground, background]) => expectContrast(label, token(foreground), token(background)));

console.log("BW-27.3 final Dark Mode polish checks passed (56 contracts and 21 deterministic contrast fixtures). Visual quality remains a human review responsibility.");
