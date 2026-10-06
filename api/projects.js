'use strict';
const {getSessionUser}=require('./_auth-session');
const {lookupRequestFromVerifiedSession}=require('./_app-identity');
const {pool}=require('./_boards-storage');
const contract=require('../project-command');
const {execute}=require('./_project-command');
const statuses={METHOD_NOT_ALLOWED:405,REQUEST_INVALID:400,NAME_INVALID:422,AUTHENTICATION_REQUIRED:401,SESSION_INVALID:401,IDENTITY_INVALID:401,IDENTITY_DISABLED:403,IDENTITY_AMBIGUOUS:409,MEMBERSHIP_REQUIRED:403,PERMISSION_DENIED:403,WORKSPACE_NOT_FOUND:404,BRAND_NOT_FOUND:404,CROSS_WORKSPACE_BRAND:403,IDEMPOTENCY_CONFLICT:409,DATABASE_UNAVAILABLE:503,SCHEMA_UNAVAILABLE:503,OUTCOME_UNKNOWN:503};
function createHandler({db=pool,sessionReader=getSessionUser}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const requestId=typeof req.body?.request_id==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(req.body.request_id)?req.body.request_id:'invalid';
    function failure(code){return res.status(statuses[code]||500).json({contract:contract.CONTRACT,request_id:requestId,ok:false,error:{code,category:contract.CATEGORIES[code],retryable:['DATABASE_UNAVAILABLE','SCHEMA_UNAVAILABLE','OUTCOME_UNKNOWN','INTERNAL_ERROR'].includes(code)}});}
    if(req.method!=='POST'){res.setHeader('Allow','POST');return failure('METHOD_NOT_ALLOWED');}
    let user;try{user=sessionReader(req);}catch{return failure('SESSION_INVALID');}
    if(!user)return failure('AUTHENTICATION_REQUIRED');
    const lookup=lookupRequestFromVerifiedSession({verified:true,user});
    if(!lookup.ok)return failure('SESSION_INVALID');
    let input;try{input=contract.request(req.body);}catch(error){return failure(error.code||'REQUEST_INVALID');}
    try{const outcome=await execute({db,user,canonicalEmail:lookup.canonicalEmail,input});return res.status(outcome.created?201:200).json(outcome);}
    catch(error){const code=contract.CATEGORIES[error.code]?error.code:['42P01','42703'].includes(error.code)?'SCHEMA_UNAVAILABLE':['ECONNREFUSED','ETIMEDOUT','57P01','57P03'].includes(error.code)?'DATABASE_UNAVAILABLE':'INTERNAL_ERROR';return failure(code);}
  };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
