'use strict';

const crypto = require('crypto');
const { exact, platform, stableId, boundedText } = require('./contracts');
const { connectorError } = require('./errors');
const ALGORITHM = 'aes-256-gcm';
const MAX_PLAINTEXT = 16384;
const MAX_CIPHERTEXT = 32768;
function context(value) { return exact(value, ['secretId','ownerAccountId','platform']) && stableId(value.secretId) && boundedText(value.ownerAccountId,320) && platform(value.platform); }
function keyFor(version, env = process.env) {
  const raw = env[`SOCIAL_CONNECTOR_ENCRYPTION_KEY_V${version}`];
  if (typeof raw !== 'string') throw connectorError('encryption_key_unavailable');
  let key; try { key = Buffer.from(raw, 'base64'); } catch { throw connectorError('encryption_key_unavailable'); }
  if (key.length !== 32 || key.toString('base64').replace(/=+$/,'') !== raw.replace(/=+$/,'')) throw connectorError('encryption_key_unavailable');
  return key;
}
function aad(c, version) { return Buffer.from(`funklix-social:v1:${version}:${c.ownerAccountId}:${c.platform}:${c.secretId}`); }
function payload(value) {
  if (!exact(value, [], ['accessToken','refreshToken','clientSecret','tokenType','scope']) || Object.keys(value).length === 0 || !Object.values(value).every((v) => typeof v === 'string')) throw connectorError('connector_contract_invalid');
  const data = Buffer.from(JSON.stringify(value)); if (data.length > MAX_PLAINTEXT) { data.fill(0); throw connectorError('connector_contract_invalid'); } return data;
}
function seal(value, c, { keyVersion = 1, env } = {}) {
  if (!context(c) || !Number.isSafeInteger(keyVersion) || keyVersion < 1 || keyVersion > 9999) throw connectorError('connector_contract_invalid');
  const plaintext = payload(value); const key = keyFor(keyVersion, env); const nonce = crypto.randomBytes(12);
  try { const cipher=crypto.createCipheriv(ALGORITHM,key,nonce); cipher.setAAD(aad(c,keyVersion)); const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]); if(encrypted.length>MAX_CIPHERTEXT) throw connectorError('connector_contract_invalid'); return Object.freeze(Object.assign(Object.create(null),{algorithm:ALGORITHM,formatVersion:1,keyVersion,ciphertext:encrypted.toString('base64'),nonce:nonce.toString('base64'),authenticationTag:cipher.getAuthTag().toString('base64')})); } finally { plaintext.fill(0); key.fill(0); }
}
function open(record, c, { env } = {}) {
  if (!context(c) || !exact(record,['algorithm','formatVersion','keyVersion','ciphertext','nonce','authenticationTag']) || record.algorithm!==ALGORITHM || record.formatVersion!==1 || !Number.isSafeInteger(record.keyVersion)) throw connectorError('connector_contract_invalid');
  const encrypted=Buffer.from(record.ciphertext,'base64'), nonce=Buffer.from(record.nonce,'base64'), tag=Buffer.from(record.authenticationTag,'base64');
  if(encrypted.length>MAX_CIPHERTEXT||nonce.length!==12||tag.length!==16) throw connectorError('connector_contract_invalid'); const key=keyFor(record.keyVersion,env);
  let plaintext; try { const decipher=crypto.createDecipheriv(ALGORITHM,key,nonce); decipher.setAAD(aad(c,record.keyVersion)); decipher.setAuthTag(tag); plaintext=Buffer.concat([decipher.update(encrypted),decipher.final()]); if(plaintext.length>MAX_PLAINTEXT) throw connectorError('connector_contract_invalid'); const value=JSON.parse(plaintext.toString('utf8')); payload(value).fill(0); return value; } catch(error) { if(error?.connector) throw error; throw connectorError('connector_contract_invalid'); } finally { key.fill(0); plaintext?.fill(0); }
}
function rotate(record,c,{currentKeyVersion,env}={}) { const value=open(record,c,{env}); try{return seal(value,c,{keyVersion:currentKeyVersion,env});} finally { for(const key of Object.keys(value)) value[key]=''; } }
function metadata(row) { return row ? Object.freeze({ secretId:row.id, ownerAccountId:row.owner_account_id, platform:row.platform, keyVersion:row.encryption_key_version, createdAt:row.created_at, updatedAt:row.updated_at, rotatedAt:row.rotated_at, revokedAt:row.revoked_at }) : null; }
async function revoke(store,c){if(!context(c))throw connectorError('connector_contract_invalid');return store.revokeSecret(c);}
async function remove(store,c){if(!context(c))throw connectorError('connector_contract_invalid');return store.deleteSecret(c);}
module.exports={ALGORITHM,MAX_PLAINTEXT,MAX_CIPHERTEXT,seal,open,rotate,metadata,revoke,delete:remove};
