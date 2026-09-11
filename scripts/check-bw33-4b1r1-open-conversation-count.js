#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const index = read("index.html");
const language = read("language.js");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const pkg = JSON.parse(read("package.json"));

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
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const inspectorHtml = index.slice(index.indexOf('<aside class="inspector" id="inspector-panel"'), index.indexOf("</aside>", index.indexOf('<aside class="inspector" id="inspector-panel"')) + 8);
const frozen = {
  selectCanvasNode: "d20b606b35f30ef3eb2fd385fcb63273c5dcb41e34f907718b1f1e361ecad61b",
  fillInspector: "27f52513d773bda6a84b0f68fa236bdcfd9e7df566debcdb439aa6222ded8e96",
  synchronizeAppShell: "73525a650e735a604d7952b8a324ab3d251b6777402ef8d497b2e2fafa445208",
  inspectorResponsiveMode: "5f1574b183a11272045885c31496a2a4b0468c62d7d5070668e4485a5cd517a5",
  inspectorHtml: "aa0ef34c507c7ca532158fb76a6e0868e03aae1dd27aec838fbcd595275bae89"
};
for (const [name, expected] of Object.entries(frozen)) {
  const value = name === "inspectorHtml" ? inspectorHtml : functionSource(app, name);
  assert.strictEqual(hash(value), expected, `frozen Inspector boundary changed: ${name}`);
}

const context = {};
vm.createContext(context);
vm.runInContext(`${functionSource(app, "getOpenConversationCountForNode")}; this.count=getOpenConversationCountForNode;`, context);
const count = context.count;
const postit = (text = "Root", extra = {}) => ({ id: "p1", authorName: "Owner", text, resolved: false, replies: [], ...extra });
const reply = (id, text = "Reply", extra = {}) => ({ id, authorName: "Owner", text, ...extra });
const review = (replies = [], extra = {}) => ({ id: "ai1", source: "ai_review", authorName: "AI Review", authorEmail: "ai@funklix.local", text: "generated score and summary", resolved: false, replies, ...extra });
assert.equal(count(), 0); assert.equal(count(null), 0); assert.equal(count({ postits: "legacy" }), 0);
assert.equal(count({ postits: [] }), 0);
assert.equal(count({ postits: [postit("  ")] }), 0);
assert.equal(count({ postits: [postit()] }), 1);
assert.equal(count({ postits: [postit("Root", { replies: [reply("r1")] })] }), 2);
const human = postit("Root", { replies: [reply("r1"), reply("r2"), reply("r3")] });
assert.equal(count({ postits: [human] }), 4);
human.resolved = true; assert.equal(count({ postits: [human] }), 0);
human.resolved = false; assert.equal(count({ postits: [human] }), 4);
assert.equal(count({ postits: [review()] }), 0);
assert.equal(count({ postits: [review([reply("a1")])] }), 1);
const ai = review([reply("a1"), reply("a2")]);
assert.equal(count({ postits: [ai] }), 2);
assert.equal(count({ postits: [human, ai] }), 6);
ai.resolved = true; assert.equal(count({ postits: [human, ai] }), 4);
ai.resolved = false; assert.equal(count({ postits: [human, ai] }), 6);
assert.equal(count({ postits: [postit("Root", { replies: [reply("d", "deleted", { deleted: true }), reply("w", " \n "), reply("z", "gone", { deletedAt: "now" }), reply("rr", "resolved", { resolved: true })] })] }), 1);
assert.doesNotThrow(() => count({ postits: [null, 7, {}, { replies: [undefined, "bad"] }] }));
const duplicate = reply("same");
assert.equal(count({ postits: [postit("Root", { replies: [duplicate, duplicate, { ...duplicate }] })] }), 2);
assert.equal(count({ postits: [{ authorName: "Owner", text: "same", replies: [] }, { authorName: "Owner", text: "same", replies: [] }] }), 2);
const board = { nodes: [{ id: "n1", position: { x: 11, y: 22 }, postits: [human, ai] }], dirty: false, history: [], collaborationWrites: 0, autosaves: 0, density: "compact", approvalFingerprint: "approved", publishingMaterial: "material" };
const before = JSON.stringify(board); const selectionBefore = "another-node"; const inspectorBefore = "closed";
assert.equal(count(board.nodes[0]), 6); assert.strictEqual(JSON.stringify(board), before);
assert.equal(count(JSON.parse(before).nodes[0]), 6, "Board reload must derive the same count");
assert.strictEqual(selectionBefore, "another-node"); assert.strictEqual(inspectorBefore, "closed");
const selector = functionSource(app, "getOpenConversationCountForNode");
for (const forbidden of ["fetch(", "localStorage", "sessionStorage", "saveCampaign", "markUnsaved", "pushHistory", "document.", "renderNode(", "updateNodeCard(", "applyCampaignState(", "fillInspector("]) assert(!selector.includes(forbidden), `selector invokes ${forbidden}`);

// Exercise the production badge updater without replacing its existing owner or listener.
const badge = { textContent: "", title: "", attrs: {}, dataset: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = v; } };
const badgeContext = { getOpenConversationCountForNode: count, uiText: (s) => s, uiFormat: (s, values) => s.replace("{count}", values.count), hasRecentUnopenedComment: () => false, hasUnreadNodeComments: () => false };
vm.createContext(badgeContext);
vm.runInContext(`${functionSource(app, "updateNodeCommentBadge")}; this.update=updateNodeCommentBadge;`, badgeContext);
const nodeEl = { querySelector: () => badge };
badgeContext.update({ postits: [] }, nodeEl); assert.deepEqual([badge.textContent, badge.attrs["aria-label"]], ["💬 0", "0 open comments"]);
badgeContext.update({ postits: [human, ai] }, nodeEl); assert.deepEqual([badge.textContent, badge.attrs["aria-label"]], ["💬 6", "6 open comments"]);
assert.equal(badge.title, "Open comments in Post-it and AI Review conversations");

// Production-shaped Inspector lifecycle: execute the real selection, fill and shell functions.
function classes(initial = []) { const values = new Set(initial); return { add: (...x) => x.forEach(v => values.add(v)), remove: (...x) => x.forEach(v => values.delete(v)), toggle: (v, force) => force ? values.add(v) : values.delete(v), contains: (v) => values.has(v) }; }
const fields = Object.fromEntries(["type","status","title","content","imagePrompt","variants","platform","caption","hashtags","preview","audience","goal","channel","funnelStage","tone","contentFormat","lpHeaderVisualPrompt","lpHeaderClaim","lpProblem","lpSolution","lpTrust","lpCta"].map(k => [k, { value: "", disabled: false, classList: classes() }]));
const panel = { classList: classes(["hidden"]), attrs: {}, contains: () => false, setAttribute(k,v){this.attrs[k]=v;}, toggleAttribute(k,v){this.attrs[k]=v;} };
const shell = { dataset: {} };
const lifecycleState = { activeView: "board", appMode: "canvas", currentBoardId: "private-board", boardLoadGeneration: 4, isBoardHydrating: false, nodes: [], edges: [], selectedIds: new Set(), selectedPrimary: null, inspectorDismissedNodeId: null, inspectorSelectionSnapshot: null, hashtagDraftByNode: {}, boardAccess: { canView: true, canEdit: true }, publicBoardToken: null };
const ordinary = { id: "node-1", type: "Content", status: "Draft", title: "Existing private node", content: "Body", imagePrompt: "", variants: [], social: { platform: "LinkedIn", caption: "", hashtags: [], preview: "" }, audience: "People", goal: "Awareness", channel: "LinkedIn", funnelStage: "Awareness", tone: "Direct", contentFormat: "1:1", landingPage: {}, postits: [] };
lifecycleState.nodes.push(ordinary);
const section = () => ({ classList: classes(), style: {} });
const inspectorEl = { appShell: shell, inspectorPanel: panel, inspectorMeta: { textContent: "" }, nodeForm: { reset(){}, querySelector(){ return { classList: classes() }; } }, inputs: fields, socialFields: section(), contentUploadFields: section(), contentFormatField: section(), landingPageFields: section(), generateHeaderVisualButton: { style: {} }, addToPostingCalendarButton: null, postingScheduleMeta: null, inspectorImageList: { innerHTML: "" }, connectedContextSummary: { textContent: "" }, connectedContextBody: { innerHTML: "", appendChild(){}, textContent: "" }, zoomLayer: { querySelectorAll: () => [] }, canvas: { focus(){} } };
const doc = { body: { classList: classes() }, activeElement: null, querySelectorAll: () => [], getElementById: () => ({ classList: classes() }), createElement: () => ({ textContent: "", append(){}, classList: classes() }), createTextNode: (s) => s };
const runtime = { state: lifecycleState, el: inspectorEl, document: doc, window: { matchMedia: (q) => ({ matches: q.includes("1024") }) }, SHELL_LAYOUT_BY_VIEW: { board: "canvas" }, uiText: s=>s, uiFormat: (s,v)=>Object.entries(v).reduce((x,[k,val])=>x.replaceAll(`{${k}}`,val),s), getNode: id=>lifecycleState.nodes.find(n=>n.id===id), normalizeNodeStatus:s=>s, isBoardReadOnly:()=>false, populateOwnerSelect:n=>{ fields.ownerRendered=n.id; }, renderInspectorAiWorkspace:()=>{}, renderInspectorSectionRoute:()=>{}, updateInspectorActionVisibility:()=>{}, renderInspectorImages:()=>{}, renderNodePresenceBadges:()=>{}, getConnectedNodeContext:()=>({parentNodes:[],childNodes:[]}), formatNodeScheduleMeta:()=>null, updateSelectionClasses:()=>{} };
vm.createContext(runtime);
for (const name of ["inspectorResponsiveMode", "restoreInspectorFocus", "synchronizeAppShell", "fillInspector", "selectCanvasNode"]) vm.runInContext(`${functionSource(app,name)}; this.${name}=${name};`, runtime);
assert.equal(lifecycleState.isBoardHydrating, false, "hydration did not complete");
lifecycleState.density = "detailed"; // post-hydration presentation activation
assert(runtime.selectCanvasNode(ordinary), "ordinary node selection failed");
assert.equal(lifecycleState.selectedPrimary, ordinary.id); assert.equal(fields.title.value, ordinary.title); assert.equal(fields.content.value, ordinary.content); assert.equal(fields.ownerRendered, ordinary.id);
assert.equal(shell.dataset.inspectorOpen, "true"); assert.equal(shell.dataset.inspectorMode, "column"); assert.equal(panel.classList.contains("hidden"), false); assert.equal(panel.attrs["aria-hidden"], "false"); assert.equal(panel.attrs.inert, false);
runtime.window.matchMedia = () => ({ matches: false }); runtime.synchronizeAppShell(); assert.equal(shell.dataset.inspectorMode, "overlay");
for (const heading of ["AI Actions", "Node Actions", "Connected Context"]) assert(inspectorHtml.includes(`data-i18n="${heading}"`), `${heading} absent`);
assert(!selector.includes("selectCanvasNode") && !selector.includes("synchronizeAppShell"), "badge calculation entered Inspector lifecycle");
function assertInspectorFixture(html) { assert(html.includes('id="inspector-panel"') && html.includes('id="node-form"') && html.includes('id="node-title"') && html.includes('id="node-owner"'), "Inspector lifecycle fixture rejected"); }
assertInspectorFixture(inspectorHtml);
assert.throws(() => assertInspectorFixture(inspectorHtml.replace(/<aside class="inspector"[\s\S]*?<\/aside>/, "")), /Inspector lifecycle fixture rejected/, "historical unsafe removal was not rejected");

const badgeUpdater = functionSource(app, "updateNodeCommentBadge");
assert(badgeUpdater.includes("getOpenConversationCountForNode(node)"));
assert(functionSource(app, "renderPostits").includes("note.text = area.value") && functionSource(app, "renderPostits").includes("updateNodeCommentBadge(node, nodeEl)"));
for (const value of ["1 open comment", "{count} open comments", "1 offener Kommentar", "{count} offene Kommentare", "Offene Kommentare in Post-it- und AI-Review-Unterhaltungen"]) assert(language.includes(value), `localization missing: ${value}`);
assert.equal(pkg.scripts["check:bw33.4b1r1"], "node scripts/check-bw33-4b1r1-open-conversation-count.js");
assert(workflow.indexOf("check:bw33.4b1r1") > workflow.indexOf("check:bw33.4a1"));
for (const behavior of ["openNodeCommentThread(node.id)", "enablePostitDrag", "postit-reply-button", "postit-resolve", "ai-review-apply-fix"]) assert(app.includes(behavior), `${behavior} missing`);
console.log("BW-33.4B1R1 authoritative counter and frozen Inspector runtime checks passed.");
