'use strict';
// Fictional SQL, real signed sessions/ACL/scope/Advice, mocked Responses only.
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw36-20-database');
const clone = value => JSON.parse(JSON.stringify(value));
const REV = '2026-10-29T08:00:00.123Z';
const nodes = [
  { id: 'same-title-first', type: 'Social Media Posting', title: 'Workshop', social: { cta: 'Join us', caption: 'Register for the workshop using the form.', preview: 'A creative afternoon' }, goal: 'Increase workshop registrations' },
  { id: 'exact-target', type: 'Social Media Post', title: 'Workshop', social: { cta: 'Discover more 🚀', caption: 'Explore a new way of making together.', preview: 'Workshop stories' }, goal: 'Increase workshop registrations' }
];
const candidate = (id = nodes[1].id, field = 'social.cta', quote = nodes[1].social.cta) => ({ title: 'The invitation is broad', explanation: 'The wording leaves the destination ambiguous relative to the registration goal.',
  evidence: [{ nodeId: id, field, quote }, { nodeId: id, field: 'goal', quote: nodes[1].goal }] });
async function main() {
  const f = await fixture({ goals: true, signedSession: true });
  const resolver = f.load('api/ai-brain/evidence-reference.js');
  const auth = f.load('api/_auth-session.js');
  const request = overrides => f.invoke({ advice_mode: 'analyze_social_ctas', question: 'Which of our current social posts have unclear CTAs, and why?',
    canvas_revision: REV, canvas_context: { nodes: clone(nodes), edges: [] }, ...overrides });
  async function reset() {
    await f.reset(); f.env.AUTH_SECRET = 'fictional-bw39-disposable-session-secret';
    await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb, updated_at=$2', [JSON.stringify({ nodes, edges: [] }), '2026-10-29T08:00:00.123456Z']);
    f.answer = JSON.stringify({ answer: 'I would make the destination more specific. CTA clarity remains an interpretation of the supplied copy.', findings: [candidate()] });
  }
  async function open(reference, extra = {}, cookie = null) {
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await resolver({ method: 'POST', headers: { cookie: cookie ?? (f.user ? 'funklix_session=' + auth.createSessionToken(f.user) : '') },
      body: { board_id: f.BOARD, node_id: reference.nodeId, scope_revision: reference.scopeRevision, ...extra } }, res);
    return res;
  }
  try {
    await reset();
    let result = await request(); assert.equal(result.statusCode, 200);
    let finding = result.body.findings[0]; assert(finding);
    assert.equal(finding.nodeId, nodes[1].id); assert.equal(finding.type, 'Social Media Posting'); assert.equal(finding.nodeTitle, 'Workshop');
    assert.deepEqual(Array.from(finding.evidence, e => e.state), ['saved', 'saved']);
    assert.equal(finding.sourceCheck, 'matched'); assert.equal(finding.kind, 'interpretation');
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].store, false); assert.equal(f.calls[0].max_output_tokens, 4096);
    assert(f.context.tokens(f.calls[0].input, f.context.modelConstraints()) + 5120 <= 128000);
    const context = JSON.parse(f.calls[0].input[1].content.split('\n').slice(1).join('\n'));
    assert.equal(context.workingCanvas.nodes[0].social.caption, nodes[0].social.caption, 'CTA counterevidence is supplied');
    assert.match(f.calls[0].input[0].content, /Check all supplied CTA fields/);
    let before = f.queries.length;
    assert.equal((await open(finding.reference)).statusCode, 200); assert.equal(f.calls.length, 1);
    assert(f.queries.slice(before).every(q => /^(SELECT|BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(q.sql)), 'Open is read-only');
    assert(!JSON.stringify(result.body).includes('owner@example.invalid'));
    console.log('PASS signed sessions, persisted alias/repeated title/exact ID, saved CTA+goal, counterevidence, bounded source and one unchanged model call; resolver zero inference/writes');

    await reset(); const working = clone(nodes); working[1].social.cta = 'More inspiration';
    f.answer = JSON.stringify({ answer: 'I would clarify the destination.', findings: [candidate(nodes[1].id, 'social.cta', working[1].social.cta)] });
    result = await request({ canvas_context: { nodes: working, edges: [] } });
    assert.deepEqual(Array.from(result.body.findings[0].evidence, e => e.state), ['working', 'saved']);
    for (const copy of ['  Café, Künstler:innen 🚀  ', 'x'.repeat(179) + '🚀' + 'more'.repeat(60), 'x'.repeat(3001)]) {
      await reset(); const full = clone(nodes); full[1].social.cta = copy;
      await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: full, edges: [] })]);
      const projected = clone(full); projected[1].social.cta = copy.slice(0, 3000);
      const normalized = projected[1].social.cta.trim();
      f.answer = JSON.stringify({ answer: 'I would clarify the invitation.', findings: [candidate(nodes[1].id, 'social.cta', normalized.slice(0, 180))] });
      result = await request({ canvas_context: { nodes: projected, edges: [] } }); assert.equal(result.statusCode, 200);
      assert.equal(result.body.findings[0].evidence[0].state, copy.length > 3000 ? 'working' : 'saved');
      assert.equal(result.body.findings[0].evidence[0].quote, normalized.slice(0, 180));
      assert.equal(result.body.findings[0].evidence[0].excerpted, normalized.length > 180);
    }
    console.log('PASS field-specific working/saved split, normalization, full-value equality rather than prefixes, truncated copy and Unicode exact excerpts');
    await reset(); const conflict = clone(nodes); conflict[1].social.cta = ''; conflict[1].social.preview = 'A creative afternoon'; conflict[1].social.caption = 'Register for the workshop using the form.';
    const absent = candidate(nodes[1].id, 'social.preview', conflict[1].social.preview); absent.title = 'This post has no CTA';
    f.answer = JSON.stringify({ answer: 'The caption includes a registration action; the preview alone is insufficient to judge the whole post.', findings: [absent] });
    result = await request({ canvas_context: { nodes: conflict, edges: [] } }); assert.equal(result.body.findings.length, 0);
    const supplied = JSON.parse(f.calls[0].input[1].content.split('\n').slice(1).join('\n'));
    assert.equal(supplied.workingCanvas.nodes[1].social.caption, conflict[1].social.caption);
    await reset();
    const longCopy = clone(nodes); longCopy[1].social.cta = 'a'.repeat(180) + 'Later phrase';
    f.answer = JSON.stringify({ answer: 'This excerpt is outside citable coverage.', findings: [candidate(nodes[1].id, 'social.cta', 'Later phrase')] });
    result = await request({ canvas_context: { nodes: longCopy, edges: [] } }); assert.equal(result.body.findings.length, 0, 'no citation salvage outside exact indexed prefix');

    for (const mutate of [
      c => { c.evidence[0].nodeId = 'hidden'; }, c => { c.evidence[0].quote = 'forged'; },
      c => { c.evidence[0].field = 'landingPage.cta'; }, c => { c.evidence[0].state = 'saved'; },
      c => { c.nodeTitle = 'forged'; }, c => { c.url = 'https://evil.invalid'; },
      c => { c.evidence = [c.evidence[1]]; }, c => { c.title = 'All posts lack a CTA'; },
      c => { c.title = 'Conversion rate improves by 40%'; }
    ]) {
      await reset(); const c = candidate(); mutate(c); f.answer = JSON.stringify({ answer: 'The supplied evidence is limited.', findings: [c] });
      result = await request(); assert([200, 502].includes(result.statusCode));
      if (result.statusCode === 200) assert.equal(result.body.findings.length, 0);
      assert.equal(f.calls.length, 1);
    }
    for (const providerResponse of [
      { output_text: '{"answer":"broken' }, { output_text: JSON.stringify({ answer: 'Text', findings: [], extra: true }) },
      { output_text: 'x'.repeat(24001) }, { status: 'incomplete', output_text: JSON.stringify({ answer: 'Text', findings: [] }) },
      { output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'No' }] }] },
      { output: {} }, { output: [{ content: 'malformed' }] }
    ]) {
      await reset(); f.providerResponse = providerResponse; result = await request(); assert.equal(result.statusCode, 502);
      assert.equal(result.body.code, 'evidence_response_invalid'); assert(!result.body.answer); assert.equal(f.calls.length, 1);
    }
    console.log('PASS forged/out-of-scope IDs/quotes/fields/metadata, unsupported claims, malformed/oversized/incomplete/refusal output; no salvage or repair calls');

    for (const test of ['goal-only', 'no-goal', 'empty', 'never-saved', 'deleted', 'outside-index']) {
      await reset(); let working = clone(nodes);
      if (test === 'goal-only') { delete working[1].social; }
      if (test === 'no-goal') { working.forEach(node => delete node.goal); }
      if (test === 'empty') working = [];
      if (test === 'never-saved' || test === 'deleted') await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: [nodes[0]], edges: [] })]);
      if (test === 'outside-index') working = [...Array.from({ length: 24 }, (_, i) => ({ id: 'n' + i, type: 'Idea', content: 'Positive copy' })), ...working];
      const c = candidate(); if (test === 'no-goal') c.evidence = c.evidence.slice(0, 1);
      f.answer = JSON.stringify({ answer: 'Evidence is limited; I would review the invitation.', findings: test === 'empty' ? [] : [c] });
      result = await request({ canvas_context: { nodes: working, edges: [] } }); assert.equal(result.statusCode, 200);
      assert.equal(result.body.findings.length, test === 'no-goal' ? 1 : 0);
    }
    await reset(); f.answer = JSON.stringify({ answer: 'There is insufficient reliable copy to identify a CTA issue.', findings: [] });
    result = await request(); assert.equal(result.statusCode, 200); assert.equal(result.body.findings.length, 0);
    console.log('PASS insufficient evidence/empty success, absent goals, goal-only/outside-index/deleted/never-saved references omitted');

    const WORKSPACE = '55555555-5555-4555-8555-555555555555';
    async function workspace() {
      await f.pg.query("INSERT INTO workspaces(id,status) VALUES ($1,'active')", [WORKSPACE]);
      await f.pg.query("INSERT INTO workspace_memberships VALUES ($1,$2,'accepted','member')", [WORKSPACE, f.IDENTITY]);
      await f.pg.query('UPDATE boards SET workspace_id=$1', [WORKSPACE]);
      await f.pg.query('UPDATE brands SET workspace_id=$1 WHERE id=$2', [WORKSPACE, f.BRAND]);
    }
    const mutations = [
      () => f.pg.exec('DELETE FROM board_editors'), () => f.pg.exec("UPDATE app_identities SET status='disabled'"),
      () => f.pg.exec('UPDATE app_identities SET revision=revision+1'), () => f.pg.exec("UPDATE workspace_memberships SET status='revoked'"),
      () => f.pg.exec('UPDATE workspaces SET revision=revision+1'), () => f.pg.exec('UPDATE brands SET workspace_id=NULL'),
      () => f.pg.exec('UPDATE boards SET brand_id=NULL'), () => f.pg.exec('UPDATE boards SET workspace_id=NULL'),
      () => f.pg.exec("UPDATE boards SET updated_at='2026-10-29T08:00:00.123457Z'"),
      () => f.pg.query('UPDATE boards SET canvas_json=$1::jsonb', [JSON.stringify({ nodes: [nodes[0]], edges: [] })])
    ];
    for (const mutate of mutations) {
      await reset(); await workspace(); result = await request(); finding = result.body.findings[0]; assert(finding);
      await mutate(); assert.notEqual((await open(finding.reference)).statusCode, 200); assert.equal(f.calls.length, 1);
      await reset(); await workspace(); f.onProvider = mutate;
      const noGoals = clone(nodes); noGoals.forEach(node => delete node.goal);
      result = await request({ canvas_context: { nodes: noGoals, edges: [] } });
      assert.equal(result.statusCode, 409); assert(!result.body.answer); assert.equal(f.calls.length, 1);
      await reset(); await workspace(); result = await request(); finding = result.body.findings[0];
      let captures = 0;
      f.onQuery = async query => { if (/^BEGIN/.test(query) && ++captures === 2) { f.onQuery = null; await mutate(); } };
      assert.notEqual((await open(finding.reference)).statusCode, 200, 'revocation/source changes between resolver captures fail closed');
      assert.equal(f.calls.length, 1);
    }
    await reset(); result = await request(); finding = result.body.findings[0];
    assert.equal((await open(finding.reference, {}, 'funklix_session=forged.invalid')).statusCode, 401);
    assert.notEqual((await open(finding.reference, { board_id: f.OTHER })).statusCode, 200);
    assert.equal((await open(finding.reference, { node_id: 'never-saved' })).statusCode, 409);
    assert.equal((await open(finding.reference, { arbitrary: 'field' })).statusCode, 400);
    await reset(); await f.pg.exec('DELETE FROM brand_members'); result = await request(); assert.equal(result.statusCode, 200);
    assert(!JSON.stringify(f.calls).includes('Premium'), 'Board-only access cannot reveal canonical Brand');
    await reset(); f.user = null; result = await request(); assert.equal(result.statusCode, 401); assert.equal(f.calls.length, 0);
    await reset(); assert.equal((await request({ canvas_revision: null })).statusCode, 409); assert.equal(f.calls.length, 0);
    await reset(); f.answer = 'Legacy conversational advice'; result = await request({ advice_mode: 'general' });
    assert.equal(result.body.answer, f.answer); assert(!Object.hasOwn(result.body, 'findings'));
    await reset();
    Object.assign(f.env, { OPENAI_AI_BRAIN_MODEL: 'fictional-bounded-model', OPENAI_AI_BRAIN_CONTEXT_MODEL: 'fictional-bounded-model', OPENAI_AI_BRAIN_CONTEXT_TOKENS: '5121', OPENAI_AI_BRAIN_TOKEN_ENCODING: 'o200k_base' });
    result = await request(); assert.equal(result.statusCode, 422); assert.equal(result.body.code, 'advice_context_too_large'); assert.equal(f.calls.length, 0, 'envelope instructions count against complete-message budget');
    console.log('PASS no-goal active identity/Workspace/ACL/association/raw microsecond/source revalidation, signed-session denial, hidden Board/canonical isolation, revoked/stale/deleted resolver, legacy text Advice');
  } finally { await f.pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
