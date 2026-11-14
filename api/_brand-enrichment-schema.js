'use strict';
// OpenAI strict Structured Outputs: every object is closed and every property is
// required. Nullable field records represent optional/unknown suggestions.
const c=require('../brand-enrichment-contract');
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const text={type:'string'},list={type:'array',items:text};
const shapes={brandCore:text,valueProposition:text,mission:text,vision:text,values:text,
 toneOfVoice:list,messagingPillars:list,contentGuidelines:list,keywords:list,
 personas:{type:'array',items:object({name:text,note:text})},
 dosAndDonts:object({dos:list,donts:list}),brandVoiceExamples:object({good:text,avoid:text})};
// Visual proposals may contain any subset of the three eligible parts. Do not
// require invented values for missing colors, typography or references.
const assets={colors:list,typography:text,references:list},parts=Object.keys(assets);
shapes.brandAssets={anyOf:Array.from({length:7},(_,i)=>object(Object.fromEntries(parts.filter((_,j)=>(i+1)&(1<<j)).map(k=>[k,assets[k]]))))};
function responseFormat(keys=Object.keys(c.validators)){
 const properties=Object.fromEntries(keys.map(key=>[key,{anyOf:[{type:'null'},object({
  value:{anyOf:[shapes[key],{type:'null'}]},
  classification:{type:'string',enum:['user_provided','website_supported','ai_interpretation','conflicting','missing']},
  evidence:{type:'array',items:object({sourceId:text,excerpt:text})}
 })]}]));
 return {type:'json_schema',json_schema:{name:'brand_profile_draft',strict:true,schema:object({fields:object(properties)})}};
}
module.exports={responseFormat};
