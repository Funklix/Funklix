'use strict';
const assert = require('node:assert/strict');
const {fixture, BOARD, BRAND, WORKSPACE} = require('./fixtures/bw37-1c3a-proposal-runtime');
const good = {node_type:'Content',title:'A useful invitation',body:'Share the story behind your work with the creative community.',rationale:'A focused asset.'};
const originalFetch = global.fetch, originalWarn = console.warn, originalError = console.error;
process.env.AUTH_SECRET='fictional-content-proposal-secret';process.env.OPENAI_API_KEY='mock-provider';
const logs=[]; console.warn=(...args)=>logs.push(args); console.error=(...args)=>logs.push(args);
let active, transport;
global.fetch = async (url, options) => { assert.equal(url,'https://api.openai.com/v1/responses'); active.calls.push(JSON.parse(options.body));return transport(options); };
const response = (value=good) => new Response(JSON.stringify({output_text:JSON.stringify(value)}),{headers:{'Content-Type':'application/json'}});
async function run(setup=()=>{}, status=200, body=null) {
  active=fixture(); transport=async()=>response(); await setup(active);
  const result=await active.invoke(body||active.request); assert.equal(result.statusCode,status,JSON.stringify(result.body));
  assert(!JSON.stringify(result.body).includes('INTERNAL_SECRET')); return {r:active,result};
}
async function main() {
  // Actual old projection reproduces the bug. The fixture does not hand the ACL
  // a canned full row when SQL requested fewer columns.
  active=fixture();active.user={email:'stranger@example.test'};
  assert.equal((await active.access.getBoardAccess(BOARD,active.user,{columns:'id, updated_at'})).access.role,'unowned');
  assert.equal((await active.access.getBoardAccess(BOARD,active.user,{columns:'id, owner_id, owner_email'})).access.canEdit,false);
  for(const who of ['owner','editor','brand_viewer_editor','brand_editor']) {
    const {r,result}=await run(r=>{if(who!=='owner'){r.user={email:'editor@example.test'};r.identity.canonical_email=r.user.email;r.role=who==='brand_editor'?null:'editor';r.brandRole=who==='brand_viewer_editor'?'viewer':who==='brand_editor'?'editor':null;}});
    assert.equal(r.calls.length,1);assert.equal(r.capture,3);assert.equal(result.body.node_proposal.node_type,'Content');
    assert.equal(r.calls[0].store,false);assert.equal(r.calls[0].model,'gpt-4o-mini');assert.equal(r.calls[0].input.length,2);
    assert.equal(r.calls[0].input[1].content,`Untrusted source answer:\n<source_answer>\n${r.request.source_answer}\n</source_answer>`);
    assert(!JSON.stringify(r.calls[0]).includes(WORKSPACE)); assert(!JSON.stringify(r.calls[0]).includes(BOARD));
    assert.equal(r.calls[0].text.format.name,'content_node_proposal');
  }
  for(const role of [null,'viewer','public_viewer','brand_viewer']) {
    const {r}=await run(r=>{r.user={email:'stranger@example.test'};r.identity.canonical_email=r.user.email;r.role=role==='brand_viewer'?null:role;r.brandRole=role==='brand_viewer'?'viewer':null;},403);assert.equal(r.calls.length,0);
  }
  assert.equal((await run(r=>r.user=null,401)).r.calls.length,0);
  assert.equal((await run(r=>r.board=null,404)).r.calls.length,0);
  for(const fault of [b=>delete b.owner_id,b=>delete b.owner_email,b=>b.owner_email={},b=>b.owner_email='',b=>b.owner_id=17,b=>b.owner_id=undefined,b=>b.owner_email='not-an-email']) assert.equal((await run(r=>r.fault=fault,403)).r.calls.length,0);
  for (const key of ['workspace_id','brand_id','updated_at']) assert.equal((await run(r=>r.fault=b=>delete b[key],409)).r.calls.length,0);
  // Explicit NULL ownership and NULL association follow the existing legacy policy.
  await run(r=>{r.board.owner_id=null;r.board.owner_email=null;r.board.workspace_id=null;r.board.brand_id=null;r.request.expected_scope={updated_at:r.board.updated_at,brand_id:null,workspace_id:null};r.workspace=null;r.membership=null;r.association=null;});
  for(const mutate of [r=>r.identity.status='disabled',r=>r.identity=null,r=>r.identity.canonical_email='other@example.test',r=>r.membership.status='revoked',r=>r.membership=null,r=>r.workspace.status='disabled']) assert.equal((await run(mutate,403)).r.calls.length,0);
  for(const mutate of [r=>r.association.workspace_id=null,r=>r.association=null,r=>r.request.expected_scope.updated_at='2020-01-01',r=>r.request.expected_scope.brand_id=null,r=>r.request.expected_scope.workspace_id=null]) assert.equal((await run(mutate,409)).r.calls.length,0);
  await run(r=>{r.board.workspace_id=null;r.association.workspace_id=null;r.request.expected_scope.workspace_id=null;});
  await run(()=>transport=async()=>response({...good,rationale:undefined}));
  const mutations=[r=>r.board.updated_at='2026-10-28',r=>r.board.brand_id=null,r=>r.board.workspace_id=null,r=>r.board.owner_email='changed@example.test',r=>r.identity.revision='2',r=>r.identity.id=BRAND,r=>r.identity.status='disabled',r=>r.membership.status='revoked',r=>r.workspace.revision='2'];
  for(const mutate of mutations) {
    const {r}=await run(r=>r.before=n=>{if(n===2)mutate(r);},409);assert.equal(r.calls.length,0);
    const late=await run(r=>transport=async()=>{mutate(r);return response();},409);assert.equal(late.r.calls.length,1);assert(!late.result.body.node_proposal);
  }
  for (const when of ['before','during']) {
    const change = r => {r.pendingRequest.headers.cookie='funklix_session='+r.auth.createSessionToken({...r.user,id:'replacement-session-id'});};
    const {r}=await run(r=>{if(when==='before')r.before=n=>{if(n===2)change(r);};else transport=async()=>{change(r);return response();};},409);
    assert.equal(r.calls.length,when==='before'?0:1);
  }
  await run(()=>transport=async()=>{throw new DOMException('INTERNAL_SECRET','AbortError');},504);
  assert.equal((await run(r=>r.before=()=>{throw Error('INTERNAL_SECRET');},503)).r.calls.length,0);
  const unavailable=await run(r=>r.before=n=>{if(n===3)throw Error('INTERNAL_SECRET');},503);assert.equal(unavailable.r.calls.length,1);
  await run(()=>{delete process.env.OPENAI_API_KEY;},503);process.env.OPENAI_API_KEY='mock-provider';
  for(const provider of [async()=>{throw Error('INTERNAL_SECRET');},async()=>new Response('INTERNAL_SECRET',{status:503}),async()=>new Response('<html>INTERNAL_SECRET</html>'),async()=>new Response('{}'),async()=>new Response(JSON.stringify({output:{}})),async()=>new Response('x'.repeat(65537)),async()=>new Response(JSON.stringify({output_text:'{bad'}))]) await run(()=>transport=provider,502);
  for(const value of [{...good,node_type:'Idea'},{...good,extra:true},{...good,title:'x'.repeat(121)},{...good,body:'x'.repeat(4001)},{...good,body:'bad\u0001body'},JSON.parse('{"node_type":"Content","title":"T","body":"B","__proto__":{}}')]) await run(()=>transport=async()=>response(value),502);
  await run(r=>{r.request.content_language='de';},502);
  await run(r=>{delete r.request.expected_scope;},400);
  await run(r=>{r.request.extra='x'.repeat(350001);},413);
  await run(r=>{r.request.canvas_context={nodes:[{id:'bad',type:'Content'}],edges:[{from:'missing',to:'bad'}]};},400);
  // One real 25-second route deadline, including a provider that returns headers
  // promptly and then stalls forever. No paid calls, retries or timer weakening.
  let cancelled=false;
  const timeout=await run(()=>transport=async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}})),504);
  assert.equal(timeout.r.calls.length,1);
  assert(cancelled, 'deadline cancels a stalled body reader');
  assert(!timeout.result.body.node_proposal);
  assert(!JSON.stringify(logs).includes('INTERNAL_SECRET'));
  console.log('PASS Content actual signed handler + real projection-aware ACL, independent roles/legacy scope, pre/post identity/Workspace/association/revision races, privacy, bounded transport/output and real body deadline');
}
main().catch(error=>{originalError(error);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;console.warn=originalWarn;console.error=originalError;});
