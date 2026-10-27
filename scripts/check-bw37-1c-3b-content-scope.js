'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./fixtures/bw37-1c3a-proposal-runtime');
process.env.AUTH_SECRET='fictional-scope-secret';process.env.OPENAI_API_KEY='mock-provider';
const original=global.fetch;let calls=0;
global.fetch=async()=>{calls++;return new Response(JSON.stringify({output_text:JSON.stringify({node_type:'Content',title:'Creative invitation',body:'Share the story behind your work.'})}));};
async function prepared() { const r=fixture();const out=await r.invoke();assert.equal(out.statusCode,200);assert.match(out.body.scope_revision,/^[a-f0-9]{64}$/);return {r,body:{board_id:r.request.board_id,expected_scope:r.request.expected_scope,scope_revision:out.body.scope_revision}}; }
async function main() {
 for(const role of ['owner','editor','brand_viewer_editor']) {
  const {r,body}=await prepared();
  // Role changes after preparation must invalidate, even when still editable.
  if(role!=='owner'){r.user={email:'editor@example.test'};r.identity.canonical_email=r.user.email;r.role='editor';r.brandRole=role==='brand_viewer_editor'?'viewer':null;const out=await r.invoke();assert.equal(out.statusCode,200);body.scope_revision=out.body.scope_revision;}
  const n=calls;const out=await r.invoke(body,'POST',r.scopeHandler);assert.equal(out.statusCode,200);assert.equal(calls,n);assert.equal(out.body.scope_revision,body.scope_revision);
 }
 const mutations=[r=>{r.user={email:'viewer@example.test'};r.identity.canonical_email=r.user.email;r.role='viewer';},r=>r.user=null,r=>{r.user={email:'stranger@example.test'};r.identity.canonical_email=r.user.email;},r=>r.membership.status='revoked',r=>r.identity.status='disabled',r=>r.identity.revision='2',r=>r.workspace.revision='2',r=>r.workspace.status='disabled',r=>r.board.updated_at='2026-10-28',r=>r.board.brand_id=null,r=>r.board.workspace_id=null,r=>r.association.workspace_id=null,r=>r.board.owner_email='different@example.test',r=>r.before=()=>{throw Error('INTERNAL_SECRET');}];
 for(const mutate of mutations) {
  const {r,body}=await prepared();mutate(r);const n=calls;const out=await r.invoke(body,'POST',r.scopeHandler);assert([401,403,409,503].includes(out.statusCode),String(mutate));assert.equal(calls,n);assert(!JSON.stringify(out.body).includes('INTERNAL_SECRET'));
 }
 const {r,body}=await prepared();r.before=n=>{if(n===5)r.membership.status='revoked';};assert.equal((await r.invoke(body,'POST',r.scopeHandler)).statusCode,409);
 for(const bad of [{...body,extra:true},{...body,scope_revision:'invalid'},{...body,expected_scope:{}},null])assert.equal((await r.invoke(bad,'POST',r.scopeHandler)).statusCode,400);
 assert.equal((await r.invoke(body,'GET',r.scopeHandler)).statusCode,405);
 const maintenance=await prepared(),maintenanceBefore=process.env.TENDRA_WRITE_MAINTENANCE,n=calls;
 process.env.TENDRA_WRITE_MAINTENANCE='true';
 try{assert.equal((await maintenance.r.invoke(maintenance.body,'POST',maintenance.r.scopeHandler)).statusCode,200);maintenance.r.user=null;assert.equal((await maintenance.r.invoke(maintenance.body,'POST',maintenance.r.scopeHandler)).statusCode,401);assert.equal(calls,n);}finally{if(maintenanceBefore===undefined)delete process.env.TENDRA_WRITE_MAINTENANCE;else process.env.TENDRA_WRITE_MAINTENANCE=maintenanceBefore;}
 console.log('PASS actual signed Create scope route: owner/editor, independent Brand roles, zero provider calls, revoked access/identity/Workspace/association/revision and unavailable-read rejection');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>global.fetch=original);
