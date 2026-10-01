'use strict';
const crypto = require('crypto');
const { del, put } = require('@vercel/blob');
const { retrievePublicImage, validateImageBuffer, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } = require('./_website-image-retrieval');
const { retrieveWebsiteText } = require('./_website-retrieval');

const LOGO_COLUMNS = 'logo_object_path, logo_mime_type, logo_source, logo_revision, logo_updated_at, logo_source_host';
function logoUrl(id, revision) { return `/api/brands/${encodeURIComponent(id)}/logo?revision=${revision}`; }
function projectLogo(row) {
  const revision=Number(row?.logo_revision||0), source=row?.logo_source;
  if (!row?.logo_object_path) return { logo_url:null, logo_revision:revision };
  if (!Number.isSafeInteger(revision)||revision<1||!['uploaded','discovered'].includes(source)||!ALLOWED_IMAGE_TYPES.has(row.logo_mime_type)) throw new Error('INVALID_LOGO_METADATA');
  return { logo_url:logoUrl(row.id,revision), logo_revision:revision };
}
function attr(value,name){const match=String(value||'').match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`,'i'));return match?.[1]?.trim()||'';}
function rankLogoCandidates(html, pageUrl) {
  const candidates=[]; const add=(url,rank,kind)=>{try{const absolute=new URL(url,pageUrl);if(absolute.protocol==='https:')candidates.push({url:absolute.href,rank,kind});}catch{}};
  for(const script of String(html||'').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const root=JSON.parse(script[1]);const visit=v=>{if(Array.isArray(v))return v.forEach(visit);if(v&&typeof v==='object'){if(/Organization/i.test(String(v['@type']||''))){const logo=typeof v.logo==='string'?v.logo:v.logo?.url;if(logo)add(logo,1,'schema');}Object.values(v).forEach(visit);}};visit(root);}catch{}}
  for(const tag of String(html||'').match(/<(?:link|meta)\b[^>]*>/gi)||[]){const rel=attr(tag,'rel').toLowerCase(), property=(attr(tag,'property')||attr(tag,'name')).toLowerCase(), url=attr(tag,'href')||attr(tag,'content');if(!url)continue;if(/logo/.test(rel)||property==='logo'||property==='msapplication-tileimage')add(url,2,'metadata');else if(rel.includes('manifest'))add(url,3,'manifest');else if(rel.includes('apple-touch-icon'))add(url,4,'apple');else if(/(?:^|\s)(?:shortcut )?icon(?:\s|$)/.test(rel))add(url,5,'icon');}
  const unique=new Map();candidates.sort((a,b)=>a.rank-b.rank||a.url.localeCompare(b.url)).forEach(c=>{if(!unique.has(c.url))unique.set(c.url,c);});return [...unique.values()].slice(0,12);
}
async function discoverLogo(domain, deps={}){
  const page=await (deps.retrieveWebsiteText||retrieveWebsiteText)(domain,{includeHtml:true});const base=new URL(page.source.url);if(base.protocol!=='https:')return {status:'not_found'};
  const candidates=rankLogoCandidates(page.internalHtml,base.href);candidates.push({url:new URL('/favicon.ico',base.origin).href,rank:6,kind:'favicon'});
  for(const candidate of candidates){try{const url=new URL(candidate.url);if(candidate.kind==='favicon'&&url.origin!==base.origin)continue;const image=await (deps.retrievePublicImage||retrievePublicImage)(url.href);return {status:'found',candidate,image,sourceHost:url.hostname.slice(0,253)};}catch{/* bounded candidate failure */}}
  return {status:'not_found'};
}
async function storeLogo(buffer,mimeType){validateImageBuffer(buffer,mimeType);const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mimeType];const path=`brand-logo/${crypto.randomUUID()}.${ext}`;const blob=await put(path,buffer,{access:'public',contentType:mimeType,addRandomSuffix:false});return blob.url;}
async function deleteLogo(path){if(path)await del(path).catch(()=>{});}
module.exports={LOGO_COLUMNS,MAX_IMAGE_BYTES,projectLogo,rankLogoCandidates,discoverLogo,storeLogo,deleteLogo};
