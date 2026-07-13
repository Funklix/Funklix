"use strict";

const KNOWLEDGE_MODULE_SECTIONS = Object.freeze({
  FOUNDATION: "foundation",
  STRATEGY: "strategy",
  INTELLIGENCE: "intelligence",
  DEPLOYMENT: "deployment",
  CUSTOM: "custom"
});

const KNOWLEDGE_MODULE_CATEGORIES = Object.freeze({
  CORE: "core",
  STRATEGY: "strategy",
  VOICE: "voice",
  AUDIENCE: "audience",
  ASSET: "asset",
  INTELLIGENCE: "intelligence",
  KNOWLEDGE: "knowledge",
  CUSTOM: "custom"
});

const BASE_TEXT_CAPABILITIES = Object.freeze(["editableText"]);
const BASE_STRUCTURED_CAPABILITIES = Object.freeze(["editableText", "structuredFields"]);
const FUTURE_AI_REVIEW_CAPABILITIES = Object.freeze(["aiActions", "reviewWorkflow", "readiness", "history", "graphProjection", "searchIndexing"]);
const FUTURE_UPLOAD_CAPABILITIES = Object.freeze(["attachments", "citations", "sourceMetadata", "reviewWorkflow", "history", "graphProjection", "searchIndexing"]);

const KNOWLEDGE_MODULE_REGISTRY = Object.freeze({
  brand_core: Object.freeze({
    id: "brand_core",
    label: "Brand Core",
    runtimeStateKeys: Object.freeze(["brandCore"]),
    section: KNOWLEDGE_MODULE_SECTIONS.FOUNDATION,
    description: "The central Brand overview and strategic truth that other Brand Workspace modules support.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "brand-core",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.CORE
  }),
  mission: Object.freeze({
    id: "mission",
    label: "Mission",
    section: KNOWLEDGE_MODULE_SECTIONS.FOUNDATION,
    description: "The enduring purpose the Brand serves for customers and the market.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "flag",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.CORE
  }),
  vision: Object.freeze({
    id: "vision",
    label: "Vision",
    section: KNOWLEDGE_MODULE_SECTIONS.FOUNDATION,
    description: "The future state the Brand is working toward.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "telescope",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.CORE
  }),
  values: Object.freeze({
    id: "values",
    label: "Values",
    section: KNOWLEDGE_MODULE_SECTIONS.FOUNDATION,
    description: "The principles and beliefs that shape Brand behavior and communication.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "spark",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.CORE
  }),
  value_proposition: Object.freeze({
    id: "value_proposition",
    label: "Value Proposition",
    runtimeStateKeys: Object.freeze(["valueProposition"]),
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "The concise value promise that differentiates the Brand in the market.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "diamond",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.STRATEGY
  }),
  messaging_pillars: Object.freeze({
    id: "messaging_pillars",
    label: "Messaging Pillars",
    runtimeStateKeys: Object.freeze(["messagingPillars"]),
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "Reusable strategic messages that guide campaign and content creation.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection", "searchIndexing"]),
    iconName: "columns",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.STRATEGY
  }),
  tone_of_voice: Object.freeze({
    id: "tone_of_voice",
    label: "Tone of Voice",
    runtimeStateKeys: Object.freeze(["toneOfVoice"]),
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "The tonal traits that shape how the Brand sounds across channels.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "voice",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.VOICE
  }),
  personas: Object.freeze({
    id: "personas",
    label: "Personas",
    runtimeStateKeys: Object.freeze(["personas"]),
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "Audience personas and notes that help campaigns speak to real customer contexts.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection", "searchIndexing"]),
    iconName: "users",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.AUDIENCE
  }),
  audience: Object.freeze({
    id: "audience",
    label: "Audience",
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "The broader audience segments the Brand serves.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection", "searchIndexing"]),
    iconName: "audience",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.AUDIENCE
  }),
  icp: Object.freeze({
    id: "icp",
    label: "ICP",
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "The ideal customer profile for positioning, targeting, and campaign prioritization.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection", "searchIndexing"]),
    iconName: "target",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.AUDIENCE
  }),
  brand_assets: Object.freeze({
    id: "brand_assets",
    label: "Brand Assets",
    runtimeStateKeys: Object.freeze(["brandAssets"]),
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Reusable deployment assets such as domain, logo, colors, typography, and references.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["attachments", "reviewWorkflow", "graphProjection", "searchIndexing"]),
    iconName: "assets",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.ASSET
  }),
  keywords: Object.freeze({
    id: "keywords",
    label: "Keywords",
    runtimeStateKeys: Object.freeze(["keywords"]),
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Reusable words and phrases campaigns should understand or emphasize.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "graphProjection", "searchIndexing"]),
    iconName: "tag",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.STRATEGY
  }),
  content_guidelines: Object.freeze({
    id: "content_guidelines",
    label: "Content Guidelines",
    runtimeStateKeys: Object.freeze(["contentGuidelines"]),
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Reusable rules for creating Brand-aligned content.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "guidelines",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.VOICE
  }),
  dos_and_donts: Object.freeze({
    id: "dos_and_donts",
    label: "Do's & Don'ts",
    editorLabel: "Do / Don't",
    runtimeStateKeys: Object.freeze(["dosAndDonts"]),
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Explicit Brand behavior rules for what to do and what to avoid.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "checklist",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.VOICE
  }),
  voice_examples: Object.freeze({
    id: "voice_examples",
    label: "Brand Voice Examples",
    runtimeStateKeys: Object.freeze(["brandVoiceExamples"]),
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Examples of good and avoided Brand voice execution.",
    defaultCapabilities: BASE_STRUCTURED_CAPABILITIES,
    futureCapabilities: Object.freeze(["readiness", "reviewWorkflow", "graphProjection"]),
    iconName: "quote",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.VOICE
  }),
  brand_dna: Object.freeze({
    id: "brand_dna",
    label: "Brand DNA",
    runtimeStateKeys: Object.freeze(["brandDNA"]),
    section: KNOWLEDGE_MODULE_SECTIONS.INTELLIGENCE,
    description: "Accepted Brand DNA signals and interpretation used to guide AI and campaign thinking.",
    defaultCapabilities: Object.freeze(["reviewWorkflow", "readiness"]),
    futureCapabilities: Object.freeze(["aiActions", "history", "graphProjection", "searchIndexing"]),
    iconName: "dna",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.INTELLIGENCE
  }),
  brand_avatar: Object.freeze({
    id: "brand_avatar",
    label: "Brand Avatar",
    section: KNOWLEDGE_MODULE_SECTIONS.INTELLIGENCE,
    description: "The generated or accepted visual Brand avatar used as a Brand identity signal.",
    defaultCapabilities: Object.freeze(["reviewWorkflow"]),
    futureCapabilities: Object.freeze(["aiActions", "attachments", "history", "graphProjection"]),
    iconName: "avatar",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.INTELLIGENCE
  }),
  website_analysis: Object.freeze({
    id: "website_analysis",
    label: "Website Analysis",
    section: KNOWLEDGE_MODULE_SECTIONS.INTELLIGENCE,
    description: "Website-derived Brand suggestions and references from the existing analysis flow.",
    defaultCapabilities: Object.freeze(["structuredFields"]),
    futureCapabilities: Object.freeze(["aiActions", "sourceMetadata", "reviewWorkflow", "history", "graphProjection"]),
    iconName: "globe",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.INTELLIGENCE
  }),
  founder_story: Object.freeze({
    id: "founder_story",
    label: "Founder Story",
    section: KNOWLEDGE_MODULE_SECTIONS.INTELLIGENCE,
    description: "Origin story, founder motivation, credibility, and narrative material for campaigns.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: FUTURE_AI_REVIEW_CAPABILITIES,
    iconName: "story",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  market_research: Object.freeze({
    id: "market_research",
    label: "Market Research",
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "Market context, trends, customer pain, competitors, category insights, and positioning evidence.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze([...FUTURE_AI_REVIEW_CAPABILITIES, "citations", "sourceMetadata"]),
    iconName: "research",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  business_plan: Object.freeze({
    id: "business_plan",
    label: "Business Plan",
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "Business model, target markets, channels, economics, goals, risks, and strategic assumptions.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: FUTURE_AI_REVIEW_CAPABILITIES,
    iconName: "plan",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  pitch_deck: Object.freeze({
    id: "pitch_deck",
    label: "Pitch Deck",
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Fundraising or sales narrative, proof points, positioning claims, and deck source material.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze([...FUTURE_UPLOAD_CAPABILITIES, "aiActions"]),
    iconName: "deck",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  whitepaper: Object.freeze({
    id: "whitepaper",
    label: "Whitepaper",
    section: KNOWLEDGE_MODULE_SECTIONS.DEPLOYMENT,
    description: "Long-form authority content, technical details, proof, claims, and source material.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze([...FUTURE_UPLOAD_CAPABILITIES, "aiActions"]),
    iconName: "document",
    allowMultiple: false,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  competitor_research: Object.freeze({
    id: "competitor_research",
    label: "Competitor Research",
    section: KNOWLEDGE_MODULE_SECTIONS.STRATEGY,
    description: "Competitive landscape, alternatives, differentiators, and comparison evidence.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze([...FUTURE_AI_REVIEW_CAPABILITIES, "citations", "sourceMetadata"]),
    iconName: "competitors",
    allowMultiple: true,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  product_knowledge: Object.freeze({
    id: "product_knowledge",
    label: "Product Knowledge",
    section: KNOWLEDGE_MODULE_SECTIONS.INTELLIGENCE,
    description: "Product capabilities, features, proof, limitations, use cases, and campaign-ready product context.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze([...FUTURE_AI_REVIEW_CAPABILITIES, "citations", "sourceMetadata"]),
    iconName: "product",
    allowMultiple: true,
    category: KNOWLEDGE_MODULE_CATEGORIES.KNOWLEDGE
  }),
  custom: Object.freeze({
    id: "custom",
    label: "Custom",
    section: KNOWLEDGE_MODULE_SECTIONS.CUSTOM,
    description: "User-created custom Brand knowledge that does not yet map to a specialized module type.",
    defaultCapabilities: BASE_TEXT_CAPABILITIES,
    futureCapabilities: Object.freeze(["searchIndexing", "reviewWorkflow", "graphProjection"]),
    iconName: "custom",
    allowMultiple: true,
    category: KNOWLEDGE_MODULE_CATEGORIES.CUSTOM
  })
});

function normalizeModuleId(moduleId = "") {
  return String(moduleId || "").trim().replace(/\s+/g, "_").replace(/-/g, "_").toLowerCase();
}

function getModuleDefinition(moduleId) {
  const normalized = normalizeModuleId(moduleId);
  return KNOWLEDGE_MODULE_REGISTRY[normalized] || null;
}

function getModulesForSection(section) {
  const normalizedSection = String(section || "").trim().toLowerCase();
  return Object.values(KNOWLEDGE_MODULE_REGISTRY).filter((definition) => definition.section === normalizedSection);
}

function isKnownModule(moduleId) {
  return Boolean(getModuleDefinition(moduleId));
}

function getModuleCategory(moduleId) {
  return getModuleDefinition(moduleId)?.category || null;
}

function getModuleDefinitionForRuntimeStateKey(stateKey) {
  const normalizedStateKey = String(stateKey || "").trim();
  if (!normalizedStateKey) return null;
  return Object.values(KNOWLEDGE_MODULE_REGISTRY).find((definition) => (
    Array.isArray(definition.runtimeStateKeys) && definition.runtimeStateKeys.includes(normalizedStateKey)
  )) || null;
}

const KnowledgeModuleRegistry = Object.freeze({
  KNOWLEDGE_MODULE_CATEGORIES,
  KNOWLEDGE_MODULE_REGISTRY,
  KNOWLEDGE_MODULE_SECTIONS,
  getModuleCategory,
  getModuleDefinition,
  getModuleDefinitionForRuntimeStateKey,
  getModulesForSection,
  isKnownModule
});

if (typeof window !== "undefined") {
  window.KnowledgeModuleRegistry = KnowledgeModuleRegistry;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = KnowledgeModuleRegistry;
}
