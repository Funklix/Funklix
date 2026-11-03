'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const storage = require('../api/_brand-logo-storage');
const profile = require('../brand-profile-setup');
const { runtime, B, W, png } = require('./fixtures/bw36-13r5-local-runtime');

async function contract() {
  const input = {brandId:B,revision:1,mutationId:randomUUID(),mimeType:'image/png',buffer:png,
    env:{SUPABASE_URL:'https://storage.example.test',SUPABASE_SERVICE_ROLE_KEY:'fictional-key'}};
  async function rejected(status, body, expected) {
    await assert.rejects(storage.upload({...input,fetchImpl:async(url,init)=>{
      assert.match(url,/\/storage\/v1\/object\/brand-logos\//);
      assert.equal(init.headers['x-upsert'],'false');
      assert.equal(init.headers['Content-Type'],'image/png');
      assert.equal(init.headers.Authorization,'Bearer fictional-key');
      assert.equal(init.headers.apikey,'fictional-key');
      assert.deepEqual(init.body,png);
      return new Response(typeof body==='string'?body:JSON.stringify(body),{status});
    }}),error=>error.code===expected);
  }
  for(const code of ['KeyAlreadyExists','ResourceAlreadyExists'])
    await rejected(400,{statusCode:'409',code,error:'Duplicate'},'STORAGE_CONFLICT');
  await rejected(400,{statusCode:'409',error:'Duplicate'},'STORAGE_CONFLICT');
  await rejected(409,'','STORAGE_CONFLICT');
  for(const body of [
    {statusCode:'403',code:'AccessDenied',error:'Unauthorized'},
    {statusCode:'404',code:'NoSuchBucket'},
    {statusCode:'409',code:'ResourceLocked'},
    {statusCode:'400',code:'KeyAlreadyExists'},
    {statusCode:'409',message:'The resource already exists'},
    '{invalid json', 'x'.repeat(4097)
  ]) await rejected(400,body,'STORAGE_UNAVAILABLE');
  await rejected(503,{statusCode:'409',code:'KeyAlreadyExists'},'STORAGE_UNAVAILABLE');
  // A duplicate envelope on a GET is not an upload collision.
  await assert.rejects(storage.read(`${B}/1.png`,{...input,fetchImpl:async()=>
    new Response(JSON.stringify({statusCode:'409',code:'KeyAlreadyExists'}),{status:400})}),
    error=>error.code==='STORAGE_UNAVAILABLE');
}

async function sessionFor(r) {
  const context={account:{},generation:1,brandId:B,workspaceId:W,authorized:true};
  return profile.createSession({brand:(await r.request('GET',`/api/brands/${B}`)).body,getContext:()=>context,requestId:randomUUID,
    validateBrand:(v,id)=>v?.id===id&&Number.isSafeInteger(v.revision),confirmReview:async()=>true,onSave(){},onLogo(){},
    fetchImpl:async(url,init={})=>{
      const out=await r.request(init.method||'GET',url,init.body&&JSON.parse(init.body),undefined,init.headers);
      return {ok:out.statusCode===200,status:out.statusCode,json:async()=>out.body};
    }});
}
async function lifecycle() {
  const r=runtime({postgresLogo:true}), s=await sessionFor(r);
  const original=structuredClone(r.db.brands[0].brand_core);
  const file={name:'disposable.png',type:'image/png',size:png.length};
  await s.chooseFile(file,async()=>png.toString('base64'));
  r.db.failLogoMetadata=true;
  assert.equal(await s.upload(),false);assert.equal(s.state.file,file);
  assert.equal(r.objects.size,1);assert.equal(r.db.brands[0].logo_revision,0);
  const [key]=r.objects.keys();
  r.db.failLogoMetadata=false;
  const first=s.upload(), duplicateClick=s.upload();
  assert.equal(first,duplicateClick,'One in-flight controller transition');
  assert(await first,s.state.message);
  assert.equal(r.objects.size,1);assert.equal(r.db.history.length,1);
  assert.deepEqual(r.storageRequests,['POST','POST','GET','GET']);
  const attempts=r.requests.filter(q=>q.method==='POST'&&q.path.endsWith('/logo'));
  assert.equal(attempts.length,2);assert.deepEqual(attempts[0].body,attempts[1].body);
  assert.equal(r.db.brands[0].logo_object_path,key);
  assert.deepEqual(r.objects.get(key),png);
  s.state.name='Saved profile';assert(await s.save(),s.state.message);
  const fresh=(await r.request('GET',`/api/brands/${B}`)).body;
  assert.equal(fresh.name,'Saved profile');assert.equal(fresh.logo_revision,1);
  assert.deepEqual((await r.request('GET',fresh.logo_url)).body,png);
  assert.deepEqual(fresh.brand_core,original);
  // A retained collision with different bytes must never be adopted.
  const bad=runtime({postgresLogo:true}), blocked=await sessionFor(bad);
  await blocked.chooseFile(file,async()=>png.toString('base64'));
  bad.db.failLogoMetadata=true;assert.equal(await blocked.upload(),false);
  const [badKey]=bad.objects.keys();bad.objects.set(badKey,Buffer.from('different bytes'));
  bad.db.failLogoMetadata=false;assert.equal(await blocked.upload(),false);
  assert.equal(bad.db.brands[0].logo_revision,0);assert.equal(bad.db.history.length,0);
  assert.equal(blocked.state.file,file);assert.equal(bad.objects.size,1);
  assert.deepEqual(bad.objects.get(badKey),Buffer.from('different bytes'));
  const denied=runtime({postgresLogo:true});
  const input={contract:'brand_logo_v1',action:'upload',request_id:randomUUID(),workspace_id:W,expected_revision:0,mime_type:'image/png',image_base64:png.toString('base64')};
  assert.equal((await denied.request('POST',`/api/brands/${B}/logo`,input,null)).statusCode,401);
  assert.equal((await denied.request('POST',`/api/brands/${B}/logo`,input,{email:'outsider@example.test'})).statusCode,403);
  assert.equal((await denied.request('POST',`/api/brands/${B}/logo`,{...input,workspace_id:randomUUID()})).statusCode,403);
  assert.equal((await denied.request('POST',`/api/brands/${B}/logo`,{...input,image_base64:Buffer.from('invalid').toString('base64')})).statusCode,415);
  assert.equal(denied.storageRequests.length,0,'Authorization and validation failures stop before storage');
}
(async()=>{await contract();await lifecycle();console.log('PASS BW-42.2 Supabase duplicate envelope, bounded error parsing, immutable retry/readback, digest mismatch rejection, one in-flight mutation, profile save and fresh authenticated reload. External SQL/storage are disposable fixtures; live incident cause is unverified.');})()
  .catch(error=>{console.error(error);process.exitCode=1;});
