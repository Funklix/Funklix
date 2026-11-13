'use strict';
const {getSessionUser}=require('./_auth-session');
const {enrich,failure}=require('./_brand-enrichment');
// Only existing, fixed retrieval outcomes cross the public error boundary.
const RETRIEVAL_STATUS={invalid_url:400,unsupported_scheme:400,credentials_not_allowed:400,invalid_host:400,port_not_allowed:400,unsafe_destination:400,
 dns_failed:502,http_error:502,retrieval_failed:502,timeout:504,request_cancelled:499,empty_content:422,robots_disallowed:422,
 unsupported_content_type:415,unsupported_encoding:415,invalid_encoding:422,response_too_large:413,decompressed_too_large:413,parse_limit:422,
 too_many_redirects:502,redirect_loop:502,invalid_redirect:502};
// Resolve current identity, Workspace and Brand independently before and after inference.
async function authorize(input,user){
 const {getBrandAccess,isBrandId}=require('./_brand-access');
 const {pool}=require('./_brands-storage');
 const {validateIdentityRow,compareIdentityToSessionEmail}=require('./_app-identity');
 if(!isBrandId(input?.brandId)||!isBrandId(input?.workspaceId)||!Number.isSafeInteger(input.revision))throw failure('INVALID_CONTEXT',400);
 const {brand,access}=await getBrandAccess(input.brandId,user);
 if(!brand||!access.canEditCanonicalBrand||brand.workspace_id!==input.workspaceId)throw failure('PERMISSION_DENIED',403);
 const email=user.email.trim().toLowerCase();
 const identity=validateIdentityRow((await pool.query('SELECT id, canonical_email, status, revision FROM public.app_identities WHERE canonical_email=$1 ORDER BY id LIMIT 2',[email])).rows);
 if(!identity.ok||!compareIdentityToSessionEmail(identity,email).ok)throw failure('PERMISSION_DENIED',403);
 const membership=(await pool.query(`SELECT m.role,m.status FROM public.workspace_memberships m JOIN public.workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.identity_id=$2 AND w.status='active'`,[input.workspaceId,identity.identityId])).rows[0];
 if(membership?.status!=='accepted'||!['owner','admin','member','viewer'].includes(membership.role))throw failure('PERMISSION_DENIED',403);
 if(Number(brand.revision)!==input.revision)throw failure('STALE_UPDATE',409);
 return brand;
}
function createHandler(deps={}){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
 const user=(deps.getSessionUser||getSessionUser)(req);if(!user?.email)return res.status(401).json({code:'AUTHENTICATION_REQUIRED'});
 const controller=new AbortController(),cancel=()=>controller.abort();req.once?.('aborted',cancel);res.once?.('close',cancel);
 try{
   if(Buffer.byteLength(JSON.stringify(req.body||{}))>1024*1024)throw failure('INPUT_TOO_LARGE',413);
   const brand=await(deps.authorize||authorize)(req.body,user);
   if(req.body.action!=='questions'&&!deps.fetch&&!process.env.OPENAI_API_KEY)throw failure('PROVIDER_UNAVAILABLE',503);
   const draft=await enrich(brand,req.body,{...deps,signal:controller.signal});
   await(deps.authorize||authorize)(req.body,user);
   return res.status(200).json(draft);
 }catch(error){
   let research;
   if(error.research){try{await(deps.authorize||authorize)(req.body,user);research=error.research;}catch(accessError){error=accessError;}}
   const knownRetrieval=Object.hasOwn(RETRIEVAL_STATUS,error.code);
   const status=error.status||(knownRetrieval?RETRIEVAL_STATUS[error.code]:502);
   const code=error.status||knownRetrieval?error.code:'ENRICHMENT_FAILED';
   return res.status(status).json({code,...(research?{research}:{})});
 }
 finally{req.off?.('aborted',cancel);res.off?.('close',cancel);}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.authorize=authorize;

// Preserve the central maintenance response boundary for every database-dependent route.
module.exports = require('./_write-maintenance').withMaintenanceResponse(module.exports);
