'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core'));}
const {savedCampaign}=require('./bw36-19r4-saved-campaign');
const {B,W,I,EMAIL,clone}=require('./bw36-13r5-local-runtime');
function envelope(value){return {status:'completed',output_text:JSON.stringify(value)};}
async function reviewBrowser(){
 const pg=new PGlite(),boardId='77777777-7777-4777-8777-777777777777',time='2026-10-12T10:00:00.123456Z';
 const db={connect:async()=>({query:(q,a)=>{if(q.includes('INSERT INTO public.brand_learning_events')&&++eventAttempts===failEventAt)throw new Error('Injected second event failure');return pg.query(q,a);},release(){}})};
 const campaign=savedCampaign(),savedCanvas=clone(campaign.board.canvas_json);
 const oldSecret=process.env.AUTH_SECRET,oldUrl=process.env.POSTGRES_URL;process.env.AUTH_SECRET='r5-fixture-only';process.env.POSTGRES_URL='fixture-only';
 let browser,failEventAt=0,eventAttempts=0;
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

  await pg.query('UPDATE brands SET brand_core=$1::jsonb',[JSON.stringify(campaign.r.base.db.brands[0].brand_core)]);
  await pg.query('UPDATE boards SET brand_core_snapshot=$1::jsonb',[JSON.stringify(campaign.board.brand_core_snapshot)]);
  let providerCalls=0,variant='valid';const requests=[];
  const fetchImpl=async(url,init)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');providerCalls++;
   const body=JSON.parse(init.body),input=JSON.parse(body.input[1].content);requests.push(body);
   assert(input.sources.some(s=>s.kind==='canonical_profile'));assert(input.sources.filter(s=>s.kind==='canvas_node'&&s.node_type==='Campaign Variation').length===2);
   assert(input.sources.some(s=>s.kind==='canvas_reply'));assert(input.texts.includes('No decision yet. Review both variations.'));
   const node=input.sources.find(s=>s.kind==='canvas_node');
   let value={suggestions:[{title:'Clear next step',statement:'Offer a clear next step.',rationale:'Both variations invite readers to a concrete next step.',source_refs:[node.ref]},{title:'Manual guidance',statement:'Review the wider Brand context.',rationale:'This is AI interpretation without verified references.',source_refs:[]},{title:'Profile guidance',statement:'Keep marketing useful.',rationale:'The Profile describes useful marketing.',source_refs:[input.sources.find(s=>s.kind==='canonical_profile').ref]}]};
   if(variant==='empty')value={suggestions:[]};
   if(variant==='unverified')value.suggestions[0].source_refs=['forged'];
   if(variant==='failure')return new Response(JSON.stringify({error:{type:'server_error',message:'fixture-only'}}),{status:503});
   return new Response(JSON.stringify(envelope(value)),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const handler=require('../../api/brands/[id]/learning-advisor').createHandler({db,env:{OPENAI_API_KEY:'mock-only',AUTH_SECRET:'r5-fixture-only'},fetchImpl});
  // Inject only the database transport into the existing Learning HTTP route.
  const storagePath=require.resolve('../../api/_boards-storage'),oldStorage=require.cache[storagePath];require.cache[storagePath]={id:storagePath,filename:storagePath,loaded:true,exports:{pool:db}};
  const learningPath=require.resolve('../../api/brands/[id]/learnings'),oldRoute=require.cache[learningPath];delete require.cache[learningPath];
  const learningHandler=require(learningPath);
  if(oldStorage)require.cache[storagePath]=oldStorage;else delete require.cache[storagePath];
  if(oldRoute)require.cache[learningPath]=oldRoute;else delete require.cache[learningPath];
  const cookie='funklix_session='+require('../../api/_auth-session').createSessionToken({email:EMAIL});
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
  const dialog=page.locator('[data-learning-advisor]'),action=k=>dialog.locator('[data-advisor-action="'+k+'"]'),field=k=>dialog.locator('[data-advisor-field="'+k+'"]'),card=id=>dialog.locator('[data-advisor-suggestion="'+id+'"]');
  await dialog.locator('select').selectOption(boardId);await dialog.locator('[data-advisor-discussions]').check();await dialog.locator('[data-advisor-thread]').first().waitFor();
  await action('analyze').click();await card('suggestion-1').waitFor();assert.equal(providerCalls,1);
  await card('suggestion-1').locator('[data-advisor-action=review]').click();
  assert((await field('evidence').inputValue()).includes('AI interpretation'));assert((await field('evidence').inputValue()).includes('Validated saved-source excerpt'));
  await field('statement').fill('Human-reviewed first proposal');await field('evidence').fill('Human-reviewed explanatory context');
  await action('save').click();await dialog.getByText(/Saved as proposed/).waitFor();await card('suggestion-1').waitFor();
  assert(await card('suggestion-1').locator('[data-advisor-action=review]').isDisabled());assert(await card('suggestion-1').locator('input').isDisabled());
  assert.equal(await dialog.locator('select').inputValue(),boardId);assert(await dialog.locator('[data-advisor-discussions]').isChecked());assert.equal(providerCalls,1);
  await card('suggestion-2').locator('input').check();await card('suggestion-3').locator('input').check();await card('suggestion-3').locator('input').uncheck();
  await action('reviewSelected').click();assert((await field('evidence').inputValue()).includes('Unverified: no validated'));
  await action('back').click();await card('suggestion-3').locator('input').check();await action('reviewSelected').click();
  await field('statement').fill('Human-reviewed manual proposal');await field('evidence').fill('Edited manual context');await action('next').click();
  await field('statement').fill('Human-reviewed profile proposal');await field('evidence').fill('Edited Profile context');await action('previous').click();
  assert.equal(await field('statement').inputValue(),'Human-reviewed manual proposal');assert.equal(await field('evidence').inputValue(),'Edited manual context');
  await action('saveSelected').click();assert.equal(await count(),1,'Review does not save without final confirmation');
  await action('keep').click();await action('next').click();await action('remove').click();assert.equal(await action('next').isDisabled(),true);
  await action('back').click();await action('discardAction').click();await card('suggestion-3').locator('input').check();await action('reviewSelected').click();
  await field('statement').fill('Atomic manual proposal');await field('evidence').fill('Retained manual edits');await action('next').click();
  await field('statement').fill('Atomic Profile proposal');await field('evidence').fill('Retained Profile edits');
  failEventAt=eventAttempts+2;await action('saveSelected').click();await action('confirm').click();await dialog.getByRole('alert').waitFor();
  assert.equal(await count(),1,'Second event failure rolls back first batch Learning and event');assert.equal(Number((await pg.query('SELECT count(*) n FROM brand_learning_events')).rows[0].n),1);
  assert.equal(await field('evidence').inputValue(),'Retained Profile edits');failEventAt=0;
  await action('saveSelected').click();await action('confirm').click();await card('suggestion-3').waitFor();assert.equal(await count(),3);assert.equal(providerCalls,1);
  for(const id of ['suggestion-1','suggestion-2','suggestion-3'])assert(await card(id).locator('input').isDisabled());
  assert.equal(Number((await pg.query('SELECT count(*) n FROM brand_learning_events')).rows[0].n),3);
  const saved=(await pg.query('SELECT statement,evidence_summary,source_type,status FROM brand_learnings ORDER BY created_at,id')).rows;
  assert(saved.every(r=>r.status==='proposed'));assert(saved.some(r=>r.statement==='Atomic manual proposal'&&r.evidence_summary==='Retained manual edits'&&r.source_type==='manual'));
  assert(saved.some(r=>r.statement==='Human-reviewed first proposal'&&r.evidence_summary==='Human-reviewed explanatory context'&&r.source_type==='campaign_observation'));
  await action('cancel').click();assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-learning-advisor-open')),true);await page.reload();await page.getByRole('heading',{name:'Atomic manual proposal',exact:true}).waitFor();assert.equal(providerCalls,1);
  assert.equal(JSON.stringify((await pg.query('SELECT canvas_json FROM boards')).rows[0].canvas_json),beforeCanvas);assert.equal(JSON.stringify((await pg.query('SELECT brand_core FROM brands')).rows[0].brand_core),beforeProfile);assert.deepEqual(errors,[]);
  console.log('PASS R6 actual HTTP handlers + Chromium + PGlite: context edits and durable reload, session after single save, selection/deselection/removal, multi-review edits, explicit confirmation, second-event atomic rollback and safe retry, manual/source-backed provenance, no paid calls or Canvas/Profile writes.');
 }finally{if(browser)await browser.close();await pg.close();if(oldSecret===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=oldSecret;if(oldUrl===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=oldUrl;}
}
module.exports={reviewBrowser};
