'use strict';
const { retrievePublicImage, validateImageBuffer, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } = require('./_website-image-retrieval');
const { retrieveWebsiteText } = require('./_website-retrieval');

const LOGO_COLUMNS = 'logo_object_path, logo_mime_type, logo_source, logo_revision, logo_updated_at, logo_source_host';
function logoUrl(id, revision) { return `/api/brands/${encodeURIComponent(id)}/logo?revision=${revision}`; }
// pg returns BIGINT as text. Never coerce null, whitespace, booleans or rounded values.
function normalizeLogoRevision(value) {
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_LOGO_REVISION');
  return value;
}
function projectLogo(row) {
  const revision=normalizeLogoRevision(row?.logo_revision), source=row?.logo_source;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row?.id || '')
    || !(row.logo_source_host == null || (typeof row.logo_source_host === 'string' && row.logo_source_host.length <= 253))
    || !(row.logo_updated_at == null || ((typeof row.logo_updated_at === 'string' || row.logo_updated_at instanceof Date) && Number.isFinite(new Date(row.logo_updated_at).getTime())))) throw new Error('INVALID_LOGO_METADATA');
  if (row.logo_object_path == null) {
    if (row.logo_mime_type != null || source != null || row.logo_source_host != null) throw new Error('INVALID_LOGO_METADATA');
    return { logo_url:null, logo_revision:revision };
  }
  if (typeof row.logo_object_path !== 'string' || !row.logo_object_path.length || row.logo_object_path.length > 2048
    || revision<1||!['uploaded','discovered'].includes(source)||!ALLOWED_IMAGE_TYPES.has(row.logo_mime_type)) throw new Error('INVALID_LOGO_METADATA');
  return { logo_url:logoUrl(row.id,revision), logo_revision:revision };
}
function attr(value,name){const match=String(value||'').match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`,'i'));return match?.[1]?.trim()||'';}
function rankLogoCandidates(html, pageUrl) {
  const candidates=[]; const add=(url,rank,kind)=>{try{const absolute=new URL(url,pageUrl);if(absolute.protocol==='https:')candidates.push({url:absolute.href,rank,kind});}catch{}};
  for(const script of String(html||'').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const root=JSON.parse(script[1]);const visit=v=>{if(Array.isArray(v))return v.forEach(visit);if(v&&typeof v==='object'){if(/Organization/i.test(String(v['@type']||''))){const logo=typeof v.logo==='string'?v.logo:v.logo?.url;if(logo)add(logo,1,'schema');}Object.values(v).forEach(visit);}};visit(root);}catch{}}
  for(const tag of String(html||'').match(/<(?:link|meta)\b[^>]*>/gi)||[]){const rel=attr(tag,'rel').toLowerCase(), property=(attr(tag,'property')||attr(tag,'name')).toLowerCase(), url=attr(tag,'href')||attr(tag,'content');if(!url)continue;if(/logo/.test(rel)||property==='logo')add(url,2,'metadata');else if(property==='msapplication-tileimage')add(url,2,'tile');else if(rel.includes('manifest'))add(url,3,'manifest');else if(rel.includes('apple-touch-icon'))add(url,4,'apple');else if(/(?:^|\s)(?:shortcut )?icon(?:\s|$)/.test(rel))add(url,5,'icon');}
  const unique=new Map();candidates.sort((a,b)=>a.rank-b.rank||a.url.localeCompare(b.url)).forEach(c=>{if(!unique.has(c.url))unique.set(c.url,c);});return [...unique.values()].slice(0,12);
}
async function discoverLogo(domain, deps={}){
  const page=await (deps.retrieveWebsiteText||retrieveWebsiteText)(domain,{includeHtml:true});const base=new URL(page.source.url);if(base.protocol!=='https:')return {status:'not_found'};
  let candidates=rankLogoCandidates(page.internalHtml,base.href);
  // Guided setup only proposes explicit logos, never a generic icon or hero.
  if(deps.logoOnly)candidates=candidates.filter(candidate=>['schema','metadata'].includes(candidate.kind));
  else candidates.push({url:new URL('/favicon.ico',base.origin).href,rank:6,kind:'favicon'});
  if(deps.candidateUrl)candidates=candidates.filter(candidate=>candidate.url===deps.candidateUrl);
  for(const candidate of candidates){try{const url=new URL(candidate.url);if(candidate.kind==='favicon'&&url.origin!==base.origin)continue;const image=await (deps.retrievePublicImage||retrievePublicImage)(url.href);return {status:'found',candidate,image,sourceHost:url.hostname.slice(0,253)};}catch{/* bounded candidate failure */}}
  return {status:'not_found'};
}
module.exports={LOGO_COLUMNS,MAX_IMAGE_BYTES,normalizeLogoRevision,projectLogo,rankLogoCandidates,discoverLogo};
