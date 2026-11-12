'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const language of ['en','de']){
 const f=await require('./fixtures/home-browser')(browser)({empty:true});
 try{
 const page=f.page;page.setDefaultTimeout(30000);let calls=0;
 const handler=f.r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),fetch:async()=>{calls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields:{brandCore:{value:'Tool repair consultancy',classification:'ai_interpretation',evidence:[{sourceId:'canonical',excerpt:'Original positioning'}]}}})}}]})}}});
 await page.route('**/api/enrich-brand-profile',async route=>{
 const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this},json(body){this.body=clone(body);return this}};
 await handler({method:'POST',body:route.request().postDataJSON()},res);await route.fulfill({status:res.statusCode,json:res.body});});
 await page.evaluate(language=>{state.uiLanguage=window.FunklixLanguage.setUiLanguage(language);translateInterface();openRegularBrandProfile()},language);await page.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
 const key=k=>page.locator(`[data-profile-key="${k}"]`);
 assert.equal(await key('Prepare enrichment draft').textContent(),language==='de'?'Anreicherung vorbereiten':'Prepare enrichment draft');assert.equal(calls,0,'opening does not infer');const before=clone(f.r.db.brands[0].brand_core),snapshot=clone(f.r.db.boards);
 await key('Prepare enrichment draft').click();await page.waitForFunction(()=>!brandProfileController.busy());assert.equal(calls,1);assert.deepEqual(clone(f.r.db.brands[0].brand_core),before);
 assert.equal(await key('enrichment-brandCore').count(),1);await key('enrichment-brandCore').fill('My reviewed description');
 await key('accept-enrichment-brandCore').click();await page.waitForFunction(()=>!brandProfileController.busy());assert.equal(f.r.db.brands[0].brand_core.brandCore,'My reviewed description');
 assert.equal(f.r.db.brands[0].brand_core._profileEvidence.fields.brandCore.userEdited,true);assert.deepEqual(clone(f.r.db.boards),snapshot);
 assert(await page.locator('details').filter({hasText:'Original positioning'}).count());
 await page.evaluate(async()=>{await brandProfileController.reload()});assert.equal(f.r.db.brands[0].brand_core.brandCore,'My reviewed description');
 await page.evaluate(()=>{brandProfileController.state.section=0;brandProfileController.subscribe(()=>{});});
 console.log('PASS actual browser explicit generation/edit/adoption/evidence/reload/snapshot isolation '+language);
 }finally{assert(f.writes.every(w=>w.method==='PUT'&&w.path.startsWith('/api/brands/')),'only explicit canonical adoption may write');f.writes.length=0;await f.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
