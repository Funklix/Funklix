"use strict";

let commonJsRegistry = null;
if (typeof require === "function") {
  try {
    commonJsRegistry = require("./knowledge-module-registry");
  } catch (_error) {
    commonJsRegistry = null;
  }
}

const KNOWN_CUSTOM_TILE_MODULE_IDS = Object.freeze([
  "founder_story",
  "market_research",
  "business_plan",
  "pitch_deck",
  "whitepaper"
]);

function getRegistryApi(registryApi) {
  if (registryApi) return registryApi;
  if (typeof window !== "undefined" && window.KnowledgeModuleRegistry) return window.KnowledgeModuleRegistry;
  return commonJsRegistry;
}

function clonePlainValue(value) {
  if (value == null || typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return Array.isArray(value) ? value.slice() : { ...value };
  }
}

function cloneCapabilities(definition) {
  return Object.freeze({
    default: Object.freeze([...(definition?.defaultCapabilities || [])]),
    future: Object.freeze([...(definition?.futureCapabilities || [])])
  });
}

function cloneModuleDefinition(definition) {
  if (!definition) return null;
  return Object.freeze({
    ...definition,
    defaultCapabilities: Object.freeze([...(definition.defaultCapabilities || [])]),
    futureCapabilities: Object.freeze([...(definition.futureCapabilities || [])]),
    runtimeStateKeys: Object.freeze([...(definition.runtimeStateKeys || [])])
  });
}

function normalizeKnowledgeModuleTitle(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getKnownCustomTileDefinition(tileTitle = "", registryApi) {
  const registry = getRegistryApi(registryApi);
  const normalizedTitle = normalizeKnowledgeModuleTitle(tileTitle);
  if (!registry || !normalizedTitle) return null;
  return KNOWN_CUSTOM_TILE_MODULE_IDS
    .map((moduleId) => registry.getModuleDefinition?.(moduleId))
    .find((definition) => normalizeKnowledgeModuleTitle(definition?.label) === normalizedTitle) || null;
}

function resolveCustomDefinition(registryApi) {
  return getRegistryApi(registryApi)?.getModuleDefinition?.("custom") || null;
}

function adaptBuiltInBrandCoreModule(stateKey, brandCoreState = {}, options = {}) {
  const registry = getRegistryApi(options.registryApi);
  const definition = registry?.getModuleDefinitionForRuntimeStateKey?.(stateKey) || null;
  if (!definition) return null;
  const hasSourceState = brandCoreState && typeof brandCoreState === "object" && Object.prototype.hasOwnProperty.call(brandCoreState, stateKey);

  return Object.freeze({
    runtimeKey: stateKey,
    sourceType: "built-in",
    moduleType: definition.id,
    definition: cloneModuleDefinition(definition),
    title: definition.label,
    content: clonePlainValue(hasSourceState ? brandCoreState[stateKey] : undefined),
    section: definition.section,
    category: definition.category,
    capabilities: cloneCapabilities(definition),
    sourceReference: Object.freeze({ stateKey }),
    isKnownModule: true,
    isLegacy: true,
    isCustom: false,
    isPersisted: hasSourceState
  });
}

function adaptCustomTileToKnowledgeModule(tile, index, options = {}) {
  const registry = getRegistryApi(options.registryApi);
  const customDefinition = resolveCustomDefinition(registry);
  const tileObject = tile && typeof tile === "object" && !Array.isArray(tile) ? tile : {};
  const knownDefinition = getKnownCustomTileDefinition(tileObject.title, registry);
  const definition = knownDefinition || customDefinition;
  const runtimeKey = `custom:${index}`;

  return Object.freeze({
    runtimeKey,
    sourceType: "custom-tile",
    moduleType: knownDefinition?.id || "custom",
    definition: cloneModuleDefinition(definition),
    title: typeof tileObject.title === "string" && tileObject.title ? tileObject.title : definition?.label || "Custom Tile",
    content: typeof tileObject.content === "string" ? tileObject.content : "",
    section: knownDefinition?.section || customDefinition?.section || "custom",
    category: knownDefinition?.category || customDefinition?.category || "custom",
    capabilities: cloneCapabilities(definition),
    sourceReference: Object.freeze({ runtimeKey, customTileIndex: index }),
    isKnownModule: Boolean(knownDefinition),
    isLegacy: true,
    isCustom: true,
    isPersisted: Boolean(tile && typeof tile === "object")
  });
}

function getBuiltInBrandCoreStateKeys(registryApi) {
  const registry = getRegistryApi(registryApi);
  if (!registry?.KNOWLEDGE_MODULE_REGISTRY) return [];
  return Object.values(registry.KNOWLEDGE_MODULE_REGISTRY)
    .flatMap((definition) => Array.isArray(definition.runtimeStateKeys) ? definition.runtimeStateKeys : []);
}

function getKnowledgeModuleRuntimeViews(brandCoreState = {}, options = {}) {
  const registry = getRegistryApi(options.registryApi);
  const builtInViews = getBuiltInBrandCoreStateKeys(registry)
    .map((stateKey) => adaptBuiltInBrandCoreModule(stateKey, brandCoreState, { registryApi: registry }))
    .filter(Boolean);
  const customTiles = Array.isArray(brandCoreState?.customTiles) ? brandCoreState.customTiles : [];
  const customViews = customTiles
    .map((tile, index) => adaptCustomTileToKnowledgeModule(tile, index, { registryApi: registry }));
  return Object.freeze([...builtInViews, ...customViews]);
}

function getKnowledgeModuleRuntimeViewByKey(runtimeKey, brandCoreState = {}, options = {}) {
  return getKnowledgeModuleRuntimeViews(brandCoreState, options)
    .find((view) => view.runtimeKey === runtimeKey) || null;
}

function getKnowledgeModuleRuntimeViewsForSection(section, brandCoreState = {}, options = {}) {
  const normalizedSection = String(section || "").trim().toLowerCase();
  if (!normalizedSection) return Object.freeze([]);
  return Object.freeze(getKnowledgeModuleRuntimeViews(brandCoreState, options)
    .filter((view) => view.section === normalizedSection));
}

const KnowledgeModuleRuntimeAdapter = Object.freeze({
  adaptBuiltInBrandCoreModule,
  adaptCustomTileToKnowledgeModule,
  getKnowledgeModuleRuntimeViewByKey,
  getKnowledgeModuleRuntimeViews,
  getKnowledgeModuleRuntimeViewsForSection
});

if (typeof window !== "undefined") {
  window.KnowledgeModuleRuntimeAdapter = KnowledgeModuleRuntimeAdapter;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = KnowledgeModuleRuntimeAdapter;
}
