(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BrandEnrichmentContract=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='brand-enrichment/v1', KEY='_profileEvidence';
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const text=(v,n=50000)=>typeof v==='string'&&v.length<=n;
  const list=v=>Array.isArray(v)&&v.length<=100&&v.every(x=>text(x,5000));
  const validators={brandCore:text,valueProposition:text,toneOfVoice:list,messagingPillars:list,contentGuidelines:list,keywords:list,
    personas:v=>Array.isArray(v)&&v.length<=100&&v.every(p=>object(p)&&Object.keys(p).every(k=>['name','note'].includes(k))&&text(p.name,500)&&text(p.note,5000)),
    dosAndDonts:v=>object(v)&&Object.keys(v).every(k=>['dos','donts'].includes(k))&&list(v.dos)&&list(v.donts),
    brandVoiceExamples:v=>object(v)&&Object.keys(v).every(k=>['good','avoid'].includes(k))&&text(v.good)&&text(v.avoid),
    brandAssets:v=>object(v)&&Object.keys(v).every(k=>['colors','typography','references'].includes(k))&&Object.entries(v).every(([k,x])=>k==='typography'?text(x,5000):list(x)),
    mission:text,vision:text,values:text};
  const modules=['mission','vision','values'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  function fail(code='INVALID_ENRICHMENT'){throw Object.assign(new Error(code),{code});}
  function safe(value){if(value&&typeof value==='object')for(const k of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(k))fail();safe(value[k]);}}
  function valid(key,value){safe(value);return Object.hasOwn(validators,key)&&validators[key](value);}
  function target(core,key){if(!modules.includes(key))return core[key];const tiles=(core.customTiles||[]).filter(t=>t.moduleType===key);if(tiles.length>1)fail('AMBIGUOUS_MODULE');return tiles[0]?.content;}
  function publicCore(core){const result={...core};delete result[KEY];return result;}
  function url(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return '';u.search='';u.hash='';return u.href;}catch{return '';}}
  // Decisions and claim lineage are user-controlled records, not verification credentials.
  function adopt(core,draft,key,decision,value,createTile){
    if(draft?.version!==VERSION||!Object.hasOwn(validators,key)||!['accepted','rejected','postponed'].includes(decision))fail();
    const proposal=draft.fields?.[key];if(!proposal)fail();
    if(decision==='accepted'&&(['conflicting','missing','unavailable'].includes(proposal.classification)||!valid(key,value)))fail();
    const next=clone(core);
    if(decision==='accepted'){
      if(modules.includes(key)){
        const tiles=(next.customTiles||[]).filter(t=>t.moduleType===key);if(tiles.length>1)fail('AMBIGUOUS_MODULE');
        let tile=tiles[0];if(tile?.moduleData&&Object.keys(tile.moduleData).length)fail('SPECIALIZED_MODULE_OWNER');
        if(!tile){tile=createTile?.(key);if(!tile||tile.moduleType!==key||!/^km_[A-Za-z0-9][A-Za-z0-9_-]{7,}$/.test(tile.id))fail();(next.customTiles||=[]).push(tile);}tile.content=clone(value);
      }else next[key]=object(next[key])&&object(value)?{...next[key],...clone(value)}:clone(value);
    }
    const evidence=object(next[KEY])&&next[KEY].version===VERSION?next[KEY]:{version:VERSION,fields:{},inputs:{}};
    evidence.fields[key]={...clone(proposal),decision,proposedValue:clone(proposal.value),value:decision==='accepted'?clone(value):clone(proposal.value),
      userEdited:decision==='accepted'&&JSON.stringify(value)!==JSON.stringify(proposal.value),origin:draft.origin,revision:draft.revision};
    evidence.inputs ||= {};evidence.inputs[draft.originId]=clone(draft.input||{});
    const used=new Set(Object.values(evidence.fields).map(f=>f.originId));for(const id of Object.keys(evidence.inputs))if(!used.has(id))delete evidence.inputs[id];
    next[KEY]=evidence;safe(next);return next;
  }
  return Object.freeze({VERSION,KEY,modules,validators,valid,target,publicCore,url,adopt});
});
