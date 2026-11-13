'use strict';
// Actual application and enrichment handler. All source/model responses are fictional.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const {EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
(async()=>{
 fs.mkdirSync('work/bw46-4/screenshots',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const language of ['en','de']){
 const f=await require('./fixtures/home-browser')(browser)({empty:true,prepare(r){r.db.brands[0].brand_core.brandCore='';r.db.brands[0].brand_core.brandAssets.domain='';}});
 try{
  const p=f.page,key=k=>p.locator(`[data-profile-key="${k}"]`);p.setDefaultTimeout(30000);await p.emulateMedia({reducedMotion:'reduce'});
  const before=clone(f.r.db.brands[0]),snapshot=clone(f.r.db.boards);let mode='failure',calls=0,release;
  const requests=[];
  const research={version:'brand-domain-research/v1',sources:[{id:'s1',url:'https://frostspur.example/',retrieval:'fetched',extraction:'extracted',processing:'prepared',selectedUnits:1}],selectedEvidence:[{sourceId:'s1',url:'https://frostspur.example/',excerpt:'We repair tools.'}],documents:[{kind:'robots',url:'https://frostspur.example/robots.txt',retrieval:'fetched'},{kind:'sitemap',url:'https://frostspur.example/sitemap.xml',retrieval:'unavailable'}],counts:{discovered:1,fetched:1,extracted:1,processed:0,unavailable:0,rejected:0,deferred:0},remaining:{sources:0,omittedUnits:0}};
  const handler=f.r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),researchDomain:async()=>({research:clone(research)}),fetch:async()=>{
   calls++;if(release)await release;
   if(mode==='failure')return {ok:false};
   if(mode==='empty')return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields:{}})}}]})};
   if(mode==='invalid')return {ok:true,json:async()=>({choices:[{message:{content:'invalid JSON'}}]})};
   return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields:{brandCore:{value:'Tool repair workshop',classification:'website_supported',evidence:[{sourceId:requests.at(-1).domainUrl?'s1':'user',excerpt:'We repair tools.'}]},mission:{value:null,classification:'missing',evidence:[]}}})}}]})};
  }});
  await p.route('**/api/enrich-brand-profile',async route=>{requests.push(route.request().postDataJSON());const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=clone(v);return this;}};await handler({method:'POST',body:requests.at(-1)},res);await route.fulfill({status:res.statusCode,json:res.body});});
  await p.evaluate(language=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);translateInterface();openRegularBrandProfile();},language);await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');
  assert.equal(calls,0);await key('research-domain').fill('frostspur.example');
  assert((await p.locator('.profile-website').textContent()).includes(language==='de'?'Noch keine Website gespeichert':'No saved website yet'));
  assert((await p.locator('.profile-website-draft').textContent()).includes('frostspur.example'));assert((await p.locator('.profile-website-draft').textContent()).includes(language==='de'?'nicht gespeichert':'not saved'));
  await key('research-start').click();await p.waitForFunction(()=>!brandProfileController.busy());
  assert.equal(calls,1);assert.equal(await key('research-domain').inputValue(),'frostspur.example');assert.deepEqual(clone(f.r.db.brands[0]),before);
  assert((await p.locator('.guided-brand-profile').textContent()).includes(language==='de'?'KI-Dienst ist vorübergehend':'AI provider is temporarily'));
  assert.equal(await p.locator('.profile-research-results').evaluate(n=>n.open),false);assert((await p.locator('.profile-research-status').textContent()).includes(language==='de'?'keine Vorschläge':'did not prepare suggestions'));
  await p.locator('.profile-research-results>summary').click();const detail=await p.locator('.profile-research-results').textContent();assert(detail.includes(language==='de'?'keine Website-Auszüge erfolgreich':'No website excerpts were successfully'));assert(!detail.includes(language==='de'?'Ausgewählte Auszüge wurden analysiert':'Selected excerpts were analyzed'));assert(detail.includes('sitemap.xml'));
  for(const theme of ['light','dark'])for(const width of [1440,375,320]){await p.setViewportSize({width,height:900});await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;brandProfileController.render();},theme);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`work/bw46-4/screenshots/failure-${language}-${theme}-${width}.png`,fullPage:true});}
  mode='invalid';await key('research-start').click();await p.waitForFunction(()=>!brandProfileController.busy());assert((await p.locator('.guided-brand-profile').textContent()).includes(language==='de'?'KI-Antwort konnte nicht validiert':'AI response could not be validated'));
  mode='success';await key('research-start').click();await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(calls,3);assert.equal(await key('enrichment-brandCore').count(),1);assert.equal(await key('accept-enrichment-mission').count(),0);assert.deepEqual(clone(f.r.db.brands[0]),before,'reviewable draft never autosaves');
  await key('Discard enrichment draft').click();await key('Overview').click();mode='empty';await key('research-start').click();await p.waitForFunction(()=>!brandProfileController.busy());assert((await p.locator('.profile-research-status').textContent()).includes(language==='de'?'keine belegten Vorschläge':'No supported suggestions'));mode='success';
  await key('Discard enrichment draft').click();await key('Overview').click();await key('research-description').fill('We repair tools.');await key('research-description-only').click();await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(requests.at(-1).domainUrl,undefined);assert.equal(await p.evaluate(()=>brandProfileController.state.researchEntry.domain),'frostspur.example');
  await key('Discard enrichment draft').click();await key('Overview').click();await key('Website').fill('https://frostspur.example/');await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(await key('Website').inputValue(),'https://frostspur.example/');assert.equal(await p.locator('.profile-website').textContent(),'https://frostspur.example/');assert.equal(await p.locator('.profile-website-draft').isVisible(),false);
  let proceed;release=new Promise(resolve=>{proceed=resolve;});const pending=p.evaluate(()=>brandProfileController.enrichProfile({domainUrl:'https://frostspur.example/'}));await p.waitForFunction(()=>brandProfileController.busy());await p.evaluate(()=>brandProfileController.invalidate());proceed();await pending;assert.equal(await p.evaluate(()=>brandProfileController.state.enrichment),null,'brand switch invalidates in-flight response');assert.deepEqual(clone(f.r.db.boards),snapshot);
  console.log('PASS BW-46.4 actual browser '+language+': localized failures, retained inputs, zero-processing disclosure, retry/nullable missing draft, description-only choice, unsaved/saved website and reload, stale context, light/dark/mobile');
 }finally{f.writes.length=0;await f.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
