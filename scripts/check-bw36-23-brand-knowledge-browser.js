'use strict';
const assert=require('node:assert/strict');
const {open}=require('./fixtures/bw36-23-brand-knowledge-browser');
(async()=>{
 const {browser,page}=await open();try{
  const ordinary=await page.evaluate(async()=>{const f=fixture,old=f.getBrand().brand_core;f.session.state.name='Renamed';return {saved:await f.session.save(),old,current:f.getBrand().brand_core,reviews:f.reviews.length,command:f.requests.find(r=>r.method==='PUT').input};});
  assert(ordinary.saved);assert.deepEqual(ordinary.old,ordinary.current);assert.equal(ordinary.reviews,0);assert.equal(ordinary.command.changes.length,1);console.log('PASS Chromium ordinary edit preserves accepted knowledge without review dialog');
  const avatar=await page.evaluate(async()=>{const f=fixture;f.session.state.avatarDraft={imageUrl:'https://fixture.test/new.png',userApproved:false};return {saved:await f.session.acceptAvatar(),brand:f.getBrand(),reviews:f.reviews};});
  assert(avatar.saved);assert.equal(avatar.reviews.length,1);assert(avatar.reviews[0].includes('https://fixture.test/old.png'));assert.equal(avatar.brand.brand_core.brandDNA.avatar.future,42);console.log('PASS Chromium Avatar acceptance reviews exact replacement and preserves metadata');
  await page.evaluate(()=>{fixture.hold=true;fixture.session.state.name='Original scope commit';fixture.promise=fixture.session.save();});
  await page.waitForFunction(()=>!!fixture.release);
  const switched=await page.evaluate(async()=>{fixture.context.workspaceId='33333333-3333-4333-8333-333333333333';fixture.release();return {saved:await fixture.promise,sessionName:fixture.session.state.brand.name,committed:fixture.getBrand().name,requests:fixture.requests.filter(r=>r.method==='PUT').map(r=>r.input.workspace_id)};});
  assert.equal(switched.saved,false);assert.equal(switched.sessionName,'Renamed');assert.equal(switched.committed,'Original scope commit');assert(switched.requests.every(id=>id==='22222222-2222-4222-8222-222222222222'));console.log('PASS Chromium in-flight Workspace switch ignores response and retains original mutation scope');
  console.log('3 provider-free Chromium groups passed. SQL isolation is verified separately.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
