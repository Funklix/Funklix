'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const route = read('api/ai-brain/advice.js');
const css = read('styles.css');
const workflow = read('.github/workflows/runtime-boot-safety.yml');

class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  appendChild(child) { this.children.push(child); return child; }
}
const document = { createElement: (tag) => new Element(tag) };
const start = app.indexOf('function appendAiBrainInline');
const end = app.indexOf('function renderAiBrainTranscript', start);
assert(start > 0 && end > start, 'safe formatter must be independently identifiable');
const sandbox = { document };
vm.runInNewContext(`${app.slice(start, end)}; this.format = renderAiBrainFormattedAnswer;`, sandbox);
const render = (input) => { const root = new Element('div'); sandbox.format(root, input); return root; };
const tags = (node) => [node.tagName, ...node.children.flatMap(tags)];

let output = render('### Overview\n\nA concise paragraph with **strong advice**.\n\n- **Tagline:** Moments that matter\n- Second item\n\n1. First\n2. Second');
assert.deepStrictEqual(tags(output), ['DIV', 'H5', 'SPAN', 'P', 'SPAN', 'STRONG', 'SPAN', 'UL', 'LI', 'STRONG', 'SPAN', 'LI', 'SPAN', 'OL', 'LI', 'SPAN', 'LI', 'SPAN']);
assert.strictEqual(output.textContent, 'OverviewA concise paragraph with strong advice.Tagline: Moments that matterSecond itemFirstSecond');

output = render('**unfinished bold\n\n###\n\n------- repeated markers\n\n`safe code`');
assert(tags(output).filter((tag) => tag === 'P').length >= 3, 'malformed Markdown falls back to readable paragraphs');
assert(output.textContent.includes('**unfinished bold') && output.textContent.includes('###'));
assert(tags(output).includes('CODE'), 'allowlisted inline code is semantic text');

const hostile = '<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n<a href="javascript:alert(1)">Click</a>\n<iframe src=x></iframe>\n- **Label:** mixed <b onclick=alert(1)>HTML</b>';
output = render(hostile);
for (const literal of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<a href="javascript:alert(1)">Click</a>', '<iframe src=x></iframe>', '<b onclick=alert(1)>HTML</b>']) assert(output.textContent.includes(literal));
assert(!tags(output).some((tag) => ['SCRIPT', 'IMG', 'A', 'IFRAME', 'B'].includes(tag)), 'HTML-like model text never creates HTML elements');

const formatterSource = app.slice(start, app.indexOf('function renderAiBrain()', start));
assert(formatterSource.includes('element.textContent =') && formatterSource.includes('item.textContent ='));
assert(!formatterSource.includes('innerHTML'), 'model formatter has no innerHTML assignment');
assert(app.includes('question.textContent = turn.question') && app.includes('className = "ai-brain-question"'), 'user questions stay plain text');
assert(app.includes('heading.textContent = aiBrainText("assumptions")') && app.includes('assumptions: "Assumptions"') && app.includes('assumptions: "Annahmen"'));
assert(app.includes('Array.isArray(data.assumptions)') && app.includes('item.textContent = typeof value === "string"'), 'assumptions are separate and plain');
assert(css.includes('overflow-wrap: anywhere') && css.includes('.ai-brain-formatted-answer') && css.includes('@media (max-width: 640px)'), 'long strings and responsive layout are bounded');
assert(route.includes('short Markdown headings') && route.includes('Do not return HTML') && !route.includes('Return HTML'));

const lifecycle = app.slice(app.indexOf('function invalidateAiBrainRequest'), app.indexOf('function currentInsightsIdentity'));
assert(lifecycle.includes('messages: []') && lifecycle.includes('controller?.abort()'), 'BW-26 ephemeral clearing remains');
assert(lifecycle.includes('item.id === turn.id ? { ...item, status: "pending"') && lifecycle.includes('state.aiBrain.requestId !== requestId'), 'retry de-duplicates and stale responses are rejected');
assert(lifecycle.includes('const responseLanguage = state.uiLanguage === "de" ? "de" : "en"') && lifecycle.includes('response_language: responseLanguage'), 'authoritative interface language is captured once when requesting');
for (const mutation of ['saveCampaignCanvasState', 'setDirty', 'autosave', 'generateCampaign', 'repair', 'localStorage', 'sessionStorage']) assert(!lifecycle.includes(mutation), `AI Brain lifecycle must not invoke ${mutation}`);
assert(workflow.indexOf('check-bw26-1-real-canvas-context-and-turn-lifecycle.js') < workflow.indexOf('check-bw26-2-safe-brain-response-formatting.js'));
assert(app.includes('renderAiBrainFormattedAnswer(formatted, turn.answer)'));

console.log('BW-26.2 safe AI Brain response formatting checks passed. Allowlisted semantic DOM rendering preserves literal hostile HTML, malformed Markdown, read-only lifecycle, and responsive wrapping.');
