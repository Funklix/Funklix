'use strict';
// Actual Advice route, signed authorization, disposable saved SQL and mocked transport.
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw36-20-database');
const QUESTION = 'Which of our current social media posts have unclear or weak calls to action, and why? Identify the specific Canvas nodes and show their supporting evidence.';
const REV = '2026-10-29T08:00:00.123Z';
const nodes = Array.from({ length: 52 }, (_, i) => ({ id: `fictional-social-${i}`, type: 'Social Media Posting', title: `Fictional workshop ${i}`,
  social: { caption: i === 2 ? 'Register for the workshop using the form.' : 'Discover the workshop', ...(i === 2 ? {} : { cta: 'Discover more' }) },
  ...(i === 1 ? {} : { goal: 'Increase workshop registrations' }) }));
const finding = i => ({ title: 'The invitation is broad', explanation: 'The destination of the invitation is ambiguous; a more specific next step could help.',
  evidence: [{ nodeId: nodes[i].id, field: i === 2 ? 'social.caption' : 'social.cta', quote: i === 2 ? nodes[i].social.caption : nodes[i].social.cta }] });
const review = findings => ({ answer: 'I would clarify the destination of these invitations. This is an interpretation of the supplied copy; goals remain unknown where absent.', findings });
const message = (...parts) => ({ type: 'message', role: 'assistant', status: 'completed', content: parts.map(text => ({ type: 'output_text', text })) });
async function main() {
  const f = await fixture({ goals: true, signedSession: true });
  const warnings = [], originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  async function request(providerResponse, overrides = {}) {
    await f.reset(); f.env.AUTH_SECRET = 'fictional-disposable-r1-secret';
    await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb,updated_at=$2', [JSON.stringify({ nodes, edges: [] }), '2026-10-29T08:00:00.123456Z']);
    f.providerResponse = providerResponse;
    const result = await f.invoke({ advice_mode: 'analyze_social_ctas', question: QUESTION, canvas_revision: REV,
      canvas_context: { nodes, edges: [] }, ...overrides });
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].model, 'gpt-4o-mini');
    assert.equal(f.calls[0].store, false); assert.equal(f.calls[0].max_output_tokens, 4096);
    assert.equal(f.calls[0].input.at(-1).content, overrides.question || QUESTION);
    assert(!f.calls[0].tools); assert(f.context.tokens(f.calls[0].input, f.context.modelConstraints()) + 5120 <= 128000);
    return result;
  }
  try {
    for (const findings of [[finding(0)], [finding(0), finding(1), finding(2)]]) {
      const raw = JSON.stringify(review(findings)), split = Math.floor(raw.length / 2);
      assert(f.context.tokens(raw, f.context.modelConstraints()) < 4096, 'realistic multi-finding JSON fits unchanged output reservation');
      for (const provider of [
        { status: 'completed', output_text: raw },
        { status: 'completed', output_text: '', output: [message(raw.slice(0, split), raw.slice(split))] },
        { status: 'completed', output: [message(raw.slice(0, split), raw.slice(split))] },
        { status: 'completed', output: [{ type: 'reasoning', summary: [{ text: 'private reasoning' }] }, message(raw.slice(0, split)), { type: 'function_call', arguments: 'private tool data' }, message(raw.slice(split))] },
        { status: 'completed', output_text: raw, output: [message('ignored aggregate duplicate')] }
      ]) {
        const r = await request(provider); assert.equal(r.statusCode, 200); assert.equal(r.body.findings.length, findings.length);
        assert.equal(r.body.answer, review(findings).answer); assert.equal(r.body.evidenceContext.suppliedSocial, 52);
        assert.equal(r.body.evidenceContext.indexedSocial, 24, 'existing bounded coverage retained');
        assert.equal(r.body.findings[0].evidence[0].state, 'saved');
      }
    }
    console.log('PASS exact Appics-style question on 52 fictional saved Social nodes; single/multiple findings, missing CTA field with positive caption, missing goal, ambiguous copy, split blocks/messages and aggregate precedence');
    const errors = [
      ['json', { status: 'completed', output_text: '{"answer":"PRIVATE_BRAND_CANVAS_COPY' }],
      ['json', { status: 'completed', output_text: '{broken', output: [message(JSON.stringify(review([finding(0)])))] }],
      ['schema', { status: 'completed', output_text: JSON.stringify(review([finding(0), finding(1), finding(2), finding(3)])) }],
      ['schema', { status: 'completed', output_text: JSON.stringify(review([{ ...finding(0), evidence: [] }])) }],
      ['incomplete', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { output_tokens: 4096 }, output_text: JSON.stringify(review([finding(0)])) }],
      ['incomplete', { status: 'incomplete', incomplete_details: { reason: 'content_filter' }, usage: { output_tokens: 70 } }],
      ['refusal', { status: 'completed', output: [{ ...message(), content: [{ type: 'refusal', refusal: 'PRIVATE_BRAND_CANVAS_COPY' }] }] }],
      ['empty', { status: 'completed', output: [] }],
      ['envelope', { status: 'completed', output: 'PRIVATE_BRAND_CANVAS_COPY' }],
      ['size', { status: 'completed', output_text: 'x'.repeat(24001) }]
    ];
    for (const [reason, provider] of errors) {
      const count = warnings.length, r = await request(provider);
      assert.equal(r.statusCode, 502); assert.equal(r.body.code, 'evidence_response_invalid'); assert.equal(r.body.reason, reason);
      assert(!r.body.answer && !r.body.findings); assert.equal(warnings.length, count + 1);
      const [tag, diagnostic] = warnings.at(-1); assert.equal(tag, '[AI_BRAIN_EVIDENCE_REJECTED]');
      assert.equal(diagnostic.reason, reason); assert.equal(diagnostic.reservedOutputTokens, 4096);
      assert.deepEqual(Object.keys(diagnostic).sort(), ['reason', 'providerStatus', 'incompleteReason', 'outputTokens', 'outputCharacters', 'reservedOutputTokens'].sort());
      if (provider.usage) assert.equal(diagnostic.outputTokens, provider.usage.output_tokens);
    }
    assert(!JSON.stringify(warnings).includes('PRIVATE_BRAND_CANVAS_COPY')); assert(!JSON.stringify(warnings).includes(f.BOARD));
    assert(!JSON.stringify(warnings).includes(nodes[0].social.cta));
    console.log('PASS separately diagnosed malformed JSON/schema/over-limit findings/missing evidence/incomplete/refusal/empty/envelope/size; redacted allowlisted metadata, unchanged budget and exactly one call, no partial output');
    const forged = finding(0); forged.evidence[0].quote = 'Invented CTA';
    let r = await request({ output_text: JSON.stringify(review([forged])) }); assert.equal(r.statusCode, 200);
    assert.equal(r.body.findings.length, 0); assert.equal(r.body.evidenceContext.omittedFindings, 1, 'citation failure distinct from schema failure');
    const absence = finding(2); absence.title = 'This post has no CTA';
    r = await request({ output_text: JSON.stringify(review([absence])) }); assert.equal(r.body.findings.length, 0, 'caption counterevidence prevents absence finding');
    r = await request({ output_text: 'Ordinary conversational advice' }, { advice_mode: 'general' });
    assert.equal(r.body.answer, 'Ordinary conversational advice'); assert(!r.body.findings);
    await f.reset(); f.env.AUTH_SECRET = 'fictional-disposable-r1-secret';
    await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb,updated_at=$2', [JSON.stringify({ nodes, edges: [] }), REV]);
    f.providerResponse = { status: 'incomplete' }; f.onProvider = () => f.pg.exec('DELETE FROM board_editors');
    r = await f.invoke({ advice_mode: 'analyze_social_ctas', question: QUESTION, canvas_revision: REV, canvas_context: { nodes, edges: [] } });
    assert.equal(r.statusCode, 409); assert.equal(r.body.code, 'advice_context_changed'); assert(!r.body.answer);
    console.log('PASS citation failure distinguished, counterevidence retained, ordinary Advice unchanged and post-inference revocation takes precedence over invalid-output feedback');
  } finally { console.warn = originalWarn; await f.pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
