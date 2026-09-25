'use strict';
const assert=require('assert'),fs=require('fs');
const source=fs.readFileSync('content-workspace.js','utf8'),app=fs.readFileSync('app.js','utf8');
assert(source.includes('generation:c.requestLifecycleGeneration??c.accessGeneration'), 'zero lifecycle generation must remain authoritative');
assert(!source.includes('generation:c.requestLifecycleGeneration||c.accessGeneration'), 'truthy fallback caused production pre-dispatch rejection');
assert(source.includes('`req_autoplan_${Date.now().toString(36)}_'), 'Apply boundary owns the request id');
assert(app.includes('clientRequestId=String(prepared.correlationId||"")'), 'browser dispatch must carry the same id');
const route=require('../api/boards/[id]/posting-schedule-batch');
const response={statusCode:0,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(v){this.body=v;}};
route.createHandler({getSessionUser:()=>null,diagnostic:()=>{}})({method:'PUT',headers:{'x-request-id':'req_autoplan_evidence_1'},query:{id:'00000000-0000-4000-8000-000000000001'},body:{}},response).then(()=>{
 const body=JSON.parse(response.body);assert.deepEqual({ok:body.ok,code:body.code,stage:body.stage,request_id:body.request_id},{ok:false,code:'authentication_required',stage:'authentication',request_id:'req_autoplan_evidence_1'});assert.equal(response.statusCode,401);assert.match(response.headers['content-type'],/^application\/json/);console.log('BW-35.3R5 production evidence checks passed');
}).catch(error=>{console.error(error);process.exitCode=1;});
