#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const files = [
  "knowledge-module-registry.js",
  "knowledge-module-identity.js",
  "knowledge-module-runtime-adapter.js",
  "knowledge-module-dependency-engine.js",
  "brand-dna-generation-preflight.js"
];
const sources = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(repoRoot, file), "utf8")]));
const failures = [];

function runScript(context, file) {
  new vm.Script(sources[file], { filename: file }).runInContext(context);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function runBrowserLike(name, extra = {}) {
  const sandbox = { console, ...extra };
  sandbox.window = sandbox.window || {};
  const context = vm.createContext(sandbox);
  try {
    files.forEach((file) => runScript(context, file));
    assert(typeof sandbox.window.KnowledgeModuleRegistry === "object", `${name}: registry global missing`);
    assert(typeof sandbox.window.KnowledgeModuleIdentity === "object", `${name}: identity global missing`);
    assert(typeof sandbox.window.KnowledgeModuleRuntimeAdapter === "object", `${name}: adapter global missing`);
    assert(typeof sandbox.window.KnowledgeModuleDependencyEngine?.evaluateDirectDependencies === "function", `${name}: dependency engine global missing`);
    assert(typeof sandbox.window.BrandDnaGenerationPreflight?.evaluateBrandDnaGenerationPreflight === "function", `${name}: Brand DNA preflight global missing`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

runBrowserLike("browser-like", { module: undefined, require: undefined });
runBrowserLike("browser-extension-like", {
  require(request) {
    throw new Error(`unsafe require attempted for ${request}`);
  }
});

try {
  const moduleCache = {};
  function loadCommonJs(file) {
    if (moduleCache[file]) return moduleCache[file].exports;
    const module = { exports: {} };
    moduleCache[file] = module;
    const dirname = repoRoot;
    const filename = path.join(repoRoot, file);
    function localRequire(request) {
      if (request === "./knowledge-module-registry") return loadCommonJs("knowledge-module-registry.js");
      if (request === "./knowledge-module-identity") return loadCommonJs("knowledge-module-identity.js");
      return require(request);
    }
    const wrapped = `(function (exports, require, module, __filename, __dirname) {\n${sources[file]}\n})`;
    const fn = new vm.Script(wrapped, { filename: file }).runInThisContext();
    fn(module.exports, localRequire, module, filename, dirname);
    return module.exports;
  }
  const registry = loadCommonJs("knowledge-module-registry.js");
  const identity = loadCommonJs("knowledge-module-identity.js");
  const adapter = loadCommonJs("knowledge-module-runtime-adapter.js");
  const engine = loadCommonJs("knowledge-module-dependency-engine.js");
  const preflight = loadCommonJs("brand-dna-generation-preflight.js");
  assert(typeof registry === "object" && typeof registry.getModuleDefinition === "function", "commonjs: registry export missing");
  assert(typeof identity === "object" && typeof identity.createKnowledgeModuleInstanceId === "function", "commonjs: identity export missing");
  assert(typeof adapter === "object" && typeof adapter.getKnowledgeModuleRuntimeViews === "function", "commonjs: adapter export missing");
  assert(typeof engine === "object" && typeof engine.evaluateDirectDependencies === "function", "commonjs: dependency engine export missing");
  assert(typeof preflight === "object" && typeof preflight.evaluateBrandDnaGenerationPreflight === "function", "commonjs: Brand DNA preflight export missing");
} catch (error) {
  failures.push(`commonjs: ${error.message}`);
}

if (failures.length) {
  console.error("Knowledge Module browser-global compatibility check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Knowledge Module browser-global compatibility check passed.");
