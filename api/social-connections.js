'use strict';
const crypto=require('crypto');
const {getSessionUser}=require('./_auth-session');
const {createStorage}=require('./social-connector/storage');
const config=require('./social-connector/linkedin-config');
const service=require('./social-connector/linkedin-service');
const settings=require('./social-connector/settings-projection');
const contract=require('../social-connections-response-contract');
function identityDiagnostic(env=process.env){const build=String(env.VERCEL_GIT_COMMIT_SHA||env.BUILD_ID||'bw32.2.9').slice(0,64).replace(/[^A-Za-z0-9._-]/g,'_');const secret=env.SESSION_SECRET||env.SOCIAL_TOKEN_ENCRYPTION_KEY,material=env.POSTGRES_URL;if(!secret||!material)return {build_identity:build};return {build_identity:build,database_identity_digest:crypto.createHmac('sha256',secret).update(material).digest('hex').slice(0,16)};}
module.exports=async function(req,res){
 const serverRequestId=service.requestId(req),user=getSessionUser(req),owner=service.accountId(user),diagnostic={phase:'request_authenticated',operation_category:'storage_unknown',...identityDiagnostic()};
 res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('x-request-id',serverRequestId);
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({contract_version:contract.VERSION,ok:false,status:'method_not_allowed',code:'method_not_allowed',timestamp:new Date().toISOString(),server_request_id:serverRequestId}));}
 if(!owner){res.statusCode=401;return res.end(JSON.stringify(contract.authentication({serverRequestId})));}
 const c=config.load();
 if(!c.ready)return res.end(JSON.stringify(contract.success({linkedin:settings.project({configuration:c}),others:['instagram','facebook','x'],serverRequestId,buildIdentity:diagnostic.build_identity})));
 try{
  const rows=await createStorage({diagnostic}).listConnectionProjection(owner),row=rows.find(x=>x.platform==='linkedin'&&x.status!=='disconnected')||rows.find(x=>x.platform==='linkedin');
  diagnostic.phase='response_construction';diagnostic.operation_category='response_construction';
  return res.end(JSON.stringify(contract.success({linkedin:settings.project({configuration:c,row}),others:['instagram','facebook','x'],serverRequestId,buildIdentity:diagnostic.build_identity})));
 }catch{
  res.statusCode=503;const linkedin=settings.unavailable(serverRequestId,diagnostic);
  return res.end(JSON.stringify(contract.serviceUnavailable({linkedin,serverRequestId})));
 }
};
