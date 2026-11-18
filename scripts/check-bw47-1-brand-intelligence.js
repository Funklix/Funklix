'use strict';
const assert=require('node:assert/strict');
const {enrich}=require('../api/_brand-enrichment');
const q=require('../api/_brand-enrichment-quality');
const c=require('../brand-enrichment-contract');
const f=require('./fixtures/bw47-1-brand-quality.json');
const {createHandler}=require('../api/enrich-brand-profile');
const clone=v=>JSON.parse(JSON.stringify(v));
const brand=()=>({id:'fictional',name:f.name,revision:7,brand_core:{brandCore:f.description,customTiles:[]}});
const item=(value,excerpt='Kälte- und Klimaanlagen',classification='ai_interpretation',sourceId='user')=>({value,classification,evidence:[{sourceId,excerpt}]});
const model=fields=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({fields})}}]})});
let calls=0;
async function run(input={},fields={},b=brand(),inspect=()=>{}){
 return enrich(b,{action:'draft',description:f.description,language:'de',...input},{researchDomain:()=>assert.fail('section generation never crawls'),fetch:async(_url,init)=>{calls++;inspect(JSON.parse(init.body));return model(fields);}});
}
(async()=>{
 assert.deepEqual(Object.keys(q.specs).sort(),Object.keys(c.validators).sort());
 assert.deepEqual(Object.keys(f.expected).sort(),Object.keys(c.validators).sort());
 for(const spec of Object.values(q.specs))for(const key of ['purpose','expectedContent','structure','sourceRequirements','relevantContext','qualityCriteria','commonErrors','missingInformation','language'])assert(spec[key]);
 for(const [section,targetFields]of Object.entries(c.sections)){
  const before=calls;
  const d=await run({section,targetFields},{brandCore:item('Kälte- und Klimaservice','Kälte- und Klimaanlagen','user_provided'),...Object.fromEntries(targetFields.filter(k=>f.good[k]).map(k=>[k,item(f.good[k])]))},brand(),body=>{
   assert.deepEqual(Object.keys(body.response_format.json_schema.schema.properties.fields.properties),targetFields);
   const prompt=body.messages.at(-1).content;for(const key of targetFields)assert(prompt.includes(q.specs[key].purpose));
   assert(prompt.includes('German'));assert(prompt.includes(section));assert(prompt.includes('never use unaccepted drafts as facts'));
  });
  assert.equal(calls,before+1);assert.equal(d.requestedSection,section);assert.deepEqual(d.targetFields,targetFields);assert.deepEqual(Object.keys(d.fields).sort(),[...targetFields].sort());assert.equal(d.revision,7);assert.equal(d.language,'de');
  if(section==='brand_identity')assert.deepEqual(d.unsupportedFields,['founder_story','brand_dna']);
  if(section==='brand_foundation'){assert.equal(d.fields.mission.classification,'missing');assert.equal(d.fields.vision.classification,'missing');assert(d.questions.some(x=>x.id==='mission'));}
  if(section==='audience_offers'){assert.equal(d.fields.personas.classification,'missing');assert(d.questions.some(x=>x.question.includes('Kaufentscheidung')));}
 }
 for(const input of [{section:'unknown',targetFields:['brandCore']},{section:'voice_messaging'},{section:'voice_messaging',targetFields:['mission']},{section:'brand_identity',targetFields:['founder_story']},{section:'brand_foundation',targetFields:['mission','mission']},{targetFields:['mission']},{section:'brand_foundation',targetFields:['mission'],domainUrl:'https://fictional.example/'},{language:'fr'}])await assert.rejects(()=>run(input),e=>e.code==='INVALID_INPUT');
 const legacy=await run();assert.equal(Object.keys(legacy.fields).length,13);assert.equal(legacy.requestedSection,null);
 const unchanged=await run({}, {brandCore:item(f.description,f.description.slice(0,100),'user_provided')});assert(!unchanged.questions.some(x=>x.id==='brandCore'),'known canonical fields do not trigger redundant questions');
 const single=await run({action:'suggest',field:'toneOfVoice'},{toneOfVoice:item(f.good.toneOfVoice),mission:item('Unsupported')});assert.deepEqual(Object.keys(single.fields),['toneOfVoice']);assert.equal(single.fields.toneOfVoice.classification,'ai_interpretation');
 for(const [key,value]of Object.entries(f.bad)){
  const d=await run({action:'suggest',field:key},{[key]:item(value)});assert.equal(d.fields[key].classification,'unavailable',key);assert.equal(d.fields[key].reason,'quality_review_required');assert(d.diagnostics.fieldIssues.some(i=>i.fieldKey===key));assert.deepEqual(d.fields[key].value,value,'preserve flagged proposal');assert.throws(()=>c.adopt(brand().brand_core,d,key,'accepted',value));
 }
 for(const [key,value]of Object.entries(f.good)){const d=await run({action:'suggest',field:key},{[key]:item(value)});assert.equal(d.fields[key].classification,'ai_interpretation',key);assert(d.fields[key].evidence.length);}
 for(const language of ['de','en']){
  const valid=language==='de'?['Erkläre die Technik und die Vorteile für unsere Kunden.']:['Explain the technology and the benefits for our customers.'];
  const foreign=language==='de'?['We are the partner for your customers and their needs.']:['Wir sind der Partner für unsere Kunden und ihre Bedürfnisse.'];
  const d=await run({language,section:'voice_messaging',targetFields:['contentGuidelines','toneOfVoice','dosAndDonts']},{contentGuidelines:item(valid),toneOfVoice:item(['North Star International','The House of the Future','Do It For You','HVAC','IoT','R290','B2B','Frostwerk Beispieltechnik']),dosAndDonts:item({dos:foreign,donts:[]})});
  assert.equal(d.fields.contentGuidelines.classification,'ai_interpretation');assert.equal(d.fields.toneOfVoice.classification,'ai_interpretation');assert.equal(d.fields.dosAndDonts.classification,'unavailable');assert(d.diagnostics.fieldIssues.some(i=>i.category==='language_mismatch'&&i.fieldKey==='dosAndDonts'));
  assert(q.mismatch({good:valid[0],avoid:foreign[0]},language));
 }
 assert.equal(q.mismatch('The House of the Future entwickelt Technik für unsere Kunden.','de',['The House of the Future']),false);
 const mixedGuidelines=await run({action:'suggest',field:'contentGuidelines'},{contentGuidelines:item([f.good.contentGuidelines[0],f.bad.contentGuidelines[0]])});assert.equal(mixedGuidelines.fields.contentGuidelines.classification,'unavailable','advertising copy among valid editorial rules still requires review');
 const mixed=await run({section:'voice_messaging',targetFields:['toneOfVoice','contentGuidelines','keywords']},{toneOfVoice:item(f.good.toneOfVoice),contentGuidelines:item(f.bad.contentGuidelines),keywords:{value:7,classification:'ai_interpretation',evidence:[]}});assert.equal(mixed.fields.toneOfVoice.classification,'ai_interpretation');assert.equal(mixed.fields.contentGuidelines.classification,'unavailable');assert.equal(mixed.fields.keywords.classification,'missing');
 const b=brand();b.brand_core.brandDNA={userApproved:false,primaryArchetype:'UNACCEPTED_DNA',signals:{draft:'SECRET_DRAFT'}};
 b.brand_core.customTiles=[{moduleType:'mission',content:'Accepted foundation purpose'},{moduleType:'founder_story',content:'UNACCEPTED_FOUNDER',moduleData:{founderStory:{founderNameRole:'draft'}}},{moduleType:'values',content:'UNACCEPTED_MODULE',moduleData:{draft:{content:'UNACCEPTED'}}},{moduleType:'market_research',moduleData:{marketResearch:{draft:{content:'UNACCEPTED_RESEARCH'}}}}];
 b.brand_core.customTiles.push({moduleType:'product_knowledge',content:'Accepted refrigeration service inventory'},{moduleType:'product_knowledge',content:'UNACCEPTED_PRODUCT',moduleData:{productKnowledge:{draft:{content:'UNACCEPTED'}}}},{moduleType:'custom',content:'User-saved purchasing context'});
 b.brand_core[c.KEY]={version:c.VERSION,inputs:{secret:{description:'PRIVATE_FULL_INPUT'}},fields:{brandCore:{decision:'accepted',value:b.brand_core.brandCore,evidence:[{excerpt:'Kälte- und Klimaanlagen',url:'https://fictional.example/?secret=1'}]},toneOfVoice:{decision:'postponed',value:['DRAFT'],evidence:[{excerpt:'UNACCEPTED_EVIDENCE'}]}}};
 await run({section:'voice_messaging',targetFields:['toneOfVoice']},{},b,body=>{const p=body.messages.at(-1).content;for(const secret of ['UNACCEPTED','SECRET_DRAFT','PRIVATE_FULL_INPUT'])assert(!p.includes(secret));assert(p.includes('Accepted foundation purpose'));assert(p.includes('Accepted refrigeration service inventory'));assert(p.includes('User-saved purchasing context'));assert(p.includes('reviewed:brandCore:0'));assert(p.includes('previously_reviewed_evidence'));assert(!p.includes('?secret'));});
 b.brand_core.brandDNA.userApproved=true;b.brand_core.brandDNA.primaryArchetype='Sage';delete b.brand_core.brandDNA.signals;
 b.brand_core.customTiles[1]={moduleType:'founder_story',content:'Accepted founder narrative',moduleData:{founderStoryLifecycle:{acceptedAt:'2026-11-01'},founderStory:{founderNameRole:'Alex, founder',motivation:'Accessible cooling'}}};
 await run({action:'suggest',field:'toneOfVoice'},{},b,body=>{const p=body.messages.at(-1).content;assert(p.includes('Sage'));assert(p.includes('Accessible cooling'));assert(p.includes('Accepted founder narrative'));});
 b.brand_core.customTiles.push(clone(b.brand_core.customTiles[1]));await run({action:'suggest',field:'toneOfVoice'},{},b,body=>assert(!body.messages.at(-1).content.includes('Accepted founder narrative')));
 const before=calls;const questions=await run({action:'questions',field:'mission'});assert.equal(calls,before);assert(questions.questions[0].question.includes('Veränderung'));const known=await run({action:'questions',field:'brandCore'});assert(known.questions[0].question.includes('präzisieren'),'explicit help for a populated field asks about a refinement decision');
 const skipped=await run({action:'suggest',field:'mission',answers:[]});assert.equal(skipped.fields.mission.classification,'missing');
 const answered=await run({action:'suggest',field:'mission',answers:[{id:'mission',answer:'Kühlung zugänglich machen.'}]},{mission:item('Kühlung zugänglich machen.','Kühlung zugänglich machen.')});assert.equal(answered.fields.mission.classification,'ai_interpretation');
 // Exercise the real HTTP boundary: scope errors do not infer; revoked access
 // after generation withholds all section content and diagnostics.
 async function request(input,authorize){const res={setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};await createHandler({getSessionUser:()=>({email:'fixture@example.test'}),authorize,logDiagnostic:()=>{},fetch:async()=>{calls++;return model({toneOfVoice:item(f.good.toneOfVoice)});}})({method:'POST',body:{action:'draft',section:'voice_messaging',targetFields:['toneOfVoice'],description:f.description,language:'de',...input}},res);return res;}
 const invalidBefore=calls;assert.equal((await request({targetFields:['mission']},async()=>brand())).statusCode,422);assert.equal(calls,invalidBefore);
 let checks=0;const revoked=await request({},async()=>{if(++checks>1)throw Object.assign(new Error(),{code:'PERMISSION_DENIED'});return brand();});assert.equal(revoked.statusCode,403);assert(!JSON.stringify(revoked.body).includes('Sachlich'));assert.deepEqual(Object.keys(revoked.body.diagnostics),['requestId']);
 console.log('BW-47.1 PASS: all 4 sections, 13 specifications, legacy/single-field, EN/DE nested mismatch, technical names, purpose/claim review, partial recovery, accepted context/evidence, draft isolation, specialized Founder/DNA, optional questions, HTTP scope/revocation. Mocked inference only; no model-quality claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});
