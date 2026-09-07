'use strict';
const assert=require('assert');
const fs=require('fs');
const {inspectCommitted,CALLBACK_PHASES}=require('../api/social-connector/linkedin-service');
const phases=['callback_entered','schema_ready','state_loaded','state_validated','state_consumed','token_exchange_started','token_received','identity_resolved','credential_sealed','connection_transaction_started','token_secret_written','connected_account_written','destination_written','connection_committed','callback_result_created','redirect_created','completed'];
assert.deepStrictEqual(CALLBACK_PHASES,phases);
function pool(row,fail=false){return {query:async()=>{if(fail)throw Error('fixture failure');return {rows:row?[row]:[]}}};}
(async()=>{
 assert.equal(await inspectCommitted(pool(null),'owner','attempt'),'connection_not_written');
 const base={connection_id:'c',status:'connected',token_expires_at:'2099-01-01',secret_id:'s',revoked_at:null,destination_id:'d',active:true};
 assert.equal(await inspectCommitted(pool({...base,granted_scopes:['openid','profile']}),'owner','attempt'),'connection_committed_limited');
 assert.equal(await inspectCommitted(pool({...base,granted_scopes:['openid','profile','w_member_social']}),'owner','attempt'),'connection_committed');
 assert.equal(await inspectCommitted(pool({...base,secret_id:null}),'owner','attempt'),'connection_inconsistent');
 assert.equal(await inspectCommitted(pool(null,true),'owner','attempt'),'connection_commit_unknown');
 const schema=fs.readFileSync('api/social-connector/schema.js','utf8');assert(schema.includes("UPDATE social_oauth_attempts SET return_path='/' WHERE return_path='/settings'"));assert(schema.includes('DROP CONSTRAINT IF EXISTS social_oauth_attempts_last_confirmed_phase_check'));
 const app=fs.readFileSync('app.js','utf8'),settings=fs.readFileSync('social-connections-settings.js','utf8');assert(settings.includes('callbackFeedback.attemptId===data.linkedin.attemptId'));assert(!app.includes('linkedin.com/v2/ugcPosts')&&!settings.includes('linkedin.com/v2/ugcPosts'));
 console.log('BW-32.2.2 LinkedIn persistence regression checks passed.');
})().catch(e=>{console.error(e);process.exit(1)});
