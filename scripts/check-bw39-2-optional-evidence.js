'use strict';
// Production route, signed sessions, disposable SQL, mocked provider transport.
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw36-20-database');
(async () => {
  const f = await fixture({ goals: true, signedSession: true });
  const revision = '2026-10-29T08:00:00.123Z';
  const nodes = [{ id: 'fictional-social', type: 'Social Media Posting', title: 'Workshop', social: { cta: 'Discover more' } }];
  const answer = 'I would name the destination more specifically. This is an interpretation of the supplied copy.';
  const finding = { title: 'The invitation is broad', explanation: 'The destination of the invitation is ambiguous.', evidence: [{ nodeId: nodes[0].id, field: 'social.cta', quote: 'Discover more' }] };
  async function request(raw, mutate = null, extra = {}) {
    await f.reset(); f.env.AUTH_SECRET = 'fictional-bw39-2-disposable-session';
    await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb,updated_at=$2', [JSON.stringify({ nodes, edges: [] }), '2026-10-29T08:00:00.123456Z']);
    f.providerResponse = { status: 'completed', output_text: raw, ...extra };
    f.onProvider = mutate;
    const result = await f.invoke({ advice_mode: 'analyze_social_ctas', question: 'Review these social calls to action.', canvas_revision: revision, canvas_context: { nodes, edges: [] } });
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].store, false); assert.equal(f.calls[0].model, 'gpt-4o-mini');
    assert.equal(f.calls[0].max_output_tokens, 4096); assert(!f.calls[0].tools && !f.calls[0].text);
    assert(f.queries.every(q => /^(SELECT|BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(q.sql)), 'no route writes');
    return result;
  }
  try {
    for (const findings of [[], [finding]]) {
      const r = await request(JSON.stringify({ answer, findings }));
      assert.equal(r.statusCode, 200); assert.equal(r.body.answer, answer); assert.equal(r.body.findings.length, findings.length);
      assert(!r.body.evidenceContext.evidenceUnavailable);
    }
    for (const metadata of [{}, { findings: null }, { findings: {} }, { findings: 'PRIVATE_METADATA' }, { findings: [null] },
      { findings: Array(4).fill(finding) }, { findings: [{ ...finding, extra: 'PRIVATE_METADATA' }] },
      { findings: [{ ...finding, evidence: [] }] }, { findings: [{ ...finding, evidence: [{ ...finding.evidence[0], extra: true }] }] }]) {
      const r = await request(JSON.stringify({ answer, ...metadata }));
      assert.equal(r.statusCode, 200); assert.equal(r.body.answer, answer); assert.equal(r.body.findings.length, 0);
      assert.equal(r.body.evidenceContext.evidenceUnavailable, true); assert(!JSON.stringify(r.body).includes('PRIVATE_METADATA'));
    }
    // Optional wrong-language cards are omitted without losing an English answer.
    const foreign = { ...finding, title: 'Die Einladung ist für die Nutzer nicht klar und das Ziel ist nicht erkennbar.' };
    let r = await request(JSON.stringify({ answer, findings: [foreign] }));
    assert.equal(r.statusCode, 200); assert.equal(r.body.answer, answer); assert.equal(r.body.findings.length, 0); assert.equal(r.body.evidenceContext.omittedFindings, 1);
    for (const raw of [
      '{"answer":"First","answer":"Second","findings":[]}',
      '{"answer":"First","\\u0061nswer":"Second","findings":[]}',
      '{"answer":"First","findings":[],"findings":{}}',
      JSON.stringify({ answer, findings: [finding] }).slice(0, -2),
      JSON.stringify({ answer, findings: [] }) + JSON.stringify({ answer: 'Second' }),
      JSON.stringify({ answer, findings: [] }) + ' trailing text',
      JSON.stringify({ answer: '{"findings":[broken', findings: [] }),
      JSON.stringify({ answer: '```json\n{"answer":"text"}\n```', findings: [] }),
      JSON.stringify({ answer: '\u0000unsafe', findings: [] }),
      JSON.stringify({ answer: '', findings: [] }), JSON.stringify({ answer: 'x'.repeat(12001) }),
      JSON.stringify({ answer: null }), JSON.stringify({ findings: [] }), JSON.stringify({ answer, unknown: true }),
      answer, '{"answer":"Closed answer","findings":[broken]}'
    ]) {
      r = await request(raw); assert.equal(r.statusCode, 502); assert(!r.body.answer && !r.body.findings);
    }
    // Quotes, escapes and punctuation inside JSON strings are data, not boundaries.
    const escaped = 'I would keep the phrase "answer": and the braces { } as copy. Café 🚀\nThen clarify the invitation.';
    r = await request(JSON.stringify({ answer: escaped })); assert.equal(r.statusCode, 200); assert.equal(r.body.answer, escaped);
    for (const extra of [{ status: 'incomplete' }, { error: { code: 'server_error' } }, { status: 'failed' },
      { output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'No' }] }] }]) {
      r = await request(JSON.stringify({ answer, findings: null }), null, extra); assert.equal(r.statusCode, 502); assert(!r.body.answer);
    }
    // Both release paths retain independent freshness and authorization checks.
    for (const findings of [null, [finding]]) for (const mutate of [
      () => f.pg.exec('DELETE FROM board_editors'), () => f.pg.exec("UPDATE app_identities SET status='disabled'"),
      () => f.pg.exec("UPDATE boards SET updated_at='2026-10-29T08:00:00.123457Z'")
    ]) {
      r = await request(JSON.stringify({ answer, findings }), mutate);
      assert.equal(r.statusCode, 409); assert(!r.body.answer && !r.body.findings);
    }
    console.log('PASS BW-39.2 independent answer/optional schema, ambiguous boundaries, escaped keys/strings, invalid and incomplete output, refusal/errors, language, revocation/freshness, one unchanged inference and zero writes');
  } finally { await f.pg.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
