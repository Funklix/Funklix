#!/usr/bin/env node
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, ".."); const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js"), lang = read("language.js"), css = read("styles.css"), pkg = read("package.json"), workflow = read(".github/workflows/runtime-boot-safety.yml");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const render = between(app, "function renderInsightsSurface()", "function isValidInsightsDiagnostic");
const findings = between(app, "function buildInsightsFindings", "function isCurrentInsightsSnapshot");
const handoff = between(app, "function askAiBrainAboutFinding", "function renderInsightsSurface");
const has = (source, values, label) => values.forEach((value) => assert(source.includes(value), `${label}: ${value}`));
// Primary hierarchy, one shared context, and retained methodology provenance.
has(render, ["Overview", "Measured performance", "Canvas Diagnostics", "Opportunities", "Data and Methodology", "Based on the structure and content of your current Canvas.", "insights-context"], "information hierarchy");
assert(!render.includes("const chips"), "repeated provenance chip renderer returned");
assert((render.match(/Deterministic diagnostic/g) || []).length === 1, "classification must only appear in methodology");
has(render, ["meta.source", "meta.scope", "meta.canvasState", "meta.analyzedAt", "Diagnostic methods", "Assumptions", "Limitations"], "full methodology provenance");
// Explicit, accessible funnel mapping and deterministic qualitative thresholds.
has(render, ['["Awareness", "Interest", "Consideration", "Conversion", "Retention"]', "analysis.funnel.coveredStages", 'present ? "✓" : "○"', 't("Covered")', 't("Missing")', "insights-funnel-stages"], "funnel checklist");
has(lang, ["Aufmerksamkeit", "Interesse", "Erwägung", "Conversion", "Kundenbindung", "Abgedeckt", "Fehlend"], "German funnel labels");
has(render, ['score >= 85', 'score >= 70', 'score >= 45', '"Strong"', '"Good foundation"', '"Needs attention"', '"Incomplete"'], "deterministic score labels");
has(app, ["healthScore", "qualityScore", "consistencyScore"], "existing diagnostic formulas remain wired");
has(render, ["Object.entries(analysis.platformDistribution.counts)", "No supported channel content is present yet.", "insights-channel-row"], "channel counts");
has(render, ["How this is calculated", "Canvas readiness formula", "Funnel-stage mapping", "CTA variation check"], "secondary methods");
// Action-oriented findings retain hidden identity/order and bounded safe previews.
assert(!render.includes('t(finding.code)'), "issue code exposed as normal copy");
has(render, ["item.dataset.findingId = finding.code", "slice(0, 3)", "slice(0, 160)", "textContent", "showInsightsFindingOnCanvas", "askAiBrainAboutFinding"], "bounded findings");
has(findings, ["INSIGHTS_SEVERITY_RANK", "INSIGHTS_CATEGORY_RANK", "code.localeCompare", ".slice(0, 5)", "evidence", "currentValues", "missingElements"], "finding identity and evidence");
assert(!render.includes("innerHTML"), "unsafe Insights rendering");
// Immutable, validated, localized Brain handoff with category-specific output.
has(handoff, ["Object.freeze", "findingId", "explanation", "severity", "category", "evidence", "affectedNodes", "currentValues", "missingElements", "canvasState", "analyzedAt", "state.nodes.find", "isCurrentInsightsSnapshot"], "descriptor contract");
has(handoff, ["suggest a concrete improved CTA", "missing funnel stage", "conflicting audience descriptions", "aligned wording", "next useful addition", "without fabricated performance claims"], "category-specific English requests");
has(handoff, ["konkrete verbesserte CTA", "fehlende Funnel-Stufe", "Zielgruppenbeschreibungen", "passende Formulierung", "nächste sinnvolle Ergänzung", "ohne erfundene Performance-Aussagen"], "category-specific German requests");
has(handoff, ["Help me improve this Canvas finding", "Hilf mir, diesen Canvas-Hinweis zu verbessern", "What was detected", "Erkannt wurde", "Current context", "Aktueller Kontext", "Current saved Canvas", "Aktuell gespeicherter Canvas"], "localized complete handoff");
has(handoff, ['setActiveView("ai_brain")', 'input.value = question.slice(0, 2000)', "input.focus"], "editable handoff");
for (const forbidden of ["requestAiBrainAdvice", "fetch(", "messages.push", "saveCampaignCanvasState", "markUnsaved", "createNode", "scheduleAutosave"]) assert(!handoff.includes(forbidden), `handoff side effect: ${forbidden}`);
has(handoff, ["state.publicBoardToken", "boardAccess?.canEdit", "This insight is no longer current. Refresh AI Insights."], "authorization and stale rejection");
// Honest empty state, design system, and registration.
has(render, ["No analytics data connected", "Campaign results such as reach, engagement, conversions, and revenue will appear here when a verified data source is connected."], "measured empty state");
assert(!/placeholder chart|fake metric|Connect analytics|import analytics/i.test(render));
for (const forbidden of ["saveCampaignCanvasState", "scheduleAutosave", "fetch(", "review-node", "createNode(", "repairCampaign", "generateCampaign"]) assert(!render.includes(forbidden), `Insights renderer mutates: ${forbidden}`);
has(css, ["insights-funnel-stages", "insights-channel-row", "min-height:44px", 'html[data-theme="dark"]', "@media (max-width:760px)", "overflow-wrap:anywhere"], "responsive themes and accessibility");
has(lang, ["Basierend auf der Struktur und den Inhalten deines aktuellen Canvas.", "Keine Analytics-Daten verbunden", "Hohe Priorität", "Verbesserung empfohlen", "Kleine Optimierung"], "German UX copy");
assert(pkg.includes('"check:bw28.1": "node scripts/check-bw28-1-insights-ux-and-brain-handoff.js"'));
assert(workflow.indexOf("check-bw28-ai-insights-architecture.js") < workflow.indexOf("check-bw28-1-insights-ux-and-brain-handoff.js"));
require("./check-browser-script-integrity.js");
console.log("BW-28.1 Insights UX and AI Brain handoff checks passed (39 regression contracts).");
