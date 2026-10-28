'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const social = require('../ai-brain-social-proposal');
const { fixture } = require('./fixtures/bw37-1c3a-proposal-runtime');
process.env.AUTH_SECRET = 'fictional-social-test-secret';
const app = fs.readFileSync('app.js', 'utf8'), context = {};
vm.runInNewContext(app.slice(app.indexOf('function aiBrainHasReusableContent'), app.indexOf('// A deliberately small supported format.')), context);
const originalFetch = global.fetch, originalWarn = console.warn;
let paid = 0;
global.fetch = async () => { paid++; throw new Error('Social conversion must not invoke a provider'); };
console.warn = () => {};
async function main() {
  for (const answer of require('./fixtures/bw37-1c3b-r2-appics-markdown')) {
    const assets = context.aiBrainContentAssets({ status: 'success', answer }); assert.equal(assets.length, 2);
    for (const [i, asset] of assets.entries()) {
      const expected = social.extract(asset.text); assert(expected);
      assert.equal(expected.platform, i ? 'X / Twitter' : 'Instagram');
      assert.equal(social.recommend(asset.text), social.TYPE);
      assert(expected.caption.includes('#MyAppicsStory')); assert(!expected.caption.includes('**CTA'));
      assert(!expected.hashtags.includes('AI metadata')); assert(!expected.preview.includes('Hashtags'));
      const r = fixture(); const res = await r.invoke({ ...r.request, action: 'propose_social_node', source_answer: asset.text });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      const { proposal_id, source_turn_id, ...fields } = res.body.node_proposal;
      assert.deepEqual(fields, expected); assert.equal(source_turn_id, r.request.source_turn_id); assert(proposal_id);
      assert.equal(r.capture, 3); assert.equal(res.body.action, 'propose_social_node'); assert.match(res.body.scope_revision, /^[a-f0-9]{64}$/);
    }
  }
  for (const source of ['Unknown post\nCaption: Hello', 'Instagram and X post\nCaption: Hello', 'Mastodon Post\nCaption: Hello']) {
    assert.equal(social.extract(source).platform, ''); assert.equal(social.recommend(source), 'Content');
  }
  for (const platform of social.platforms) assert.equal(social.extract(platform + ' Post\nCaption: Hello').platform, platform);
  assert.equal(social.recommend('Content concept: Instagram story\nAudience: Creative community\nMessage: Share your story\nPurpose: Encourage participation'), 'Content');
  for (const label of ['Copy', 'Post text', 'Post-Text', 'Beitragstext']) assert.equal(social.extract('Instagram Post\n'+label+': A labelled source').caption, 'A labelled source');
  const partial = social.extract('Instagram Beitrag\nBildunterschrift: Deine Geschichte zählt.');
  assert.equal(partial.caption, 'Deine Geschichte zählt.'); assert.equal(partial.preview, ''); assert.equal(partial.hashtags, '');
  assert(social.validate(partial, true));
  assert.equal(social.validate({ ...partial, platform: '' }, true), null);
  assert.equal(social.validate({ ...partial, caption: '' }, true), null);
  assert(social.validate({ ...partial, caption: '' }));
  for (const [key, value] of [['title', 'a'.repeat(121)], ['caption', 'a'.repeat(4001)], ['preview', 'a'.repeat(1001)], ['hashtags', 'a'.repeat(1001)], ['platform','Mastodon'], ['title','a\u0000']]) assert.equal(social.validate({ ...partial, [key]:value }), null);
  assert.equal(social.validate({ ...partial, status: 'Approved' }), null);
  assert.equal(social.extract('Instagram Post\nCaption: One\nCaption: Two'), null);
  assert.equal(social.extract('Instagram Post\nCaption: Hello\nHashtags: #One #Zwei (optional)\n\nAsk me for more #irrelevant recommendations.').hashtags, '#One #Zwei');
  for (const [change, status] of [
    [r => r.user = null, 401],
    [r => { r.user = { email: 'stranger@example.test' }; r.identity.canonical_email = r.user.email; }, 403],
    [r => r.board = null, 404], [r => r.membership = null, 403],
    [r => r.request.expected_scope.updated_at = '2020-01-01', 409],
    [r => r.before = n => { if (n === 2) r.board.updated_at = '2020-01-01'; }, 409],
    [r => r.before = n => { if (n === 3) r.membership = null; }, 409]
  ]) {
    const r = fixture(); change(r); const res = await r.invoke({ ...r.request, action: 'propose_social_node', source_answer: 'Instagram Post\nCaption: Hello' }); assert.equal(res.statusCode, status, JSON.stringify(res.body));
  }
  const r = fixture(); r.user = { email: 'editor@example.test' }; r.identity.canonical_email = r.user.email; r.role = 'editor'; r.brandRole = null;
  assert.equal((await r.invoke({ ...r.request, action: 'propose_social_node', source_answer: 'X Post\nTweet: Hello' })).statusCode, 200, 'Board-only editor needs no canonical Brand permission');
  assert.equal(paid, 0);
  console.log('PASS native Social source extraction, bounded partial fields, EN/DE, Appics variants, exact platform contract, signed ACL/Board-only editor and pre/post scope checks; zero provider calls');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; console.warn = originalWarn; });
