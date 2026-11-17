'use strict';
// Actual application and protected server handlers. Fictional provider, no paid calls.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const {EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
const samples={brandCore:'Workshop repair experts',valueProposition:'Keep tools useful',toneOfVoice:['Clear','Kind'],messagingPillars:['Repair','Reuse'],keywords:['tools','repair'],contentGuidelines:['Explain clearly'],personas:[{name:'Workshop owners',note:'Need practical advice'}],dosAndDonts:{dos:['Explain'],donts:['Invent']},brandVoiceExamples:{good:'Let us repair it',avoid:'Miracle repairs'},brandAssets:{colors:['#123456'],typography:'Sans',references:['Workshop']},mission:'Repair access',vision:'Less waste',values:'Care'};
(async()=>{
 fs.mkdirSync('work/bw46-6/screenshots',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const language of ['en','de']){
  const f=await require('./fixtures/home-browser')(browser)({empty:true,prepare(r){r.db.brands[0].brand_core.toneOfVoice=['Existing voice','Saved tone'];r.db.brands[0].brand_core.brandAssets.future={keep:true};}});
  try{
   const p=f.page,key=k=>p.locator(`[data-profile-key="${k}"]`);let calls=0,native=0;
   p.on('dialog',()=>native++);
   const handler=f.r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),fetch:async()=>{calls++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({fields:Object.fromEntries(Object.entries(samples).map(([key,value])=>[key,{value,classification:key==='brandCore'?'conflicting':'ai_interpretation',evidence:[{sourceId:'user',excerpt:'Fictional workshop description'}]}]))})}}]})};}});
   await p.route('**/api/enrich-brand-profile',async route=>{const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=clone(v);return this;}};await handler({method:'POST',body:route.request().postDataJSON()},res);await route.fulfill({status:res.statusCode,json:res.body});});
   await p.evaluate(language=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);translateInterface();openRegularBrandProfile();},language);await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
   await p.evaluate(()=>{brandProfileController.state.researchEntry.description='Fictional workshop description';});
   // Use production controller generation; rendered controls own every subsequent edit/decision.
   assert(await p.evaluate(()=>brandProfileController.enrichProfile({description:'Fictional workshop description'})));
   assert.equal(calls,1);assert.equal(await key('accept-all-enrichment').textContent(),(language==='de'?'Alle Vorschläge übernehmen':'Accept all suggestions')+' (12)');
   assert(!/ai_interpretation|website_supported|\/brand_core\/|_profileEvidence/.test(await p.locator('.profile-section').textContent()),'friendly field/classification labels');
   assert.equal(await p.locator('.profile-enrichment-proposal textarea').evaluateAll(nodes=>nodes.filter(n=>/^\s*[\[{]/.test(n.value)).length),0,'no raw JSON primary editor');
   const card=field=>p.locator('.profile-enrichment-proposal[data-field="'+field+'"]');
   await card('toneOfVoice').locator('[data-disclosure="proposal-edit:toneOfVoice"]>summary').click();
   await key('enrichment-toneOfVoice-0').fill('Warm');await key('enrichment-toneOfVoice-add').click();await key('enrichment-toneOfVoice-2').fill('Practical');await key('enrichment-toneOfVoice-2--1').click();await key('enrichment-toneOfVoice-remove-2').click();
   assert.deepEqual(await p.evaluate(()=>brandProfileController.state.enrichmentEdits.toneOfVoice),['Warm','Practical']);
   await key('enrichment-toneOfVoice-0').fill('x'.repeat(5001));assert.equal(await key('accept-enrichment-toneOfVoice').isDisabled(),true);assert((await key('accept-all-enrichment').textContent()).endsWith('(11)'));
   await key('Overview').click();await key('Review').click();assert.equal(await key('enrichment-toneOfVoice-0').inputValue(),'x'.repeat(5001),'invalid typed draft survives navigation and remains correctable');
   await card('toneOfVoice').locator('[data-disclosure="proposal-edit:toneOfVoice"]>summary').click();await key('enrichment-toneOfVoice-0').fill('Warm');assert.equal(await key('accept-enrichment-toneOfVoice').isEnabled(),true);
   await card('personas').locator('[data-disclosure="proposal-edit:personas"]>summary').click();await key('enrichment-personas-0-name').fill('Reviewed owners');await key('enrichment-personas-add').click();await key('enrichment-personas-remove-1').click();
   await key('enrichment-valueProposition').fill('My reviewed outcome');
   await card('toneOfVoice').screenshot({path:'work/bw46-6/screenshots/typed-list-'+language+'.png'});
   for(const field of ['dosAndDonts','brandVoiceExamples','brandAssets'])await card(field).locator('[data-disclosure="proposal-edit:'+field+'"]>summary').click();
   await key('enrichment-dosAndDonts-dos-0').fill('Explain sources');await key('enrichment-brandVoiceExamples-good').fill('A reviewed example');await key('enrichment-brandAssets-typography').fill('User Sans');
   await key('enrichment-mission').fill('Reviewed mission');
   const before=clone(f.r.db.brands[0]),snapshot=clone(f.r.db.boards);
   f.writes.length=0;await key('accept-all-enrichment').click();
   const dialog=p.locator('.brand-suggestion-dialog[open]');await dialog.waitFor();
   assert.equal(native,0);assert(!/\/brand_core\/|_profileEvidence|"expected"|ai_interpretation/.test(await dialog.textContent()));
   assert((await dialog.textContent()).includes('12'));assert.equal(await dialog.getAttribute('aria-labelledby'),'brand-suggestion-review-title');
   assert.equal(await p.evaluate(()=>document.activeElement.textContent),language==='de'?'Abbrechen':'Cancel');
   await dialog.locator('.fk-btn-primary').focus();await p.keyboard.press('Tab');assert(await dialog.locator('.profile-confirm-changes').evaluate(n=>n===document.activeElement),'change list is keyboard focusable');await p.keyboard.press('PageDown');await p.waitForFunction(()=>document.querySelector('.profile-confirm-changes').scrollTop>0);await p.keyboard.press('Shift+Tab');assert(await dialog.locator('.fk-btn-primary').evaluate(n=>n===document.activeElement),'Shift+Tab wraps inside the modal');
   for(let tab=0;tab<6;tab++){await p.keyboard.press(tab%2?'Shift+Tab':'Tab');assert(await dialog.evaluate(n=>n.contains(document.activeElement)),'keyboard focus stays inside the protected review');}
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(f.writes.filter(w=>w.method==='PUT').length,0);assert.deepEqual(clone(f.r.db.brands[0]),before);
   await key('accept-all-enrichment').click();await dialog.waitFor();
   await p.screenshot({path:'work/bw46-6/screenshots/confirmation-'+language+'.png'});
   await dialog.getByRole('button',{name:language==='de'?'Änderungen bestätigen':'Confirm changes',exact:true}).click();await p.waitForFunction(()=>!brandProfileController.busy());
   assert.equal(f.writes.filter(w=>w.method==='PUT').length,1);assert.equal(f.writes.filter(w=>w.path.endsWith('/write-preview')).length,2,'one preview per explicit attempt, including canceled attempt');
   assert.equal(f.r.db.brands[0].revision,before.revision+1);assert.equal(f.r.db.brands[0].brand_core.valueProposition,'My reviewed outcome');assert.deepEqual(clone(f.r.db.brands[0].brand_core.toneOfVoice),['Warm','Practical']);assert.equal(f.r.db.brands[0].brand_core.personas[0].name,'Reviewed owners');assert.equal(f.r.db.brands[0].brand_core.dosAndDonts.dos[0],'Explain sources');assert.equal(f.r.db.brands[0].brand_core.brandVoiceExamples.good,'A reviewed example');assert.equal(f.r.db.brands[0].brand_core.brandAssets.typography,'User Sans');assert.equal(f.r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='mission').content,'Reviewed mission');assert.deepEqual(Object.keys(await p.evaluate(()=>brandProfileController.state.enrichment.fields)),['brandCore']);
   assert.deepEqual(clone(f.r.db.brands[0].brand_core.brandAssets.future),{keep:true});assert.deepEqual(clone(f.r.db.boards),snapshot);assert.equal(native,0);
   // Remaining conflicting proposal can still be deliberately deferred through the same modal.
   await key('postpone-enrichment-brandCore').click();await dialog.waitFor();await dialog.getByRole('button',{name:language==='de'?'Änderungen bestätigen':'Confirm changes',exact:true}).click();await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(f.r.db.brands[0].brand_core._profileEvidence.fields.brandCore.decision,'postponed');
   assert.equal(await key('accept-all-enrichment').isDisabled(),true);
   await p.evaluate(()=>brandProfileController.reload());await key('Overview').click();await key('Value Proposition').fill('Later manual correction');await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(await key('Value Proposition').inputValue(),'Later manual correction');
   const controls=[['Overview','Brand description'],['Overview','Value Proposition'],...['Mission','Vision','Values'].map(id=>['Overview',id]),['Audience','persona-0-name'],['Audience','persona-0-note'],...['Tone of Voice','Key messages','Content guidelines','Keywords','dosAndDonts-dos','dosAndDonts-donts','brandVoiceExamples-good','brandVoiceExamples-avoid'].map(id=>['Voice & Messaging',id]),...['colors','typography','references'].map(part=>['Brand Assets','brandAssets-'+part])];
   for(const correction of ['Manual correction','Edited again','']){
    for(const [section,id] of controls){await key(section).click();await key(id).fill(correction);}
    await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());
    for(const [section,id] of controls){await key(section).click();assert.equal(await key(id).inputValue(),correction,id+' remains editable after bulk/reload');}
    for(const field of ['toneOfVoice','messagingPillars','contentGuidelines','keywords'])assert(Array.isArray(f.r.db.brands[0].brand_core[field]));
   }
   // Fresh review, both themes and mobile reflow, source disclosure and keyboard controls.
   assert(await p.evaluate(()=>brandProfileController.enrichProfile({description:'Fictional workshop description'})));
   for(const theme of ['light','dark'])for(const width of [1440,375,320]){
    await p.setViewportSize({width,height:1000});await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    assert(await p.locator('.guided-brand-profile').evaluate(n=>n.scrollWidth<=n.clientWidth+1),theme+' '+width+' profile reflow');
    assert(await p.locator('.profile-section').evaluate(n=>n.scrollWidth<=n.clientWidth+1),theme+' '+width+' review reflow');
    await key('accept-all-enrichment').scrollIntoViewIfNeeded();await p.screenshot({path:`work/bw46-6/screenshots/review-${language}-${theme}-${width}.png`});
   }
   await p.setViewportSize({width:1440,height:1000});await card('toneOfVoice').locator('[data-disclosure="proposal-sources:toneOfVoice"]>summary').click();assert((await card('toneOfVoice').textContent()).includes('Fictional workshop description'));
   assert.equal(calls,2,'opening/editing/reflow/decisions never infer');
   const persisted=clone(f.r.db.brands[0]),remaining=await p.evaluate(()=>JSON.stringify(brandProfileController.state.enrichment));
   await key('accept-all-enrichment').click();await dialog.waitFor();f.r.db.membershipStatus='revoked';
   await dialog.getByRole('button',{name:language==='de'?'Änderungen bestätigen':'Confirm changes',exact:true}).click();await p.waitForFunction(()=>!brandProfileController.busy());
   assert.deepEqual(clone(f.r.db.brands[0]),persisted,'permission revoked during confirmation cannot commit');assert.equal(await p.evaluate(()=>JSON.stringify(brandProfileController.state.enrichment)),remaining);f.r.db.membershipStatus='accepted';
   await p.evaluate(()=>{brandProfileController.state.readOnly=false;return brandProfileController.reload();});
   const writeCount=f.writes.filter(w=>w.method==='PUT').length;
   await key('accept-all-enrichment').click();await dialog.waitFor();await p.evaluate(()=>{canonicalBrandDetail.brandId='changed-brand';});await dialog.waitFor({state:'detached'});await p.waitForFunction(()=>!brandProfileController.busy());
   assert.equal(f.writes.filter(w=>w.method==='PUT').length,writeCount,'Brand switch while modal open has zero writes');

   console.log('PASS actual browser '+language+': typed lists/personas/text; invalid edit gating; atomic bulk; scoped modal/cancel; remaining decisions; manual edit/reload; light/dark/mobile/sources/keyboard');
  } finally {f.writes.length=0;await f.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
