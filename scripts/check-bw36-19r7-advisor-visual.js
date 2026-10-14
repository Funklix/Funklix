'use strict';
// Production DOM/styles, provider-free transport, and real Chromium rendering.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core'));}
async function main(){
 const output=process.env.ADVISOR_SCREENSHOTS||'work/advisor-screenshots';fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const evidence=[];
 try{
  for(const theme of ['light','dark'])for(const viewport of [{width:1280,height:1000},{width:375,height:812}]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{const url=new URL(route.request().url());assert.equal(url.hostname,'localhost','No external calls');
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/brand-learnings.css"><link rel="stylesheet" href="/learning-advisor.css"></head><body><button id="open">Open Advisor</button><script src="/learning-advisor.js"></script></body></html>'});
    return route.fulfill({path:path.join(process.cwd(),url.pathname)});
   });
   await page.goto('http://localhost/');
   await page.evaluate(theme=>{
    document.documentElement.dataset.theme=theme;window.calls=[];window.fail=false;
    const brand={id:'brand',name:'Tendra Studio',revision:'1'};
    const suggestions=[{id:'suggestion-1',type:'learning_candidate',title:'Make the next step unmistakable',statement:'Lead every campaign variation with one clear, specific next step.',rationale:'Both saved variations give readers a concrete invitation. A consistent next step can help the Brand communicate with clarity.',mode:'single_node',relationship:'new',provenance_status:'verified',sources:[{kind:'canvas_node',node_id:'campaign-variation',field:'content',excerpt:'Invite readers to book a short discovery session.',excerpt_origin:'server_source_preview'}]},
     {id:'suggestion-2',type:'knowledge_gap',title:'Bring the audience into focus',statement:'Review the audience assumptions before adapting the next campaign.',rationale:'The saved Profile provides context, but the recommendation still requires human judgment.',mode:'manual',relationship:'new',provenance_status:'unverified',sources:[]}];
    window.advisor=FunklixLearningAdvisor.create({brand,workspaceId:'workspace',language:()=>window.language||'en',current:()=>true,connected:()=>true,fetchImpl:async(url,options)=>{
     const body=options.body?JSON.parse(options.body):null;calls.push(body);
     const json=value=>new Response(JSON.stringify({contract:'brand_learning_advisor_v1',...value}),{headers:{'Content-Type':'application/json'}});
     if(!body)return json({brand,boards:[{id:'board',name:'Autumn launch · strategy & creative',updated_at:'now'}]});
     if(body.action==='preview'){if(window.holdPreview)await new Promise(resolve=>window.releasePreview=resolve);return json({threads:[{key:'thread',node_id:'campaign-variation',title:'Align the next step'}],coverage:{excluded:[]}});}
     if(body.action==='analyze'){
      if(window.fail)return new Response(JSON.stringify({error:{code:'PROVIDER_FAILED'}}),{status:503});
      const encoder=new TextEncoder();return new Response(new ReadableStream({start(controller){
       window.report=value=>controller.enqueue(encoder.encode(JSON.stringify({progress:value})+'\n'));
       window.complete=()=>{controller.enqueue(encoder.encode(JSON.stringify({result:{contract:'brand_learning_advisor_v1',brand,scope:{board_id:'board'},coverage:{excluded:[],analysis_complete:true},metadata:{provider_requests:1},expires:Date.now()+600000,receipt:'fixture-only',suggestions}})+'\n'));controller.close();};
      }}),{headers:{'Content-Type':'application/x-ndjson'}});
     }
     if(body.action==='adopt_selected')return json({results:body.items.map(x=>({...x,status:'proposed'})),review_session:{receipt:'fixture-next'}});
     return json({freshness:'validated'});
    }});document.querySelector('#open').onclick=()=>advisor.open();
   },theme);
   const dialog=page.locator('dialog'),action=k=>dialog.locator('[data-advisor-action='+k+']');
   async function contrast(locator){
    const colors=await locator.evaluate(n=>{const s=getComputedStyle(n);return [s.color,s.backgroundColor];});
    const luminance=color=>{const values=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
    const [a,b]=colors.map(luminance),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert(ratio>=4.5,'text contrast '+colors.join(' / ')+' = '+ratio);
   }
   async function capture(state){
    assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'dialog must not overflow horizontally');
    assert.equal(await page.locator('dialog').count(),1);
    const filename=theme+'-'+viewport.width+'-'+state+'.png';await dialog.screenshot({path:path.join(output,filename)});
    evidence.push({theme,width:viewport.width,state,filename});
   }
   await page.locator('#open').click();await dialog.locator('select option[value=board]').waitFor({state:'attached'});await capture('initial');
   await dialog.locator('.advisor-disclosure summary').click();assert(await dialog.getByText(/These selected content categories/).isVisible());await dialog.locator('.advisor-disclosure summary').click();
   await page.evaluate(()=>window.holdPreview=true);await dialog.locator('select').selectOption('board');await dialog.locator('[data-stage=preview]').waitFor();await capture('preparation');await page.evaluate(()=>{releasePreview();window.holdPreview=false;});
   await action('analyze').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-advisor-action=analyze]').disabled);
   await dialog.locator('[data-advisor-discussions]').check();await dialog.locator('[data-advisor-thread]').waitFor();
   await contrast(action('analyze'));await action('analyze').click();await page.waitForFunction(()=>typeof window.report==='function');
   await page.evaluate(()=>report({stage:'analyzing',completed:0,total:1}));await dialog.locator('[data-stage=analyzing]').waitFor();await capture('analyzing');
   await page.evaluate(()=>report({stage:'consolidating',completed:0,total:1}));await dialog.locator('[data-stage=consolidating]').waitFor();await capture('consolidating');
   await page.evaluate(()=>complete());await dialog.locator('[data-advisor-suggestion]').first().waitFor();
   await dialog.locator('[data-advisor-suggestion]').first().scrollIntoViewIfNeeded();await capture('results');
   await dialog.locator('[data-advisor-suggestion]').first().locator('summary').click();assert(await dialog.getByText('Invite readers to book a short discovery session.').isVisible());await capture('evidence');
   for(const id of ['suggestion-1','suggestion-2'])await dialog.locator('[data-advisor-select='+id+']').check();
   await dialog.locator('[data-advisor-suggestion]').first().scrollIntoViewIfNeeded();await capture('bulk-selection');
   await action('reviewSelected').click();await dialog.locator('[data-advisor-field=statement]').fill('Human reviewed: give readers a clear next step.');await contrast(dialog.locator('[data-advisor-field=statement]'));await contrast(dialog.locator('[data-advisor-field=evidence]'));await capture('review');
   await action('next').click();await action('previous').click();assert.equal(await dialog.locator('[data-advisor-field=statement]').inputValue(),'Human reviewed: give readers a clear next step.');
   await dialog.locator('.advisor-source-draft summary').click();assert(await dialog.getByText('Lead every campaign variation with one clear, specific next step.',{exact:true}).isVisible());
   await action('saveSelected').click();await action('confirm').scrollIntoViewIfNeeded();await capture('confirmation');
   await action('confirm').click();await dialog.locator('[data-stage=saved]').waitFor();await dialog.locator('[data-stage=saved]').scrollIntoViewIfNeeded();await capture('success');
   assert(await dialog.locator('[data-advisor-select=suggestion-1]').isDisabled());assert.equal(await page.evaluate(()=>calls.filter(x=>x?.action==='analyze').length),1);
   await page.evaluate(()=>window.fail=true);await action('analyze').click();await dialog.getByRole('alert').waitFor();await dialog.getByRole('alert').scrollIntoViewIfNeeded();await capture('error');
   assert(await action('analyze').isEnabled());
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await dialog.locator('button').first().evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
   await page.emulateMedia({forcedColors:'active'});await capture('forced-colors');
   await page.emulateMedia({forcedColors:'none'});
   for(const size of [{width:320,height:400},{width:768,height:540}]){await page.setViewportSize(size);assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));await action('cancel').scrollIntoViewIfNeeded();assert(await action('cancel').isVisible());await action('analyze').scrollIntoViewIfNeeded();assert(await action('analyze').isVisible());}
   await action('cancel').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SELECT');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.id),'open');assert.deepEqual(errors,[]);
   await page.close();
  }
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(evidence,null,2));console.log('PASS R7 Chromium: 48 Light/Dark desktop/mobile state captures; actual streaming-state rendering, source disclosure, evidence, selection, edited review, confirmation, proposed success, recoverable error, primary/editor text contrast, reduced motion, forced colors, tablet/320px short-height scrolling, Tab/Escape and restored focus.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
