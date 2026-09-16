'use strict';
const {pool:defaultPool}=require('../_boards-storage');
const {getBoardAccess}=require('../_board-access');
const vault=require('./token-vault');
const {createFacebookAdapter}=require('./facebook-adapter');
const {POST_ID}=require('./facebook-publishing');
const REQUIRED_SCOPE='pages_read_engagement';
function metric(value){return Number.isSafeInteger(value)&&value>=0?{state:'available',value}:{state:'unavailable'};}
function projectAggregates(raw){return {reactions:metric(raw?.reactions?.summary?.total_count),comments:metric(raw?.comments?.summary?.total_count),shares:metric(raw?.shares?.count)};}
function failureCode(result){const code=result?.error?.code;return code==='credential_invalid'?'credential_invalid':code==='permission_missing'?'insufficient_permission':code==='provider_rate_limited'?'provider_rate_limited':'provider_temporarily_unavailable';}
function createFacebookEngagementService({pool=defaultPool,adapter=createFacebookAdapter(),env=process.env,now=()=>new Date()}={}){
 async function read(input,actor){
  const {board,access}=await getBoardAccess(input.boardId,actor,{columns:'id, canvas_json'});
  if(!board||access?.canView!==true)return{ok:false,code:'board_access_denied',httpStatus:403};
  const nodes=Array.isArray(board.canvas_json)?board.canvas_json:Array.isArray(board.canvas_json?.nodes)?board.canvas_json.nodes:[];
  if(!nodes.some(node=>node?.id===input.nodeId))return{ok:false,code:'publication_unavailable',httpStatus:404};
  const found=await pool.query(`SELECT e.external_post_id,d.external_destination_id,c.token_secret_id,c.granted_scopes,c.token_expires_at,s.encrypted_payload,s.nonce,s.authentication_tag,s.encryption_key_version,s.revoked_at
   FROM public.social_external_posts e
   JOIN public.social_publishing_destinations d ON d.id=e.destination_id AND d.owner_account_id=e.owner_account_id AND d.destination_type='page' AND d.status='active'
   JOIN public.social_connected_accounts c ON c.id=d.connected_account_id AND c.owner_account_id=e.owner_account_id AND c.platform='facebook' AND c.status='connected'
   JOIN public.social_token_secrets s ON s.id=c.token_secret_id AND s.owner_account_id=e.owner_account_id AND s.platform='facebook'
   WHERE e.owner_account_id=$1 AND e.source_board_id=$2 AND e.source_node_id=$3 AND e.platform='facebook' AND e.delivery_state='confirmed' AND e.deletion_state='retained'
   ORDER BY e.published_at DESC NULLS LAST LIMIT 1`,[input.ownerAccountId,input.boardId,input.nodeId]);
  const row=found.rows[0];if(!row||!POST_ID.test(row.external_post_id||''))return{ok:false,code:'publication_unavailable',httpStatus:404};
  if(row.revoked_at||(row.token_expires_at&&Date.parse(row.token_expires_at)<=now().getTime()))return{ok:false,code:'credential_invalid',httpStatus:401};
  if(!Array.isArray(row.granted_scopes)||!row.granted_scopes.includes(REQUIRED_SCOPE))return{ok:false,code:'insufficient_permission',httpStatus:403};
  let credentials;try{credentials=vault.open({algorithm:'aes-256-gcm',formatVersion:1,keyVersion:row.encryption_key_version,ciphertext:row.encrypted_payload,nonce:row.nonce,authenticationTag:row.authentication_tag},{secretId:row.token_secret_id,ownerAccountId:input.ownerAccountId,platform:'facebook'},{env});}catch{return{ok:false,code:'credential_invalid',httpStatus:401};}
  const result=await adapter.facebook_post_engagement_read_v1({context:{requestId:input.serverRequestId},credentials,input:{pageId:row.external_destination_id,postId:row.external_post_id}});
  if(!result.ok){const code=failureCode(result);return{ok:false,code,httpStatus:code==='credential_invalid'?401:code==='insufficient_permission'?403:code==='provider_rate_limited'?429:503,providerHttpStatus:result.httpStatus};}
  return{ok:true,metrics:projectAggregates(result.value),refreshedAt:now().toISOString(),providerHttpStatus:200};
 }
 return Object.freeze({read});
}
module.exports={REQUIRED_SCOPE,metric,projectAggregates,failureCode,createFacebookEngagementService};
