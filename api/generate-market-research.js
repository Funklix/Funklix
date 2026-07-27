const { makeHandler } = require('./_strategy-module-generation');

const keys = ['marketCategory', 'geographicFocus', 'marketScope', 'researchObjective', 'researchDate', 'customerSegments', 'primaryNeeds', 'buyingTriggers', 'adoptionBarriers', 'competitors', 'alternatives', 'differentiationOpportunities', 'trends', 'opportunities', 'risks', 'positioningImplications', 'messagingImplications', 'channelImplications', 'recommendedNextSteps', 'userProvidedFacts', 'assumptionsToValidate', 'sourceNotes'];

module.exports = makeHandler({
  moduleType: 'market_research', keys,
  system: 'Create a reviewable strategic Market Research draft from supplied evidence. You do not browse or verify current market data.',
  instructions: 'Separate confirmed user-provided facts from qualitative inferences. Never fabricate competitors or competitor details. Keep unsupported observations in assumptionsToValidate and produce useful strategic implications only from supported evidence.'
});
