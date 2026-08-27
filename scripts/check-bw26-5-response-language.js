'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const stub = (file, exports) => {
  const resolved = require.resolve(path.join(root, file));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
stub('api/_auth-session.js', { getSessionUser: () => ({ email: 'editor@example.com' }) });
stub('api/_board-access.js', { getBoardAccess: async () => ({ board: { id: 'board', name: 'Calima', brand_core_snapshot: {}, updated_at: 'now' }, access: { canEdit: true } }) });
stub('api/_brand-access.js', { getBrandAccess: async () => ({}), isBrandId: () => true });
stub('api/_ai-brain-diagnostics.js', { analyzeCanvas: () => ({ version: 1 }) });
delete require.cache[require.resolve('../api/ai-brain/advice')];
const handler = require('../api/ai-brain/advice');

assert(app.includes('const responseLanguage = ["en", "de"].includes(state.uiLanguage) ? state.uiLanguage : "en"'));
assert(app.includes('response_language: responseLanguage'));
assert(app.includes('data.context?.response_language !== responseLanguage'));
assert(!app.slice(app.indexOf('async function requestAiBrainAdvice'), app.indexOf('function currentInsightsIdentity')).includes('response_language: state.uiLanguage'));

const previousFetch = global.fetch;
const previousKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = 'test';
let providerInput;
global.fetch = async (_url, options) => {
  providerInput = JSON.parse(options.body).input;
  return { ok: true, json: async () => ({ output_text: 'Deutsche Antwort' }) };
};
const invoke = async (responseLanguage, question, conversationHistory) => {
  let status = 200; let body;
  await handler({ method: 'POST', headers: {}, body: {
    board_id: 'board', canvas_context: { nodes: [], edges: [] }, selected_node_id: null,
    response_language: responseLanguage, question, conversation_history: conversationHistory
  } }, { status(code) { status = code; return this; }, json(value) { body = value; return value; } });
  return { status, body };
};

(async () => {
  try {
    // Exact regression fixture: successful English history followed by the first
    // German turn. Before BW-26.5 there was no final-turn instruction here.
    const englishHistory = [
      { user: 'Give me two LinkedIn post ideas.', assistant: '1. Trust story\n2. Product proof' },
      { user: 'Expand the first idea.', assistant: 'Use an English customer narrative.' }
    ];
    const german = await invoke('de', 'super mach gerne weiter', englishHistory);
    assert.strictEqual(german.status, 200);
    assert.deepStrictEqual(providerInput.slice(-4).map(({ role }) => role), ['user', 'assistant', 'system', 'user']);
    assert.strictEqual(providerInput.at(-1).content, 'super mach gerne weiter', 'current question remains the final user message');
    assert.strictEqual(providerInput.at(-2).content, 'Response language for this turn: German. Previous English messages are reference context only. Write the response in German. Apply this language to the complete answer, including headings, explanations, and newly proposed copy, unless the user explicitly asks to quote, preserve, translate, or analyze text in another language. Preserve Brand names, product names, URLs, platform names, and user content unchanged.');
    assert.strictEqual(german.body.context.response_language, 'de');

    const germanHistory = [{ user: 'Gib mir eine Idee.', assistant: 'Eine deutsche Idee.' }];
    const english = await invoke('en', 'Please develop that further.', germanHistory);
    assert(providerInput.at(-2).content.startsWith('Response language for this turn: English. Previous German messages are reference context only. Write the response in English.'));
    assert.strictEqual(english.body.context.response_language, 'en');

    const invalid = await invoke('es', 'Continue please.', []);
    assert.strictEqual(invalid.status, 400, 'campaign-only language is rejected');
    console.log('BW-26.5 per-turn AI Brain response-language checks passed.');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
