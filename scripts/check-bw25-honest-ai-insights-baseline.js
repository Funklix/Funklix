#!/usr/bin/env node
"use strict";
const assert = require("assert"); const fs = require("fs"); const path = require("path");
const root = path.resolve(__dirname, ".."); const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js"), html = read("index.html"), language = read("language.js"), workflow = read(".github/workflows/runtime-boot-safety.yml");
const between = (source,start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const renderer = between(app,"function renderInsightsSurface()","function isValidInsightsDiagnostic"); const analyzer = between(app,"function analyzeCampaign","function suggestNextNodes");
assert(html.includes('id="insights-view"') && html.includes('id="insights-cards"'), "legacy Insights DOM IDs changed");
for (const text of ["Measured performance","No analytics data connected","Canvas Diagnostics","Campaign results such as reach, engagement, conversions, and revenue will appear here when a verified data source is connected."]) assert(renderer.includes(text), `missing honest Insights copy: ${text}`);
assert(renderer.indexOf('"Measured performance"') < renderer.indexOf('"Canvas Diagnostics"'), "measured and diagnostic sections are not ordered separately");
assert(!/Connect analytics|Google Analytics|Meta Ads|sample metric|fake trend/i.test(renderer), "fake metric/integration UI introduced");
for (const text of ["Current Canvas","Deterministic diagnostic","Includes unsaved Canvas changes","Based on the currently loaded saved Canvas","Canvas readiness","Funnel-stage coverage","CTA structure","ICP consistency","Tone consistency","Trust-layer coverage"]) assert(app.includes(text), `missing diagnostic contract: ${text}`);
for (const guard of ["state.isBoardLoading","!state.currentBoardId","state.boardAccess?.canView === false","!state.nodes.length","isCurrentInsightsSnapshot"]) assert(renderer.includes(guard), `missing guarded state: ${guard}`);
assert(app.includes("currentInsightsCanvasIdentity") && app.includes("boardLoadGeneration"), "snapshot lacks lifecycle/Canvas identity");
for (const forbidden of ["saveCampaignCanvasState", "saveBoardToServer", "markUnsaved", "scheduleAutosave", "review-node"]) assert(!renderer.includes(forbidden), `renderer contains forbidden write: ${forbidden}`);
for (const token of ["40 + (coveredStages.length / stages.length) * 25", '"Missing CTA"', "consistencyScore: audienceSet.size <= 1 ? 90 : 55", "trustNodes.length ? 80 : 35"]) assert(analyzer.includes(token), `canonical formula changed: ${token}`);
for (const text of ["Gemessene Performance","Keine Analytics-Daten verbunden","Datenstatus: Nicht verfügbar","Canvas-Diagnosen","Deterministische Diagnose","Enthält ungespeicherte Canvas-Änderungen"]) assert(language.includes(text), `missing German translation: ${text}`);
assert(workflow.includes("check-bw25-honest-ai-insights-baseline.js"), "BW-25 workflow registration missing");
console.log("BW-25 honest AI Insights baseline checks passed.");
