#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
function formatterChecks(){
 const context={};vm.runInNewContext(fs.readFileSync('learning-advisor.js','utf8'),context);
 const format=context.FunklixLearningAdvisor.evidenceContext;
 const candidate={rationale:'AI hypothesis.',sources:[{kind:'canvas_node',excerpt:'Literal saved wording.',attribution:'ai_generated',resolved:true}],limitations:['Campaign scope only.']};
 for(const language of ['en','de']){
  const evidence=format(candidate,language);assert(evidence.includes('AI hypothesis.'));assert(evidence.includes('Literal saved wording.'));assert(evidence.includes('Campaign scope only.'));
  assert(evidence.includes(language==='de'?'kein verifizierter Beleg':'not verified evidence'));
  assert(!format({...candidate,provenance_status:'unverified'},language).includes('Literal saved wording.'));
  assert(format({...candidate,sources:[]},language).includes(language==='de'?'keine validierten':'no validated'));
 }
 assert(format({...candidate,rationale:'x'.repeat(5000)}).length>5000,'No silent context truncation');
 console.log('PASS R6 full editable context, literal excerpts/AI distinction, unverified and missing evidence, EN/DE.');
}
async function contracts(){
 const {advisorRuntime}=require('./fixtures/bw36-19-advisor-runtime'),{B,clone}=require('./fixtures/bw36-13r5-local-runtime');
 const batch=()=>{const f=advisorRuntime();const s=clone(f.config.output.suggestions[0]);s.statement='Keep invitations specific.';f.config.output.suggestions.push(s);return f;};
 const analyze=async f=>(await f.request({action:'analyze',scope:f.scope})).body;
 const items=a=>a.suggestions.map((s,i)=>({suggestion_id:s.id,statement:'Human reviewed '+i,evidence_summary:'Edited context '+i}));
 const f=batch(),a=await analyze(f),first=await f.request({action:'adopt',receipt:a.receipt,...items(a)[0]});
 assert.equal(first.statusCode,201,JSON.stringify(first.body));assert.equal(first.body.review_session.expires,a.expires);
 assert.equal((await f.request({action:'validate',receipt:first.body.review_session.receipt})).statusCode,200);
 assert.equal((await f.request({action:'adopt',receipt:first.body.review_session.receipt,...items(a)[0]})).statusCode,403);
 const second=await f.request({action:'adopt',receipt:first.body.review_session.receipt,...items(a)[1]});assert.equal(second.statusCode,201,JSON.stringify(second.body));
 assert.equal(f.config.providerCalls.length,1);assert.equal(f.r.db.events.length,2);assert.equal(f.r.db.learnings[1].evidence_summary,'Edited context 1');
 for(const invalid of ['duplicate','id_duplicate','malformed_id','candidate','statement','existing','event','commit','stale','revoked','expiry','forged','source','brand']){
  const g=batch(),a=await analyze(g),selected=items(a);let receipt=a.receipt;
  if(invalid==='duplicate')selected[1].statement='  HUMAN reviewed 0 ';
  if(invalid==='id_duplicate')selected[1].suggestion_id=selected[0].suggestion_id;
  if(invalid==='malformed_id')selected[1].suggestion_id={toString:'invalid',valueOf:'invalid'};
  if(invalid==='candidate')selected[1].suggestion_id='forged';
  if(invalid==='statement')selected[1].statement='';
  if(invalid==='existing'){await g.r.request('POST','/api/brands/'+B+'/learnings',{statement:selected[1].statement,expected_brand_revision:'1'});}
  if(invalid==='event')g.r.db.failEvent=true;
  if(invalid==='commit')g.r.db.failCommit=true;
  if(invalid==='stale')g.board.canvas_json.nodes[0].content='Changed';
  if(invalid==='source')g.board.brand_id='11111111-1111-4111-8111-111111111111';
  if(invalid==='brand')g.r.base.db.brands[0].revision='2';
  if(invalid==='revoked')g.config.membership=false;
  if(invalid==='forged')receipt+='x';
  if(invalid==='expiry'){
   const p=JSON.parse(Buffer.from(receipt.split('.')[0],'base64url'));p.expires=0;
   const body=Buffer.from(JSON.stringify(p)).toString('base64url');receipt=body+'.'+crypto.createHmac('sha256',g.r.base.env.AUTH_SECRET).update(body).digest('base64url');
  }
  const before=clone(g.r.db.learnings),events=clone(g.r.db.events),out=await g.request({action:'adopt_selected',receipt,items:selected});
  assert(out.statusCode>=400,invalid);assert.equal(out.body.atomic,true);assert(out.body.results.every(r=>r.status==='not_saved'));assert.deepEqual(g.r.db.learnings,before);assert.deepEqual(g.r.db.events,events);
 }
 const wide=batch();while(wide.config.output.suggestions.length<5){const s=clone(wide.config.output.suggestions[0]);s.statement='Distinct guidance '+wide.config.output.suggestions.length;wide.config.output.suggestions.push(s);}
 const full=await analyze(wide),unicodeItems=items(full).map(item=>({...item,evidence_summary:'🙂'.repeat(4000)}));
 assert(Buffer.byteLength(JSON.stringify(unicodeItems))>64000);assert.equal((await wide.request({action:'adopt_selected',receipt:full.receipt,items:unicodeItems})).statusCode,201);
 // Independent provenance routes in one governed transaction.
 const g=batch();g.config.output.suggestions[1].sources=[{ref:'s1',excerpt:'Make marketing useful.'}];
 const original=(await g.r.request('POST','/api/brands/'+B+'/learnings',{statement:'Original knowledge',expected_brand_revision:'1'})).body.learning;
 const approved=(await g.r.request('PATCH','/api/brands/'+B+'/learnings',{action:'approve',learning_id:original.id,expected_revision:original.revision})).body.learning;
 const successor=clone(g.config.output.suggestions[0]);Object.assign(successor,{statement:'Update the original knowledge.',type:'learning_update_candidate',related_learning_ids:[approved.id],relationship:'update'});g.config.output.suggestions.push(successor);
 const b=await analyze(g),saved=await g.request({action:'adopt_selected',receipt:b.receipt,items:items(b)});assert.equal(saved.statusCode,201,JSON.stringify(saved.body));
 assert.deepEqual(saved.body.results.map(r=>r.learning.source_type),['campaign_observation','manual','manual']);assert.equal(saved.body.results[2].learning.supersedes_learning_id,approved.id);assert.equal(g.r.db.learnings[0].status,'approved');
 console.log('PASS R6 single receipt continuation; independent candidates; atomic mixed provenance; duplicate, invalid, expiry, revocation, stale, event/commit failures; zero extra provider calls.');
}
formatterChecks();
if(!process.argv.includes('--format-only'))(async()=>{await contracts();await require('./fixtures/bw36-19r6-review-ux').reviewUX();await require('./fixtures/bw36-19r6-browser').reviewBrowser();})().catch(e=>{console.error(e);process.exitCode=1;});
