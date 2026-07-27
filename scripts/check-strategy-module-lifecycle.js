'use strict';
const assert = require('assert');
const registry = require('../knowledge-module-registry');
const identity = require('../knowledge-module-identity');
const engine = require('../knowledge-module-dependency-engine');
function tile(moduleType, namespace, facts, status = 'accepted') { return { id: identity.createKnowledgeModuleInstanceId(), moduleType, title: registry.getModuleDefinition(moduleType).label, content: 'legacy must not count', moduleData: { [namespace]: { accepted: status === 'accepted' ? { content: 'Accepted narrative', structuredFacts: facts, acceptedAt: '2026-07-27T00:00:00Z', revisionId: 'rev_1', provenanceRefs: ['manual'] } : null, draft: status === 'draft' ? { content: 'draft', structuredFacts: facts, origin: 'manual' } : null, lifecycle: { status } } } }; }
const marketFacts = { marketCategory:'SaaS', customerSegments:['Teams'], primaryNeeds:['Clarity'], competitors:['Alternative'], opportunities:['Opportunity'], positioningImplications:['Focus'] };
const planFacts = { businessSummary:'Summary', problem:'Problem', solution:'Solution', targetCustomers:['Teams'], offer:'Offer', acquisitionStrategy:['Direct'], objectives:['Launch'] };
for (const [type, ns, facts] of [['market_research','marketResearch',marketFacts],['business_plan','businessPlan',planFacts]]) {
  assert.strictEqual(registry.getModuleDefinition(type).allowMultiple, false);
  const draft = tile(type, ns, facts, 'draft');
  assert.strictEqual(engine.evaluateKnowledgeModule({ state:{brandCore:{customTiles:[draft]}}, moduleType:type }).ready, false);
  const accepted = tile(type, ns, facts);
  assert.strictEqual(engine.evaluateKnowledgeModule({ state:{brandCore:{customTiles:[accepted]}}, moduleType:type }).ready, true);
  accepted.moduleData[ns].accepted.structuredFacts = {};
  assert.strictEqual(engine.evaluateKnowledgeModule({ state:{brandCore:{customTiles:[accepted]}}, moduleType:type }).ready, false);
}
const deps = engine.evaluateDirectDependencies({ state:{brandCore:{customTiles:[]}}, consumerModuleType:'business_plan' });
assert.strictEqual(deps.dependencies[0].dependencyModuleType, 'market_research');
assert.strictEqual(deps.dependencies[0].requirement, 'recommended');
console.log('Strategy Knowledge Module lifecycle checks passed.');
