'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LIMITS, validateCanvasContext } = require('../api/_ai-brain-canvas-context');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js'); const route = read('api/ai-brain/advice.js');

// Exact production failure: persistence nodes begin with id/type/title/content/status;
// BW-26's NODE_KEYS omitted status, so sameKeys rejected the first real node.
const productionNode = { id: 'node-1', type: 'Idea', title: 'TLDR', content: 'Campaign direction', status: 'Draft', tags: [], variants: [], position: { x: 640, y: 120 }, images: [], compact: false };
const oldAllowed = ['audience', 'channel', 'content', 'funnelStage', 'goal', 'id', 'landingPage', 'social', 'tags', 'title', 'tone', 'type'];
assert.strictEqual(Object.keys(productionNode).find((key) => !oldAllowed.includes(key)), 'status', 'reproduction must localize the first rejected field');

const nodes = [
  { id: 'legacy', type: 'Social Media Post', title: 'Legacy post', content: 'Copy', status: 'Draft', channel: 'LinkedIn', social: { platform: 'LinkedIn', caption: 'Copy', hashtags: ['launch'], preview: 'Preview' } },
  { id: 'v3', type: 'Landing Page', title: 'Campaign V3 landing', funnelStage: 'Conversion', audience: 'Teams', tone: 'Direct', landingPage: { headerClaim: 'Move faster', problem: 'Delay', solution: 'Flow', trust: 'Proof', cta: 'Start' } }
];
const projected = { nodes, edges: [{ id: 'edge-0', source: 'legacy', target: 'v3', type: 'social_to_landing' }] };
const valid = validateCanvasContext(projected, 'v3');
assert(valid.ok && valid.nodes[0].type === 'Social Media Posting' && valid.nodes[1].landingPage.cta === 'Start');
assert(!JSON.stringify(projected).includes('position') && !JSON.stringify(projected).includes('images'), 'application-only fields excluded');
assert.strictEqual(validateCanvasContext({ nodes: [null], edges: [] }, null).classification, 'unsupported_canvas');
assert.strictEqual(validateCanvasContext({ nodes, edges: [{}] }, null).classification, 'malformed_canvas');
assert.strictEqual(validateCanvasContext({ nodes, edges: [{ source: 'legacy', target: 'missing' }] }, null).classification, 'stale_canvas');
assert.strictEqual(validateCanvasContext({ nodes, edges: [] }, 'missing').classification, 'invalid_selected_node');
assert.strictEqual(validateCanvasContext({ nodes: [nodes[0], { ...nodes[0] }], edges: [] }, null).detail, 'duplicate_node_id');
assert.strictEqual(validateCanvasContext({ nodes: Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ id: `n${i}`, type: 'Idea' })), edges: [] }, null).classification, 'canvas_too_large');
assert.strictEqual(validateCanvasContext({ nodes: [{ id: 'n', type: 'Idea', title: 'x'.repeat(LIMITS.short + 1) }], edges: [] }, null).classification, 'canvas_too_large');
assert.strictEqual(validateCanvasContext({ nodes: [{ id: 'n', type: 'Unknown' }], edges: [] }, null).classification, 'unsupported_canvas');

assert(app.includes('function aiBrainCanvasProjection()') && app.includes('status: "pending"'));
assert(app.includes('state.aiBrain.status === "loading"') && app.includes('data-ai-brain-retry'));
assert(app.includes('item.id === turn.id ? { ...item, status: "pending"') && !app.includes('canvas_context: { nodes: canvas.nodes, edges: canvas.edges }'));
assert(app.includes('errorCode: error.code || "generic"') && app.includes('errorCode: "changed"'));
assert(app.includes('controller.abort()') && app.includes('messages: []'));
assert(app.includes('Beim erneuten Versuch wird der aktuelle Canvas-Kontext verwendet.') && app.includes('Retry uses the current Canvas context.'));
assert(route.indexOf('validateCanvasContext(canvas') < route.indexOf("fetch('https://api.openai.com"), 'validation must precede provider');
assert(route.includes('if (!access?.canEdit)') && route.includes('board.brand_core_snapshot') && !route.includes('req.body.brand_core'));
assert(!app.slice(app.indexOf('function aiBrainCanvasProjection'), app.indexOf('function currentInsightsIdentity')).includes('saveCampaignCanvasState'));
async function proveProviderBoundary() {
  const stub = (file, exports) => { const resolved = require.resolve(path.join(__dirname, '..', file)); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };
  stub('api/_auth-session.js', { getSessionUser: () => ({ email: 'editor@example.com' }) });
  stub('api/_board-access.js', { getBoardAccess: async () => ({ board: { id: 'board', name: 'TLDR', brand_core_snapshot: {}, updated_at: 'now' }, access: { canEdit: true } }) });
  stub('api/_brand-access.js', { getBrandAccess: async () => ({}), isBrandId: () => true });
  stub('api/_ai-brain-diagnostics.js', { analyzeCanvas: () => ({ version: 1 }) });
  delete require.cache[require.resolve('../api/ai-brain/advice')];
  const handler = require('../api/ai-brain/advice'); let providerCalls = 0;
  const previousFetch = global.fetch; const previousKey = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test';
  global.fetch = async () => { providerCalls += 1; return { ok: true, json: async () => ({ output_text: 'Advice' }) }; };
  const invoke = async (canvas) => {
    let status = 200; let body;
    await handler({ method: 'POST', headers: {}, body: { board_id: 'board', canvas_context: canvas, question: 'What should change?', response_language: 'en', selected_node_id: null } }, { status(code) { status = code; return this; }, json(value) { body = value; return value; } });
    return { status, body };
  };
  try {
    const invalid = await invoke({ nodes: [{ id: 'n', type: 'Unknown' }], edges: [] }); assert.strictEqual(invalid.status, 400); assert.strictEqual(providerCalls, 0);
    const success = await invoke(projected); assert.strictEqual(success.status, 200); assert.strictEqual(success.body.answer, 'Advice'); assert.strictEqual(providerCalls, 1);
  } finally { global.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
}
proveProviderBoundary().then(() => console.log('BW-26.1 real Canvas context and turn lifecycle checks passed. Exact pre-fix cause: node status was the first persistence field rejected by BW-26 sameKeys; invalid context called provider zero times and valid context once.')).catch((error) => { console.error(error); process.exitCode = 1; });
