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
  // Generation scopes only: specialized Founder/DNA owners are never targets.
  const sections=Object.freeze({
    brand_foundation:Object.freeze(['brandCore','valueProposition','mission','vision','values']),
    audience_offers:Object.freeze(['personas']),
    voice_messaging:Object.freeze(['toneOfVoice','messagingPillars','contentGuidelines','keywords','dosAndDonts','brandVoiceExamples']),
    brand_identity:Object.freeze(['brandAssets'])
  });
  const clone=v=>JSON.parse(JSON.stringify(v));
  function fail(code='INVALID_ENRICHMENT'){throw Object.assign(new Error(code),{code});}
  function safe(value){if(value&&typeof value==='object')for(const k of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(k))fail();safe(value[k]);}}
  function valid(key,value){safe(value);return Object.hasOwn(validators,key)&&validators[key](value);}
  function target(core,key){if(!modules.includes(key))return core[key];const tiles=(core.customTiles||[]).filter(t=>t.moduleType===key);if(tiles.length>1)fail('AMBIGUOUS_MODULE');return tiles[0]?.content;}
  function publicCore(core){const result={...core};delete result[KEY];return result;}
  function url(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return '';u.search='';u.hash='';return u.href;}catch{return '';}}
  const populated=v=>typeof v==='string'?!!v.trim():Array.isArray(v)?v.some(populated):object(v)&&Object.values(v).some(populated);
  const outcomeLabels=Object.freeze({
    no_value_generated:'No value was generated',
    no_usable_evidence:'No usable evidence for this suggestion',
    invalid_field:'The generated field could not be validated',
    unchanged:'Saved value unchanged',
    no_improvement:'No supported improvement found',
    quality_withheld:'Suggestion needs manual review',
    specialized_module_unavailable:'Specialized module. Use its existing editor in Advanced options.',
    current_value_unavailable:'Current value unavailable',
    conflicting:'Conflicting information'
  });
  function outcome(field){
    if(!field)return 'invalid_field';
    if(field.reason==='unchanged')return 'unchanged';
    if(field.outcome)return field.outcome;
    if(field.classification==='unavailable'){
      if(field.reason==='quality_review_required')return 'quality_withheld';
      if(field.reason==='specialized_module_owner')return 'specialized_module_unavailable';
      return 'current_value_unavailable';
    }
    if(field.classification==='missing')return 'no_value_generated';
    if(field.classification==='conflicting')return 'conflicting';
    return 'suggestion';
  }
  const isSuggestion=field=>outcome(field)==='suggestion'&&['user_provided','website_supported','ai_interpretation'].includes(field.classification)&&populated(field.value);
  function isReviewItem(field){
    return isSuggestion(field)||['conflicting','quality_withheld','no_usable_evidence','current_value_unavailable'].includes(outcome(field))||
      outcome(field)==='specialized_module_unavailable'&&populated(field.value);
  }
  function equalValue(left,right){
    if(typeof left==='string'&&typeof right==='string')return left.trim().replace(/\s+/g,' ')===right.trim().replace(/\s+/g,' ');
    if(Array.isArray(left)&&Array.isArray(right))return left.length===right.length&&left.every((entry,i)=>equalValue(entry,right[i]));
    if(object(left)&&object(right))return Object.keys(left).length===Object.keys(right).length&&Object.entries(left).every(([key,value])=>Object.hasOwn(right,key)&&equalValue(value,right[key]));
    return left===right;
  }
  function sameValue(key,value,current){
    if(!populated(value))return false;
    return key==='brandAssets'&&object(value)&&object(current)
      ? Object.entries(value).every(([part,entry])=>equalValue(entry,current[part]))
      : equalValue(value,current);
  }
  function improvementValue(key,current){
    const value=key==='brandAssets'&&object(current)
      ? Object.fromEntries(Object.entries(current).filter(([part])=>['colors','typography','references'].includes(part)))
      : current;
    try {return populated(value)&&valid(key,value)?value:null;}catch{return null;}
  }
  function acceptedRecord(record){
    if(record?.decision==='accepted')return record;
    if(record?.previousAcceptance?.decision==='accepted')return record.previousAcceptance;
  }
  // Decisions and claim lineage are user-controlled records, not verification credentials.
  function adopt(core,draft,key,decision,value,createTile){
    if(draft?.version!==VERSION||!Object.hasOwn(validators,key)||!['accepted','rejected','postponed'].includes(decision))fail();
    const proposal=draft.fields?.[key];if(!proposal||['unchanged','no_improvement'].includes(outcome(proposal)))fail();
    if(decision==='accepted'&&(!isSuggestion(proposal)||!valid(key,value)||!populated(value)||sameValue(key,value,target(core,key))))fail();
    const next=clone(core);
    if(decision==='accepted'){
      if(modules.includes(key)){
        const tiles=(next.customTiles||[]).filter(t=>t.moduleType===key);if(tiles.length>1)fail('AMBIGUOUS_MODULE');
        let tile=tiles[0];if(tile?.moduleData&&Object.keys(tile.moduleData).length)fail('SPECIALIZED_MODULE_OWNER');
        if(!tile){tile=createTile?.(key);if(!tile||tile.moduleType!==key||!/^km_[A-Za-z0-9][A-Za-z0-9_-]{7,}$/.test(tile.id))fail();(next.customTiles||=[]).push(tile);}tile.content=clone(value);
      }else next[key]=object(next[key])&&object(value)?{...next[key],...clone(value)}:clone(value);
    }
    const evidence=object(next[KEY])&&next[KEY].version===VERSION?next[KEY]:{version:VERSION,fields:{},inputs:{}};
    const previousAcceptance=decision==='accepted'?undefined:acceptedRecord(evidence.fields[key]);
    evidence.fields[key]={...clone(proposal),decision,proposedValue:clone(proposal.value),value:decision==='accepted'?clone(value):clone(proposal.value),
      userEdited:decision==='accepted'&&JSON.stringify(value)!==JSON.stringify(proposal.value),origin:draft.origin,revision:draft.revision,
      ...(previousAcceptance?{previousAcceptance}:{})};
    evidence.inputs ||= {};evidence.inputs[draft.originId]=clone(draft.input||{});
    // A prior acceptance keeps its citations, without extending retention of the old brief.
    const used=new Set(Object.values(evidence.fields).map(f=>f.originId));
    for(const id of Object.keys(evidence.inputs))if(!used.has(id))delete evidence.inputs[id];
    next[KEY]=evidence;safe(next);return next;
  }
  // Stable field order, one in-memory candidate, no persistence or inference here.
  function plan(core,draft,{revision,authorized=true,dirty=false,edits={},errors={},createTile}={}) {
    const accepted=[],excluded=[];let next=clone(core);
    for(const key of Object.keys(draft?.fields || {}).sort()) {
      const proposal=draft.fields[key],value=Object.hasOwn(edits,key)?edits[key]:proposal?.value;
      let reason='';
      if(!authorized)reason='Editing permission required';
      else if(draft.version!==VERSION||draft.revision!==revision)reason='Proposal is stale';
      else if(dirty)reason='Save your profile edits before deciding on suggestions.';
      else if(!Object.hasOwn(validators,key))reason='Use the existing editor in Advanced options';
      else if(proposal&&outcome(proposal)!=='suggestion')reason=outcomeLabels[outcome(proposal)]||'Unsupported suggestion';
      else if(!['user_provided','website_supported','ai_interpretation'].includes(proposal?.classification))reason='Unsupported suggestion';
      else if(errors[key])reason='Enter a valid suggested value.';
      else if(value===undefined||value===null||!populated(value))reason='Needs more information';
      else {
        try {
          if(!valid(key,value))reason='Use the existing editor in Advanced options';
          else {
            const current=target(core,key);
            if(current!=null&&(typeof value==='string'?typeof current!=='string':Array.isArray(value)?!Array.isArray(current):!object(current)))reason='Use the existing editor in Advanced options';
            else if(sameValue(key,value,current))reason=outcomeLabels.unchanged;
            else {next=adopt(next,draft,key,'accepted',value,createTile);accepted.push(key);}
          }
        } catch(e) {reason=e.code==='SPECIALIZED_MODULE_OWNER'?'Specialized module. Use its existing editor in Advanced options.':e.code==='AMBIGUOUS_MODULE'?'Current value unavailable. Review modules in Advanced options.':'Unsupported suggestion';}
      }
      if(reason)excluded.push({key,reason});
    }
    return {core:next,accepted,excluded};
  }
  return Object.freeze({VERSION,KEY,modules,sections,validators,valid,target,publicCore,url,outcome,outcomeLabels,isSuggestion,isReviewItem,sameValue,improvementValue,acceptedRecord,adopt,plan});
});
