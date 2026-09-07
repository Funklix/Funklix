'use strict';
const assert=require('assert'),fs=require('fs');
// Install CommonJS dependency-boundary fixtures before loading the real route.
const storagePath=require.resolve('../api/_boards-storage');
require.cache[storagePath]={id:storagePath,filename:storagePath,loaded:true,exports:{pool:{query:async()=>({rows:[]}),connect:async()=>({query:async()=>({rows:[]}),release(){}})}}};
const authPath=require.resolve('../api/_auth-session');
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{getSessionUser:()=>({email:'owner@example.com'})}};
const {outcome,CALLBACK_PHASES}=require('../api/social-connector/linkedin-service');
const callback=require('../api/social-connections-linkedin-callback');
assert.deepStrictEqual(CALLBACK_PHASES,['callback_entered','state_received','state_validated','state_consumed','token_exchange_started','token_exchange_completed','identity_request_started','identity_resolved','credential_sealed','connection_write_started','connection_saved','redirect_created','completed']);
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(){this.ended=true;}};}
for(const [input,expected] of Object.entries({success:'connected',limited:'connected_limited',linkedin_authorization_cancelled:'cancelled',linkedin_state_expired:'expired',linkedin_not_configured:'configuration_failed',linkedin_token_exchange_rejected:'token_exchange_failed',linkedin_identity_missing:'identity_failed',linkedin_scope_missing:'permission_missing',linkedin_storage_failed:'storage_failed',unknown:'connection_failed'}))assert.strictEqual(outcome(input),expected);
for(const code of ['connected','connected_limited','cancelled','expired','configuration_failed','token_exchange_failed','identity_failed','permission_missing','storage_failed','connection_failed']){
 const res=response();callback.redirect(res,{ok:false,error:{code:code==='connected'?'success':code==='connected_limited'?'limited':code==='cancelled'?'linkedin_authorization_cancelled':code==='expired'?'linkedin_state_expired':code==='configuration_failed'?'linkedin_not_configured':code==='token_exchange_failed'?'linkedin_token_exchange_rejected':code==='identity_failed'?'linkedin_identity_missing':code==='permission_missing'?'linkedin_scope_missing':code==='storage_failed'?'linkedin_storage_failed':'unknown',classification:'provider',phase:'token_exchange_started',serverRequestId:'request_12345678',timestamp:'2026-09-07T00:00:00.000Z'}},'request_12345678');
 assert.strictEqual(res.statusCode,303);assert.match(res.headers.location,/^\/?\?social=/);assert(!res.headers.location.startsWith('/settings'));for(const secret of ['code=','state=','access_token','provider_response'])assert(!res.headers.location.includes(secret));
}
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8'),lang=fs.readFileSync('language.js','utf8'),schema=fs.readFileSync('api/social-connector/schema.js','utf8'),adapter=fs.readFileSync('api/social-connector/linkedin-adapter.js','utf8');
for(const text of ["body:JSON.stringify({returnPath:'/'})",'dialog.showModal()','card.focus()','result.focus()','history.replaceState','callbackKeys.forEach','Copy diagnostics'])assert(app.includes(text)||html.includes(text));
for(const text of ['LinkedIn was connected successfully.','LinkedIn ist verbunden. Die Berechtigung zum Veröffentlichen ist noch nicht verfügbar.','Die Verbindungsanfrage ist abgelaufen','konnte die Verbindung nicht speichern'])assert(lang.includes(text));
assert(schema.includes("CHECK(return_path = '/')"));assert(adapter.includes("v.scope:'openid profile'"));assert(!app.includes("returnPath:'/settings'"));assert(!app.includes('PublishJob'));
console.log('BW-32.2.1 LinkedIn callback recovery regression checks passed.');
