const { makeHandler } = require('./_strategy-module-generation');

const keys = ['marketCategory', 'geographicFocus', 'marketScope', 'researchObjective', 'researchDate', 'customerSegments', 'primaryNeeds', 'buyingTriggers', 'adoptionBarriers', 'competitors', 'alternatives', 'differentiationOpportunities', 'trends', 'opportunities', 'risks', 'positioningImplications', 'messagingImplications', 'channelImplications', 'recommendedNextSteps', 'userProvidedFacts', 'assumptionsToValidate', 'sourceNotes'];

module.exports = makeHandler({
  moduleType: 'market_research', keys,
  system: 'Create a reviewable strategic Market Research draft from supplied evidence. You do not browse or verify current market data.',
  instructions: 'Separate confirmed user-provided facts from qualitative inferences. Map accepted personas and Brand Avatar evidence into customerSegments and primaryNeeds when supported. Map value proposition and positioning into marketScope, differentiationOpportunities, and strategic implications. Map product/category descriptions into marketCategory and marketScope, supplied competitors and alternatives into their matching fields, and messaging/channel evidence into the matching implications. Never fabricate competitors or competitor details. Keep unsupported observations in assumptionsToValidate and produce useful strategic implications only from supported evidence.'
});
