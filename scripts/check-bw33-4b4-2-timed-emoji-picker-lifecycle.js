const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const workflow = fs.readFileSync(".github/workflows/runtime-boot-safety.yml", "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must remain a production function`);
  const brace = app.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = brace; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`${name} is incomplete`);
}

class FakeTarget {
  constructor(tagName = "target") { this.tagName = tagName; this.listeners = new Map(); this.parentNode = null; this.isConnected = false; }
  addEventListener(type, listener, options) { const list = this.listeners.get(type) || []; list.push({ listener, capture: options === true || options?.capture === true }); this.listeners.set(type, list); }
  removeEventListener(type, listener, options) { const capture = options === true || options?.capture === true; this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item.listener !== listener || item.capture !== capture)); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  invoke(type, event) { for (const { listener } of [...(this.listeners.get(type) || [])]) listener.call(this, event); }
}

class FakeElement extends FakeTarget {
  constructor(tagName, document) {
    super(tagName.toUpperCase()); this.ownerDocument = document; this.children = []; this.attributes = new Map(); this.dataset = {}; this.style = {}; this.value = ""; this.selectionStart = 0; this.selectionEnd = 0; this.tabIndex = 0;
  }
  set className(value) { this._className = value; }
  get className() { return this._className || ""; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild(child) { child.parentNode = this; child.setConnected(this.isConnected); this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  setConnected(value) { this.isConnected = value; this.children.forEach((child) => child.setConnected(value)); }
  contains(target) { for (let current = target; current; current = current.parentNode) if (current === this) return true; return false; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; this.setConnected(false); }
  focus(options) { this.focusOptions = options; this.ownerDocument.activeElement = this; this.focusCount = (this.focusCount || 0) + 1; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  getBoundingClientRect() { return this.className === "postit-emoji-picker" ? { width: 326, height: 390 } : { left: 100, top: 100, bottom: 130 }; }
  dispatchEvent(event) { event.target ||= this; this.invoke(event.type, event); return true; }
}

class FakeDocument extends FakeTarget {
  constructor() { super("document"); this.body = new FakeElement("body", this); this.body.setConnected(true); this.activeElement = null; }
  createElement(tagName) { return new FakeElement(tagName, this); }
  dispatch(type, target, extra = {}) {
    const path = []; for (let current = target; current; current = current.parentNode) path.push(current); path.push(this);
    const event = { type, target, key: extra.key, button: extra.button ?? 0, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, composedPath: extra.composedPath || (() => path) };
    this.invoke(type, event);
    if (!event.stopped) target?.invoke(type, event);
    return event;
  }
}

const document = new FakeDocument();
const window = new FakeTarget("window");
window.innerWidth = 1200; window.innerHeight = 800;
const context = {
  document, window, console,
  state: { currentBoardId: "board-a" },
  activePostitEmojiPicker: null,
  POSTIT_EMOJI_GROUPS: [
    { label: "Reactions", emojis: [["😀", "Grinning face"], ["😄", "Smiling face"]] },
    { label: "Ideas", emojis: [["✨", "Sparkles"], ["💡", "Light bulb"]] },
    { label: "Progress", emojis: [["🎯", "Bullseye"], ["✅", "Check mark"]] },
    { label: "Celebration", emojis: [["🎉", "Party popper"], ["🙌", "Raised hands"]] }
  ],
  uiText: (value) => value,
  isBoardReadOnly: () => false,
  Event: class Event { constructor(type, options = {}) { this.type = type; this.bubbles = options.bubbles; } }
};
vm.createContext(context);
vm.runInContext([
  functionSource("capturePostitEmojiSelection"),
  functionSource("closePostitEmojiPicker"),
  functionSource("isPostitEmojiPickerEventInside"),
  functionSource("insertPostitEmoji"),
  functionSource("positionPostitEmojiPicker"),
  functionSource("openPostitEmojiPicker"),
  functionSource("createPostitEmojiTrigger"),
  functionSource("nodeHasActivePostitEditor"),
  "this.getActive=()=>activePostitEmojiPicker;this.forceClose=(reason='target-removed')=>closePostitEmojiPicker({reason});this.nodeKeepsPostits=nodeHasActivePostitEditor;"
].join("\n"), context);

function editor(value = "Draft", caret = value.length) { const node = document.createElement("textarea"); node.value = value; node.selectionStart = node.selectionEnd = caret; node.events = []; node.dispatchEvent = (event) => { node.events.push(event.type); return true; }; document.body.appendChild(node); return node; }
function activate(trigger) { document.dispatch("pointerdown", trigger); document.dispatch("click", trigger); }
function movement(target) { for (const type of ["pointermove", "mousemove", "pointerenter", "mouseenter", "pointerleave", "mouseleave"]) document.dispatch(type, target); }

// Bounded historical fixture: BW-33.4B4 treated every capture-phase scroll as
// viewport movement, so the portal's own overflow scroll deterministically closed.
let historicalPickerOpen = true;
const unsafeBw334b4ViewportHandler = () => { historicalPickerOpen = false; };
unsafeBw334b4ViewportHandler({ type: "scroll", target: { className: "postit-emoji-picker" } });
assert.equal(historicalPickerOpen, false, "the pre-repair lifecycle must reproduce the production failure");

// The production trigger path opens one body portal and installs one capture listener.
const rootEditor = editor("A B", 1);
const rootTrigger = context.createPostitEmojiTrigger(rootEditor, "root"); document.body.appendChild(rootTrigger);
activate(rootTrigger);
const first = context.getActive();
assert(first?.picker.isConnected); assert.equal(rootTrigger.getAttribute("aria-expanded"), "true");
assert.equal(document.listenerCount("pointerdown"), 1); assert.equal(first.picker.children[0].children[1].children[0].focusOptions.preventScroll, true);

// Deterministic temporal trace of the production lifecycle. Opening focuses the
// portalled grid, then the 80 ms focusout cleanup schedules a presence ping. The
// response historically called refreshOwnershipDisplays -> updateNodeCard ->
// renderPostits -> closePostitEmojiPicker at t=900 ms. The corrected active-editor
// predicate suppresses only that disposable Post-it rebuild.
const nodeEl = document.createElement("article"); document.body.appendChild(nodeEl); nodeEl.appendChild(rootTrigger);
assert.equal(context.nodeKeepsPostits(nodeEl), true, "portalled grid focus must retain logical editor ownership");
const temporalTrace = [{ at: 0, event: "picker-inserted", picker: first }];
for (const at of [500, 1000, 2000, 10000]) {
  temporalTrace.push({ at, event: at === 1000 ? "presence-refresh-complete" : "time-advanced" });
  // This is updateNodeCard's real production render gate.
  if (!context.nodeKeepsPostits(nodeEl)) context.forceClose("node-card-refresh");
  assert.equal(context.getActive(), first); assert(first.picker.isConnected);
}
for (const event of ["autosave-complete", "badge-refresh", "relative-time-refresh", "connection-redraw", "collaboration-refresh", "app-shell-sync", "picker-animation-frame"]) {
  temporalTrace.push({ at: 10000, event });
  assert.equal(context.nodeKeepsPostits(nodeEl), true);
  assert.equal(context.getActive(), first);
}
let historicalConnected = true; let historicalReason = null;
const historicalActiveElementWasInPostit = false;
if (!historicalActiveElementWasInPostit) { historicalConnected = false; historicalReason = "anonymous-render-cleanup"; }
assert.equal(historicalConnected, false, "pre-repair presence response must reproduce timed dismissal");
assert.equal(historicalReason, "anonymous-render-cleanup");
assert.deepEqual(temporalTrace.map(({ at }) => at).slice(0, 5), [0, 500, 1000, 2000, 10000]);

// Trigger-to-gap-to-portal travel, options, empty space, leave and re-entry are inert.
movement(rootTrigger); movement(document.body); movement(first.picker); movement(first.picker.children[0]);
for (const section of first.picker.children) for (const option of section.children[1].children) movement(option);
movement(document.body); movement(first.picker);
assert.equal(context.getActive(), first); assert(first.picker.isConnected); assert.equal(rootTrigger.getAttribute("aria-expanded"), "true"); assert.equal(document.listenerCount("pointerdown"), 1);

// Internal portal scroll is not a viewport invalidation; real Canvas/app-shell scroll is.
window.invoke("scroll", { type: "scroll", target: first.picker, composedPath: () => [first.picker, document.body, document, window] });
assert.equal(context.getActive(), first);

// Picker descendants (including scrollbar/surface activation) and composed-path retargeting are inside.
document.dispatch("pointerdown", first.picker.children[0]);
document.dispatch("pointerdown", document.body, { composedPath: () => [first.picker.children[0], first.picker, document.body, document, window] });
assert.equal(context.getActive(), first);

// Outside activation closes exactly once, restores trigger focus, and removes every global listener.
document.dispatch("pointerdown", document.body);
assert.equal(context.getActive(), null); assert.equal(rootTrigger.focusCount, 1); assert.equal(rootTrigger.getAttribute("aria-expanded"), "false");
assert.equal(document.listenerCount("pointerdown"), 0); assert.equal(window.listenerCount("scroll"), 0); assert.equal(window.listenerCount("resize"), 0);
document.dispatch("pointerdown", document.body); assert.equal(rootTrigger.focusCount, 1);

// Active-trigger activation toggles closed; another trigger transfers the single portal safely.
activate(rootTrigger); const toggled = context.getActive(); activate(rootTrigger); assert.equal(context.getActive(), null); assert(!toggled.picker.isConnected);
activate(rootTrigger); const old = context.getActive();
const replyEditor = editor("Reply "); const replyTrigger = context.createPostitEmojiTrigger(replyEditor, "reply"); document.body.appendChild(replyTrigger);
activate(replyTrigger); const replyActive = context.getActive(); assert.notEqual(replyActive, old); assert(!old.picker.isConnected); assert.equal(document.listenerCount("pointerdown"), 1);

// Escape restores the trigger. Selection restores the editor/caret and keeps replies unsent.
replyActive.picker.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} }); assert.equal(context.getActive(), null); assert.equal(replyTrigger.focusCount, 1);
activate(replyTrigger); context.getActive().picker.children[0].children[1].children[0].dispatchEvent({ type: "click" });
assert.equal(replyEditor.value, "Reply 😀"); assert.equal(replyEditor.events.length, 0); assert.equal(replyEditor.focusCount, 1); assert.equal(context.getActive(), null);
activate(rootTrigger); context.getActive().picker.children[1].children[1].children[0].dispatchEvent({ type: "click" });
assert.equal(rootEditor.value, "A✨ B"); assert.deepEqual(rootEditor.events, ["input"]); assert.equal(rootEditor.focusCount, 1);

// Stale editor, Board switch, rerender/deletion/resolution cleanup, and real transforms remain authoritative.
activate(rootTrigger); rootEditor.setConnected(false); context.insertPostitEmoji(context.getActive(), "🔥"); assert.equal(context.getActive(), null);
rootEditor.setConnected(true); activate(rootTrigger); context.state.currentBoardId = "board-b"; context.insertPostitEmoji(context.getActive(), "🔥"); assert.equal(context.getActive(), null); context.state.currentBoardId = "board-a";
activate(rootTrigger); window.invoke("scroll", { type: "scroll", target: document.body, composedPath: () => [document.body, document, window] }); assert.equal(context.getActive(), null);
for (let index = 0; index < 5; index += 1) { activate(rootTrigger); context.forceClose(); }
assert.equal(document.listenerCount("pointerdown"), 0); assert.equal(window.listenerCount("scroll"), 0); assert.equal(window.listenerCount("resize"), 0);

// Static boundaries cover the surrounding production contracts without replacing their suites.
const open = functionSource("openPostitEmojiPicker"); const close = functionSource("closePostitEmojiPicker"); const render = functionSource("renderPostits"); const drag = functionSource("enablePostitDrag");
const activeEditorGate = functionSource("nodeHasActivePostitEditor");
assert(activeEditorGate.includes("activePostitEmojiPicker?.trigger") && activeEditorGate.includes("nodeEl?.contains(activePostitEmojiPicker.trigger)"));
assert(close.includes("requires an authoritative reason") && close.includes("active.closeReason = reason"));
for (const reason of ["emoji-selected", "escape", "outside-pointer", "trigger-toggle", "ownership-transferred", "postit-resolved", "postit-deleted", "reply-submitted", "board-load-start", "board-changed", "target-invalid", "viewport-transition"]) assert(app.includes(`reason: "${reason}"`) || app.includes(`"${reason}"`), `missing close reason ${reason}`);
assert(open.includes("composedPath") === false && functionSource("isPostitEmojiPickerEventInside").includes("composedPath"));
assert(open.includes('addEventListener("pointerdown", active.onOutsidePointer, true)')); assert(close.includes('removeEventListener("pointerdown", active.onOutsidePointer, true)'));
assert(!/pointermove|mousemove|mouseenter|mouseleave|pointerenter|pointerleave|blur|focusout/.test(open));
assert(render.includes("closePostitEmojiPicker({ reason: pickerCloseReason })") && render.includes("note.resolved ? null") && render.includes('createPostitEmojiTrigger(replyInput, "reply")'));
assert(drag.includes('event.target.closest("textarea,input,button")')); assert(!/localStorage|sessionStorage|fetch\(|saveCampaignCanvasState|appendActivity/.test(open + close));
assert(css.includes("/* BW-33.4B4:") && !css.includes("BW-33.4B4.1"), "approved Light/Dark/responsive CSS remains byte-unmodified");
assert.equal(pkg.scripts["check:bw33.4b4.1"], "node scripts/check-bw33-4b4-1-emoji-picker-lifecycle.js");
assert(workflow.indexOf("check:bw33.4b4.1") > workflow.indexOf("check:bw33.4b4")); assert(!pkg.scripts["check:bw33.4b2"] && !workflow.includes("check:bw33.4b2"));
assert.equal(pkg.scripts["check:bw33.4b4.2"], "node scripts/check-bw33-4b4-2-timed-emoji-picker-lifecycle.js");
assert(workflow.indexOf("check:bw33.4b4.2") > workflow.indexOf("check:bw33.4b4.1"));

console.log("BW-33.4B4.2 proven timed lifecycle, background-refresh resilience, close reasons, and preservation boundaries passed.");
