#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const language = read("language.js");
const pkg = require(path.join(root, "package.json"));
const workflow = read(".github/workflows/runtime-boot-safety.yml");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} missing`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} incomplete`);
}

const context = {};
vm.createContext(context);
for (const name of ["isAiReviewPostit", "isEligibleHumanConversationContribution", "getOpenConversationCountForNode"]) {
  vm.runInContext(`${functionSource(app, name)}; this.${name}=${name};`, context);
}
const count = context.getOpenConversationCountForNode;
const rootNote = (text = "Root", extra = {}) => ({ id: "p1", authorName: "Human", text, resolved: false, replies: [], ...extra });
const reply = (id, text = "Reply", extra = {}) => ({ id, authorName: "Human", text, ...extra });
const review = (replies = [], extra = {}) => ({ id: "a1", source: "ai_review", authorName: "AI Review", text: "Score: 99\nSummary: generated", resolved: false, replies, ...extra });

assert.equal(count({}), 0);
assert.equal(count({ postits: "legacy" }), 0);
assert.equal(count({ postits: [rootNote("   ")] }), 0);
assert.equal(count({ postits: [rootNote()] }), 1);
assert.equal(count({ postits: [rootNote("Root", { replies: [reply("r1")] })] }), 2);
assert.equal(count({ postits: [rootNote("Root", { replies: [reply("r1"), reply("r2"), reply("r3")] })] }), 4);
const postit = rootNote("Root", { replies: [reply("r1"), reply("r2"), reply("r3")] });
postit.resolved = true; assert.equal(count({ postits: [postit] }), 0);
postit.resolved = false; assert.equal(count({ postits: [postit] }), 4);
assert.equal(count({ postits: [review()] }), 0);
assert.equal(count({ postits: [review([reply("ar1")])] }), 1);
assert.equal(count({ postits: [review([reply("ar1"), reply("ar2"), reply("ar3")])] }), 3);
const ai = review([reply("ar1"), reply("ar2")], { resolved: true });
assert.equal(count({ postits: [ai] }), 0); ai.resolved = false; assert.equal(count({ postits: [ai] }), 2);
assert.equal(count({ postits: [postit, ai] }), 6);
assert.equal(count({ postits: [review([], { summary: "generated", strengths: ["generated"], improvements: ["generated"], score: 100 })] }), 0);
assert.equal(count({ postits: [rootNote("Root", { replies: [reply("r1", "deleted", { deleted: true }), reply("r2", "  "), null] })] }), 1);
assert.doesNotThrow(() => count({ postits: [null, 4, {}, { replies: "bad" }] }));
const repeated = reply("same");
assert.equal(count({ postits: [rootNote("Root", { replies: [repeated, repeated, { ...repeated }] })] }), 2);
const sameNote = rootNote(); assert.equal(count({ postits: [sameNote, sameNote, { ...sameNote }] }), 1);
const snapshotNode = { postits: [rootNote("Root", { replies: [reply("r1")] })], position: { x: 1, y: 2 } };
const before = JSON.stringify(snapshotNode); assert.equal(count(snapshotNode), 2); assert.equal(JSON.stringify(snapshotNode), before, "selector mutated node");
assert.equal(count(JSON.parse(before)), 2, "Board reload changed derived count");

// Execute the production badge renderer against its stable existing DOM owner.
const rendered = { textContent: "", title: "", attributes: {}, classes: {} };
rendered.setAttribute = (name, value) => { rendered.attributes[name] = value; };
rendered.classList = { toggle(name, value) { rendered.classes[name] = value; } };
const nodeEl = { querySelector(selector) { return selector === ".node-comment-badge" ? rendered : null; } };
Object.assign(context, {
  uiText: (value) => value,
  uiFormat: (value, values) => Object.entries(values).reduce((text, [key, replacement]) => text.replaceAll(`{${key}}`, replacement), value),
  hasRecentUnopenedComment: () => false,
  hasUnreadNodeComments: () => false
});
vm.runInContext(`${functionSource(app, "updateNodeCommentBadge")}; this.updateNodeCommentBadge=updateNodeCommentBadge;`, context);
const renderCount = (node) => { context.updateNodeCommentBadge(node, nodeEl); return { text: rendered.textContent, title: rendered.title, aria: rendered.attributes["aria-label"] }; };
assert.deepEqual(renderCount({ postits: [] }), { text: "💬 0", title: "0 open comments. Includes open Post-it and AI Review conversations where applicable", aria: "0 open comments" });
assert.equal(renderCount({ postits: [rootNote()] }).text, "💬 1");
assert.equal(renderCount({ postits: [rootNote("Root", { replies: [reply("r1"), reply("r2"), reply("r3")] })] }).text, "💬 4");
assert.equal(renderCount({ postits: [postit, ai] }).text, "💬 6");
postit.resolved = true; ai.resolved = true; assert.equal(renderCount({ postits: [postit, ai] }).text, "💬 0");
postit.resolved = false; ai.resolved = false; assert.equal(renderCount({ postits: [postit, ai] }).text, "💬 6");
for (const density of ["compact", "standard", "detailed"]) assert.equal(renderCount({ density, postits: [postit, ai] }).text, "💬 6");

const selector = functionSource(app, "getOpenConversationCountForNode");
for (const forbidden of ["fetch(", "localStorage", "saveCampaign", "markUnsaved", "pushHistory", "renderNode(", "updateNodeCard(", "applyCampaignState(", "document."]) assert(!selector.includes(forbidden), `selector invokes ${forbidden}`);
const badge = functionSource(app, "updateNodeCommentBadge");
assert(badge.includes("getOpenConversationCountForNode(node)"));
assert(!badge.includes("renderNode(") && !badge.includes("applyCampaignState(") && !badge.includes("loadBoard"));
for (const trigger of ["note.text = area.value", "note.resolved = !note.resolved", "note.replies.push", "node.postits = node.postits.filter"]) assert(app.includes(trigger), `${trigger} lifecycle missing`);
assert(app.includes("updateNodeCommentBadge(node, nodeEl)"), "targeted refresh missing");
assert(app.includes("const existing = findAuthoritativePostit(node)"), "one-Post-it guard missing");
for (const value of ["1 open comment", "{count} open comments", "Includes open Post-it and AI Review conversations where applicable", "1 offener Kommentar", "{count} offene Kommentare", "Berücksichtigt offene Unterhaltungen in Post-its und AI Reviews"]) assert(language.includes(value) || app.includes(value), `${value} localization missing`);
assert.equal(pkg.scripts["check:bw33.4b1"], "node scripts/check-bw33-4b1-open-conversation-count.js");
assert(workflow.indexOf("check:bw33.4b1") > workflow.indexOf("check:bw33.4a1"), "Runtime Boot Safety order incorrect");
console.log("BW-33.4B1 authoritative open-conversation count checks passed.");
