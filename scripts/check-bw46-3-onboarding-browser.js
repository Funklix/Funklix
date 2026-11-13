'use strict';
// Real application, protected controller and HTTP handlers; fictional research and AI only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const {EMAIL, clone} = require('./fixtures/bw36-13r5-local-runtime');
const output = 'work/bw46-3/screenshots';
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    for (const language of ['en','de']) {
      const f = await require('./fixtures/home-browser')(browser)({empty:true,prepare(r) {
        r.db.brands[0].name = 'Northstar Repair';
        r.db.brands[0].brand_core.brandCore = '';
        r.db.brands[0].brand_core.valueProposition = '';
      }});
      try {
        const p=f.page, key=k=>p.locator(`[data-profile-key="${k}"]`);
        p.setDefaultTimeout(45000);await p.emulateMedia({reducedMotion:'reduce'});
        let calls=0, release=null, started=null;
        const requests=[];
        const research={version:'brand-domain-research/v1',sources:[
          {id:'s1',url:'https://northstar.example/',retrieval:'fetched',extraction:'extracted',processing:'prepared',evidenceKind:'visible_text'},
          {id:'s2',url:'https://northstar.example/about',retrieval:'unavailable',extraction:'not_started',processing:'not_started',reason:'http_error'}
        ],selectedEvidence:[{sourceId:'s1',url:'https://northstar.example/',excerpt:'We repair tools for local workshops.'}],counts:{discovered:2,fetched:1,extracted:1,processed:0,unavailable:1,rejected:0,deferred:0},remaining:{omittedUnits:2}};
        const handler=f.r.load('api/enrich-brand-profile.js').createHandler({getSessionUser:()=>({email:EMAIL}),researchDomain:async()=>({research:clone(research)}),fetch:async(_url,init)=>{
          calls++;if(release){started();await release;release=null;}
          const prompt=JSON.parse(init.body).messages.map(m=>m.content).join('\n');
          const field=requests.at(-1).field;
          const values=field==='toneOfVoice'?{toneOfVoice:{value:['Clear','Warm'],classification:'ai_interpretation',evidence:[]}}:field==='valueProposition'?{valueProposition:{value:'Keep useful tools working.',classification:'ai_interpretation',evidence:[]}}:{brandCore:{value:'A tool repair workshop.',classification:'user_provided',evidence:[{sourceId:prompt.includes('Repair tools for workshops')?'user':'s1',excerpt:prompt.includes('Repair tools for workshops')?'Repair tools for workshops':'We repair tools for local workshops.'}]},valueProposition:{value:'Useful tools, less waste.',classification:'ai_interpretation',evidence:[{sourceId:'s1',excerpt:'We repair tools for local workshops.'}]}};
          return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields:values})}}]})};
        }});
        await p.route('**/api/enrich-brand-profile',async route=>{
          const body=route.request().postDataJSON();requests.push(body);
          const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=clone(body);return this;}};
          await handler({method:'POST',body},res);await route.fulfill({status:res.statusCode,json:res.body});
        });
        await p.evaluate(language=>{state.uiLanguage=FunklixLanguage.setUiLanguage(language);translateInterface();openRegularBrandProfile();},language);
        await p.waitForFunction(()=>brandProfileController && canonicalBrandDetail.status==='ready');
        assert.equal(calls,0);assert.equal(await p.locator('.profile-nav-group').count(),6);assert.equal(await p.locator('nav button[data-readiness]').count(),11);
        assert(await p.locator('.profile-discovery').evaluate(n=>n.open),'new Brand invitation open');
        const saved=clone(f.r.db.brands[0]), snapshot=clone(f.r.db.boards);
        await key('research-start').click();assert.equal(calls,0,'empty inputs validated');
        await key('research-description').fill('Repair tools for workshops');await key('research-start').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(calls,1,'description-only input recovers from initial empty validation');assert.equal(requests.at(-1).domainUrl,undefined);
        assert.deepEqual(clone(f.r.db.brands[0]),saved,'description-only research never writes');
        await key('Discard enrichment draft').click();await key('Overview').click();
        await key('research-domain').fill('http://127.0.0.1');await key('research-start').click();assert.equal(calls,1,'invalid destination validated');
        await key('research-domain').fill('northstar.example');
        await key('research-founder-url').fill('https://northstar.example/about');
        await key('research-description').fill('Repair tools for workshops');
        assert.equal(await p.evaluate(()=>brandProfileController.contentDirty()),false,'research inputs do not change saved profile');
        if(language==='en')await p.screenshot({path:output+'/start-light.png',fullPage:true});
        let proceed;release=new Promise(resolve=>{proceed=resolve;});const inFlight=new Promise(resolve=>{started=resolve;});
        await key('research-domain').press('Enter');await inFlight;
        assert(await p.locator('.profile-research-loading').isVisible());assert.equal(await p.locator('[role=progressbar]').count(),0,'no invented progress');
        if(language==='en')await p.screenshot({path:output+'/research.png',fullPage:true});
        proceed();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(calls,2);assert.equal(requests.at(-1).domainUrl,'https://northstar.example/');assert.equal(requests.at(-1).description,'Repair tools for workshops');
        assert.deepEqual(clone(f.r.db.brands[0]),saved,'research never writes');
        assert(await p.locator('.profile-research-results').textContent().then(t=>t.includes('2')),'actual totals visible');
        const draft=await p.evaluate(()=>brandProfileController.state.enrichment);assert.equal(draft.research.counts.processed,1);
        assert.equal(await key('enrichment-brandCore').count(),1);
        await key('Overview').click();await key('research-start').click();
        assert.equal(calls,2,'visible UI retains an actionable draft until review/discard');
        assert.equal(await key('enrichment-brandCore').count(),1,'existing draft remains editable after replacement is deferred');
        await key('enrichment-brandCore').fill('My reviewed repair workshop');
        if(language==='en')await p.screenshot({path:output+'/review-light.png',fullPage:true});
        await key('accept-enrichment-brandCore').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(f.r.db.brands[0].brand_core.brandCore,'My reviewed repair workshop');
        await key('postpone-enrichment-valueProposition').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(f.r.db.brands[0].brand_core._profileEvidence.fields.valueProposition.decision,'postponed');
        await key('Discard enrichment draft').click();await key('Overview').click();
        await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(await key('Brand description').inputValue(),'My reviewed repair workshop');
        await key('Brand description').fill('Edited after reload');await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(f.r.db.brands[0].brand_core.brandCore,'Edited after reload');
        await key('Voice & Messaging').click();
        await p.locator('[data-field=toneOfVoice] summary').click();await key('questions-toneOfVoice').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(calls,2,'questions have no inference');
        assert.equal(requests.at(-1).action,'questions');
        await key('answer-toneOfVoice').fill(language==='de'?'Klar und freundlich':'Clear and friendly');
        if(language==='en')await p.screenshot({path:output+'/field-assistance.png',fullPage:true});
        await key('Prepare my suggestion').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(requests.at(-1).answers.length,1);assert.equal(calls,3);
        await key('enrichment-toneOfVoice').fill('invalid JSON');assert.equal(await key('enrichment-toneOfVoice').evaluate(n=>n.checkValidity()),false,'invalid structured edit cannot be adopted');
        await key('enrichment-toneOfVoice').fill('["Calm", "Helpful"]');
        await key('reject-enrichment-toneOfVoice').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(f.r.db.brands[0].brand_core._profileEvidence.fields.toneOfVoice.decision,'rejected');
        await key('Discard enrichment draft').click();await key('Overview').click();
        // Reuse actual source import modal and protected canonical save; no campaign write.
        const fields=Object.fromEntries(['founderNameRole','observedProblem','motivation','turningPoint','background','proofPoints','vision'].map(k=>[k,{value:k==='founderNameRole'?'Nova, founder':'Repair waste',evidence:'Repair waste'}]));
        await p.route('**/api/extract-website-text',r=>r.fulfill({json:{success:true,source:{title:'About'},content:{text:'Repair waste'}}}));
        await p.route('**/api/map-founder-story-website',r=>r.fulfill({json:{success:true,fields}}));
        if (!await p.locator('.profile-discovery').evaluate(n=>n.open)) await p.locator('.profile-discovery>summary').click();
        await key('research-founder-import').click();
        assert.equal(await p.locator('[data-founder-story-import-url]').inputValue(),'https://northstar.example/about');
        await p.locator('[data-founder-story-import-start]').click();await p.locator('[data-import-apply]').waitFor();
        await p.locator('[data-import-apply]').click();await p.locator('.founder-story-import-modal').waitFor({state:'detached'});
        assert(await p.locator('.profile-founder>summary').evaluate(n=>document.activeElement===n),'canonical import restores focus to Founder workspace');
        let tile=f.r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='founder_story');
        assert.equal(tile.moduleData.founderStory.founderNameRole,'Nova, founder');assert.equal(tile.moduleData.founderStoryLifecycle.status,'draft');
        await p.locator('.profile-founder>summary').click();
        const factKeys=Object.keys(fields);
        for (const fact of factKeys) await key('founder-'+fact).fill('Reviewed '+fact);
        await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());
        await key('Reload latest Brand').click();await p.waitForFunction(()=>!brandProfileController.busy());
        for (const fact of factKeys) assert.equal(await key('founder-'+fact).inputValue(),'Reviewed '+fact,'structured Founder edit/save/reload '+fact);

        await p.route('**/api/generate-founder-story',r=>r.fulfill({json:{success:true,narrative:'Nova built a workshop to reduce repair waste.'}}));
        await key('Generate Founder Story').click();await p.waitForFunction(()=>!brandProfileController.busy());
        await key('founder-narrative-draft').fill('Reviewed origin of Northstar Repair.');await key('Accept Founder Story').click();await p.waitForFunction(()=>!brandProfileController.busy());
        tile=f.r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='founder_story');assert.equal(tile.content,'Reviewed origin of Northstar Repair.');assert(tile.moduleData.founderStoryLifecycle.acceptedAt);
        await key('founder-motivation').fill('Keep tools useful');await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());
        tile=f.r.db.brands[0].brand_core.customTiles.find(t=>t.moduleType==='founder_story');assert.equal(tile.moduleData.founderStoryLifecycle.status,'draft','manual correction retires old acceptance');
        // Generated DNA edits bind to the generated draft that explicit acceptance saves.
        await key('Brand DNA').click();await p.evaluate(()=>{brandProfileController.state.dnaDraft={primaryArchetype:'Hero',secondaryArchetype:'Sage'};brandProfileController.render();});
        await key('dna-primaryArchetype').fill('Creator');await key('Save Brand DNA').click();await p.waitForFunction(()=>!brandProfileController.busy());
        assert.equal(f.r.db.brands[0].brand_core.brandDNA.primaryArchetype,'Creator');
        await key('Audience').click();const before=f.r.db.brands[0].brand_core.personas.length;
        if(before){await key('remove-persona-0').click();await key('Confirm and save Brand Profile').click();await p.waitForFunction(()=>!brandProfileController.busy());assert.equal(f.r.db.brands[0].brand_core.personas.length,before-1);}
        await key('Overview').click();
        for(const theme of ['light','dark'])for(const width of [1440,768,375,320,720]){
          await p.setViewportSize({width,height:960});await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;brandProfileController.render();},theme);
          assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+'/'+width+' document reflow');
          for(const selector of ['.guided-brand-profile','.guided-brand-profile nav','.profile-section','.profile-discovery'])assert(await p.locator(selector).evaluate(n=>n.scrollWidth<=n.clientWidth+1),selector+' reflow');
          if(width<=768 && await p.locator('.profile-nav-browser').evaluate(n=>n.open)) await p.locator('.profile-nav-browser>summary').click();
          if(language==='en'&&[1440,375].includes(width))await p.screenshot({path:`${output}/profile-${theme}-${width}.png`,fullPage:true});
        }
        if (!await p.locator('.profile-nav-browser').evaluate(n=>n.open)) await p.locator('.profile-nav-browser>summary').click();
        await key('Voice & Messaging').focus();await p.keyboard.press('Enter');assert(await p.locator('[data-section-title]').evaluate(n=>document.activeElement===n));
        await p.emulateMedia({forcedColors:'active'});await key('Overview').focus();assert(await key('Overview').evaluate(n=>getComputedStyle(n).outlineStyle!=='none'));await p.emulateMedia({forcedColors:'none'});
        assert.deepEqual(clone(f.r.db.boards),snapshot,'Founder/DNA/profile never alter campaign snapshots');
        f.writes.length=0;
        console.log('PASS BW-46.3 '+language+': description-only/combined entry, real aggregate progress, editable decisions, questions, Founder import/narrative, DNA draft edit, persona removal, reload, themes/reflow/focus, snapshot isolation');
      } finally {f.writes.length=0;await f.close();}
    }
    const viewer=await require('./fixtures/home-browser')(browser)({empty:true,prepare(r){r.db.brands[0].owner_email='other@example.test';r.db.brandRole='viewer';}});
    try {
      await viewer.page.evaluate(()=>openRegularBrandProfile());await viewer.page.waitForFunction(()=>brandProfileController && canonicalBrandDetail.status==='ready');
      assert.equal(await viewer.page.evaluate(()=>brandProfileController.state.readOnly),true);
      assert.equal(await viewer.page.locator('.profile-discovery,.profile-field-menu,[data-profile-key="founder-import"],[data-profile-key="Confirm and save Brand Profile"]').count(),0);
      assert(await viewer.page.locator('.guided-brand-profile input,.guided-brand-profile textarea').evaluateAll(nodes=>nodes.every(n=>n.disabled)));
      console.log('PASS BW-46.3 actual canonical viewer: no research/AI/import/save actions; all content inputs read-only');
    } finally {await viewer.close();}
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
