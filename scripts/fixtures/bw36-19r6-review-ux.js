'use strict';
const fs=require('fs'),assert=require('node:assert/strict');let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core'));}
async function reviewUX(){const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());assert.equal(url.hostname,'localhost');const pathname=url.pathname;return route.fulfill(pathname==='/'?{body:'<html><body><button id="origin">Open</button><script src="/learning-advisor.js"></script><link rel="stylesheet" href="/learning-advisor.css"></body></html>',contentType:'text/html'}:{path:process.cwd()+pathname});});
 await page.goto('http://localhost/');
 for(const language of ['en','de'])for(const theme of ['light','dark'])for(const width of [1440,375,320]){
  await page.setViewportSize({width,height:800});await page.evaluate(({language,theme})=>{
   document.documentElement.dataset.theme=theme;window.calls=[];
   window.advisor=FunklixLearningAdvisor.create({brand:{id:'b',name:'Test'},workspaceId:'w',language:()=>language,current:()=>true,connected:()=>true,fetchImpl:async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null;calls.push(body);
    const result=!body?{brand:{id:'b',name:'Test',revision:'1'},boards:[{id:'board',name:'Board',updated_at:'now'}]}:body.action==='preview'?{threads:[],coverage:{excluded:[]}}:body.action==='analyze'?{brand:{id:'b'},scope:{board_id:'board'},coverage:{excluded:[]},expires:Date.now()+600000,receipt:'fixture',suggestions:[1,2,3].map(i=>({id:'suggestion-'+i,title:'Title '+i,statement:'Statement '+i,rationale:'Rationale '+i,mode:'manual',relationship:i===3?'exact_duplicate':'new',provenance_status:'unverified',sources:[]}))}:body.action==='adopt_selected'?{results:body.items.map(item=>({...item,status:'proposed'})),review_session:{receipt:'next',expires:Date.now()+600000}}:{};
    return {ok:true,json:async()=>({contract:'brand_learning_advisor_v1',...result})};}});document.querySelector('#origin').focus();void advisor.open();
  },{language,theme});
  const dialog=page.locator('dialog'),action=k=>dialog.locator('[data-advisor-action='+k+']');await dialog.locator('select').selectOption('board');await action('analyze').click();
  assert(await dialog.locator('[data-advisor-select=suggestion-3]').isDisabled());
  await dialog.locator('[data-advisor-select=suggestion-1]').check();await dialog.locator('[data-advisor-select=suggestion-2]').check();await action('reviewSelected').click();
  await dialog.locator('[data-advisor-field=evidence]').fill('x'.repeat(4100));assert((await dialog.textContent()).includes(language==='de'?'Speichergrenze':'storage limit'));
  await dialog.locator('[data-advisor-field=evidence]').fill('Editable context');await action('next').click();await action('previous').click();assert.equal(await dialog.locator('[data-advisor-field=evidence]').inputValue(),'Editable context');
  assert(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));await action('saveSelected').click();await action('confirm').click();await dialog.locator('[data-advisor-select=suggestion-1]').waitFor();assert(await dialog.locator('[data-advisor-select=suggestion-1]').isDisabled());
  assert.equal(await page.evaluate(()=>calls.filter(c=>c?.action==='analyze').length),1);await action('cancel').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SELECT');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.id),'origin');
 }
 assert.deepEqual(errors,[]);console.log('PASS R6 review UI: EN/DE, light/dark, desktop/375/320, editable overflow, independent drafts, explicit bulk confirmation, session preservation, Tab/Escape and focus.');
}finally{await browser.close();}}
module.exports={reviewUX};
