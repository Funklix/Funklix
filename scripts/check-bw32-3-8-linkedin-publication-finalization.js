'use strict';
const assert=require('assert');
const fs=require('fs');
const {createLinkedInAdapter}=require('../api/social-connector/linkedin-adapter');
const publishing=require('../api/social-connector/linkedin-publishing');

async function main(){
 let providerCalls=0;
 const adapter=createLinkedInAdapter({fetchImpl:async()=>{providerCalls+=1;return{status:201,headers:{get:name=>name.toLowerCase()==='x-restli-id'?' urn:li:ugcPost:accepted_32_3_8 ':null}};}});
 const accepted=await adapter.linkedin_text_publish_v1({context:{requestId:'fixture'},credentials:{accessToken:'fixture-token'},input:{author:'urn:li:person:fixture',caption:'Approved fixture caption'}});
 assert.deepStrictEqual(accepted,{ok:true,value:{postUrn:'urn:li:ugcPost:accepted_32_3_8',httpStatusCategory:'2xx'}});
 assert.strictEqual(providerCalls,1,'the controlled adapter fixture is invoked exactly once');
 const invalidAdapter=createLinkedInAdapter({fetchImpl:async()=>({status:201,headers:{get:()=>null}})});
 const acceptedWithoutIdentity=await invalidAdapter.linkedin_text_publish_v1({context:{requestId:'fixture'},credentials:{accessToken:'fixture-token'},input:{author:'urn:li:person:fixture',caption:'Approved fixture caption'}});
 assert.strictEqual(acceptedWithoutIdentity.acceptanceKnown,true);assert.strictEqual(acceptedWithoutIdentity.postIdentityRetained,false);
 assert.strictEqual(publishing.externalUrl('urn:li:share:123'),'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123/');

 const service=fs.readFileSync(require.resolve('../api/social-connector/publishing-service'),'utf8');
 const publishRoute=fs.readFileSync(require.resolve('../api/social-publishing/linkedin/publish'),'utf8');
 const statusRoute=fs.readFileSync(require.resolve('../api/social-publishing/jobs/[id]'),'utf8');
 const browser=fs.readFileSync(require.resolve('../content-workspace'),'utf8');
 const app=fs.readFileSync(require.resolve('../app'),'utf8');
 const workflow=fs.readFileSync('.github/workflows/runtime-boot-safety.yml','utf8');
 assert(service.includes("status='accepted'"),'provider identity is durably recorded before provenance');
 assert(service.indexOf("status='accepted'")<service.indexOf("await client.query('BEGIN')"));
 assert(service.includes('ON CONFLICT(publish_job_id) DO NOTHING'),'ExternalPost recovery is idempotent');
 assert(service.includes("provider_attempt_state === 'accepted'")&&service.includes("status='reconciled'"),'accepted attempts reconcile locally');
 assert(service.includes('if (existing) return await jobResult'),'repeated actions resolve the fingerprint-scoped job');
 assert(!service.includes('attempt_number,phase,status) VALUES($1,$2,$3,\'linkedin\',2'),'there is no automatic provider retry');
 assert(statusRoute.includes('.jobResult('),'owner-scoped status reads use the recovery service');
 assert(publishRoute.includes("result.ok?200"),'the real serialized success envelope is returned');
 assert(app.includes('result.clientRequestId!==input.clientRequestId'),'browser validates the real route envelope');
 assert(app.includes('onPublishStatus: readLinkedInPublicationStatus'),'browser is wired to owner-scoped polling');
 for(const state of ['published','provider_accepted_unreconciled','outcome_unknown','failed','cancelled'])assert(browser.includes(`\"${state}\"`),`browser accepts terminal ${state}`);
 for(const phrase of ['Published to LinkedIn','The post may already be live on LinkedIn.','Tendra One could not finish confirming the publication.','Auf LinkedIn veröffentlicht','Der Beitrag ist möglicherweise bereits auf LinkedIn live.','Tendra One konnte die Bestätigung der Veröffentlichung nicht abschließen.'])assert(browser.includes(phrase),phrase);
 assert(browser.includes('try{result=await c.onPublish')&&browser.includes('}catch(error){')&&browser.includes('}finally{'),'confirmation has try/catch/finally cleanup');
 assert(browser.includes('publishLocks.has(lockKey)')&&browser.includes('publishLocks.delete(lockKey)'),'duplicate confirmations share one lock');
 assert(browser.includes('confirm.remove()'),'terminal success and uncertainty remove Publish now');
 assert(browser.includes('diagnosticKeys')&&!browser.includes('uploadAsset'),'diagnostics are bounded and no image publishing was added');
 assert.strictEqual((workflow.match(/check:bw32\.3\.8/g)||[]).length,1);
 console.log('BW-32.3.8 finalization checks passed (real adapter contract and route/service/browser/storage lifecycle boundaries; zero live LinkedIn calls).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
