#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const preflight = require("../brand-dna-generation-preflight");

function dependency(overrides = {}) {
  return Object.freeze({
    dependencyModuleType: "founder_story",
    requirement: "recommended",
    resolutionStatus: "unavailable",
    available: false,
    started: false,
    ready: false,
    usable: false,
    ...overrides
  });
}

function evaluate(result) {
  let consumerModuleType = "";
  const dependencyEngine = {
    evaluateDirectDependencies(options) {
      consumerModuleType = options.consumerModuleType;
      return result;
    }
  };
  const state = Object.freeze({ brandCore: Object.freeze({ customTiles: Object.freeze([]) }) });
  const stateBefore = JSON.stringify(state);
  const outcome = preflight.evaluateBrandDnaGenerationPreflight({ state, dependencyEngine });
  assert.strictEqual(consumerModuleType, "brand_dna");
  assert.strictEqual(JSON.stringify(state), stateBefore);
  return outcome;
}

assert.strictEqual(evaluate({ dependencies: [dependency({ usable: true, resolutionStatus: "resolved", available: true, started: true, ready: true })] }).status, "usable");
assert.strictEqual(evaluate({ dependencies: [dependency()] }).status, "unavailable");
assert.strictEqual(evaluate({ dependencies: [dependency({ resolutionStatus: "resolved", available: true })] }).status, "incomplete");
assert.strictEqual(evaluate({ dependencies: [dependency({ resolutionStatus: "resolved", available: true, started: true })] }).status, "incomplete");
assert.strictEqual(evaluate({ dependencies: [dependency({ resolutionStatus: "ambiguous" })] }).status, "ambiguous");
assert.strictEqual(evaluate({ dependencies: [] }).status, "error");
assert.strictEqual(preflight.evaluateBrandDnaGenerationPreflight({ dependencyEngine: { evaluateDirectDependencies() { throw new Error("fixture failure"); } } }).status, "error");

const repoRoot = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
const preflightSource = fs.readFileSync(path.join(repoRoot, "brand-dna-generation-preflight.js"), "utf8");
assert(appSource.includes("initiateBrandDnaGeneration(event.currentTarget)"), "generation button must enter through the preflight");
assert(appSource.includes("cleanup();\n    discoverBrandDna();"), "Continue Anyway must close before calling the preserved generator");
assert(appSource.includes("if (state.brandDnaLoading || activeBrandDnaRecommendation) return;"), "duplicate activation guard missing");
assert(appSource.includes("createOrSelectMissingKnowledgeTile(\"founder_story\", { typedOnly: true })"), "missing Founder Story must use typed registry-backed creation");
assert(!preflightSource.includes("founderNameRole") && !preflightSource.includes("observedProblem"), "A4 must not reproduce Founder Story readiness fields");
assert(!appSource.slice(appSource.indexOf("function initiateBrandDnaGeneration"), appSource.indexOf("function renderBrandDnaCard")).includes("moduleData?.founderStory"), "A4 preflight must not inspect Founder Story fields");

const discoverStart = appSource.indexOf("async function discoverBrandDna(");
const discoverEnd = appSource.indexOf("\nfunction refineBrandDna", discoverStart);
const discoverSource = appSource.slice(discoverStart, discoverEnd);
const baselineAppSource = execFileSync("git", ["show", "HEAD:app.js"], { cwd: repoRoot, encoding: "utf8" });
const baselineDiscoverStart = baselineAppSource.indexOf("async function discoverBrandDna(");
const baselineDiscoverEnd = baselineAppSource.indexOf("\nfunction refineBrandDna", baselineDiscoverStart);
assert.strictEqual(discoverSource, baselineAppSource.slice(baselineDiscoverStart, baselineDiscoverEnd), "preserved Brand DNA generation function changed");
assert(discoverSource.includes('fetch("/api/discover-brand-dna"'), "Brand DNA endpoint changed");
assert(discoverSource.includes("brandBrainData: state.brandCore") && discoverSource.includes("refineGuidance"), "Brand DNA request shape changed");
assert(!discoverSource.includes("founder_story") && !discoverSource.includes("Founder Story"), "A4 added Founder Story-specific request data");

console.log("Brand DNA generation preflight checks passed.");
