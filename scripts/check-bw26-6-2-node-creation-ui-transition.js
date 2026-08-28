'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/runtime-boot-safety.yml'), 'utf8');

const sliceFunction = (name, nextName) => {
  const start = app.indexOf(`function ${name}`);
  const end = nextName ? app.indexOf(`function ${nextName}`, start + 1) : app.length;
  assert(start >= 0 && end > start, `${name} must exist`);
  return app.slice(start, end);
};
const includes = (source, values, label) => values.forEach((value) => assert(source.includes(value), `${label}: ${value}`));
const excludes = (source, values, label) => values.forEach((value) => assert(!source.includes(value), `${label}: ${value}`));

const prepare = sliceFunction('requestAiBrainNodeProposal', 'appendAiBrainInline');
const cancel = sliceFunction('cancelAiBrainNodeProposal', 'requestAiBrainNodeProposal');
const apply = sliceFunction('applyAiBrainNodeProposal', 'currentInsightsIdentity');
const transition = sliceFunction('completeAiBrainNodeCreation', 'applyAiBrainNodeProposal');
const reveal = sliceFunction('revealAiBrainCreatedNode', 'completeAiBrainNodeCreation');

// Preparing, previewing, cancellation, and every pre-mutation failure remain in AI Brain.
excludes(prepare, ['completeAiBrainNodeCreation(', 'campaignCanvasNavButton?.click()'], 'preparation stays in AI Brain');
includes(prepare, ['status: "requesting"', 'status: "ready"', 'status: "failed"', 'status: "stale"', 'renderAiBrain()'], 'proposal lifecycle');
includes(cancel, ['status: "cancelled"', 'renderAiBrain()'], 'cancel lifecycle');
excludes(cancel, ['completeAiBrainNodeCreation(', 'setActiveView("board")'], 'cancel stays in AI Brain');
includes(app, ['errorCode: "permission"', 'errorCode: "board"', 'errorCode: "canvas"', 'errorCode: "invalid"'], 'safe stale and failure states');

// The mutation boundary remains explicit, authorized, single-shot, and consumed before navigation.
includes(apply, ['proposal?.status !== "ready"', 'canUseAiBrainProposal()', 'proposal.status = "applying"', 'appliedProposalIds.add', 'pushHistorySnapshot()', 'node = createNode(', 'const createdNodeId = node.id', 'status: "applied"', 'data: null', 'completeAiBrainNodeCreation(createdNodeId'], 'successful application');
assert.strictEqual((apply.match(/node = createNode\(/g) || []).length, 1, 'confirmation has exactly one createNode invocation');
assert.strictEqual((apply.match(/pushHistorySnapshot\(\)/g) || []).length, 1, 'confirmation has exactly one undo snapshot');
assert.strictEqual((apply.match(/markUnsaved\(\)/g) || []).length, 1, 'confirmation has exactly one dirty transition');
excludes(apply, ['scheduleAutosave(', 'saveBoardToServer(', 'fitBoardContentToViewport('], 'no extra autosave or fit operation');
assert(apply.indexOf('status: "applied"') < apply.indexOf('completeAiBrainNodeCreation(createdNodeId'), 'proposal is consumed before leaving AI Brain');
includes(apply, ['state.aiBrain.appliedProposalIds.delete', 'state.history.length = historyLength', 'status: "failed"'], 'pre-mutation failure remains retry-safe');
includes(apply, ['createdNode = node || state.nodes.find', 'status: "applied"', 'completeAiBrainNodeCreation(createdNode.id'], 'post-mutation failure stays consumed and recovers existing node');

// Canonical Canvas navigation closes AI Brain; selection and inspector are restored afterwards.
includes(transition, ['campaignCanvasNavButton?.click()', 'requestAnimationFrame(selectCreatedNode)', 'state.selectedIds.clear()', 'state.selectedIds.add(nodeId)', 'state.selectedPrimary = nodeId', 'fillInspector(node)', 'revealAiBrainCreatedNode(nodeId)', 'el.inputs?.title', 'preventScroll: true'], 'post-layout Canvas transition');
assert(transition.indexOf('campaignCanvasNavButton?.click()') < transition.indexOf('requestAnimationFrame(selectCreatedNode)'), 'layout changes before viewport measurement');
excludes(transition, ['createNode(', 'pushHistorySnapshot(', 'markUnsaved(', 'scheduleAutosave(', 'invalidateAiBrainRequest('], 'transition is UI-only and transcript-neutral');

// Reveal uses actual post-close bounds, pans minimally, and never changes zoom or node coordinates.
includes(reveal, ['el.canvas.getBoundingClientRect()', 'el.inspectorPanel', 'inspectorRect.left', 'el.canvasTopbar', 'toolbarRect.bottom', 'nodeEl.getBoundingClientRect()', 'if (deltaX || deltaY)', 'el.canvas.scrollTo'], 'available Canvas reveal');
excludes(reveal, ['state.zoom =', 'setZoom(', 'applyCanvasZoom(', 'fitBoardContentToViewport(', 'node.position', 'updateNodeCard('], 'reveal preserves zoom and positions');

// Localized visible/accessibility feedback and honest advisor labeling.
includes(app, ['creationAnnouncement: "Content node created."', 'creationAnnouncement: "Content-Node wurde erstellt."', 'advisor: "Advisor"', 'advisor: "Berater"', 'setSaveStatus(aiBrainProposalText("creationAnnouncement"', '${aiBrainProposalText("advisor")}'], 'localized success and advisor copy');

// Registration order is part of Runtime Boot Safety.
assert.strictEqual(pkg.scripts['check:bw26.6.2'], 'node scripts/check-bw26-6-2-node-creation-ui-transition.js');
const previous = workflow.indexOf('check-bw26-6-1-node-proposal-production-failure.js');
const current = workflow.indexOf('check-bw26-6-2-node-creation-ui-transition.js');
assert(previous >= 0 && current > previous, 'BW-26.6.2 follows BW-26.6.1 in Runtime Boot Safety');

console.log('BW-26.6.2 AI Brain node-creation UI transition checks passed.');
