'use strict';
const route=require('./social-connector-route');
const {outcome,CALLBACK_PHASES}=require('./social-connector/linkedin-service');
// A bounded outcome plus opaque request IDs avoids a new result table while keeping provider data out of browser history.
const SAFE=/^[A-Za-z0-9_-]{8,128}$/;
const CLASSIFICATIONS=new Set(['connection','configuration','authorization','oauth_state','provider','identity','storage']);
const PHASES=new Set(CALLBACK_PHASES);
function redirect(res,result,id){
  const error=result.ok?null:result.error||{};
  const params=new URLSearchParams({social:outcome(result.ok?result.value.result:error.code),classification:result.ok?'connection':(CLASSIFICATIONS.has(error.classification)?error.classification:'connection'),phase:result.ok?'completed':(PHASES.has(error.phase)?error.phase:'callback_entered'),operation_category:result.ok?'non_critical':String(error.operationCategory||'critical'),commit_status:result.ok?String(result.value.committedState||'committed'):String(error.committedState||'unknown'),server_request_id:SAFE.test(String(error.serverRequestId||id))?String(error.serverRequestId||id):id,timestamp:String(error.timestamp||new Date().toISOString())});
  if(/^[0-9a-f-]{36}$/i.test(result.value?.attemptId||result.attemptId||''))params.set('attempt_id',result.value?.attemptId||result.attemptId);
  if(SAFE.test(String(error.clientRequestId||'')))params.set('client_request_id',error.clientRequestId);
  res.statusCode=303;res.setHeader('cache-control','no-store');res.setHeader('location',`/?${params}`);res.end();
}
module.exports=async function(req,res){const id=route.requestId(req);if(req.method!=='GET'){res.statusCode=405;return res.end();}const owner=route.user(req);if(!owner)return redirect(res,{ok:false,error:{code:'linkedin_state_invalid',classification:'authorization',phase:'callback_entered',serverRequestId:id}},id);try{await route.ensure();const url=new URL(req.url,'https://funklix.invalid');let result=await route.service().complete({ownerAccountId:owner,sessionBinding:route.fingerprint(req),state:url.searchParams.get('state'),code:url.searchParams.get('code'),serverRequestId:id});const providerError=url.searchParams.get('error');if(providerError&&result.error?.code==='linkedin_code_missing')result={...result,error:{...result.error,code:providerError==='user_cancelled_authorize'?'linkedin_authorization_cancelled':'linkedin_authorization_denied'}};return redirect(res,result,id);}catch{return redirect(res,{ok:false,error:{code:'linkedin_storage_failed',classification:'storage',phase:'callback_entered',serverRequestId:id}},id);}};
module.exports.redirect=redirect;
