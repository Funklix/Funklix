#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");

const browser = fs.readFileSync("app.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/runtime-boot-safety.yml", "utf8");

function functionBody(name, nextName) {
  const start = browser.indexOf(`function ${name}(`);
  const end = browser.indexOf(`function ${nextName}(`, start);
  assert(start >= 0 && end > start, `could not isolate ${name}`);
  return browser.slice(start, end);
}

const dismiss = functionBody("dismissShareLinkToast", "showShareLinkToast");
const show = functionBody("showShareLinkToast", "saveBoardAsNew");
const render = functionBody("renderOpenShareEditorPanel", "buildShareEditorPanelHtml");
const bind = functionBody("bindShareEditorPanel", "loadBoardEditors");
const load = functionBody("loadBoardEditors", "addBoardEditor");

assert.strictEqual((browser.match(/shareToastOutsidePointerHandler:\s*null/g) || []).length, 1, "one outside-handler state reference is required");
assert.match(dismiss, /removeEventListener\("pointerdown", state\.shareToastOutsidePointerHandler, true\)/);
assert.match(dismiss, /state\.shareToastOutsidePointerHandler = null/);
assert.match(show, /^function showShareLinkToast[^]*?dismissShareLinkToast\(\)/);
assert.strictEqual((show.match(/addEventListener\("pointerdown"/g) || []).length, 1, "open must register one pointer listener");
assert.match(show, /state\.shareToastOutsidePointerHandler = closeOnOutside;\s*document\.addEventListener\("pointerdown", state\.shareToastOutsidePointerHandler, true\)/);
assert.strictEqual((show.match(/removeEventListener/g) || []).length, 0, "outside and timer paths must use centralized dismissal");
assert.match(show, /if \(!toast\.contains\(event\.target\) && event\.target !== el\.copyBoardLinkButton\) \{\s*dismissShareLinkToast\(\)/);
assert.match(show, /setTimeout\(\(\) => \{\s*dismissShareLinkToast\(\)/);

// Exercise the lifecycle contract with a dependency-free event target model.
const listeners = new Set();
let currentToast = null;
let timer = null;
let storedHandler = null;
const dismissModel = () => {
  if (storedHandler) { listeners.delete(storedHandler); storedHandler = null; }
  currentToast = null;
  if (timer) { timer = null; }
};
const openModel = (temporary = false) => {
  dismissModel();
  const toast = { children: new Set(), contains(target) { return target === this || this.children.has(target); } };
  currentToast = toast;
  storedHandler = (event) => { if (!toast.contains(event.target)) dismissModel(); };
  listeners.add(storedHandler);
  if (temporary) timer = () => dismissModel();
  return toast;
};
const fire = (target) => [...listeners].forEach((listener) => listener({ target }));

let toast = openModel();
const email = {}, invite = {}, role = {}, memberRole = {};
[email, invite, role, memberRole].forEach((control) => toast.children.add(control));
[email, role, invite, memberRole].forEach((control) => { fire(control); assert.strictEqual(currentToast, toast, "inside interaction closed toast"); });
assert.strictEqual(listeners.size, 1);
toast = openModel();
assert.strictEqual(listeners.size, 1, "replacement leaked an outside listener");
fire({});
assert.strictEqual(currentToast, null, "outside click did not close");
dismissModel();
assert.strictEqual(listeners.size, 0, "repeated dismissal was not safe");
openModel(true);
timer();
assert.strictEqual(listeners.size, 0, "timer did not clean up listener");

assert.match(bind, /addEventListener\("submit"/);
assert.match(bind, /addEventListener\("change"/);
assert.match(bind, /addEventListener\("click"/);
assert.doesNotMatch(bind + show, /stop(?:Immediate)?Propagation\s*\(/, "child controls must not broadly suppress propagation");
assert.doesNotMatch(load, /addEventListener\("pointerdown"/, "async loading must not register outside listeners");
assert.match(render, /inputValue = previousInput\?\.value/);
assert.match(render, /document\.activeElement === previousInput/);
assert.match(render, /input\.focus\(\)/);
assert.match(render, /input\.setSelectionRange/);
assert.match(workflow, /check-bw18-board-access-roles\.js[^]*check-bw18-share-permissions-popover-lifecycle\.js/);

console.log("BW-18.1 Board permissions popover lifecycle checks passed.");
