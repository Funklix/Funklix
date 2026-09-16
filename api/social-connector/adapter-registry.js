'use strict';
const { platform, boundedContext, exact }=require('./contracts');
const { safeError }=require('./errors');
const OPERATIONS=Object.freeze(['getAuthorizationRequest','exchangeAuthorizationCode','refreshCredentials','revokeConnection','discoverAccount','discoverPermissions','discoverDestinations','getCapabilities','validateContent','publish','linkedin_text_publish_v1','facebook_page_text_link_publish_v1','getPublicationStatus','reconcileUnknownOutcome','getPost','getPerformance']);
// Provider extensions are recognized by the registry, but are not part of the
// established provider-neutral base interface.
const OPTIONAL_OPERATIONS=Object.freeze(['facebook_post_engagement_read_v1']);
const ALLOWED_OPERATIONS=Object.freeze([...OPERATIONS,...OPTIONAL_OPERATIONS]);
function registry({allowTestAdapters=false}={}){
  const adapters=new Map();
  function register(name,adapter,{testOnly=false}={}){if(!platform(name)||!exact(adapter,['capabilities'],ALLOWED_OPERATIONS)||!Array.isArray(adapter.capabilities)||adapter.capabilities.some((x)=>!ALLOWED_OPERATIONS.includes(x))||testOnly&&!allowTestAdapters)throw new Error('Invalid social connector adapter');adapters.set(name,{adapter,testOnly});}
  async function invoke(name,operation,{context,input,credentials}={}){const entry=adapters.get(name);if(!entry)return {ok:false,error:safeError('unsupported_platform')};if(!ALLOWED_OPERATIONS.includes(operation)||!entry.adapter.capabilities.includes(operation)||typeof entry.adapter[operation]!=='function')return {ok:false,error:safeError('unsupported_capability',context?.requestId)};if(!boundedContext(context)||input===null||typeof input!=='object'||Array.isArray(input)||![null,Object.prototype].includes(Object.getPrototypeOf(input)))return {ok:false,error:safeError('connector_contract_invalid',context?.requestId)};try{const result=await entry.adapter[operation]({context,input,credentials});if(!exact(result,['ok'],['value','error'])||typeof result.ok!=='boolean'||result.ok&&result.error!==undefined||!result.ok&&!result.error)return {ok:false,error:safeError('connector_contract_invalid',context.requestId)};return result;}catch{return {ok:false,error:safeError('connector_storage_unavailable',context.requestId)};}}
  return Object.freeze({register,invoke,has:(name)=>adapters.has(name)});
}
function inertTestAdapter(){return Object.assign(Object.create(null),{capabilities:['getCapabilities'],getCapabilities:async()=>Object.assign(Object.create(null),{ok:true,value:Object.freeze([])})});}
function defaultRegistry(options={}){const value=registry();value.register('linkedin',require('./linkedin-adapter').createLinkedInAdapter(options));value.register('facebook',require('./facebook-adapter').createFacebookAdapter(options));return value;}
module.exports={OPERATIONS,OPTIONAL_OPERATIONS,registry,defaultRegistry,inertTestAdapter};
