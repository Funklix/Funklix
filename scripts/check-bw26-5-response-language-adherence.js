'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
const stub = (file, exports) => {
  const resolved = require.resolve(path.join(root, file));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
stub('api/_auth-session.js', { getSessionUser: () => ({ email: 'editor@example.com' }) });
stub('api/_board-access.js', { getBoardAccess: async () => ({ board: { id: 'board', name: 'Calima', brand_core_snapshot: {}, updated_at: 'now' }, access: { canEdit: true } }) });
stub('api/_brand-access.js', { getBrandAccess: async () => ({}), isBrandId: () => true });
stub('api/_ai-brain-diagnostics.js', { analyzeCanvas: () => ({ version: 1, items: [] }) });
delete require.cache[require.resolve('../api/ai-brain/advice')];
const handler = require('../api/ai-brain/advice');
const { providerMessages, responseLanguageMismatch } = handler;

const enHistory = [{ user: 'Give me three ideas', assistant: '1. Trust\n2. Clarity\n3. Momentum' }];
const deHistory = [{ user: 'Gib mir drei Ideen', assistant: '1. Vertrauen\n2. Klarheit\n3. Dynamik' }];
for (const [language, history, question, label] of [
  ['de', enHistory, 'Super, arbeite bitte die zweite Idee weiter aus.', 'German'],
  ['en', deHistory, 'Great, expand on the second idea.', 'English']
]) {
  const messages = providerMessages({ context: { workingCanvas: {} }, conversation: history, language, question });
  assert.deepStrictEqual(messages.map((message) => message.role), ['system', 'system', 'user', 'assistant', 'system', 'user']);
  assert(messages[4].content.startsWith(`Response language for this turn: ${label}.`));
  assert.strictEqual(messages[5].content, question, 'the current question remains the final user message');
}

assert(responseLanguageMismatch('This is the complete answer and it has the explanation that you can use for your campaign.', 'de'));
assert(responseLanguageMismatch('Das ist die vollständige Antwort und sie ist für deine Kampagne geeignet und kann so verwendet werden.', 'en'));
assert(!responseLanguageMismatch('Diese Strategie ist für Calima auf LinkedIn sinnvoll. Mehr unter https://calima.example und mit #MomentsThatMatter. Neue Copy: “Trust is everything.”', 'de'));
assert(!responseLanguageMismatch('This approach is useful for Köln and the campaign. Quoted copy: „Vertrauen ist alles.“', 'en'));
assert(!responseLanguageMismatch('Calima: stronger momentum', 'de'), 'uncertain short mixed cases are accepted');

let providerCalls = 0; let providerInput; let providerAnswer = '';
const previousFetch = global.fetch; const previousKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = 'test';
global.fetch = async (_url, options) => {
  providerCalls += 1; providerInput = JSON.parse(options.body).input;
  return { ok: true, json: async () => ({ output_text: providerAnswer }) };
};
const invoke = async (response_language, conversation_history = []) => {
  let status = 200; let body;
  await handler({ method: 'POST', headers: {}, body: { board_id: 'board', canvas_context: { nodes: [], edges: [] }, conversation_history, conversation_history_truncated: false, question: 'Please continue with the second idea', response_language, selected_node_id: null } }, { status(code) { status = code; return this; }, json(value) { body = value; return value; } });
  return { status, body };
};

(async () => {
  try {
    providerAnswer = 'Das ist die Antwort und sie ist für deine Kampagne geeignet. Du kannst sie mit einer klaren Botschaft weiter ausarbeiten.';
    let result = await invoke('de', enHistory);
    assert.strictEqual(result.status, 200, 'the first German request after English history succeeds');
    assert.strictEqual(result.body.context.response_language, 'de');
    assert.strictEqual(providerInput.at(-2).role, 'system');
    assert(providerInput.at(-2).content.includes('Previous English messages are reference context only.'));
    assert.strictEqual(providerInput.at(-1).role, 'user');

    providerAnswer = 'This is the answer and it is useful for your campaign. You can expand it with a clear message for the audience.';
    result = await invoke('en', deHistory);
    assert.strictEqual(result.status, 200, 'the first English request after German history succeeds');
    assert.strictEqual(result.body.context.response_language, 'en');

    const beforeMismatch = providerCalls;
    result = await invoke('de', enHistory);
    assert.strictEqual(result.status, 502);
    assert.strictEqual(result.body.code, 'response_language_mismatch');
    assert.strictEqual(result.body.context.response_language, 'de');
    assert.strictEqual(providerCalls, beforeMismatch + 1, 'a mismatch causes no hidden paid retry');

    const lifecycle = app.slice(app.indexOf('async function requestAiBrainAdvice'), app.indexOf('function currentInsightsIdentity'));
    assert(lifecycle.includes('const responseLanguage = state.uiLanguage === "de" ? "de" : "en"'));
    assert.strictEqual((lifecycle.match(/state\.uiLanguage/g) || []).length, 1, 'Interface language is read exactly once per request');
    assert(lifecycle.includes('response_language: responseLanguage'));
    assert(lifecycle.includes('data.context?.response_language !== responseLanguage'), 'browser validates server response identity against the captured language');
    assert(lifecycle.includes('existing?.question') && lifecycle.includes('existing ? state.aiBrain.messages.map'), 'deliberate Retry reuses the failed turn');
    assert(lifecycle.includes('aiBrainConversationHistory(existing?.id || null)'), 'Retry cannot duplicate the reused turn in history');
    assert(!lifecycle.includes('campaignLanguage'), 'campaign language remains independent');
    for (const mutation of ['saveCampaignCanvasState', 'setDirty', 'autosave', 'generateCampaign', 'repair', 'runAiReview', 'localStorage', 'sessionStorage']) assert(!lifecycle.includes(mutation));
    assert(app.includes('AI_BRAIN_TEXT[turn.responseLanguage]?.responseLanguage'), 'successful disclosures retain each turn language');
    assert(workflow.indexOf('check-bw26-2-safe-brain-response-formatting.js') < workflow.indexOf('check-bw26-3-bounded-conversation-memory.js'));
    assert(workflow.indexOf('check-bw26-3-bounded-conversation-memory.js') < workflow.indexOf('check-bw26-4-reference-resolution.js'));
    assert(workflow.indexOf('check-bw26-4-reference-resolution.js') < workflow.indexOf('check-bw26-5-response-language-adherence.js'));
    console.log('BW-26.5 per-turn response-language adherence checks passed.');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
