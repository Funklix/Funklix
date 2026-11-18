'use strict';
// Field intent is centralized here; shapes and protected adoption remain in the
// shared v1 contract. These instructions are not a semantic verification engine.
const c=require('../brand-enrichment-contract');
const specs=Object.freeze(Object.fromEntries(Object.entries({
  "brandCore": {
    "purpose": "Describe what the organization does and for whom.",
    "expectedContent": "Concise factual description; no promotional slogans.",
    "structure": "string",
    "sourceRequirements": "Confirmed identity, services and supported audiences.",
    "relevantContext": "positioning, offers, accepted foundation",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Never invent history, locations, certifications or customer segments.",
    "missingInformation": "Return missing if core activity is unknown.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "valueProposition": {
    "purpose": "Explain the relevant customer outcome and the supported brand contribution.",
    "expectedContent": "Connect an evidenced customer need to the actual service or offer.",
    "structure": "string",
    "sourceRequirements": "Confirmed services and customer needs; differentiators require evidence.",
    "relevantContext": "positioning, offers, personas",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Avoid unsupported superiority, unique advantages or guarantees.",
    "missingInformation": "Ask which customer problem the company is particularly equipped to solve when unclear.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "mission": {
    "purpose": "Describe the present organizational purpose.",
    "expectedContent": "A present-purpose statement supplied or confirmed by the user.",
    "structure": "string",
    "sourceRequirements": "Explicit purpose or a direct user answer.",
    "relevantContext": "accepted foundation, accepted Founder facts",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not confuse a service list with purpose or invent an official mission.",
    "missingInformation": "Return missing and optionally ask what positive change the company wants to create.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "vision": {
    "purpose": "Describe a future-oriented ambition.",
    "expectedContent": "An explicitly supplied future ambition.",
    "structure": "string",
    "sourceRequirements": "Explicit ambition or a direct user answer.",
    "relevantContext": "accepted foundation, accepted Founder vision",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not invent aspirations or present a proposed ambition as a public statement.",
    "missingInformation": "Return missing and ask about the desired future if unknown.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "values": {
    "purpose": "Propose meaningful organizational principles.",
    "expectedContent": "Principles that guide decisions, grounded in supplied behavior.",
    "structure": "string",
    "sourceRequirements": "Confirmed practices; inferred principles are strategic suggestions.",
    "relevantContext": "accepted foundation, accepted Founder facts",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not equate quality equipment with confirmed organizational values. Always label inferred principles ai_interpretation.",
    "missingInformation": "Return missing if no relevant behavior or principles are supplied.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "personas": {
    "purpose": "Identify evidence-supported customer segments and buying roles.",
    "expectedContent": "Named segment and a note about supported needs or buying decisions.",
    "structure": "array of {name,note}",
    "sourceRequirements": "Direct audience or buyer evidence, not guesses from the service category.",
    "relevantContext": "accepted personas, accepted strategy modules, offers",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not infer homeowners, enterprises or decision-makers merely from technical services. Speculative targets are not confirmed segments.",
    "missingInformation": "Return missing and ask who typically decides to purchase the services.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "toneOfVoice": {
    "purpose": "Define how the brand communicates.",
    "expectedContent": "Concise, coherent, consistently phrased voice characteristics such as clear and approachable.",
    "structure": "string array",
    "sourceRequirements": "Supported positioning and communication preferences; interpretations are suggestions.",
    "relevantContext": "accepted foundation, personas, approved DNA, accepted Founder",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Experienced staff, quality equipment and emergency availability are company attributes, not voice characteristics.",
    "missingInformation": "Ask whether communication should feel technical, personal, premium or approachable if context is insufficient.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "messagingPillars": {
    "purpose": "Express the main ideas customers should remember.",
    "expectedContent": "Concrete takeaways connecting confirmed services and positioning to customer needs.",
    "structure": "string array",
    "sourceRequirements": "Exact supporting facts; no invented competitive claims.",
    "relevantContext": "accepted foundation, personas, offers",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not turn unsupported advantages into facts or confuse messages with editorial rules.",
    "missingInformation": "Return missing if no supported positioning or services are known.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "contentGuidelines": {
    "purpose": "Define practical editorial and communication rules.",
    "expectedContent": "Actionable instructions: explain technical topics clearly, use customer benefits, support claims with evidence.",
    "structure": "string array",
    "sourceRequirements": "Confirmed services and suggested communication approach.",
    "relevantContext": "accepted foundation, tone, personas, approved DNA",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Standalone advertising claims such as We are your reliable partner are not editorial guidelines.",
    "missingInformation": "Use supported context to suggest rules; otherwise ask about communication needs.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "keywords": {
    "purpose": "Provide relevant topic and search vocabulary.",
    "expectedContent": "Concise service, topic and customer-need terms.",
    "structure": "string array",
    "sourceRequirements": "Terms grounded in known services or positioning.",
    "relevantContext": "offers, positioning, personas",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not invent product names, certification terms or unrelated trending words.",
    "missingInformation": "Return missing if topics are unknown.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "dosAndDonts": {
    "purpose": "Define actionable communication behaviors.",
    "expectedContent": "Positive behaviors in dos; prohibited behaviors in donts. All natural-language values use the requested language.",
    "structure": "{dos:string[],donts:string[]}",
    "sourceRequirements": "Supported facts and suggested communication preferences.",
    "relevantContext": "accepted tone, guidelines, foundation, approved DNA",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not swap positive/negative classifications or mix English instructions into German output.",
    "missingInformation": "Return missing if there is insufficient communication context.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "brandVoiceExamples": {
    "purpose": "Demonstrate the suggested communication style concretely.",
    "expectedContent": "good demonstrates the desired wording; avoid demonstrates wording to avoid.",
    "structure": "{good:string,avoid:string}",
    "sourceRequirements": "Confirmed brand facts and suggested tone only.",
    "relevantContext": "accepted tone, guidelines, foundation, offers",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not introduce unproven company facts, guarantees or testimonials, including in the avoid example.",
    "missingInformation": "Return missing if service and style context are absent.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  },
  "brandAssets": {
    "purpose": "Describe existing visual identity.",
    "expectedContent": "Only evidenced colors, typography and visual references.",
    "structure": "subset of {colors:string[],typography:string,references:string[]}",
    "sourceRequirements": "Explicit visual identity evidence.",
    "relevantContext": "accepted brand assets",
    "qualityCriteria": "Serve the field purpose, remain useful and coherent, preserve unknowns, do not contradict accepted knowledge.",
    "commonErrors": "Do not generate logos, approved DNA or Founder Story, or invent fonts and colors.",
    "missingInformation": "Return missing for unknown assets; use established specialized workflows for Founder/DNA.",
    "language": "All prose, list entries, persona names/notes and nested values must use the requested output language. Preserve proper brand/product names and established technical terms; JSON keys stay unchanged."
  }
}).map(([key,spec])=>[key,Object.freeze(spec)])));
function scope(input){
 if(input.section!==undefined){
  if(!Object.hasOwn(c.sections,input.section)||!Array.isArray(input.targetFields)||!input.targetFields.length||new Set(input.targetFields).size!==input.targetFields.length||input.targetFields.some(k=>!c.sections[input.section].includes(k))||input.field&&!input.targetFields.includes(input.field)||input.action==='questions'&&!input.field)throw Object.assign(new Error('INVALID_INPUT'),{code:'INVALID_INPUT',status:422});
  if(input.field&&input.targetFields.length!==1)throw Object.assign(new Error('INVALID_INPUT'),{code:'INVALID_INPUT',status:422});
  return [...input.targetFields];
 }
 if(input.targetFields!==undefined)throw Object.assign(new Error('INVALID_INPUT'),{code:'INVALID_INPUT',status:422});
 return input.field?[input.field]:Object.keys(c.validators);
}
function instructions(keys){return JSON.stringify(Object.fromEntries(keys.map(k=>[k,specs[k]])));}
function strings(value){return typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];}
const words={en:new Set('the and we our your you with for are is to of that this should do not use explain claims customers their'.split(' ')),de:new Set('der die das und wir unser unsere unserer ihr ihre sie mit für sind ist zu von dass diese soll sollen nicht verwenden erkläre kunden aussagen'.split(' '))};
const clauses={en:new Set('are is should do use explain'.split(' ')),de:new Set('sind ist soll sollen verwenden erkläre'.split(' '))};
// Conservative sentence-level evidence, not a general language detector. Short
// labels, proper nouns and technical terms alone never establish a mismatch.
function mismatch(value,language,names=[]){
 const other=language==='de'?'en':'de';
 return strings(value).some(raw=>{
  let text=raw;for(const name of names.filter(n=>typeof n==='string'&&n.trim()))text=text.split(name).join(' ');
  const tokens=text.toLowerCase().match(/\p{L}+/gu)||[];
  const requested=tokens.filter(w=>words[language].has(w)).length,foreign=tokens.filter(w=>words[other].has(w)).length;
  return tokens.some(w=>clauses[other].has(w))&&foreign>=3&&foreign>=requested+3&&foreign/Math.max(tokens.length,1)>=0.2;
 });
}
function assess(key,value,{language,sources,name}={}){
 const issues=[];
 if(mismatch(value,language,[name]))issues.push('language_mismatch');
 // Narrow recognizable patterns are review flags, never semantic certainty.
 const entries=strings(value).filter(s=>s.trim());
 if(key==='contentGuidelines'&&entries.length&&entries.some(s=>/^(?:wir (?:sind|bieten|haben)|we (?:are|offer|have))\b/i.test(s.trim())))issues.push('field_purpose_review');
 if(key==='toneOfVoice'&&entries.length&&entries.every(s=>/^(?:(?:erfahrene|erfahrenes|hochwertige|hochwertiges)\s+(?:servicemitarbeiter|mitarbeiter|geräte|ausstattung)|(?:experienced|quality|high-quality)\s+(?:staff|equipment|service staff))\.?$/i.test(s.trim())))issues.push('field_purpose_review');
 // Unseen quantified claims require human review. Matching source text does not
 // prove entailment; broader unsupported claims remain a qualitative limitation.
 if(!['keywords','brandAssets'].includes(key)){
  const sourceText=(sources||[]).map(s=>s.excerpt).join(' ').toLowerCase();
  if(entries.some(s=>[...s.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:%(?!\w)|(?:prozent|percent|years?|jahre[n]?|customers?|kunden)\b)/gi)].some(m=>!sourceText.includes(m[0].toLowerCase()))))issues.push('claim_grounding_review');
 }
 return issues;
}
module.exports={specs,scope,instructions,assess,mismatch};
