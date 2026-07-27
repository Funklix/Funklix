#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const registry = require("../knowledge-module-registry");
const engine = require("../knowledge-module-dependency-engine");

let idCounter = 0;
function tile(moduleType, overrides = {}) {
  idCounter += 1;
  return {
    id: `km_fixture_${String(idCounter).padStart(8, "0")}`,
    title: "Editable title",
    content: "",
    items: [],
    moduleType,
    moduleData: { founderStory: {} },
    ...overrides
  };
}

function stateWith(...customTiles) {
  return { currentBoardName: "", brandCore: { brandDNA: null, customTiles } };
}

function source(overrides = {}) {
  return { founderNameRole: "", observedProblem: "", motivation: "", turningPoint: "", background: "", proofPoints: "", vision: "", ...overrides };
}

function founderState(fields = {}, overrides = {}) {
  return stateWith(tile("founder_story", {
    content: overrides.content || "",
    moduleData: { founderStory: source(fields) },
    ...overrides
  }));
}

const founderDefinition = registry.getModuleDefinition("founder_story");
const brandDnaDefinition = registry.getModuleDefinition("brand_dna");
assert.strictEqual(founderDefinition.id, "founder_story");
assert.strictEqual(brandDnaDefinition.id, "brand_dna");
assert.deepStrictEqual(brandDnaDefinition.knowledgeGraph.dependencies, [
  { moduleType: "founder_story", requirement: "recommended" }
]);
assert.strictEqual(registry.getModuleDefinition("Brand-DNA"), brandDnaDefinition);

const unavailable = engine.resolveModuleInstances({ state: stateWith(), moduleType: "founder_story" });
assert.deepStrictEqual({ status: unavailable.status, count: unavailable.matchCount }, { status: "unavailable", count: 0 });
assert(unavailable.diagnostics.includes("instance_unavailable"));

const legacy = { id: "km_legacy_00000001", title: "Founder Story", content: "legacy", items: [] };
assert.strictEqual(engine.resolveModuleInstances({ state: stateWith(legacy), moduleType: "founder_story" }).status, "unavailable");

const renamed = tile("founder_story", { title: "Anything at all" });
const resolved = engine.resolveModuleInstances({ state: stateWith(renamed), moduleType: "founder_story" });
assert.strictEqual(resolved.status, "resolved");
assert.strictEqual(resolved.instances[0].id, renamed.id);
assert.strictEqual(resolved.instances[0].runtimeKey, `custom-id:${renamed.id}`);
assert(!JSON.stringify(resolved).includes("Anything at all"));

const ambiguousState = stateWith(tile("founder_story"), tile("founder_story"));
const ambiguous = engine.resolveModuleInstances({ state: ambiguousState, moduleType: "founder_story" });
assert.strictEqual(ambiguous.status, "ambiguous");
assert.strictEqual(ambiguous.matchCount, 2);
assert.strictEqual(ambiguous.instances.length, 2);
assert(ambiguous.diagnostics.includes("instance_ambiguous"));

const builtIn = engine.resolveModuleInstances({ state: stateWith(), moduleType: "brand_dna" });
assert.deepStrictEqual({ status: builtIn.status, sourceType: builtIn.instances[0].sourceType }, { status: "resolved", sourceType: "built-in" });

const empty = engine.evaluateKnowledgeModule({ state: founderState(), moduleType: "founder_story" });
assert.deepStrictEqual({ available: empty.available, started: empty.started, ready: empty.ready, accepted: empty.accepted }, {
  available: true, started: false, ready: false, accepted: false
});
assert(empty.diagnostics.includes("acceptance_required"));

const whitespace = engine.evaluateKnowledgeModule({
  state: founderState({ founderNameRole: " \n ", observedProblem: "\t" }),
  moduleType: "founder_story"
});
assert.strictEqual(whitespace.started, false);

const partial = engine.evaluateKnowledgeModule({
  state: founderState({ founderNameRole: "Alex, founder" }),
  moduleType: "founder_story"
});
assert.strictEqual(partial.started, true);
assert.strictEqual(partial.ready, false);

const oneDetail = engine.evaluateKnowledgeModule({
  state: founderState({ founderNameRole: "Alex, founder", observedProblem: "A real problem" }),
  moduleType: "founder_story"
});
assert.strictEqual(oneDetail.ready, false);

const minimumState = founderState({ founderNameRole: "Alex, founder", observedProblem: "A real problem", motivation: "It mattered" });
const minimum = engine.evaluateKnowledgeModule({ state: minimumState, moduleType: "founder_story" });
assert.strictEqual(minimum.ready, false);
assert.strictEqual(minimum.accepted, false);
minimumState.brandCore.customTiles[0].content = "Accepted narrative";
minimumState.brandCore.customTiles[0].moduleData.founderStoryLifecycle = { status: "accepted", acceptedAt: "2026-07-27T00:00:00.000Z" };
assert.strictEqual(engine.evaluateKnowledgeModule({ state: minimumState, moduleType: "founder_story" }).ready, true);

const brandNameFallbackState = founderState({ observedProblem: "A real problem", vision: "A better future" });
brandNameFallbackState.currentBoardName = "Fixture Brand";
assert.strictEqual(engine.evaluateKnowledgeModule({ state: brandNameFallbackState, moduleType: "founder_story" }).ready, false);

const narrativeOnly = engine.evaluateKnowledgeModule({
  state: founderState({}, { content: "A generated and explicitly selected narrative." }),
  moduleType: "founder_story"
});
assert.strictEqual(narrativeOnly.started, false);
assert.strictEqual(narrativeOnly.ready, false);
assert.strictEqual(narrativeOnly.accepted, false);

function dependency(state) {
  const result = engine.evaluateDirectDependencies({ state, consumerModuleType: "brand_dna" });
  assert.strictEqual(result.dependencies.length, 1);
  return result.dependencies[0];
}

const missingDependency = dependency(stateWith());
assert.deepStrictEqual({ requirement: missingDependency.requirement, missing: missingDependency.missing, usable: missingDependency.usable }, {
  requirement: "recommended", missing: true, usable: false
});
assert.strictEqual(Object.prototype.hasOwnProperty.call(missingDependency, "blocking"), false);

const emptyDependency = dependency(founderState());
assert.strictEqual(emptyDependency.available, true);
assert.strictEqual(emptyDependency.started, false);
assert.strictEqual(emptyDependency.usable, false);
assert(emptyDependency.diagnostics.includes("dependency_not_started"));

const partialDependency = dependency(founderState({ founderNameRole: "Alex", observedProblem: "Problem" }));
assert.strictEqual(partialDependency.started, true);
assert.strictEqual(partialDependency.ready, false);
assert(partialDependency.diagnostics.includes("dependency_not_ready"));

const usableDependency = dependency(minimumState);
assert.strictEqual(usableDependency.usable, true);
assert.strictEqual(usableDependency.missing, false);
assert.strictEqual(usableDependency.accepted, true);
assert.deepStrictEqual(usableDependency.diagnostics, ["dependency_usable"]);

const ambiguousDependency = dependency(ambiguousState);
assert.strictEqual(ambiguousDependency.usable, false);
assert(ambiguousDependency.diagnostics.includes("instance_ambiguous"));

const noGraph = engine.evaluateDirectDependencies({ state: stateWith(), consumerModuleType: "brand_core" });
assert.deepStrictEqual(noGraph.dependencies, []);
assert(noGraph.diagnostics.includes("graph_metadata_absent"));
assert(engine.evaluateDirectDependencies({ state: stateWith(), consumerModuleType: "unknown" }).diagnostics.includes("definition_not_found"));
assert(engine.evaluateKnowledgeModule({ state: stateWith(), moduleType: "brand_dna" }).diagnostics.includes("readiness_evaluator_unavailable"));
assert(engine.evaluateKnowledgeModule({ state: null, moduleType: "founder_story" }).diagnostics.includes("instance_unavailable"));

const multiDefinition = Object.freeze({ ...founderDefinition, id: "multi", allowMultiple: true, runtimeStateKeys: Object.freeze([]) });
const fixtureRegistry = {
  getModuleDefinition(moduleType) { return moduleType === "multi" ? multiDefinition : registry.getModuleDefinition(moduleType); }
};
const multiState = stateWith(tile("multi"), tile("multi"));
const multi = engine.resolveModuleInstances({ state: multiState, moduleType: "multi", registryApi: fixtureRegistry });
assert.strictEqual(multi.status, "ambiguous");
assert(multi.diagnostics.includes("multiple_instances_unsupported"));

const requiredConsumer = Object.freeze({
  id: "required_consumer",
  allowMultiple: false,
  knowledgeGraph: Object.freeze({ dependencies: Object.freeze([Object.freeze({ moduleType: "founder_story", requirement: "required" })]) })
});
const requiredRegistry = {
  getModuleDefinition(moduleType) { return moduleType === "required_consumer" ? requiredConsumer : registry.getModuleDefinition(moduleType); }
};
assert.strictEqual(engine.evaluateDirectDependencies({
  state: stateWith(), consumerModuleType: "required_consumer", registryApi: requiredRegistry
}).dependencies[0].requirement, "required");

const purityState = founderState({ founderNameRole: "Alex", observedProblem: "Problem", motivation: "Motivation" }, { title: "Legacy-safe title" });
purityState.brandCore.customTiles.push(legacy);
const stateBefore = JSON.stringify(purityState);
const registryBefore = JSON.stringify(registry.KNOWLEDGE_MODULE_REGISTRY);
const first = engine.evaluateDirectDependencies({ state: purityState, consumerModuleType: "brand_dna" });
const second = engine.evaluateDirectDependencies({ state: purityState, consumerModuleType: "brand_dna" });
assert.strictEqual(JSON.stringify(purityState), stateBefore);
assert.strictEqual(JSON.stringify(registry.KNOWLEDGE_MODULE_REGISTRY), registryBefore);
assert.deepStrictEqual(first, second);
assert(Object.isFrozen(first) && Object.isFrozen(first.dependencies) && Object.isFrozen(first.dependencies[0]));
assert(!JSON.stringify(purityState).includes("dependency_usable"));
assert.strictEqual(purityState.brandCore.customTiles[1], legacy);

const repoRoot = path.resolve(__dirname, "..");
const browserFiles = ["knowledge-module-registry.js", "knowledge-module-identity.js", "knowledge-module-dependency-engine.js"];
const sandbox = { console, window: {} };
const context = vm.createContext(sandbox);
browserFiles.forEach((file) => new vm.Script(fs.readFileSync(path.join(repoRoot, file), "utf8"), { filename: file }).runInContext(context));
assert.strictEqual(typeof sandbox.window.KnowledgeModuleDependencyEngine?.evaluateDirectDependencies, "function");

console.log("Knowledge Module dependency engine checks passed.");
