'use strict';
// Actual forms -> protected HTTP handlers -> disposable SQL adapter -> reload.
// SQL authorization/history is separately exercised by the PostgreSQL suites.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const {clone,B,W,runtime}=require('./fixtures/bw36-13r5-local-runtime');
const registry=require('../knowledge-module-registry');
async function characterizeKnownDefects(){
 const r=runtime(), brand=(await r.request('GET','/api/brands/'+B)).body;
 const session=require('../brand-profile-setup').createSession({brand,getContext:()=>({account:'fictional',generation:1,brandId:B,workspaceId:W}),
  fetchImpl:async(url,init={})=>{const out=await r.request(init.method || 'GET',url,init.body?JSON.parse(init.body):undefined,undefined,init.headers);return {ok:out.statusCode<300,status:out.statusCode,json:async()=>out.body};},
  validateBrand:b=>b.id===B&&Number.isSafeInteger(b.revision),confirmReview:async()=>true,onSave(){},onLogo(){}});
 session.state.dnaDraft={primaryArchetype:'Hero',secondaryArchetype:'Sage'};
 session.state.core.brandDNA={primaryArchetype:'Lover',secondaryArchetype:'Creator'};
 assert.equal(await session.acceptDna(),true);
 assert.equal((await r.request('GET','/api/brands/'+B)).body.brand_core.brandDNA.primaryArchetype,'Hero','F6 characterization: generated draft currently wins over stored-core input binding; separate fix required');
 const context=require('../api/_brand-brain-context').normalizeBrandBrainData({personas:[{name:'Makers',note:'Need affordable repairs'}]});
 assert(JSON.stringify(context.icp).includes('affordable repairs'),'F2 regression: persona note remains in normalized campaign audience');
 console.log('VERIFIED F2 persona note repair; CHARACTERIZED remaining F6 DNA draft binding defect.');
}
(async()=>{
 await characterizeKnownDefects();
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const f=await require('./fixtures/home-browser')(browser)({empty:true,prepare(r){
   const core=r.db.brands[0].brand_core;
   core.personas=[{name:'Manual audience',note:'Manual need',future:{keep:true}}];
   core.brandDNA={userApproved:true,primaryArchetype:'Creator',secondaryArchetype:'Sage',primaryConfidence:80,secondaryConfidence:70,personality:'Thoughtful',positioning:'Repair partner',reasoning:'User reasoning',recommendedVoice:'Clear',recommendedVisualDirection:'Simple',signals:{toneSignals:['Clear']},avatar:{userApproved:true,imageUrl:'/scripts/fixtures/brand-avatar-original.png',future:'keep'}};
   core.customTiles=['mission','vision','values','founder_story'].map((type,i)=>({id:`km_11111111-1111-4111-8111-${String(i).padStart(12,'0')}`,moduleType:type,title:type,content:'User '+type,moduleData:type==='founder_story'?{founderStory:{founderNameRole:'Nova, founder',observedProblem:'Repair waste',motivation:'Keep tools useful',turningPoint:'Workshop opened',background:'Repair training',proofPoints:'Fictional prototype',vision:'Circular tools'},founderStoryLifecycle:{status:'accepted',acceptedAt:'2026-11-01T00:00:00Z'}}:{}}));
   core.brandAssets={domain:'https://northstar.example/',colors:['#123456'],typography:'User sans',references:['User reference'],future:'keep'};
   core.future={nested:{keep:true}};
  }});
  f.r.suggestions.unsupportedFixtureField='Never persist this value';
  const p=f.page; p.setDefaultTimeout(45000); await p.emulateMedia({reducedMotion:'reduce'});
  const key=k=>p.locator(`[data-profile-key="${k}"]`),results=[];
  const snapshot=clone(f.r.db.boards[0]), original=clone(f.r.db.brands[0]);
  await p.evaluate(()=>openRegularBrandProfile());await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
  const beforeAI=clone(f.r.db.brands[0].brand_core);
  await p.route('**/api/analyze-brand-domain',async route=>{
   const res=await f.r.request('POST','/api/analyze-brand-domain',route.request().postDataJSON());
   await route.fulfill({status:res.statusCode,json:res.body});
  });
  await p.locator('.profile-legacy-research').evaluate(n=>n.open=true);await key('Analyze website').click();await p.waitForFunction(()=>!brandProfileController.busy());
  assert.equal(await p.evaluate(()=>brandProfileController.state.analysis),'Review website suggestions');
  assert.equal(f.r.db.brands[0].brand_core.unsupportedFixtureField,undefined);
  assert(await p.evaluate(()=>brandProfileController.state.research.rejectedFields.some(f=>f.field==='unsupportedFixtureField')));
  for(const k of ['personas','brandDNA','customTiles','brandAssets','future']) assert.deepEqual(f.r.db.brands[0].brand_core[k],beforeAI[k],k+' preserved during analysis');
  // A conflicting website proposal has acceptance controls but no value editor.
  assert.equal(await key('proposal-personas').count(),1);
  assert.equal(await p.locator('.profile-proposal textarea,.profile-proposal input').count(),0);
  await key('proposal-personas').click();await p.waitForFunction(()=>!brandProfileController.busy());
  assert.equal(f.r.db.brands[0].brand_core.personas[0].name,'Local audience');
  const controls=[
   ['Overview','Brand name','/name','Northstar Edited'],['Overview','Website','/brand_core/brandAssets/domain','https://northstar.example/edited'],
   ['Overview','Brand description','/brand_core/brandCore','Manually corrected website description'],['Overview','Value Proposition','/brand_core/valueProposition','Manually corrected benefit'],
   ...['mission','vision','values','founder_story'].map(type=>['Overview',registry.getModuleDefinition(type).label,`/brand_core/customTiles/${type}/content`,'Edited '+type]),
   ['Audience','persona-0-name','/brand_core/personas/0/name','Corrected audience'],['Audience','persona-0-note','/brand_core/personas/0/note','Corrected need'],
   ...[['Tone of Voice','toneOfVoice'],['Key messages','messagingPillars'],['Content guidelines','contentGuidelines'],['Keywords','keywords']].map(([label,field])=>['Voice & Messaging',label,'/brand_core/'+field,'Edited '+field]),
   ...[['dosAndDonts-dos','dosAndDonts/dos'],['dosAndDonts-donts','dosAndDonts/donts'],['brandVoiceExamples-good','brandVoiceExamples/good'],['brandVoiceExamples-avoid','brandVoiceExamples/avoid']].map(([id,path])=>['Voice & Messaging',id,'/brand_core/'+path,'Edited '+id]),
   ...['colors','typography','references'].map(part=>['Brand Assets','brandAssets-'+part,'/brand_core/brandAssets/'+part,part==='colors'?'#abcdef':'Edited '+part]),
   ...['primaryArchetype','secondaryArchetype','personality','positioning','reasoning','recommendedVoice','recommendedVisualDirection'].map(part=>['Brand DNA','dna-'+part,'/brand_core/brandDNA/'+part,part==='primaryArchetype'?'Sage':part==='secondaryArchetype'?'Creator':'Edited '+part])
  ];
  const get=(brand,path)=>path.split('/').slice(1).reduce((v,k)=>k==='customTiles'?v[k]:Array.isArray(v)&&!/^\d+$/.test(k)?v.find(t=>t.moduleType===k):v?.[k],brand);
  async function saveReload(){
   await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());
   assert.equal(await p.evaluate(()=>brandProfileController.state.dirty),false,await p.evaluate(()=>brandProfileController.state.message));
   await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());
  }
  for(const [section,id] of controls){await key(section).click();await key(id).fill(controls.find(c=>c[1]===id)[3]);}
  await saveReload();
  for(const [section,id,path,value] of controls){
   await key(section).click();assert.equal(await key(id).inputValue(),value,id+' stored and reloaded');
   const actual=get(f.r.db.brands[0],path);assert.deepEqual(actual,Array.isArray(actual)?[value]:value,path);
   results.push({path,editor:'guided',manualEditSaveReload:'pass',clear:'pending'});
  }
  assert.deepEqual(f.r.db.brands[0].brand_core.brandDNA.avatar,original.brand_core.brandDNA.avatar);
  assert.deepEqual(f.r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='founder_story').moduleData,original.brand_core.customTiles.find(t=>t.moduleType==='founder_story').moduleData);
  // Clearing required name is rejected visibly; all other ordinary guided fields
  // use their existing contract, including scalar archetype corrections.
  await key('Overview').click();await key('Brand name').fill('');await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());
  assert.match(await p.evaluate(()=>brandProfileController.state.message),/Brand name between/);await key('Brand name').fill('Northstar Edited');
  for(const [section,id,path] of controls){if(path==='/name')continue;await key(section).click();await key(id).fill('');}
  await saveReload();
  for(const [section,id,path] of controls){
   if(path==='/name'){results.find(r=>r.path===path).clear='required-name validation pass';continue;}
   await key(section).click();assert.equal(await key(id).inputValue(),'');const actual=get(f.r.db.brands[0],path);assert.deepEqual(actual,Array.isArray(actual)?[]:'',path+' cleared');results.find(r=>r.path===path).clear='pass';
  }
  // Canonical structured modules have no dedicated guided controls. Verify actual
  // advanced JSON editor input, protected save and forced reload for each leaf.
  const beforeAdvanced=clone(f.r.db.brands[0].brand_core), advanced=clone(beforeAdvanced);
  advanced.personality='Patient';advanced.positioning='Repair partner';advanced.audiences=['Makers'];advanced.offers=[{name:'Tool repair',benefit:'Longer life'}];advanced.proof=[{evidence:'Fictional workshop'}];
  advanced.brandDNA.primaryConfidence=81;advanced.brandDNA.secondaryConfidence=71;advanced.brandDNA.alternatives=[{archetype:'Caregiver',confidence:60,why:'Repair care'}];
  advanced.brandDNA.signals=Object.fromEntries(['toneSignals','missionSignals','audienceSignals','messagingSignals','visualSignals'].map(k=>[k,['Edited '+k]]));
  const types=['audience','icp','product_knowledge','competitor_research','custom','website_analysis','pitch_deck','whitepaper','market_research','business_plan'];
  for(const [i,type] of types.entries()){
   const tile={id:`km_22222222-2222-4222-8222-${String(i).padStart(12,'0')}`,moduleType:type,title:'Fictional '+type,content:'Edited '+type,moduleData:{}};
   if(['market_research','business_plan'].includes(type)){
    const source=fs.readFileSync('api/generate-'+type.replace('_','-')+'.js','utf8');
    const keys=source.match(/const keys = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s=>s.slice(1,-1));
    const appSource=fs.readFileSync('app.js','utf8');
    const config=require('node:vm').runInNewContext(appSource.slice(appSource.indexOf('const STRATEGY_MODULE_CONFIG ='),appSource.indexOf('const STRATEGY_LIFECYCLE_STATUSES'))+';STRATEGY_MODULE_CONFIG')[type];
    const listKeys=new Set(config.fields.flatMap(([,fields])=>fields).filter(f=>f[2]).map(f=>f[0]));
    assert.deepEqual(keys,clone(config.fields.flatMap(([,fields])=>fields).map(f=>f[0])));
    const namespace=config.namespace;
    tile.moduleData[namespace]={accepted:{revisionId:'fixture-accepted',acceptedAt:'2026-11-01T00:00:00Z',content:'Accepted fixture',structuredFacts:Object.fromEntries(keys.map(k=>[k,listKeys.has(k)?['Edited '+k]:'Edited '+k]))},draft:{content:'Draft fixture',structuredFacts:Object.fromEntries(keys.map(k=>[k,listKeys.has(k)?['Draft '+k]:'Draft '+k]))},lifecycle:{status:'accepted'}};
   }
   advanced.customTiles.push(tile);
  }
  const founder=advanced.customTiles.find(t=>t.moduleType==='founder_story');
  for(const k of Object.keys(founder.moduleData.founderStory))founder.moduleData.founderStory[k]='Edited '+k;
  async function advancedSave(core){
   await key('Advanced options').click();await p.locator('#brand-workspace-edit-open').click();await p.locator('#brand-workspace-edit-core').waitFor({state:'visible'});
   await p.locator('#brand-workspace-edit-core').fill(JSON.stringify(core));await p.locator('#brand-workspace-edit-save').click();
   await p.waitForFunction(()=>canonicalBrandDetail.status==='ready');
   await p.getByRole('button',{name:'Back to Brand Profile',exact:true}).click();await p.waitForFunction(()=>brandProfileController&&!brandProfileController.busy());
   await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());
  }
  await advancedSave(advanced);
  assert.deepEqual(f.r.db.brands[0].brand_core,advanced,'all advanced fields persisted');
  function leaves(value,path=''){
   if(Array.isArray(value))return value.length?value.flatMap((v,i)=>leaves(v,path+'/'+i)):[[path,[]]];
   if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>leaves(v,path+'/'+k));return [[path,value]];
  }
  const actual=await p.evaluate(()=>brandProfileController.state.brand.brand_core);
  for(const tile of actual.customTiles.filter(t=>['market_research','business_plan'].includes(t.moduleType))) {
   const projected=require('../api/_brand-brain-context').projectAcceptedStrategyModule(tile);assert(projected,'accepted module reaches downstream projection');
   const namespace=tile.moduleType==='market_research'?'marketResearch':'businessPlan';
   for(const [field,value] of Object.entries(tile.moduleData[namespace].accepted.structuredFacts)){
    if(field==='sourceNotes'){assert(!JSON.stringify(projected).includes('Edited sourceNotes'),'known sourceNotes omission remains documented');continue;}
    assert(JSON.stringify(projected).includes('Edited '+field),'accepted '+field+' reaches context');
   }
  }
  for(const [path,value] of leaves(advanced)){
   assert.deepEqual(path.split('/').slice(1).reduce((v,k)=>v[k],actual),value,path);
   if(!results.some(r=>r.path==='/brand_core'+path))results.push({path:'/brand_core'+path,editor:'advanced JSON',manualEditSaveReload:JSON.stringify(path.split('/').slice(1).reduce((v,k)=>v?.[k],beforeAdvanced))===JSON.stringify(value)?'preserved; edit not exercised':'pass',clear:'not exercised'});
  }
  const cleared=clone(advanced);
  for(const k of ['personality','positioning'])cleared[k]='';
  for(const k of ['audiences','offers','proof'])cleared[k]=[];
  cleared.brandDNA.alternatives=[];
  for(const k of Object.keys(cleared.brandDNA.signals))cleared.brandDNA.signals[k]=[];
  for(const tile of cleared.customTiles){
   tile.content='';
   if(tile.moduleData?.founderStory)for(const k of Object.keys(tile.moduleData.founderStory))tile.moduleData.founderStory[k]='';
   for(const namespace of ['marketResearch','businessPlan'])if(tile.moduleData?.[namespace])for(const state of ['accepted','draft']){
    const data=tile.moduleData[namespace][state];data.content='';
    for(const k of Object.keys(data.structuredFacts))data.structuredFacts[k]=Array.isArray(data.structuredFacts[k])?[]:'';
   }
  }
  await advancedSave(cleared);assert.deepEqual(f.r.db.brands[0].brand_core,cleared,'advanced clearing survives protected save and authoritative reload');
  for(const result of results.filter(r=>r.editor==='advanced JSON')){
   const path=result.path.split('/').slice(2);
   const old=path.reduce((v,k)=>v?.[k],advanced), next=path.reduce((v,k)=>v?.[k],cleared);
   if(JSON.stringify(old)!==JSON.stringify(next))result.clear='pass';
  }
  assert.deepEqual(f.r.db.boards[0],snapshot,'no canonical save modifies Canvas snapshot');
  // Research coverage is text-only and follows EN/DE plus existing theme styles.
  await key('Overview').click();await key('Website').fill('https://northstar.example/');await p.locator('.profile-legacy-research').evaluate(n=>n.open=true);await key('Analyze website').click();await p.waitForFunction(()=>!brandProfileController.busy());
  for(const theme of ['light','dark'])for(const language of ['en','de']){
   await p.evaluate(({theme,language})=>{document.documentElement.dataset.theme=theme;state.uiLanguage=language;brandProfileController.render();},{theme,language});
   const details=p.locator('.guided-brand-profile details').filter({hasText:language==='de'?'Abdeckung der Website-Recherche':'Website research coverage'});await details.locator('summary').click();assert(await details.isVisible());assert((await details.textContent()).includes(language==='de'?'Nicht unterstützte Vorschlagsfelder wurden ausgeschlossen.':'Unsupported suggestion fields were excluded.'));assert((await details.textContent()).includes('→ https://example.test/'));assert.equal(await details.locator('script,iframe').count(),0);
  }
  fs.mkdirSync('work/bw46-1',{recursive:true});fs.writeFileSync('work/bw46-1/field-results.json',JSON.stringify(results,null,2));
  assert.deepEqual(f.errors,[]);await p.close();
  // Viewer enforcement uses the same production HTTP route, independent of UI.
  f.r.db.brands[0].owner_email='another@example.test';f.r.db.brandRole='viewer';
  const denied=await f.r.request('POST','/api/analyze-brand-domain',{brandId:B,domainUrl:'https://northstar.example/'});assert.equal(denied.statusCode,403);
  console.log(`PASS BW-46.1: ${controls.length} guided field bindings entered, saved, reloaded, manually corrected and cleared; ${results.length} inspected leaf paths; advanced JSON protected saves; preservation; viewer denial; snapshot isolation; EN/DE light/dark coverage. Advanced content clearing tested; lifecycle metadata clearing and specialized strategy UI remain explicitly untested.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
