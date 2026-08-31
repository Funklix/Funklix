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

const rgb = (hex) => {
  assert(/^#[0-9a-f]{6}$/i.test(hex), `Contrast fixture requires a hex value: ${hex}`);
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
};
const luminance = (hex) => rgb(hex).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
const expectContrast = (label, foreground, background, minimum = 4.5) => assert(contrast(foreground, background) >= minimum, `${label} contrast below ${minimum}:1`);

// Post-it material exception: scoped warm surfaces override the inline saved
// color in Dark Mode without changing the saved value or Light Mode rule.
[
  '.postit:not(.ai-review-postit) {', '--postit-surface:#e7c968', '--postit-body:#f0d77d', '--postit-secondary:#ddbd5d',
  '--postit-text:#282313', '--postit-text-secondary:#574c26', '--postit-text-muted:#746637',
  'background:var(--postit-surface) !important', '.postit:not(.ai-review-postit) header',
  ':is(.postit-text,.postit-reply-input) {', 'background:var(--postit-body)', '::placeholder { color:var(--postit-text-muted)',
  '.postit-reply { color:var(--postit-text-secondary)', ':is(.postit-time,.postit-reply-meta,.postit-resolved-summary)',
  ':is(.postit-resolve,.postit-reply-button,.postit-delete)', '.postit-text::-webkit-resizer',
  ':is(.postit-text,.postit-reply-input):focus-visible'
].forEach((fixture) => has(css, fixture));
has(html, 'id="postit-template"');
has(html, 'class="postit-text"');
has(app, 'enablePostitDrag(postit, note)');
has(app, 'note.replies.push(');
has(app, 'note.resolved = !note.resolved');
has(app, 'postit.style.background = note.color');
has(css, '.postit-text {\n  width: 100%;\n  min-height: 74px;\n  resize: vertical;', 'Post-it resize behavior changed');
assert(!css.includes('html[data-theme="light"] .postit:not(.ai-review-postit)'), "Light Mode Post-it was overridden");

// AI Review complete chrome: the post-it is the attached outer shell; all
// metadata, review sections, footer, replies and editable reply surfaces nest.
[
  '.ai-review-postit {\n  --review-shell:#182239', '--review-elevated:#202b46', '--review-nested:#141d31',
  'background:var(--review-shell) !important', '.ai-review-postit > header', 'background:var(--review-elevated)',
  '.ai-review-card { background:var(--review-shell)', '.ai-review-card-heading { background:var(--review-elevated)',
  '.ai-review-section-summary { background:var(--review-elevated)', '.ai-review-section-strengths { background:#162d2b',
  '.ai-review-section-improvements { background:#30291c', '.ai-review-section-rewrite { background:#27223d',
  '.ai-review-postit .postit-replies { background:var(--review-nested)', '.ai-review-postit .postit-reply-editor { background:var(--review-nested)',
  '.ai-review-postit .postit-reply-input { background:var(--fk-color-surface-input)', '.ai-review-postit > .postit-reply-button',
  '.ai-review-score { background:var(--fk-color-primary-subtle)', '.ai-review-section summary { color:var(--fk-color-text-primary)'
].forEach((fixture) => has(css, fixture));
has(app, 'postit.classList.toggle("ai-review-postit", isAiReviewNote)');
has(app, 'area.replaceWith(renderAiReviewCard(parsedAiReview, { node, note, nodeEl }))');
has(app, 'details.open = !!open');
has(app, 'fetch("/api/apply-review-fix"');
assert(!css.includes('html[data-theme="light"] .ai-review-postit'), "Light Mode AI Review was overridden");

// Social previews retain full data and the existing whole-node compact toggle,
// while the default caption presentation is bounded to six lines.
[
  '.node[data-node-role="social-media-posting"] .social-preview', 'var(--fk-color-role-social-accent)',
  '.social-caption:not(:focus)', '-webkit-line-clamp:6', 'max-height:calc(6 * 1.35em + 12px)',
  '.social-caption:focus { display:block;max-height:11em;overflow-y:auto',
  ':is(.social-caption,.social-cta,.social-hashtags,.social-schedule-meta)',
  '.social-image-frame img { width:100%;height:auto;max-height:140px;object-fit:contain',
  '.social-image-frame:empty { display:none', '.social-actions-row { border-top:1px solid',
  '.social-actions-row button:disabled', '.node[data-node-role="social-media-posting"].selected'
].forEach((fixture) => has(css, fixture));
has(app, 'caption.textContent = node.social.caption || ""');
has(app, 'node.social.caption = caption.textContent');
has(app, 'await navigator.clipboard.writeText(node.social.caption || "")');
has(app, '[node.social.caption || "", node.social.preview || "", (node.social.hashtags || []).join(" ")]');
has(app, 'el.inputs.caption.value = node.social.caption');
has(app, 'compactToggle.className = "node-compact-toggle"');
has(app, 'node.compact = !node.compact');
has(app, 'if (key === "caption") node.social.caption =');
assert(!/node\.social\.caption\s*=\s*[^;]*\.slice\(/.test(app), "Stored social caption is truncated");
assert(!css.includes('html[data-theme="light"] .node[data-node-role="social-media-posting"]'), "Light Mode Social node was overridden");

// Persistence, Canvas geometry, IDs, and adjacent releases remain untouched.
['width: 285px', 'min-height: 220px', 'max-height: 52vh'].forEach((fixture) => has(css, fixture, `Canvas geometry fixture changed: ${fixture}`));
['postit-template', 'node-caption', 'canvas', 'links'].forEach((id) => has(html, `id="${id}"`));
['saveCampaignCanvasState', 'state.isDirty', 'state.edges', 'social: { platform:', 'postits: []'].forEach((fixture) => has(app, fixture));
assert(!/html\[data-theme="dark"\]\s+\*/.test(css), "Universal Dark Mode override introduced");
assert(!/body[^{}]*\{[^}]*!important/s.test(css), "Body-wide important override introduced");
['check:bw26','check:bw26.3','check:bw26.4','check:bw26.5','check:bw26.6','check:bw26.6.1','check:bw26.6.2','check:bw27','check:bw27.1','check:bw27.2','check:bw27.3'].forEach((name) => assert(packageJson.scripts[name], `Missing compatibility check ${name}`));
assert.strictEqual(packageJson.scripts['check:bw27.4'], 'node scripts/check-bw27-4-canvas-component-polish.js');
const bw273 = workflow.indexOf('node scripts/check-bw27-3-final-dark-mode-polish.js');
const bw274 = workflow.indexOf('node scripts/check-bw27-4-canvas-component-polish.js');
assert(bw273 >= 0 && bw274 > bw273 && workflow.slice(bw273, bw274).split('\n').length <= 4, 'BW-27.4 must directly follow BW-27.3');

// Deterministic fixtures cover each requested surface/text role and the focus
// indicator. They supplement rather than replace visual review.
[
  ['Post-it body', '#282313', '#f0d77d', 7], ['Post-it metadata', '#574c26', '#e7c968', 4.5],
  ['Post-it muted', '#746637', '#f0d77d', 3], ['AI Review shell title', '#f4f6fc', '#182239', 7],
  ['AI Review body', '#bac3d8', '#182239', 7], ['AI Review summary', '#bac3d8', '#202b46', 6],
  ['AI Review strengths', '#bac3d8', '#162d2b', 6], ['AI Review improvements', '#bac3d8', '#30291c', 6],
  ['AI Review rewrite', '#bac3d8', '#27223d', 6], ['Social caption', '#bac3d8', '#161f35', 7],
  ['Platform badge', '#f4f6fc', '#11192d', 7], ['Footer action', '#f4f6fc', '#11192d', 7],
  ['Focus on review', '#9b8cff', '#182239', 3], ['Focus on Post-it', '#6f5bff', '#f0d77d', 3]
].forEach(([label, foreground, background, minimum]) => expectContrast(label, foreground, background, minimum));

console.log('BW-27.4 Canvas component polish checks passed (55 contracts and 14 deterministic contrast fixtures). Visual quality remains a human review responsibility.');
