'use strict';

const BUCKET = 'brand-logos';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MIME_EXTENSIONS = Object.freeze({ 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif' });
class BrandLogoStorageError extends Error { constructor(code){super(code);this.code=code;} }

function storageConfiguration(env=process.env){
  const serviceKey=String(env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  let origin=String(env.SUPABASE_URL||'').trim();
  if(!origin&&env.POSTGRES_URL){try{const host=new URL(env.POSTGRES_URL).hostname;const match=host.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);if(match)origin=`https://${match[1]}.supabase.co`;}catch{/* bounded below */}}
  try{const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||!serviceKey)throw new Error();return {origin:url.origin,serviceKey};}catch{throw new BrandLogoStorageError('STORAGE_UNAVAILABLE');}
}
function objectKey(brandId,revision,mimeType){const ext=MIME_EXTENSIONS[mimeType];if(!/^[0-9a-f-]{36}$/i.test(brandId||'')||!Number.isSafeInteger(revision)||revision<1||!ext)throw new BrandLogoStorageError('STORAGE_INPUT_INVALID');return `${brandId.toLowerCase()}/${revision}.${ext}`;}
function endpoint(config,key=''){return `${config.origin}/storage/v1/object/${BUCKET}${key?`/${key}`:''}`;}
async function request(method,key,{buffer,mimeType,fetchImpl=fetch,env=process.env}={}){const config=storageConfiguration(env);const response=await fetchImpl(endpoint(config,key),{method,redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:`Bearer ${config.serviceKey}`,apikey:config.serviceKey,...(mimeType?{'Content-Type':mimeType}:{}),...(method==='POST'?{'x-upsert':'false'}:{})},...(buffer?{body:buffer}:{})}).catch(()=>{throw new BrandLogoStorageError('STORAGE_UNAVAILABLE');});if(!response.ok)throw new BrandLogoStorageError(response.status===409?'STORAGE_CONFLICT':'STORAGE_UNAVAILABLE');return response;}
async function upload({brandId,revision,buffer,mimeType,...dependencies}){const key=objectKey(brandId,revision,mimeType);await request('POST',key,{buffer,mimeType,...dependencies});return key;}
async function read(key,dependencies={}){if(!/^[0-9a-f-]{36}\/\d+\.(?:png|jpg|webp|gif)$/i.test(key||''))throw new BrandLogoStorageError('STORAGE_INPUT_INVALID');const response=await request('GET',key,dependencies);const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>MAX_RESPONSE_BYTES)throw new BrandLogoStorageError('STORAGE_RESPONSE_INVALID');const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>MAX_RESPONSE_BYTES)throw new BrandLogoStorageError('STORAGE_RESPONSE_INVALID');return bytes;}
async function remove(key,dependencies={}){if(!key)return;try{await request('DELETE',key,dependencies);}catch(error){if(error.code!=='STORAGE_UNAVAILABLE')throw error;}}
module.exports={BUCKET,BrandLogoStorageError,storageConfiguration,objectKey,upload,read,remove};
