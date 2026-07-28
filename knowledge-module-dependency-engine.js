"use strict";

(() => {

let commonJsRegistry = null;
let commonJsIdentity = null;
const hasCommonJsModule = typeof module !== "undefined" && module && module.exports;
if (hasCommonJsModule && typeof require === "function") {
  commonJsRegistry = require("./knowledge-module-registry");
  commonJsIdentity = require("./knowledge-module-identity");
}

const FOUNDER_STORY_FIELD_KEYS = Object.freeze([
  "founderNameRole",
  "observedProblem",
  "motivation",
  "turningPoint",
  "background",
  "proofPoints",
  "vision"
]);
const FOUNDER_STORY_DETAIL_KEYS = Object.freeze(FOUNDER_STORY_FIELD_KEYS.slice(1));

function getRegistryApi(registryApi) {
  if (registryApi) return registryApi;
  if (typeof window !== "undefined" && window.KnowledgeModuleRegistry) return window.KnowledgeModuleRegistry;
  return commonJsRegistry;
}

function getIdentityApi(identityApi) {
  if (identityApi) return identityApi;
  if (typeof window !== "undefined" && window.KnowledgeModuleIdentity) return window.KnowledgeModuleIdentity;
  return commonJsIdentity;
}

function freezeResult(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeResult);
  return Object.freeze(value);
}

function getBrandCore(state) {
  return state?.brandCore && typeof state.brandCore === "object" && !Array.isArray(state.brandCore)
    ? state.brandCore
    : {};
}

function collectTypedInstances({ state, moduleType, definition, identityApi }) {
  const brandCore = getBrandCore(state);
  const records = [];
  const runtimeStateKeys = Array.isArray(definition?.runtimeStateKeys) ? definition.runtimeStateKeys : [];
  runtimeStateKeys.forEach((stateKey) => {
    if (!Object.prototype.hasOwnProperty.call(brandCore, stateKey)) return;
    records.push({
      instance: brandCore[stateKey],
      descriptor: { sourceType: "built-in", runtimeKey: stateKey, stateKey }
    });
  });

  const identity = getIdentityApi(identityApi);
  const customTiles = Array.isArray(brandCore.customTiles) ? brandCore.customTiles : [];
  customTiles.forEach((tile) => {
    if (!tile || typeof tile !== "object" || Array.isArray(tile) || tile.moduleType !== moduleType) return;
    if (!identity?.isKnowledgeModuleInstanceId?.(tile.id)) return;
    records.push({
      instance: tile,
      descriptor: { sourceType: "custom-tile", runtimeKey: `custom-id:${tile.id}`, id: tile.id }
    });
  });
  return records;
}

function resolveRecords({ state, moduleType, registryApi, identityApi }) {
  const registry = getRegistryApi(registryApi);
  const definition = typeof moduleType === "string" ? registry?.getModuleDefinition?.(moduleType) || null : null;
  if (!definition) {
    return { definition: null, records: [], status: "unavailable", diagnostic: "definition_not_found" };
  }
  const records = collectTypedInstances({ state, moduleType: definition.id, definition, identityApi });
  if (!records.length) return { definition, records, status: "unavailable", diagnostic: "instance_unavailable" };
  if (records.length === 1) return { definition, records, status: "resolved", diagnostic: "instance_resolved" };
  if (definition.allowMultiple === true) {
    return { definition, records, status: "ambiguous", diagnostic: "multiple_instances_unsupported" };
  }
  return { definition, records, status: "ambiguous", diagnostic: "instance_ambiguous" };
}

function resolveModuleInstances({ state, moduleType, registryApi, identityApi } = {}) {
  const result = resolveRecords({ state, moduleType, registryApi, identityApi });
  return freezeResult({
    moduleType: result.definition?.id || (typeof moduleType === "string" ? moduleType : ""),
    status: result.status,
    matchCount: result.records.length,
    instances: result.records.map(({ descriptor }) => ({ ...descriptor })),
    diagnostics: [result.diagnostic]
  });
}

function meaningfulText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getFounderStorySource(instance) {
  const source = instance?.moduleData?.founderStory;
  return source && typeof source === "object" && !Array.isArray(source) ? source : {};
}

function getFounderStoryBrandName(state) {
  const brandCore = getBrandCore(state);
  return [state?.currentBoardName, brandCore.brandName, brandCore.name, brandCore.brandAssets?.name]
    .map(meaningfulText)
    .find(Boolean) || "";
}

function evaluateFounderStory(instance, state) {
  const source = getFounderStorySource(instance);
  const started = FOUNDER_STORY_FIELD_KEYS.some((key) => Boolean(meaningfulText(source[key])));
  // Keep parity with app.js validateFounderStoryGenerationInput(): founder identity
  // (or the existing Brand-name fallback) plus at least two of the six details.
  const hasIdentity = Boolean(meaningfulText(source.founderNameRole) || getFounderStoryBrandName(state));
  const detailCount = FOUNDER_STORY_DETAIL_KEYS.filter((key) => Boolean(meaningfulText(source[key]))).length;
  const accepted = Boolean(meaningfulText(instance?.content) && meaningfulText(instance?.moduleData?.founderStoryLifecycle?.acceptedAt));
  const ready = hasIdentity && detailCount >= 2 && accepted;
  const diagnostics = [];
  if (!started) diagnostics.push("module_not_started");
  if (!ready) diagnostics.push("module_not_ready");
  if (!accepted) diagnostics.push("acceptance_required");
  return { started, ready, accepted, diagnostics };
}

const PLACEHOLDER_TEXT = /^(?:n\/?a|none|unknown|tbd|to be determined|not provided|placeholder|test)$/i;

function meaningfulNarrative(value) {
  if (typeof value !== "string") return "";
  const body = value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s+[^\n]+$/.test(line))
    .join(" ").replace(/\s+/g, " ").trim();
  return meaningfulKnowledgeValue(body) ? body : "";
}

function meaningfulKnowledgeValue(value) {
  if (Array.isArray(value)) return value.some(meaningfulKnowledgeValue);
  if (typeof value === "string") {
    const text = value.trim();
    return Boolean(text && !PLACEHOLDER_TEXT.test(text) && /[\p{L}\p{N}]/u.test(text) && !/^[\p{P}\p{S}\s]+$/u.test(text));
  }
  return false;
}

function meaningfulFact(facts, key) {
  const value = facts?.[key];
  const label = key.replace(/([A-Z])/g, " $1").trim().toLowerCase();
  if (typeof value === "string" && value.trim().toLowerCase() === label) return false;
  return meaningfulKnowledgeValue(value);
}

function acceptedStrategyFacts(instance, namespace) {
  const moduleState = instance?.moduleData?.[namespace];
  const accepted = moduleState?.accepted;
  const valid = accepted && typeof accepted === "object" && meaningfulText(accepted.acceptedAt)
    && meaningfulText(accepted.revisionId) && meaningfulText(moduleState?.lifecycle?.status) === "accepted";
  return valid && accepted.structuredFacts && typeof accepted.structuredFacts === "object"
    ? { accepted, facts: accepted.structuredFacts }
    : null;
}

function strategyResult(instance, namespace, evaluateClusters) {
  const data = instance?.moduleData?.[namespace];
  const started = Boolean(data?.draft && (meaningfulText(data.draft.content) || meaningfulKnowledgeValue(Object.values(data.draft.structuredFacts || {}))));
  const resolved = acceptedStrategyFacts(instance, namespace);
  const accepted = Boolean(resolved);
  const clusters = resolved ? evaluateClusters(resolved.facts, meaningfulNarrative(resolved.accepted.content)) : {};
  const missingClusters = Object.entries(clusters).filter(([, ready]) => !ready).map(([cluster]) => cluster);
  const ready = Boolean(resolved && !missingClusters.length);
  const diagnostics = [];
  if (!started && !accepted) diagnostics.push("module_not_started");
  if (!ready) diagnostics.push("module_not_ready");
  if (!accepted) diagnostics.push("acceptance_required");
  missingClusters.forEach((cluster) => diagnostics.push(`missing_cluster:${cluster}`));
  return { started, ready, accepted, diagnostics };
}

function evaluateMarketResearch(instance) {
  return strategyResult(instance, "marketResearch", (facts, narrative) => ({
    market_definition: meaningfulFact(facts, "marketCategory") || meaningfulFact(facts, "marketScope")
      || /\bmarket|category|sector|industry|space\b/i.test(narrative),
    customer_understanding: meaningfulFact(facts, "customerSegments") || meaningfulFact(facts, "primaryNeeds")
      || /\bcustomer|buyer|audience|segment|need|pain|user\b/i.test(narrative),
    strategic_insight: ["competitors", "alternatives", "trends", "opportunities", "risks", "differentiationOpportunities", "positioningImplications", "messagingImplications", "channelImplications", "recommendedNextSteps"].some((key) => meaningfulFact(facts, key))
      || /\bcompet|alternative|trend|opportun|risk|differentiat|position|messag|channel|recommend|strategy|strategic\b/i.test(narrative)
  }));
}

function evaluateBusinessPlan(instance) {
  return strategyResult(instance, "businessPlan", (facts, narrative) => ({
    business_concept: ["businessSummary", "problem", "solution", "offer"].some((key) => meaningfulFact(facts, key))
      || /\bbusiness|offer|product|service|solution|problem|value\b/i.test(narrative),
    customer_market: ["targetCustomers", "marketNeed", "competitivePosition"].some((key) => meaningfulFact(facts, key))
      || /\bcustomer|buyer|audience|market|user|client|serve|need|problem\b/i.test(narrative),
    execution_direction: ["revenueModel", "salesChannels", "distributionModel", "acquisitionStrategy", "retentionStrategy", "partnerships", "objectives", "keyMilestones", "coreActivities", "resources"].some((key) => meaningfulFact(facts, key))
      || /\brevenue|sales|distribution|acquisition|retention|partner|objective|milestone|operat|execute|resource|channel|commercial\b/i.test(narrative)
  }));
}

const READINESS_EVALUATORS = Object.freeze({
  founder_story: evaluateFounderStory,
  market_research: evaluateMarketResearch,
  business_plan: evaluateBusinessPlan
});

function evaluateModuleReadiness({ definition, instance, state } = {}) {
  const moduleType = definition?.id || "";
  const evaluator = READINESS_EVALUATORS[moduleType];
  if (!evaluator) {
    return freezeResult({
      moduleType,
      available: Boolean(instance),
      started: false,
      ready: false,
      accepted: null,
      diagnostics: ["readiness_evaluator_unavailable"]
    });
  }
  if (!instance || typeof instance !== "object") {
    return freezeResult({
      moduleType,
      available: false,
      started: false,
      ready: false,
      accepted: null,
      diagnostics: ["instance_unavailable"]
    });
  }
  return freezeResult({ moduleType, available: true, ...evaluator(instance, state) });
}

function evaluateKnowledgeModule({ state, moduleType, registryApi, identityApi } = {}) {
  const resolution = resolveRecords({ state, moduleType, registryApi, identityApi });
  const publicResolution = resolveModuleInstances({ state, moduleType, registryApi, identityApi });
  if (resolution.status !== "resolved") {
    return freezeResult({
      moduleType: publicResolution.moduleType,
      resolution: publicResolution,
      available: false,
      started: false,
      ready: false,
      accepted: null,
      diagnostics: [...publicResolution.diagnostics]
    });
  }
  if (!READINESS_EVALUATORS[resolution.definition.id]) {
    return freezeResult({
      moduleType: resolution.definition.id,
      resolution: publicResolution,
      available: true,
      started: false,
      ready: false,
      accepted: null,
      diagnostics: ["readiness_evaluator_unavailable"]
    });
  }
  const readiness = evaluateModuleReadiness({
    definition: resolution.definition,
    instance: resolution.records[0].instance,
    state
  });
  return freezeResult({ ...readiness, resolution: publicResolution });
}

function evaluateDirectDependencies({ state, consumerModuleType, registryApi, identityApi } = {}) {
  const registry = getRegistryApi(registryApi);
  const consumer = typeof consumerModuleType === "string"
    ? registry?.getModuleDefinition?.(consumerModuleType) || null
    : null;
  if (!consumer) {
    return freezeResult({
      consumerModuleType: typeof consumerModuleType === "string" ? consumerModuleType : "",
      dependencies: [],
      diagnostics: ["definition_not_found"]
    });
  }
  if (!consumer.knowledgeGraph) {
    return freezeResult({ consumerModuleType: consumer.id, dependencies: [], diagnostics: ["graph_metadata_absent"] });
  }
  const declarations = Array.isArray(consumer.knowledgeGraph.dependencies)
    ? consumer.knowledgeGraph.dependencies
    : [];
  const dependencies = declarations.map((dependency) => {
    const evaluation = evaluateKnowledgeModule({
      state,
      moduleType: dependency?.moduleType,
      registryApi: registry,
      identityApi
    });
    const usable = evaluation.resolution.status === "resolved" && evaluation.ready === true;
    const diagnostics = usable
      ? [...evaluation.diagnostics, "dependency_usable"]
      : evaluation.resolution.status === "ambiguous"
        ? [...evaluation.diagnostics]
        : !evaluation.available
          ? [...evaluation.diagnostics]
          : !evaluation.started
            ? [...evaluation.diagnostics, "dependency_not_started"]
            : [...evaluation.diagnostics, "dependency_not_ready"];
    return {
      consumerModuleType: consumer.id,
      dependencyModuleType: dependency?.moduleType || "",
      requirement: dependency?.requirement || "",
      resolutionStatus: evaluation.resolution.status,
      available: evaluation.available,
      started: evaluation.started,
      ready: evaluation.ready,
      accepted: evaluation.accepted,
      usable,
      missing: !usable,
      diagnostics: [...new Set(diagnostics)]
    };
  });
  return freezeResult({ consumerModuleType: consumer.id, dependencies, diagnostics: [] });
}

const KnowledgeModuleDependencyEngine = Object.freeze({
  evaluateDirectDependencies,
  evaluateKnowledgeModule,
  evaluateModuleReadiness,
  resolveModuleInstances
});

if (typeof window !== "undefined") {
  window.KnowledgeModuleDependencyEngine = KnowledgeModuleDependencyEngine;
}

if (hasCommonJsModule) {
  module.exports = KnowledgeModuleDependencyEngine;
}
})();
