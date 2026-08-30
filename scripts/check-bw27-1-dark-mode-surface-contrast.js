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
const theme = read("theme.js");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const packageJson = JSON.parse(read("package.json"));
const has = (source, fragment, message) => assert(source.includes(fragment), message || `Missing ${fragment}`);

function themeBlock(selector) {
  const start = css.indexOf(selector);
  assert(start >= 0, `Missing ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}\n", open);
  return css.slice(open + 1, close);
}

function token(block, name) {
  const match = block.match(new RegExp(`${name}:([^;]+)`));
  assert(match, `Missing ${name}`);
  return match[1].trim();
}

function rgb(hex) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  assert(/^[0-9a-f]{6}$/i.test(normalized), `Contrast fixture requires a hex color, received ${hex}`);
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  return rgb(hex).map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function expectContrast(label, foreground, background, minimum) {
  const ratio = contrast(foreground, background);
  assert(ratio >= minimum, `${label} contrast ${ratio.toFixed(2)} is below ${minimum}:1`);
}

const light = themeBlock(":root, html[data-theme=\"light\"]");
const dark = themeBlock("html[data-theme=\"dark\"]");

// Deterministic WCAG fixtures use the actual BW-27 semantic token values.
expectContrast("Dark card primary", token(dark, "--fk-color-text-primary"), token(dark, "--fk-color-surface-card"), 4.5);
expectContrast("Dark card secondary", token(dark, "--fk-color-text-secondary"), token(dark, "--fk-color-surface-card"), 4.5);
expectContrast("Dark card muted", token(dark, "--fk-color-text-muted"), token(dark, "--fk-color-surface-card"), 4.5);
expectContrast("Light card primary", token(light, "--fk-color-text-primary"), token(light, "--fk-color-surface-card"), 4.5);
expectContrast("Primary button", "#ffffff", token(light, "--fk-color-primary-action"), 4.5);
expectContrast("Destructive button", token(dark, "--fk-color-danger"), token(dark, "--fk-color-danger-subtle"), 4.5);
expectContrast("Focus ring", token(dark, "--fk-color-focus-ring"), token(dark, "--fk-color-surface-card"), 3);

const boardRule = css.slice(css.indexOf("#boards-library-view .board-row {"), css.indexOf("#boards-library-view .board-row-content"));
has(boardRule, "background: var(--fk-color-surface-card)");
has(boardRule, "border-color: var(--fk-color-border-default)");
has(boardRule, "color: var(--fk-color-text-primary)");
assert(!/background(?:-color)?\s*:\s*(?:#fff(?:fff)?|white|rgba\(255\s*,\s*255\s*,\s*255)/i.test(boardRule), "Board card retains an unconditional white background");
has(css, "#boards-library-view .board-row:hover");
has(css, "background: var(--fk-color-surface-hover)");
has(css, "#boards-library-view .board-row:focus-within");
has(css, "border-color: var(--fk-color-focus-ring)");
has(css, "#boards-library-view .board-row-title");
has(css, "color: var(--fk-color-text-primary)");
has(css, "color: var(--fk-color-text-secondary)");
has(css, "color: var(--fk-color-text-muted)");
has(css, "border-top: 1px solid var(--fk-color-divider)");
has(css, ".board-row-chip.owned");
has(css, ".board-row-drag-handle");
has(css, "background: var(--fk-color-surface-secondary)");

// Preserve the generated Board DOM, action hierarchy, access logic, avatars and ordering.
has(html, "id=\"boards-library-list\"");
has(app, "board-row-avatar");
has(app, "data-open-board=");
has(app, "fk-btn fk-btn-primary");
has(app, "data-copy-board=");
has(app, "fk-btn fk-btn-secondary");
has(app, "data-rename-board=");
has(app, "data-delete-board=");
has(app, "board-action-tertiary danger fk-btn fk-btn-ghost");
has(app, "const ownerActions = isOwner ?");
has(app, "getDisplayedBoards().forEach");
has(app, "persistBoardOrderFromDom");
has(app, "boardBrand.avatarUrl");
["boards-library-view", "boards-library-list", "boards-library-title", "delete-board-cancel", "delete-board-confirm"].forEach((id) => assert(html.includes(`id=\"${id}\"`) || app.includes(`id=\"${id}\"`), `Missing preserved DOM ID ${id}`));

// Theme changes remain presentation-only and the established persistence implementation remains authoritative.
assert(!/funklix:themechange[\s\S]{0,500}(?:markBoardDirty|saveCampaignCanvasState|autosave)/.test(app), "Theme change mutates or saves Boards");
has(theme, "funklix.themePreference.v1");
has(theme, "documentElement.dataset.theme");
assert(!/body[^{}]*\{[^}]*!important/s.test(css), "Body-wide important theme patch introduced");
assert(!/html\[data-theme=[^\]]*dark[^}]*\]\s+div\b/.test(css), "Blanket Dark Mode div override introduced");

// Comparable verified surfaces use compatible semantic pairs.
[".fk-card", ".inspector-section", ".insights-section", ".ai-review-card", ".ai-brain-node-preview", ".ai-brain-composer", ".filter-popover", ".tools-menu", ".theme-quick-menu"].forEach((selector) => has(css, selector));
has(css, "dialog::backdrop");
has(css, "--fk-color-overlay-backdrop");
has(app, "background:var(--fk-color-surface-elevated)");
has(app, "background:var(--fk-color-surface-secondary)");

assert.strictEqual(packageJson.scripts["check:bw27.1"], "node scripts/check-bw27-1-dark-mode-surface-contrast.js");
const bw27 = workflow.indexOf("node scripts/check-bw27-design-system-dark-mode.js");
const bw271 = workflow.indexOf("node scripts/check-bw27-1-dark-mode-surface-contrast.js");
assert(bw27 >= 0 && bw271 > bw27, "BW-27.1 must be registered directly after BW-27");
has(workflow, "Check BW-27.1 Dark Mode surface contrast");

console.log("BW-27.1 Dark Mode surface contrast checks passed (42 contracts plus 7 contrast fixtures). ");
