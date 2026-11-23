'use strict';

const assert = require('node:assert/strict');
const contract = require('../brand-enrichment-contract');
const { enrich } = require('../api/_brand-enrichment');
const { name, description, good } = require('./fixtures/bw47-1-brand-quality.json');

const quote = 'Kälte- und Klimaanlagen';
const toneOfVoice = ['Sachlich', 'Nahbar'];
const improvedTone = ['Fachlich präzise', 'Nahbar bei technischen Rückfragen'];
const accepted = {
  value: toneOfVoice, decision: 'accepted', originId: 'previous', classification: 'ai_interpretation',
  evidence: [{ excerpt: quote, url: 'https://frostwerk.example/?private=1' }]
};
const brand = {
  id: 'fictional', name, revision: 7, brand_core: {
    brandCore: description, toneOfVoice, customTiles: [],
    [contract.KEY]: { version: contract.VERSION, fields: { toneOfVoice: accepted }, inputs: { previous: { description: 'PRIVATE FULL BRIEF' } } }
  }
};
const item = (value, { sourceId = 'reviewed:toneOfVoice:0', excerpt = quote, classification = 'ai_interpretation' } = {}) =>
  ({ value, classification, evidence: [{ sourceId, excerpt }] });
const model = fields => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ fields }) } }] })
});
const targeted = { action: 'suggest', field: 'toneOfVoice' };

let calls = 0;
async function run(input, fields, current = brand, inspect = () => {}) {
  return enrich(current, { language: 'de', ...input }, {
    researchDomain: () => assert.fail('targeted and section requests use saved context'),
    fetch: async (_url, init) => {
      calls++;
      inspect(JSON.parse(init.body));
      return model(fields);
    }
  });
}

(async () => {
  const empty = { ...brand, brand_core: {} };
  const noSources = await run({ action: 'draft' }, {}, empty);
  assert.equal(Object.keys(noSources.fields).length, 13);
  assert(noSources.missingFields.every(key => noSources.fields[key].outcome === 'no_value_generated'));
  assert.equal(noSources.questions.length, 13);
  assert.equal(Object.values(noSources.fields).filter(contract.isReviewItem).length, 0);
  const noEvidence = await run({ action: 'suggest', field: 'personas' }, {
    personas: item([{ name: 'Facility managers', note: 'Approve maintenance' }], { sourceId: 'unknown' })
  }, empty);
  assert.equal(noEvidence.fields.personas.outcome, 'no_usable_evidence');
  assert.equal(noEvidence.fields.personas.evidence.length, 0);
  assert.equal(noEvidence.questions.length, 1);
  assert.throws(() => contract.adopt(empty.brand_core, noEvidence, 'personas', 'accepted', noEvidence.fields.personas.value));

  const invalid = await run(targeted, { toneOfVoice: item(5) });
  assert.equal(invalid.fields.toneOfVoice.outcome, 'invalid_field');
  assert.equal(invalid.fields.toneOfVoice.value, null);
  assert.deepEqual(invalid.diagnostics.fieldIssues, [{ fieldKey: 'toneOfVoice', category: 'invalid_value' }]);
  const identical = await run(targeted, { toneOfVoice: item([' Sachlich', 'Nahbar ']) });
  assert.equal(identical.fields.toneOfVoice.outcome, 'unchanged');
  assert.equal(identical.fields.toneOfVoice.classification, 'missing', 'legacy clients keep the non-adoptable classification');
  assert.equal(identical.fields.toneOfVoice.reason, 'unchanged');
  assert.deepEqual(identical.missingFields, []);
  assert.deepEqual(identical.questions, []);
  assert.equal(contract.outcome({ classification: 'missing', reason: 'unchanged' }), 'unchanged');
  assert.deepEqual(contract.plan(brand.brand_core, identical, { revision: 7 }).accepted, []);
  for (const decision of ['accepted', 'rejected', 'postponed']) {
    assert.throws(() => contract.adopt(brand.brand_core, identical, 'toneOfVoice', decision, improvedTone));
  }

  const noChange = { value: null, classification: 'no_improvement', evidence: [] };
  const adequate = await run({ ...targeted, intent: 'improve' }, { toneOfVoice: noChange });
  assert.equal(adequate.fields.toneOfVoice.outcome, 'no_improvement');
  assert.deepEqual(adequate.missingFields, []);
  assert.deepEqual(adequate.questions, []);
  assert.equal(contract.isReviewItem(adequate.fields.toneOfVoice), false);
  const bogusNoChange = await run(targeted, { toneOfVoice: noChange }, empty);
  assert.equal(bogusNoChange.fields.toneOfVoice.outcome, 'invalid_field');

  const asked = calls;
  const question = await run({ action: 'questions', field: 'contentGuidelines', section: 'voice_messaging', targetFields: ['contentGuidelines'] }, {}, {
    ...brand, brand_core: { ...brand.brand_core, contentGuidelines: good.contentGuidelines }
  });
  assert.equal(calls, asked);
  assert.match(question.questions[0].question, /redaktionelle Entscheidung/);
  const input = { ...targeted, intent: 'improve', answers: [{ id: 'toneOfVoice', answer: 'Technische Rückfragen verständlich beantworten.' }] };
  const proposal = await run(input, { toneOfVoice: item(improvedTone) }, brand, body => {
    const schema = body.response_format.json_schema.schema.properties.fields.properties;
    assert.deepEqual(Object.keys(schema), ['toneOfVoice']);
    assert(schema.toneOfVoice.anyOf[1].properties.classification.enum.includes('no_improvement'));
    const prompt = body.messages.at(-1).content;
    for (const phrase of ['savedValuesForImprovement', 'Sachlich', 'Nahbar', 'Technische Rückfragen', 'reason for the requested change',
      'customer communication', 'attributes of staff', 'Preserve what already works', 'previously_reviewed_evidence']) assert(prompt.includes(phrase), phrase);
    assert(!prompt.includes('PRIVATE FULL BRIEF'));
    assert(!prompt.includes('?private=1'));
  });
  assert.equal(proposal.fields.toneOfVoice.outcome, 'suggestion');
  assert.equal(proposal.fields.toneOfVoice.evidence[0].origin, 'accepted_field_evidence');
  assert.deepEqual(proposal.improvementFields, ['toneOfVoice']);
  assert.deepEqual(brand.brand_core.toneOfVoice, toneOfVoice);
  assert.deepEqual(contract.plan(brand.brand_core, proposal, { revision: 7 }).accepted, ['toneOfVoice']);
  assert.deepEqual(contract.plan(brand.brand_core, proposal, { revision: 8 }).accepted, []);
  assert.deepEqual(contract.plan(brand.brand_core, proposal, { revision: 7, authorized: false }).accepted, []);
  assert.deepEqual(contract.plan(brand.brand_core, proposal, { revision: 7, dirty: true }).accepted, []);
  assert.deepEqual(contract.plan(brand.brand_core, proposal, { revision: 7, edits: { toneOfVoice } }).accepted, []);
  assert.throws(() => contract.adopt(brand.brand_core, proposal, 'toneOfVoice', 'accepted', toneOfVoice));
  const rejected = contract.adopt(brand.brand_core, proposal, 'toneOfVoice', 'rejected', improvedTone);
  const latest = rejected[contract.KEY].fields.toneOfVoice;
  assert.equal(latest.decision, 'rejected');
  assert.deepEqual(contract.acceptedRecord(latest), accepted);
  assert.deepEqual(rejected.toneOfVoice, toneOfVoice);
  assert.equal(rejected[contract.KEY].inputs.previous, undefined, 'retaining accepted citations does not retain the old brief');
  assert.equal(contract.publicCore(rejected)[contract.KEY], undefined);
  const afterRejection = await run(targeted, { toneOfVoice: item(improvedTone) }, { ...brand, brand_core: rejected });
  assert.equal(afterRejection.fields.toneOfVoice.evidence[0].origin, 'accepted_field_evidence');
  const adopted = contract.adopt(rejected, afterRejection, 'toneOfVoice', 'accepted', improvedTone);
  assert.equal(adopted[contract.KEY].fields.toneOfVoice.previousAcceptance, undefined);
  assert.equal(adopted[contract.KEY].inputs.previous, undefined);
  const domainOnly = { ...brand, brand_core: { ...brand.brand_core, brandAssets: { domain: 'https://frostwerk.example' } } };
  const assetQuestion = await run({ action: 'questions', field: 'brandAssets' }, {}, domainOnly);
  assert.match(assetQuestion.questions[0].question, /Farben, Schriften/);
  const assets = await run({ action: 'suggest', field: 'brandAssets' }, {}, domainOnly);
  assert.deepEqual(assets.improvementFields, []);
  assert.deepEqual(contract.improvementValue('brandAssets', { domain: 'https://frostwerk.example', colors: ['#2a507a'] }), { colors: ['#2a507a'] });

  const ungrounded = await run(targeted, { toneOfVoice: item(improvedTone, { excerpt: 'fabricated quote' }) });
  assert.equal(ungrounded.fields.toneOfVoice.outcome, 'no_usable_evidence');
  assert.deepEqual(ungrounded.fields.toneOfVoice.value, improvedTone);
  assert.deepEqual(ungrounded.questions, []);

  const positioned = {
    ...brand, brand_core: {
      ...brand.brand_core,
      valueProposition: 'Wartung für Gewerbebetriebe.',
      personas: [{ name: 'Gewerbebetriebe', note: 'Planen die Wartung ihrer Kühlanlagen.' }]
    }
  };
  for (const [section, field, improved, expectedInstruction] of [
    ['brand_foundation', 'valueProposition', 'Planbare Wartung hilft Gewerbebetrieben, die Kühlung im laufenden Betrieb zu organisieren.', 'supported offer'],
    ['audience_offers', 'personas', [{ name: 'Gewerbebetriebe', note: 'Stimmen Wartungstermine für ihre Kühlanlagen ab.' }], 'direct evidence']
  ]) {
    const draft = await run({
      action: 'suggest', section, field, targetFields: [field], intent: 'improve',
      answers: [{ id: field, answer: 'Gewerbebetriebe stimmen Wartungstermine für ihre Kühlanlagen ab.' }]
    }, { [field]: item(improved, { sourceId: 'user', excerpt: 'Gewerbebetriebe stimmen Wartungstermine' }) }, positioned, body => {
      assert(body.messages.at(-1).content.includes(expectedInstruction));
      assert(body.messages.at(-1).content.includes('savedValuesForImprovement'));
    });
    assert.equal(draft.fields[field].outcome, 'suggestion');
    assert.deepEqual(draft.fields[field].originalValue, positioned.brand_core[field]);
    assert.deepEqual(contract.plan(positioned.brand_core, draft, { revision: 7 }).accepted, [field]);
  }

  const withMessaging = {
    ...brand, brand_core: { ...brand.brand_core, messagingPillars: good.messagingPillars, contentGuidelines: good.contentGuidelines }
  };
  const scope = { action: 'draft', section: 'voice_messaging', targetFields: ['contentGuidelines', 'messagingPillars', 'toneOfVoice'], intent: 'improve', language: 'en' };
  const section = await run(scope, {
    contentGuidelines: item(['We are your reliable partner.', 'Erkläre die Technik und die Vorteile für unsere Kunden.']),
    messagingPillars: item(['Maintenance saves customers 80 percent.']),
    toneOfVoice: item(['Technically precise and approachable when explaining service options.'], { classification: 'conflicting' })
  }, withMessaging, body => {
    const prompt = body.messages.at(-1).content;
    assert(prompt.includes('English'));
    assert(prompt.includes('Keep evidence excerpts verbatim in the original source language'));
    assert(prompt.includes('actionable editorial instructions'));
    assert(prompt.includes('memorable takeaways'));
  });
  assert.deepEqual(section.improvementFields, scope.targetFields);
  assert.equal(section.fields.contentGuidelines.outcome, 'quality_withheld');
  assert.deepEqual(section.fields.contentGuidelines.qualityIssues, ['language_mismatch', 'field_purpose_review']);
  assert.deepEqual(section.fields.messagingPillars.qualityIssues, ['claim_grounding_review']);
  assert.equal(section.fields.toneOfVoice.outcome, 'conflicting');
  assert.equal(Object.values(section.fields).filter(contract.isReviewItem).length, 3);
  assert.deepEqual(contract.plan(withMessaging.brand_core, section, { revision: 7 }).accepted, []);
  assert.deepEqual(withMessaging.brand_core.contentGuidelines, good.contentGuidelines);
  await assert.rejects(() => run({ ...scope, domainUrl: 'https://frostwerk.example/' }, {}), { code: 'INVALID_INPUT' });
  await assert.rejects(() => run({ ...targeted, intent: 'replace' }, {}), { code: 'INVALID_INPUT' });
  console.log('BW-47.1 R1 API PASS: empty/saved/unchanged/no-improvement outcomes, improvement context and questions, retained acceptance, invalid/unsupported/withheld/conflicting results, protected eligibility and EN/DE scope. Mocked inference.');
})().catch(error => { console.error(error); process.exitCode = 1; });
