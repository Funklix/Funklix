#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {advisorRuntime}=require('./fixtures/bw36-19-advisor-runtime');
const {campaignBoard}=require('./fixtures/bw36-19r1-saved-boards');
const {clone}=require('./fixtures/bw36-13r5-local-runtime');
let groups=0;
async function test(name,fn){await fn();groups++;console.log('PASS '+name);}
function larger() {
 const f=advisorRuntime();f.board.canvas_json=campaignBoard();
 f.board.canvas_json.nodes[2].type='Campaign Variation';
 for(let i=0;i<36;i++)f.board.canvas_json.nodes.push({id:'large-'+i,type:'Content',title:'Evidence '+i,content:'Persisted campaign evidence '+i+'. '+('Careful strategic detail '+i+' ').repeat(110),postits:[]});
 f.board.canvas_json.edges.push(...Array.from({length:36},(_,i)=>['node-1','large-'+i]));
 f.r.base.env.OPENAI_LEARNING_ADVISOR_MODEL='test-context-model';f.r.base.env.OPENAI_LEARNING_ADVISOR_CONTEXT_TOKENS='12000';f.r.base.env.OPENAI_LEARNING_ADVISOR_TOKEN_ENCODING='o200k_base';
 f.config.onProvider=()=>{
   const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content);
   if(input.candidates){f.config.output={language:'en',suggestions:input.candidates.slice(0,1)};return;}
   const source=input.sources.find(s=>s.kind==='canvas_node')||input.sources[0];
   const suggestion=clone(f.config.output.suggestions[0]||f.template);
   suggestion.statement='Review guidance from '+source.ref+'.';suggestion.sources=[{ref:source.ref,excerpt:input.texts[source.text_index].slice(0,90)}];
   f.config.output={language:'en',suggestions:[suggestion]};
 };
 f.template=clone(f.config.output.suggestions[0]);return f;
}
async function main(){
 await test('ordinary saved campaign, two variations, repeated Profile text and >8 KB use one request',async()=>{
  const f=advisorRuntime();f.board.canvas_json=campaignBoard();f.board.canvas_json.nodes[2].type='Campaign Variation';
  const repeated='Make marketing useful. '+('Profile strategy. ').repeat(230);
  f.r.base.db.brands[0].brand_core={brandCore:repeated};f.board.brand_core_snapshot={brandCore:repeated};
  f.config.output.suggestions=[];
  assert.equal((await f.request(null)).statusCode,200);assert.equal((await f.request({action:'preview',scope:f.scope})).statusCode,200);assert.equal(f.config.providerCalls.length,0);
  const response=await f.request({action:'analyze',scope:f.scope});assert.equal(response.statusCode,200);
  assert.equal(f.config.providerCalls.length,1);
  const payload=JSON.parse(f.config.providerCalls[0].body.input[1].content);
  assert.equal(payload.texts.filter(t=>t===repeated).length,1);
  assert.equal(payload.sources.filter(s=>payload.texts[s.text_index]===repeated).length,2);
  assert.equal(response.body.coverage.analysis_complete,true);
 });
 await test('large connected Board, arrays >20, Nodes >100 and edges >300 remain valid',async()=>{
  const f=advisorRuntime();f.board.canvas_json.nodes.push(...Array.from({length:180},(_,i)=>({id:'n-'+i,type:'Content',content:'Unique useful evidence '+i})));
  f.board.canvas_json.edges=Array.from({length:350},(_,i)=>['node-1','n-'+i%180]);f.r.base.db.brands[0].brand_core.keywords=Array.from({length:45},(_,i)=>'Keyword '+i);
  f.config.output.suggestions=[];const response=await f.request({action:'analyze',scope:f.scope});assert.equal(response.statusCode,200);assert.equal(f.config.providerCalls.length,1);
 });
 await test('complete long/deep threads stay together, each source exactly once across passes; consolidation and real progress',async()=>{
  const f=larger();let parent=f.board.canvas_json.nodes[0].postits[0];
  for(let i=0;i<55;i++){parent.replies=[{text:'Human reply '+i+'.',resolved:i%2===0}];parent=parent.replies[0];}
  f.scope.include_discussions=true;
  const data=await f.service.readScope(f.r.pool,f.args.user,f.args.brandId,f.scope),constraints=f.service.modelConstraints(f.r.base.env),plan=f.service.prepare(data,f.scope,constraints);
  assert(plan.length>1);assert.deepEqual(plan.flatMap(p=>p.sources.map(s=>s.ref)),data.sources.map(s=>s.ref));
  for(const thread of data.threads){const parts=plan.filter(p=>p.sources.some(s=>s.thread===thread.key));assert.equal(parts.length,1);assert.equal(parts[0].sources.filter(s=>s.thread===thread.key).length,data.sources.filter(s=>s.thread===thread.key).length);}
  const progress=[];const result=await f.service.analyze({...f.args,onProgress:p=>progress.push(p)});
  assert.equal(result.metadata.provider_requests,plan.length+1);assert.equal(result.coverage.analysis_complete,true);assert.equal(result.coverage.truncated_threads,0);
  assert.equal(progress.at(-1).stage,'consolidating');assert.equal(progress.filter(p=>p.stage==='analyzing').length,plan.length);
  assert(result.suggestions[0].sources.every(s=>data.sources.some(d=>d.ref===s.ref&&d.text.includes(s.excerpt))));
 });
 await test('conflicting evidence from separate passes remains two-sided after consolidation',async()=>{
  const f=larger(),normal=f.config.onProvider;
  f.config.onProvider=()=>{
   normal();const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content);
   if(input.candidates){assert(input.candidates.length>1);const s=f.config.output.suggestions[0];s.type='potential_conflict';s.decision_status='disputed';s.statement='Review conflicting campaign guidance.';s.sources=[input.candidates[0].sources[0],input.candidates[1].sources[0]];}
  };
  const response=await f.request({action:'analyze',scope:f.scope});assert.equal(response.statusCode,200);assert.equal(response.body.suggestions[0].sources.length,2);assert.equal(response.body.suggestions[0].approval_required,true);
 });
 await test('oversized indivisible thread/model misconfiguration/runtime window fail before paid calls',async()=>{
  const f=advisorRuntime();f.scope.include_discussions=true;f.board.canvas_json.nodes[0].postits[0].text='漢'.repeat(140000);
  assert.equal((await f.request({action:'analyze',scope:f.scope})).body.error.code,'THREAD_CONTEXT_EXCEEDED');assert.equal(f.config.providerCalls.length,0);
  f.r.base.env.OPENAI_LEARNING_ADVISOR_MODEL='unknown';assert.equal((await f.request({action:'analyze',scope:f.scope})).body.error.code,'MODEL_CONTEXT_UNCONFIGURED');
  const g=larger();for(let i=0;i<100;i++)g.board.canvas_json.nodes.push({id:'extra-'+i,type:'Content',content:'Unique '+i+' '+('x'+i).repeat(1800)});
  assert.equal((await g.request({action:'analyze',scope:g.scope})).body.error.code,'ANALYSIS_RUNTIME_EXCEEDED');assert.equal(g.config.providerCalls.length,0);
 });
 await test('revocation, source changes, provider failure/timeout between passes release no partial result',async()=>{
  for(const mutation of [f=>f.config.membership=false,f=>f.r.db.role='viewer',f=>f.board.canvas_json.nodes[0].content='Changed']) {
   const f=larger(),normal=f.config.onProvider;f.config.onProvider=()=>{normal();mutation(f);};
   const response=await f.request({action:'analyze',scope:f.scope});assert(response.statusCode>=400);assert(!response.body.suggestions);assert.equal(f.config.providerCalls.length,1);
  }
  for(const failure of [503,'timeout']) {
   const f=larger(),normal=f.config.onProvider;f.config.onProvider=()=>{normal();if(f.config.providerCalls.length===2)f.config.providerFailure=failure;};
   const response=await f.request({action:'analyze',scope:f.scope});assert.equal(response.body.error.code,failure==='timeout'?'PROVIDER_TIMEOUT':'PROVIDER_FAILED');assert.equal(f.config.providerCalls.length,2);assert(!response.body.suggestions);
  }
 });
 await test('per-pass references are restricted; consolidation cannot cite raw text outside candidate excerpts',async()=>{
  const f=larger(),normal=f.config.onProvider;f.config.onProvider=()=>{normal();if(f.config.providerCalls.length===2)f.config.output.suggestions[0].sources=[{ref:'s1',excerpt:'Make marketing useful.'}];};
  assert.equal((await f.request({action:'analyze',scope:f.scope})).body.error.code,'INVALID_OUTPUT');
  const g=larger(),generate=g.config.onProvider;g.config.onProvider=()=>{generate();const input=JSON.parse(g.config.providerCalls.at(-1).body.input[1].content);if(input.candidates)g.config.output.suggestions[0].sources[0].excerpt='Invented consolidation evidence';};
  assert.equal((await g.request({action:'analyze',scope:g.scope})).body.error.code,'INVALID_OUTPUT');
 });
 await test('cancelled stream cannot start another pass and unknown schema/extra provider keys fail',async()=>{
  const f=larger();let cancelled=false;const normal=f.config.onProvider;f.config.onProvider=()=>{normal();cancelled=true;};
  await assert.rejects(()=>f.service.analyze({...f.args,isCancelled:()=>cancelled}),e=>e.code==='ANALYSIS_CANCELLED');assert.equal(f.config.providerCalls.length,1);
  const g=larger(),generate=g.config.onProvider;g.config.onProvider=()=>{generate();g.config.output.extra='untrusted';};
  assert.equal((await g.request({action:'analyze',scope:g.scope})).body.error.code,'INVALID_OUTPUT');
 });
 await require('./fixtures/bw36-19r2-browser').browserChecks();
 console.log('BW-36.19R2: '+groups+' adaptive context/security groups passed (mocked OpenAI only).');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
