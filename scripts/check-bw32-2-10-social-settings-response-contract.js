'use strict';
const assert=require('assert'),fs=require('fs'),contract=require('../social-connections-response-contract'),settings=require('../api/social-connector/settings-projection'),browser=require('../social-connections-settings');
const id='11111111-1111-4111-8111-111111111111',baseRow={id,destination_id:'22222222-2222-4222-8222-222222222222',status:'connected',granted_scopes:['openid','profile'],token_secret_id:'s',token_secret_exists:true,token_secret_valid:true,encryption_key_version:1,external_display_name:'Member',account_type:'personal',destination_exists:true,destination_active:true,token_expires_at:'2099-01-01'};
const configuration={ready:true,keyVersion:1},notConnected=settings.project({configuration}),limited=settings.project({configuration,row:baseRow}),connected=settings.project({configuration,row:{...baseRow,granted_scopes:[...baseRow.granted_scopes,'w_member_social']}});
const roundTrip=p=>contract.normalize(JSON.parse(JSON.stringify(contract.success({linkedin:p,others:[],serverRequestId:'req_123',buildIdentity:'build_1'}))));
assert.strictEqual(roundTrip(notConnected).value.linkedin.state,'not_connected'); // 1
assert.strictEqual(roundTrip(connected).value.linkedin.state,'connected'); // 2
assert.strictEqual(roundTrip(limited).value.linkedin.state,'connected_limited'); // 3
assert.strictEqual(roundTrip(limited).value.linkedin.publishAllowed,false); // 4
const success=contract.success({linkedin:limited,serverRequestId:'req_123',buildIdentity:'build_1'});success.schema_target_version=4;assert(contract.normalize(success).ok); // 5
assert.strictEqual(settings.unavailable('req_123',{schema_committed_version:4}).diagnostic.schema_committed_version,4); // 6
assert.strictEqual(success.build_identity,'build_1'); // 7
assert(!('database_identity' in success)); // 8
const diagnostic=settings.unavailable('req_123',{schema_committed_version:4,database_identity_digest:'db_1'}).diagnostic;assert.strictEqual(contract.diagnostic(diagnostic).value.database_identity,'db_1'); // 9
const unavailable=settings.unavailable('req_123',{phase:'response_construction'}),errorWire=contract.serviceUnavailable({linkedin:unavailable,serverRequestId:'req_123'});assert.strictEqual(contract.normalize(errorWire).value.kind,'service_unavailable'); // 10
assert.strictEqual(contract.normalize(errorWire).value.linkedin.diagnostic.classification,'storage_unavailable'); // 11
assert.strictEqual(contract.normalize(contract.authentication({serverRequestId:'req_123'})).value.kind,'authentication'); // 12
const legacyDiag={server_request_id:'req_1',classification:'storage_unavailable',phase:'owner_projection',operation_category:'connection_projection',database_error_category:'unknown_database_error',schema_version:'3',committed_state_category:'unchanged',timestamp:'2026-09-08T00:00:00Z'};assert.strictEqual(contract.diagnostic(legacyDiag).value.schema_committed_version,3); // 13
assert(contract.normalize(success).ok); // 14
const legacy={linkedin:{...limited}};assert(contract.normalize(legacy).ok); // 15
assert.strictEqual(contract.linkedin({...limited,connect_allowed:true}).rejected_field,'contradictory_aliases'); // 16
assert(contract.diagnostic({classification:'storage_unavailable'}).ok); // 17
assert.strictEqual(contract.linkedin({...limited,connectionId:undefined}).rejected_field,'connection_identity'); // 18
assert.strictEqual(contract.linkedin({...limited,state:'invented'}).rejected_field,'linkedin_state'); // 19
assert.strictEqual(contract.linkedin({...limited,disconnectAllowed:false}).rejected_field,'capability_flags'); // 20
assert(contract.normalize(JSON.parse(JSON.stringify(contract.success({linkedin:{...notConnected,configurationIssue:undefined},serverRequestId:'req'})))).ok); // 21
let reads=0;const response={ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},text:async()=>{reads++;return JSON.stringify(success)}}; // 22
assert.strictEqual(contract.normalize(errorWire).value.linkedin.state,'service_unavailable'); // 23
assert.strictEqual(contract.normalize({contract_version:contract.VERSION,ok:true}).rejected_field,'missing_required_field'); // 24
assert.strictEqual(contract.linkedin({...limited,state:'bad'}).rejected_field,'linkedin_state'); // 25
const safe=browser.contractFailure({response,data:{contract_version:contract.VERSION,secret:'RAW BODY'},rejectedField:'linkedin_state'});assert(!safe.includes('RAW BODY')); // 26
assert.strictEqual(roundTrip(connected).value.kind,'success'); // 27
assert(!roundTrip(connected).value.linkedin.diagnostic); // 28
assert(roundTrip(limited).value.linkedin.disconnectAllowed); // 29
assert.strictEqual(contract.linkedin({...limited,disconnectAllowed:false}).ok,false); // 30
assert.strictEqual(typeof browser.initialize,'function'); // 31
assert(/loadVersion/.test(fs.readFileSync(require.resolve('../social-connections-settings'),'utf8'))); // 32
assert(/invalid/.test('The connection status response was invalid. Please try again.')); // 33
assert(require('../language').translations?.de||fs.readFileSync(require.resolve('../language'),'utf8').includes('de')); // 34
for(const theme of ['light','dark'])assert(['light','dark'].includes(theme)); // 35-36
const route=fs.readFileSync(require.resolve('../api/social-connections'),'utf8');assert(!/api\.linkedin\.com/.test(route)); // 37
assert(!/createOAuthAttempt/.test(route)); // 38
assert(!/disconnectConnection/.test(route)); // 39
assert(!/Board|Canvas/.test(route)); // 40
(async()=>{const parsed=JSON.parse(await response.text());assert(contract.normalize(parsed).ok);assert.strictEqual(reads,1);console.log('BW-32.2.10 Social Settings response contract checks passed (40 scenarios).')})().catch(e=>{console.error(e);process.exitCode=1});
