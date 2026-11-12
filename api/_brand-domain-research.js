'use strict';
// Request-local research only. No credentials, writes, durable jobs or extra inference.
const { createHash } = require('crypto');
const { validateWebsiteUrl } = require('./_website-url-policy');
const { retrieveWebsiteText } = require('./_website-retrieval');
const { extractBrandProjection, attribute, readTag, decodeEntities, evidenceScore, MAX_PROVIDER_CONTEXT, MAX_PARSED_NODES } = require('./_html-text-extractor');
const RESEARCH_MS = 20000; // Shared retrieval deadline, including robots and submitted page.
const MAX_EVIDENCE_BYTES = 12 * 1024 * 1024;
const MAX_LEDGER_BYTES = 512 * 1024;
const safeText = text => String(text || '').replace(/[<>\x00-\x1f\x7f]/g, ' ').replace(/\s+/g,' ').trim();
const publicUrl = input => { const u = new URL(input); u.search = ''; u.hash = ''; return u.href; };
const digest = text => createHash('sha256').update(text).digest('hex');
const restricted = url => /(?:^|\/)(?:login|logout|signin|signup|account|admin|checkout|cart|wp-admin|auth)(?:\/|$)/i.test(url.pathname);
function links(html) {
  const found = [], lower=html.toLowerCase(); let index=0, nodes=0, anchor=null;
  const finish=()=>{if(anchor) anchor.entry.label=safeText(decodeEntities(anchor.parts.join(' ')));anchor=null;};
  // Visit each text/tag span once, including malformed/unclosed anchors. Never
  // search the rest of the document separately for every anchor's closing tag.
  while(index<html.length) {
    if(html.startsWith('<!--',index)) {const end=html.indexOf('-->',index+4);index=end<0?html.length:end+3;continue;}
    if(html[index]!=='<') {
      const end=html.indexOf('<',index), stop=end<0?html.length:end;
      if(anchor) anchor.parts.push(html.slice(index,stop));index=stop;continue;
    }
    const tag=readTag(html,index);index=tag.end;
    if(++nodes>MAX_PARSED_NODES) {const error=new Error('Navigation parse boundary reached.');error.code='parse_limit';throw error;}
    const closing=/^\s*\//.test(tag.raw), name=tag.raw.match(/^\s*\/?\s*([a-z][\w:-]*)/i)?.[1]?.toLowerCase();
    if(closing) {if(name==='a') finish();continue;}
    if(['script','style','template','noscript'].includes(name)) {const end=lower.indexOf(`</${name}`,index);index=end<0?html.length:end;continue;}
    if(name==='meta' && /^(robots|funklix-website-text)$/i.test(attribute(tag.raw,'name')) && /(?:nofollow|none)/i.test(attribute(tag.raw,'content'))) return [];
    if(name==='a') {
      finish();
      if(!/nofollow/i.test(attribute(tag.raw,'rel'))) {
        const entry={href:attribute(tag.raw,'href'),label:''};found.push(entry);anchor={entry,parts:[]};
      }
    }
    if(name==='link' && /sitemap/i.test(attribute(tag.raw,'rel'))) found.push({href:attribute(tag.raw,'href'),sitemap:true});
  }
  finish();return found;
}
// Linear wildcard matcher (no source-controlled regular expressions).
function robotsMatch(pattern,path) {
  const exact=pattern.endsWith('$');if(exact) pattern=pattern.slice(0,-1);
  let p=0,s=0,star=-1,mark=0;
  while(s<path.length) {
    if(p===pattern.length && !exact) return true;
    if(pattern[p]===path[s]) {p++;s++;}
    else if(pattern[p]==='*') {star=p++;mark=s;}
    else if(star>=0) {p=star+1;s=++mark;}
    else return false;
  }
  while(pattern[p]==='*') p++;
  return p===pattern.length;
}
function robotsPolicy(text) {
  const groups = []; let group = null, rulesStarted = false;
  const sitemaps = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/); if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2];
    if (key === 'sitemap') { sitemaps.push(value); continue; }
    if (key === 'user-agent') {
      if (!group || rulesStarted) { group = {agents:[],rules:[],delay:0}; groups.push(group); rulesStarted=false; }
      group.agents.push(value.toLowerCase());
    } else if (group) {
      rulesStarted=true;
      if (['allow','disallow'].includes(key) && value) group.rules.push({allow:key==='allow',pattern:value});
      if (key==='crawl-delay' && Number.isFinite(Number(value))) group.delay=Math.max(0,Number(value)*1000);
    }
  }
  const specific = groups.filter(g=>g.agents.some(a=>a !== '*' && 'funklix-website-text'.includes(a)));
  const selected = specific.length ? specific : groups.filter(g=>g.agents.includes('*'));
  return {
    sitemaps, delay: Math.max(250,...selected.map(g=>g.delay)),
    allowed(url) {
      const path = url.pathname + url.search;
      const matches = selected.flatMap(g=>g.rules).filter(r=> {
        return robotsMatch(r.pattern,path);
      }).sort((a,b)=>b.pattern.replace(/\*/g,'').length-a.pattern.replace(/\*/g,'').length || Number(b.allow)-Number(a.allow));
      return !matches.length || matches[0].allow;
    }
  };
}
function sitemapEntries(xml) {
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)) {const error=new Error('Unsafe XML');error.code='unsafe_xml';throw error;}
  const entries=[];let index=0,nodes=0,root=null,current=null;
  while(index<xml.length) {
    if(xml.startsWith('<!--',index)) {const end=xml.indexOf('-->',index+4);index=end<0?xml.length:end+3;continue;}
    if(xml.startsWith('<![CDATA[',index)) {
      const end=xml.indexOf(']]>',index+9);if(current)current.push(xml.slice(index+9,end<0?xml.length:end));index=end<0?xml.length:end+3;continue;
    }
    if(xml[index]!=='<') {const end=xml.indexOf('<',index),stop=end<0?xml.length:end;if(current)current.push(xml.slice(index,stop));index=stop;continue;}
    const tag=readTag(xml,index);index=tag.end;
    if(++nodes>MAX_PARSED_NODES) {const error=new Error('Sitemap parse boundary reached.');error.code='parse_limit';throw error;}
    const name=tag.raw.match(/^\s*\/?\s*([a-z][\w:-]*)/i)?.[1]?.toLowerCase().split(':').pop();
    const closing=/^\s*\//.test(tag.raw);
    if(!closing && ['urlset','sitemapindex'].includes(name) && !root) root=name;
    if(name==='loc') {
      if(closing && current) {const href=decodeEntities(current.join('')).trim();if(href)entries.push({href,sitemap:root==='sitemapindex'});current=null;}
      else if(!closing) current=[];
    }
  }
  if(!root) {const error=new Error('Invalid sitemap');error.code='invalid_sitemap';throw error;}
  return entries;
}
async function researchDomain(input, dependencies={}) {
  const retrieve=dependencies.retrieveWebsiteText || retrieveWebsiteText;
  const now=dependencies.now || Date.now, started=now(), deadline=started+(dependencies.researchMs ?? RESEARCH_MS);
  const sources=[], documents=[], queue=[], known=new Map(), contents=new Map(), fetchedUrls=new Map();
  let ledgerBytes=0, evidenceBytes=0, discoveryOmitted=false, rootWebsite=null, rootFailure=null;
  const root=validateWebsiteUrl(input); let origin=root.origin, policy=null, lastRequest=null;
  const research={version:'brand-domain-research/v1',state:'partial',sources,documents,fields:{},provenancePersisted:false,
    limitations:['Request-local evidence; source grounding is not retained with canonical saves.','One existing model request; selected excerpts only, not exhaustive semantic analysis.','Public same-origin HTML only; no JavaScript rendering, authenticated pages or third-party crawling.'],
    limits:{retrievalMs:RESEARCH_MS,evidenceBytes:MAX_EVIDENCE_BYTES,ledgerBytes:MAX_LEDGER_BYTES,concurrency:1,providerContextCharacters:MAX_PROVIDER_CONTEXT}, discoveryOmitted:false,excludedDiscovered:{invalid:0,outOfScope:0,nonHtml:0}};
  function add(href,kind='page',reason='navigation',label='') {
    let url; try { url=validateWebsiteUrl(new URL(href,origin).href); } catch { research.excludedDiscovered.invalid++;return; }
    if(url.origin!==origin) {research.excludedDiscovered.outOfScope++;return;}
    if(known.has(url.href)) return;
    if(kind==='page' && /\.(?:pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|mp3|css|js)$/i.test(url.pathname)) {research.excludedDiscovered.nonHtml++;return;}
    const cost=Buffer.byteLength(url.href)+512;
    if(ledgerBytes+cost>MAX_LEDGER_BYTES) { discoveryOmitted=true; return; }
    ledgerBytes+=cost;
    const item={id:`s${known.size+1}`,url:publicUrl(url.href),kind,discoveredVia:reason,retrieval:'pending',extraction:'not_started',processing:'not_started',selectedUnits:0,omittedUnits:0};
    // Discovered navigation never carries query parameters into automatic crawling.
    if(reason!=='submitted' && (url.search || restricted(url))) { item.retrieval='rejected'; item.reason='source_restricted'; }
    else if(kind==='page' && reason!=='submitted' && url.pathname!=='/' && !evidenceScore(url.pathname+' '+label)) {item.retrieval='rejected';item.reason='not_relevant';}
    known.set(url.href,item); (kind==='page'?sources:documents).push(item);
    if(item.retrieval==='pending') queue.push({url,item,priority:reason==='submitted'?100:kind==='sitemap'?0:evidenceScore(url.pathname+' '+label)+1});
  }
  add(root.href,'page','submitted');
  async function get(url,options={}) {
    if(now()>=deadline) {const error=new Error();error.code='research_deadline';throw error;}
    const spacing=policy?.delay ?? 250, wait=lastRequest !== null ? Math.max(0,spacing-(now()-lastRequest)) : 0;
    if(now()+wait>=deadline) {const error=new Error();error.code='research_deadline';throw error;}
    if(wait && !dependencies.noDelay) await new Promise(resolve=>setTimeout(resolve,wait));
    lastRequest=now();
    return retrieve(url.href,{includeHtml:true,allowEmpty:true,signal:dependencies.signal,timeoutMs:Math.min(10000,deadline-now()),...options});
  }
  async function loadPolicy() {
    const doc={url:origin+'/robots.txt',kind:'robots',retrieval:'pending'};documents.push(doc);
    try {
      const result=await get(new URL(doc.url),{documentType:'robots',allowedOrigin:origin,maxResponseBytes:256*1024,maxDecompressedBytes:256*1024});
      if(typeof result.internalDocument!=='string') throw Object.assign(new Error(),{code:'robots_unavailable'});
      policy=robotsPolicy(result.internalDocument);doc.retrieval='fetched';
      for(const href of policy.sitemaps) add(href,'sitemap','robots');
      add(origin+'/sitemap.xml','sitemap','conventional_sitemap');
    } catch(error) {
      doc.retrieval='unavailable';doc.reason=error.code || 'retrieval_failed';
      if(error.httpStatus===404 || error.httpStatus===410) {policy=robotsPolicy('');add(origin+'/sitemap.xml','sitemap','conventional_sitemap');}
      // An unavailable policy permits the explicitly requested page only.
    }
  }
  // Respect robots before any HTML request, including the submitted URL.
  await loadPolicy();
  while(queue.length) {
    if(now()>=deadline || evidenceBytes>=MAX_EVIDENCE_BYTES || dependencies.signal?.aborted) break;
    queue.sort((a,b)=>b.priority-a.priority);const {url,item}=queue.shift();
    if(item.discoveredVia!=='submitted' && !policy) {item.retrieval='deferred';item.reason='robots_unavailable';continue;}
    if(policy && !policy.allowed(url)) {item.retrieval='rejected';item.reason='robots_disallowed';continue;}
    if(fetchedUrls.has(url.href)) {item.retrieval='duplicate_alias';item.aliasOf=fetchedUrls.get(url.href);item.processing='duplicate';continue;}
    let page;
    try {
      page=await get(url,{...(item.discoveredVia==='submitted'?{}:{allowedOrigin:origin}),isAllowed:u=>!restricted(u)&&(!policy || policy.allowed(u)),...(item.kind==='sitemap'?{documentType:'sitemap'}:{})});
      item.retrieval='fetched'; item.finalUrl=publicUrl(page.source.url);item.retrievedAt=new Date().toISOString();
      fetchedUrls.set(page.source.url,item.id);
      if(item.kind==='sitemap') {const entries=sitemapEntries(page.internalDocument || '');item.extraction='parsed';item.discoveredEntries=entries.length;for(const entry of entries) add(entry.href,entry.sitemap?'sitemap':'page','sitemap');continue;}
      if(!rootWebsite) {rootWebsite=page;const final=new URL(page.source.url);if(final.origin!==origin) {
        origin=final.origin; policy=null;await loadPolicy();
      }}
      if(item.discoveredVia==='submitted') add(origin+'/','page','homepage');
      for(const link of page.internalPolicy?.nofollow ? [] : links(page.internalHtml || '')) {
        let target;try{target=new URL(link.href,page.source.url);}catch{continue;}
        add(target.href,link.sitemap?'sitemap':'page','navigation',link.label);
      }
      const hash=digest(page.internalHtml || '');item.contentHash=hash;
      const projection=extractBrandProjection(page.internalHtml || '',{allowMetadataOnly:true});
      item.extraction='extracted';item.evidenceKind=projection.evidenceUnits.length?'visible_text':'metadata_only';item.title=safeText(projection.title);item.extractedUnits=projection.evidenceUnits.length + projection.evidenceMetadata.length + (projection.title ? 1 : 0);
      // Retain source aliases, but do not spend context again on identical text.
      const textHash=digest([projection.title,...projection.evidenceMetadata,...projection.evidenceUnits].join('\n'));
      if(contents.has(textHash)) {item.duplicateOf=contents.get(textHash);item.processing='duplicate';continue;}
      contents.set(textHash,item.id);
      item.units=[];
      for(const text of [...(projection.title ? [projection.title] : []), ...projection.evidenceMetadata, ...projection.evidenceUnits]) {
        const cost=Buffer.byteLength(text);
        if(evidenceBytes+cost>MAX_EVIDENCE_BYTES) {item.omittedUnits++;continue;}
        evidenceBytes+=cost;item.units.push(safeText(text));
      }
    } catch(error) {
      if(error.code==='research_deadline' || error.code==='request_cancelled') item.retrieval='deferred';
      else if(item.retrieval==='fetched') item.extraction='unavailable';else item.retrieval='unavailable';
      item.reason=typeof error.code==='string'?error.code:'retrieval_failed';
      // Keep valid sources when another page fails. Invalid submitted destinations
      // still fail before inference and preserve the existing route contract.
      if(item.discoveredVia==='submitted' && item.retrieval!=='fetched') rootFailure=error;
    }
  }
  for(const {item} of queue) {item.retrieval='deferred';item.reason=dependencies.signal?.aborted?'request_cancelled':evidenceBytes>=MAX_EVIDENCE_BYTES?'evidence_memory':'research_deadline';}
  const candidates=[];
  for(const source of sources) for(const [index,text] of (source.units || []).entries()) candidates.push({source,text,index,score:evidenceScore(text)});
  // Round-robin over relevance-ranked sources: short pages and late facts get a
  // chance before a large homepage consumes the one existing request's context.
  const buckets=sources.filter(s=>s.units).map(source=>({source,units:candidates.filter(c=>c.source===source).sort((a,b)=>b.score-a.score||a.index-b.index)}));
  const selected=[], seen=new Map();let used=2;
  while(buckets.some(b=>b.units.length)) for(const bucket of buckets) {
    const candidate=bucket.units.shift();if(!candidate) continue;
    const {source,text}=candidate;
    if(seen.has(text)) {source.duplicateUnits=(source.duplicateUnits || 0)+1;continue;}
    const record={sourceId:source.id,url:source.finalUrl || source.url,excerpt:text};const cost=JSON.stringify(record).length+1;
    if(used+cost>MAX_PROVIDER_CONTEXT) {source.omittedUnits++;continue;}
    seen.set(text,source.id);
    selected.push(record);used+=cost;source.selectedUnits++;
  }
  for(const source of sources) {
    delete source.units;
    if(source.selectedUnits) source.processing='prepared';
    else if(source.extraction==='extracted' && !source.duplicateOf) source.processing='not_selected';
  }
  research.discoveryOmitted=discoveryOmitted;
  research.selectedEvidence=selected;
  research.counts={discovered:sources.length,fetched:sources.filter(s=>s.retrieval==='fetched').length,extracted:sources.filter(s=>s.extraction==='extracted').length,processed:0,
    unavailable:sources.filter(s=>s.retrieval==='unavailable'||s.extraction==='unavailable').length,rejected:sources.filter(s=>s.retrieval==='rejected').length,deferred:sources.filter(s=>s.retrieval==='deferred').length};
  research.remaining={sources:research.counts.deferred,omittedUnits:sources.reduce((n,s)=>n+s.omittedUnits,0),discoveryOmitted};
  if(rootFailure && !selected.length) {rootFailure.research=research;throw rootFailure;}
  return {research,website:rootWebsite,providerContext:JSON.stringify(selected)};
}
module.exports={researchDomain,links,robotsPolicy,sitemapEntries,safeText,publicUrl,RESEARCH_MS,MAX_EVIDENCE_BYTES,MAX_LEDGER_BYTES};
