'use strict';
const assert = require('assert'); const { normalizeBrandBrainData, buildBrandBrainContext } = require('../api/_brand-brain-context');
function moduleTile(type, ns, accepted) { return { id:'km_strategy_module_0001', moduleType:type, title:'Unsafe <script>', content:'ROOT DRAFT SECRET', moduleData:{ [ns]:{ draft:{content:'DRAFT SECRET',structuredFacts:{marketCategory:'draft'}}, accepted, lifecycle:{status:accepted?'accepted':'draft'} } } }; }
const accepted = { content:'Accepted narrative', structuredFacts:{marketCategory:'SaaS', customerSegments:['Teams'], assumptionsToValidate:['Confirm adoption'], sourceNotes:'raw source excluded'}, acceptedAt:'2026-07-27', revisionId:'rev_1', provenanceRefs:['private://url'] };
let normalized = normalizeBrandBrainData({customTiles:[moduleTile('market_research','marketResearch',accepted)]});
assert.strictEqual(normalized.acceptedStrategyModules.length,1); const text = buildBrandBrainContext('board', {customTiles:[moduleTile('market_research','marketResearch',accepted)]}).text;
assert(text.includes('Accepted Strategy Module Evidence')); assert(text.includes('assumptionsRequiringConfirmation')); assert(!text.includes('DRAFT SECRET')); assert(!text.includes('ROOT DRAFT SECRET')); assert(!text.includes('private://url')); assert(!text.includes('sourceNotes'));
normalized = normalizeBrandBrainData({customTiles:[moduleTile('business_plan','businessPlan',null)]}); assert.strictEqual(normalized.acceptedStrategyModules.length,0);
console.log('Accepted-only strategy Campaign context checks passed.');
