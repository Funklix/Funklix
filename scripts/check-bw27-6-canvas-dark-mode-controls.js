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
const pkg = JSON.parse(read("package.json"));
const has = (source, fixture, message) => assert(source.includes(fixture), message || `Missing fixture: ${fixture}`);

// Dark Canvas editor surface, foreground, placeholder, focus, selection and read-only treatment.
[
  'html[data-theme="dark"] .node:is(.selected,.content-expanded)',
  'background:var(--fk-color-surface-input)', 'color:var(--fk-color-text-primary)',
  'border-color:var(--fk-color-primary-action)', 'box-shadow:var(--fk-focus-shadow)',
  '[contenteditable="true"]:empty:not(:focus)::before', 'color:var(--fk-color-text-muted)',
  '[contenteditable="false"]', '[contenteditable]::selection',
  'background:rgba(124,92,255,.42);color:#fdfdff'
].forEach((fixture) => has(css, fixture));
assert(!/html\[data-theme="dark"\]\s+textarea\s*\{/.test(css), "Global Dark Mode textarea override introduced");

// Warm Post-it identity and the complete readable reply hierarchy remain component-owned.
[
  '--postit-surface:#e7c968', '--postit-text-secondary:#574c26', '--postit-text-muted:#625526',
  '.postit:not(.ai-review-postit) .postit-replies', '.postit-reply-body p',
  '.postit-reply-meta strong', '.postit-reply-editor', '.postit-reply-input)::placeholder',
  '.postit-resolve,.postit-reply-button,.postit-delete', 'min-width:44px;min-height:44px',
  '.postit:not(.ai-review-postit).is-resolved { opacity:1'
].forEach((fixture) => has(css, fixture));

// Both dynamic toolbar menus share the scoped dark panel and complete item state system.
[
  ':is(#floating-filters-popover,#floating-utilities-popover).floating-filter-popover',
  'background:var(--fk-color-surface-panel)', '.filter-group > strong',
  '.node-filter-chips button:hover', '.node-filter-chips button:focus-visible',
  '#floating-filters-popover .node-filter-chips button.active', 'content:"✓ "',
  '.node-filter-chips button:disabled', '.owner-filter-option,.board-row-meta',
  '.node-filter-owner-avatar'
].forEach((fixture) => has(css, fixture));

// Add Node keeps the existing picker and inline role border accents while correcting its modal states.
[
  'html[data-theme="dark"] #node-type-picker.node-type-picker', 'background:var(--fk-color-overlay-backdrop)',
  '#node-type-picker .picker-panel', '#node-type-picker .picker-panel h3',
  '#node-type-picker .picker-option {', 'color:var(--fk-color-text-primary)',
  '.picker-option:hover', '.picker-option:active', '.picker-option:focus-visible', '.picker-option:disabled',
  '@media(max-width:480px)', 'grid-template-columns:1fr'
].forEach((fixture) => has(css, fixture));
has(app, 'btn.style.borderColor = `${NODE_TYPES[type].color}66`', "Node-role accent borders were not retained");

// DOM hooks and behavior authorities must remain unchanged.
['add-node-btn', 'node-type-picker', 'node-type-options', 'filters-toggle-btn', 'utilities-toggle-btn', 'postit-template', 'canvas', 'zoom-layer']
  .forEach((id) => has(html, `id="${id}"`));
[
  'el.addNodeButton.addEventListener("click"', 'openTypePicker((type) =>', 'createNode({ type })',
  'el.filtersToggleButton?.addEventListener("click"', 'state.nodeFilters[group]', 'refreshNodeSearchUI()',
  'el.utilitiesToggleButton?.addEventListener("click"', 'btn.dataset.utilityAction',
  'postit.classList.toggle("ai-review-postit", isAiReviewNote)', 'note.resolved = !note.resolved',
  'enablePostitDrag(postit, note)', 'enableNodeDrag(nodeEl, node)', 'saveCampaignCanvasState()'
].forEach((fixture) => has(app, fixture));
['const NODE_WIDTH = 285', 'const NODE_HEIGHT = 200', 'const BOARD_WIDTH = 20000', 'const BOARD_HEIGHT = 30000']
  .forEach((fixture) => has(app, fixture, `Canvas geometry authority changed: ${fixture}`));

// Every new presentation rule is isolated beneath Dark Mode (media wrappers excepted).
const marker = css.indexOf('/* BW-27.6 —');
assert(marker >= 0, "BW-27.6 CSS marker missing");
const bw276 = css.slice(marker);
assert(!/html\[data-theme="light"\]/.test(bw276), "Light Mode override introduced by BW-27.6");
const bw276Rules = bw276.replace(/\/\*[\s\S]*?\*\//g, "");
assert(!/^\s*(?:\.node|\.postit|#floating|#node-type-picker)\b[^\n{]*\{/m.test(bw276Rules), "Unscoped BW-27.6 component selector introduced");

// Deterministic WCAG AA contrast fixtures for each requested normal-text pair.
const rgb = (hex) => [1,3,5].map((i) => parseInt(hex.slice(i,i+2),16));
const lum = (hex) => rgb(hex).map((v) => v/255).map((v) => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => { const [hi,lo] = [lum(a),lum(b)].sort((x,y)=>y-x); return (hi+.05)/(lo+.05); };
[
  ['editor primary','#f4f6fc','#11192d'], ['editor placeholder','#8894ae','#11192d'],
  ['selection foreground','#fdfdff','#5d49a0'], ['Post-it reply body','#574c26','#e7c968'],
  ['Post-it metadata','#625526','#e7c968'], ['filter heading','#bac3d8','#121a2e'],
  ['filter chip','#f4f6fc','#11192d'], ['selected filter chip','#ddd6ff','#282847'],
  ['Add Node title','#f4f6fc','#1b2540'], ['Add Node option','#f4f6fc','#11192d']
].forEach(([name,foreground,background]) => assert(contrast(foreground,background) >= 4.5, `${name} contrast failed`));

assert.strictEqual(pkg.scripts['check:bw27.6'], 'node scripts/check-bw27-6-canvas-dark-mode-controls.js');
const bw275Step = workflow.indexOf('node scripts/check-bw27-5-landing-page-node-dark-mode.js');
const bw276Step = workflow.indexOf('npm run check:bw27.6');
const bw28Step = workflow.indexOf('node scripts/check-bw28-ai-insights-architecture.js');
assert(bw275Step >= 0 && bw276Step > bw275Step && bw28Step > bw276Step, "BW-27.6 workflow order missing");
assert(workflow.slice(bw275Step, bw276Step).split('\n').length <= 4, "BW-27.6 must directly follow BW-27.5");

console.log("BW-27.6 Campaign Canvas Dark Mode control checks passed.");
