#!/usr/bin/env node
'use strict';
const assert=require('assert'); const fs=require('fs');
const workspace=require('../content-workspace.js');
const html=fs.readFileSync('index.html','utf8'), app=fs.readFileSync('app.js','utf8'), css=fs.readFileSync('styles.css','utf8'), workflow=fs.readFileSync('.github/workflows/runtime-boot-safety.yml','utf8');
assert.match(html,/id="content-workspace-nav-btn"/); assert.match(html,/id="content-workspace-view"/); assert.match(html,/id="content-workspace-surface"/); assert.match(html,/content-workspace\.js[\s\S]*app\.js/);
assert.match(app,/setActiveView\("content_workspace"\)/); assert.match(app,/content_workspace: "full"/); assert.match(app,/renderContentWorkspace/); assert.match(app,/state\.nodes/); assert.match(app,/const canvasRevision = JSON\.stringify\(state\.nodes/); assert.match(app,/actionIdentity !== contentWorkspaceIdentity/); assert.doesNotMatch(app,/ContentWorkspace[\s\S]{0,120}(localStorage|sessionStorage|fetch\()/);
assert.ok(workflow.indexOf('check:bw31.1')>workflow.indexOf('check:bw30.1')); assert.match(css,/\.cw-grid/); assert.match(css,/data-theme="dark"/); assert.match(css,/@media\(max-width:720px\)/); assert.match(css,/focus-visible/); assert.match(css,/prefers-reduced-motion/);
assert.deepStrictEqual([...workspace.DEFAULT_ROLES],["Content","Social Media Posting","Landing Page","Email Campaign"]); assert.deepStrictEqual([...workspace.OPTIONAL_ROLES],["Campaign Variation","Visual Concept","Image Brief","Idea"]);
const fixtures=[
 {id:'1',type:'Content',title:'Article',content:'Useful content'},
 {id:'2',type:'Social Media Posting',title:'Post',social:{platform:'LinkedIn',caption:'Learn more https://example.test'}},
 {id:'3',type:'Landing Page',title:'Page',landingPage:{headerClaim:'Claim',problem:'Problem',solution:'Solution',trust:'Proof',cta:'Start'}},
 {id:'4',type:'Email Campaign',title:'Mail',content:'Subject: Hello\nPreview text: Read this\nThis is a complete useful email body with enough detailed campaign information for readers.\nCTA: Learn more'},
 {id:'5',type:'Campaign Variation',title:'Angle',content:'A distinct campaign angle'},
 {id:'6',type:'Visual Concept',title:'Visual',content:'A clear visual concept'},
 {id:'7',type:'Image Brief',title:'Brief',content:'An actionable image brief'},
 {id:'8',type:'Idea',title:'Idea',content:'A meaningful idea'},
];
const snapshot=JSON.stringify(fixtures); const projected=workspace.project(fixtures); assert.equal(projected.length,8); assert.equal(JSON.stringify(fixtures),snapshot,'projection is pure and retains no authority'); projected.forEach(a=>assert.equal(a.readiness.level,'Ready'));
const missing=workspace.calculateReadiness({id:'x',type:'Social Media Posting',title:'x',social:{}}); assert.equal(missing.level,'Incomplete'); assert.deepStrictEqual(missing.issues.map(x=>x.code),['PLATFORM_MISSING','CAPTION_MISSING']);
const withAi={id:'x',type:'Content',title:'x',content:'',aiReview:{score:100}}; assert.equal(workspace.calculateReadiness(withAi).level,'Incomplete','AI Review is independent');
const status=workspace.projectAsset({id:'s',type:'Content',title:'A',content:'B',status:'Published',social:{scheduledDate:'2026-10-01'}}); assert.equal(status.status,'Published'); assert.equal(status.scheduledDate,'2026-10-01'); assert.equal(status.readiness.level,'Ready');
const sorted=workspace.applyView([{id:'z',role:'Content',title:'A',readiness:{level:'Ready'}},{id:'a',role:'Content',title:'A',readiness:{level:'Incomplete'}}],{}); assert.equal(sorted[0].id,'a');
const assets=workspace.project(fixtures.concat([{id:'9',type:'Content',title:'Zulu',content:'body',ownerName:'Ada',language:'de',channel:'Web',funnelStage:'Awareness',status:'Approved'}]));
for(const [key,value] of Object.entries({search:'zulu',role:'Content',platform:'Web',stage:'Awareness',status:'Approved',readiness:'Ready',owner:'Ada',language:'de'})) assert.ok(workspace.applyView(assets,{role:'all',[key]:value}).some(a=>a.id==='9'),`${key} filter`);
assert.equal(workspace.applyView(assets,{role:'all',search:'absent'}).length,0); assert.deepStrictEqual(workspace.applyView(assets,{role:'all',sort:'az'}).map(x=>x.id),workspace.applyView(assets,{role:'all',sort:'az'}).map(x=>x.id),'stable sorting');
const hostile={id:'evil',type:'Content',title:'<img src=x onerror=alert(1)>',content:'<script>alert(1)</script>'}; const host={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null}; const nodes=fixtures.concat([hostile]); const before=JSON.stringify(nodes); const result=workspace.render(host,{language:'en',identity:'i',boardId:'b',boardName:'Board',nodes,canView:true,canOpenInspector:true,canCopy:true,getNode:id=>nodes.find(n=>n.id===id)}); assert.ok(result.filtered.length>=4); assert.ok(host.innerHTML.includes('Content Library')); assert.ok(!host.innerHTML.includes('<script>alert')); assert.equal(JSON.stringify(nodes),before); assert.ok(host.innerHTML.includes('aria-live="polite"')); assert.ok(host.innerHTML.includes('data-cw-open="canvas"')); assert.ok(host.innerHTML.length<60000,'bounded previews');
workspace.render(host,{language:'de',identity:'i',boardId:'b',boardName:'Board',nodes:fixtures,canView:true}); assert.ok(host.innerHTML.includes('Inhaltsbibliothek')); workspace.render(host,{language:'en',identity:'i',boardId:'',nodes:[]}); assert.ok(host.innerHTML.includes('No Board')); workspace.render(host,{language:'en',identity:'i',boardId:'b',nodes:[],loading:true}); assert.ok(host.innerHTML.includes('loading')); workspace.render(host,{language:'en',identity:'i',boardId:'b',nodes:[],canView:false}); assert.ok(host.innerHTML.includes('access'));
for(const forbidden of ['Approve','Request Changes','Publish','Delete','Regenerate','Run AI Review']) assert.ok(!host.innerHTML.includes(`>${forbidden}<`));
console.log('BW-31.1 Content Workspace library regression passed (read-only projection, readiness, filters, lifecycle, locale, theme and responsive contracts).');
