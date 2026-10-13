#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {advisorRuntime}=require('./fixtures/bw36-19-advisor-runtime');
const {campaignBoard,legacyBoard}=require('./fixtures/bw36-19r1-saved-boards');
const clone=v=>JSON.parse(JSON.stringify(v));
async function main() {
  const f=advisorRuntime();f.board.canvas_json=campaignBoard();
  const preview=await f.request({action:'preview',scope:f.scope});
  assert.equal(preview.statusCode,200,'Canonical persisted tuple edges must reach analysis-ready preview: '+JSON.stringify(preview.body));
  assert.equal(f.config.providerCalls.length,0,'Selection/preview must never infer');
  const d=await f.service.readScope(f.r.pool,f.args.user,f.args.brandId,f.scope);
  assert.deepEqual(clone(d.edges),f.board.canvas_json.edges.map(([from,to])=>({from,to})));
  const out=await f.request({action:'analyze',scope:f.scope});assert.equal(out.statusCode,200,JSON.stringify(out.body));
  assert.equal(f.config.providerCalls.length,1);assert.equal(out.body.suggestions[0].mode,'single_node');
  assert.deepEqual(JSON.parse(f.config.providerCalls[0].body.input[1].content).edges,clone(d.edges));
  const g=advisorRuntime();g.board.canvas_json=legacyBoard();
  assert.equal((await g.request({action:'preview',scope:g.scope})).statusCode,200);
  assert.equal(g.config.providerCalls.length,0);
  g.config.output.suggestions[0].sources=[{ref:'s2',excerpt:'Review the wording.'}];
  const legacyAnalysis=await g.request({action:'analyze',scope:g.scope});assert.equal(legacyAnalysis.statusCode,200,JSON.stringify(legacyAnalysis.body));
  assert(legacyAnalysis.body.coverage.excluded.includes('unsupported_node'));
  const before=clone(f.board);
  let data=await f.service.readScope(f.r.pool,f.args.user,f.args.brandId,{...f.scope,include_discussions:true});
  assert.equal(data.threads.length,2);assert.equal(data.sources.filter(s=>s.kind==='canvas_reply').length,2);
  assert(data.sources.some(s=>s.kind==='postit'&&s.resolved));assert(data.sources.some(s=>s.kind==='postit'&&!s.resolved));
  assert(data.sources.some(s=>s.depth===2&&s.text==='Keep the question open.'));
  assert.deepEqual(clone(f.board),before,'Extraction never changes persisted Board data');
  data=await f.service.readScope(f.r.pool,f.args.user,f.args.brandId,{...f.scope,include_discussions:true,excluded_threads:['node-1:0']});
  assert(!data.sources.some(s=>s.thread==='node-1:0'));assert(data.sources.some(s=>s.thread==='node-1:1'));
  const sparse=advisorRuntime();sparse.r.base.db.brands[0].brand_core=null;
  sparse.board.canvas_json={nodes:[{id:'arbitrary-safe-id',type:'Idea'}]};
  assert.equal((await sparse.request({action:'preview',scope:sparse.scope})).statusCode,200);
  sparse.board.canvas_json={};assert.equal((await sparse.request({action:'preview',scope:sparse.scope})).statusCode,200);
  for(const schemaVersion of [undefined,1,'1']) {
    const h=advisorRuntime();h.board.canvas_json=legacyBoard();h.board.canvas_json.schemaVersion=schemaVersion;
    assert.equal((await h.request({action:'preview',scope:h.scope})).statusCode,200);
  }
  const snapshot=advisorRuntime();snapshot.board.brand_core_snapshot={brandCore:'Campaign-specific positioning.',personas:[{name:'Buyer',painPoints:['Time']}],toneOfVoice:[]};
  data=await snapshot.service.readScope(snapshot.r.pool,snapshot.args.user,snapshot.args.brandId,snapshot.scope);
  assert(data.sources.some(s=>s.kind==='campaign_snapshot'&&s.text==='Campaign-specific positioning.'));
  assert(data.sources.some(s=>s.kind==='canonical_profile'));
  const compatible=advisorRuntime();compatible.board.canvas_json=campaignBoard();
  compatible.board.canvas_json.edges=compatible.board.canvas_json.edges.map(([from,to])=>({from,to}));
  assert.equal((await compatible.request({action:'preview',scope:compatible.scope})).statusCode,200,'Preserve previously accepted Advisor object edges');
  const safe=advisorRuntime();safe.board.canvas_json.nodes[0].postits='Unsupported optional legacy value';
  let response=await safe.request({action:'analyze',scope:safe.scope});assert.equal(response.statusCode,200);
  assert.equal(response.body.coverage.complete_threads,false);assert(response.body.coverage.excluded.includes('unsupported_discussion'));
  const tombstone=advisorRuntime();tombstone.board.canvas_json.nodes[0].postits[0].replies.push({deleted:true,replies:[{text:'Never resurrect private deleted content'}]});
  data=await tombstone.service.readScope(tombstone.r.pool,tombstone.args.user,tombstone.args.brandId,{...tombstone.scope,include_discussions:true});
  assert(!JSON.stringify(data.sources).includes('Never resurrect'));assert.equal(data.coverage.complete_threads,false);
  tombstone.board.canvas_json.nodes[0].postits.push(null,{deleted:true,text:'Deleted root'});
  response=await tombstone.request({action:'preview',scope:tombstone.scope});assert.equal(response.statusCode,200);
  assert(response.body.coverage.excluded.includes('unsupported_discussion'));assert(response.body.coverage.excluded.includes('deleted_discussion'));
  const optional=advisorRuntime();optional.board.canvas_json.nodes[0].description={legacy:'Nontext'};
  data=await optional.service.readScope(optional.r.pool,optional.args.user,optional.args.brandId,optional.scope);
  assert(data.coverage.excluded.includes('unsupported_field'));
  // No ID normalization or graph guessing. A malformed essential relationship
  // must suppress the entire analysis before the mocked provider is invoked.
  for(const mutate of [
    h=>h.board.canvas_json.edges=[['node-1','missing']],
    h=>h.board.canvas_json.edges=[['node-1','node-2','extra']],
    h=>h.board.canvas_json.edges=[{source:'node-1',target:'node-2'}],
    h=>h.board.canvas_json.edges=[{from:'node-1',to:'node-2',source:'conflicting'}],
    h=>h.board.canvas_json.edges=[[1,'node-2']],
    h=>h.board.canvas_json.nodes[1].id='node-1',
    h=>h.board.canvas_json.nodes[1].id='unsafe\u0000id',
    h=>h.board.canvas_json.nodes[1].id='bad\ud800',
    h=>h.board.canvas_json.nodes[1]=null,
    h=>h.board.canvas_json.nodes=null,
    h=>h.board.canvas_json.edges=null,
    h=>h.board.canvas_json.schemaVersion=99,
    h=>h.board.canvas_json.version='future',
    h=>h.board.canvas_json.nodes[0].content='unsafe\u0000text',
    h=>h.board.brand_core_snapshot=[]
  ]) {
    const h=advisorRuntime();h.board.canvas_json=campaignBoard();mutate(h);
    response=await h.request({action:'analyze',scope:h.scope});assert.equal(response.body.error.code,'UNSUPPORTED_SOURCE');
    assert.equal(h.config.providerCalls.length,0);assert.deepEqual(Object.keys(response.body.error),['code']);
  }
  for(const mutate of [
    h=>h.board.canvas_json.nodes=Array.from({length:101},(_,i)=>({id:'node-'+i,type:'Content'})),
    h=>h.board.canvas_json.edges=Array.from({length:301},()=>['node-1','node-2']),
    h=>h.board.canvas_json.nodes[0].postits=Array.from({length:101},()=>({text:'Root'})),
    h=>h.board.canvas_json.nodes[0].content='x'.repeat(2001),
    h=>h.r.base.db.brands[0].brand_core.personas=Array.from({length:101},()=>({name:'Persona'}))
  ]) {
    const h=advisorRuntime();h.board.canvas_json=campaignBoard();mutate(h);
    response=await h.request({action:'preview',scope:h.scope});assert.equal(response.statusCode,200,'R2 supports former arbitrary structural/text limits');
    assert.equal(h.config.providerCalls.length,0);
  }
  const budget=advisorRuntime();budget.board.canvas_json.nodes[0].content='漢'.repeat(1900);
  budget.config.output.suggestions=[];assert.equal((await budget.request({action:'analyze',scope:budget.scope})).statusCode,200);assert.equal(budget.config.providerCalls.length,1);
  const thread=advisorRuntime();thread.board.canvas_json.nodes[0].postits[0].replies={malformed:true};
  assert.equal((await thread.request({action:'preview',scope:{...thread.scope,include_discussions:true}})).statusCode,200);
  assert.equal((await thread.request({action:'analyze',scope:{...thread.scope,include_discussions:true}})).body.error.code,'UNSUPPORTED_THREAD');
  assert.equal(thread.config.providerCalls.length,0);
  assert.equal((await thread.request({action:'analyze',scope:{...thread.scope,include_discussions:true,excluded_threads:['node-1:0']}})).statusCode,200);
  assert.equal((await thread.request({action:'analyze',scope:{...thread.scope,include_discussions:true,excluded_threads:['node-1:0','missing:0']}})).body.error.code,'STALE_SOURCE');
  for(const mutate of [
    h=>h.board.canvas_json.nodes=Array.from({length:100},(_,i)=>({id:'node-'+i,type:'Content'})),
    h=>h.board.canvas_json.edges=Array.from({length:300},()=>['node-1','node-2']),
    h=>h.board.canvas_json.nodes[0].postits=Array.from({length:100},()=>({text:''}))
  ]) {
    const h=advisorRuntime();h.board.canvas_json=campaignBoard();mutate(h);
    assert.equal((await h.request({action:'preview',scope:h.scope})).statusCode,200,'Exact structural limits remain supported');
  }
  const messages=advisorRuntime(),root=messages.board.canvas_json.nodes[0].postits[0];
  root.replies=Array.from({length:39},()=>({text:'Reply'}));
  await messages.service.readScope(messages.r.pool,messages.args.user,messages.args.brandId,{...messages.scope,include_discussions:true});
  root.replies.push({text:'One too many'});
  assert.equal((await messages.request({action:'analyze',scope:{...messages.scope,include_discussions:true}})).statusCode,200);assert.equal(messages.config.providerCalls.length,1);
  for(const [mutate,code] of [
    [h=>h.board.updated_at='2026-10-13T00:00:00Z','STALE_SOURCE'],
    [h=>h.board.brand_id=h.scope.workspace_id,'SOURCE_UNAVAILABLE'],
    [h=>h.board.workspace_id=h.args.brandId,'SOURCE_UNAVAILABLE'],
    [h=>h.r.base.db.boards=[],'SOURCE_UNAVAILABLE'],
    [h=>h.config.membership=false,'WORKSPACE_ACCESS_DENIED']
  ]) {
    const h=advisorRuntime();h.board.canvas_json=campaignBoard();mutate(h);
    response=await h.request({action:'preview',scope:h.scope});assert.equal(response.body.error.code,code);assert.equal(h.config.providerCalls.length,0);
  }
  console.log('PASS BW-36.19R1 canonical and historical saved tuple-edge Boards: provider-free preview and mocked full analysis.');
  await require('./fixtures/bw36-19-browser').browserChecks({canvas:campaignBoard(),expectedThreads:2,hydrationCanvases:[legacyBoard()]});
  await require('./fixtures/bw36-19-database').databaseChecks({canvas:campaignBoard()});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
