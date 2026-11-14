'use strict';
// Actual application submission/controller/parser, safe research engine, protected
// writer and authoritative reload. Only website transport and model are mocked.
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {EventEmitter}=require('node:events');
const {chromium}=require('playwright-core');
const {retrieveWebsiteText}=require('../api/_website-retrieval');
const {researchDomain}=require('../api/_brand-domain-research');
const {EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
const website='https://repair.example/',quote='We repair tools.';
const description=quote+' Laurent Krall is the founder. This is unverified user input about his background and personality.';
function research(empty=false,conflicting=false){return researchDomain(website,{noDelay:true,retrieveWebsiteText:(url,options)=>retrieveWebsiteText(url,{...options,lookup:async()=>[{address:'93.184.216.34',family:4}],requestImpl:(opts,callback)=>{
 const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const robots=opts.path==='/robots.txt',home=opts.path==='/';const response=Readable.from([Buffer.from(robots?'User-agent: *\nAllow: /':home?(empty?'<html><body></body></html>':'<main><p>'+(conflicting?'We do not repair tools.':quote)+'</p></main>'):'missing')]);response.statusCode=robots||home?200:404;response.headers={'content-type':robots?'text/plain':'text/html'};callback(response);});return req;
 }})});}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const language of ['en','de']){
  const f=await require('./fixtures/home-browser')(browser)({empty:true});
  try{
   const p=f.page,key=k=>p.locator(`[data-profile-key="${k}"]`);p.setDefaultTimeout(30000);
   const snapshot=clone(f.r.db.boards),saved=clone(f.r.db.brands[0].brand_core);let mode='one',calls=0;const submissions=[],events=[];
   const handler=f.r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),logDiagnostic:e=>events.push(clone(e)),
    researchDomain:async()=>{if(mode==='no-site')throw Object.assign(new Error('private site'),{code:'unsupported_content_type'});return research(mode==='empty',mode==='conflict');},
    setTimeout:fn=>{if(mode==='timeout'){queueMicrotask(fn);return null;}return setTimeout(fn,30000);},clearTimeout,
    fetch:async(_url,init)=>{
     calls++;assert.equal(JSON.parse(init.body).response_format.type,'json_schema');assert.equal(JSON.parse(init.body).model,'gpt-4.1-mini');
     if(mode==='error')return {ok:false,status:429};
     if(mode==='timeout')return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('private timeout')),{once:true}));
     const input=submissions.at(-1),sourceId=input.domainUrl&&mode!=='no-site'?'s1':'user';
     let fields={brandCore:{value:'Tool repair proposal '+calls,classification:'website_supported',evidence:[{sourceId,excerpt:quote}]}};
     if(mode==='multiple'||mode==='mixed')fields.toneOfVoice={value:['Clear','Practical'],classification:'ai_interpretation',evidence:[{sourceId,excerpt:quote}]};
     if(mode==='mixed'){fields.personas={value:'malformed',classification:'user_provided',evidence:[]};fields.brandDNA={value:'forbidden',classification:'user_provided',evidence:[]};}
     if(mode==='conflict'){fields.brandCore.classification='conflicting';fields.brandCore.evidence=[{sourceId:'s1',excerpt:'We do not repair tools.'},{sourceId:'user',excerpt:quote}];}
     if(mode==='empty')fields={};
     fields.mission=null;fields.vision={value:null,classification:'missing',evidence:[]};
     return {ok:true,status:200,json:async()=>({choices:[{finish_reason:mode==='truncated'?'length':'stop',message:{content:JSON.stringify({fields})}}]})};
    }});
   await p.route('**/api/enrich-brand-profile',async route=>{
    submissions.push(route.request().postDataJSON());const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=clone(body);return this;}};
    await handler({method:'POST',body:submissions.at(-1)},res);await route.fulfill({status:res.statusCode,json:res.body});
   });
   await p.evaluate(language=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);translateInterface();openRegularBrandProfile();},language);await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
   assert.equal(calls,0);
   const idle=()=>p.waitForFunction(()=>!brandProfileController.busy());
   async function start(domain,text){
    if(!await p.locator('.profile-discovery').evaluate(n=>n.open))await p.locator('.profile-discovery>summary').click();
    await key('research-domain').fill(domain);await key('research-description').fill(text);await key('research-start').click();await idle();
   }
   async function reset(){
    if(await key('Discard enrichment draft').count())await key('Discard enrichment draft').click();await key('Overview').click();
   }
   for(const [domain,text,testMode]of [[website,'','one'],['',description,'multiple'],[website,description,'mixed']]){
    mode=testMode;const before=clone(f.r.db.brands[0]);await start(domain,text);
    assert.equal(submissions.at(-1).action,'draft');assert.equal(submissions.at(-1).brandId,before.id);assert.equal(submissions.at(-1).revision,before.revision);assert.equal(submissions.at(-1).language,language);
    assert.deepEqual(clone(f.r.db.brands[0]),before,'draft generation never writes existing values');
    assert.equal(await key('enrichment-brandCore').count(),1);assert.equal(await key('accept-enrichment-mission').count(),0);assert.equal(await key('accept-enrichment-vision').count(),0);
    if(mode==='mixed'){
     assert.equal(await key('enrichment-toneOfVoice').count(),1);assert.equal(await key('accept-enrichment-personas').count(),0);
     const details=await p.locator('.profile-enrichment-diagnostics').textContent();assert(details.includes(language==='de'?'ungültiger Feldwert':'invalid field value'));assert(details.includes(language==='de'?'nicht unterstütztes Feld':'unsupported field'));
    }
    const value='Reviewed '+testMode;await key('enrichment-brandCore').fill(value);await key('accept-enrichment-brandCore').click();await idle();
    assert.equal(f.r.db.brands[0].brand_core.brandCore,value);
    const evidence=f.r.db.brands[0].brand_core._profileEvidence.fields.brandCore;assert.equal(evidence.decision,'accepted');assert.equal(evidence.classification,domain?'website_supported':'user_provided');
    assert.equal(f.r.db.brands[0].brand_core._profileEvidence.inputs[evidence.originId].description,text);
    await p.evaluate(async()=>brandProfileController.reload());await idle();assert.equal(f.r.db.brands[0].brand_core.brandCore,value);await reset();
    await key('Brand description').fill(value+' manual');await key('Confirm and save Brand Profile').click();await idle();await key('Reload latest Brand').click();await idle();assert.equal(await key('Brand description').inputValue(),value+' manual');
   }
   for(const [testMode,category]of [['error','PROVIDER_RATE_LIMITED'],['timeout','PROVIDER_TIMEOUT'],['truncated','MODEL_RESPONSE_TRUNCATED']]){
    mode=testMode;const before=clone(f.r.db.brands[0]),n=calls;await start(website,description);assert.equal(calls,n+1,'no paid retries');assert.deepEqual(clone(f.r.db.brands[0]),before);
    assert.equal(await key('research-description').inputValue(),description);assert.equal(await key('research-domain').inputValue(),website);
    assert.equal(await key('enrichment-brandCore').count(),0);assert((await p.locator('.profile-enrichment-diagnostics').textContent()).includes(category));
   }
   mode='conflict';await start(website,description);assert.equal(await key('accept-enrichment-brandCore').count(),0);assert.equal(await p.evaluate(()=>brandProfileController.state.enrichment.fields.brandCore.evidence.length),2);await reset();
   mode='empty';const beforeEmpty=calls;await start(website,'');assert.equal(calls,beforeEmpty,'empty website evidence must not infer');assert.equal(await key('enrichment-brandCore').count(),0);assert.equal(await p.evaluate(()=>brandProfileController.state.research?.selectedEvidence?.length),0);await reset();
   mode='no-site';await start(website,description);assert.equal(await key('enrichment-brandCore').count(),1);assert.equal(await p.evaluate(()=>brandProfileController.state.enrichment.fields.brandCore.classification),'user_provided');
   assert.equal(await p.evaluate(()=>brandProfileController.state.enrichment.input.description),description);
   assert.deepEqual(clone(f.r.db.boards),snapshot);for(const key of ['brandDNA','customTiles'])assert.deepEqual(clone(f.r.db.brands[0].brand_core[key]),saved[key]);
   assert(!JSON.stringify(events).includes('Laurent'));assert(!JSON.stringify(events).includes('We repair tools.'));
   console.log('PASS BW-46.5 actual browser '+language+': website/description/both, real research→provider schema→parser→UI→explicit acceptance→protected save→reload→manual edit, partial field recovery, provider/timeout/truncation, conflicts, empty evidence, founder-description fallback, existing saved values/snapshots');
  }finally{f.writes.length=0;await f.close();}
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
