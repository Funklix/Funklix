const { makeHandler } = require('./_strategy-module-generation');

const keys = ['businessSummary', 'problem', 'solution', 'currentStage', 'objectives', 'targetCustomers', 'marketNeed', 'competitivePosition', 'marketResearchReference', 'offer', 'revenueModel', 'pricing', 'salesChannels', 'distributionModel', 'acquisitionStrategy', 'retentionStrategy', 'partnerships', 'keyMilestones', 'coreActivities', 'resources', 'team', 'operationalRisks', 'revenueAssumptions', 'costAssumptions', 'fundingNeeds', 'budgetNotes', 'confirmedFacts', 'assumptionsToValidate', 'openQuestions'];

module.exports = makeHandler({
  moduleType: 'business_plan', keys,
  system: 'Create a reviewable Business Plan draft from supplied accepted evidence and explicit user inputs.',
  instructions: 'Use accepted Market Research when available and continue safely without it. Distinguish confirmed facts from assumptions. Leave unsupported financial values blank. Never invent traction, revenue, pricing, costs, funding needs, budgets, milestones, or timelines.'
});
