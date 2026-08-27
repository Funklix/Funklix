'use strict';
const assert = require('assert');
const path = require('path');
const { hasConversationalReference } = require('../api/_ai-brain-conversation');

assert(hasConversationalReference('please expand on the second idea'));
assert(hasConversationalReference('Bitte nimm die zweite Idee'));
assert(!hasConversationalReference('What are two campaign ideas?'));

const stub = (file, exports) => {
  const resolved = require.resolve(path.join(__dirname, '..', file));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
stub('api/_auth-session.js', { getSessionUser: () => ({ email: 'editor@example.com' }) });
stub('api/_board-access.js', { getBoardAccess: async () => ({ board: { id: 'board', name: 'Calima', brand_core_snapshot: {}, updated_at: 'now' }, access: { canEdit: true } }) });
stub('api/_brand-access.js', { getBrandAccess: async () => ({}), isBrandId: () => true });
stub('api/_ai-brain-diagnostics.js', { analyzeCanvas: () => ({ version: 1, items: ['unrelated second diagnostic'] }) });
delete require.cache[require.resolve('../api/ai-brain/advice')];
const handler = require('../api/ai-brain/advice');
const previousAnswer = '1. Emotional Safety Focus\nBuild trust.\n\n2. Spotlight on Compliance and Innovative Solutions\nShow compliant innovation.';
let providerInput;
const previousFetch = global.fetch; const previousKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = 'test';
global.fetch = async (_url, options) => {
  providerInput = JSON.parse(options.body).input;
  return { ok: true, json: async () => ({ output_text: 'Expanded compliance concept' }) };
};
const invoke = async (extra = {}) => {
  let status = 200; let body;
  await handler({ method: 'POST', headers: {}, body: {
    board_id: 'board', canvas_context: { nodes: [], edges: [] }, response_language: 'en', selected_node_id: null,
    question: 'please expand on the second idea', conversation_history: [{
      user: 'was wäre zwei gute posts auf linkedin für calima welche die existierende campaign gut ergänzen?',
      assistant: previousAnswer
    }], ...extra
  } }, { status(code) { status = code; return this; }, json(value) { body = value; return value; } });
  return { status, body };
};

(async () => {
  try {
    const result = await invoke();
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(providerInput.map((message) => message.role), ['system', 'system', 'user', 'assistant', 'system', 'user']);
    assert(providerInput[0].content.includes('primary source for conversational reference resolution'));
    assert(providerInput[0].content.includes('current Board and Canvas context to validate and enrich'));
    assert(providerInput[1].content.startsWith('Current authoritative Board, Brand, Canvas'));
    assert.strictEqual(providerInput[2].content.startsWith('was wäre zwei gute posts'), true);
    assert.strictEqual(providerInput[3].content, previousAnswer, 'the full numbered answer reaches the provider');
    assert(providerInput[3].content.includes('1. Emotional Safety Focus'));
    assert(providerInput[3].content.includes('2. Spotlight on Compliance and Innovative Solutions'));
    assert(providerInput[4].content.startsWith('Response language for this turn: English.'));
    assert.strictEqual(providerInput[5].content, 'please expand on the second idea');
    assert.deepStrictEqual(result.body.context.conversation_exchanges_used, 1);
    assert.strictEqual(result.body.context.reference_resolution, 'conversation_history');

    providerInput = null;
    const clarification = await invoke({ conversation_history: [], conversation_history_truncated: true });
    assert.strictEqual(clarification.body.answer, 'I’m not sure which previous idea you mean. Please name or briefly describe it.');
    assert.strictEqual(clarification.body.context.reference_resolution, 'clarification');
    assert.strictEqual(providerInput, null, 'an unreliable reference does not reach the provider');

    const german = await invoke({ response_language: 'de', question: 'Bitte erweitere die zweite Idee', conversation_history: [] });
    assert.strictEqual(german.body.answer, 'Ich bin nicht sicher, welche vorherige Idee du meinst. Bitte nenne oder beschreibe sie kurz.');
    console.log('BW-26.4 reliable follow-up reference resolution checks passed.');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
