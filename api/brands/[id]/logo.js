'use strict';
const { getSessionUser } = require('../../_auth-session');
const { pool } = require('../../_brands-storage');
const { getBrandAccess, isBrandId } = require('../../_brand-access');
const { validateImageBuffer } = require('../../_website-image-retrieval');
const { LOGO_COLUMNS, MAX_IMAGE_BYTES, projectLogo, discoverLogo, storeLogo, deleteLogo } = require('../../_brand-logo');

const CONTRACT='brand_logo_v1';
function send(res,status,body){res.setHeader('Cache-Control','private, no-store');return res.status(status).json(body);}
function failure(res,status,code){return send(res,status,{contract:CONTRACT,error:{code}});}
function parse(body){if(!body||body.contract!==CONTRACT||!['upload','discover','remove'].includes(body.action)||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0||typeof body.request_id!=='string'||!/^[\w.:-]{1,64}$/.test(body.request_id))return null;return body;}

module.exports=async function handler(req,res){
  const brandId=req.query?.id;if(!isBrandId(brandId))return failure(res,400,'INVALID_BRAND');
  const user=getSessionUser(req);if(!user?.email)return failure(res,401,'AUTHENTICATION_REQUIRED');
  const columns=`id, workspace_id, ${LOGO_COLUMNS}`;
  if(req.method==='GET'){
    const {brand,access}=await getBrandAccess(brandId,user,{columns});if(!brand||!access.canReadBrand)return failure(res,404,'NOT_FOUND');if(!brand.logo_object_path)return failure(res,404,'NOT_FOUND');
    try{const url=new URL(brand.logo_object_path);if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com'))return failure(res,500,'ASSET_UNAVAILABLE');const upstream=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!upstream.ok)return failure(res,502,'ASSET_UNAVAILABLE');const bytes=Buffer.from(await upstream.arrayBuffer());validateImageBuffer(bytes,brand.logo_mime_type);res.setHeader('Content-Type',brand.logo_mime_type);res.setHeader('Cache-Control',`private, max-age=31536000, immutable`);res.setHeader('X-Content-Type-Options','nosniff');return res.status(200).send(bytes);}catch{return failure(res,502,'ASSET_UNAVAILABLE');}
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return failure(res,405,'METHOD_NOT_ALLOWED');}
  const input=parse(req.body);if(!input)return failure(res,422,'INVALID_REQUEST');
  const client=await pool.connect();let pendingPath=null,oldPath=null;
  try{
    await client.query('BEGIN');
    const result=await client.query(`SELECT b.id,b.workspace_id,b.logo_object_path,b.logo_source,b.logo_revision,CASE WHEN lower(b.owner_email)=$2 THEN 'owner' ELSE bm.role END role FROM brands b LEFT JOIN brand_members bm ON bm.brand_id=b.id AND bm.email=$2 WHERE b.id=$1 FOR UPDATE`,[brandId,user.email.trim().toLowerCase()]);const row=result.rows[0];
    if(!row||!['owner','admin','editor'].includes(row.role)){await client.query('ROLLBACK');return failure(res,403,'PERMISSION_DENIED');}
    if(input.workspace_id){const member=await client.query(`SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND identity_id=(SELECT id FROM app_identities WHERE canonical_email=$2 AND status='active') AND status='accepted'`,[input.workspace_id,user.email.trim().toLowerCase()]);if(row.workspace_id!==input.workspace_id||!member.rowCount){await client.query('ROLLBACK');return failure(res,403,'PERMISSION_DENIED');}}
    if(Number(row.logo_revision)!==input.expected_revision){await client.query('ROLLBACK');return failure(res,409,'STALE_UPDATE');}
    oldPath=row.logo_object_path;
    if(input.action==='remove'){await client.query(`UPDATE brands SET logo_object_path=NULL,logo_mime_type=NULL,logo_source=NULL,logo_source_host=NULL,logo_updated_at=now(),logo_revision=logo_revision+1 WHERE id=$1`,[brandId]);}
    else{
      let buffer,mimeType,source,sourceHost=null;
      if(input.action==='upload'){if(typeof input.image_base64!=='string'||input.image_base64.length>MAX_IMAGE_BYTES*1.4+16){await client.query('ROLLBACK');return failure(res,413,'FILE_TOO_LARGE');}buffer=Buffer.from(input.image_base64,'base64');mimeType=input.mime_type;validateImageBuffer(buffer,mimeType);source='uploaded';}
      else {if(row.logo_source==='uploaded'){await client.query('ROLLBACK');return failure(res,409,'UPLOADED_LOGO_PRESERVED');}const found=await discoverLogo(input.website);if(found.status!=='found'){await client.query('ROLLBACK');return failure(res,422,'LOGO_NOT_FOUND');}buffer=found.image.buffer;mimeType=found.image.mimeType;source='discovered';sourceHost=found.sourceHost;}
      pendingPath=await storeLogo(buffer,mimeType);
      await client.query(`UPDATE brands SET logo_object_path=$2,logo_mime_type=$3,logo_source=$4,logo_source_host=$5,logo_updated_at=now(),logo_revision=logo_revision+1 WHERE id=$1`,[brandId,pendingPath,mimeType,source,sourceHost]);
    }
    const saved=(await client.query(`SELECT id,${LOGO_COLUMNS} FROM brands WHERE id=$1`,[brandId])).rows[0];await client.query('COMMIT');if(oldPath&&oldPath!==pendingPath)void deleteLogo(oldPath);return send(res,200,{contract:CONTRACT,request_id:input.request_id,logo:{...projectLogo(saved),source:saved.logo_source,updated_at:saved.logo_updated_at}});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});if(pendingPath)await deleteLogo(pendingPath);const code=['unsupported_content_type','invalid_dimensions'].includes(error?.code)?'UNSUPPORTED_FILE':'UPDATE_FAILED';return failure(res,code==='UNSUPPORTED_FILE'?415:500,code);}finally{client.release();}
};
