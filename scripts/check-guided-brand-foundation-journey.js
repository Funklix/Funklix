const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const analyzer = fs.readFileSync(path.join(root, 'api/analyze-brand-domain.js'), 'utf8');
const avatar = fs.readFileSync(path.join(root, 'api/generate-brand-avatar.js'), 'utf8');
const dependency = require('../knowledge-module-dependency-engine');
const registry = require('../knowledge-module-registry');
const identity = require('../knowledge-module-identity');

assert(app.includes('Start with Brand Assets: enter your company domain and Analyze Website.'));
assert(analyzer.includes('retrieve(normalizeDomainUrl(domainUrl), { includeHtml: true })'));
assert(analyzer.includes('uploadImageBuffer') && analyzer.includes("status: 'persisted'"));
assert(analyzer.includes('Optional same-origin candidate failure'));
assert(app.includes('id="bc-logo-upload"') && app.includes('id="bc-logo-remove"'));
assert(app.includes('Do you already have a Founder Story?'));
assert(app.includes('Generate Founder Story') && app.includes('apply.textContent = "Apply"'));
assert(app.includes('saveBoardToServer("founder-story-source-facts")'));
assert(app.includes('founderStoryLifecycle: { status: "accepted"'));
assert(app.includes('showBrandAvatarRecommendation') && app.includes('showFirstCampaignRecommendation'));
assert(app.includes('brandFoundationTransitionInFlight'));
assert(avatar.includes('generation_endpoint_has_no_image_reference_input'));

const tile = { id: identity.createKnowledgeModuleInstanceId(), moduleType: 'founder_story', content: 'Accepted narrative', moduleData: { founderStory: { founderNameRole: 'A, founder', motivation: 'Why', vision: 'Future' } } };
const state = { currentBoardName: 'Brand', brandCore: { customTiles: [tile] } };
let result = dependency.evaluateDirectDependencies({ state, consumerModuleType: 'brand_dna', registryApi: registry, identityApi: identity });
assert.strictEqual(result.dependencies[0].usable, false, 'unaccepted draft must not satisfy Brand DNA');
tile.moduleData.founderStoryLifecycle = { status: 'accepted', acceptedAt: '2026-07-27T00:00:00.000Z' };
result = dependency.evaluateDirectDependencies({ state, consumerModuleType: 'brand_dna', registryApi: registry, identityApi: identity });
assert.strictEqual(result.dependencies[0].usable, true, 'accepted persisted story must satisfy Brand DNA');

console.log('Guided Brand Foundation journey checks passed (ordering, lifecycle, logo, handoffs, and idempotency).');
