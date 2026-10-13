'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {B,W,I,EMAIL}=require('./bw36-13r5-local-runtime');
const advisor=require('../../api/_learning-advisor');
async function databaseChecks({canvas:savedCanvas}={}){
 const pg=new PGlite(),boardId='77777777-7777-4777-8777-777777777777',time='2026-10-12T10:00:00.123456Z';
 let failEvent=false;
 const db={connect:async()=>({query:(q,a)=>{if(failEvent&&q.includes('INSERT INTO public.brand_learning_events'))throw new Error('Injected rollback');return pg.query(q,a);},release(){}})};
 try{
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;
   CREATE TABLE app_identities(id uuid PRIMARY KEY,canonical_email text,status text,revision bigint);
   CREATE TABLE workspaces(id uuid PRIMARY KEY,status text);
   CREATE TABLE workspace_memberships(workspace_id uuid,identity_id uuid,status text);
   CREATE TABLE brands(id uuid PRIMARY KEY,owner_email text,name text,revision bigint,workspace_id uuid,brand_core jsonb);
   CREATE TABLE brand_members(brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,email text,role text,name text,UNIQUE(brand_id,email));
   CREATE TABLE boards(id uuid PRIMARY KEY,brand_id uuid REFERENCES brands(id),workspace_id uuid,name text,canvas_json jsonb,brand_core_snapshot jsonb,brand_core_source_revision bigint,updated_at timestamptz,owner_id text,owner_email text);
   CREATE TABLE board_editors(board_id uuid,email text,role text);`);
  await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)',[I,EMAIL,'active']);
  await pg.query('INSERT INTO workspaces VALUES ($1,$2)',[W,'active']);
  await pg.query('INSERT INTO workspace_memberships VALUES ($1,$2,$3)',[W,I,'accepted']);
  await pg.query('INSERT INTO brands VALUES ($1,$2,$3,1,$4,$5::jsonb)',[B,EMAIL,'Fixture Brand',W,JSON.stringify({brandCore:'Useful marketing.'})]);
  const canvas=savedCanvas||{schemaVersion:1,nodes:[{id:'node-1',type:'Content',title:'CTA',content:'Use a clear next step.'}],edges:[]};
  await pg.query('INSERT INTO boards VALUES ($1,$2,$3,$4,$5::jsonb,NULL,1,$6,NULL,$7)',[boardId,B,W,'Saved Board',JSON.stringify(canvas),time,EMAIL]);
  for(const file of ['20261011_bw36_17_governed_brand_learnings.sql','20261011_bw36_17r1_learning_provenance_schema.sql','20261012_bw36_17r2_learning_provenance_recovery.sql'])await pg.exec(fs.readFileSync('migrations/'+file,'utf8'));
  const scope={workspace_id:W,board_id:boardId,expected_brand_revision:'1',expected_board_updated_at:time,include_discussions:false,excluded_threads:[],language:'en'};
  const suggestion={type:'learning_candidate',statement:'Use a clear next step.',rationale:'The source explicitly states this.',confidence:'medium',confidence_reason:'Explicit wording, unverified performance.',
   evidence_class:'explicit_statement',decision_status:'unresolved',sources:[{ref:'s2',excerpt:'Use a clear next step.'}],limitations:['Review campaign scope.'],related_learning_ids:[],relationship:'new'};
  let calls=0,onProvider=null;
  const args={db,user:{email:EMAIL},brandId:B,scope,session:'signed-fixture-session',env:{OPENAI_API_KEY:'mock-only',AUTH_SECRET:'fixture-only'},fetchImpl:async()=>{
   calls++;if(onProvider)await onProvider();return {ok:true,status:200,text:async()=>JSON.stringify({status:'completed',output_text:JSON.stringify({language:'en',suggestions:[suggestion]})})};
  }};
  const count=async()=>Number((await pg.query('SELECT count(*) n FROM brand_learnings')).rows[0].n);
  const before=(await pg.query('SELECT canvas_json FROM boards')).rows[0].canvas_json;
  const result=await advisor.analyze(args);assert.equal(calls,1);assert.equal(result.suggestions[0].mode,'single_node');
  const adoption={...args,receipt:result.receipt,suggestionId:'suggestion-1',statement:'Human reviewed guidance.',evidence:'Minimized context'};
  failEvent=true;await assert.rejects(()=>advisor.adopt(adoption));assert.equal(await count(),0);failEvent=false;
  const saved=await advisor.adopt(adoption);assert.equal(saved.learning.status,'proposed');assert.equal(saved.learning.source_type,'campaign_observation');
  assert.equal((await pg.query('SELECT source_node_id FROM brand_learnings')).rows[0].source_node_id,'node-1');
  assert(!(await pg.query('SELECT snapshot FROM brand_learning_events')).rows[0].snapshot.source_node_id);
  assert.deepEqual((await pg.query('SELECT canvas_json FROM boards')).rows[0].canvas_json,before);
  await assert.rejects(()=>advisor.adopt(adoption),e=>e.code==='STALE_SOURCE');
  const next=await advisor.analyze(args);
  await pg.query("UPDATE workspace_memberships SET status='pending'");
  await assert.rejects(()=>advisor.checkReceipt({...args,receipt:next.receipt}),e=>e.code==='WORKSPACE_ACCESS_DENIED');
  await pg.query("UPDATE workspace_memberships SET status='accepted'");
  onProvider=async()=>pg.query("UPDATE app_identities SET status='disabled'");
  await assert.rejects(()=>advisor.analyze(args),e=>e.code==='IDENTITY_INVALID');
  console.log('PASS BW-36.19 disposable PGlite: actual source/Workspace SQL, precision, signed receipt, text Node adoption, R2 events, atomic rollback, stale Learning set and in-flight revocation. Not a multi-process contention test.');
 }finally{await pg.close();}
}
module.exports={databaseChecks};
