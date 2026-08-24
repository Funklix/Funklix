#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const html = read("index.html");
const language = read("language.js");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

const insightsRenderer = between(app, "function renderInsightsSurface()", "function isValidInsightsDiagnostic");
const intelligenceRenderer = between(app, "function renderCampaignIntelligence()", "function currentInsightsIdentity");
const analyzer = between(app, "function analyzeCampaign", "function suggestNextNodes");

// The destination and its two evidence classes remain visibly separate.
assert(html.includes('id="insights-view"') && html.includes('id="insights-cards"'), "legacy Insights DOM IDs changed");
for (const text of [
  "Measured performance", "No campaign analytics are connected yet.",
  "Reach, engagement, conversions, attribution, revenue, and channel performance will appear here only when they are supplied by a verified data source.",
  "Data status: No analytics connected", "Canvas diagnostics",
  "These checks evaluate campaign structure and content. They are not measured campaign results."
]) assert(insightsRenderer.includes(text), `missing honest Insights copy: ${text}`);
assert(insightsRenderer.indexOf("measured-performance-title") < insightsRenderer.indexOf("canvas-diagnostics-title"), "measured and diagnostic sections are not ordered separately");
assert(!/placeholder|sample metric|sample percentage|Connect analytics|Google Analytics|Meta Ads/i.test(insightsRenderer), "fake metric/integration UI was introduced");

// Each deterministic group shares explicit source, type, meaning, and save-state provenance.
for (const text of [
  "Source: Current Canvas", "Analysis type: Deterministic diagnostic",
  "Includes unsaved Canvas changes.", "Based on the currently loaded saved Canvas.",
  "Canvas readiness", "Funnel-stage coverage", "Canvas nodes by platform", "CTA structure",
  "ICP consistency", "Tone consistency", "Trust-layer coverage"
]) assert(insightsRenderer.includes(text), `missing diagnostic label: ${text}`);
assert(insightsRenderer.includes('state.isDirty ? t("Includes unsaved Canvas changes.") : t("Based on the currently loaded saved Canvas.")'), "saved/unsaved disclosure is not driven by existing dirty state");

// All empty, failure, access, and lifecycle states refuse to invent a result.
for (const guard of ["state.isBoardLoading", "!state.currentBoardId", "state.boardAccess?.canView === false", "!state.nodes.length", "!snapshot", "isValidInsightsDiagnostic"]) {
  assert(insightsRenderer.includes(guard), `missing guarded Insights state: ${guard}`);
}
assert(/currentBoardId[\s\S]*boardLoadGeneration[\s\S]*boardAccess/.test(between(app, "function currentInsightsIdentity", "function captureInsightsDiagnostic")), "diagnostics are not bound to Board/access lifecycle");
assert(/insightsDiagnosticSnapshot\?\.identity === currentInsightsIdentity/.test(insightsRenderer), "stale previous-Board diagnostics are not rejected");

// Insights stays read-only and cannot become Brain, model advice, repair, review, simulation, or persistence.
for (const forbidden of ["fetch(", "refineNodeWithAI", "createSuggestedNodeFromAnalysis", "saveCampaignCanvasState", "saveBoardToServer", "markUnsaved", "scheduleAutosave", "repair", "review-node", "simulation", "brandCore"]) {
  assert(!insightsRenderer.includes(forbidden), `Insights renderer contains forbidden behavior/data: ${forbidden}`);
}
assert(!insightsRenderer.includes("data-suggestion-id"), "Insights duplicates AI Brain suggestions");
assert(intelligenceRenderer.includes("renderAiBrain()"), "AI Insights refresh no longer renders the separate AI Brain destination");
assert(html.includes('id="ai-brain-view"') && html.includes('id="ai-brain-summary"'), "AI Brain DOM changed");

// Preserve the canonical analyzer formula, codes/messages, and existing diagnostic infrastructure.
for (const token of ["40 + (coveredStages.length / stages.length) * 25", '"Missing CTA"', "consistencyScore: audienceSet.size <= 1 ? 90 : 55", "trustNodes.length ? 80 : 35"]) {
  assert(analyzer.includes(token), `existing deterministic calculation/code changed: ${token}`);
}
for (const diagnostic of ["evaluateCampaignV3StrategicDiagnostics", "addCampaignV3StrategicSocialDiagnostics"]) assert(app.includes(diagnostic), `${diagnostic} was removed`);

// Viewer/Public receive only already-authorized Canvas diagnostics and no Brand data or write control.
assert(insightsRenderer.includes("state.boardAccess?.canView === false"), "unauthorized Board data is not suppressed");
assert(!/brandCore|canonical|avatar|persona|brandDNA|member/i.test(insightsRenderer), "protected Brand data leaked into Insights");
assert(!/<button|data-suggestion-id/.test(insightsRenderer), "Viewer/Public could receive a write trigger from Insights");

// English fallback and complete German contract; language rerender does not recalculate or mutate Canvas.
const requiredGerman = [
  "Gemessene Performance", "Noch sind keine Kampagnen-Analysedaten verbunden.",
  "Reichweite, Interaktionen, Conversions, Attribution, Umsatz und Channel-Performance werden hier erst angezeigt, wenn sie aus einer verifizierten Datenquelle stammen.",
  "Datenstatus: Keine Analytics verbunden", "Canvas-Diagnosen", "Aktueller Canvas",
  "Deterministische Diagnose", "Enthält ungespeicherte Canvas-Änderungen.",
  "Basiert auf dem aktuell geladenen gespeicherten Canvas."
];
for (const text of requiredGerman) assert(language.includes(text), `missing German Insights translation: ${text}`);
const languageChange = between(app, 'el.uiLanguageSelect?.addEventListener("change"', 'el.campaignLanguageSelect?.addEventListener');
assert(languageChange.includes('state.activeView === "insights"') && languageChange.includes("renderInsightsSurface()"), "open Insights does not follow uiLanguage");
assert(!/analyzeCampaign|markUnsaved|save|autosave|state\.nodes\s*=/.test(languageChange), "language switching recalculates or mutates Canvas");

assert(workflow.indexOf("check-bw23-language-region-settings.js") < workflow.indexOf("check-bw25-honest-ai-insights-baseline.js"), "BW-25 check must be immediately after BW-23");
require("./check-bw21-language-separation.js");
require("./check-bw21-1-inspector-language-coverage.js");
require("./check-bw23-language-region-settings.js");

console.log("BW-25 honest AI Insights baseline checks passed.");
