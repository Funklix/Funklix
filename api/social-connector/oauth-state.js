'use strict';
const crypto=require('crypto');
const { exact, platform, boundedText, stableId }=require('./contracts');
const { connectorError }=require('./errors');
const MAX_TTL_MS=10*60*1000;
function safeReturn(value){return typeof value==='string'&&value.length<=300&&/^\/(?!\/)(?:settings(?:[/?#].*)?)?$/.test(value);}
function create(input,{now=Date.now,randomBytes=crypto.randomBytes}={}){
  if(!exact(input,['ownerAccountId','platform','returnPath','sessionFingerprint'],['pkceVerifierReference','ttlMs'])||!boundedText(input.ownerAccountId,320)||!platform(input.platform)||!safeReturn(input.returnPath)||!boundedText(input.sessionFingerprint,128)||input.pkceVerifierReference!==undefined&&!stableId(input.pkceVerifierReference))throw connectorError('connector_contract_invalid');
  const ttl=input.ttlMs===undefined?300000:input.ttlMs;if(!Number.isInteger(ttl)||ttl<30000||ttl>MAX_TTL_MS)throw connectorError('connector_contract_invalid');const createdAt=now();
  return Object.assign(Object.create(null),{attemptId:`oa_${randomBytes(18).toString('base64url')}`,ownerAccountId:input.ownerAccountId,platform:input.platform,returnPath:input.returnPath,state:randomBytes(32).toString('base64url'),pkceVerifierReference:input.pkceVerifierReference||null,sessionFingerprint:input.sessionFingerprint,createdAt:new Date(createdAt).toISOString(),expiresAt:new Date(createdAt+ttl).toISOString(),consumedAt:null,failureClassification:null});
}
function equal(a,b){const left=Buffer.from(typeof a==='string'?a:'');const right=Buffer.from(typeof b==='string'?b:'');const length=Math.max(left.length,right.length,1),x=Buffer.alloc(length),y=Buffer.alloc(length);left.copy(x);right.copy(y);return left.length===right.length&&crypto.timingSafeEqual(x,y);}
function consume(attempt,input,{now=Date.now}={}){
  if(!attempt||!exact(input,['state','ownerAccountId','platform','sessionFingerprint'])||!equal(attempt.state,input.state))throw connectorError('oauth_state_invalid');
  if(attempt.consumedAt)throw connectorError('oauth_state_consumed');if(now()>=Date.parse(attempt.expiresAt))throw connectorError('oauth_state_expired');if(attempt.ownerAccountId!==input.ownerAccountId)throw connectorError('account_mismatch');if(attempt.platform!==input.platform)throw connectorError('oauth_state_invalid');if(!equal(attempt.sessionFingerprint,input.sessionFingerprint))throw connectorError('oauth_session_mismatch');if(!safeReturn(attempt.returnPath))throw connectorError('oauth_return_invalid');attempt.consumedAt=new Date(now()).toISOString();return {ok:true,attemptId:attempt.attemptId,returnPath:attempt.returnPath};
}
module.exports={MAX_TTL_MS,safeReturn,create,consume};
