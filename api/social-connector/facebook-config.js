'use strict';
const GRAPH_VERSION='v24.0';
const AUTHORIZATION_ENDPOINT=`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_ENDPOINT=`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const GRAPH_ENDPOINT=`https://graph.facebook.com/${GRAPH_VERSION}`;
const SCOPES=Object.freeze(['pages_show_list','pages_manage_posts','pages_read_engagement']);
function load(env=process.env){
 const appId=env.FACEBOOK_APP_ID||'',appSecret=env.FACEBOOK_APP_SECRET||'',origin=env.APP_ORIGIN||env.PUBLIC_APP_ORIGIN||'';
 let redirectUri='',redirectValid=false;try{const u=new URL(origin);redirectValid=u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;redirectUri=redirectValid?new URL('/api/social-connections-facebook-callback',u).toString():'';}catch{}
 const keyVersion=Number(env.SOCIAL_CONNECTOR_ENCRYPTION_KEY_VERSION||1),rawKey=env[`SOCIAL_CONNECTOR_ENCRYPTION_KEY_V${keyVersion}`];let vaultReady=false;try{vaultReady=Buffer.from(rawKey||'','base64').length===32;}catch{}
 const readiness=!appId?'app_id_missing':!appSecret?'app_secret_missing':!redirectValid?'app_origin_invalid':!vaultReady?'vault_key_invalid':'configuration_ready';
 return Object.freeze({ready:readiness==='configuration_ready',readiness,appId,appSecret,redirectUri,scopes:SCOPES,keyVersion,graphVersion:GRAPH_VERSION});
}
module.exports={GRAPH_VERSION,AUTHORIZATION_ENDPOINT,TOKEN_ENDPOINT,GRAPH_ENDPOINT,SCOPES,load};
