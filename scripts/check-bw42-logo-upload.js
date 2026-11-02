'use strict';
// Independent upload investigation: production controller, signed API handlers and private storage adapter.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {runtime,B,W,png}=require('./fixtures/bw36-13r5-local-runtime');
const profile=require('../brand-profile-setup');
(async()=>{
  const r=runtime({postgresLogo:true});
  const initial=(await r.request('GET',`/api/brands/${B}`)).body;
  const untouched=structuredClone(initial.brand_core);
  const context={account:{},generation:1,brandId:B,workspaceId:W,authorized:true};
  const session=profile.createSession({brand:initial,getContext:()=>context,requestId:randomUUID,validateBrand:(v,id)=>v?.id===id&&Number.isSafeInteger(v.revision),confirmReview:async()=>true,onSave(){},onLogo(){},fetchImpl:async(url,init={})=>{
    const out=await r.request(init.method||'GET',url,init.body&&JSON.parse(init.body),undefined,init.headers);
    return {ok:out.statusCode>=200&&out.statusCode<300,status:out.statusCode,json:async()=>out.body};
  }});
  const file={name:'fictional-logo.png',size:png.length,type:'image/png'};
  assert(await session.chooseFile(file,async()=>png.toString('base64')));
  r.db.failLogoMetadata=true;
  assert.equal(await session.upload(),false);
  assert.equal(session.state.message,'Logo upload failed. Your file is retained. Retry the upload.');
  assert.equal(session.state.file,file);assert.equal(session.state.fileData.base64,png.toString('base64'));
  assert.equal(r.db.brands[0].logo_revision,0);
  r.db.failLogoMetadata=false;assert(await session.upload(),session.state.message);
  assert.equal(session.state.file,null);assert.equal(session.state.fileData,null);assert.equal(r.objects.size,1,'Retry verifies retained immutable bytes');
  const reload=await r.request('GET',`/api/brands/${B}`);
  assert.equal(reload.body.logo_revision,1);assert.equal(reload.body.logo_url,session.state.brand.logo_url);
  assert.deepEqual((await r.request('GET',reload.body.logo_url)).body,png);
  assert.deepEqual(reload.body.brand_core,untouched);
  assert.equal(await session.chooseFile({name:'invalid.svg',size:10,type:'image/svg+xml'}),false);
  assert.equal(await session.chooseFile({...file,size:2*1024*1024+1}),false);
  const input={contract:'brand_logo_v1',request_id:randomUUID(),workspace_id:W,expected_revision:1,action:'upload',mime_type:'image/png',image_base64:png.toString('base64')};
  assert.equal((await r.request('POST',`/api/brands/${B}/logo`,input,null)).statusCode,401);
  assert.equal((await r.request('POST',`/api/brands/${B}/logo`,{...input,mime_type:'image/svg+xml'})).statusCode,428,'Replacement still requires protected review');
  assert.equal(r.db.brands[0].logo_revision,1);
  console.log('PASS BW-42 upload investigation: reproduced exact generic message by injected metadata failure; retained file/preview; retry uses one immutable asset; authenticated delivery/reload; invalid selection and unauthorized request rejection; unchanged core. Injected failure does not establish the historical production cause; no new production defect demonstrated.');
})().catch(e=>{console.error(e);process.exitCode=1;});
