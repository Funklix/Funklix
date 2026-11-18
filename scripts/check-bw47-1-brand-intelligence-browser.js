'use strict';
// Actual controller, handler, review UI, protected write and authoritative read.
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
const fixture=require('./fixtures/bw47-1-brand-quality.json');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const language of ['de','en']){
  const f=await require('./fixtures/home-browser')(browser)({empty:true});
  try{
   const p=f.page,key=k=>p.locator(`[data-profile-key="${k}"]`);let calls=0,research=0;
   const snapshot=clone(f.r.db.boards);
   const handler=f.r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),researchDomain:()=>{research++;assert.fail('must reuse context');},fetch:async(_url,init)=>{
    calls++;const body=JSON.parse(init.body);assert.deepEqual(Object.keys(body.response_format.json_schema.schema.properties.fields.properties),['toneOfVoice','contentGuidelines','dosAndDonts']);
    const value=language==='de'?['Sachlich und nahbar']:['Clear and approachable'];
    const wrong=language==='de'?'We are the best partner for your customers and their needs.':'Wir sind der beste Partner für unsere Kunden und ihre Bedürfnisse.';
    const record=value=>({value,classification:'ai_interpretation',evidence:[{sourceId:'user',excerpt:'Kälte- und Klimaanlagen'}]});
    return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({fields:{toneOfVoice:record(value),contentGuidelines:record(language==='de'?fixture.bad.contentGuidelines:['We are your reliable partner.']),dosAndDonts:record({dos:[wrong],donts:[]})}})}}]})};
   }});
   await p.route('**/api/enrich-brand-profile',async route=>{const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};await handler({method:'POST',body:route.request().postDataJSON()},res);await route.fulfill({status:res.statusCode,json:res.body});});
   await p.evaluate(language=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);translateInterface();openRegularBrandProfile();},language);
   await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
   const before=clone(f.r.db.brands[0]);
   assert(await p.evaluate(description=>brandProfileController.enrichProfile({action:'draft',section:'voice_messaging',targetFields:['toneOfVoice','contentGuidelines','dosAndDonts'],description}),fixture.description));
   assert.equal(calls,1);assert.equal(research,0);assert.deepEqual(clone(f.r.db.brands[0]),before);
   assert.equal(await key('accept-enrichment-toneOfVoice').count(),1);assert.equal(await key('accept-enrichment-contentGuidelines').count(),0);assert.equal(await key('accept-enrichment-dosAndDonts').count(),0);
   assert.equal(await key('advanced-enrichment-contentGuidelines').count(),1);assert.equal(await key('advanced-enrichment-dosAndDonts').count(),1);
   const diagnostics=await p.locator('.profile-enrichment-diagnostics').textContent();assert(diagnostics.includes(language==='de'?'Ausgabesprache':'output language'));assert(diagnostics.includes(language==='de'?'Zweck dieses Feldes':'serves this field'));
   const eligible=await p.evaluate(()=>brandProfileController.enrichmentPlan().accepted);assert.deepEqual(eligible,['toneOfVoice']);
   await key('accept-all-enrichment').click();await p.waitForFunction(()=>!brandProfileController.busy()||!!document.querySelector('.brand-suggestion-dialog[open]'));
   if(await p.locator('.brand-suggestion-dialog[open]').count())await p.locator('.brand-suggestion-dialog[open] .fk-btn-primary').click();
   await p.waitForFunction(()=>!brandProfileController.busy());assert.deepEqual(f.r.db.brands[0].brand_core.toneOfVoice,language==='de'?['Sachlich und nahbar']:['Clear and approachable']);
   assert.equal(f.writes.filter(w=>w.method==='PUT').length,1);assert.equal(f.r.db.brands[0].revision,before.revision+1);assert.deepEqual(f.r.db.boards,snapshot);assert.equal(calls,1);
   await p.locator('[data-disclosure="proposal-attention:dosAndDonts"]>summary').click();await key('postpone-enrichment-dosAndDonts').click();
   await p.waitForFunction(()=>{document.querySelector('.brand-suggestion-dialog[open] .fk-btn-primary')?.click();return !brandProfileController.busy();});
   const decision=f.r.db.brands[0].brand_core._profileEvidence.fields.dosAndDonts;assert.equal(decision.decision,'postponed');assert.deepEqual(decision.qualityIssues,['language_mismatch']);assert.equal(calls,1);assert.deepEqual(f.r.db.boards,snapshot);
   assert(await p.evaluate(()=>brandProfileController.reload()));
   // Existing mobile/theme controls render diagnostics without a new navigation.
   await p.setViewportSize({width:375,height:900});await p.evaluate(()=>{document.documentElement.dataset.theme='dark';brandProfileController.render();});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(f.errors,[]);
  }finally{f.writes.length=0;await f.close();}
 }}finally{await browser.close();}
 console.log('BW-47.1 browser PASS: EN/DE section request, field diagnostics, valid-only bulk acceptance, zero recrawl/automatic inference, protected reload, snapshot isolation, mobile/dark.');
})().catch(e=>{console.error(e);process.exitCode=1;});
