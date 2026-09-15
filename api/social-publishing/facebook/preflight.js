'use strict';
const route = require('../../social-publishing-route');
const {createFacebookPublishingService}=require('../../social-connector/facebook-publishing-service');
const confirmation=require('../../social-connector/facebook-preflight-contract');
const response=require('../../social-connector/facebook-preflight-response');
function presence(env=process.env){const version=String(env.SOCIAL_CONNECTOR_ENCRYPTION_KEY_VERSION||'');return {facebookPublishingEnabled:String(env.FACEBOOK_PAGE_PUBLISHING_ENABLED||'').toLowerCase()==='true',facebookAppId:!!env.FACEBOOK_APP_ID,facebookAppSecret:!!env.FACEBOOK_APP_SECRET,encryptionKeyVersion:!!version,encryptionKey:!!(version&&env[`SOCIAL_CONNECTOR_ENCRYPTION_KEY_V${version}`]),database:!!(env.POSTGRES_URL||env.DATABASE_URL)};}
function failure(req,serverRequestId,stage,code,status,error){const databaseCode=typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:undefined;console.error('[facebook_preflight_failure]',{requestId:req.headers?.['x-vercel-id']||serverRequestId,stage,code,httpStatus:status,errorCategory:error instanceof TypeError?'type_error':'operational_error',configuration:presence(),...(databaseCode?{databaseCode}:{})});}
module.exports = async function handler(req,res){
  const serverRequestId=route.requestId(req);
  if(req.method!=='POST')return route.send(res,405,{ok:false,status:'method_not_allowed',serverRequestId});
  const identity=route.actor(req);
  if(!identity)return route.send(res,401,{ok:false,status:'authentication_required',serverRequestId});
  let stage='request_body';
  try{
    const body=await route.readBody(req);
    if(!route.validInput(body))return route.send(res,400,{ok:false,status:'request_invalid',classification:'invalid_local_request',serverRequestId});
    stage='publishing_preflight';
    const result=await createFacebookPublishingService({pool:route.pool}).preflight({...body,ownerAccountId:identity.ownerAccountId,serverRequestId,responseLanguage:req.headers?.['accept-language']?.startsWith('de')?'de':'en'},identity.user);
    let confirmationToken;
    if(result.ok){stage='confirmation_binding';confirmationToken=confirmation.issue({...body,expectedApprovedFingerprint:result.approvedFingerprint});}
    stage='response_projection';
    const publicResult=result.ok?response.project(result,{confirmationToken,serverRequestId,clientRequestId:body.clientRequestId}):{...result,serverRequestId,clientRequestId:body.clientRequestId};
    stage='response_serialization';
    return route.send(res,result.ok?200:409,publicResult);
  }catch(error){
    const code=stage==='confirmation_binding'?'confirmation_binding_unavailable':stage==='request_body'?'request_body_unavailable':stage==='response_projection'?'response_projection_invalid':stage==='response_serialization'&&['response_contract_invalid','response_json_serialization_failed','response_write_failed'].includes(error?.code)?error.code:stage==='response_serialization'?'response_write_failed':'publishing_storage_unavailable';
    failure(req,serverRequestId,stage,code,503,error);
    return route.send(res,503,{ok:false,status:'preflight_unavailable',classification:'temporary_server_failure',failureCode:code,serverRequestId});
  }
};
module.exports.presence=presence;
