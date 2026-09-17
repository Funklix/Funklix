'use strict';
const assert=require('assert'),fs=require('fs');
const response=require('../api/social-connector/facebook-publication-response');
const browserContract=require('../facebook-publication-contract');
// The route synchronously imports publishing-service -> _boards-storage -> pg.
// Install the bounded storage seam before the first real route import, as the
// Facebook callback clean-checkout regression does.
const storagePath=require.resolve('../api/_boards-storage'),routePath=require.resolve('../api/social-publishing-route');
const savedCache=[storagePath,routePath].map(path=>[path,require.cache[path]]),savedFetch=globalThis.fetch;
const savedEnv={AUTH_SECRET:process.env.AUTH_SECRET,SESSION_SECRET:process.env.SESSION_SECRET};
require.cache[storagePath]={id:storagePath,filename:storagePath,loaded:true,exports:{pool:Object.freeze({query:async()=>{throw new Error('database_forbidden_in_bw34_1_9');},connect:async()=>{throw new Error('database_forbidden_in_bw34_1_9');}})}};
function restore(){globalThis.fetch=savedFetch;for(const [key,value] of Object.entries(savedEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;for(const [path,cached] of savedCache)if(cached)require.cache[path]=cached;else delete require.cache[path];}
(async()=>{const route=require(routePath);
const historical={ok:true,status:'published',jobId:'11111111-1111-4111-8111-111111111111',providerAttemptId:'22222222-2222-4222-8222-222222222222',publishedAt:new Date('2026-09-15T19:57:48.346Z'),externalUrl:'https://www.facebook.com/tendra/posts/fixture',destination:{type:'page',label:'Tendra One'}};
assert.throws(()=>response.project(historical,{clientRequestId:'publish_mu33fr1t_l9o4sphy',serverRequestId:'req_fixture123'}),/projection_invalid/,'historical success lacks durable final-state fields');
const repaired=response.project({...historical,jobState:'delivered',providerAttemptState:'accepted'},{clientRequestId:'publish_mu33fr1t_l9o4sphy',serverRequestId:'req_fixture123'});
assert.strictEqual(repaired.status,'published');assert.strictEqual(repaired.externalPostState,'confirmed');assert.strictEqual(repaired.duplicateDeliveryPrevented,true);assert.strictEqual(repaired.publishedAt,'2026-09-15T19:57:48.346Z');
assert.strictEqual(response.project({...historical,jobState:'delivered',providerAttemptState:'reconciled',externalUrl:null},{clientRequestId:'publish_fixture',serverRequestId:'req_fixture123'}).externalUrl,null,'optional permalink does not erase success');
assert.throws(()=>response.project({...historical,jobState:'delivered',providerAttemptState:'accepted',externalUrl:'http://facebook.invalid/post'},{clientRequestId:'publish_fixture',serverRequestId:'req_fixture123'}));
const http={headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=value;},end(body){this.body=body;}};route.send(http,200,repaired);assert.equal(http.statusCode,200);assert.equal(http.headers['content-type'],'application/json; charset=utf-8');assert.equal(http.headers['x-request-id'],'req_fixture123');const serialized=JSON.parse(http.body);for(const key of ['job_id','job_state','provider_attempt_state','provider_acceptance_category','provider_post_identity_category','external_post_state','published_at','finalized','duplicate_delivery_prevented'])assert(Object.hasOwn(serialized,key),key);assert.strictEqual(http.body.includes('postId'),false);
const projected=browserContract.fromWire(serialized,'publish_mu33fr1t_l9o4sphy');assert(projected.valid,'the actual route response serialization is accepted');assert.equal(projected.result.serverRequestId,'req_fixture123');assert.equal(projected.result.jobState,'delivered');assert.equal(projected.result.destination.label,'Tendra One');assert(!browserContract.fromWire({...serialized,job_state:undefined},'publish_mu33fr1t_l9o4sphy').valid,'incomplete success is ambiguous');
const service=fs.readFileSync(require.resolve('../api/social-connector/facebook-publishing-service'),'utf8'),publish=fs.readFileSync(require.resolve('../api/social-publishing/facebook/publish'),'utf8'),ui=fs.readFileSync(require.resolve('../content-workspace'),'utf8'),app=fs.readFileSync(require.resolve('../app'),'utf8');
assert(service.includes('ON CONFLICT(owner_account_id,idempotency_key) DO NOTHING'));assert(service.includes('if (existing) return await jobResult'));assert(service.includes('publicationForNode'));assert(service.indexOf("INSERT INTO public.social_external_posts")<service.lastIndexOf("return { ok: true, status: 'published'"));
assert(publish.includes('publicationResponse.project'));assert(app.includes('reconcileFacebookPublication'));assert(ui.includes('This publishes immediately and publicly to Facebook.'));assert(ui.includes('The post may already be live on Facebook.'));assert(ui.includes('This publishes immediately and publicly to LinkedIn.'));assert(ui.includes('The post may already be live on LinkedIn.'));assert(!ui.match(/publishPublicFacebook:\"[^\"]*LinkedIn/));
assert(![service,publish,app,ui].some(x=>x.includes('graph.facebook.com')),'regression has no Meta request');
console.log('BW-34.1.9 finalization checks passed (pure DTO, reload/idempotency/copy boundaries; zero Meta requests or database mutations).');
})().finally(restore).catch(error=>{console.error(error);process.exitCode=1;});
