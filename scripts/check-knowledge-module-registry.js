"use strict";

const assert = require("assert");
const registryApi = require("../knowledge-module-registry");

function graphMetadata(overrides = {}) {
  const { dependencies: dependencyOverrides = [], acquisitionMethods = ["manual"], ...properties } = overrides;
  const dependencies = dependencyOverrides.map((dependency) => (
    dependency && typeof dependency === "object" ? Object.freeze({ ...dependency }) : dependency
  ));
  return Object.freeze({
    role: "source",
    layer: "knowledge_acquisition",
    ...properties,
    dependencies: Object.freeze(dependencies),
    acquisitionMethods: Object.freeze([...acquisitionMethods])
  });
}

function definition(id, knowledgeGraph) {
  const value = { id };
  if (knowledgeGraph !== undefined) value.knowledgeGraph = knowledgeGraph;
  return Object.freeze(value);
}

function fixture(definitions) {
  return Object.freeze(Object.fromEntries(definitions.map((item) => [item.id, item])));
}

function expectInvalid(definitions, pattern) {
  assert.throws(() => registryApi.validateKnowledgeModuleRegistry(fixture(definitions)), pattern);
}

assert.strictEqual(registryApi.validateKnowledgeModuleRegistry(), true);
assert.strictEqual(registryApi.validateKnowledgeModuleRegistry(fixture([definition("legacy")])), true);

const founderStory = registryApi.getModuleDefinition("founder_story");
assert.deepStrictEqual(founderStory.knowledgeGraph, graphMetadata());

const brandDna = registryApi.getModuleDefinition("brand_dna");
assert.deepStrictEqual(brandDna.knowledgeGraph, graphMetadata({
  role: "derived",
  layer: "brand_intelligence",
  dependencies: [{ moduleType: "founder_story", requirement: "recommended" }],
  acquisitionMethods: []
}));
assert.strictEqual(registryApi.getModuleDefinition("Brand-DNA"), brandDna);
assert.strictEqual(registryApi.KNOWLEDGE_MODULE_REGISTRY.brand_dna, brandDna);

const source = definition("source", graphMetadata());
const legacyTarget = definition("legacy_target");
const validConsumer = definition("consumer", graphMetadata({
  role: "derived",
  layer: "brand_intelligence",
  dependencies: [{ moduleType: "legacy_target", requirement: "required" }],
  acquisitionMethods: []
}));
assert.strictEqual(registryApi.validateKnowledgeModuleRegistry(fixture([source, legacyTarget, validConsumer])), true);

expectInvalid([definition("invalid", graphMetadata({ role: "content" }))], /role must be one of/);
expectInvalid([definition("invalid", graphMetadata({ layer: "strategy" }))], /layer must be one of/);
expectInvalid([
  source,
  definition("invalid", graphMetadata({ dependencies: [{ moduleType: "source", requirement: "optional" }] }))
], /requirement must be one of/);
expectInvalid([definition("invalid", Object.freeze({
  role: "source",
  layer: "knowledge_acquisition",
  dependencies: Object.freeze(["source"]),
  acquisitionMethods: Object.freeze(["manual"])
}))], /dependencies\[0\] must be an object/);
expectInvalid([
  source,
  definition("invalid", graphMetadata({ dependencies: [{ moduleType: "source" }] }))
], /missing required properties: requirement/);
expectInvalid([
  source,
  definition("invalid", graphMetadata({ dependencies: [{ moduleType: "source", requirement: "recommended", label: "Source" }] }))
], /unknown properties: label/);
expectInvalid([
  source,
  definition("invalid", graphMetadata({ dependencies: [{ moduleType: "Source", requirement: "recommended" }] }))
], /canonical stable moduleType string/);
expectInvalid([
  source,
  definition("invalid", graphMetadata({ dependencies: [
    { moduleType: "source", requirement: "recommended" },
    { moduleType: "source", requirement: "required" }
  ] }))
], /duplicate moduleType source/);
expectInvalid([
  definition("self", graphMetadata({ dependencies: [{ moduleType: "self", requirement: "recommended" }] }))
], /self-dependency/);
expectInvalid([definition("invalid", graphMetadata({ acquisitionMethods: ["website_import"] }))], /acquisitionMethods\[0\] must be one of/);
expectInvalid([definition("invalid", graphMetadata({ acquisitionMethods: ["manual", "manual"] }))], /duplicate method manual/);
expectInvalid([
  definition("invalid", graphMetadata({ dependencies: [{ moduleType: "missing", requirement: "recommended" }] }))
], /reference a registered stable moduleType/);
expectInvalid([definition("invalid", graphMetadata({ future: true }))], /unknown properties: future/);
expectInvalid([definition("invalid", Object.freeze({
  role: "source",
  layer: "knowledge_acquisition",
  dependencies: Object.freeze([])
}))], /missing required properties: acquisitionMethods/);
expectInvalid([definition("invalid", {
  role: "source",
  layer: "knowledge_acquisition",
  dependencies: Object.freeze([]),
  acquisitionMethods: Object.freeze(["manual"])
})], /knowledgeGraph must be frozen/);

const cycleA = definition("cycle_a", graphMetadata({ dependencies: [{ moduleType: "cycle_b", requirement: "required" }] }));
const cycleB = definition("cycle_b", graphMetadata({ dependencies: [{ moduleType: "cycle_a", requirement: "recommended" }] }));
expectInvalid([cycleA, cycleB], /cycle: cycle_a -> cycle_b -> cycle_a/);

console.log("Knowledge Module registry metadata checks passed.");
