#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const workspace = require('../content-workspace.js');
const publishing = require('../api/social-connector/linkedin-publishing');

const app = fs.readFileSync('app.js', 'utf8');
const ui = fs.readFileSync('content-workspace.js', 'utf8');
const language = fs.readFileSync('language.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const workflow = fs.readFileSync('.github/workflows/runtime-boot-safety.yml', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const post = () => ({ id: 'linkedin-approved', type: 'Social Media Posting', title: 'Launch', content: 'internal note', status: 'Approved', social: { platform: 'LinkedIn', caption: 'Authoritative launch caption 🌍', cta: 'Learn more' }, planningSchedule: { version: 1 }, comments: [{ id: 'comment' }], postits: [{ id: 'postit' }], externalPosts: [{ id: 'existing' }], position: { x: 20, y: 40 } });
const context = { language: 'en', identity: 'owner|board', accountId: 'owner@example.test', boardId: 'board-1', accessGeneration: 1, canView: true, canEdit: true, publicViewer: false };
const host = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {} };

let node = post();
node.approvedContentFingerprint = workspace.materialFingerprint(node);
assert.equal(workspace.projectAsset(node).approvalChanged, false, 'matching approval is current');
const browserFingerprint = workspace.materialFingerprint(node);
assert.equal(browserFingerprint, publishing.materialFingerprint(node), 'editorial and publishing fingerprints are executable equivalents');
const preservedFingerprint = browserFingerprint;
node.position.x = 999; node.comments.push({ id: 'presentation' }); node.postits.push({ id: 'note' }); node.aiReview = { score: 1 };
assert.equal(workspace.materialFingerprint(node), preservedFingerprint, 'presentation, comments, Post-its and AI Review are excluded');
node.social.caption += ' changed';
assert.equal(workspace.projectAsset(node).approvalChanged, true, 'material caption changes invalidate approval');

workspace.resetCalendar();
workspace.render(host, { ...context, nodes: [node], getNode: () => node });
assert.match(host.innerHTML, /This content has changed since approval\. Approve the current version before publishing\./);
assert.match(host.innerHTML, /Reopen for review/);
assert.match(host.innerHTML, /data-cw-transition="Draft"[^>]*>Reopen as draft/);
assert.match(host.innerHTML, /role="status" aria-live="polite"[^>]*data-cw-stale-node="linkedin-approved"/);
assert.doesNotMatch(host.innerHTML, />approval_stale</, 'internal code is never rendered');
workspace.render(host, { ...context, language: 'de', nodes: [node], getNode: () => node });
assert.match(host.innerHTML, /Dieser Inhalt wurde seit der Freigabe verändert\. Gib die aktuelle Version vor der Veröffentlichung erneut frei\./);
assert.match(host.innerHTML, /Erneut prüfen/); assert.match(host.innerHTML, /Als Entwurf erneut öffnen/);
for (const projection of [{ canEdit: false, readOnly: true }, { canEdit: false, readOnly: true, publicViewer: true }]) {
  workspace.render(host, { ...context, ...projection, nodes: [node], getNode: () => node });
  assert.doesNotMatch(host.innerHTML, /data-cw-transition="Draft"/, 'viewer projections have no reopen action');
}
const reopen = workspace.evaluateTransition({ currentStatus: 'Approved', toStatus: 'Draft', readiness: workspace.calculateReadiness(node), canEdit: true, accountId: context.accountId, boardId: context.boardId, nodeExists: true });
assert(reopen.allowedTransitions.includes('Draft')); assert.equal(reopen.confirmationRequired, true);
assert(workspace.evaluateTransition({ currentStatus: 'Draft', toStatus: 'In Review', readiness: 'Ready', canEdit: true, accountId: 'a', boardId: 'b', nodeExists: true }).allowedTransitions.includes('In Review'));
assert(workspace.evaluateTransition({ currentStatus: 'In Review', toStatus: 'Approved', readiness: 'Ready', canEdit: true, accountId: 'a', boardId: 'b', nodeExists: true }).allowedTransitions.includes('Approved'));

for (const token of ['function applyContentWorkspaceTransition', 'resolveCurrentContentNode(prepared.nodeId, prepared)', 'workspace.evaluateTransition({ currentStatus: node.status', 'requestAuthoritativeContentApproval', 'delete node.approvedContentFingerprint', 'recordStatusChangedActivity(node', 'updateNodeCard(node)', 'fillInspector(node)', 'updateListView()', 'markUnsaved()', 'window.FunklixContentWorkspace.openTransition(node.id, "Draft", el.inputs.status)']) assert(app.includes(token), token);
assert.match(ui, /if\(ev\.key==="Escape"\).*close\(\)/s, 'Escape cancels transition');
assert.match(ui, /data-dialog-cancel/); assert.match(ui, /confirmationRequired/);
assert.match(ui, /preflight\?\.status==="approval_stale"/); assert.match(ui, /feedback\(host,t\.approvalChanged\)/);
assert.match(ui, /onPublish\?\./); assert.match(ui, /data-publish-confirm/); assert.match(ui, /preflight\.caption/); assert.match(ui, /preflight\.profileDisplayName/); assert.match(ui, /preflight\.characterCount/); assert.match(ui, /publishPublic/);
assert(ui.indexOf('c.onPublish?.') > ui.indexOf('data-publish-confirm'), 'provider writer is only bound inside confirmation dialog');
assert.match(language, /"Reopen for review": "Erneut prüfen"/); assert.match(css, /data-theme="dark"/); assert.match(css, /@media\(max-width:720px\)/);
assert.equal(pkg.scripts['check:bw32.3.2'], 'node scripts/check-bw32-3-2-stale-approval-recovery.js');
assert.equal((workflow.match(/check:bw32\.3\.2/g) || []).length, 1); assert(workflow.indexOf('check:bw32.3.2') > workflow.indexOf('check:bw32.3.1'));
assert(!ui.includes('linkedin.com'), 'browser regression never contacts LinkedIn');
console.log('BW-32.3.2 stale approval recovery passed (localized recovery, guarded deliberate transition, fingerprint equivalence, Inspector parity, confirmation-only publishing; zero LinkedIn calls).');
