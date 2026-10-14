#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {getEncoding}=require('js-tiktoken');
const {savedCampaign}=require('./fixtures/bw36-19r4-saved-campaign');
const {clone}=require('./fixtures/bw36-13r5-local-runtime');
let groups=0;
async function test(name,fn){await fn();groups++;console.log('PASS '+name);}
function envelope(output){return {status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(output)}]}]};}
async function run(f,mutation=()=>{}) {
  const original=f.config.onProvider,events=[];
  f.config.onProvider=()=>{original();mutation(f);};
  let result,error;try{result=await f.service.analyze({...f.args,onDiagnostic:e=>events.push(clone(e))});}catch(e){error=e;}
  return {result,error,events};
}
function failure(out,category,code='INVALID_OUTPUT') {
  assert.equal(out.error?.code,code);assert(!out.result);assert.equal(out.events.length,1);
  assert.equal(out.events[0].category,category);assert.match(out.events[0].correlation_id,/^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(out.events[0]).sort(),['category','correlation_id','event','pass','stage']);
}
async function main(){
 await test('realistic EN/DE saved Campaigns, Responses message output, exact evidence, usage, immutable analysis',async()=>{
  for(const language of ['en','de']) {
   const f=savedCampaign(language),before=clone(f.r.base.db),knowledge=clone(f.r.db.learnings);
   const out=await run(f,f=>{f.config.providerEnvelope={...envelope(f.config.output),usage:{input_tokens:600,output_tokens:420}};if(language==='en'){const content=f.config.providerEnvelope.output[0].content,text=content[0].text,mid=Math.floor(text.length/2);content[0].text=text.slice(0,mid);content.push({type:'output_text',text:text.slice(mid)});}});
   assert(!out.error,JSON.stringify(out.events));assert.equal(out.result.suggestions.length,1);assert.equal(out.result.suggestions[0].approval_required,true);
   assert.equal(out.result.metadata.usage.output_tokens,420);assert.equal(out.result.coverage.analysis_complete,true);
   assert.deepEqual(clone(f.r.base.db),before);assert.deepEqual(clone(f.r.db.learnings),knowledge);assert.equal(f.r.db.events.length,0);
   assert(!f.r.db.queries.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q.sql)));assert.equal(out.events.length,0);
   assert.deepEqual(Object.keys(f.config.providerCalls[0].body.text.format.schema.properties.suggestions.items.properties),['title','statement','rationale','source_refs']);
   const input=JSON.parse(f.config.providerCalls[0].body.input[1].content);
   for(const kind of ['canonical_profile','campaign_snapshot','canvas_node','postit','canvas_reply','approved_learning','proposed_learning'])assert(input.sources.some(s=>s.kind===kind));
   assert(input.sources.some(s=>s.attribution==='ai_generated'));assert(input.sources.some(s=>s.parent_ai));
  }
 });
 await test('reproduce old 16K output and 60KB envelope mismatch; token budget covers realistic detailed output',async()=>{
  const f=savedCampaign();
  for(const node of f.board.canvas_json.nodes)node.content=('Use clear wording and invite a thoughtful next step. ').repeat(12);
  const out=await run(f,f=>{
   const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content),sources=input.sources.filter(s=>s.kind==='canvas_node');
   f.config.output.suggestions=Array.from({length:5},(_,i)=>({...clone(f.config.output.suggestions[0]),
     statement:('Review concrete campaign guidance '+i+'. ').repeat(45),
     sources:sources.map(s=>({ref:s.ref,excerpt:input.texts[s.text_index].slice(-450)}))}));
   const serialized=JSON.stringify(f.config.output),tokens=getEncoding('o200k_base').encode(serialized,[],[]).length;
   assert(serialized.length>16000);assert(tokens>2000);assert(tokens<=8192);
   // Escaping valid Unicode twice reproduces the old raw-response ceiling too.
   const escaped=serialized.replace(/\\.|[A-Za-z]/g,c=>c.length===2?c:'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
   f.config.providerEnvelope={status:'completed',output_text:escaped};
   assert(Buffer.byteLength(JSON.stringify(f.config.providerEnvelope))>60000);
  });
  assert(!out.error,JSON.stringify(out.events));assert.equal(out.result.suggestions.length,5);
  assert.equal(f.config.providerCalls[0].body.max_output_tokens,8192);
 });
 await test('schema lengths count Unicode code points; emoji excerpts remain literal',async()=>{
  const f=savedCampaign();const excerpt='Review guidance. '+('🌱').repeat(300);
  f.board.canvas_json.nodes[0].content=excerpt;
  const out=await run(f,f=>f.config.output.suggestions[0].sources[0].excerpt=excerpt);
  assert(!out.error,JSON.stringify(out.events));assert.equal(out.result.suggestions[0].sources[0].excerpt,excerpt);
  assert(excerpt.length>500);assert(Array.from(excerpt).length<=500);
 });
 await test('unknown/missing refs and nonliteral legacy excerpts are discarded independently',async()=>{
  for(const [mutate,category] of [
   [s=>s.sources[0].ref='invented','unknown_source_reference'],
   [s=>delete s.sources[0].ref,'schema_validation_failure'],
   [s=>s.sources[0].excerpt='Use a clearer next step.','evidence_excerpt_mismatch'],
   [s=>s.sources[0].excerpt='Use a clear\u00a0next step.','evidence_excerpt_mismatch'],
   [s=>s.sources[0].excerpt='„Use a clear next step.“','evidence_excerpt_mismatch'],
   [s=>s.sources[0].excerpt='Nutze einen klaren nächsten Schritt.','evidence_excerpt_mismatch']]) {
    const out=await run(savedCampaign(),f=>{const invalid=clone(f.config.output.suggestions[0]);invalid.statement='Another suggestion.';mutate(invalid);f.config.output.suggestions.push(invalid);});
    assert(!out.error,category);assert.equal(out.result.suggestions.length,1);assert.equal(out.result.suggestions[0].statement,'Offer a clear next step.');assert.equal(out.events.length,0);
  }
 });
 await test('classification, unsupported claims and wrong-language prose remain fail-closed',async()=>{
  for(const [kind,evidenceClass] of [['canonical_profile','canonical_knowledge'],['approved_learning','approved_knowledge'],['postit','explicit_statement']]) {
   const f=savedCampaign(),out=await run(f,f=>{const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content),src=input.sources.find(s=>s.kind===kind);const s=f.config.output.suggestions[0];s.evidence_class=evidenceClass;s.sources=[{ref:src.ref,excerpt:input.texts[src.text_index]}];});
   assert(!out.error,JSON.stringify(out.events));assert.equal(out.result.suggestions[0].evidence_class,evidenceClass);assert.equal(out.result.suggestions[0].approval_required,true);
  }
  for(const [mutate,category,code] of [
   [o=>o.suggestions[0].evidence_class='canonical_knowledge','evidence_class_mismatch'],
   [o=>o.suggestions[0].evidence_class='approved_knowledge','evidence_class_mismatch'],
   [o=>o.suggestions[0].type='potential_conflict','evidence_class_mismatch'],
   [o=>o.suggestions[0].statement='The team has agreed on this consensus.','evidence_class_mismatch'],
   [o=>o.suggestions[0].statement='Das ist für die Marke und die Kunden nicht der richtige Weg.','language_mismatch','OUTPUT_LANGUAGE_MISMATCH'],
   [o=>o.language='de','language_mismatch'],
   [o=>o.extra='Private diagnostic marker','schema_validation_failure']])failure(await run(savedCampaign(),f=>mutate(f.config.output)),category,code);
 });
 await test('incomplete provider, truncation, malformed envelope, refusal and ambiguous documents are never empty success',async()=>{
  for(const [mutate,category] of [
   [f=>f.config.providerEnvelope={status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:JSON.stringify(f.config.output)},'provider_incomplete'],
   [f=>f.config.providerEnvelope={output_text:JSON.stringify(f.config.output)},'provider_incomplete'],
   [f=>f.config.providerRaw='{','response_parse_failure'],
   [f=>f.config.providerEnvelope={status:'completed',output_text:'{"language":"en","suggestions":['},'response_parse_failure'],
   [f=>f.config.providerEnvelope={status:'completed',output_text:'```json\n{}\n```'},'response_parse_failure'],
   [f=>{f.config.providerEnvelope=envelope(f.config.output);f.config.providerEnvelope.output[0].content=[{type:'refusal',refusal:'private marker'}];},'provider_refusal'],
   [f=>{f.config.providerEnvelope=envelope(f.config.output);f.config.providerEnvelope.output.push(clone(f.config.providerEnvelope.output[0]));},'response_parse_failure'],
   [f=>{f.config.providerEnvelope=envelope(f.config.output);f.config.providerEnvelope.output_text='{}';},'response_parse_failure'],
   [f=>{f.config.providerEnvelope=envelope(f.config.output);f.config.providerEnvelope.output[0].status='incomplete';},'response_parse_failure']])failure(await run(savedCampaign(),mutate),category,category==='provider_incomplete'?'PROVIDER_INCOMPLETE':category==='provider_refusal'?'PROVIDER_REFUSED':'INVALID_OUTPUT');
  const f=savedCampaign(),out=await run(f,f=>f.config.output.suggestions=[]);
  assert(!out.error);assert.equal(out.result.suggestions.length,0);assert.equal(out.result.coverage.analysis_complete,true);assert.equal(out.events.length,0);
 });
 await test('streamed transport bounds, diagnostic whitelist and logging failures cannot alter results',async()=>{
  const f=savedCampaign();let cancelled=false,released=false,reads=0;
  await assert.rejects(()=>f.service.readProviderResponse({body:{getReader:()=>({read:async()=>{reads++;return {done:false,value:Buffer.alloc(f.service.RESPONSE_BOUND+1)};},cancel:async()=>{cancelled=true;},releaseLock:()=>{released=true;}})}}),e=>e.diagnosticCategory==='response_size_failure');
  assert(cancelled&&released);assert.equal(reads,1);
  const events=[];
  await assert.rejects(()=>f.service.analyze({...f.args,fetchImpl:async()=>{throw Object.assign(new Error('SECRET_MARKER'),{diagnosticCategory:'SECRET_MARKER'});},onDiagnostic:e=>events.push(clone(e))}));
  assert.equal(events[0].category,'analysis_failure');assert(!JSON.stringify(events).includes('SECRET_MARKER'));
  await assert.rejects(()=>f.service.analyze({...f.args,fetchImpl:async()=>{throw new Error('private');},onDiagnostic:()=>{throw new Error('log failure');}}),e=>e.code==='PROVIDER_FAILED');
 });
 await test('multi-pass consolidation uses validated excerpts only; no raw-text reopening or stitched quotes',async()=>{
  for(const invalid of [false,'invented','stitched']) {
   const f=savedCampaign();f.r.base.env.OPENAI_LEARNING_ADVISOR_MODEL='fixture-model';f.r.base.env.OPENAI_LEARNING_ADVISOR_CONTEXT_TOKENS='18192';f.r.base.env.OPENAI_LEARNING_ADVISOR_TOKEN_ENCODING='o200k_base';
   for(let i=0;i<18;i++)f.board.canvas_json.nodes.push({id:'extra-'+i,type:'Content',content:('Review practical campaign guidance '+i+'. ').repeat(220)});
   const normal=f.config.onProvider;
   f.config.onProvider=()=>{
    const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content);
    if(input.candidates){normal();if(invalid==='invented')f.config.output.suggestions[0].sources[0].excerpt='Invented quote';
     if(invalid==='stitched')f.config.output.suggestions[0].sources[0].excerpt=input.candidates[0].sources[0].excerpt+'\n'+input.candidates[1].sources[0].excerpt;return;}
    normal();const src=input.sources.find(s=>s.kind==='canvas_node');
    const s=f.config.output.suggestions[0];s.sources=[{ref:src.ref,excerpt:input.texts[src.text_index].slice(-100)}];s.statement='Review '+src.ref+'.';
    if(invalid==='stitched'&&f.config.providerCalls.length===1){const second=clone(s);second.statement='Review another aspect of '+src.ref+'.';second.sources[0].excerpt=input.texts[src.text_index].slice(-20);f.config.output.suggestions.push(second);}
   };
   const out=await run(f);
   if(invalid){failure(out,invalid==='stitched'?'consolidation_failure':'evidence_excerpt_mismatch');assert.equal(out.events[0].stage,'consolidating');}
   else {assert(!out.error,JSON.stringify(out.events));assert(out.result.coverage.source_passes>1);assert.equal(out.result.metadata.provider_requests,out.result.coverage.source_passes+1);}
  }
 });
 await test('revoked access and stale fingerprints discard otherwise valid output, Learning/Canvas unchanged',async()=>{
  for(const [mutation,category] of [[f=>f.config.membership=false,'source_access_failure'],[f=>f.board.canvas_json.nodes[0].content='Changed.','source_freshness_failure'],[f=>f.r.db.role='viewer','source_access_failure']]) {
   const f=savedCampaign(),knowledge=clone(f.r.db.learnings);
   failure(await run(f,mutation),category,category==='source_freshness_failure'?'STALE_SOURCE':category==='source_access_failure'?f.config.membership?'BRAND_ACCESS_DENIED':'WORKSPACE_ACCESS_DENIED':null);
   assert.deepEqual(clone(f.r.db.learnings),knowledge);assert.equal(f.r.db.events.length,0);
  }
 });
 console.log('BW-36.19R4: '+groups+' production-shaped output reliability groups passed; all providers mocked.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
