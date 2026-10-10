'use strict';
const {pool}=require('./_boards-storage');
const {getSessionUser}=require('./_auth-session');
const {lookupRequestFromVerifiedSession}=require('./_app-identity');
const contract=require('../campaign-creation');
const {execute}=require('./_campaign-creation');
const statuses={VALIDATION:422,AUTHENTICATION_REQUIRED:401,PERMISSION_DENIED:403,BOARD_MISSING:404,BRAND_MISSING:409,CONFLICT:409,STALE_REVISION:409,OUTCOME_UNKNOWN:503,SAVE_FAILED:503};
function createHandler({db=pool,sessionReader=getSessionUser}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    const fail=code=>res.status(statuses[code]||503).json({contract:contract.CONTRACT,request_id:req.body?.request_id,ok:false,error:{code}});
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false});}
    let user;try{user=sessionReader(req);}catch{return fail('AUTHENTICATION_REQUIRED');}if(!user)return fail('AUTHENTICATION_REQUIRED');
    const lookup=lookupRequestFromVerifiedSession({verified:true,user});if(!lookup.ok)return fail('AUTHENTICATION_REQUIRED');
    let input;try{input=contract.request(req.body);}catch{return fail('VALIDATION');}
    let outcome;
    try{outcome=await execute({db,user,canonicalEmail:lookup.canonicalEmail,input});return res.status(outcome.created?201:200).json(outcome);}catch(error){return fail(outcome?'OUTCOME_UNKNOWN':statuses[error.code]?error.code:'SAVE_FAILED');}
  };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
