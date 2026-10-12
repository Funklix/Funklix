#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {learningRuntime}=require('./fixtures/bw36-17-local-runtime');
const {B,I,W,EMAIL}=require('./fixtures/bw36-13r5-local-runtime');
const BOARD='77777777-7777-4777-8777-777777777777',OTHER='99999999-9999-4999-8999-999999999999';
const service=learningRuntime().service;
const time='2026-10-12T10:00:00.123456Z';
const source={board_id:BOARD,node_id:'node-1',expected_board_updated_at:time};
let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log(`PASS ${name}`);};
async function databaseChecks() {
  // No remote database, provider or AI transport is available to this suite.
  const oldFetch=global.fetch;global.fetch=()=>{throw new Error('External network forbidden');};
  const pg=new PGlite();
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;
    CREATE TABLE app_identities(id uuid PRIMARY KEY,canonical_email text,status text,revision bigint);
    CREATE TABLE brands(id uuid PRIMARY KEY,owner_email text,name text,revision bigint,workspace_id uuid);
    CREATE TABLE brand_members(brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,email text,role text,name text,UNIQUE(brand_id,email));
    CREATE TABLE boards(id uuid PRIMARY KEY,brand_id uuid REFERENCES brands(id),workspace_id uuid,name text,canvas_json jsonb,updated_at timestamptz,owner_id text,owner_email text);
    CREATE TABLE board_editors(board_id uuid,email text,role text);`);
  await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)',[I,EMAIL,'active']);
  await pg.query('INSERT INTO brands VALUES ($1,$2,$3,1,$4)',[B,EMAIL,'Invented Brand',W]);
  await pg.query('INSERT INTO brands VALUES ($1,$2,$3,1,$4)',[OTHER,EMAIL,'Other Brand',W]);
  const canvas={nodes:[{id:'node-1',type:'Content',title:'Saved title',content:'Never extract hidden content'}]};
  async function board(){await pg.query('INSERT INTO boards VALUES ($1,$2,$3,$4,$5::jsonb,$6,NULL,$7)',[BOARD,B,W,'Saved Board',JSON.stringify(canvas),time,EMAIL]);}
  await board();
  for(const file of ['20261011_bw36_17_governed_brand_learnings.sql','20261011_bw36_17r1_learning_provenance_schema.sql','20261012_bw36_17r2_learning_provenance_recovery.sql'])await pg.exec(fs.readFileSync(`migrations/${file}`,'utf8'));
  const queries=[];
  let failEvent=false;
  const db={connect:async()=>({query:(q,a)=>{queries.push(q);if(failEvent && q.includes('INSERT INTO public.brand_learning_events'))throw new Error('Injected event failure');return pg.query(q,a);},release(){}})};
  const user={email:EMAIL};
  const preview=(src=source,u=user,brandId=B)=>service.previewSource({db,user:u,brandId,source:src});
  const run=(input,u=user)=>service.operate({db,user:u,brandId:B,input});
  const create=(statement,src=source,rev='1')=>run(service.inputRequest({statement,evidence_summary:'Human evidence',expected_brand_revision:rev,...(src?{source:src}:{})},true));
  const act=(row,action,more={})=>run(service.inputRequest({action,learning_id:row.id,expected_revision:row.revision,...more},false));
  const deny=(fn,code)=>assert.rejects(fn,e=>e.code===code);
  const count=async()=>Number((await pg.query('SELECT count(*) n FROM brand_learnings')).rows[0].n);
  try {
    await test('strict optional source contract; text IDs preserved; forged metadata/PATCH replacement rejected',async()=>{
      for(const src of [null,{},[],{...source,title:'Forged'},{...source,node_id:''},{...source,node_id:'x'.repeat(201)},{...source,node_id:'\ud800'},{...source,expected_board_updated_at:'today'},{...source,board_id:'wrong'}])assert.throws(()=>service.inputRequest({statement:'Human',expected_brand_revision:'1',source:src},true));
      assert.equal(service.sourceRequest(source).node_id,'node-1');
      const exact=(await preview({...source,expected_board_updated_at:'2026-10-12T10:00:00.123Z'})).source.expected_board_updated_at;assert.equal(exact,time);
      for(const method of ['GET','POST']) {const r=learningRuntime(),out=await r.request(method,`/api/brands/${B}/learning-source?${new URLSearchParams({...source,public_token:'forged'})}`);assert.equal(out.statusCode,method==='GET'?400:405);}
      assert.throws(()=>service.inputRequest({action:'edit',learning_id:B,expected_revision:'0',statement:'New',source},false));
    });
    await test('owner/admin/editor preview and write; viewer/Board-only/Workspace-only deny',async()=>{
      for(const role of ['owner','admin','editor']){
        await pg.query('UPDATE brands SET owner_email=$1 WHERE id=$2',[role==='owner'?EMAIL:'other@example.test',B]);
        await pg.query('DELETE FROM brand_members');
        if(role!=='owner')await pg.query('INSERT INTO brand_members VALUES ($1,$2,$3,NULL)',[B,EMAIL,role]);
        const p=await preview();assert.equal(p.brand.name,'Invented Brand');assert.equal(p.node_title,'Saved title');assert(!JSON.stringify(p).includes('Never extract'));
        assert.equal((await create(`Role ${role}`)).learning.status,'proposed');
      }
      await pg.query("UPDATE brand_members SET role='viewer'");await deny(()=>preview(),'BRAND_ACCESS_DENIED');await deny(()=>create('Viewer'),'BRAND_ACCESS_DENIED');
      await pg.query('DELETE FROM brand_members');await pg.query('INSERT INTO board_editors VALUES ($1,$2,$3)',[BOARD,EMAIL,'editor']);
      await deny(()=>preview(),'BRAND_UNAVAILABLE');await deny(()=>create('Board only'),'BRAND_UNAVAILABLE');
      await pg.query('DELETE FROM board_editors');await deny(()=>create('Workspace only'),'BRAND_UNAVAILABLE');
      await pg.query('UPDATE brands SET owner_email=$1 WHERE id=$2',[EMAIL,B]);
    });
    await test('save-time access revocation is independently revalidated after preview',async()=>{
      await preview();await pg.query('UPDATE brands SET owner_email=$1 WHERE id=$2',['other@example.test',B]);await pg.query('INSERT INTO brand_members VALUES ($1,$2,$3,NULL)',[B,EMAIL,'editor']);
      await preview();await pg.query("UPDATE brand_members SET role='viewer'");await deny(()=>create('Revoked at save'),'BRAND_ACCESS_DENIED');
      await pg.query('DELETE FROM brand_members');await pg.query('UPDATE brands SET owner_email=$1 WHERE id=$2',[EMAIL,B]);
    });
    await test('invalid/ambiguous identity and anonymous/public token denial',async()=>{
      await deny(()=>preview(source,null),'AUTHENTICATION_REQUIRED');
      await pg.query("UPDATE app_identities SET status='disabled'");await deny(()=>preview(),'IDENTITY_INVALID');
      await pg.query("UPDATE app_identities SET status='active'");
      await pg.query('INSERT INTO app_identities VALUES ($1,$2,$3,1)',[OTHER,EMAIL,'active']);await deny(()=>preview(),'IDENTITY_INVALID');await pg.query('DELETE FROM app_identities WHERE id=$1',[OTHER]);
      const r=learningRuntime();for(const path of [`/api/brands/${B}/learning-source?public_token=forged`,`/api/brands/${B}/learnings?public_token=forged`]){const out=await r.request('GET',path,null,null);assert.equal(out.statusCode,401);}
    });
    await test('forged Board/Brand/Node, missing/duplicate nodes, wrong Workspace, stale timestamps/revisions roll back',async()=>{
      const before=await count();
      await deny(()=>preview({...source,board_id:OTHER}),'SOURCE_UNAVAILABLE');
      await deny(()=>preview(source,user,OTHER),'SOURCE_UNAVAILABLE');
      await deny(()=>create('Missing',{...source,node_id:'missing'}),'SOURCE_UNAVAILABLE');
      await pg.query('UPDATE boards SET workspace_id=$1',[OTHER]);await deny(()=>create('Workspace forged'),'SOURCE_UNAVAILABLE');await pg.query('UPDATE boards SET workspace_id=$1',[W]);
      await pg.query('UPDATE boards SET canvas_json=$1::jsonb',[JSON.stringify({nodes:[...canvas.nodes,...canvas.nodes]})]);await deny(()=>create('Ambiguous'),'SOURCE_UNAVAILABLE');
      await pg.query('UPDATE boards SET canvas_json=$1::jsonb',[JSON.stringify(canvas)]);
      await deny(()=>create('Stale',{...source,expected_board_updated_at:'2026-10-12T10:00:00.123Z'}),'STALE_SOURCE');
      await deny(()=>create('Stale Brand',source,'0'),'STALE_BRAND_REVISION');assert.equal(await count(),before);
      assert(queries.some(q=>q.includes('FOR SHARE NOWAIT')));
    });
    await test('unsupported and malformed persisted source data fails closed without Canvas writes',async()=>{
      for(const nodes of [[],[{id:'node-1',type:'Unsupported',title:'x'}],[{id:'node-1',type:'Content',title:{nested:'payload'}}]]){await pg.query('UPDATE boards SET canvas_json=$1::jsonb',[JSON.stringify({nodes})]);await deny(()=>create('Invalid saved source'),'SOURCE_UNAVAILABLE');}
      await pg.query('UPDATE boards SET canvas_json=$1::jsonb',[JSON.stringify(canvas)]);
    });
    let learning;
    await test('exact immutable text provenance and bounded R2 event snapshots, duplicate protection, event rollback',async()=>{
      learning=(await create('Manual source observation')).learning;
      const row=(await pg.query('SELECT * FROM brand_learnings WHERE id=$1',[learning.id])).rows[0];
      assert.equal(row.source_node_id,'node-1');assert.equal(row.source_board_id,BOARD);assert.equal(row.source_node_title_snapshot,'Saved title');assert.equal(row.source_type,'campaign_observation');assert.equal(String(row.revision),'0');assert.equal(row.reviewed_by_identity_id,null);
      const event=(await pg.query('SELECT snapshot FROM brand_learning_events WHERE learning_id=$1',[learning.id])).rows[0].snapshot;
      assert.equal(event.source_board_id,BOARD);assert(!Object.hasOwn(event,'source_node_id'));
      assert.equal(learning.source_context.node_title,'Saved title');assert(!Object.hasOwn(learning,'source_node_id'));
      await deny(()=>create(' MANUAL source observation '),'DUPLICATE_PROPOSAL');
      const before=await count();failEvent=true;await assert.rejects(()=>create('Rollback'));failEvent=false;assert.equal(await count(),before);
      await assert.rejects(()=>pg.query("UPDATE brand_learnings SET source_node_id='node-2',revision=revision+1 WHERE id=$1",[learning.id]));
    });
    await test('Node deletion hides current context while human review remains available',async()=>{
      const review=(await create('Review after Node deletion')).learning;await pg.query('UPDATE boards SET canvas_json=$1::jsonb',[JSON.stringify({nodes:[]})]);
      assert.equal((await act(review,'reject')).learning.status,'rejected');const library=await run();assert.equal(library.learnings.find(l=>l.id===review.id).source_context.available,false);
      await pg.query('UPDATE boards SET canvas_json=$1::jsonb',[JSON.stringify(canvas)]);
    });
    await test('safe current source projections suppress labels after reassociation/deletion; stored origin intact',async()=>{
      await pg.query('UPDATE boards SET brand_id=$1',[OTHER]);let r=await run();assert.equal(JSON.stringify(r.learnings.find(l=>l.id===learning.id).source_context),JSON.stringify({available:false}));assert(!JSON.stringify(r).includes('Saved title'));
      await pg.query('UPDATE boards SET brand_id=$1',[B]);
      // Brand viewer retains read under the existing Board contract, but losing Brand access denies the entire library.
      await pg.query('UPDATE brands SET owner_email=$1 WHERE id=$2',['other@example.test',B]);await deny(()=>run(),'BRAND_UNAVAILABLE');await pg.query('UPDATE brands SET owner_email=$1 WHERE id=$2',[EMAIL,B]);
      await pg.query('DELETE FROM boards');r=await run();assert.equal(JSON.stringify(r.learnings.find(l=>l.id===learning.id).source_context),JSON.stringify({available:false}));
      assert.equal((await pg.query('SELECT source_node_id FROM brand_learnings WHERE id=$1',[learning.id])).rows[0].source_node_id,'node-1');
    });
    await test('review/edit/successor after source deletion copy original provenance atomically',async()=>{
      learning=(await act(learning,'approve')).learning;
      const successor=(await act(learning,'edit',{statement:'Human successor'})).learning;
      const prior=(await pg.query('SELECT * FROM brand_learnings WHERE id=$1',[learning.id])).rows[0],next=(await pg.query('SELECT * FROM brand_learnings WHERE id=$1',[successor.id])).rows[0];
      for(const key of ['source_type','source_board_id','source_node_id','source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'])assert.equal(next[key],prior[key]);
      failEvent=true;await assert.rejects(()=>act(successor,'approve'));failEvent=false;assert.equal((await pg.query('SELECT status FROM brand_learnings WHERE id=$1',[learning.id])).rows[0].status,'approved');
      const approved=(await act(successor,'approve')).learning;await act(approved,'archive');
      assert((await pg.query("SELECT snapshot FROM brand_learning_events")).rows.every(e=>!Object.hasOwn(e.snapshot,'source_node_id')));
    });
    await test('bounded derived snapshots; unchanged manual creation; post-activation checks and owned cascade',async()=>{
      await board();await pg.query('UPDATE boards SET name=$1,canvas_json=$2::jsonb',['B'.repeat(500),JSON.stringify({nodes:[{id:'node-1',type:'Content',title:'N'.repeat(500)}]})]);
      const result=await create('Bounded labels');assert.equal(result.learning.source_context.board_name.length,200);assert.equal(result.learning.source_context.node_title.length,300);
      const manual=(await create('Existing manual path',null)).learning;assert.equal(manual.source_type,'manual');assert(!manual.source_context);
      const verify=fs.readFileSync('scripts/sql/bw36-18-learning-provenance-verification.sql','utf8');const verification=(await pg.query(verify)).rows[0];assert.equal(verification.overall_readiness,'ok');
      await pg.query(`INSERT INTO brand_learnings(brand_id,statement,statement_key,proposed_by_identity_id,source_type,source_board_id,source_node_id,source_board_name_snapshot,source_node_title_snapshot,source_node_type_snapshot) VALUES ($1,'Unauthorized historical capture',$2,$3,'campaign_observation',$4,'node-1','Old Board','Old node','Content')`,[OTHER,service.statementKey('Unauthorized historical capture'),I,BOARD]);
      assert.equal((await pg.query(verify)).rows[0].overall_readiness,'not_ready');await pg.query('DELETE FROM brands WHERE id=$1',[OTHER]);
      await pg.query('DELETE FROM boards');await pg.query('DELETE FROM brands WHERE id=$1',[B]);assert.equal(await count(),0);assert.equal((await pg.query('SELECT count(*)::int n FROM brand_learning_events')).rows[0].n,0);
    });
  } finally {await pg.close();global.fetch=oldFetch;}
}
(async()=>{await databaseChecks();await require('./fixtures/bw36-18-browser').browserChecks();console.log(`PASS BW-36.18: ${checks} database/security groups and authenticated Chromium coverage`);})().catch(e=>{console.error(e);process.exitCode=1;});
