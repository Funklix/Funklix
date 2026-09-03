'use strict';
const {getSessionUser}=require('./_auth-session');
const {pool}=require('./_boards-storage');
const {ensureSocialConnectorSchema}=require('./social-connector/schema');
const serviceModule=require('./social-connector/linkedin-service');
function send(res,status,body){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>4096)throw new Error('large');}return value?JSON.parse(value):{};}
function service(){return serviceModule.createService({pool});}
module.exports={send,body,service,user(req){return serviceModule.accountId(getSessionUser(req));},requestId:serviceModule.requestId,fingerprint:serviceModule.sessionFingerprint,ensure:()=>ensureSocialConnectorSchema(pool)};
