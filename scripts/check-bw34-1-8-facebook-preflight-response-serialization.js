'use strict';
const assert = require('assert');
const fs = require('fs');
const authoritative = require('../api/_authoritative-response');
const route = require('../api/social-publishing-route');
const serviceModule = require('../api/social-connector/facebook-publishing-service');
const projection = require('../api/social-connector/facebook-preflight-response');

const handlerPath = require.resolve('../api/social-publishing/facebook/preflight');
const body = { boardId:'11111111-1111-4111-8111-111111111111', nodeId:'approved_node', destinationId:'22222222-2222-4222-8222-222222222222', clientRequestId:'request_1', expectedApprovedFingerprint:'v2-'+('a'.repeat(64)) };
const binding = 'opaque.header_signature';
const productionResult = {
  ok:true, status:'ready', blockingCodes:[], diagnostic:{phase:'authoritative_preflight'},
  confirmationRequired:true, caption:'Authoritative approved copy', link:null, characterCount:[...'Authoritative approved copy'].length,
  profileDisplayName:'Connected account', destination:{id:body.destinationId,type:'page',label:'Authoritative Page'},
  approvedFingerprint:body.expectedApprovedFingerprint, readiness:'Ready', editorialStatus:'Approved',
  // pg returns timestamp columns as Date objects. The former spread leaked this nested service value.
  provenance:{platform:'linkedin',publishedAt:new Date('2026-09-15T00:00:00.000Z')}
};
const oldEnvelope = route.snake({...productionResult,confirmationToken:binding,serverRequestId:'req_fixture_123',clientRequestId:body.clientRequestId},'req_fixture_123');
assert.strictEqual(authoritative.isPlain(oldEnvelope),false,'historical Date-valued provenance reaches the former unsafe-authoritative-envelope branch');

const dto = projection.project(productionResult,{confirmationToken:binding,serverRequestId:'req_fixture_123',clientRequestId:body.clientRequestId});
assert(authoritative.isPlain(route.snake(dto,dto.serverRequestId)),'public DTO contains JSON-safe plain values only');
assert.doesNotThrow(()=>JSON.stringify(route.snake(dto,dto.serverRequestId)));
assert(!('provenance' in dto) && !('diagnostic' in dto) && !JSON.stringify(dto).includes('2026-09-15'));
for (const invalid of [
  {...productionResult,caption:undefined}, {...productionResult,characterCount:NaN},
  {...productionResult,destination:{...productionResult.destination,id:'external-page-id'}},
  {...productionResult,approvedFingerprint:'malformed'}
]) assert.throws(()=>projection.project(invalid,{confirmationToken:binding,serverRequestId:'req_fixture_123',clientRequestId:body.clientRequestId}),error=>error.code==='response_projection_invalid');

(async()=>{
  const originals={actor:route.actor,readBody:route.readBody,factory:serviceModule.createFacebookPublishingService,error:console.error,secret:process.env.FACEBOOK_APP_SECRET};
  const calls={service:0,meta:0,mutation:0,logs:[]};let responseBody='';
  route.actor=()=>({ownerAccountId:'owner',user:{id:'actor'}});route.readBody=async()=>body;
  serviceModule.createFacebookPublishingService=()=>({preflight:async()=>{calls.service++;return productionResult;}});
  console.error=(...values)=>calls.logs.push(values);process.env.FACEBOOK_APP_SECRET='fixture-secret';delete require.cache[handlerPath];
  const res={setHeader(){},end(value){responseBody=value;}};
  await require(handlerPath)({method:'POST',headers:{'x-request-id':'req_fixture_123'}},res);
  const payload=JSON.parse(responseBody);
  assert.strictEqual(res.statusCode,200);assert.strictEqual(payload.caption,productionResult.caption);assert.strictEqual(payload.destination.label,'Authoritative Page');
  assert.strictEqual(payload.client_request_id,body.clientRequestId);assert.strictEqual(payload.approved_fingerprint,body.expectedApprovedFingerprint);
  assert.strictEqual(typeof payload.confirmation_token,'string');assert(!JSON.stringify(calls.logs).includes(payload.confirmation_token));assert.deepStrictEqual(calls,{service:1,meta:0,mutation:0,logs:[]});
  const app=fs.readFileSync('app.js','utf8'),workspace=fs.readFileSync('content-workspace.js','utf8');
  assert(app.includes('const result={ok:raw.ok===true,status:raw.status,classification:raw.classification'),'browser projects the snake-case contract exactly once');
  assert(app.includes("result.clientRequestId!==input.clientRequestId")&&app.includes("classification:'response_contract_invalid'"),'browser validates authoritative correlation and required confirmation fields');
  assert(!app.includes('return{...raw,serverRequestId:raw.server_request_id'));
  assert(workspace.includes('clientRequestId:authoritativeClientRequestId')&&workspace.includes('caption:raw.caption')===false,'confirmation uses the authoritative correlation ID and dialog consumes preflight values');
  assert(workspace.includes('esc(preflight.caption)')&&workspace.includes('preflight.destination?.label')&&workspace.includes('preflight.approvedFingerprint'));
  serviceModule.createFacebookPublishingService=originals.factory;route.actor=originals.actor;route.readBody=originals.readBody;console.error=originals.error;
  if(originals.secret===undefined)delete process.env.FACEBOOK_APP_SECRET;else process.env.FACEBOOK_APP_SECRET=originals.secret;
  console.log('BW-34.1.8 Facebook preflight response serialization regression passed (deterministic; no database mutation, provider, or Meta request).');
})().catch(error=>{console.error(error);process.exitCode=1;});
