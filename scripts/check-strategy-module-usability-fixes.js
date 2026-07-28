'use strict';
const assert = require('assert');
const fs = require('fs');
const identity = require('../knowledge-module-identity');
const engine = require('../knowledge-module-dependency-engine');
function accepted(type, ns, facts, content='') { return { id:identity.createKnowledgeModuleInstanceId(), moduleType:type, moduleData:{[ns]:{accepted:{content,structuredFacts:facts,acceptedAt:'2026-07-27',revisionId:'rev'},lifecycle:{status:'accepted'}}}}; }
function evaluate(tile,type){ return engine.evaluateKnowledgeModule({state:{brandCore:{customTiles:[tile]}},moduleType:type}); }
let market=accepted('market_research','marketResearch',{marketCategory:'SaaS',customerSegments:['Teams'],trends:['AI adoption']});
assert.strictEqual(evaluate(market,'market_research').ready,true,'three Market Research clusters should suffice');
market=accepted('market_research','marketResearch',{marketCategory:'SaaS'});
let result=evaluate(market,'market_research'); assert.strictEqual(result.ready,false); assert(result.diagnostics.includes('missing_cluster:customer_understanding')); assert(result.diagnostics.includes('missing_cluster:strategic_insight')); assert(!result.diagnostics.includes('missing_cluster:market_definition'));
let plan=accepted('business_plan','businessPlan',{offer:'Workflow service',targetCustomers:['Teams'],coreActivities:['Deliver service']});
assert.strictEqual(evaluate(plan,'business_plan').ready,true,'three Business Plan clusters should suffice without financials');
plan=accepted('business_plan','businessPlan',{},'### Budget Notes\n### Confirmed Facts\n### Assumptions to Validate\n### Open Questions'); assert.strictEqual(evaluate(plan,'business_plan').ready,false,'empty headings cannot count');
for(const placeholder of ['test','unknown','TBD','not provided','placeholder','!!!']) { plan=accepted('business_plan','businessPlan',{offer:placeholder,targetCustomers:[placeholder],objectives:[placeholder]}); assert.strictEqual(evaluate(plan,'business_plan').ready,false,placeholder); }
const narrativePlan=accepted('business_plan','businessPlan',{},'Our business offers a workflow service for small agency customers. We will acquire customers through a direct sales channel.'); assert.strictEqual(evaluate(narrativePlan,'business_plan').ready,true);
const app=fs.readFileSync('app.js','utf8');
assert(app.includes('const collectCurrentStrategyDraft'));
assert(app.includes('applyStrategyModuleDraft(tile, current)'));
assert(app.includes('current?.id === tile?.id ? tile : current'), 'candidate evaluation must replace stale state tile');
assert(!app.includes('data-strategy-apply ${data.draft ? "" : "disabled"}'));
assert(app.includes('strategyReadinessMessage(config, evaluation)'));
assert(app.includes('message?.dataset.tone === "readiness"'));
assert(app.includes('config.generationHelp'));
const generator=fs.readFileSync('api/_strategy-module-generation.js','utf8');
const marketRoute=fs.readFileSync('api/generate-market-research.js','utf8');
const planRoute=fs.readFileSync('api/generate-business-plan.js','utf8');
assert(generator.includes('EXPLICIT_USER_NARRATIVE'));
assert(generator.includes('single most appropriate structured field'));
assert(generator.includes('leave genuinely unsupported fields empty'));
assert(marketRoute.includes('customerSegments and primaryNeeds'));
assert(planRoute.includes('businessSummary, problem, solution, and offer'));
console.log('Strategy module real-browser usability regression checks passed.');
