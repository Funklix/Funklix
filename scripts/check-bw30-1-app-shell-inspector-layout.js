'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

function classList(initial = []) {
  const values = new Set(initial);
  return {
    contains: value => values.has(value),
    toggle(value, force) { if (force === undefined ? !values.has(value) : force) values.add(value); else values.delete(value); },
    add: value => values.add(value),
    remove: value => values.delete(value)
  };
}
const shell = { dataset: {}, classList: classList() };
const inspector = {
  classList: classList(),
  attributes: {},
  contains(node) { return node === this.focusedChild; },
  setAttribute(name, value) { this.attributes[name] = value; },
  toggleAttribute(name, value) { this.attributes[name] = !!value; }
};
const canvas = { focused: false, focus() { this.focused = true; } };
const nodeElement = { dataset: { id: 'node-1' }, focused: false, focus() { this.focused = true; } };
let wide = true;
const context = {
  state: {
    activeView: 'home', appMode: 'canvas', publicBoardToken: null,
    nodes: [{ id: 'node-1' }], selectedIds: new Set(), selectedPrimary: null,
    inspectorDismissedNodeId: null, inspectorSelectionSnapshot: null
  },
  el: {
    appShell: shell, inspectorPanel: inspector, canvas,
    zoomLayer: { querySelectorAll: () => [nodeElement] }
  },
  getNode: null,
  window: { matchMedia: () => ({ matches: wide }) },
  document: { body: { classList: classList() }, activeElement: null }
};
context.getNode = id => context.state.nodes.find(node => node.id === id) || null;
vm.createContext(context);
const contractStart = appSource.indexOf('const SHELL_LAYOUT_BY_VIEW');
const contractEnd = appSource.indexOf('function setActiveView', contractStart);
assert.ok(contractStart > 0 && contractEnd > contractStart, 'authoritative shell lifecycle is present');
vm.runInContext(appSource.slice(contractStart, contractEnd), context);

assert.match(html, /class="app-shell"[^>]+data-active-view=/, 'existing shell has additive bounded state');
for (const id of ['canvas', 'inspector-panel']) assert.match(html, new RegExp(`id="${id}"`), `existing #${id} remains`);
assert.match(css, /data-active-view="board".*data-inspector-supported="true".*data-inspector-open="true".*data-inspector-mode="column"/s);
assert.doesNotMatch(css, /grid-template-columns:\s*var\(--sidebar-width\)\s+minmax\(0,\s*1fr\)\s+340px/);

const noInspectorViews = [
  ['home', 'full'], ['boards_library', 'full'], ['list', 'full'], ['calendar', 'full'],
  ['content_workspace', 'full'], ['brand-core', 'contained'], ['ai_brain', 'contained'],
  ['insights', 'reading'], ['funnel_simulator', 'contained'], ['settings', 'contained']
];
for (const [view, layout] of noInspectorViews) {
  context.synchronizeAppShell({ view });
  assert.strictEqual(shell.dataset.layoutMode, layout, `${view} layout`);
  assert.strictEqual(shell.dataset.inspectorSupported, 'false', `${view} does not support Inspector`);
  assert.strictEqual(shell.dataset.inspectorOpen, 'false', `${view} reserves no Inspector width`);
  assert.strictEqual(inspector.attributes['aria-hidden'], 'true');
  assert.strictEqual(inspector.attributes.inert, true, 'hidden Inspector is removed from focus order');
}

context.state.activeView = 'board';
context.synchronizeAppShell();
assert.deepStrictEqual(
  [shell.dataset.layoutMode, shell.dataset.inspectorSupported, shell.dataset.inspectorOpen, shell.dataset.inspectorMode],
  ['canvas', 'true', 'false', 'closed'],
  'Canvas without a selection uses all width'
);
context.state.selectedPrimary = 'node-1';
context.state.selectedIds.add('node-1');
context.synchronizeAppShell();
assert.strictEqual(shell.dataset.inspectorOpen, 'true');
assert.strictEqual(shell.dataset.inspectorMode, 'column', 'desktop uses dedicated column');
assert.strictEqual(inspector.attributes.inert, false);
const originalNodes = JSON.stringify(context.state.nodes);
const originalSelected = context.state.selectedPrimary;
context.synchronizeAppShell({ view: 'insights' });
assert.strictEqual(shell.dataset.inspectorOpen, 'false', 'leaving Canvas closes Inspector');
assert.strictEqual(context.state.selectedPrimary, originalSelected, 'selection identity is preserved');
assert.strictEqual(JSON.stringify(context.state.nodes), originalNodes, 'layout transition does not mutate node data');

context.synchronizeAppShell({ view: 'board' });
assert.strictEqual(shell.dataset.inspectorOpen, 'true', 'returning to Canvas restores valid selection');
context.closeInspector({ restoreFocus: false });
assert.strictEqual(shell.dataset.inspectorOpen, 'false', 'explicit close removes reservation');
context.state.selectedPrimary = null;
context.synchronizeAppShell();
context.state.selectedPrimary = 'node-1';
context.synchronizeAppShell({ forceInspectorOpen: true });
assert.strictEqual(shell.dataset.inspectorOpen, 'true', 'Show on Canvas can explicitly open valid selection');

wide = false;
context.synchronizeAppShell();
assert.strictEqual(shell.dataset.inspectorMode, 'overlay', 'tablet/mobile use overlay without a grid track');
inspector.focusedChild = { id: 'field' };
context.document.activeElement = inspector.focusedChild;
context.closeInspector();
assert.ok(nodeElement.focused || canvas.focused, 'overlay close restores Canvas focus');

context.state.nodes = [];
context.state.selectedPrimary = 'deleted-node';
context.state.selectedIds.add('deleted-node');
context.synchronizeAppShell({ view: 'board', forceInspectorOpen: true });
assert.strictEqual(shell.dataset.inspectorOpen, 'false', 'stale selection never opens an empty column');
assert.strictEqual(context.state.selectedPrimary, null);

context.state.publicBoardToken = 'public';
context.state.nodes = [{ id: 'node-1' }];
context.state.selectedPrimary = 'node-1';
context.synchronizeAppShell({ view: 'board' });
assert.strictEqual(shell.dataset.activeView, 'public_viewer');
assert.strictEqual(shell.dataset.inspectorOpen, 'false', 'Public Viewer has full width');

assert.match(css, /\.topbar[\s\S]*?flex:\s*0 0 auto/, 'toolbar cannot shrink');
assert.match(css, /\.inspector-content[\s\S]*?overflow-y:\s*auto/, 'open Inspector owns its scrolling');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'reduced motion is honored');
assert.match(css, /max-width:\s*1023px/, 'tablet overlay breakpoint exists');
assert.match(css, /max-width:\s*767px/, 'mobile full-width breakpoint exists');
assert.match(appSource, /onShowCanvas\(nodeId\).*setActiveView\("board"\).*focusNodeInCanvas/s, 'Simulator Show on Canvas uses canonical selection');
assert.match(appSource, /completeAiBrainNodeCreation[\s\S]*?campaignCanvasNavButton/s, 'AI Brain handoff remains canonical');
assert.match(appSource, /if \(e\.key === "Escape"\)[\s\S]*?closeInspector/, 'Escape closes overlay Inspector');
for (const preserved of ['NODE_WIDTH', 'NODE_HEIGHT', 'addNodeButton', 'filtersToggleButton', 'utilitiesToggleButton']) {
  assert.ok(appSource.includes(preserved), `${preserved} remains available`);
}
assert.ok(html.includes('data-theme') || fs.readFileSync('theme.js', 'utf8').includes('data-theme'), 'Light/Dark theme contract remains');
assert.ok(fs.readFileSync('language.js', 'utf8').includes('de'), 'German language support remains');

console.log('BW-30.1 App Shell and Inspector runtime transition checks passed.');
