"use strict";

function evaluateBrandDnaGenerationPreflight({ state, dependencyEngine } = {}) {
  try {
    if (typeof dependencyEngine?.evaluateDirectDependencies !== "function") {
      return Object.freeze({ status: "error", dependency: null });
    }
    const result = dependencyEngine.evaluateDirectDependencies({
      state,
      consumerModuleType: "brand_dna"
    });
    const dependency = Array.isArray(result?.dependencies)
      ? result.dependencies.find((item) => item?.dependencyModuleType === "founder_story") || null
      : null;
    if (!dependency) return Object.freeze({ status: "error", dependency: null });
    if (dependency.usable === true) return Object.freeze({ status: "usable", dependency });
    if (dependency.resolutionStatus === "ambiguous") return Object.freeze({ status: "ambiguous", dependency });
    if (dependency.resolutionStatus === "unavailable" && dependency.available === false) {
      return Object.freeze({ status: "unavailable", dependency });
    }
    if (dependency.resolutionStatus === "resolved" && dependency.available === true && dependency.ready === false) {
      return Object.freeze({ status: "incomplete", dependency });
    }
    return Object.freeze({ status: "error", dependency });
  } catch (_error) {
    return Object.freeze({ status: "error", dependency: null });
  }
}

const FOUNDER_STORY_CONTEXT_FIELD_KEYS = Object.freeze([
  "founderNameRole",
  "observedProblem",
  "motivation",
  "turningPoint",
  "background",
  "proofPoints",
  "vision"
]);

function serializeFounderStoryContext(instance) {
  if (typeof instance?.content !== "string" || !instance.content.trim()
    || typeof instance?.moduleData?.founderStoryLifecycle?.acceptedAt !== "string") return null;
  const source = instance?.moduleData?.founderStory;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const structuredFacts = FOUNDER_STORY_CONTEXT_FIELD_KEYS.reduce((facts, key) => {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    if (value) facts[key] = value;
    return facts;
  }, {});
  if (!Object.keys(structuredFacts).length) return null;
  const context = { structuredFacts };
  const narrative = typeof instance?.content === "string" ? instance.content.trim() : "";
  if (narrative) context.supplementalNarrative = narrative;
  return context;
}

function buildUsableFounderStoryContext({ state, preflight, identityApi } = {}) {
  if (preflight?.status !== "usable" || preflight?.dependency?.usable !== true) return null;
  const tiles = Array.isArray(state?.brandCore?.customTiles) ? state.brandCore.customTiles : [];
  const typedInstances = tiles.filter((tile) => (
    tile
    && typeof tile === "object"
    && !Array.isArray(tile)
    && tile.moduleType === "founder_story"
    && identityApi?.isKnowledgeModuleInstanceId?.(tile.id)
  ));
  if (typedInstances.length !== 1) return null;
  return serializeFounderStoryContext(typedInstances[0]);
}

const BrandDnaGenerationPreflight = Object.freeze({
  buildUsableFounderStoryContext,
  evaluateBrandDnaGenerationPreflight,
  serializeFounderStoryContext
});

if (typeof window !== "undefined") window.BrandDnaGenerationPreflight = BrandDnaGenerationPreflight;
if (typeof module !== "undefined" && module.exports) module.exports = BrandDnaGenerationPreflight;
