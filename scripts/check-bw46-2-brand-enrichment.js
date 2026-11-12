'use strict';
const assert=require('node:assert/strict');
const {enrich}=require('../api/_brand-enrichment');
const contract=require('../brand-enrichment-contract');
const {runtime,B,W,EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
const {createSession}=require('../brand-profile-setup');
const fixture=()=>({id:B,revision:1,brand_core:{brandCore:'Repair consultancy',brandDNA:{userApproved:true,primaryArchetype:'Sage'},personas:[{name:'Founders',note:'Need clear operations',unknown:'retain'}],customTiles:[],future:{keep:1}}});
const description='We are a Hamburg-based consultancy helping owner-led companies improve marketing, sales and operations.';
const model=fields=>async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields})}}]})});
const item=(value,classification='user_provided',excerpt='Hamburg-based consultancy',sourceId='user')=>({value,classification,evidence:[{sourceId,excerpt}]});
(async()=>{
 let calls=0;
 let draft=await enrich(fixture(),{action:'draft',description},{fetch:async(...args)=>{calls++;assert(JSON.parse(args[1].body).messages[1].content.includes(description));return model({brandCore:item('Consultancy in Hamburg')})(...args);}});
 assert.equal(calls,1);assert.equal(draft.fields.brandCore.classification,'user_provided');assert.equal(draft.fields.mission.classification,'missing');assert.equal(draft.input.description,description);
 await assert.rejects(()=>enrich(fixture(),{action:'draft',description},{fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"fields":42}'}}]})})}));
 const short=await enrich(fixture(),{action:'draft',description:'Tool repair.'},{fetch:model({brandCore:item('Tool repair.','user_provided','Tool repair.')})});assert.equal(short.fields.brandCore.value,'Tool repair.');
 const long=description+' Detailed user evidence.'.repeat(1800);await enrich(fixture(),{action:'draft',description:long},{fetch:async(_url,init)=>{assert(JSON.parse(init.body).messages[1].content.includes(long));return model({})()}});
 const q=await enrich(fixture(),{action:'questions',field:'mission',language:'de'},{fetch:()=>assert.fail('questions must not infer')});assert(q.questions[0].question.includes('Veränderung'));
 const answered=await enrich(fixture(),{action:'suggest',field:'mission',answers:[{id:'mission',answer:'Make repairs accessible'}]},{fetch:model({mission:item('Make repairs accessible','ai_interpretation','Make repairs accessible')})});assert.equal(answered.fields.mission.classification,'ai_interpretation');
 assert.throws(()=>contract.adopt({customTiles:[{id:'km_approved_mission',moduleType:'mission',content:'Approved mission',moduleData:{accepted:{status:'accepted'}}}]},answered,'mission','accepted','Replacement'),'general adoption cannot replace specialized approved module data');
 const skipped=await enrich(fixture(),{action:'suggest',field:'mission',answers:[]},{fetch:model({})});assert.equal(skipped.fields.mission.classification,'missing');
 const withEvidence=fixture();withEvidence.brand_core._profileEvidence={version:contract.VERSION,inputs:{private:{description:'Do not serialize the full private original brief'}},fields:{brandCore:{decision:'accepted',value:withEvidence.brand_core.brandCore,evidence:[{excerpt:'Independent workshops need clear repairs.',url:'https://repair.example/about?token=private',sourceClassification:'visible_text'}]}}};const reused=await enrich(withEvidence,{action:'suggest',field:'mission'},{fetch:async(_url,init)=>{const prompt=JSON.parse(init.body).messages.at(-1).content;assert(prompt.includes('Independent workshops need clear repairs.'));assert(!prompt.includes('Do not serialize the full private original brief'));return model({mission:item('Make workshop repairs accessible','ai_interpretation','Independent workshops need clear repairs.','reviewed:brandCore:0')})()}});assert.equal(reused.fields.mission.evidence[0].origin,'accepted_field_evidence');
 const conflict=await enrich(fixture(),{action:'draft',description},{fetch:model({brandCore:item('Conflicting history','conflicting','invalid quote')})});assert.equal(conflict.fields.brandCore.classification,'conflicting');assert.throws(()=>contract.adopt(fixture().brand_core,conflict,'brandCore','accepted','Anything'));
 const unsupported=await enrich(fixture(),{action:'draft',description},{fetch:model({brandCore:item('Invented founder','website_supported','Invented quote')})});assert.equal(unsupported.fields.brandCore.classification,'missing');
 const site={version:'brand-domain-research/v1',selectedEvidence:[{sourceId:'s1',url:'https://repair.example/about?token=secret',excerpt:'Our workshop repairs tools.'}],sources:[{id:'s1',evidenceKind:'visible_text'}]};
 for(const input of [{action:'draft',domainUrl:'https://repair.example/'},{action:'draft',domainUrl:'https://repair.example/',description}]){
 const web=await enrich(fixture(),input,{researchDomain:async()=>({research:clone(site)}),fetch:model({brandCore:item('Tool repairs','website_supported','Our workshop repairs tools.','s1')})});
 assert.equal(web.fields.brandCore.classification,'website_supported');assert.equal(web.fields.brandCore.evidence[0].url,'https://repair.example/about');assert.equal(web.fields.brandCore.evidence[0].sourceClassification,'visible_text');}
 for(const fetch of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({choices:[{message:{content:'invalid'}}]})}),model({brandDNA:item('bad')})])await assert.rejects(()=>enrich(fixture(),{action:'draft',description},{fetch}));
 const partial=await enrich(fixture(),{action:'draft',description,domainUrl:'https://repair.example/'},{researchDomain:async()=>{throw Object.assign(new Error('unavailable'),{code:'http_error',research:{selectedEvidence:[],sources:[],state:'partial'}})},fetch:model({brandCore:item('Partial consultancy')})});assert.equal(partial.sourceIssue,'http_error');assert.equal(partial.fields.brandCore.classification,'user_provided');
 await assert.rejects(()=>enrich(fixture(),{action:'draft',description,domainUrl:'https://127.0.0.1'},{researchDomain:async()=>{throw Object.assign(new Error('unsafe'),{code:'unsafe_destination'})},fetch:()=>assert.fail('unsafe URL must never reach inference')}));
 const r=runtime();let output={brandCore:item('Consultancy in Hamburg')};let infer=0;
 const handler=r.load('api/enrich-brand-profile.js').createHandler({fetch:async(...args)=>{infer++;return model(output)(...args)}});
 async function request(body,user={email:EMAIL}){
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.statusCode=s;return this},json(v){this.body=clone(v);return this}};
  await handler({method:'POST',body,headers:{cookie:user?'funklix_session='+r.load('api/_auth-session.js').createSessionToken(user):''}},res);return res;
 }
 const body={brandId:B,workspaceId:W,revision:1,action:'draft',description};
 const revoking=r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),fetch:async()=>{r.db.membershipStatus='revoked';return model({brandCore:item('Never disclose revoked draft')})()}});const revoked={setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await revoking({method:'POST',body},revoked);assert.equal(revoked.statusCode,403);assert(!JSON.stringify(revoked.body).includes('Never disclose'));r.db.membershipStatus='accepted';
 assert.equal((await request(body,null)).statusCode,401);assert.equal(infer,0);
 const beforeQuestions=infer;assert.equal((await request({...body,action:'questions',field:'personas',language:'de'})).statusCode,200);assert.equal(infer,beforeQuestions,'production questions do not call a model');
 r.db.membershipStatus='revoked';assert.equal((await request(body)).statusCode,403);r.db.membershipStatus='accepted';
 r.db.brands[0].owner_email='other@example.test';r.db.brandRole='viewer';assert.equal((await request(body)).statusCode,403);r.db.brands[0].owner_email=EMAIL;r.db.brandRole='owner';
 const lateStale=r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),fetch:async()=>{r.db.brands[0].revision++;return model({brandCore:item('Never return stale generation')})()}});const staleResponse={setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await lateStale({method:'POST',body},staleResponse);assert.equal(staleResponse.statusCode,409);assert(!JSON.stringify(staleResponse.body).includes('Never return'));r.db.brands[0].revision=1;
 assert.equal((await request({...body,workspaceId:B})).statusCode,403);assert.equal((await request({...body,revision:2})).statusCode,409);
 const withoutEvidence=clone(r.db.brands[0].brand_core);r.db.brands[0].brand_core={_profileEvidence:{version:contract.VERSION,fields:{},inputs:{}}};assert.equal((await r.request('POST','/api/discover-brand-dna',{brandId:B,revision:1})).statusCode,400,'private metadata alone is not meaningful DNA context');r.db.brands[0].brand_core=withoutEvidence;
 r.db.brands[0].brand_core.future={nested:{keep:true}};r.db.brands[0].brand_core.brandAssets.future='Retained visual metadata';
 r.db.brands[0].brand_core.brandDNA={userApproved:true,primaryArchetype:'Sage',avatar:{userApproved:true,imageUrl:'https://fictional.example/avatar.png'}};r.db.brands[0].brand_core.customTiles=[{id:'km_fictional_founder',moduleType:'founder_story',content:'Accepted workshop story',moduleData:{founderStory:{founderNameRole:'Nova, founder',motivation:'Repair access'},founderStoryLifecycle:{status:'accepted',acceptedAt:'2026-11-01T00:00:00Z'}}}];
 const founderBefore=clone(r.db.brands[0].brand_core.customTiles[0]);
 const initial=await r.request('GET','/api/brands/'+B);const snapshot=clone(r.db.boards);
 let context={account:'test',generation:1,brandId:B,workspaceId:W,authorized:true};
 const session=createSession({brand:initial.body,getContext:()=>context,validateBrand:b=>b?.id===B&&Number.isSafeInteger(b.revision),confirmReview:async()=>true,onSave(){},createTile:type=>({id:'km_fictional_'+type,moduleType:type,title:type,content:''}),fetchImpl:async(url,init={})=>{
 const res=url==='/api/enrich-brand-profile'?await request(JSON.parse(init.body)):await r.request(init.method||'GET',url,init.body?JSON.parse(init.body):undefined,undefined,init.headers);return {ok:res.statusCode<300,status:res.statusCode,json:async()=>clone(res.body)};}});
 const before=clone(r.db.brands[0]);assert(await session.enrichProfile({description}));assert.deepEqual(clone(r.db.brands[0]),before,'generation must not mutate even empty values');
 assert(session.editEnrichment('brandCore','User edited proposal'));assert(await session.decideEnrichment('brandCore','accepted'));
 let saved=(await r.request('GET','/api/brands/'+B)).body;
 assert.equal(saved.brand_core.brandCore,'User edited proposal');assert.equal(saved.brand_core._profileEvidence.fields.brandCore.userEdited,true);assert.equal(Object.values(saved.brand_core._profileEvidence.inputs)[0].description,description);
 assert.equal(contract.publicCore(saved.brand_core)._profileEvidence,undefined);assert.deepEqual(clone(r.db.boards),snapshot);
 assert(await session.reload());session.state.core.brandCore='Manual after reload';assert(await session.save());assert.equal(r.db.brands[0].brand_core.brandCore,'Manual after reload');session.state.core.brandCore='';assert(await session.save());assert.equal(r.db.brands[0].brand_core.brandCore,'');
 output={valueProposition:item('Clear repairs','ai_interpretation')};assert(await session.enrichProfile({description}));assert(await session.decideEnrichment('valueProposition','rejected'));assert.equal(r.db.brands[0].brand_core.valueProposition,'');
 assert(await session.enrichProfile({description}));assert(await session.decideEnrichment('valueProposition','postponed'));assert.equal(r.db.brands[0].brand_core._profileEvidence.fields.valueProposition.decision,'postponed');
 output={mission:item('Accessible repairs','ai_interpretation')};assert(await session.enrichProfile({description}));assert(await session.decideEnrichment('mission','accepted'));assert.equal(r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='mission').content,'Accessible repairs');

 const samples={brandCore:'Reviewed business',valueProposition:'Reviewed customer outcome',personas:[{name:'Owners',note:'Need repair clarity'}],toneOfVoice:['Approachable'],messagingPillars:['Repair'],contentGuidelines:['Clear words'],keywords:['tools'],dosAndDonts:{dos:['Explain'],donts:['Invent']},brandVoiceExamples:{good:'Repair together',avoid:'Guaranteed miracles'},brandAssets:{colors:['#123456'],typography:'Sans',references:['Workshop']},mission:'Reviewed accessible repairs',vision:'Circular tools',values:'Care'};
 output=Object.fromEntries(Object.entries(samples).map(([key,value])=>[key,item(value,'ai_interpretation')]));
 assert(await session.enrichProfile({description}));
 const protectedDna=clone(r.db.brands[0].brand_core.brandDNA);
 for(const key of Object.keys(samples)){
  assert(await session.decideEnrichment(key,'accepted'),key+' protected adoption');
  const actual=clone(contract.target(r.db.brands[0].brand_core,key));if(key==='brandAssets')for(const part of Object.keys(samples[key]))assert.deepEqual(actual[part],samples[key][part]);else assert.deepEqual(actual,samples[key],key+' saved');
 }
 assert(await session.reload());
 for(const [key,value] of Object.entries(samples)){
  const changed=typeof value==='string'?value+' edited':Array.isArray(value)?[]:key==='brandAssets'?{...value,typography:'User font'}:key==='dosAndDonts'?{dos:['User correction'],donts:[]}:{good:'User example',avoid:''};
  if(contract.modules.includes(key))session.state.core.customTiles.find(t=>t.moduleType===key).content=changed;else session.state.core[key]=changed;
 }
 assert(await session.save());assert(await session.reload());
 for(const key of Object.keys(samples)){
  if(contract.modules.includes(key))session.state.core.customTiles.find(t=>t.moduleType===key).content='';
  else session.state.core[key]=typeof samples[key]==='string'?'':Array.isArray(samples[key])?[]:key==='brandAssets'?{...session.state.core.brandAssets,colors:[],typography:'',references:[]}:key==='dosAndDonts'?{dos:[],donts:[]}:{good:'',avoid:''};
 }
 assert(await session.save());assert(await session.reload());assert.deepEqual(clone(r.db.brands[0].brand_core.brandDNA),protectedDna);
 assert.deepEqual(clone(r.db.boards),snapshot);
 output={brandCore:item('Stale value')};assert(await session.enrichProfile({description}));r.db.brands[0].revision++;r.db.brands[0].brand_core.brandCore='Newer';assert.equal(await session.decideEnrichment('brandCore','accepted'),false);assert.equal(r.db.brands[0].brand_core.brandCore,'Newer');
 assert(await session.reload());assert(await session.enrichProfile({description}));context={...context,authorized:false};assert.equal(await session.decideEnrichment('brandCore','accepted'),false);
 assert.deepEqual(clone(r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='founder_story')),founderBefore);assert.deepEqual(clone(r.db.brands[0].brand_core.future),{nested:{keep:true}});assert.equal(r.db.brands[0].brand_core.brandAssets.future,'Retained visual metadata');
 const created=await r.request('POST','/api/projects',{contract:'project_command_v1',request_id:require('node:crypto').randomUUID(),workspace_id:W,project_name:'Private evidence isolation',brand:{existing_id:B}});assert.equal(created.statusCode,201,'existing enriched Brand project creation remains functional');assert(!Object.hasOwn(created.body.board.brand_core_snapshot,contract.KEY),'new campaign does not receive private provenance');
 const normalized=require('../api/_brand-brain-context').normalizeBrandBrainData({personas:[{name:'Founders',description:'Owners',note:'Need affordable repairs'}],_profileEvidence:{private:'never project'}});assert(JSON.stringify(normalized.icp).includes('affordable repairs'));assert(!JSON.stringify(normalized).includes('never project'));
 assert.deepEqual(clone(r.db.boards.slice(0,snapshot.length)),snapshot);
 console.log('BW-46.2: description, mixed/domain evidence, questions/answers/skips, malformed/provider errors, production ACL, explicit edit/adopt/reject/postpone, protected save/reload/clear, stale updates, persona context and snapshot isolation PASS. No paid calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
