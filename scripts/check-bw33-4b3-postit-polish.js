#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const html = read("index.html");
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

// Execute the production localization module and verify placeholders change without content mutation.
const languageContext = { window: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(languageContext);
vm.runInContext(languageSource, languageContext);
const language = languageContext.window.FunklixLanguage;
assert.equal(language.t("Drop a thought, question, or wild idea…", "en"), "Drop a thought, question, or wild idea…");
assert.equal(language.t("Drop a thought, question, or wild idea…", "de"), "Gedanke, Frage oder wilde Idee …");
const authored = "Legacy Kommentar (auch mit Emojis 😊)\nAuthored text";
language.setUiLanguage("de");
assert.equal(authored, "Legacy Kommentar (auch mit Emojis 😊)\nAuthored text", "language switching rewrote authored content");

const template = html.slice(html.indexOf('<template id="postit-template">'), html.indexOf("</template>", html.indexOf('<template id="postit-template">')));
assert(template.includes('data-i18n-placeholder="Drop a thought, question, or wild idea…"'));
assert(template.includes('data-i18n-aria-label="Post-it message"'));
assert(!template.includes("Kommentar (auch mit Emojis"), "legacy prompt still appears in the production template");

const render = functionSource(app, "renderPostits");
for (const behavior of [
  'area.value = note.text || ""', 'note.text = area.value', 'note.replies.push', "note.resolved = !note.resolved",
  "node.postits = node.postits.filter", "enablePostitDrag(postit, note)", "color.addEventListener", "postit-identity", "postit-actions",
  'replyTime.dateTime = commentCreatedAt(reply)', 'summary.setAttribute("role", "status")'
]) assert(render.includes(behavior), `production Post-it boundary missing: ${behavior}`);
assert(!render.includes('note.text = uiText("Drop a thought'), "placeholder was persisted as root content");
assert(render.indexOf("postit.appendChild(summary)") < render.indexOf('const repliesWrap = document.createElement("div")'), "resolved history is not followed by readable replies");

const countContext = {};
vm.createContext(countContext);
vm.runInContext(`${functionSource(app, "getOpenConversationCountForNode")};this.count=getOpenConversationCountForNode;`, countContext);
const note = { id: "p1", text: "", resolved: false, replies: [], x: 7, y: 9, width: 180, height: 240 };
const geometry = JSON.stringify({ x: note.x, y: note.y, width: note.width, height: note.height });
assert.equal(countContext.count({ postits: [note] }), 0, "empty placeholder note counted");
note.text = "  \n "; assert.equal(countContext.count({ postits: [note] }), 0, "whitespace note counted");
note.text = "A thought 😊"; assert.equal(countContext.count({ postits: [note] }), 1);
note.replies.push({ id: "r1", text: "First" }, { id: "r2", text: "Second" }); assert.equal(countContext.count({ postits: [note] }), 3);
note.resolved = true; assert.equal(countContext.count({ postits: [note] }), 0);
note.resolved = false; assert.equal(countContext.count({ postits: [note] }), 3);
assert.equal(JSON.stringify({ x: note.x, y: note.y, width: note.width, height: note.height }), geometry, "presentation changed geometry");

const ordinaryCss = css.slice(css.indexOf("/* BW-33.4B3"), css.indexOf("/* End BW-33.4B3"));
for (const rule of [
  "font-family:var(--fk-font-family)", "overflow-wrap:anywhere", "white-space:pre-wrap", ":focus-visible",
  'html[data-theme="dark"] .postit:not(.ai-review-postit)', ".is-resolved", "prefers-reduced-motion"
]) assert(css.includes(rule), `required visual boundary missing: ${rule}`);
assert(ordinaryCss.includes(".postit:not(.ai-review-postit)"), "ordinary Post-it scope missing");
assert(!ordinaryCss.includes(".ai-review-card"), "AI Review card styling leaked into B3 rules");
for (const forbidden of [".inspector ", ".cw-", "emoji-picker", "node.position", "note.x =", "note.y ="])
  assert(!ordinaryCss.includes(forbidden), `isolated B3 CSS contains ${forbidden}`);
assert(!app.includes("emoji-picker") && !pkg.dependencies?.["emoji-picker"], "emoji picker crossed the B4 boundary");

assert.equal(pkg.scripts["check:bw33.4b3"], "node scripts/check-bw33-4b3-postit-polish.js");
assert(workflow.indexOf("check:bw33.4b3") > workflow.indexOf("check:bw33.4b1r1"));
assert(!pkg.scripts["check:bw33.4b2"] && !workflow.includes("check:bw33.4b2"), "cancelled B2 was registered");
console.log("BW-33.4B3 Post-it polish, localization, counting, geometry, and isolation checks passed.");
