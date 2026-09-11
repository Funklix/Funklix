#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const css = read("styles.css");
const languageSource = read("language.js");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const pkg = JSON.parse(read("package.json"));

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} missing`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} incomplete`);
}

const historySource = functionSource(app, "getHistoricalHumanContributionCount");
const historyContext = {};
vm.createContext(historyContext);
vm.runInContext(`${historySource};this.count=getHistoricalHumanContributionCount;`, historyContext);
const count = historyContext.count;
assert.equal(count({ text: "Root", replies: [] }), 1, "root contribution");
assert.equal(count({ text: "Root", replies: [{ text: "One" }, { text: "Two" }] }), 3, "root plus replies");
assert.equal(count({ text: "  ", replies: [{ text: "" }, { text: "deleted", deleted: true }, { text: "AI", source: "generated" }] }), 0, "non-human or empty content excluded");
assert.equal(count({ id: "same", text: "Root", replies: [{ id: "same", text: "duplicate" }] }), 1, "duplicate records excluded");

const languageContext = { window: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(languageContext);
vm.runInContext(languageSource, languageContext);
const language = languageContext.window.FunklixLanguage;
const formatted = (key, count, locale) => language.t(key, locale).replace("{count}", String(count));
assert.equal(formatted("{count} contribution", 1, "en"), "1 contribution");
assert.equal(formatted("{count} contributions", 3, "en"), "3 contributions");
assert.equal(formatted("{count} contribution", 1, "de"), "1 Beitrag");
assert.equal(formatted("{count} contributions", 3, "de"), "3 Beiträge");

const render = functionSource(app, "renderPostits");
for (const contract of [
  "note.resolved = !note.resolved", "renderPostits(node, nodeEl, note.resolved ? \"postit-resolved\"", "updateNodeCommentBadge(node, nodeEl)",
  "saveCampaignCanvasState()", "getHistoricalHumanContributionCount(note)", "area.hidden = true", "area.disabled = true",
  "color.hidden = true", "enablePostitDrag(postit, note)", "requestAnimationFrame", ".postit-text`)?.focus()"
]) assert(render.includes(contract), `resolved production path missing ${contract}`);
assert(render.indexOf("enablePostitDrag(postit, note)", render.indexOf("color.hidden = true")) < render.indexOf("return;", render.indexOf("color.hidden = true")), "resolved note is not draggable before compact return");
for (const geometryWrite of ["note.width =", "note.height =", "postit.style.width", "postit.style.height"])
  assert(!render.includes(geometryWrite), `resolved render writes geometry: ${geometryWrite}`);

const boundary = css.slice(css.indexOf("/* BW-33.4B3.1"), css.indexOf("/* End BW-33.4B3.1"));
assert(boundary.length > 1000, "scoped visual boundary missing");
for (const required of [
  "html[data-theme] .postit:not(.ai-review-postit).is-resolved", 'html[data-theme="dark"] .postit:not(.ai-review-postit)',
  "height:auto!important", ".postit-resolved-summary", ".postit-reply-button", ".postit-resolve:hover", ".postit-resolve:active",
  ".postit-delete:focus-visible", ".postit-color", ":disabled", ":focus-visible", "var(--fk-color-primary-action)", "var(--fk-color-danger-subtle)"
]) assert(boundary.includes(required), `visual contract missing ${required}`);
for (const forbidden of [".ai-review-card", ".inspector ", ".cw-", "emoji-picker", "note.x", "note.y"])
  assert(!boundary.includes(forbidden), `style isolation crossed ${forbidden}`);
assert(!/(^|[},]\s*)button\s*[{,:]/m.test(boundary), "generic button selector leaked into scoped boundary");

const geometry = { x: 44, y: 71, width: 180, height: 246 };
const snapshot = JSON.stringify(geometry);
for (let cycle = 0; cycle < 5; cycle += 1) {
  const note = { ...geometry, resolved: cycle % 2 === 0, text: "Root", replies: [{ text: "Reply" }] };
  count(note);
  assert.equal(JSON.stringify({ x: note.x, y: note.y, width: note.width, height: note.height }), snapshot, "derived compact presentation drifted geometry");
}

assert.equal(pkg.scripts["check:bw33.4b3.1"], "node scripts/check-bw33-4b3-1-resolved-postits.js");
assert(workflow.indexOf("check:bw33.4b3.1") > workflow.indexOf("check:bw33.4b3"), "Runtime Boot Safety order");
assert(!pkg.scripts["check:bw33.4b2"] && !workflow.includes("check:bw33.4b2"), "cancelled B2 was registered");
assert(!pkg.dependencies?.["emoji-picker"], "external emoji picker dependency crossed");
console.log("BW-33.4B3.1 resolved Post-it history, geometry, accessibility, controls, and isolation checks passed.");
