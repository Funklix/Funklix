'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {advisorRuntime}=require('./bw36-19-advisor-runtime');
const {B,W,clone}=require('./bw36-13r5-local-runtime');
async function browserChecks(){
 const f=advisorRuntime(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const template=clone(f.config.output.suggestions[0]),errors=[],events=[];
 try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'localhost');
   if(url.pathname.includes('/learning-advisor')){
    const out=await f.request(req.method()==='POST'?req.postDataJSON():null,undefined,undefined,{accept:req.headers().accept});
    if(out.stream){events.push(...out.stream.trim().split('\n').map(JSON.parse));return route.fulfill({status:out.statusCode,contentType:'application/x-ndjson',body:out.stream});}
    return route.fulfill({status:out.statusCode,json:out.body});
   }
   return route.fulfill({body:''});
  });
  await page.goto('http://localhost/');
  await page.setContent('<button id="open">Open</button><style>body{font:16px sans-serif}</style>');
  for(const file of ['brand-learnings.css','learning-advisor.css'])await page.addStyleTag({content:fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.resolve(__dirname,'../../learning-advisor.js'),'utf8')});
  await page.evaluate(({B,W})=>{
   window.lang='en';window.advisor=FunklixLearningAdvisor.create({brand:{id:B,name:'Fixture Brand'},workspaceId:W,language:()=>window.lang,current:()=>true,connected:()=>true});
   document.querySelector('#open').onclick=()=>advisor.open();
  },{B,W});
  const dialog=page.locator('[data-learning-advisor]'),action=k=>dialog.locator('[data-advisor-action="'+k+'"]');
  for(const language of ['en','de'])for(const theme of ['light','dark']) {
   await page.setViewportSize({width:320,height:568});await page.evaluate(({language,theme})=>{window.lang=language;document.documentElement.dataset.theme=theme;},{language,theme});
   await page.locator('#open').click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});
   await dialog.locator('select').selectOption(f.board.id);await action('analyze').waitFor({state:'visible'});
   await dialog.locator('[data-advisor-discussions]').check();await dialog.locator('[data-advisor-thread]').waitFor();await dialog.locator('[data-advisor-thread]').uncheck();
   f.config.providerFailure=503;await action('analyze').click();await dialog.locator('[role=alert]').waitFor();
   assert.equal(await dialog.locator('select').inputValue(),f.board.id);assert(await dialog.locator('[data-advisor-discussions]').isChecked());assert(!await dialog.locator('[data-advisor-thread]').isChecked());
   assert.equal(await dialog.locator('[role=alert]').evaluate(n=>n.tagName),'DIV');assert.equal(await dialog.locator('[role=alert] [aria-hidden]').textContent(),'⚠');
   assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   // Refresh stale persisted sources without reopening or losing whole-thread opts.
   f.board.updated_at='2026-10-13T12:00:00.123Z';await action('refresh').click();await page.waitForFunction(()=>!document.querySelector('[data-advisor-action=analyze]').disabled);
   assert.equal(await dialog.locator('select').inputValue(),f.board.id);assert(!await dialog.locator('[data-advisor-thread]').isChecked());
   await action('cancel').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SELECT');
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'open');
  }
  f.config.providerFailure=null;f.r.base.env.OPENAI_LEARNING_ADVISOR_MODEL='test-context-model';f.r.base.env.OPENAI_LEARNING_ADVISOR_CONTEXT_TOKENS='18192';f.r.base.env.OPENAI_LEARNING_ADVISOR_TOKEN_ENCODING='o200k_base';
  for(let i=0;i<45;i++)f.board.canvas_json.nodes.push({id:'large-'+i,type:'Content',content:'Persisted strategic evidence '+i+'. '+('Detail '+i+' ').repeat(300)});
  f.config.onProvider=()=>{
   const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content);
   if(input.candidates){f.config.output={language:'en',suggestions:input.candidates.slice(0,1)};return;}
   const source=input.sources.find(s=>s.kind==='canvas_node')||input.sources[0];const s=clone(template);s.statement='Review '+source.ref+'.';s.sources=[{ref:source.ref,excerpt:input.texts[source.text_index].slice(0,90)}];f.config.output={language:'en',suggestions:[s]};
  };
  await page.evaluate(()=>window.lang='en');await page.locator('#open').click();await dialog.locator('select option[value="'+f.board.id+'"]').waitFor({state:'attached'});
  await dialog.locator('select').selectOption(f.board.id);await action('analyze').click();await action('review').waitFor();
  assert(events.some(e=>e.progress?.stage==='consolidating'));assert(events.some(e=>e.progress?.total>1));
  assert(events.at(-1).result.coverage.analysis_complete);assert.equal(await dialog.locator('[role=alert]').count(),0);assert.deepEqual(errors,[]);
  await action('cancel').click();
  console.log('PASS BW-36.19R2 Chromium: streamed passes/consolidation, alert icon, recoverable options, source reload, EN/DE, light/dark, 320px scroll, keyboard/focus.');
 }finally{await browser.close();}
}
module.exports={browserChecks};
