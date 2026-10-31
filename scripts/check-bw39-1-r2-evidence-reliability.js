'use strict';
// Production Advice + signed sessions + disposable saved SQL; provider transport only is mocked.
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw36-20-database');
(async () => {
 const warnings=[], infos=[], oldWarn=console.warn, oldInfo=console.info;
 console.warn=(...args)=>warnings.push(args); console.info=(...args)=>infos.push(args);
 const f = await fixture({goals:true,signedSession:true});
 const nodes=[{id:'fictional-social',type:'Social Media Posting',title:'Fictional workshop',social:{cta:'Discover more'},goal:'Increase workshop registrations'}];
 const value={answer:'I would make the invitation more specific.',findings:[{title:'The invitation is broad',explanation:'The destination is ambiguous relative to the registration goal.',evidence:[{nodeId:nodes[0].id,field:'social.cta',quote:'Discover more'},{nodeId:nodes[0].id,field:'goal',quote:nodes[0].goal}]}]};
 const raw=JSON.stringify(value);
 const block=text=>({type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]});
 const envelope={id:'resp_fictional_r2',object:'response',created_at:1793318400,model:'gpt-4o-mini',status:'completed',error:null,incomplete_details:null,usage:{input_tokens:1200,output_tokens:140},output:[block(raw)]};
 const changed=mutate=>{const v=structuredClone(value);mutate(v);return {...envelope,output:[block(JSON.stringify(v))]};};
 const cases=[
 ['valid saved CTA and goal',envelope,200,1],
 ['empty aggregate fallback retained',{...envelope,output_text:''},200,1],
 ['multiple text blocks',{...envelope,output:[block(raw.slice(0,60)),block(raw.slice(60))]},200,1],
 ['truncated JSON',{...envelope,output:[block(raw.slice(0,-5))]},502],
 ['missing findings',changed(v=>delete v.findings),200,0],
 ['schema mismatch',changed(v=>v.extra=true),502],
 ['forged node',changed(v=>v.findings[0].evidence.forEach(e=>e.nodeId='unsupported')),200,0],
 ['outside evidence quote',changed(v=>v.findings[0].evidence[0].quote='Not supplied'),200,0],
 ['valid empty findings',changed(v=>v.findings=[]),200,0],
 ['output budget exhaustion',{...envelope,status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},502],
 ['refusal',{...envelope,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'Fictional refusal'}]}]},502],
 ['provider error envelope',{object:'response',status:'failed',error:{code:'server_error'},output:[]},502],
 ['completed with error and valid text',{...envelope,error:{code:'server_error'}},502]
 ];
 try {
  for(const [name,response,status,count] of cases){
   await f.reset(); f.env.AUTH_SECRET='fictional-disposable-r2-session';
   await f.pg.query('UPDATE boards SET canvas_json=$1::jsonb, updated_at=$2',[JSON.stringify({nodes,edges:[]}),'2026-10-29T08:00:00.123456Z']);
   f.transportResponse=new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
   const start=f.queries.length;
   const warnCount=warnings.length, infoCount=infos.length;
   const result=await f.invoke({advice_mode:'analyze_social_ctas',question:'Which social posts have unclear calls to action?',canvas_revision:'2026-10-29T08:00:00.123Z',canvas_context:{nodes,edges:[]}});
   assert.equal(result.statusCode,status,name);
   if(count!==undefined) { assert.equal(result.body.findings.length,count,name); assert.equal(result.body.answer,value.answer,name); }
   if(name==='missing findings') assert.equal(result.body.evidenceContext.evidenceUnavailable,true);
   assert.equal(f.calls.length,1); assert.equal(f.calls[0].model,'gpt-4o-mini'); assert.equal(f.calls[0].store,false);assert.equal(f.calls[0].max_output_tokens,4096);
   assert(f.queries.slice(start).every(q=>/^(SELECT|BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(q.sql)));
   if(status===502){assert.equal(warnings.length,warnCount+1);assert.equal(infos.length,infoCount);assert(!result.body.findings);}
   else{assert.equal(warnings.length,warnCount);assert.equal(infos.length,infoCount+1);assert.equal(infos.at(-1)[1].verifiedFindingCount,count);}
   console.log(JSON.stringify({case:name,http:result.statusCode,code:result.body.code||null,findings:result.body.findings?.length??null,calls:f.calls.length,writes:0,structuredFormatConfigured:!!f.calls[0].text?.format}));
  }
  assert.equal(warnings.at(-1)[1].reason,'provider_error');
  for(const [transport,reason,stage,status] of [
   [new Response('PRIVATE_PROVIDER_BODY',{status:429}),'provider_http','provider_request',502],
   [new Response('PRIVATE_PROVIDER_BODY',{status:200}),'envelope','provider_response',502],
   [()=>{throw new TypeError('PRIVATE_TRANSPORT_MESSAGE');},'transport','provider_request',500],
   [()=>{throw Object.assign(new Error('PRIVATE_TIMEOUT'),{name:'AbortError'});},'timeout','provider_request',504]
  ]){
   f.calls.length=0;f.transportResponse=typeof transport==='function'?null:transport;f.onProvider=typeof transport==='function'?transport:null;
   const r=await f.invoke({advice_mode:'analyze_social_ctas',question:'Review current social calls to action.',canvas_revision:'2026-10-29T08:00:00.123Z',canvas_context:{nodes,edges:[]}});
   assert.equal(r.statusCode,status);assert.equal(f.calls.length,1);assert.equal(warnings.at(-1)[1].reason,reason);assert.equal(warnings.at(-1)[1].stage,stage);
  }
  const inspector=f.load('api/_ai-brain-social-evidence.js');
  const malformed=inspector.inspect({output:{},output_text:'PRIVATE_AGGREGATE'});
  assert.equal(malformed.reason,'envelope');assert.equal(malformed.diagnostic.hasText,true);
  const d=inspector.inspect({...envelope,output:[{type:'PRIVATE_TYPE',content:[{type:'PRIVATE_CONTENT_TYPE'}]},block('{broken')]}).diagnostic;
  assert.equal(d.outputBlockCount,2);assert.equal(d.contentBlockCount,2);assert.deepEqual(Array.from(d.outputBlockTypes),['message','other']);assert.deepEqual(Array.from(d.contentBlockTypes),['other','output_text']);assert.equal(d.hasText,true);assert.equal(d.validationCategory,'json_syntax');
  const schemas=[['envelope_keys',v=>v.extra=true],['answer',v=>v.answer=''],['findings',v=>v.findings={}],['finding',v=>v.findings[0].evidence=[]],['citation',v=>v.findings[0].evidence[0].extra=true]];
  for(const [category,mutate] of schemas) assert.equal(inspector.inspect(changed(mutate)).diagnostic.validationCategory,category);
  const logs=JSON.stringify([warnings,infos,d]);
  for(const secret of ['PRIVATE_',f.BOARD,nodes[0].id,nodes[0].title,nodes[0].goal,nodes[0].social.cta]) assert(!logs.includes(secret),'no private content in diagnostics');
  console.log('PASS provider HTTP/transport/timeout/outer JSON failures, schema categories, block metadata allowlists and content redaction');
 }finally{console.warn=oldWarn;console.info=oldInfo;await f.pg.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
