#!/usr/bin/env node
'use strict';
// Requires a dedicated disposable local PostgreSQL cluster; never POSTGRES_URL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const contract = require('../brand-write-contract');
const url = process.env.BW36_23_TEST_URL;
if (!url || !['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname) || process.env.BW36_23_DISPOSABLE !== '1') {
  console.error('BLOCKED: set BW36_23_TEST_URL to a disposable localhost PostgreSQL cluster and BW36_23_DISPOSABLE=1. No production fallback.'); process.exit(2);
}
const B=randomUUID(), B2=randomUUID(), I=randomUUID(), I2=randomUUID(), W=randomUUID(), email='fixture@example.test';
const migration=fs.readFileSync('migrations/20261020_bw36_23_brand_knowledge_protection.sql','utf8');
let groups=0;
async function check(name,fn){await fn();groups++;console.log('PASS '+name);}
(async()=>{
  const admin=new Client({connectionString:url});await admin.connect();
  const database='bw3623_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE DATABASE '+database);
  const testUrl=new URL(url);testUrl.pathname='/'+database;
  const root=new Client({connectionString:testUrl.href});await root.connect();
  const clients=[]; const loginPassword=randomUUID(); const login='bw3623_login_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE ROLE '+login+" LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '"+loginPassword+"'");
  let operator;
  try {
    for(const role of ['brand_knowledge_owner','brand_knowledge_runtime','anon','authenticated','service_role']) {
      if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await admin.query('CREATE ROLE '+role+' NOLOGIN NOSUPERUSER NOBYPASSRLS');
    }
    await admin.query('GRANT brand_knowledge_runtime TO '+login);
    await root.query(`CREATE TABLE app_identities(id uuid PRIMARY KEY,canonical_email text UNIQUE,status text,revision bigint DEFAULT 1);
      CREATE TABLE workspaces(id uuid PRIMARY KEY,status text);
      CREATE TABLE workspace_memberships(workspace_id uuid,identity_id uuid,role text,status text,PRIMARY KEY(workspace_id,identity_id));
      CREATE TABLE brands(id uuid PRIMARY KEY,owner_email text NOT NULL,name text NOT NULL,brand_core jsonb NOT NULL DEFAULT '{}',revision bigint NOT NULL DEFAULT 1,workspace_id uuid,logo_revision bigint NOT NULL DEFAULT 0,logo_object_path text,logo_mime_type text,logo_source text,logo_source_host text,logo_updated_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),future_column jsonb DEFAULT '{"retained":true}');
      ${fs.readFileSync('scripts/fixtures/bw20-existing-brand-members.sql','utf8')}
      CREATE TABLE boards(id uuid PRIMARY KEY,brand_id uuid REFERENCES brands(id),workspace_id uuid,brand_core_snapshot jsonb,updated_at timestamptz DEFAULT now());`);
    const initial={brandCore:'Original',brandDNA:{userApproved:true,future:{keep:'unknown'},avatar:{userApproved:true,imageUrl:'https://assets.example.test/original.png',metadata:{future:1}}},customTiles:[{id:'founder',text:'Story',unknown:true}],future:{nested:{value:42}},zero:0,bool:false};
    await root.query('INSERT INTO app_identities(id,canonical_email,status) VALUES($1,$2,\'active\'),($3,\'other@example.test\',\'active\')',[I,email,I2]);
    await root.query('INSERT INTO workspaces VALUES($1,\'active\')',[W]);
    await root.query('INSERT INTO workspace_memberships VALUES($1,$2,\'owner\',\'accepted\'),($1,$3,\'member\',\'accepted\')',[W,I,I2]);
    await root.query('INSERT INTO brands(id,workspace_id,owner_email,name,brand_core) VALUES($1,$2,$3,\'Fixture\',$4),($5,$2,\'other@example.test\',\'Other\',\'{}\')',[B,W,email,initial,B2]);
    await root.query('ALTER TABLE brands ENABLE ROW LEVEL SECURITY;ALTER TABLE brand_members ENABLE ROW LEVEL SECURITY;ALTER TABLE app_identities ENABLE ROW LEVEL SECURITY;ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;ALTER TABLE boards ENABLE ROW LEVEL SECURITY');
    const before=(await root.query('SELECT to_jsonb(b) AS row FROM brands b WHERE id=$1',[B])).rows[0].row;
    operator=await require('./fixtures/bw36-23-migration-operator')(root,testUrl.href,migration,check);
    if(process.env.BW36_23_LEGACY_INSTALL==='1')await operator.prepareLegacy();
    const verifyRoleGraph=await require('./fixtures/bw36-23-runtime-role-graph')(root,operator,migration,check);
    await check('migration and exact baseline preserve all existing values',async()=>{await operator.client.query(migration);const after=(await root.query('SELECT to_jsonb(b) AS row FROM brands b WHERE id=$1',[B])).rows[0].row;assert.deepEqual(after,{...before,knowledge_event_seq:0});const h=(await root.query('SELECT * FROM brand_knowledge_history WHERE brand_id=$1',[B])).rows[0];assert.deepEqual(h.before_state,h.after_state);assert.equal(h.operation_type,'baseline');});
    await verifyRoleGraph();
    await check('original membership uniqueness normalization roles foreign key and required columns survive migration',async()=>{
      await root.query("INSERT INTO brand_members(brand_id,email,role) VALUES($1,'unique@example.test','viewer')",[B2]);
      for(const [id,member,role,code] of [[B2,'unique@example.test','editor','23505'],[B2,'UPPER@example.test','viewer','23514'],[B2,'owner-role@example.test','owner','23514'],[randomUUID(),'foreign@example.test','viewer','23503'],[B2,null,'viewer','23502']]){
        await assert.rejects(()=>root.query('INSERT INTO brand_members(brand_id,email,role) VALUES($1,$2,$3)',[id,member,role]),e=>e.code===code);
      }
    });
    await check('exact migration rerun creates no extra baseline',async()=>{await operator.client.query(migration);assert.equal((await root.query('SELECT count(*)::int n FROM brand_knowledge_history')).rows[0].n,2);});
    await check('complete original companion verifier passes through SET-only operator',async()=>{await operator.verifyCore();await operator.assertLegacyRows();});
    await operator.noCreate();await operator.preserveCreate();
    const runtime=async()=>{const loginUrl=new URL(testUrl);loginUrl.username=login;loginUrl.password=loginPassword;const c=new Client({connectionString:loginUrl.href});await c.connect();clients.push(c);return c;};
    const a=await runtime(), b=await runtime();
    const row=async()=> (await root.query('SELECT to_jsonb(b) AS row FROM brands b WHERE id=$1',[B])).rows[0].row;
    const count=async()=> (await root.query('SELECT count(*)::int n FROM brand_knowledge_history WHERE brand_id=$1',[B])).rows[0].n;
    const cmd=async(draft,op='profile_edit')=>contract.command(await row(),draft,W,op);
    const run=async(command,{client=a,who=email,brand=B,review=null,preview=false}={})=>(await client.query('SELECT brand_knowledge_private.write_brand($1,$2,$3,$4,$5) outcome',[who,brand,command,review,preview])).rows[0].outcome;
    const review=command=>({command,email,brand_id:B,expires:Math.floor(Date.now()/1000)+300});
    const rejectsUnchanged=async(fn,pattern)=>{const old=await row(),n=await count();await assert.rejects(fn,pattern);assert.deepEqual(await row(),old);assert.equal(await count(),n);};
    await check('normal profile update retains DNA Avatar story unknown fields and future columns',async()=>{const c=await cmd({name:'Edited'});const result=await run(c);assert.equal(result.brand.name,'Edited');assert.deepEqual(result.brand.brand_core,initial);assert.deepEqual(result.brand.future_column,{retained:true});});
    await check('unknown nested scalar editing preserves siblings',async()=>{const c=await cmd({brand_core:{future:{nested:{value:43}}}});await run(c);assert.equal((await row()).brand_core.future.nested.value,43);assert.deepEqual((await row()).brand_core.brandDNA,initial.brandDNA);});
    for(const [name,value] of [['explicit null',null],['blank',' '],['empty array',[]],['empty object',{}]])await check(name+' requires bound review and rejected write is atomic',async()=>{const c=await cmd({brand_core:{brandDNA:value}});if(!c.changes.length)c.changes=[{path:'/brand_core/brandDNA',action:'clear',expected:{exists:true,value:(await row()).brand_core.brandDNA},value}];await rejectsUnchanged(()=>run(c),/DESTRUCTIVE_REVIEW_REQUIRED|AVATAR_DEPENDENCY/);});
    await check('nested subtree replacement requires review',async()=>{const old=await row();const c=await cmd({});c.changes=[{path:'/brand_core/future',action:'replace',expected:{exists:true,value:old.brand_core.future},value:{replacement:true}}];await rejectsUnchanged(()=>run(c),/DESTRUCTIVE_REVIEW_REQUIRED/);});
    await check('approval downgrade cannot hide accepted Avatar',async()=>{const c=await cmd({brand_core:{brandDNA:{userApproved:false}}});await rejectsUnchanged(()=>run(c,{review:review(c)}),/AVATAR_DEPENDENCY/);});
    await check('image replacement reviewed; original reference retained in preimage',async()=>{const c=await cmd({brand_core:{brandDNA:{avatar:{imageUrl:'https://assets.example.test/new.png'}}}},'accept_avatar');await rejectsUnchanged(()=>run(c),/DESTRUCTIVE_REVIEW_REQUIRED/);const result=await run(c,{review:review(c)});assert.equal(result.brand.brand_core.brandDNA.avatar.imageUrl,'https://assets.example.test/new.png');const event=(await root.query('SELECT before_state FROM brand_knowledge_history WHERE event_id=$1',[result.event_id])).rows[0];assert.equal(event.before_state.brand_core.brandDNA.avatar.imageUrl,initial.brandDNA.avatar.imageUrl);});
    await check('DNA acceptance retains Avatar and unknown siblings',async()=>{const old=(await row()).brand_core.brandDNA;const c=await cmd({brand_core:{brandDNA:{strategy:'Deliberate accepted strategy',userApproved:true}}},'accept_dna');await run(c);assert.deepEqual((await row()).brand_core.brandDNA.avatar,old.avatar);assert.deepEqual((await row()).brand_core.brandDNA.future,old.future);});
    await check('Founder Story atomic array review retains all unknown metadata',async()=>{const old=(await row()).brand_core.customTiles;const next=structuredClone(old);next[0].text='Edited founder story';const c=await cmd({brand_core:{customTiles:next}});await rejectsUnchanged(()=>run(c),/DESTRUCTIVE_REVIEW_REQUIRED/);await run(c,{review:review(c)});assert.equal((await row()).brand_core.customTiles[0].unknown,true);});
    await check('domain fill only absent or exactly empty paths',async()=>{const c=await cmd({brand_core:{website:'https://example.test'}},'domain_fill');c.changes.forEach(x=>x.action='fill_empty');await run(c);const bad=await cmd({brand_core:{website:'https://other.test'}},'domain_fill');bad.changes.forEach(x=>x.action='fill_empty');await rejectsUnchanged(()=>run(bad),/INVALID_FIELD_ACTION/);});
    await check('legacy payload rejected without changing data or history',async()=>{await rejectsUnchanged(()=>run({brand_core:{brandDNA:null},revision:1}),/WRITE_CONTRACT_REQUIRED/);});
    await check('stale revision rejected',async()=>{const c=await cmd({name:'Fresh'});await run(c);await rejectsUnchanged(()=>run({...c,mutation_id:randomUUID()}),/STALE_UPDATE/);});
    await check('concurrent connections serialize and one stale writer fails',async()=>{const c1=await cmd({name:'Concurrent one'}),c2=await cmd({name:'Concurrent two'});await a.query('BEGIN');await run(c1);const second=assert.rejects(run(c2,{client:b}),/STALE_UPDATE/);await a.query('COMMIT');await second;assert.equal((await row()).name,'Concurrent one');});
    await check('lost-response retry returns one durable receipt before revision check',async()=>{const c=await cmd({name:'Retry exactly'});const one=await run(c);const n=await count();const two=await run(c);assert.equal(two.event_id,one.event_id);assert.equal(two.replay,true);assert.equal(await count(),n);await rejectsUnchanged(()=>run({...c,changes:[]}),/IDEMPOTENCY_CONFLICT/);});
    await check('unauthorized identity viewer and Workspace mismatch fail atomically',async()=>{const c=await cmd({name:'Unauthorized'});await rejectsUnchanged(()=>run(c,{who:'other@example.test'}),/PERMISSION_DENIED/);await root.query('INSERT INTO brand_members(brand_id,email,role) VALUES($1,\'other@example.test\',\'viewer\')',[B]);await rejectsUnchanged(()=>run(c,{who:'other@example.test'}),/PERMISSION_DENIED/);await rejectsUnchanged(()=>run({...c,workspace_id:randomUUID()}),/WORKSPACE_CONTEXT_CHANGED/);});
    await check('membership revocation serializes with authorized writer',async()=>{await root.query("UPDATE brand_members SET role='editor' WHERE brand_id=$1",[B]);const c=await cmd({name:'Authorized before revoke'});await a.query('BEGIN');await run(c,{who:'other@example.test'});const revoke=root.query('DELETE FROM brand_members WHERE brand_id=$1',[B]);await a.query('COMMIT');await revoke;await rejectsUnchanged(async()=>run(await cmd({name:'After revoke'}),{who:'other@example.test'}),/PERMISSION_DENIED/);});
    await check('history insertion failure rolls canonical row back',async()=>{await root.query("ALTER TABLE brand_knowledge_history ADD CONSTRAINT injected_failure CHECK (operation_type='baseline') NOT VALID");await rejectsUnchanged(async()=>run(await cmd({name:'Must rollback'})),/injected_failure/);await root.query('ALTER TABLE brand_knowledge_history DROP CONSTRAINT injected_failure');});
    await check('explicit transaction rollback removes both canonical edit and event',async()=>{const old=await row(),n=await count();await a.query('BEGIN');await run(await cmd({name:'Rollback'}));await a.query('ROLLBACK');assert.deepEqual(await row(),old);assert.equal(await count(),n);});
    for(const role of ['brand_knowledge_runtime','anon','authenticated','service_role'])await check(role+' cannot bypass authority or alter history',async()=>{const c=role==='brand_knowledge_runtime'?a:await runtime();if(role!=='brand_knowledge_runtime'){await admin.query('GRANT '+role+' TO '+login);await c.query('SET ROLE '+role);}for(const q of ["UPDATE brands SET name='bypass'",'DELETE FROM brands','INSERT INTO brands(id,owner_email,name) VALUES(gen_random_uuid(),\'x\',\'bypass\')','UPDATE brand_knowledge_history SET operation_type=\'noop\'','DELETE FROM brand_knowledge_history','TRUNCATE brand_knowledge_history','TRUNCATE brands','ALTER TABLE brands DISABLE TRIGGER ALL','SELECT * FROM brand_knowledge_history'])await assert.rejects(()=>c.query(q));});
    await check('caller-written GUC does not authorize direct mutation',async()=>{await a.query("SELECT set_config('brand_knowledge.context','{}',false)");await rejectsUnchanged(()=>a.query("UPDATE brands SET name='bypass'"));});
    await check('composite source foreign key accepts same Brand and rejects cross Brand',async()=>{
      const foreign=(await root.query('SELECT event_id FROM brand_knowledge_history WHERE brand_id=$1 LIMIT 1',[B2])).rows[0].event_id;
      const own=(await root.query('SELECT event_id FROM brand_knowledge_history WHERE brand_id=$1 LIMIT 1',[B])).rows[0].event_id;
      const sql=`INSERT INTO brand_knowledge_history(brand_id,workspace_id,event_seq,previous_revision,result_revision,previous_logo_revision,result_logo_revision,actor_identity_id,operation_type,contract_version,mutation_id,request_digest,before_state,after_state,source_event_id)
        SELECT brand_id,workspace_id,999,previous_revision,result_revision,previous_logo_revision,result_logo_revision,$2,'noop',contract_version,gen_random_uuid(),request_digest,before_state,jsonb_set(after_state,'{knowledge_event_seq}','999'),$3 FROM brand_knowledge_history WHERE brand_id=$1 AND event_seq=0`;
      await assert.rejects(()=>root.query(sql,[B,I,foreign]),e=>e.constraint==='brand_history_source');
      await root.query('BEGIN');await root.query(sql,[B,I,own]);await root.query('ROLLBACK');
    });
    await check('creation history and coupled outer transaction roll back together',async()=>{const id=randomUUID();await a.query('BEGIN');await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'New','{}',id]);assert.equal((await root.query('SELECT 1 FROM brands WHERE id=$1',[id])).rowCount,0);await a.query('ROLLBACK');assert.equal((await root.query('SELECT 1 FROM brand_knowledge_history WHERE brand_id=$1',[id])).rowCount,0);});
    const lifecycle=async(id,command,reviewProof)=> (await a.query('SELECT brand_knowledge_private.lifecycle($1,$2,$3,$4) outcome',[email,id,command,reviewProof])).rows[0].outcome;
    await check('reviewed clear remove explicit null and false zero remain distinguishable',async()=>{
      const c=await cmd({brand_core:{temporary:'value'}});await run(c);
      const clear=await cmd({brand_core:{temporary:null}});await run(clear,{review:review(clear)});assert.equal((await row()).brand_core.temporary,null);
      const remove=await cmd({});remove.changes=[{path:'/brand_core/temporary',action:'remove',expected:{exists:true,value:null}}];await run(remove,{review:review(remove)});assert(!Object.hasOwn((await row()).brand_core,'temporary'));assert.equal((await row()).brand_core.zero,0);assert.equal((await row()).brand_core.bool,false);
    });
    await check('logo history shares sequence and retains Core revision; retry receipt is durable',async()=>{
      const old=await row();const command={contract:contract.CONTRACT,operation:'logo',workspace_id:W,expected_revision:String(old.revision),expected_logo_revision:old.logo_revision,mutation_id:randomUUID(),input_digest:'a'.repeat(64),metadata:{logo_object_path:B+'/1.png',logo_mime_type:'image/png',logo_source:'uploaded',logo_source_host:null}};
      const result=await lifecycle(B,command,review(command));assert.equal(result.brand.revision,old.revision);assert.equal(result.brand.logo_revision,old.logo_revision+1);assert.deepEqual(result.brand.brand_core,old.brand_core);
      const receipt=(await a.query('SELECT brand_knowledge_private.logo_receipt($1,$2,$3,$4) brand',[email,B,command.mutation_id,command.input_digest])).rows[0].brand;assert.deepEqual(receipt,result.brand);
      await rejectsUnchanged(()=>a.query('SELECT brand_knowledge_private.logo_receipt($1,$2,$3,$4)',[email,B,command.mutation_id,'b'.repeat(64)]),/IDEMPOTENCY_CONFLICT/);
    });
    await check('initialization binds current authorized associated Board and exactly empty Core',async()=>{
      const id=randomUUID(),board=randomUUID();await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Initialize','{}',id]);
      const snapshot={unknown:{retained:'source'},brandCore:'Approved initial source'};await root.query('INSERT INTO boards(id,brand_id,workspace_id,brand_core_snapshot) VALUES($1,$2,$3,$4)',[board,id,W,snapshot]);
      const command=contract.command({name:'Initialize',brand_core:{},revision:1},{brand_core:snapshot},W);command.operation='initialize';command.source={board_id:board,snapshot};
      await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const result=await run(command,{brand:id});await a.query('COMMIT');assert.deepEqual(result.brand.brand_core,snapshot);
      const again={...command,expected_revision:'2',mutation_id:randomUUID(),changes:[]};await assert.rejects(()=>run(again,{brand:id}),/INITIALIZATION_REQUIRES_EMPTY_CORE/);
      const wrong={...command,mutation_id:randomUUID(),source:{board_id:randomUUID(),snapshot}};await assert.rejects(()=>run(wrong,{brand:B2,who:'other@example.test'}));
    });
    async function initializationFixture(core={}) {
      const id=randomUUID(),board=randomUUID(),snapshot={brandCore:'Exact approved source',unknown:{keep:true}};
      await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Initialize safely',JSON.stringify(core),id]);
      await root.query('INSERT INTO boards(id,brand_id,workspace_id,brand_core_snapshot) VALUES($1,$2,$3,$4)',[board,id,W,snapshot]);
      const command=contract.command({name:'Initialize safely',revision:1,brand_core:core},{brand_core:snapshot},W);
      command.operation='initialize';command.source={board_id:board,snapshot};
      const state=async()=>({row:(await root.query('SELECT to_jsonb(b) value FROM brands b WHERE id=$1',[id])).rows[0].value,
        events:(await root.query('SELECT to_jsonb(h) value FROM brand_knowledge_history h WHERE brand_id=$1 ORDER BY event_seq',[id])).rows,
        board:(await root.query('SELECT to_jsonb(b) value FROM boards b WHERE id=$1',[board])).rows[0].value});
      async function submit(input=command) {await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');try{const result=await run(input,{brand:id});await a.query('COMMIT');return result;}catch(e){await a.query('ROLLBACK');throw e;}}
      return {id,board,snapshot,command,state,submit};
    }
    await check('initialization exact committed readback history and durable replay preserve the source Board',async()=>{
      const f=await initializationFixture(),before=await f.state();const result=await f.submit(),after=await f.state();
      assert.deepEqual(after.row.brand_core,f.snapshot);assert.deepEqual(result.brand,after.row);assert.deepEqual(after.board,before.board);
      assert.equal(after.events.length,2);assert.equal(after.events[1].value.operation_type,'initialize');
      assert.deepEqual(after.events[1].value.before_state,before.row);assert.deepEqual(after.events[1].value.after_state,after.row);
      const replay=await f.submit();assert.equal(replay.replay,true);assert.equal(replay.event_id,result.event_id);assert.deepEqual(await f.state(),after);
    });
    for(const core of [{brandDNA:null},{brandCore:'',personas:[]},{brandDNA:{userApproved:true,avatar:{userApproved:true,imageUrl:'https://fixture.test/keep.png'}}}])
      await check('default-only or populated Core cannot be initialized: '+JSON.stringify(core),async()=>{const f=await initializationFixture(core),before=await f.state();await assert.rejects(()=>f.submit(),/INITIALIZATION_REQUIRES_EMPTY_CORE/);assert.deepEqual(await f.state(),before);});
    await check('missing or null creation Core is rejected atomically rather than treated as empty',async()=>{
      for(const core of [null,'null']){const id=randomUUID();await assert.rejects(()=>a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Invalid empty',core,id]),/INVALID_BRAND_VALUES/);assert.equal((await root.query('SELECT 1 FROM brands WHERE id=$1',[id])).rowCount,0);assert.equal((await root.query('SELECT 1 FROM brand_knowledge_history WHERE brand_id=$1',[id])).rowCount,0);}
    });
    await check('initialization independently rejects missing cross-Brand and cross-Workspace source Boards',async()=>{
      const f=await initializationFixture();
      for(const change of [async()=>{f.command.source.board_id=randomUUID();},async()=>{f.command.source.board_id=f.board;await root.query('UPDATE boards SET brand_id=$2 WHERE id=$1',[f.board,B2]);},async()=>{await root.query('UPDATE boards SET brand_id=$2,workspace_id=$3 WHERE id=$1',[f.board,f.id,randomUUID()]);}]){
        await change();const before=await f.state();await assert.rejects(()=>f.submit(),/INITIALIZATION_SOURCE_CHANGED/);assert.deepEqual(await f.state(),before);
      }
    });
    await check('source snapshot changes and forged submitted snapshots reject initialization without writes',async()=>{
      const f=await initializationFixture();await root.query('UPDATE boards SET brand_core_snapshot=$2 WHERE id=$1',[f.board,{brandCore:'Changed source'}]);const before=await f.state();
      await assert.rejects(()=>f.submit(),/INITIALIZATION_SOURCE_CHANGED/);assert.deepEqual(await f.state(),before);
    });
    await check('independent restricted connections reject initialization made stale by a concurrent canonical edit',async()=>{
      const f=await initializationFixture();const rename=contract.command((await f.state()).row,{name:'Concurrent authorized rename'},W);
      await b.query('BEGIN');await run(rename,{client:b,brand:f.id});await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await a.query('SELECT txid_current_snapshot()');
      const pending=assert.rejects(run(f.command,{client:a,brand:f.id}),/serialize|STALE_UPDATE/);await b.query('COMMIT');await pending;await a.query('ROLLBACK');
      const after=await f.state();assert.deepEqual(after.row.brand_core,{});assert.equal(after.row.name,'Concurrent authorized rename');assert.equal(after.events.length,2);assert.equal(after.events[1].value.operation_type,'profile_edit');
    });
    await check('initialization history failure rolls back exact canonical state and leaves the source intact',async()=>{
      const f=await initializationFixture(),before=await f.state();await root.query("ALTER TABLE brand_knowledge_history ADD CONSTRAINT initialization_history_failure CHECK (operation_type<>'initialize') NOT VALID");
      try{await assert.rejects(()=>f.submit(),/initialization_history_failure/);assert.deepEqual(await f.state(),before);}finally{await root.query('ALTER TABLE brand_knowledge_history DROP CONSTRAINT initialization_history_failure');}
    });
    await check('Brand-only runtime has no implicit Board write grant and failed Project transaction rolls back',async()=>{
      const id=randomUUID();await a.query('BEGIN');await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'No Board grant','{}',id]);
      await assert.rejects(()=>a.query('INSERT INTO boards(id,brand_id,workspace_id) VALUES($1,$2,$3)',[randomUUID(),id,W]),e=>e.code==='42501');await a.query('ROLLBACK');
      assert.equal((await root.query('SELECT 1 FROM brands WHERE id=$1',[id])).rowCount,0);assert.equal((await root.query('SELECT 1 FROM brand_knowledge_history WHERE brand_id=$1',[id])).rowCount,0);
    });
    // Disposable fixture only: model the separately provisioned existing Board permission.
    // Production role/grant compatibility remains an explicit cutover gate.
    await root.query('GRANT INSERT ON public.boards TO '+login);
    await root.query("CREATE POLICY disposable_project_insert ON public.boards FOR INSERT TO "+login+" WITH CHECK (workspace_id='"+W+"'::uuid AND EXISTS(SELECT 1 FROM public.brands b WHERE b.id=brand_id AND b.owner_email='fixture@example.test'))");
    await check('protected creation and real Board insert commit together with exact identities and history',async()=>{
      const id=randomUUID(),board=randomUUID(),snapshot={unknown:{preserved:true}};
      await a.query('BEGIN');const created=(await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6) brand',[email,id,W,'Atomic Project',snapshot,id])).rows[0].brand;
      await a.query('INSERT INTO boards(id,brand_id,workspace_id,brand_core_snapshot) VALUES($1,$2,$3,$4)',[board,created.id,created.workspace_id,created.brand_core]);await a.query('COMMIT');
      const row=(await root.query('SELECT * FROM boards WHERE id=$1',[board])).rows[0];assert.equal(row.brand_id,id);assert.equal(row.workspace_id,W);assert.deepEqual(row.brand_core_snapshot,snapshot);
      const h=(await root.query('SELECT * FROM brand_knowledge_history WHERE brand_id=$1',[id])).rows;assert.equal(h.length,1);assert.equal(h[0].operation_type,'create');assert.deepEqual(h[0].after_state,created);
    });
    await check('real Board insertion failure cannot leave a partial Brand or creation history',async()=>{
      const id=randomUUID();await a.query('BEGIN');await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Must rollback','{}',id]);
      const existingBoard=(await root.query('SELECT id FROM boards LIMIT 1')).rows[0].id;
      await assert.rejects(()=>a.query('INSERT INTO boards(id,brand_id,workspace_id) VALUES($1,$2,$3)',[existingBoard,id,W]),e=>e.code==='23505');await a.query('ROLLBACK');
      assert.equal((await root.query('SELECT 1 FROM brands WHERE id=$1',[id])).rowCount,0);assert.equal((await root.query('SELECT 1 FROM brand_knowledge_history WHERE brand_id=$1',[id])).rowCount,0);
    });
    await check('logo history failure rolls back metadata revisions and full canonical knowledge',async()=>{
      const old=await row(),command={contract:contract.CONTRACT,operation:'logo',workspace_id:W,expected_revision:String(old.revision),expected_logo_revision:old.logo_revision,mutation_id:randomUUID(),input_digest:'c'.repeat(64),metadata:{logo_object_path:B+'/99.png',logo_mime_type:'image/png',logo_source:'uploaded',logo_source_host:null}};
      await root.query("ALTER TABLE brand_knowledge_history ADD CONSTRAINT logo_history_failure CHECK (operation_type<>'logo') NOT VALID");
      try{await rejectsUnchanged(()=>lifecycle(B,command,review(command)),/logo_history_failure/);}finally{await root.query('ALTER TABLE brand_knowledge_history DROP CONSTRAINT logo_history_failure');}
    });
    await check('initialization denial independently enforces actor Brand and Workspace authorization',async()=>{
      const f=await initializationFixture(),before=await f.state();await assert.rejects(()=>run(f.command,{brand:f.id,who:'other@example.test'}),/PERMISSION_DENIED/);
      await assert.rejects(()=>f.submit({...f.command,workspace_id:randomUUID()}),/WORKSPACE_CONTEXT_CHANGED/);assert.deepEqual(await f.state(),before);
    });
    await check('associated-Board delete denial returns only an authorized validated project count',async()=>{
      const f=await initializationFixture(),before=await f.state(),command={contract:contract.CONTRACT,operation:'delete',workspace_id:W,expected_revision:'1',expected_logo_revision:0,mutation_id:randomUUID(),confirmation_name:'Initialize safely'};
      await assert.rejects(()=>lifecycle(f.id,command,{...review(command),brand_id:f.id}),e=>{assert.equal(e.message,'BRAND_IN_USE');assert.deepEqual(JSON.parse(e.detail),{boardCount:1});return true;});assert.deepEqual(await f.state(),before);
      const mapped=require('../api/_brand-knowledge-write').mapError(Object.assign(new Error('BRAND_IN_USE'),{detail:'{"boardCount":1,"private":"redacted"}'}));assert.equal(mapped.status,409);assert.equal(mapped.boardCount,1);assert(!JSON.stringify(mapped).includes('redacted'));
    });
    await check('delete lifecycle retains history and authorizes original actor retry',async()=>{
      const id=randomUUID();await a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Delete fixture','{}',id]);
      await root.query("INSERT INTO brand_members(brand_id,email,role) VALUES($1,'deleted-member@example.test','viewer')",[id]);
      const command={contract:contract.CONTRACT,operation:'delete',workspace_id:W,expected_revision:'1',expected_logo_revision:0,mutation_id:randomUUID(),confirmation_name:'Delete fixture'};
      const proof={...review(command),brand_id:id};const result=await lifecycle(id,command,proof);assert.equal(result.deleted,true);
      assert.equal((await root.query('SELECT 1 FROM brand_members WHERE brand_id=$1',[id])).rowCount,0);
      assert.equal((await root.query('SELECT count(*)::int n FROM brand_knowledge_history WHERE brand_id=$1',[id])).rows[0].n,2);
      assert.equal((await lifecycle(id,command,proof)).replay,true);
      await assert.rejects(()=>a.query('SELECT brand_knowledge_private.lifecycle($1,$2,$3,$4)',['other@example.test',id,command,proof]),/BRAND_NOT_FOUND/);
      await assert.rejects(()=>a.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Reuse','{}',randomUUID()]),/BRAND_ID_REUSE_DENIED/);
    });
    await check('expired review token proof cannot authorize a new destructive write',async()=>{const c=await cmd({brand_core:{brandCore:''}});await rejectsUnchanged(()=>run(c,{review:{...review(c),expires:1}}),/DESTRUCTIVE_REVIEW_REQUIRED/);});
    await check('database rejects malformed missing revision and future prototype payload',async()=>{const c=await cmd({name:'Invalid'});delete c.expected_revision;await rejectsUnchanged(()=>run(c),/INVALID_WRITE_CONTRACT/);const bad=await cmd({});bad.changes=[{path:'/brand_core/payload',action:'add',expected:{exists:false},value:JSON.parse('{"constructor":{"polluted":true}}')}];await rejectsUnchanged(()=>run(bad),/INVALID_JSON_KEY/);});
    await check('expired token can resolve exact committed receipt but never a new mutation',async()=>{
      const service=require('../api/_brand-knowledge-write');process.env.BRAND_KNOWLEDGE_REVIEW_KEY='local-fixture-only-review-signing-key';
      const command=await cmd({brand_core:{brandCore:''}});const token=service.signReview({...service.proof(email,B,command),expires:1});
      await run(command,{review:review(command)});const n=await count();
      const db={connect:async()=>({query:(q,args)=>a.query(q,args),release(){}})};
      assert.equal((await service.write({db,user:{email},brandId:B,input:command,token})).replay,true);assert.equal(await count(),n);
      const fresh=await cmd({brand_core:{brandCore:'New'}});const expired=service.signReview({...service.proof(email,B,fresh),expires:1});
      await rejectsUnchanged(()=>service.write({db,user:{email},brandId:B,input:fresh,token:expired}),/INVALID_REVIEW/);
    });
    await check('real logo HTTP receipt-only replay verifies the committed request without upload or another mutation',async()=>{
      const old=await row(),requestId=randomUUID(),input={contract:'brand_logo_v1',action:'upload',workspace_id:W,expected_revision:old.logo_revision,request_id:requestId,mime_type:'image/png',image_base64:'fixture-only-never-uploaded'};
      const {createHash}=require('node:crypto');const hex=createHash('sha256').update(JSON.stringify([B,email,requestId])).digest('hex');
      const mutationId=hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
      const command={contract:contract.CONTRACT,operation:'logo',workspace_id:W,expected_revision:String(old.revision),expected_logo_revision:old.logo_revision,mutation_id:mutationId,input_digest:createHash('sha256').update(contract.stable(input)).digest('hex'),metadata:{logo_object_path:B+'/100.png',logo_mime_type:'image/png',logo_source:'uploaded',logo_source_host:null}};
      const committed=await lifecycle(B,command,review(command)),n=await count();
      const loginUrl=new URL(testUrl);loginUrl.username=login;loginUrl.password=loginPassword;process.env.POSTGRES_URL=loginUrl.href;process.env.AUTH_SECRET='local-fixture-only-auth-secret';
      const handler=require('../api/brands/[id]/logo'),{createSessionToken}=require('../api/_auth-session');
      const call=async(body,user={email})=>{const req={method:'POST',query:{id:B},body,headers:{'x-brand-receipt-only':'1',cookie:user?'funklix_session='+createSessionToken(user):''}};const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await handler(req,res);return res;};
      const response=await call(input);assert.equal(response.statusCode,200);assert.equal(response.body.replay,true);assert.equal(response.body.request_id,requestId);assert.equal(response.body.logo.logo_revision,old.logo_revision+1);assert(!JSON.stringify(response.body).includes('logo_object_path'));
      assert.equal((await call({...input,request_id:randomUUID(),expected_revision:old.logo_revision+1})).body.error.code,'RECEIPT_NOT_FOUND');
      assert.equal((await call({...input,image_base64:'changed'})).statusCode,409);assert.equal((await call(input,{email:'other@example.test'})).statusCode,403);assert.equal((await call(input,null)).statusCode,401);
      assert.deepEqual(await row(),committed.brand);assert.equal(await count(),n);assert.deepEqual((await row()).brand_core,old.brand_core);
    });
    await check('production HTTP handler uses verified session and compatible authoritative response',async()=>{
      const loginUrl=new URL(testUrl);loginUrl.username=login;loginUrl.password=loginPassword;process.env.POSTGRES_URL=loginUrl.href;process.env.AUTH_SECRET='local-fixture-only-auth-secret';
      const handler=require('../api/brands/[id]'),{createSessionToken}=require('../api/_auth-session');
      const call=async(input,user)=>{const req={method:'PUT',query:{id:B},body:input,headers:{cookie:user?'funklix_session='+createSessionToken(user):''}};const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await handler(req,res);return res;};
      const command=await cmd({name:'HTTP accepted'});const response=await call(command,{email});assert.equal(response.statusCode,200);assert.equal(response.body.id,B);assert.equal(response.body.name,'HTTP accepted');assert.equal(response.body.contract,contract.CONTRACT);assert(response.body.event_id);assert.equal(response.body.access.canEditCanonicalBrand,true);
      assert.equal((await call(command,null)).statusCode,401);assert.equal((await call({name:'Legacy',brand_core:{brandDNA:null},revision:1},{email})).statusCode,428);
      await require('../api/_boards-storage').pool.end();
    });
    await check('migration detects installed catalog drift and rolls back',async()=>{await root.query('ALTER TABLE brand_knowledge_history ADD COLUMN unexpected text');await assert.rejects(()=>root.query(migration),/PROTECTION_CATALOG_DRIFT/);await root.query('ROLLBACK');await root.query('ALTER TABLE brand_knowledge_history DROP COLUMN unexpected');});
    await check('non-destructive list append needs no review and retains old unknown metadata',async()=>{const old=(await row()).brand_core.customTiles;const result=await run(await cmd({brand_core:{customTiles:[...old,{id:'new',text:'New accepted text'}]}}));assert.deepEqual(result.brand.brand_core.customTiles.slice(0,old.length),old);});
    await check('no-op command records a receipt without incrementing Core revision',async()=>{const old=await row(),n=await count();const result=await run(await cmd({}));assert.equal(result.brand.revision,old.revision);assert.equal(result.brand.knowledge_event_seq,old.knowledge_event_seq+1);assert.equal(await count(),n+1);});
    await check('runtime LOGIN cannot assume the NOLOGIN function owner',async()=>{await assert.rejects(()=>a.query('SET ROLE brand_knowledge_owner'),/permission denied/);assert.equal((await a.query('SELECT current_user')).rows[0].current_user,login);});
    await check('logo and Core writers interleave without losing metadata',async()=>{
      const old=await row(),c=await cmd({name:'After logo'}),logo={contract:contract.CONTRACT,operation:'logo',workspace_id:W,expected_revision:String(old.revision),expected_logo_revision:old.logo_revision,mutation_id:randomUUID(),input_digest:'c'.repeat(64),metadata:{logo_object_path:B+'/2.png',logo_mime_type:'image/png',logo_source:'uploaded',logo_source_host:null}};
      await a.query('BEGIN');await lifecycle(B,logo,review(logo));const coreWrite=run(c,{client:b});await a.query('COMMIT');await coreWrite;const current=await row();assert.equal(current.logo_object_path,B+'/2.png');assert.equal(current.logo_revision,old.logo_revision+1);assert.equal(current.revision,old.revision+1);
    });
    await check('source_event_id null for ordinary events; no event gaps or history-only changes',async()=>{assert.equal((await root.query('SELECT count(*)::int n FROM brand_knowledge_history WHERE source_event_id IS NOT NULL')).rows[0].n,0);const state=await row(),events=(await root.query('SELECT event_seq,after_state FROM brand_knowledge_history WHERE brand_id=$1 ORDER BY event_seq',[B])).rows;events.forEach((e,i)=>assert.equal(Number(e.event_seq),i));assert.deepEqual(events.at(-1).after_state,state);});
    console.log(groups+' real PostgreSQL groups passed (restricted roles, independent connections; disposable fixtures only).');
  } finally {for(const c of clients)await c.end();if(operator)await operator.close();await root.end();await admin.query('DROP DATABASE '+database+' WITH (FORCE)');await admin.query('DROP ROLE '+login);if(operator)await operator.drop(admin);await admin.query('REVOKE brand_knowledge_runtime FROM postgres CASCADE');await admin.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});
