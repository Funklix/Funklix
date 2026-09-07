'use strict';
const AUTHORIZATION_ENDPOINT='https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_ENDPOINT='https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_ENDPOINT='https://api.linkedin.com/v2/userinfo';
const IDENTITY_SCOPES=Object.freeze(['openid','profile']);
function load(env=process.env){
  const clientId=env.LINKEDIN_CLIENT_ID||'',clientSecret=env.LINKEDIN_CLIENT_SECRET||'',redirectUri=env.LINKEDIN_REDIRECT_URI||'';
  let redirectValid=false;try{const u=new URL(redirectUri);redirectValid=u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{}
  const shareEnabled=env.LINKEDIN_SHARE_ON_LINKEDIN==='true';
  const scopes=Object.freeze([...IDENTITY_SCOPES,...(shareEnabled?['w_member_social']:[])]);
  const keyVersion=Number(env.SOCIAL_CONNECTOR_ENCRYPTION_KEY_VERSION||1);
  const availableKeyVersions=new Set();for(const name of Object.keys(env)){const match=/^SOCIAL_CONNECTOR_ENCRYPTION_KEY_V(\d+)$/.exec(name);if(!match)continue;try{const decoded=Buffer.from(env[name],'base64');if(decoded.length===32&&decoded.toString('base64').replace(/=+$/,'')===env[name].replace(/=+$/,''))availableKeyVersions.add(Number(match[1]));}catch{}}
  let vaultReady=false;const rawKey=env[`SOCIAL_CONNECTOR_ENCRYPTION_KEY_V${keyVersion}`];if(Number.isInteger(keyVersion)&&keyVersion>0&&typeof rawKey==='string')vaultReady=availableKeyVersions.has(keyVersion);
  const readiness=!clientId?'client_id_missing':!clientSecret?'client_secret_missing':!redirectValid?'redirect_uri_invalid':!rawKey?'vault_key_missing':!vaultReady?'vault_key_invalid':'configuration_ready';
  return Object.freeze({ready:readiness==='configuration_ready',readiness,clientId,clientSecret,redirectUri,redirectValid,shareEnabled,scopes,keyVersion,availableKeyVersions});
}
module.exports={AUTHORIZATION_ENDPOINT,TOKEN_ENDPOINT,USERINFO_ENDPOINT,IDENTITY_SCOPES,load};
