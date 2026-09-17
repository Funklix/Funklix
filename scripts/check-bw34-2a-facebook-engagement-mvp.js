'use strict';
const assert=require('assert');
const fs=require('fs');
const {projectAggregates,failureCode}=require('../api/social-connector/facebook-engagement-service');
const {createFacebookAdapter}=require('../api/social-connector/facebook-adapter');
(async()=>{
 const complete=projectAggregates({reactions:{summary:{total_count:12}},comments:{summary:{total_count:3}},shares:{count:1},data:[{name:'never return'}]});
 assert.deepStrictEqual(complete,{reactions:{state:'available',value:12},comments:{state:'available',value:3},shares:{state:'available',value:1}});
 assert.deepStrictEqual(projectAggregates({reactions:{summary:{total_count:0}},comments:{summary:{total_count:0}}}),{reactions:{state:'available',value:0},comments:{state:'available',value:0},shares:{state:'unavailable'}});
 assert.equal(failureCode({error:{code:'permission_missing'}}),'insufficient_permission');assert.equal(failureCode({error:{code:'credential_invalid'}}),'credential_invalid');assert.equal(failureCode({error:{code:'provider_rate_limited'}}),'provider_rate_limited');assert.equal(failureCode({error:{code:'provider_transient_failure'}}),'provider_temporarily_unavailable');
 let calls=0,url,options;const adapter=createFacebookAdapter({fetchImpl:async(u,o)=>{calls++;url=String(u);options=o;return{ok:true,text:async()=>JSON.stringify({reactions:{summary:{total_count:0}},comments:{summary:{total_count:0}}})};}});const response=await adapter.facebook_post_engagement_read_v1({context:{requestId:'r'},credential:{accessToken:'invented-token',tokenSource:'selected_page_token'},input:{pageId:'123',postId:'123_456'}});assert(response.ok);assert.equal(calls,1);assert(url.includes('/v24.0/123_456?'));assert.equal(new URL(url).searchParams.get('fields'),'reactions.limit(0).summary(true),comments.limit(0).summary(true),shares');assert.equal(options.method,'GET');assert(!url.includes('invented-token'));assert.equal(options.headers.authorization,'Bearer invented-token');
 const service=fs.readFileSync('api/social-connector/facebook-engagement-service.js','utf8'),route=fs.readFileSync('api/social-publishing/facebook/engagement.js','utf8'),ui=fs.readFileSync('content-workspace.js','utf8');
 assert(service.includes("source_board_id=$2 AND e.source_node_id=$3")&&service.includes("e.platform='facebook'")&&service.includes("e.delivery_state='confirmed'"));assert(!/INSERT|UPDATE|DELETE FROM/.test(service));assert(!route.includes('external_post_id')&&!route.includes('external_destination_id')&&!route.includes('accessToken'));assert(route.includes('boardId')&&route.includes('nodeId')&&!route.includes('postId'));
 assert(ui.includes('facebookEngagementRequests.has(key)'));assert(ui.includes('finalizedFacebookByNode.has(nodeId)'));assert(ui.includes('Published to Facebook')&&ui.includes('Open on Facebook'));assert(!ui.includes('setInterval('));
 console.log('BW-34.2A focused regression passed: aggregate projection, zeros, unavailable shares, safe failures, bounded GET, ownership boundary, DTO privacy, publication-only UI, request deduplication, and existing publication UI.');
})().catch(error=>{console.error(error);process.exit(1);});
