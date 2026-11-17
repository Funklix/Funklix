'use strict';
// Production controller, enrichment and protected writer/HTTP handlers; fictional data only.
const assert=require('node:assert/strict');
const {runtime,B,W,clone}=require('./fixtures/bw36-13r5-local-runtime');
const {createSession}=require('../brand-profile-setup');
const c=require('../brand-enrichment-contract'),writes=require('../brand-write-contract');
const samples={brandCore:'Workshop repair experts',valueProposition:'Keep tools useful',toneOfVoice:['Clear','Kind'],messagingPillars:['Repair','Reuse'],keywords:['tools','repair'],contentGuidelines:['Explain clearly'],personas:[{name:'Workshop owners',note:'Need practical advice'}],dosAndDonts:{dos:['Explain'],donts:['Invent']},brandVoiceExamples:{good:'Let us repair it',avoid:'Miracle repairs'},brandAssets:{colors:['#123456'],typography:'Sans',references:['Workshop']},mission:'Repair access',vision:'Less waste',values:'Care'};
const tile=type=>({id:'km_review_fixture_'+type,moduleType:type,title:type,content:''});
function draft(brand,values=samples){return {version:c.VERSION,brandId:B,revision:brand.revision,origin:'description_and_brand_context',originId:'review-fixture',input:{description:'Fictional workshop description'},fields:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value:clone(value),classification:'ai_interpretation',originId:'review-fixture',evidence:[{sourceId:'user',excerpt:'Fictional workshop description',origin:'explicit_user_input'}]}]))};}
async function fixture({confirm=()=>true,fail=false,readback=false,lostResponse=false}={}){
 const r=runtime(),counts={put:0,preview:0,get:0,confirm:0};
 r.db.brands[0].brand_core.toneOfVoice=['Saved voice','Careful'];
 const initial=(await r.request('GET','/api/brands/'+B)).body;
 let context={account:'review',generation:1,brandId:B,workspaceId:W,authorized:true};
 let session;
 session=createSession({brand:initial,getContext:()=>context,validateBrand:b=>b?.id===B&&Number.isSafeInteger(b.revision),onSave(){},createTile:type=>({...tile(type),id:'km_'+require('node:crypto').randomUUID()}),confirmReview:async()=>true,
 confirmEnrichmentReview:async(preview,review)=>{counts.confirm++;assert.deepEqual(preview.changes,review.command.changes);assert(preview.review_token);return confirm({preview,review,session,r,context});},
 fetchImpl:async(url,init={})=>{
  const method=init.method||'GET';if(method==='PUT')counts.put++;else if(url.endsWith('/write-preview'))counts.preview++;else counts.get++;
  if(fail&&method==='PUT')return {ok:false,status:503,json:async()=>({code:'DATABASE_UNAVAILABLE'})};
  const res=await r.request(method,url,init.body?JSON.parse(init.body):undefined,undefined,init.headers);
  if(lostResponse&&method==='PUT'){lostResponse=false;throw new Error('Fictional lost response after commit');}
  if(readback&&method==='GET')res.body.brand_core.brandCore='Unmatched authoritative readback';
  return {ok:res.statusCode<300,status:res.statusCode,json:async()=>clone(res.body)};
 }});
 session.state.enrichment=draft(initial);return {r,session,counts,setContext:value=>{context={...context,...value};}};
}
(async()=>{
 // Deterministic all-type plan and excluded reasons, preserving nested siblings/special owners.
 const core={brandAssets:{domain:'https://workshop.example',future:{keep:true}},future:{keep:true},brandDNA:{userApproved:true},customTiles:[{id:'km_founder_fixture',moduleType:'founder_story',content:'Accepted founder',moduleData:{keep:true}}]};
 const d=draft({revision:1});const a=c.plan(core,d,{revision:1,createTile:tile});assert.deepEqual(a.accepted,Object.keys(samples).sort());assert.deepEqual(a,c.plan(core,d,{revision:1,createTile:tile}));assert.deepEqual(a.core.brandAssets.future,core.brandAssets.future);assert.deepEqual(a.core.brandDNA,core.brandDNA);assert.deepEqual(a.core.customTiles[0],core.customTiles[0]);assert.equal(core.brandCore,undefined);
 for(const classification of ['missing','unavailable','conflicting']){const x=clone(d);x.fields.brandCore.classification=classification;assert(!c.plan(core,x,{revision:1,createTile:tile}).accepted.includes('brandCore'));}
 assert.equal(c.plan(core,d,{revision:2,createTile:tile}).accepted.length,0);assert.equal(c.plan(core,d,{revision:1,authorized:false,createTile:tile}).accepted.length,0);
 const unsupported=clone(d);unsupported.fields.brandCore.value={unexpected:true};assert(!c.plan(core,unsupported,{revision:1,createTile:tile}).accepted.includes('brandCore'));
 for(const tiles of [[{...tile('mission'),moduleData:{accepted:true}}],[tile('mission'),{...tile('mission'),id:'km_duplicate_mission'}]])assert(!c.plan({...core,customTiles:tiles},d,{revision:1,createTile:tile}).accepted.includes('mission'));
 assert.equal(c.plan({},d,{revision:1,createTile:tile}).accepted.length,13,'empty Brand can accept every supported type');assert(!c.plan({toneOfVoice:'Legacy shape'},d,{revision:1,createTile:tile}).accepted.includes('toneOfVoice'));
 console.log('PASS deterministic all-type plan; missing/conflicting/unavailable/stale/permission/shape/specialized exclusions');
 const f=await fixture(),before=clone(f.r.db.brands[0]),snapshot=clone(f.r.db.boards);
 f.session.state.enrichment.fields.brandCore.classification='conflicting';assert(f.session.editEnrichment('valueProposition','My edited outcome'));
 assert.equal(f.session.editEnrichment('keywords',[7]),false);assert(!f.session.enrichmentPlan().accepted.includes('keywords'));
 assert(await f.session.acceptAllEnrichment(),f.session.state.message);
 assert.equal(f.counts.put,1);assert.equal(f.r.db.brands[0].revision,before.revision+1);assert.equal(f.counts.get,1);assert.equal(f.counts.preview,1);assert.equal(f.counts.preview,f.counts.confirm);
 const saved=f.r.db.brands[0];assert.equal(saved.brand_core.valueProposition,'My edited outcome');assert(saved.brand_core[c.KEY].fields.valueProposition.userEdited);assert.equal(saved.brand_core[c.KEY].fields.valueProposition.proposedValue,samples.valueProposition);
 for(const key of Object.keys(samples).filter(k=>!['brandCore','keywords','valueProposition'].includes(k))){const actual=c.target(saved.brand_core,key);if(key==='brandAssets')for(const part of Object.keys(samples[key]))assert.deepEqual(actual[part],samples[key][part]);else assert.deepEqual(actual,samples[key]);assert.equal(saved.brand_core[c.KEY].fields[key].decision,'accepted');}
 assert.deepEqual(Object.keys(f.session.state.enrichment.fields).sort(),['brandCore','keywords']);assert.deepEqual(f.r.db.boards,snapshot);
 assert(await f.session.decideEnrichment('brandCore','postponed'));assert.equal(f.r.db.brands[0].brand_core[c.KEY].fields.brandCore.decision,'postponed');assert(f.session.editEnrichment('keywords',['manual']));assert(await f.session.decideEnrichment('keywords','accepted'));assert.equal(Object.keys(f.session.state.enrichment.fields).length,0);
 // Every saved type can be corrected, reloaded, corrected again and cleared.
 for(const suffix of [' corrected',' edited again','']) {
  assert(await f.session.reload());
  for(const [key,value]of Object.entries(samples)){
   const next=typeof value==='string'?(suffix?value+suffix:''):Array.isArray(value)?(suffix?key==='personas'?[{name:'New owner',note:suffix}]:[suffix]:[]):key==='brandAssets'?{...f.session.state.core.brandAssets,colors:[],typography:suffix,references:[]}:key==='dosAndDonts'?{dos:suffix?[suffix]:[],donts:[]}:{good:suffix,avoid:''};
   if(c.modules.includes(key))f.session.state.core.customTiles.find(t=>t.moduleType===key).content=next;else f.session.state.core[key]=next;
  }
  assert(await f.session.save(),f.session.state.message);
 }
 assert(await f.session.reload());assert.deepEqual(f.session.state.core.toneOfVoice,[]);assert.equal(c.target(f.session.state.core,'mission'),'');assert.deepEqual(f.r.db.boards,snapshot);
 console.log('PASS all field types; edited bulk; exactly one protected PUT/revision/readback; remaining individual/postponed decisions; save/reload/edit-again/clear');
 for(const mode of ['cancel','failure','stale','revoked','switch','mismatch']) {
  const x=await fixture({fail:mode==='failure',readback:mode==='mismatch',confirm:({context,r})=>{
    if(mode==='switch')context.brandId='different';
    if(mode==='revoked'){r.db.membershipStatus='revoked';}
    return mode!=='cancel';
  }});
  // Existing array/evidence makes a protected preview mandatory.
  x.session.state.enrichment.fields.toneOfVoice.value=['Replacement'];
  const original=clone(x.r.db.brands[0]),pending=clone(x.session.state.enrichment);
  if(mode==='stale')x.r.db.brands[0].revision++;
  assert.equal(await x.session.acceptAllEnrichment(),false,mode);
  if(mode!=='mismatch') {assert.deepEqual(clone(x.r.db.brands[0].brand_core),original.brand_core,mode+' preserves saved values');assert.deepEqual(x.session.state.enrichment,pending,mode+' preserves review draft');}
  else {assert(x.session.state.syncRequired);assert.deepEqual(x.session.state.enrichment,pending);}
  if(['cancel','switch'].includes(mode))assert.equal(x.counts.put,0,mode+' zero writes');
  console.log('PASS '+mode+' never reports full success');
 }
 const retry=await fixture({lostResponse:true}),revision=retry.r.db.brands[0].revision;
 assert.equal(await retry.session.acceptAllEnrichment(),false);assert.equal(retry.r.db.brands[0].revision,revision+1);
 assert(await retry.session.acceptAllEnrichment(),retry.session.state.message);assert.equal(retry.r.db.brands[0].revision,revision+1,'lost response retry reuses module IDs and the original mutation receipt');assert.equal(retry.counts.confirm,1);assert.equal(retry.counts.preview,1);
 console.log('PASS response-loss retry reuses original command/token/receipt, including new module identities');
 // Unrelated callers still receive the legacy first argument and retain token/confirmation.
 const legacy=await fixture();const brand=legacy.session.state.brand;const command=writes.command(brand,{brand_core:{toneOfVoice:['Legacy replacement']}},W);let confirms=0,puts=0;
 const response=await writes.submit({brandId:B,command,pending:{},confirmReview:async(message,preview)=>{confirms++;assert(message.startsWith('Review these Brand changes:'));assert(message.includes('/brand_core/toneOfVoice'));assert(preview.review_token);return true;},fetchImpl:async(url,init)=>{if(init.method==='PUT')puts++;const res=await legacy.r.request(init.method,url,JSON.parse(init.body),undefined,init.headers);return {ok:res.statusCode<300,json:async()=>clone(res.body)};}});
 assert(response.response.ok);assert.equal(confirms,1);assert.equal(puts,1);
 console.log('PASS existing unrelated protected write confirmation behavior and server token');
})().catch(e=>{console.error(e);process.exitCode=1;});
