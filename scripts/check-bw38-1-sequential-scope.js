'use strict';
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw37-1c3a-proposal-runtime');
process.env.AUTH_SECRET = 'bw38-fictional-server-session';
const originalFetch = global.fetch;
let calls = 0;
global.fetch = async (_url, options) => {
  calls++;
  const request = JSON.parse(options.body);
  assert.equal(request.store, false);
  assert.equal(request.input.length, 2);
  return new Response(JSON.stringify({ output_text: JSON.stringify({ node_type: 'Content', title: 'Reviewed content', body: 'A fictional independently selected Content source.', rationale: '' }) }), { headers: { 'Content-Type': 'application/json' } });
};
const social = r => ({ ...r.request, action: 'propose_social_node', source_answer: 'Instagram Post\nCaption: A fictional native source.' });
async function main() {
  const r = fixture(), first = await r.invoke(social(r));
  assert.equal(first.statusCode, 200); assert.equal(calls, 0);
  const oldRevision = r.board.updated_at;
  r.board.updated_at = '2026-10-27T10:01:00.000Z';
  const expected_scope = { ...r.request.expected_scope, updated_at: r.board.updated_at };
  const second = await r.invoke({ ...social(r), expected_scope, continuation_revision: first.body.continuation_revision });
  assert.equal(second.statusCode, 200);
  assert.notEqual(second.body.scope_revision, first.body.scope_revision);
  assert.equal(second.body.continuation_revision, first.body.continuation_revision);
  const preflight = { board_id: r.board.id, expected_scope, scope_revision: first.body.scope_revision, prepared_updated_at: oldRevision, continuation_revision: first.body.continuation_revision };
  assert.equal((await r.invoke({ board_id: r.board.id, expected_scope, scope_revision: first.body.scope_revision }, 'POST', r.scopeHandler)).statusCode, 409);
  const renewed = await r.invoke(preflight, 'POST', r.scopeHandler);
  assert.equal(renewed.statusCode, 200); assert.equal(renewed.body.scope_revision, second.body.scope_revision);
  for (const changes of [ { prepared_updated_at: '2020-01-01' }, { continuation_revision: 'f'.repeat(64) }, { extra: true }, { prepared_updated_at: null } ]) {
    assert.notEqual((await r.invoke({ ...preflight, ...changes }, 'POST', r.scopeHandler)).statusCode, 200);
  }
  for (const change of [
    x => x.identity.id = '55555555-5555-4555-8555-555555555555', x => x.identity.revision = '2',
    x => x.user.sub = 'replacement-session-subject', x => x.membership = null,
    x => x.membership.role = 'viewer', x => x.workspace.revision = '2',
    x => x.board.owner_id = 'replacement-owner', x => x.association.workspace_id = null
  ]) {
    const x = fixture(), initial = await x.invoke(social(x)); assert.equal(initial.statusCode, 200);
    const old = x.board.updated_at; x.board.updated_at = r.board.updated_at; change(x);
    const expected = { ...x.request.expected_scope, updated_at: x.board.updated_at };
    const prepared = await x.invoke({ ...social(x), expected_scope: expected, continuation_revision: initial.body.continuation_revision });
    assert.notEqual(prepared.statusCode, 200);
    const created = await x.invoke({ board_id: x.board.id, expected_scope: expected, scope_revision: initial.body.scope_revision, prepared_updated_at: old, continuation_revision: initial.body.continuation_revision }, 'POST', x.scopeHandler);
    assert.notEqual(created.statusCode, 200);
  }
  const x = fixture(), initial = await x.invoke(social(x));
  process.env.OPENAI_API_KEY = 'fictional-key';
  x.board.updated_at = r.board.updated_at;
  const content = await x.invoke({ ...x.request, expected_scope: { ...x.request.expected_scope, updated_at: x.board.updated_at }, continuation_revision: initial.body.continuation_revision });
  assert.equal(content.statusCode, 200, JSON.stringify(content.body)); assert.equal(calls, 1);
  assert.equal(content.body.node_proposal.node_type, 'Content');
  assert.equal(content.body.continuation_revision, initial.body.continuation_revision);
  x.identity.revision = '2';
  assert.equal((await x.invoke({ ...x.request, expected_scope: { ...x.request.expected_scope, updated_at: x.board.updated_at }, continuation_revision: initial.body.continuation_revision })).statusCode, 409);
  assert.equal(calls, 1, 'Changed identity must fail before Content inference');
  console.log('PASS signed sequential scope: only timestamp changes, original prepared checksum renewal, identity/ACL/Workspace/association binding, malformed checksums rejected; Social zero calls, Content one explicit call');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
