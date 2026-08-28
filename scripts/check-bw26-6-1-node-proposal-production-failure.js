'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const endpointSource = fs.readFileSync(path.join(root, 'api/ai-brain/propose-node.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
const packageJson = require(path.join(root, 'package.json'));
const boardId = '123e4567-e89b-42d3-a456-426614174000';
const answer = `# Kampagnenidee: Mut zur Klarheit

## LinkedIn & Instagram
- **Hook:** „Deine Marke darf unverwechselbar sein.“
- Zeige drei konkrete Schritte für eine klare Positionierung.
- Nutze #Markenstrategie #Klarheit #Wachstum und einen eindeutigen Call-to-Action.

## Vorgeschlagener Social Copy
„Schluss mit austauschbaren Botschaften. Wir machen deine Stärke sichtbar – auf LinkedIn, Instagram und TikTok.“

${'Eine präzise deutsche Erläuterung mit ä, ö, ü und ß. '.repeat(120)}`;
assert(answer.length < 12000 && answer.length > 4000);
const canvas = { nodes: Array.from({ length: 33 }, (_, index) => ({ id: `node-${index}`, type: index % 3 ? 'Content' : 'Idea', title: `Überschrift ${index}`, content: `Inhalt #${index}` })), edges: [] };
const request = { action: 'propose_content_node', board_id: boardId, source_turn_id: 'turn-de-production', source_answer: answer, selected_node_id: null, canvas_context: canvas, response_language: 'de', content_language: 'de' };

// Load the deployed CommonJS route with controlled session and Board-access boundaries.
let session = { email: 'owner@example.com' };
let access = { board: { id: boardId }, access: { canEdit: true, role: 'owner' } };
let authorizationCalls = 0;
const mock = (relative, exports) => { const id = require.resolve(path.join(root, relative)); require.cache[id] = { id, filename: id, loaded: true, exports }; };
mock('api/_auth-session.js', { getSessionUser: () => session });
mock('api/_board-access.js', { getBoardAccess: async () => { authorizationCalls += 1; return access; } });
mock('api/_brand-access.js', { isBrandId: (value) => value === boardId });
const endpointPath = require.resolve(path.join(root, 'api/ai-brain/propose-node.js'));
delete require.cache[endpointPath];
const endpoint = require(endpointPath);
assert.strictEqual(typeof endpoint, 'function');

// The production failure was at provider request construction: OpenAI strict
// schemas require every property to be listed in required. BW-26.6 only looked
// for json_schema/additionalProperties and never submitted that schema.
assert.deepStrictEqual(endpoint.PROPOSAL_SCHEMA.required, Object.keys(endpoint.PROPOSAL_SCHEMA.properties));
assert.strictEqual(endpoint.PROPOSAL_SCHEMA.additionalProperties, false);
assert.strictEqual(endpoint.PROPOSAL_SCHEMA.properties.node_type.enum[0], 'Content');

let providerCalls = 0;
let capturedProviderBody;
global.fetch = async (_url, options) => {
  providerCalls += 1; capturedProviderBody = JSON.parse(options.body);
  return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ node_type: 'Content', title: 'Mut zur Klarheit', body: 'Eine vollständige deutsche Kampagne für LinkedIn und Instagram.', rationale: 'Dieser Inhalt verdichtet die zentrale Idee für den Canvas.' }) }) };
};
process.env.OPENAI_API_KEY = 'test-only';
function response() { return { statusCode: 0, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
async function invoke(body = request) { const res = response(); await endpoint({ method: 'POST', body, headers: { 'x-ai-brain-generation': '7' } }, res); return res; }

(async () => {
  const beforeCanvas = JSON.stringify(canvas);
  const owner = await invoke();
  assert.strictEqual(owner.statusCode, 200); assert.strictEqual(providerCalls, 1); assert.strictEqual(authorizationCalls, 1);
  assert.strictEqual(capturedProviderBody.text.format.schema.required.length, 4);
  assert.strictEqual(owner.body.action, 'propose_content_node');
  assert(owner.body.node_proposal.proposal_id); assert.strictEqual(owner.body.node_proposal.source_turn_id, request.source_turn_id);
  assert.strictEqual(owner.body.node_proposal.node_type, 'Content');
  for (const forbidden of ['board_id', 'id', 'coordinates', 'edges', 'metadata']) assert(!Object.prototype.hasOwnProperty.call(owner.body.node_proposal, forbidden));
  assert.strictEqual(JSON.stringify(canvas), beforeCanvas, 'proposal endpoint must remain read-only');

  access = { board: { id: boardId }, access: { canEdit: true, role: 'editor' } };
  const editor = await invoke(); assert.strictEqual(editor.statusCode, 200); assert.strictEqual(providerCalls, 2);
  access = { board: { id: boardId }, access: { canEdit: false, role: 'viewer' } };
  const viewer = await invoke(); assert.strictEqual(viewer.statusCode, 403); assert.strictEqual(viewer.body.code, 'proposal_forbidden'); assert.strictEqual(providerCalls, 2);
  access = { board: { id: boardId }, access: { canEdit: false, role: 'public_viewer', publicView: true } };
  const publicViewer = await invoke(); assert.strictEqual(publicViewer.statusCode, 403); assert.strictEqual(providerCalls, 2);
  session = null;
  const unauthorized = await invoke(); assert.strictEqual(unauthorized.statusCode, 401); assert.strictEqual(unauthorized.body.code, 'proposal_unauthorized'); assert.strictEqual(providerCalls, 2);
  session = { email: 'owner@example.com' };
  const unknown = await invoke({ ...request, unexpected: true }); assert.strictEqual(unknown.statusCode, 400); assert.strictEqual(unknown.body.code, 'proposal_request_invalid'); assert.strictEqual(providerCalls, 2);

  const browserRequestFields = endpointSource.match(/const BODY_KEYS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map((value) => value.slice(1, -1)).sort();
  assert.deepStrictEqual(Object.keys(request).sort(), browserRequestFields);
  assert(app.includes('fetch("/api/ai-brain/propose-node", { method: "POST"'));
  assert(app.includes('AI_BRAIN_PROPOSAL_ERROR_CODES.has(data?.code) ? data.code'));
  assert(app.includes('error?.code || "proposal_network_failed"'));
  assert(app.includes('{ status: "ready", data: proposal'));
  assert(app.includes('proposal?.status !== "ready"')); assert(app.includes('appliedProposalIds.has'));
  for (const code of ['proposal_route_unavailable', 'proposal_unauthorized', 'proposal_forbidden', 'proposal_request_invalid', 'proposal_source_invalid', 'proposal_canvas_invalid', 'proposal_context_changed', 'proposal_provider_failed', 'proposal_response_invalid', 'proposal_language_mismatch', 'proposal_network_failed', 'proposal_generic_failed']) assert(app.includes(code), code);
  assert.strictEqual(packageJson.scripts['check:bw26.6.1'], 'node scripts/check-bw26-6-1-node-proposal-production-failure.js');
  assert(workflow.indexOf('check-bw26-6-controlled-ai-brain-node-creation.js') < workflow.indexOf('check-bw26-6-1-node-proposal-production-failure.js'));
  console.log('BW-26.6.1 production-boundary regression checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
