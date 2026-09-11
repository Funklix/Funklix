#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const languageSource = fs.readFileSync("language.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/runtime-boot-safety.yml", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
function functionSource(name) {
  const start = app.indexOf(`function ${name}(`); assert(start >= 0, `${name} missing`);
  const brace = app.indexOf("{", start); let depth = 0;
  for (let i = brace; i < app.length; i++) { if (app[i] === "{") depth++; if (app[i] === "}" && --depth === 0) return app.slice(start, i + 1); }
  throw new Error(`${name} incomplete`);
}
// Execute the production caret algorithm against textarea-like controls.
const context = { state: { currentBoardId: "board-a" }, Event: class Event { constructor(type, options) { this.type=type; this.bubbles=options?.bubbles; } }, closePostitEmojiPicker() {} };
vm.createContext(context);
vm.runInContext(`${functionSource("capturePostitEmojiSelection")};${functionSource("insertPostitEmoji")};this.capture=capturePostitEmojiSelection;this.insert=insertPostitEmoji;`, context);
function editor(value, start, end) { return { value, selectionStart:start, selectionEnd:end, isConnected:true, focused:false, events:[], focus(){this.focused=true;}, setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}, dispatchEvent(e){this.events.push(e.type);} }; }
for (const [value,start,end,emoji,expected,caret] of [["",0,0,"🔥","🔥",2],["Hi",0,0,"😀","😀Hi",2],["Hi",1,1,"😀","H😀i",3],["Hi",2,2,"😀","Hi😀",4],["hello",1,4,"✅","h✅o",2],["a\nb",1,1,"🚀","a🚀\nb",3]]) {
  const target=editor(value,start,end); context.insert({ editor:target,trigger:{isConnected:true},boardId:"board-a",selection:context.capture(target),kind:"root" },emoji);
  assert.equal(target.value,expected); assert.equal(target.selectionStart,caret); assert(target.focused); assert.deepEqual(target.events,["input"]);
}
const stale=editor("safe",99,-4); const clamped=context.capture(stale); assert.equal(clamped.start,4); assert.equal(clamped.end,4);
const reply=editor("Draft ",6,6); context.insert({editor:reply,trigger:{isConnected:true},boardId:"board-a",selection:context.capture(reply),kind:"reply"},"🙌"); assert.equal(reply.value,"Draft 🙌"); assert.deepEqual(reply.events,[]);
const disconnected=editor("safe",0,0); disconnected.isConnected=false; context.insert({editor:disconnected,trigger:{isConnected:true},boardId:"board-a",selection:{start:0,end:0},kind:"root"},"🔥"); assert.equal(disconnected.value,"safe");
const render=functionSource("renderPostits"), open=functionSource("openPostitEmojiPicker"), drag=functionSource("enablePostitDrag");
assert(render.includes('createPostitEmojiTrigger(postit.querySelector(".postit-text"), "root")'));
assert(render.includes('editor.insertBefore(createPostitEmojiTrigger(replyInput, "reply"), sendReply)'));
assert(render.includes("note.resolved ? null") && render.includes("if (emojiTrigger)"));
assert(render.indexOf("if (parsedAiReview") > render.indexOf("if (!isAiReviewNote)"), "ordinary-only root ownership retained");
assert(open.includes('document.body.appendChild(picker)') && open.includes('role", "dialog') && open.includes('role", "grid') && open.includes('aria-hidden'));
for (const key of ["ArrowRight","ArrowLeft","ArrowDown","ArrowUp","Home","End","Escape"]) assert(open.includes(key));
assert(open.includes("activePostitEmojiPicker") && app.includes("activePostitEmojiPicker = null"));
assert(!/localStorage|sessionStorage|fetch\(/.test(open), "opening is storage/network free");
assert(drag.includes('event.target.closest("textarea,input,button")'), "button drag guard retained");
assert(render.includes("sendReply.addEventListener") && render.includes('editor.querySelector(".postit-reply-input").value.trim()') && render.includes("note.replies.push"), "established Send path retained");
assert(!functionSource("insertPostitEmoji").includes("note.postits") && !functionSource("insertPostitEmoji").includes("saveCampaignCanvasState"));
const languageContext={window:{},localStorage:{getItem:()=>null,setItem(){}}}; vm.createContext(languageContext); vm.runInContext(languageSource,languageContext); const lang=languageContext.window.FunklixLanguage;
for(const key of ["Add emoji to Post-it","Add emoji to reply","Emoji picker","Reactions","Ideas","Progress","Celebration",...[[...app.slice(app.indexOf("const POSTIT_EMOJI_GROUPS"), app.indexOf("const state =")).matchAll(/\["[^"\n]+", "([^"\n]+)"\]/g)].map(m=>m[1])].flat()]) { assert(lang.t(key,"en")); assert.notEqual(lang.t(key,"de"),key,`German missing: ${key}`); }
const boundary=css.slice(css.indexOf("/* BW-33.4B4"),css.indexOf("/* End BW-33.4B4")); assert(boundary.includes('data-theme="dark"')&&boundary.includes("prefers-reduced-motion")&&boundary.includes("max-width:420px")&&boundary.includes(":focus-visible")); assert(!boundary.includes(".ai-review-postit ")&&!/(^|[},]\s*)button\s*[{,:]/m.test(boundary));
assert.equal(pkg.scripts["check:bw33.4b4"],"node scripts/check-bw33-4b4-postit-emoji-picker.js"); assert(workflow.indexOf("check:bw33.4b4")>workflow.indexOf("check:bw33.4b3.1")); assert(!pkg.scripts["check:bw33.4b2"]&&!workflow.includes("check:bw33.4b2"));
assert.equal(Object.keys(pkg.dependencies||{}).filter(k=>/emoji/i.test(k)).length,0);
for(const frozen of ["selectCanvasNode","fillInspector","synchronizeAppShell"]) assert(functionSource(frozen).length>0);
console.log("BW-33.4B4 production caret, picker lifecycle, accessibility, localization, isolation, and persistence boundaries passed.");
