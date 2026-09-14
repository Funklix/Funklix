'use strict';
const crypto=require('crypto');
const {getSessionUser}=require('./_auth-session');
const {createStorage}=require('./social-connector/storage');
const config=require('./social-connector/linkedin-config');
const facebookConfig=require('./social-connector/facebook-config');
const service=require('./social-connector/linkedin-service');
const settings=require('./social-connector/settings-projection');
const contract=require('../social-connections-response-contract');
function identityDiagnostic(env=process.env){const build=String(env.VERCEL_GIT_COMMIT_SHA||env.BUILD_ID||'bw32.2.9').slice(0,64).replace(/[^A-Za-z0-9._-]/g,'_');const secret=env.SESSION_SECRET||env.SOCIAL_TOKEN_ENCRYPTION_KEY,material=env.POSTGRES_URL;if(!secret||!material)return {build_identity:build};return {build_identity:build,database_identity_digest:crypto.createHmac('sha256',secret).update(material).digest('hex').slice(0,16)};}
function facebookProjection(configuration,rows){const connection=rows.find(x=>x.platform==='facebook'&&x.status!=='disconnected')||rows.find(x=>x.platform==='facebook');if(!configuration.ready)return{state:'setup_required',configured:false,connect_allowed:false,reconnect_allowed:false,disconnect_allowed:false,configuration_issue:configuration.readiness,destinations:[]};if(!connection||connection.status==='disconnected')return{state:'not_connected',configured:true,connect_allowed:true,reconnect_allowed:false,disconnect_allowed:false,destinations:[]};const credentialValid=connection.token_secret_exists===true&&connection.token_secret_valid===true&&!!connection.token_secret_id;const connected=connection.status==='connected'&&credentialValid;const destinations=(connection.destinations||[]).filter(d=>d.status==='active'&&d.authorization_state==='authorized'&&d.destination_type==='page'&&Array.isArray(d.capabilities)&&d.capabilities.includes('CREATE_CONTENT')).map(d=>({id:d.id,label:d.display_name,type:'page',capabilities:['CREATE_CONTENT'],selected:connected&&d.active===true}));const selected=destinations.find(d=>d.selected);return{state:connected?'connected':'needs_attention',configured:true,connect_allowed:false,reconnect_allowed:true,disconnect_allowed:true,connection_id:connection.id,display_name:connection.external_display_name,permission_state:connected?'authorized':'permission_expired',destination_id:selected?.id||null,destinations};}
module.exports=async function(req,res){
 const serverRequestId=service.requestId(req),user=getSessionUser(req),owner=service.accountId(user),diagnostic={phase:'request_authenticated',operation_category:'storage_unknown',...identityDiagnostic()};
 res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('x-request-id',serverRequestId);
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({contract_version:contract.VERSION,ok:false,status:'method_not_allowed',code:'method_not_allowed',timestamp:new Date().toISOString(),server_request_id:serverRequestId}));}
 if(!owner){res.statusCode=401;return res.end(JSON.stringify(contract.authentication({serverRequestId})));}
 const c=config.load(),fc=facebookConfig.load();
 if(!c.ready&&!fc.ready){const payload=contract.success({linkedin:settings.project({configuration:c}),others:['instagram','x'],serverRequestId,buildIdentity:diagnostic.build_identity});payload.social_connections.facebook=facebookProjection(fc,[]);return res.end(JSON.stringify(payload));}
 try{
  const rows=await createStorage({diagnostic}).listConnectionProjection(owner),row=rows.find(x=>x.platform==='linkedin'&&x.status!=='disconnected')||rows.find(x=>x.platform==='linkedin');
  diagnostic.phase='response_construction';diagnostic.operation_category='response_construction';
  const payload=contract.success({linkedin:settings.project({configuration:c,row}),others:['instagram','x'],serverRequestId,buildIdentity:diagnostic.build_identity});payload.social_connections.facebook=facebookProjection(fc,rows);return res.end(JSON.stringify(payload));
 }catch{
  res.statusCode=503;const linkedin=settings.unavailable(serverRequestId,diagnostic);
  return res.end(JSON.stringify(contract.serviceUnavailable({linkedin,serverRequestId})));
 }
};
