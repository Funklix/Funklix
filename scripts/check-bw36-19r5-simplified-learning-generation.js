#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {chromium}=require('playwright-core');
const {savedCampaign}=require('./fixtures/bw36-19r4-saved-campaign');
const {B,W,I,EMAIL,clone}=require('./fixtures/bw36-13r5-local-runtime');
function envelope(value){return {id:'resp_fixture',object:'response',created_at:1791960000,status:'completed',error:null,incomplete_details:null,
 model:'gpt-4o-mini-2024-07-18',output:[{id:'msg_fixture',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',annotations:[],text:JSON.stringify(value)}]}],
 usage:{input_tokens:1200,input_tokens_details:{cached_tokens:0},output_tokens:210,output_tokens_details:{reasoning_tokens:0},total_tokens:1410}};}
function simplified(f){
 for(const l of f.r.db.learnings)Object.assign(l,{created_at:"2026-10-12T10:00:00Z",updated_at:"2026-10-12T10:00:00Z"});
 const normal=f.config.onProvider;f.config.onProvider=()=>{normal();const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content);
  const source=input.sources.find(s=>s.kind==='canvas_node');f.config.output={suggestions:[{title:'Clear next step',statement:'Offer a clear next step.',rationale:'The saved campaign calls for a concrete invitation.',source_refs:source?[source.ref]:null}]};
  f.config.providerEnvelope=envelope(f.config.output);};return f;
}
async function contracts(){
 for(const optional of [null,undefined,[],{},['forged'],['s1','forged'],[null]]){
  const f=simplified(savedCampaign()),normal=f.config.onProvider;f.config.onProvider=()=>{normal();f.config.output.suggestions[0].source_refs=optional;f.config.providerEnvelope=envelope(f.config.output);};
  const out=await f.request({action:'analyze',scope:f.scope});assert.equal(out.statusCode,200,JSON.stringify(out.body));
  const s=out.body.suggestions[0];assert.equal(s.provenance_status,'unverified');assert.equal(s.mode,'manual');assert.equal(s.node_id,null);assert.deepEqual(s.sources,[]);
  const saved=await f.request({action:'adopt',receipt:out.body.receipt,suggestion_id:s.id,statement:s.statement,evidence_summary:'Human proposal; AI supporting references unavailable.'});
  assert.equal(saved.statusCode,201,JSON.stringify(saved.body));assert.equal(saved.body.learning.source_type,'manual');assert.equal(saved.body.learning.status,'proposed');
 }
 for(const language of ['en','de']){
  const f=simplified(savedCampaign(language)),normal=f.config.onProvider;f.config.onProvider=()=>{normal();if(language==='de')Object.assign(f.config.output.suggestions[0],{title:'Klarer nächster Schritt',statement:'Einen klaren nächsten Schritt anbieten.',rationale:'Die gespeicherte Kampagne nennt eine konkrete Einladung.'});
   f.config.output.suggestions.unshift({title:'Malformed',statement:42,rationale:'Invalid',source_refs:[]});f.config.providerEnvelope=envelope(f.config.output);};
  const before=clone(f.r.base.db),knowledge=clone(f.r.db.learnings),out=await f.request({action:'analyze',scope:f.scope});
  assert.equal(out.statusCode,200);assert.equal(out.body.suggestions.length,1);assert.equal(out.body.suggestions[0].id,'suggestion-2');assert.equal(out.body.suggestions[0].mode,'single_node');
  assert.deepEqual(clone(f.r.base.db),before);assert.deepEqual(clone(f.r.db.learnings),knowledge);assert.equal(f.r.db.events.length,0);
  const req=f.config.providerCalls[0];assert.equal(req.url,'https://api.openai.com/v1/responses');assert.equal(req.body.store,false);assert.equal(req.body.max_output_tokens,8192);
  assert.equal(req.body.text.format.name,'brand_learning_suggestions_v2');assert(req.body.text.format.strict);assert.deepEqual(Object.keys(req.body.text.format.schema.properties.suggestions.items.properties),['title','statement','rationale','source_refs']);
  assert.equal(out.body.metadata.usage.output_tokens,210);assert.equal(out.body.metadata.provider_requests,1);
 }
 for(const mutate of [f=>f.config.membership=false,f=>f.r.db.role='viewer',f=>f.board.canvas_json.nodes[0].content='Changed']){
  const f=simplified(savedCampaign()),normal=f.config.onProvider;f.config.onProvider=()=>{normal();mutate(f);};const out=await f.request({action:'analyze',scope:f.scope});assert(out.statusCode>=400);assert(!out.body.suggestions);
 }
 const forged=simplified(savedCampaign()),a=await forged.request({action:'analyze',scope:forged.scope});
 assert.equal((await forged.request({action:'adopt',receipt:a.body.receipt+'x',suggestion_id:a.body.suggestions[0].id,statement:'Forged',evidence_summary:''})).statusCode,403);
 for(const status of ['incomplete','failed','cancelled','queued','in_progress']){
  const f=simplified(savedCampaign()),normal=f.config.onProvider;f.config.onProvider=()=>{normal();Object.assign(f.config.providerEnvelope,{status,incomplete_details:{reason:'max_output_tokens'}});};
  const out=await f.request({action:'analyze',scope:f.scope});assert.equal(out.statusCode,502);assert(!out.body.suggestions);
 }
 for(const mutate of [f=>f.config.providerRaw='{',f=>f.config.providerEnvelope.output[0].content=[{type:'refusal',refusal:'fixture refusal'}],f=>f.config.providerEnvelope.output[0].status='incomplete']){
  const f=simplified(savedCampaign()),normal=f.config.onProvider;f.config.onProvider=()=>{normal();mutate(f);};assert.equal((await f.request({action:'analyze',scope:f.scope})).statusCode,502);
 }
 for(const [failure,status] of [[429,429],[503,502],['timeout',504]]){const f=simplified(savedCampaign());f.config.providerFailure=failure;assert.equal((await f.request({action:'analyze',scope:f.scope})).statusCode,status);assert.equal(f.config.providerCalls.length,1);}
 const bad=simplified(savedCampaign()),badNormal=bad.config.onProvider;bad.config.onProvider=()=>{badNormal();bad.config.providerEnvelope=envelope({suggestions:[{title:'Bad',statement:42,rationale:'Bad'}]});};assert.equal((await bad.request({action:'analyze',scope:bad.scope})).statusCode,502);
 const empty=simplified(savedCampaign()),normal=empty.config.onProvider;empty.config.onProvider=()=>{normal();empty.config.providerEnvelope=envelope({suggestions:[]});};
 assert.deepEqual((await empty.request({action:'analyze',scope:empty.scope})).body.suggestions,[]);
 // Adaptive passes with the new contract must preserve server-validated handles.
 const multi=simplified(savedCampaign());Object.assign(multi.r.base.env,{OPENAI_LEARNING_ADVISOR_MODEL:'fixture-model',OPENAI_LEARNING_ADVISOR_CONTEXT_TOKENS:'18192',OPENAI_LEARNING_ADVISOR_TOKEN_ENCODING:'o200k_base'});
 for(let i=0;i<18;i++)multi.board.canvas_json.nodes.push({id:'large-'+i,type:'Content',content:('Review practical campaign guidance '+i+'. ').repeat(220)});
 const m=await multi.request({action:'analyze',scope:multi.scope});assert.equal(m.statusCode,200,JSON.stringify(m.body));assert(m.body.coverage.source_passes>1);assert.equal(m.body.suggestions[0].provenance_status,'validated_handles');
 console.log('PASS R5 minimal contract, optional evidence isolation, EN/DE partial candidates, provider envelopes/errors, revocation, no generation writes and adaptive consolidation.');
}
async function persistedBrowser(){
 const pg=new PGlite(),boardId='77777777-7777-4777-8777-777777777777',time='2026-10-12T10:00:00.123456Z';
 const db={connect:async()=>({query:(q,a)=>pg.query(q,a),release(){}})};
 const campaign=savedCampaign(),savedCanvas=clone(campaign.board.canvas_json);
 const oldSecret=process.env.AUTH_SECRET,oldUrl=process.env.POSTGRES_URL;process.env.AUTH_SECRET='r5-fixture-only';process.env.POSTGRES_URL='fixture-only';
 let browser;
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
  await pg.exec(fs.readFileSync('scripts/fixtures/bw36-23a-r3-lock.sql','utf8'));
  for(const file of ['20261011_bw36_17_governed_brand_learnings.sql','20261011_bw36_17r1_learning_provenance_schema.sql','20261012_bw36_17r2_learning_provenance_recovery.sql'])await pg.exec(fs.readFileSync('migrations/'+file,'utf8'));

  await pg.query('UPDATE brands SET brand_core=$1::jsonb',[JSON.stringify(campaign.r.base.db.brands[0].brand_core)]);
  await pg.query('UPDATE boards SET brand_core_snapshot=$1::jsonb',[JSON.stringify(campaign.board.brand_core_snapshot)]);
  let providerCalls=0,variant='valid';const requests=[];
  const fetchImpl=async(url,init)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');providerCalls++;
   const body=JSON.parse(init.body),input=JSON.parse(body.input[1].content);requests.push(body);
   assert(input.sources.some(s=>s.kind==='canonical_profile'));assert(input.sources.filter(s=>s.kind==='canvas_node'&&s.node_type==='Campaign Variation').length===2);
   assert(input.sources.some(s=>s.kind==='canvas_reply'));assert(input.texts.includes('No decision yet. Review both variations.'));
   const node=input.sources.find(s=>s.kind==='canvas_node');
   let value={suggestions:[{title:'Clear next step',statement:'Offer a clear next step.',rationale:'Both variations invite readers to a concrete next step.',source_refs:[node.ref]}]};
   if(variant==='empty')value={suggestions:[]};
   if(variant==='unverified')value.suggestions[0].source_refs=['forged'];
   if(variant==='failure')return new Response(JSON.stringify({error:{type:'server_error',message:'fixture-only'}}),{status:503});
   return new Response(JSON.stringify(envelope(value)),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const handler=require('../api/brands/[id]/learning-advisor').createHandler({db,env:{OPENAI_API_KEY:'mock-only',AUTH_SECRET:'r5-fixture-only'},fetchImpl});
  // Inject only the database transport into the existing Learning HTTP route.
  const storagePath=require.resolve('../api/_boards-storage'),oldStorage=require.cache[storagePath];require.cache[storagePath]={id:storagePath,filename:storagePath,loaded:true,exports:{pool:db}};
  const learningPath=require.resolve('../api/brands/[id]/learnings'),oldRoute=require.cache[learningPath];delete require.cache[learningPath];
  const learningHandler=require(learningPath);
  if(oldStorage)require.cache[storagePath]=oldStorage;else delete require.cache[storagePath];
  if(oldRoute)require.cache[learningPath]=oldRoute;else delete require.cache[learningPath];
  const cookie='funklix_session='+require('../api/_auth-session').createSessionToken({email:EMAIL});
  const beforeCanvas=JSON.stringify((await pg.query('SELECT canvas_json FROM boards')).rows[0].canvas_json);
  const beforeProfile=JSON.stringify((await pg.query('SELECT brand_core FROM brands')).rows[0].brand_core);
  const count=async()=>Number((await pg.query('SELECT count(*) n FROM brand_learnings')).rows[0].n);
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html='<html><body><main id="learnings"></main><script src="/learning-advisor.js"></script><script src="/brand-learnings.js"></script><script>window.library=FunklixBrandLearnings.create({brand:{id:'+JSON.stringify(B)+',name:"Fixture Brand"},workspaceId:'+JSON.stringify(W)+',language:()=>"en",current:()=>true});library.attach(document.querySelector("main"));</script></body></html>';
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());assert.equal(url.hostname,'localhost','No real network');
   if(url.pathname.startsWith('/api/')){
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(body){this.body=body;return this;},stream:'',write(v){this.stream+=v;},end(){}};
    const req={method:request.method(),query:{id:B,...Object.fromEntries(url.searchParams)},body:request.method()==='GET'?undefined:request.postDataJSON(),headers:{cookie,accept:request.headers().accept}};
    await (url.pathname.endsWith('/learning-advisor')?handler:learningHandler)(req,res);
    return route.fulfill(res.stream?{status:res.statusCode,contentType:'application/x-ndjson',body:res.stream}:{status:res.statusCode,json:res.body});
   }
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
   return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('.'+url.pathname,'utf8')});
  });
  await page.goto('http://localhost/');await page.locator('[data-learning-advisor-open]').click();
  const dialog=page.locator('[data-learning-advisor]'),action=k=>dialog.locator('[data-advisor-action="'+k+'"]');
  await dialog.locator('select').selectOption(boardId);await dialog.locator('[data-advisor-discussions]').check();await dialog.locator('[data-advisor-thread]').first().waitFor();
  await action('analyze').click();await dialog.getByRole('heading',{name:'Clear next step',exact:true}).waitFor();
  await dialog.getByText('Offer a clear next step.',{exact:true}).waitFor();await dialog.getByText('Both variations invite readers to a concrete next step.',{exact:true}).waitFor();
  assert.equal(providerCalls,1);assert.equal(await count(),0);assert.equal(Number((await pg.query('SELECT count(*) n FROM brand_learning_events')).rows[0].n),0);
  assert.equal(JSON.stringify((await pg.query('SELECT canvas_json FROM boards')).rows[0].canvas_json),beforeCanvas);assert.equal(JSON.stringify((await pg.query('SELECT brand_core FROM brands')).rows[0].brand_core),beforeProfile);
  await action('review').click();await action('save').click();await dialog.getByText(/Saved as proposed/).waitFor();
  const saved=(await pg.query('SELECT * FROM brand_learnings')).rows[0];assert.equal(saved.status,'proposed');assert.equal(saved.source_type,'campaign_observation');assert.equal(saved.source_node_id,savedCanvas.nodes[0].id);
  await action('cancel').click();await page.locator('.learning-proposed').waitFor();
  await page.reload();await page.locator('.learning-proposed').waitFor();assert.equal(providerCalls,1);
  await page.locator('.learning-proposed [data-learning-action=approve]').click();
  const approval=page.locator('dialog.brand-learning-dialog');await approval.locator('[data-learning-action=approve]').click();
  await page.locator('.learning-approved').waitFor();assert.equal((await pg.query('SELECT status FROM brand_learnings')).rows[0].status,'approved');
  await page.reload();await page.locator('.learning-approved').waitFor();assert.equal(await page.locator('.learning-approved h4').textContent(),'Offer a clear next step.');
  assert.equal(providerCalls,1);assert.equal(Number((await pg.query('SELECT count(*) n FROM brand_learning_events')).rows[0].n),2);
  // The same actual handler explicitly renders empty and retains selection after provider errors.
  await page.locator('[data-learning-advisor-open]').click();await dialog.locator('select').selectOption(boardId);await dialog.locator('[data-advisor-discussions]').check();
  variant='empty';await action('analyze').click();await dialog.getByText(/No useful suggestions/).waitFor();
  variant='failure';await action('analyze').click();await dialog.getByRole('alert').waitFor();assert((await dialog.getByRole('alert').textContent()).includes('Retry explicitly'));
  assert.equal(await dialog.locator('select').inputValue(),boardId);assert(await dialog.locator('[data-advisor-discussions]').isChecked());assert.equal(await count(),1);
  variant='unverified';await action('analyze').click();await dialog.getByText(/Unverified draft:/).waitFor();assert.equal(await count(),1);
  assert.equal(await dialog.locator('blockquote').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS R5 actual Advisor/Learning HTTP handlers + Chromium + disposable PGlite: saved Profile/two variations/persisted comments -> displayed title/statement/rationale -> explicit proposal -> persisted proposed -> authorized human approval -> approved after refresh; empty/error UI; generation alone has zero application writes.');
 }finally{if(browser)await browser.close();await pg.close();if(oldSecret===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=oldSecret;if(oldUrl===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=oldUrl;}
}
(async()=>{await contracts();await persistedBrowser();})().catch(e=>{console.error(e);process.exitCode=1;});
