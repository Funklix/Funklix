'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {enrich}=require('../api/_brand-enrichment');
const {createHandler}=require('../api/enrich-brand-profile');
const c=require('../brand-enrichment-contract');
const {responseFormat}=require('../api/_brand-enrichment-schema');
const brand={id:'11111111-1111-4111-8111-111111111111',name:'Fixture',revision:1,brand_core:{customTiles:[],brandAssets:{domain:'https://repair.example/'}}};
const description='Laurent Krall is the founder. The user describes his background and personality.';
const input={brandId:brand.id,workspaceId:'22222222-2222-4222-8222-222222222222',revision:1,action:'draft',description};
const quote='Laurent Krall is the founder.';
const item=(value=quote,classification='user_provided',sourceId='user',excerpt=quote)=>({value,classification,evidence:[{sourceId,excerpt}]});
const model=(fields,finish_reason='stop')=>async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason,message:{content:JSON.stringify({fields})}}]})});
const clone=v=>JSON.parse(JSON.stringify(v));
async function request(deps={},body=input){
 const events=[],headers={};
 const res={setHeader(k,v){headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=clone(body);return this;}};
 await createHandler({getSessionUser:()=>({email:'fixture@example.test'}),authorize:async()=>brand,logDiagnostic:event=>events.push(clone(event)),...deps})({method:'POST',body},res);
 return {...res,events,headers};
}
// Validate the actual request schema, rather than mirroring production parsing.
function matches(s,v){
 if(s.anyOf)return s.anyOf.some(part=>matches(part,v));
 if(s.enum&&!s.enum.includes(v))return false;
 if(s.type==='null')return v===null;
 if(s.type==='string')return typeof v==='string';
 if(s.type==='array')return Array.isArray(v)&&v.every(x=>matches(s.items,x));
 if(s.type==='object')return !!v&&typeof v==='object'&&!Array.isArray(v)&&s.required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>Object.hasOwn(s.properties,k)&&matches(s.properties[k],v[k]));
 return false;
}
(async()=>{
 const samples={brandCore:quote,valueProposition:'Repairs',personas:[{name:'Owners',note:'Need repairs'}],toneOfVoice:['Clear'],messagingPillars:['Repair'],contentGuidelines:['Be clear'],keywords:['tools'],dosAndDonts:{dos:['Help'],donts:[]},brandVoiceExamples:{good:'Repair it',avoid:''},brandAssets:{typography:'Sans'},mission:'Repair',vision:'Reuse',values:'Care'};
 const format=responseFormat(),schema=format.json_schema.schema;
 assert.equal(format.type,'json_schema');assert.equal(format.json_schema.strict,true);
 const fields=Object.fromEntries(Object.keys(c.validators).map(k=>[k,null]));
 assert(matches(schema,{fields}));
 for(const [key,value]of Object.entries(samples)){
  assert(c.valid(key,value));assert(matches(schema,{fields:{...fields,[key]:item(value)}}),key);
 }
 for(let mask=1;mask<8;mask++){
  const assets=Object.fromEntries(['colors','typography','references'].filter((_,i)=>mask&(1<<i)).map(k=>[k,k==='typography'?'Sans':[]]));
  assert(matches(schema,{fields:{...fields,brandAssets:item(assets)}}));
 }
 assert(!matches(schema,{fields:{...fields,brandDNA:item('unsafe')}}));assert(!matches(schema,{fields:{...fields,personas:item('bad')}}));
 let calls=0;
 const partial=await request({fetch:async(_url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.model,'gpt-4.1-mini');assert.deepEqual(body.response_format,format);assert(body.messages.at(-1).content.includes(description));return model({brandCore:item(),personas:item('bad'),vision:null,mission:{value:null,classification:'missing',evidence:[]},'PRIVATE_UNKNOWN_KEY':item('secret')})()}});
 assert.equal(calls,1);assert.equal(partial.statusCode,200);assert.equal(partial.body.fields.brandCore.classification,'user_provided');assert.equal(partial.body.fields.personas.classification,'missing');assert.equal(partial.body.fields.vision.classification,'missing');assert.equal(partial.body.fields.PRIVATE_UNKNOWN_KEY,undefined);
 assert.deepEqual(partial.body.diagnostics.fieldIssues,[{fieldKey:'personas',category:'invalid_value'},{category:'unsupported_field'}]);
 assert.equal(partial.body.input.description,description);assert.match(partial.headers['X-Request-ID'],/^[a-f0-9-]{36}$/);assert.equal(partial.headers['X-Request-ID'],partial.body.diagnostics.requestId);
 assert(!JSON.stringify(partial.events).includes('Laurent'));assert(!JSON.stringify(partial.events).includes('PRIVATE_UNKNOWN_KEY'));
 for(const [key,value]of Object.entries(samples)){
  const d=await enrich(brand,input,{fetch:model({[key]:item(value)})});assert.equal(d.fields[key].value&&JSON.stringify(d.fields[key].value),JSON.stringify(value));
 }
 for(const malformed of [null,[],42,{value:quote,classification:'invented',evidence:[]},{value:quote,classification:'user_provided',evidence:null},JSON.parse('{"value":{"__proto__":{"polluted":true}},"classification":"user_provided","evidence":[]}')]){
  const d=await enrich(brand,input,{fetch:model({brandCore:item(),personas:malformed})});assert.equal(d.fields.brandCore.classification,'user_provided');assert.equal(d.fields.personas.classification,'missing');
 }
 const conflict=await enrich(brand,input,{fetch:model({brandCore:item(quote,'conflicting')})});assert.equal(conflict.fields.brandCore.classification,'conflicting');assert.throws(()=>c.adopt(brand.brand_core,conflict,'brandCore','accepted',quote));
 const unsupported=await enrich(brand,input,{fetch:model({brandCore:item('Invented biography','user_provided','user','Not in input')})});assert.equal(unsupported.fields.brandCore.classification,'missing');assert.throws(()=>c.adopt(brand.brand_core,unsupported,'brandCore','accepted','Invented biography'));assert(unsupported.diagnostics.fieldIssues.some(i=>i.category==='invalid_evidence'));
 const malformedEvidence=await enrich(brand,input,{fetch:model({brandCore:item(),personas:{value:samples.personas,classification:'website_supported',evidence:[]}})});assert.equal(malformedEvidence.fields.personas.classification,'missing');
 const site={selectedEvidence:[],sources:[],state:'partial'};
 for(const code of ['http_error','robots_disallowed','timeout','unsupported_content_type','response_too_large','parse_limit']){
  const d=await enrich(brand,{...input,domainUrl:'https://repair.example/'},{researchDomain:async()=>{throw Object.assign(new Error('private research text'),{code,research:clone(site)});},fetch:model({brandCore:item()})});
  assert.equal(d.fields.brandCore.classification,'user_provided');assert.equal(d.input.description,description);assert.equal(d.sourceIssue,code);assert.equal(d.diagnostics.websiteEvidenceSent,false);assert.equal(d.fields.mission.classification,'missing');assert.equal(d.fields.personas.classification,'missing');assert.equal(d.fields.founderStory,undefined);
 }
 const empty=await request({researchDomain:async()=>({research:clone(site)}),fetch:model({brandCore:item()})},{...input,domainUrl:'https://repair.example/'});assert.equal(empty.body.sourceIssue,'empty_content');assert.equal(empty.body.fields.brandCore.classification,'user_provided');
 const errors=[
  ['PROVIDER_UNAVAILABLE',async()=>({ok:false,status:503,json:async()=>({error:{message:'private provider detail'}})})],
  ['PROVIDER_AUTH_FAILED',async()=>({ok:false,status:401})],['PROVIDER_RATE_LIMITED',async()=>({ok:false,status:429})],
  ['PROVIDER_CONTEXT_TOO_LARGE',async()=>({ok:false,status:400,json:async()=>({error:{code:'context_length_exceeded',message:'private context'}})})],
  ['PROVIDER_SCHEMA_REJECTED',async()=>({ok:false,status:400,json:async()=>({error:{code:'invalid_json_schema',message:'private schema'}})})],
  ['PROVIDER_UNAVAILABLE',async()=>{throw new Error('private transport');}],
  ['INVALID_PROVIDER_RESPONSE',async()=>({ok:true,status:200,json:async()=>{throw new Error('private body');}})],
  ['UNSUPPORTED_MODEL_RESPONSE',async()=>({ok:true,status:200,json:async()=>({output:[]})})],
  ['UNSUPPORTED_MODEL_RESPONSE',async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'tool_calls',message:{content:null}}]})})],
  ['INVALID_MODEL_JSON',async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'not json'}}]})})],
  ['MODEL_RESPONSE_TRUNCATED',model({brandCore:item()},'length')],
  ['MODEL_RESPONSE_REFUSED',model({},'content_filter')],
  ['MODEL_RESPONSE_REFUSED',async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{refusal:'private refusal',content:null}}]})})],
  ['UNSUPPORTED_MODEL_RESPONSE',async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:[]}}]})})],
  ['MODEL_RESPONSE_TOO_LARGE',async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'x'.repeat(200001)}}]})})],
  ['INVALID_AI_OUTPUT',async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'{"fields":42}'}}]})})]
 ];
 for(const [code,fetch]of errors){let n=0;const r=await request({fetch:async(...args)=>{n++;return fetch(...args);}});assert.equal(n,1,'never retry');assert.equal(r.statusCode,502);assert.equal(r.body.code,code);assert.equal(r.body.diagnostics.validationCategory,code);assert.equal(r.body.fields,undefined);assert(!JSON.stringify(r.body).includes('private'));assert(!JSON.stringify(r.events).includes(quote));}
 const invalidInput=await request({fetch:()=>assert.fail('invalid input cannot infer')},{...input,description:'x'.repeat(50001)});assert.equal(invalidInput.body.code,'INVALID_DESCRIPTION');
 const fieldRequest=await enrich(brand,{...input,action:'suggest',field:'mission'},{fetch:async(_url,init)=>{const schema=JSON.parse(init.body).response_format.json_schema.schema;assert.deepEqual(Object.keys(schema.properties.fields.properties),['mission']);return model({mission:item('Careful repair','ai_interpretation'),brandCore:item()})();}});assert.equal(fieldRequest.fields.brandCore,undefined);assert.equal(fieldRequest.fields.mission.classification,'ai_interpretation');
 const priorKey=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 try{const missingKey=await request();assert.equal(missingKey.statusCode,503);assert.equal(missingKey.body.code,'PROVIDER_NOT_CONFIGURED');}finally{if(priorKey!==undefined)process.env.OPENAI_API_KEY=priorKey;}
 const blocked=await request({authorize:async()=>{throw Object.assign(new Error('private exception'),{status:400,code:'PRIVATE_ERROR'});}});assert.equal(blocked.body.code,'ENRICHMENT_FAILED');assert.deepEqual(Object.keys(blocked.body.diagnostics),['requestId']);assert(!JSON.stringify(blocked).includes('PRIVATE_ERROR'));
 const timeout=await request({setTimeout:cancel=>{queueMicrotask(cancel);return 1;},clearTimeout:()=>{},fetch:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('private abort')),{once:true}))});assert.equal(timeout.body.code,'PROVIDER_TIMEOUT');assert.equal(timeout.statusCode,504);
 const req=new EventEmitter(),res={...new EventEmitter(),setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};req.method='POST';req.body=input;
 await createHandler({getSessionUser:()=>({email:'fixture@example.test'}),authorize:async()=>brand,logDiagnostic:()=>{},fetch:(_url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('private cancel')),{once:true});req.emit('aborted');})})(req,res);assert.equal(res.body.code,'REQUEST_CANCELLED');assert.equal(res.statusCode,499);assert.equal(req.listenerCount('aborted'),0);
 let checks=0;const revoked=await request({authorize:async()=>{if(++checks>1)throw Object.assign(new Error(),{code:'PERMISSION_DENIED',status:403});return brand;},fetch:model({brandCore:item()})});assert.equal(revoked.statusCode,403);assert.deepEqual(Object.keys(revoked.body.diagnostics),['requestId']);assert(!JSON.stringify(revoked.events).includes('fieldIssues'));
 console.log('BW-46.5: structured field schemas, partial recovery, optional/missing fields, founder-description fallback, evidence/conflict protection, exact failure diagnostics, privacy, timeout/cancel, authorization and zero retries PASS. No live inference.');
})().catch(error=>{console.error(error);process.exitCode=1;});
