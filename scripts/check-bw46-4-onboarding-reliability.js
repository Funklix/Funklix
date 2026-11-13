'use strict';
// Fictional public-HTML structure. This is NOT a capture of eiskrallt.de.
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {EventEmitter}=require('node:events');
const {retrieveWebsiteText}=require('../api/_website-retrieval');
const {researchDomain}=require('../api/_brand-domain-research');
const {enrich}=require('../api/_brand-enrichment');
const {createHandler}=require('../api/enrich-brand-profile');
const contract=require('../brand-enrichment-contract');
const ORIGIN='https://frostspur.example';
const copy='Wir reparieren Werkzeuge für lokale Werkstätten.';
const homepage=`<!doctype html><html lang="de"><head><title>Frostspur Werkstatt</title></head><body><nav><a href="#angebot">Angebot</a><a href="#kontakt">Kontakt</a></nav><main><h1>Frostspur Werkstatt</h1><p>${copy}</p><section id="angebot">Reparaturen statt Wegwerfen.</section></main></body></html>`;
function transport(graph={}){
 const requests=[];
 return {requests,noDelay:true,retrieveWebsiteText:(url,options)=>retrieveWebsiteText(url,{...options,lookup:async()=>[{address:'93.184.216.34',family:4}],requestImpl:(opts,cb)=>{
  const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{
   requests.push(opts.hostname+opts.path);assert.equal(opts.protocol,'https:');assert(!opts.headers.Authorization&&!opts.headers.Cookie);
   const entry=graph[opts.hostname+opts.path]||graph[opts.path]||{status:404,body:'missing'};
   const stream=Readable.from([Buffer.from(entry.body||'')]);stream.statusCode=entry.status||200;stream.headers={'content-type':entry.type||'text/html',...entry.headers};cb(stream);
  });return req;
 }})};
}
const graph=()=>({'/robots.txt':{type:'text/plain',body:'User-agent: *\nAllow: /'},'/':{body:homepage}});
const brand={id:'11111111-1111-4111-8111-111111111111',revision:1,name:'Frostspur',brand_core:{brandAssets:{domain:''},customTiles:[]}};
const supported={value:'Werkzeugreparatur für lokale Werkstätten.',classification:'website_supported',evidence:[{sourceId:'s1',excerpt:copy}]};
const model=fields=>async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields})}}]})});
const input={action:'draft',domainUrl:ORIGIN,brandId:brand.id,workspaceId:'22222222-2222-4222-8222-222222222222',revision:1};
async function request(deps,body=input){
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=JSON.parse(JSON.stringify(v));return this;}};
 await createHandler({getSessionUser:()=>({email:'fixture@example.test'}),authorize:async()=>brand,...deps})({method:'POST',body},res);return res;
}
(async()=>{
 const t=transport(graph());let calls=0;
 const draft=await enrich(brand,input,{...t,fetch:async(...args)=>{calls++;const prompt=JSON.parse(args[1].body).messages.at(-1).content;assert(prompt.includes(copy));return model({brandCore:supported,mission:{value:null,classification:'missing',evidence:[]},brandAssets:{value:null,classification:'missing',evidence:[]}})(...args);}});
 assert.equal(calls,1);assert.equal(draft.fields.brandCore.classification,'website_supported');assert.equal(draft.fields.mission.classification,'missing');assert.throws(()=>contract.adopt(brand.brand_core,draft,'mission','accepted','Invented mission'));
 assert.equal(draft.research.processing.stage,'draft_ready');
 assert.deepEqual(draft.research.counts,{discovered:1,fetched:1,extracted:1,processed:1,unavailable:0,rejected:0,deferred:0});
 assert(draft.research.selectedEvidence.length>0);assert.equal(t.requests.length,3,'robots, homepage and missing sitemap only');
 assert.equal(draft.research.documents.find(d=>d.kind==='sitemap').retrieval,'unavailable');
 const nav=graph();nav['/'].body=homepage+'<nav><a href="./about">Über uns</a><a href="/services">Leistungen</a><a href="/contact#team">Kontakt</a><a href="/about">Über uns</a></nav>';
 for(const path of ['/about','/services','/contact'])nav[path]={body:'<p>'+path+' unterstützt Werkstätten.</p>'};
 const multiple=await researchDomain(ORIGIN,transport(nav));assert.equal(multiple.research.counts.discovered,4);assert.equal(multiple.research.counts.extracted,4);assert.equal(multiple.research.counts.processed,0);assert(multiple.research.sources.every(s=>s.selectedUnits>0));
 const redirect=graph();redirect['/']={status:301,headers:{location:'https://www.frostspur.example/'}};redirect['www.frostspur.example/']={body:homepage};
 const redirected=await researchDomain(ORIGIN,transport(redirect));assert(redirected.research.sources.some(s=>s.finalUrl==='https://www.frostspur.example/'));assert.equal(redirected.research.counts.extracted,1);
 const failures=[
  ['provider_request','PROVIDER_UNAVAILABLE',async()=>({ok:false})],
  ['provider_request','PROVIDER_UNAVAILABLE',async()=>{throw new Error('private provider detail');}],
  ['provider_response','INVALID_AI_OUTPUT',async()=>({ok:true,json:async()=>{throw new SyntaxError('private response');}})],
  ['model_json','INVALID_AI_OUTPUT',async()=>({ok:true,json:async()=>({choices:[{message:{content:'not JSON'}}]})})],
  ['model_fields','INVALID_AI_OUTPUT',model({personas:{value:'invalid',classification:'website_supported',evidence:[]}})],
  ['model_fields','INVALID_AI_OUTPUT',model({mission:{value:null,classification:'website_supported',evidence:[]}})]
 ];
 for(const [stage,code,fetch]of failures){
  const r=await request({...transport(graph()),fetch});assert.equal(r.statusCode,502);assert.equal(r.body.code,code);assert.equal(r.body.research.processing.stage,stage);assert.equal(r.body.research.counts.processed,0);assert(r.body.research.selectedEvidence.some(e=>e.excerpt===copy));assert.equal(r.body.research.sources[0].processing,'provider_failed');assert(!JSON.stringify(r.body).includes('private provider'));
 }
 const empty=graph();empty['/'].body='<meta name="description" content="'+'x'.repeat(20000)+'">';
 const none=await request({...transport(empty),fetch:()=>assert.fail('no selected evidence must not trigger inference')});assert.equal(none.statusCode,422);assert.equal(none.body.code,'NO_USABLE_WEBSITE_EVIDENCE');assert.equal(none.body.research.counts.extracted,1);assert.equal(none.body.research.selectedEvidence.length,0);assert.equal(none.body.research.counts.processed,0);
 for(const [code,status]of [['http_error',502],['robots_disallowed',422],['unsafe_destination',400],['unsupported_scheme',400],['timeout',504],['unrecognized_private_error',502]]){
  const res=await request({researchDomain:async()=>{throw Object.assign(new Error('private website detail'),{code});},fetch:()=>assert.fail('failed retrieval cannot infer')});
  assert.equal(res.statusCode,status);assert.equal(res.body.code,code==='unrecognized_private_error'?'ENRICHMENT_FAILED':code);assert(!JSON.stringify(res.body).includes('private website detail'));
 }
 const badAttribution=await enrich(brand,input,{...transport(graph()),fetch:model({brandCore:{...supported,evidence:[{sourceId:'s1',excerpt:'Invented quote'}]}})});assert.equal(badAttribution.fields.brandCore.classification,'missing');assert.equal(badAttribution.fields.brandCore.evidence.length,0);
 const partial=await enrich(brand,input,{...transport(nav),fetch:model({brandCore:supported})});assert.equal(partial.research.state,'partial');assert.equal(partial.fields.brandCore.classification,'website_supported');
 let checks=0;const revoked=await request({...transport(graph()),authorize:async()=>{if(++checks>1)throw Object.assign(new Error(),{code:'PERMISSION_DENIED',status:403});return brand;},fetch:async()=>({ok:false})});assert.equal(revoked.statusCode,403);assert.equal(revoked.body.research,undefined,'never disclose evidence after access revocation');
 console.log('BW-46.4 API: fictional one-page/multi-link/no-sitemap/redirect structures, exact event counts, selected evidence retention, provider and validation boundaries, nullable missing fields, strict proposals, invalid attribution, partial drafts, no-evidence no-inference, access revocation PASS. Original incident remains unverified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
