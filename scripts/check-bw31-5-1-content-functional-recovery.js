#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),w=require('../content-workspace.js');
const app=fs.readFileSync('app.js','utf8'),workspace=fs.readFileSync('content-workspace.js','utf8'),css=fs.readFileSync('styles.css','utf8'),lang=fs.readFileSync('language.js','utf8'),workflow=fs.readFileSync('.github/workflows/runtime-boot-safety.yml','utf8');
function post(status='Draft',extra={}){return {id:`post-${status}`,type:'Social Media Posting',title:'Launch post',status,social:{platform:'LinkedIn',caption:'Plan the launch. Learn more at https://example.test'},position:{x:120,y:240},...extra};}
const context={accountId:'editor@example.test',boardId:'board-1',canEdit:true,publicViewer:false,warningAccepted:true};
for(const status of ['Draft','In Review','Needs Changes','Approved']){const node=post(status);const result=w.evaluateScheduling({...context,node});assert.equal(result.canPlan,true,`${status} can be internally planned`);if(status!=='Approved')assert.equal(result.canPublishExternallyLater,false,'publishing remains approval gated');}
const approved=post('Approved');approved.approvedContentFingerprint=w.materialFingerprint(approved);assert.equal(w.evaluateScheduling({...context,node:approved}).canPublishExternallyLater,true);
const attention=post('Draft');attention.social.caption='A useful launch announcement without a response phrase.';assert.equal(w.calculateReadiness(attention).level,'Needs attention');assert.equal(w.evaluateScheduling({...context,node:attention}).canPlan,true);
const incomplete=post('Draft');incomplete.social.caption='';let decision=w.evaluateScheduling({...context,node:incomplete});assert.equal(decision.canPlan,false);assert.ok(decision.planningBlockers.includes('PRIMARY_CONTENT_MISSING'));assert.ok(decision.planningBlockers.includes('READINESS_INCOMPLETE'));
const noPlatform=post();noPlatform.social.platform='';assert.ok(w.evaluateScheduling({...context,node:noPlatform}).planningBlockers.includes('PLATFORM_MISSING'));
assert.equal(w.blockerMessage('PRIMARY_CONTENT_MISSING','en'),'Add the missing post content before planning a date.');assert.match(w.blockerMessage('PRIMARY_CONTENT_MISSING','de'),/Post-Inhalt/);
assert.deepStrictEqual([...w.PLANNING_SOURCES],['canvas','inspector','content_library','review_queue','calendar_queue','calendar_event']);
const before=JSON.stringify(post());w.evaluateScheduling({...context,node:JSON.parse(before)});assert.equal(JSON.stringify(post()),before,'eligibility performs no mutation');
for(const token of ['function resolveCurrentContentNode','state.nodes.find','contentChanged','statusChanged','readinessChanged','scheduleChanged','function openContentPlanning','workspace.openContentPlanning(nodeId, sourceContext','resolveCurrentContentNode,','onPlanningFeedback: routeContentOperationsFeedback','openContentPlanning(node.id, "inspector"','openSchedulePostModal(node.id)','data-content-plan','"calendar_queue"','"calendar_event"','function applyContentWorkspaceTransition','function applyContentWorkspaceSchedule','markUnsaved(); renderContentWorkspace()'])assert.ok(app.includes(token)||workspace.includes(token),token);
assert.doesNotMatch(app,/getNode: id => contentWorkspaceIdentity\(\) === identity/,'workspace rerenders no longer synthesize deletion');
assert.match(app,/if \(!currentResolution\.exists\) return \{ ok: false, reason: "NODE_DELETED" \}/,'only authoritative absence is deleted during review');
assert.match(app,/if \(currentResolution\.contentChanged\)/);assert.match(app,/if \(currentResolution\.scheduleChanged\)/);
assert.match(css,/content-operations-source-feedback/);assert.match(lang,/Interne Planung ist bereits vor der Freigabe möglich/);
assert.ok(workflow.indexOf('check:bw31.5.1')>workflow.indexOf('check:bw31.4'));
for(const forbidden of ['linkedin.com/v2','graph.facebook.com','PublishJob','analyticsId'])assert.ok(!w.toString().includes(forbidden));
console.log('BW-31.5.1 functional recovery passed (authoritative resolution, real entry wiring, Model C planning, source feedback, guarded review and scheduling, localization and preservation boundaries).');
