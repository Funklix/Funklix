'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const endpointSource = fs.readFileSync(path.join(root, 'api/ai-brain/propose-node.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');
const packageJson = require(path.join(root, 'package.json'));
const {fixture, BOARD:boardId} = require('./fixtures/bw37-1c3a-proposal-runtime');
process.env.AUTH_SECRET = 'fictional-production-boundary-secret';
const runtime = fixture();
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
const request = { action: 'propose_content_node', board_id: boardId, source_turn_id: 'turn-de-production', source_answer: answer, selected_node_id: null, canvas_context: canvas, response_language: 'de', content_language: 'de', expected_scope: runtime.request.expected_scope };

// Exercise the deployed route with signed sessions and the real access helper.
let session = { id:'owner-id', email:'owner@example.test' };
const endpoint = runtime.handler;
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
  return new Response(JSON.stringify({ output_text: JSON.stringify({ node_type: 'Content', title: 'Mut zur Klarheit', body: 'Eine vollständige deutsche Kampagne für LinkedIn und Instagram.', rationale: 'Dieser Inhalt verdichtet die zentrale Idee für den Canvas.' }) }));
};
process.env.OPENAI_API_KEY = 'test-only';
async function invoke(body = request) { runtime.user = session; runtime.identity.canonical_email = session?.email || 'owner@example.test'; return runtime.invoke(body); }

(async () => {
  const beforeCanvas = JSON.stringify(canvas);
  const owner = await invoke();
  assert.strictEqual(owner.statusCode, 200); assert.strictEqual(providerCalls, 1); assert.strictEqual(runtime.capture, 3);
  assert.strictEqual(capturedProviderBody.text.format.schema.required.length, 4);
  assert.strictEqual(owner.body.action, 'propose_content_node');
  assert(owner.body.node_proposal.proposal_id); assert.strictEqual(owner.body.node_proposal.source_turn_id, request.source_turn_id);
  assert.strictEqual(owner.body.node_proposal.node_type, 'Content');
  for (const forbidden of ['board_id', 'id', 'coordinates', 'edges', 'metadata']) assert(!Object.prototype.hasOwnProperty.call(owner.body.node_proposal, forbidden));
  assert.strictEqual(JSON.stringify(canvas), beforeCanvas, 'proposal endpoint must remain read-only');

  session = {email:'editor@example.test'}; runtime.role = 'editor';
  const editor = await invoke(); assert.strictEqual(editor.statusCode, 200); assert.strictEqual(providerCalls, 2);
  runtime.role = 'viewer';
  const viewer = await invoke(); assert.strictEqual(viewer.statusCode, 403); assert.strictEqual(viewer.body.code, 'proposal_forbidden'); assert.strictEqual(providerCalls, 2);
  runtime.role = 'public_viewer';
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
