'use strict';
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw36-20-database');
const REV = '2026-10-29T08:00:00.123Z';
const nodes = [
  { id: 'node-27', type: 'Content', title: 'Workshop invitation', content: 'Join the fictional makers workshop.' },
  { id: '7b910c24-8bda-42fb-b4a8-497f12c62c39', type: 'Landing Page', title: 'Workshop invitation', landingPage: { headerClaim: 'Make something together.' } },
  { id: 'node-901', type: 'Idea', title: 'Workshop invitations', content: 'A community open studio.' }
];
(async () => {
  const f = await fixture({ goals: true, signedSession: true });
  const resolver = f.load('api/ai-brain/node-reference.js'), auth = f.load('api/_auth-session.js');
  async function reset() {
    await f.reset(); f.onRows = (_sql, result) => ({ ...result, rowCount: result.rows.length }); f.env.AUTH_SECRET = 'fictional-bw40-session';
    await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb, updated_at=$2', [JSON.stringify({ nodes, edges: [] }), '2026-10-29T08:00:00.123456Z']);
  }
  async function advice(answer, extra = {}) {
    f.answer = answer;
    return f.invoke({ question: 'Review this Canvas and identify improvements.', canvas_revision: REV, canvas_context: { nodes, edges: [] }, ...extra });
  }
  async function open(ref, extra = {}, session = f.user) {
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await resolver({ method: 'POST', body: { board_id: f.BOARD, node_id: ref.nodeId, scope_revision: ref.scopeRevision, ...extra }, headers: session ? { cookie: 'funklix_session=' + auth.createSessionToken(session) } : {} }, res);
    return res;
  }
  try {
    await reset();
    for (const [answer, ids] of [
      ['I would clarify Node #1.', [nodes[0].id]],
      ['Clarify Node #1, then align Node #2 with Node #3.', nodes.map(n => n.id)],
      ['Node #1 and Node #1 need a clearer invitation.', [nodes[0].id]],
      ['27 registrations, #1, Node 1 and Workshop invitation are ambiguous.', []],
      ['Node #27, Node #999, Node #01, Node #1.5, Node #1/2, Node #2,7, Node #1–3, Node #2fake and node-27.', []],
      ['Ich würde Node #2 mit dem Ziel der Kampagne verbinden.', [nodes[1].id]]
    ]) {
      const before = f.calls.length;
      const r = await advice(answer, { response_language: answer.startsWith('Ich') ? 'de' : 'en' });
      assert.equal(r.statusCode, 200); assert.equal(r.body.answer, answer);
      assert.deepEqual(Array.from(r.body.nodeReferences, ref => ref.nodeId), ids);
      assert.equal(f.calls.length, before + 1);
      const call = f.calls.at(-1); assert.equal(call.model, 'gpt-4o-mini'); assert.equal(call.store, false); assert(!call.tools && !call.text);
      const context = JSON.parse(call.input[1].content.split('\n').slice(1).join('\n'));
      assert.deepEqual(context.workingCanvas.nodeReferences, nodes.map((n, i) => ({ label: `Node #${i + 1}`, nodeId: n.id })));
    }
    const r = await advice('Node #1 needs a clearer next step.'); const ref = r.body.nodeReferences[0];
    let calls = f.calls.length;
    assert.equal((await open(ref)).statusCode, 200);
    assert.equal((await open(ref, {}, null)).statusCode, 401);
    assert.equal((await open(ref, { node_id: 'node-999' })).statusCode, 409);
    assert.equal((await open(ref, { node_id: nodes[1].id })).statusCode, 409, 'A valid digest cannot be substituted onto another existing node');
    assert.equal((await open(ref, { board_id: f.OTHER })).statusCode, 409);
    assert.equal((await open(ref, { scope_revision: 'a'.repeat(64) })).statusCode, 409);
    assert.equal(f.calls.length, calls);
    // BW-44: same read-only resolver, independently authorized deterministic entry.
    const expected = { updated_at: REV, brand_id: f.BRAND, workspace_id: null };
    async function insights(extra = {}, session = f.user) {
      const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await resolver({ method: 'POST', body: { source: 'insights', board_id: f.BOARD, node_id: nodes[0].id, node_type: nodes[0].type, expected_scope: expected, ...extra }, headers: session ? { cookie: 'funklix_session=' + auth.createSessionToken(session) } : {} }, res);
      return res;
    }
    await reset();
    const checked = await insights(); assert.equal(checked.statusCode, 200);
    assert.deepEqual(Object.keys(checked.body).sort(), ['nodeId', 'scopeRevision']);
    assert.equal(checked.body.nodeId, nodes[0].id); assert.match(checked.body.scopeRevision, /^[a-f0-9]{64}$/);
    assert.equal((await insights({ node_id: nodes[1].id, node_type: nodes[1].type })).body.nodeId, nodes[1].id, 'Identical titles retain exact IDs');
    assert.equal((await insights({}, null)).statusCode, 401);
    for (const extra of [{ source: 'other' }, { surprise: true }, { scope_revision: 'a'.repeat(64) },
      { node_type: null }, { node_type: 'Unknown' }, { node_id: '' }, { board_id: 'bad' },
      { expected_scope: null }, { expected_scope: { ...expected, surprise: true } },
      { expected_scope: { ...expected, brand_id: undefined } }, { expected_scope: { ...expected, updated_at: 'invalid' } },
      { expected_scope: { ...expected, workspace_id: 'bad' } }]) assert.equal((await insights(extra)).statusCode, 400, JSON.stringify(extra));
    for (const extra of [{ node_id: 'new-unsaved' }, { node_type: 'Idea' }, { board_id: f.OTHER },
      { expected_scope: { ...expected, updated_at: '2026-10-30' } }, { expected_scope: { ...expected, brand_id: f.OTHER } }])
      assert.equal((await insights(extra)).statusCode, 409);
    await f.pg.exec("UPDATE board_editors SET role='viewer'");
    assert.equal((await insights()).statusCode, 200, 'Authenticated Board viewer can resolve only this deterministic branch');
    assert.equal((await open(ref)).statusCode, 409, 'Original Brain contract remains edit-only');
    const scope = f.load('api/_ai-brain-proposal-scope.js');
    await assert.rejects(() => scope.capture({ boardId: f.BOARD, user: f.user, includeCanvas: true }), /proposal_forbidden/, 'Default capture remains edit-only');
    assert.equal((await advice('Node #1 needs work.')).statusCode, 403, 'Viewer cannot infer through Advice');
    for (const mutate of [
      () => f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: nodes.slice(1) })]),
      () => f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: [...nodes, nodes[0]] })]),
      () => f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: nodes.map((n,i) => i ? n : { ...n, type: 'Idea' }) })]),
      () => f.pg.exec('DELETE FROM board_editors; DELETE FROM brand_members'),
      () => f.pg.exec("UPDATE app_identities SET status='disabled'"),
      () => f.pg.exec("UPDATE boards SET updated_at='2026-10-30'"),
      () => f.pg.query('UPDATE brands SET workspace_id=$1', [f.OTHER])
    ]) { await reset(); await mutate(); assert.equal((await insights()).statusCode, 409); }
    // Workspace checks remain mandatory even with an independently granted Board VIEW.
    for (const change of ["UPDATE workspace_memberships SET status='pending'", "DELETE FROM workspace_memberships", "UPDATE workspaces SET status='inactive'", "UPDATE workspace_memberships SET role='invalid'"]) {
      await reset();
      await f.pg.query("INSERT INTO workspaces(id,status,revision) VALUES($1,'active',1)", [f.OTHER]);
      await f.pg.query("INSERT INTO workspace_memberships(workspace_id,identity_id,status,role) VALUES($1,$2,'accepted','viewer')", [f.OTHER, f.IDENTITY]);
      await f.pg.query('UPDATE boards SET workspace_id=$1', [f.OTHER]); await f.pg.query('UPDATE brands SET workspace_id=$1', [f.OTHER]);
      assert.equal((await insights({ expected_scope: { ...expected, workspace_id: f.OTHER } })).statusCode, 200);
      await f.pg.exec(change);
      assert.equal((await insights({ expected_scope: { ...expected, workspace_id: f.OTHER } })).statusCode, 409, change);
    }
    await reset(); let captures = 0;
    f.onQuery = async sql => { if (/^BEGIN/.test(sql) && ++captures === 2) await f.pg.exec('DELETE FROM board_editors; DELETE FROM brand_members'); };
    assert.equal((await insights()).statusCode, 409, 'Revocation between captures fails closed'); f.onQuery = null;
    await reset(); captures = 0;
    f.onQuery = async sql => { if (/^BEGIN/.test(sql) && ++captures === 2) await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: nodes.map(n => ({ ...n, title: 'Changed' })) })]); };
    assert.equal((await insights()).statusCode, 409, 'Source fingerprint changes fail closed'); f.onQuery = null;
    await reset(); f.onQuery = async () => { throw new Error('disposable service failure'); };
    assert.equal((await insights()).statusCode, 503, 'Retryable failure'); f.onQuery = null;
    assert.equal((await insights()).statusCode, 200);
    assert.equal(f.calls.length, 0, 'No inference through deterministic resolver');
    await reset();
    // Unsaved/forged nodes cannot acquire persisted navigation even with a label.
    const forged = await advice('Node #4 needs work.', { canvas_context: { nodes: [...nodes, { id: 'forged', type: 'Content', title: nodes[0].title }], edges: [] } });
    assert.equal(forged.statusCode, 200); assert.equal(forged.body.nodeReferences.length, 0);
    for (const mutate of [
      () => f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: nodes.slice(1), edges: [] })]),
      () => f.pg.exec("UPDATE boards SET updated_at='2026-10-30'"),
      () => f.pg.exec('DELETE FROM board_editors'),
      () => f.pg.exec("UPDATE app_identities SET status='disabled'"),
      () => f.pg.query('UPDATE boards SET workspace_id=$1', [f.OTHER]),
      () => f.pg.query('UPDATE brands SET workspace_id=$1', [f.OTHER])
    ]) {
      await reset(); const fresh = (await advice('Node #1 needs work.')).body.nodeReferences[0];
      await mutate(); assert.equal((await open(fresh)).statusCode, 409);
    }
    await reset(); f.onProvider = () => f.pg.exec('DELETE FROM board_editors');
    assert.equal((await advice('Node #1 needs work.')).statusCode, 409);
    await reset();
    const plain = await advice('I would make the invitation clearer and explain the next step.');
    assert.equal(plain.statusCode, 200); assert.equal(plain.body.nodeReferences.length, 0);
    assert(f.queries.every(q => /^(SELECT|BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(q.sql)), 'read-only route queries');
    console.log('PASS BW-40 deterministic labels, exact IDs/similar titles, EN/DE natural Advice, forged/ambiguous numbers, deleted/stale/wrong scope/revoked access, one inference and zero writes');
  } finally { await f.pg.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
