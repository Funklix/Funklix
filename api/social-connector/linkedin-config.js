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
  let vaultReady=false;const rawKey=env[`SOCIAL_CONNECTOR_ENCRYPTION_KEY_V${keyVersion}`];if(Number.isInteger(keyVersion)&&keyVersion>0&&typeof rawKey==='string'){try{vaultReady=Buffer.from(rawKey,'base64').length===32&&Buffer.from(rawKey,'base64').toString('base64').replace(/=+$/,'')===rawKey.replace(/=+$/,'');}catch{}}
  return Object.freeze({ready:!!clientId&&!!clientSecret&&redirectValid&&vaultReady,clientId,clientSecret,redirectUri,redirectValid,shareEnabled,scopes,keyVersion});
}
module.exports={AUTHORIZATION_ENDPOINT,TOKEN_ENDPOINT,USERINFO_ENDPOINT,IDENTITY_SCOPES,load};
