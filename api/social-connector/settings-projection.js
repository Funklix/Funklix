'use strict';
const STATES=Object.freeze(['setup_required','service_unavailable','not_connected','connected','connected_limited','needs_attention','disconnected']);
function base(state,configured,flags){return {state,configured,connectAllowed:flags[0],reconnectAllowed:flags[1],disconnectAllowed:flags[2]};}
function validate(value){
 if(!value||!STATES.includes(value.state)||typeof value.configured!=='boolean'||['connectAllowed','reconnectAllowed','disconnectAllowed'].some(k=>typeof value[k]!=='boolean'))throw new TypeError('Invalid LinkedIn settings projection');
 const id=typeof value.connectionId==='string'&&/^[0-9a-f-]{36}$/i.test(value.connectionId);
 if((['connected','connected_limited'].includes(value.state)&&(!id||!value.credentialCoherent||!value.destinationCoherent))||(['setup_required','service_unavailable','not_connected','disconnected'].includes(value.state)&&id))throw new TypeError('Contradictory LinkedIn settings projection');
 const exact={setup_required:[false,false,false,false],service_unavailable:[true,false,false,false],not_connected:[true,true,false,false],connected:[true,false,true,true],connected_limited:[true,false,true,true],disconnected:[true,true,false,false]}[value.state];
 if(exact&&[value.configured,value.connectAllowed,value.reconnectAllowed,value.disconnectAllowed].some((v,i)=>v!==exact[i]))throw new TypeError('Contradictory LinkedIn capability flags');
 if(value.disconnectAllowed&&!id)throw new TypeError('Disconnect requires an authoritative connection');
 return Object.freeze(value);
}
function project({configuration,row,now=Date.now()}){
 const c=configuration||{ready:false,readiness:'vault_key_missing'};
 if(!c.ready)return validate({...base('setup_required',false,[false,false,false]),configurationIssue:c.readiness||'vault_key_invalid'});
 if(!row)return validate(base('not_connected',true,[true,false,false]));
 if(row.status==='disconnected'||row.status==='revoked')return validate(base('disconnected',true,[true,false,false]));
 const expired=!!row.token_expires_at&&Date.parse(row.token_expires_at)<=now;
 const keyAvailable=Number.isInteger(Number(row.encryption_key_version))&&configurationKeyAvailable(c,row.encryption_key_version);
 const credential=!!row.token_secret_id&&!!row.token_secret_exists&&!!row.token_secret_valid&&keyAvailable&&!expired;
 const destination=!!row.destination_exists&&!!row.destination_active;
 const identity=typeof row.external_display_name==='string'&&!!row.external_display_name&&row.account_type==='personal';
 const common={connectionId:row.id,displayName:row.external_display_name||null,accountType:row.account_type||null,expiresAt:row.token_expires_at||null,attemptId:row.last_oauth_attempt_id||null,credentialCoherent:credential,destinationCoherent:destination,tokenExpired:expired};
 const scopes=Array.isArray(row.granted_scopes)?row.granted_scopes:[];
 if(row.status==='connected'&&credential&&destination&&identity){const publishing=scopes.includes('w_member_social');return validate({...base(publishing?'connected':'connected_limited',true,[false,true,true]),...common,permissionState:publishing?'publishing_permission':'limited'});}
 return validate({...base('needs_attention',true,[false,true,true]),...common,permissionState:scopes.includes('w_member_social')?'publishing_permission':'limited'});
}
function configurationKeyAvailable(configuration,version){return configuration.availableKeyVersions instanceof Set?configuration.availableKeyVersions.has(Number(version)):Number(version)===Number(configuration.keyVersion);}
const DIAGNOSTIC_FIELDS=Object.freeze(['server_request_id','classification','phase','operation_category','schema_version','committed_state_category','timestamp']);
function unavailable(requestId,context={}){const allowed=new Set(['schema_lock','schema_begin','schema_table_initialization','schema_constraint_migration','schema_commit','connection_projection','credential_projection','destination_projection','oauth_attempt_projection','response_construction','storage_unknown']);const diagnostic={server_request_id:requestId,classification:'storage_unavailable',phase:context.phase||'storage_unknown',operation_category:allowed.has(context.operation_category)?context.operation_category:'storage_unknown',schema_version:'1',committed_state_category:'unchanged',timestamp:new Date().toISOString()};return validate({...base('service_unavailable',true,[false,false,false]),diagnostic});}
module.exports={STATES,DIAGNOSTIC_FIELDS,validate,project,unavailable};
