'use strict';
const assert=require('assert');
const fs=require('fs');
const response=require('../api/_authoritative-response');

function capture(){const headers={};return{headers,res:{setHeader:(k,v)=>{headers[k.toLowerCase()]=v;},end:value=>{assert.strictEqual(this?.ended,undefined);headers.body=value;}},headers};}
function serialized(body,status=200){const state={headers:{},writes:0};const res={setHeader:(key,value)=>{state.headers[key.toLowerCase()]=value;},end:value=>{state.writes+=1;state.body=value;}};response.write(res,status,body);return state;}
function base(extra={}){return{contract_version:response.CONTRACT_VERSION,ok:false,status:'approval_rejected',classification:'approval_rejected',server_request_id:'req_fixture_boundary',retryable:false,...extra};}

async function main(){
 const approvalFailure=serialized(base(),409);assert.strictEqual(approvalFailure.writes,1);assert.match(approvalFailure.headers['content-type'],/^application\/json/);assert.strictEqual(approvalFailure.headers['x-request-id'],JSON.parse(approvalFailure.body).server_request_id);
 const approvalSuccess=serialized(base({ok:true,status:'approval_saved',classification:'approval_saved',board_id:'board',node_id:'node',fingerprint_version:'v2',board_revision:'2026-09-09T00:00:00.000Z',approval_write_result:'server'}));assert.strictEqual(JSON.parse(approvalSuccess.body).status,'approval_saved');
 for(const unsafe of [undefined,1n,new Date(),new Error('secret'),new Set(),new Map(),Buffer.from('secret')])assert.throws(()=>serialized(base({unsafe})),/unsafe_authoritative_envelope/);
 const cyclic=base();cyclic.cyclic=cyclic;assert.throws(()=>serialized(cyclic),/unsafe_authoritative_envelope/);
 const emergency=serialized({contract_version:response.CONTRACT_VERSION,ok:false,status:'reconciliation_required',classification:'response_construction_failed',server_request_id:'req_fixture_boundary',job_id:'00000000-0000-4000-8000-000000000001',retryable:false},503);assert.strictEqual(JSON.parse(emergency.body).job_id,'00000000-0000-4000-8000-000000000001');
 const approval=fs.readFileSync(require.resolve('../api/content-review/approve'),'utf8'),publish=fs.readFileSync(require.resolve('../api/social-publishing/linkedin/publish'),'utf8'),jobs=fs.readFileSync(require.resolve('../api/social-publishing/jobs/[id]'),'utf8'),service=fs.readFileSync(require.resolve('../api/social-connector/publishing-service'),'utf8'),app=fs.readFileSync(require.resolve('../app'),'utf8'),browser=fs.readFileSync(require.resolve('../content-workspace'),'utf8');
 assert(approval.includes("'approval_saved'")&&approval.includes("'approval_rejected'")&&approval.includes("'storage_unavailable'"));
 assert(publish.includes('route.authoritative.emergency')&&publish.includes("jobId=result.jobId||''"));
 assert(jobs.includes('.jobResult(')&&!jobs.includes('linkedin_text_publish_v1'));
 assert(service.indexOf('INSERT INTO public.social_publish_jobs')<service.indexOf('adapter.linkedin_text_publish_v1'));
 const provider=service.indexOf('adapter.linkedin_text_publish_v1'),accepted=service.indexOf("status='accepted'",provider),provenance=service.indexOf('INSERT INTO public.social_external_posts',provider);assert(accepted>provider&&provenance>accepted);
 assert(service.includes('try { client.release(); } catch {}'));
 for(const category of ['empty_body','html_response','wrong_content_type','invalid_json','structured_failure'])assert(app.includes(`'${category}'`),category);
 assert(app.includes("result.status!=='approval_saved'")&&app.indexOf("result.status!=='approval_saved'")<app.indexOf('diagnostic.phase = "authoritative_reload"'));
 assert(browser.includes('result?.jobId&&result.status!=="published"')&&browser.includes('duplicate_delivery_prevented:durable'));
 assert(!service.includes('company_page')&&!service.includes('image_publish'));
 assert.strictEqual(process.env.LINKEDIN_TEXT_PUBLISHING_ENABLED==='true',false,'regression never enables personal publishing');
 console.log('BW-32.3.9 authoritative route serialization checks passed (controlled fixtures only; zero live LinkedIn calls).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
