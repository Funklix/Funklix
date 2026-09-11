#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const index = read("index.html");
const css = read("styles.css");
const language = read("language.js");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} missing`);
  const params = source.indexOf("(", start);
  let parenDepth = 0;
  let brace = -1;
  for (let i = params; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    if (source[i] === ")") parenDepth -= 1;
    if (parenDepth === 0) { brace = source.indexOf("{", i); break; }
  }
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} incomplete`);
}

const requiredIds = ["inspector-route-status", "inspector-comments-section", "inspector-comments-heading", "inspector-comments-canvas-btn", "inspector-ai-review-heading"];
requiredIds.forEach((id) => assert(index.includes(`id="${id}"`), `${id} DOM owner missing`));
assert(index.includes('role="status" aria-live="polite"'));
assert(index.includes('tabindex="-1" data-i18n="Comments"'));
assert(index.includes('tabindex="-1" data-i18n="AI Workspace"'));
assert(css.includes(".inspector-route-arrival") && css.includes("prefers-reduced-motion: reduce"));
assert(css.includes('html[data-theme="dark"] .inspector'));
for (const key of ["Open comments in Inspector", "Open AI Review in Inspector", "Comments for {title} are available", "AI Review for {title} is available"]) assert(language.includes(key), `${key} localization missing`);

const events = [];
const classes = () => ({ hidden: false, toggle(name, value) { if (name === "hidden") this.hidden = value; }, contains(name) { return name === "hidden" && this.hidden; }, add(name) { events.push(`class:${name}`); }, remove() {} });
const commentsSection = { classList: classes(), scrollIntoView() { events.push("scroll:comments"); }, addEventListener() {} };
const aiSection = { classList: classes(), scrollIntoView() { events.push("scroll:ai_review"); }, addEventListener() {} };
const commentsHeading = { focus() { events.push("focus:comments"); } };
const aiHeading = { focus() { events.push("focus:ai_review"); } };
const origin = { isConnected: true, focus() { events.push("focus:return"); } };
const node = { id: "node-1", title: "Launch", type: "Content", postits: [{ id: "c1", text: "Keep me", resolved: false }, { id: "r1", resolved: true, replies: [{ text: "Keep reply" }] }] };
const state = { currentBoardId: "private-board", boardLoadGeneration: 9, isBoardLoading: false, isBoardHydrating: false, boardAccess: { canView: true }, nodes: [node], selectedIds: new Set(), selectedPrimary: null, inspectorDismissedNodeId: "node-1", inspectorSectionRoute: null, isDirty: false, history: [], aiReviewFixPreviews: { "node-1": { status: "loading" } } };
let selectionCount = 0;
const el = {
  zoomLayer: { querySelector(selector) { return selector.includes("node-1") ? {} : null; } },
  inspectorCommentsSection: commentsSection, inspectorCommentsHeading: commentsHeading, inspectorCommentsSummary: { textContent: "" },
  aiWorkspaceSection: aiSection, inspectorAiReviewHeading: aiHeading, aiWorkspaceBody: { textContent: "" }, inspectorRouteStatus: { textContent: "" }
};
const context = {
  state, el, window: { matchMedia: () => ({ matches: true }) }, document: { querySelectorAll: () => [] },
  getNode: (id) => state.nodes.find((item) => item.id === id),
  updateSelectionClasses() { selectionCount += 1; events.push("selection"); },
  fillInspector() { events.push("inspector-render"); }, synchronizeAppShell({ forceInspectorOpen }) { events.push(`inspector-open:${forceInspectorOpen}`); },
  renderInspectorSectionRoute() {}, getAiReviewFixPreview: (id) => state.aiReviewFixPreviews[id] || null,
  uiText: (value) => value, uiFormat: (value, values) => Object.entries(values).reduce((text, [key, replacement]) => text.replaceAll(`{${key}}`, replacement), value),
  requestAnimationFrame(callback) { callback(); }
};
vm.createContext(context);
for (const name of ["selectCanvasNode", "openInspectorSection", "clearInspectorSectionRoute"]) vm.runInContext(`${functionSource(app, name)}; this.${name}=${name};`, context);

const protectedSnapshot = JSON.stringify({ board: state.currentBoardId, node, dirty: state.isDirty, history: state.history, ai: state.aiReviewFixPreviews });
assert.strictEqual(context.openInspectorSection("node-1", "comments", origin, { keyboard: true }), true);
assert.strictEqual(selectionCount, 1, "comment route selected more than once");
assert.strictEqual(state.selectedPrimary, "node-1");
assert(events.includes("inspector-open:true") && events.includes("scroll:comments") && events.includes("focus:comments"));
assert(el.inspectorRouteStatus.textContent.includes("Launch") && el.inspectorRouteStatus.textContent.includes("1 unresolved"));
assert.strictEqual(JSON.stringify({ board: state.currentBoardId, node, dirty: state.isDirty, history: state.history, ai: state.aiReviewFixPreviews }), protectedSnapshot, "comment route mutated protected state");

events.length = 0; selectionCount = 0;
assert.strictEqual(context.openInspectorSection("node-1", "ai_review", origin, { keyboard: true }), true);
assert.strictEqual(selectionCount, 1, "AI route selected more than once");
assert(events.includes("scroll:ai_review") && events.includes("focus:ai_review"));
assert.strictEqual(state.aiReviewFixPreviews["node-1"].status, "loading", "AI state changed");
assert.strictEqual(JSON.stringify({ board: state.currentBoardId, node, dirty: state.isDirty, history: state.history, ai: state.aiReviewFixPreviews }), protectedSnapshot, "AI route mutated protected state");

const selectedBeforeFailure = state.selectedPrimary;
assert.strictEqual(context.openInspectorSection("missing", "comments", origin), false);
assert.strictEqual(state.selectedPrimary, selectedBeforeFailure);
state.isBoardLoading = true;
assert.strictEqual(context.openInspectorSection("node-1", "comments", origin), false, "route ran during Board load");
state.isBoardLoading = false;

const routeBody = functionSource(app, "openInspectorSection");
for (const forbidden of ["fetch(", "localStorage", "saveCampaign", "markUnsaved", "pushHistory", "applyCanvasDensity", "renderNode(", "updateNodeCard(", "applyCampaignState("]) assert(!routeBody.includes(forbidden), `routing invokes ${forbidden}`);
assert(app.includes('openNodeCommentThread(node.id);\n      openInspectorSection(node.id, "comments"'), "Canvas comment workflow not preserved");
assert(app.includes('reviewCard.appendChild(inspectorButton)') && app.includes('renderAiReviewCard(parsedAiReview'), "AI Review overlay or route missing");
for (const control of ["postit-resolve", "postit-delete", "postit-reply-button", "ai-review-apply-fix"]) assert(app.includes(control), `${control} removed`);
assert(index.includes('id="postit-template"') && app.includes("enablePostitDrag") && app.includes("note.color") && app.includes("replies"), "Post-it behavior removed");
assert(app.includes("💬") && app.includes("🤖"), "functional emoji removed");
assert(functionSource(app, "applyCampaignState").includes("clearInspectorSectionRoute()"), "Board hydration does not clear route");
assert(functionSource(app, "loadBoardFromUrlIfPresent").includes("clearInspectorSectionRoute()"), "Board switch does not clear route");
assert(functionSource(app, "loadBoardFromUrlIfPresent").indexOf("applyCampaignState(normalizedCanvasState") < functionSource(app, "loadBoardFromUrlIfPresent").indexOf("schedulePostHydrationCanvasDensity"), "private Board hydration/density order regressed");
assert(functionSource(app, "applyCanvasDensityPresentation").includes("state.currentBoardId") && !routeBody.includes("canvasDensity"), "density isolation regressed");
assert(app.includes("return routeOrigin.focus") || app.includes("routeOrigin.focus?."), "focus return missing");

console.log("BW-33.4A1 production indicator-to-Inspector routing checks passed.");
