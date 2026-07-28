const { makeHandler } = require('./_strategy-module-generation');

const keys = ['businessSummary', 'problem', 'solution', 'currentStage', 'objectives', 'targetCustomers', 'marketNeed', 'competitivePosition', 'marketResearchReference', 'offer', 'revenueModel', 'pricing', 'salesChannels', 'distributionModel', 'acquisitionStrategy', 'retentionStrategy', 'partnerships', 'keyMilestones', 'coreActivities', 'resources', 'team', 'operationalRisks', 'revenueAssumptions', 'costAssumptions', 'fundingNeeds', 'budgetNotes', 'confirmedFacts', 'assumptionsToValidate', 'openQuestions'];

module.exports = makeHandler({
  moduleType: 'business_plan', keys,
  system: 'Create a reviewable Business Plan draft from supplied accepted evidence and explicit user inputs.',
  instructions: 'Use accepted Market Research when available and continue safely without it. Map supported value proposition evidence into businessSummary, problem, solution, and offer; personas and Brand Avatar evidence into targetCustomers and marketNeed; accepted Market Research into competitivePosition and market context; supplied commercial facts into revenueModel, salesChannels, distributionModel, acquisitionStrategy, partnerships, and keyMilestones; and known operational facts into coreActivities, resources, team, and operationalRisks. Distinguish confirmed facts from assumptions. Leave unsupported financial values blank. Never invent traction, revenue, pricing, costs, funding needs, budgets, milestones, or timelines.'
});
