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

const scope = 'html[data-theme="dark"] .node[data-node-role="landing-page"]';
[
  `${scope} .social-preview {`, 'background:var(--fk-color-surface-elevated)',
  'border-color:var(--fk-color-divider)', 'var(--fk-color-role-landing-accent)',
  `${scope} .landing-preview-card {`, 'max-height:16.5em', 'overflow:hidden',
  `${scope} .landing-preview-line {`, 'color:var(--fk-color-text-secondary) !important',
  `${scope} .landing-preview-line strong {`, 'color:var(--fk-color-role-landing-accent)',
  `${scope} .landing-preview-structured > .landing-preview-line:first-child {`,
  'color:var(--fk-color-text-primary) !important',
  `${scope} .landing-preview-line.is-cta {`, 'background:var(--fk-color-primary-subtle) !important',
  'border:1px solid var(--fk-color-primary-border) !important',
  '.landing-preview-line + .landing-preview-line', 'border-top:1px solid var(--fk-color-divider)'
].forEach((fixture) => has(css, fixture));

// Exact DOM and complete stored fields remain authoritative; theming adds no mutation.
[
  'card.className = "landing-preview-card"', 'p.className = `landing-preview-line${label === "CTA" ? " is-cta" : ""}`',
  '[["Claim", lp.headerClaim], ["Problem", lp.problem], ["Solution", lp.solution], ["Trust", lp.trust], ["CTA", lp.cta]]',
  'strong.textContent = `${label}:`', 'p.append(strong, ` ${value}`)',
  'preview.className = "landing-preview-structured"', 'appendStructuredLandingPagePreview(card, structuredPreview)',
  'contentPreview.textContent = landingContent.length > 520', 'el.inputs.lpHeaderClaim.value = lp.headerClaim || ""',
  'el.inputs.lpProblem.value = lp.problem || ""', 'el.inputs.lpSolution.value = lp.solution || ""',
  'el.inputs.lpTrust.value = lp.trust || ""', 'el.inputs.lpCta.value = lp.cta || ""'
].forEach((fixture) => has(app, fixture));
assert(!/node\.landingPage\s*=|saveCampaignCanvasState|state\.isDirty/.test(css), "Theme CSS must not mutate Canvas data");
assert(!/html\[data-theme="light"\][^{]*landing-page/.test(css), "Light Mode Landing Page override introduced");
assert(!new RegExp(`html\\[data-theme="dark"\\] \\.node(?!\\[data-node-role="landing-page"\\])[^\\{]*landing-preview`).test(css), "Shared Dark Mode Landing preview selector introduced");

// Existing lifecycle, overlays, controls, geometry, selection, and connections stay intact.
[
  'nodeEl.classList.toggle("is-compact", !!node.compact)', 'node.compact = !node.compact',
  'nodeEl.classList.contains("content-expanded")', 'enableNodeDrag(nodeEl, node)',
  'state.edges', 'drawLinks()',
  'postit.classList.toggle("ai-review-postit", isAiReviewNote)', 'note.resolved = !note.resolved',
  'details.open = !!open', 'openNodeCommentThread(node.id)', 'node.selected'
].forEach((fixture) => has(app + css, fixture));
['width: 285px', 'min-height: 220px'].forEach((fixture) => has(css, fixture, `Node geometry changed: ${fixture}`));
['canvas', 'links', 'landing-page-fields', 'node-preview', 'postit-template'].forEach((id) => has(html, `id="${id}"`));

// Deterministic WCAG fixtures for the semantic token values used above.
const rgb = (hex) => [1,3,5].map((i) => parseInt(hex.slice(i,i+2),16));
const lum = (hex) => rgb(hex).map((v) => v/255).map((v) => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => { const [hi,lo] = [lum(a),lum(b)].sort((x,y)=>y-x); return (hi+.05)/(lo+.05); };
[['primary','#f4f6fc'],['secondary','#bac3d8'],['label','#c497ff']].forEach(([name,color]) => assert(contrast(color,'#1b2540') >= 4.5, `${name} contrast failed`));
assert(contrast('#f4f6fc','#282847') >= 4.5, 'CTA contrast failed');

assert.strictEqual(pkg.scripts['check:bw27.5'], 'node scripts/check-bw27-5-landing-page-node-dark-mode.js');
const bw274 = workflow.indexOf('node scripts/check-bw27-4-canvas-component-polish.js');
const bw275 = workflow.indexOf('node scripts/check-bw27-5-landing-page-node-dark-mode.js');
const bw28 = workflow.indexOf('node scripts/check-bw28-ai-insights-architecture.js');
assert(bw274 >= 0 && bw275 > bw274 && bw28 > bw275, 'BW-27.5 workflow registration/order missing');
assert(workflow.slice(bw274, bw275).split('\n').length <= 4, 'BW-27.5 must directly follow BW-27.4');

console.log('BW-27.5 Landing Page Dark Mode readability checks passed.');
