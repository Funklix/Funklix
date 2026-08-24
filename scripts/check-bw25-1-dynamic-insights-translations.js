#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const languageSource = read("language.js");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const analyzer = between(app, "function analyzeCampaign", "function suggestNextNodes");
const catalog = between(app, "const INSIGHTS_DIAGNOSTIC_MESSAGES", "function renderInsightsSurface");
const renderer = between(app, "function renderInsightsSurface", "function isValidInsightsDiagnostic");

const controlled = [
  "Missing CTA",
  "Add CTA variations for different stages.",
  "Tone shifts across nodes are high.",
  "Add trust-building proof in Landing Page nodes."
];
for (const message of controlled) {
  assert(analyzer.includes(JSON.stringify(message)), `analyzer no longer emits controlled message: ${message}`);
  assert(catalog.includes(JSON.stringify(message)), `diagnostic catalog does not cover: ${message}`);
}
assert.strictEqual((catalog.match(/^  [A-Z][A-Z_]+:/gm) || []).length, controlled.length, "catalog and current rendered analyzer messages differ");
assert(catalog.includes("Object.freeze") && catalog.includes("INSIGHTS_DIAGNOSTIC_MESSAGE_KEYS[value]"), "stable exact diagnostic mapping is missing");
assert(!/includes\(|startsWith\(|match\(|test\(|fetch\(|XMLHttpRequest|translate.googleapis/.test(between(app, "function insightsDiagnosticText", "function renderInsightsSurface")), "diagnostic translation is fuzzy or external");

const sandbox = { module: { exports: {} }, localStorage: { getItem: () => null, setItem: () => {} } };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(languageSource, sandbox, { filename: "language.js" });
const language = sandbox.module.exports;
for (const message of controlled) {
  assert.strictEqual(language.t(message, "en"), message, `English meaning/fallback changed: ${message}`);
  const german = language.t(message, "de");
  assert.notStrictEqual(german, message, `German translation missing: ${message}`);
  assert(!/^[A-Z][A-Z0-9_.-]+$/.test(german), `raw translation key rendered: ${german}`);
}
assert.strictEqual(language.t("Tone shifts across nodes are high.", "de"), "Die Tonalität unterscheidet sich deutlich zwischen den Knoten.");
assert.strictEqual(language.t("Unknown future system diagnosis.", "de"), "Unknown future system diagnosis.", "unknown diagnosis must retain the English canonical fallback");

for (const list of ["a.cta.warnings, ...a.cta.suggestions", "a.tone.warnings.map(insightsDiagnosticText)", "a.trust.suggestions.map(insightsDiagnosticText)"]) {
  assert(renderer.includes(list), `rendered system diagnostic does not use translation mapping: ${list}`);
}
assert(renderer.includes("a.icp.inconsistencies.join"), "Canvas-authored audiences are no longer rendered unchanged");
assert(!renderer.includes("a.icp.inconsistencies.map(insightsDiagnosticText)"), "Canvas-authored audiences must not be translated");
assert(renderer.includes("Object.entries(a.platformDistribution.counts)"), "Canvas platform names/counts changed");

// Guard the canonical calculations, thresholds, result fields, and display ordering.
for (const token of [
  "40 + (coveredStages.length / stages.length) * 25", "uniqueCtas.size >= 2 ? 10 : 0",
  "audienceSet.size <= 1 ? 90 : 55", "toneSet.size <= 1 ? 90 : toneSet.size <= 2 ? 75 : 50",
  "toneSet.size > 2", "trustNodes.length ? 80 : 35"
]) assert(analyzer.includes(token), `canonical analyzer behavior changed: ${token}`);
const order = ['t("Canvas readiness")', 't("Funnel-stage coverage")', 't("Canvas nodes by platform")', 't("CTA structure")', 't("ICP consistency")', 't("Tone consistency")', 't("Trust-layer coverage")'];
for (let index = 1; index < order.length; index += 1) assert(renderer.indexOf(order[index - 1]) < renderer.indexOf(order[index]), `diagnostic ordering changed near ${order[index]}`);
for (const code of ["CAMPAIGN_V3_STRATEGIC_GENERIC_TITLE", "CAMPAIGN_V3_STRATEGIC_SOCIAL_LINKEDIN_TOO_SHORT"]) assert(app.includes(code), `Strategic/Social diagnostic code removed: ${code}`);

const languageChange = between(app, 'el.uiLanguageSelect?.addEventListener("change"', 'el.campaignLanguageSelect?.addEventListener');
assert(languageChange.includes("renderInsightsSurface()"), "open Insights is not rerendered on language change");
assert(!/analyzeCampaign|captureInsightsDiagnostic|markUnsaved|save|autosave|isDirty\s*=/.test(languageChange), "language switching reruns diagnostics or mutates/persists the Board");
assert(renderer.includes("state.insightsDiagnosticSnapshot"), "language rerender does not reuse the cached diagnostic");
assert(!renderer.includes("analyzeCampaign("), "Insights rerender recalculates diagnostics");
assert(workflow.indexOf("check-bw25-honest-ai-insights-baseline.js") < workflow.indexOf("check-bw25-1-dynamic-insights-translations.js"), "BW-25.1 check is not immediately after BW-25");

require("./check-bw21-1-inspector-language-coverage.js");
require("./check-bw25-honest-ai-insights-baseline.js");
console.log("BW-25.1 dynamic AI Insights translation checks passed.");
