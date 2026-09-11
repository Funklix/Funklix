#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const index = read("index.html");
const css = read("styles.css");
const language = read("language.js");

for (const rejected of [
  "inspector-comments-section", "inspector-comments-heading", "inspector-comments-canvas-btn",
  "Show comments on Canvas", "Open AI Review in Inspector", "inspector-route-arrival",
  "openInspectorSection", "inspectorSectionRoute"
]) {
  assert(!app.includes(rejected) && !index.includes(rejected) && !css.includes(rejected) && !language.includes(rejected), `${rejected} misleading Inspector route remains`);
}
assert(app.includes("openNodeCommentThread(node.id);"), "badge no longer opens established Canvas conversation");
assert(app.includes("renderAiReviewCard(parsedAiReview"), "genuine Canvas AI Review missing");
assert(app.includes("renderInspectorAiWorkspace(node)"), "genuine AI fix-preview Inspector owner missing");
for (const control of ["postit-resolve", "postit-delete", "postit-reply-button", "ai-review-apply-fix"]) assert(app.includes(control), `${control} removed`);
assert(index.includes('id="postit-template"') && app.includes("enablePostitDrag") && app.includes("note.color"), "Post-it workflow changed");
assert(app.includes("💬") && app.includes("🤖"), "existing functional emoji removed");
assert(app.includes("getAiReviewFixPreview") && app.includes('fetch("/api/apply-review-fix"'), "AI fix preview changed");
console.log("BW-33.4A1 corrected Canvas-first indicator boundary checks passed.");
