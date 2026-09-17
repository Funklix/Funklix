'use strict';
const assert=require('assert');
const {createFacebookAdapter}=require('../api/social-connector/facebook-adapter');
const {projectAggregates,failureCode}=require('../api/social-connector/facebook-engagement-service');
const diagnostics=require('../api/social-connector/facebook-engagement-diagnostics');
(async()=>{
 let calls=0;const adapter=createFacebookAdapter({fetchImpl:async url=>{calls++;const fields=new URL(String(url)).searchParams.get('fields');if(fields.includes('comments'))return{ok:false,status:400,text:async()=>JSON.stringify({error:{code:10}})};return{ok:true,status:200,text:async()=>JSON.stringify({reactions:{summary:{total_count:0}}})};}});
 const result=await adapter.facebook_post_engagement_read_v1({context:{requestId:'safe'},credential:{accessToken:'invented-page-token',tokenSource:'selected_page_token'},input:{pageId:'101010',postId:'101010_202020'}});
 assert(result.ok);assert.equal(calls,2);assert.equal(result.partialResultCategory,'optional_metrics_permission_unavailable');assert.deepStrictEqual(projectAggregates(result.value),{reactions:{state:'available',value:0},comments:{state:'unavailable'},shares:{state:'unavailable'}});
 assert.equal(failureCode({error:{code:'credential_invalid'},providerOAuthCategory:'oauth_190'}),'reconnect_required');assert.equal(failureCode({error:{code:'permission_missing'},providerOAuthCategory:'oauth_10'}),'insufficient_permission');
 const safe=diagnostics.diagnostic('safe',{ok:true,metrics:projectAggregates(result.value),permissionPresent:true,partialResultCategory:result.partialResultCategory,failedMetricCategory:result.failedMetricCategory});assert.equal(safe.pages_read_user_content_requested,false);assert.equal(safe.pages_manage_engagement_requested,false);assert.equal(safe.partial_result_category,'optional_metrics_permission_unavailable');assert(!JSON.stringify(safe).includes('101010'));
 console.log('BW-34.2AR4 partial-availability checks passed (bounded OAuth 10 fallback, authoritative zero, unavailable optional metrics, no network/database).');
})().catch(error=>{console.error(error);process.exit(1);});
