#!/usr/bin/env node
'use strict';
// Destructive fixtures are guarded to a disposable local cluster. No production fallback.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {randomUUID,randomBytes}=require('node:crypto'),{Client,Pool}=require('pg');
const url=process.env.BW36_23_TEST_URL;
if(!url||!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname)||process.env.BW36_23_DISPOSABLE!=='1'){
 console.error('BLOCKED: explicit disposable localhost PostgreSQL required');process.exit(2);
}
const read=f=>fs.readFileSync(f,'utf8'),prefix='migrations/20261021_bw36_23a_restricted_runtime_access';
const sql=read(prefix+'.sql'),verify=read(prefix+'.verify.sql'),core=read('migrations/20261020_bw36_23_brand_knowledge_protection.sql');
let groups=0;async function check(name,fn){await fn();console.log('PASS '+name);groups++;}
(async()=>{
 const admin=new Client({connectionString:url});await admin.connect();
 const dbname='bw3623r3_'+randomBytes(8).toString('hex');await admin.query('CREATE DATABASE '+dbname);
 const local=new URL(url);local.pathname='/'+dbname;const root=new Client({connectionString:local.href});await root.connect();
 const roles=['brand_knowledge_owner','brand_knowledge_runtime','tendra_app_runtime','anon','authenticated','service_role'];
 let db,other,operator;const clients=[];
 try{
  // Dedicated local cluster prerequisite; never alter an existing production login.
  for(const role of roles)if(!(await admin.query('SELECT FROM pg_roles WHERE rolname=$1',[role])).rowCount)await admin.query('CREATE ROLE '+role+' NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION');
  const password=randomBytes(32).toString('hex');
  await admin.query("ALTER ROLE tendra_app_runtime LOGIN INHERIT PASSWORD '"+password+"'");
  await admin.query('GRANT brand_knowledge_runtime TO tendra_app_runtime WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
  await root.query(`CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(id uuid,bucket_id text); CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE brands(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_email text NOT NULL,name text NOT NULL,
    brand_core jsonb NOT NULL DEFAULT '{}',revision bigint NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());`);
  await root.query(read('scripts/fixtures/bw36-23a-r3-boards.sql'));
  await root.query(read('scripts/fixtures/bw20-existing-brand-members.sql'));
  for(const file of ['20260928_bw36_6_workspace_schema_foundation.sql','20260929_bw36_7r2_application_identity_bridge.sql','20261001_bw36_12_brand_logo.sql','20261006_bw36_13r3_project_commands.sql','20261011_bw36_17_governed_brand_learnings.sql','20261011_bw36_17r1_learning_provenance_schema.sql','20261012_bw36_17r2_learning_provenance_recovery.sql'])await root.query(read('migrations/'+file));
  await require('../api/social-connector/schema').migrate({query:(...args)=>root.query(...args)});
  // Historical document schema snapshot was previously materialized by lazy startup.
  const ddl=sql.slice(sql.indexOf('    CREATE TABLE IF NOT EXISTS brand_documents'),sql.indexOf('DO $schema$'));
  await root.query(ddl);
  await root.query(read('migrations/20260911_bw33_5_supabase_rls_hardening.sql'));
  await root.query(read('migrations/20260914_bw33_5_1_social_publishing_destinations_rls.sql'));
  const denies=(await root.query("SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE roles && ARRAY['anon','authenticated']::name[] ORDER BY tablename,policyname")).rows;
  operator=await require('./fixtures/bw36-23-migration-operator')(root,local.href,core,check);
  if(process.env.BW36_23_LEGACY_INSTALL==='1')await operator.prepareLegacy(sql);
  await require('./fixtures/bw36-23a-runtime-role-graph').prepare(root,operator,core,check,local.href);
  await check('complete original migration and companion verifier through SET-only operator',async()=>{await operator.client.query(core);await operator.verifyCore();await operator.assertLegacyRows();});await operator.noCreate();await operator.preserveCreate();
  await check('late R3 failure rolls back schema function grants and policies',async()=>{
    const before=await operator.snapshot();
    await assert.rejects(()=>operator.client.query(sql.replace(/COMMIT;\s*$/,()=>"DO $$ BEGIN RAISE EXCEPTION 'HOTFIX_R3_FAILURE'; END $$; COMMIT;")),/HOTFIX_R3_FAILURE/);
    await operator.client.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);await operator.noCreate();
  });
  await check('existing migration chain + protected Core + additive runtime install',()=>operator.client.query(sql));
  await check('complete R3 companion verifier and original verifier through SET-only operator',async()=>{await operator.client.query(verify);await operator.verifyCore();});
  await require('./fixtures/bw36-23a-runtime-role-graph').postgresChain(root,local.href,core,sql,verify,check);
  await check('idempotent runtime install and private protection fingerprint remain compatible',async()=>{await operator.client.query(sql);await operator.client.query(core);await operator.noCreate();await root.query(verify);await operator.verifyCore();});
  await check('existing anon/authenticated deny policies remain identical',async()=>assert.deepEqual((await root.query("SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE roles && ARRAY['anon','authenticated']::name[] ORDER BY tablename,policyname")).rows,denies));
  local.username='tendra_app_runtime';local.password=password;
  db=new Pool({connectionString:local.href,max:5});other=new Client({connectionString:local.href});await other.connect();
  process.env.POSTGRES_URL=local.href;process.env.AUTH_SECRET=randomBytes(32).toString('hex');process.env.BRAND_KNOWLEDGE_REVIEW_KEY=randomBytes(32).toString('hex');
  await check('real password login with inherited grants and full fail-closed verification',async()=>{const r=(await db.query('SELECT session_user,current_user')).rows[0];assert.equal(r.session_user,'tendra_app_runtime');assert.equal(r.current_user,'tendra_app_runtime');await db.query(verify);});
  await require('./fixtures/bw36-23a-runtime-role-graph').unsafe(root,operator,core,sql,verify,check);
  const denied=(q,args)=>assert.rejects(()=>db.query(q,args),e=>e.code==='42501');
  await check('runtime has no direct Brand writes, history access, owner role or DDL',async()=>{
   for(const q of ["INSERT INTO brands(name,owner_email) VALUES('bad','bad@test')","UPDATE brands SET name='bad'","DELETE FROM brands","SELECT * FROM brand_knowledge_history","UPDATE brand_knowledge_history SET intent='[]'","DELETE FROM brand_knowledge_history","TRUNCATE brands","SET ROLE brand_knowledge_owner","SET ROLE brand_knowledge_runtime","CREATE TABLE public.runtime_ddl_bad(id int)"])await denied(q);
  });
  await check('Board/document/social initialization uses real read-only runtime checks',async()=>{
   const c=await db.connect();try{await c.query('BEGIN READ ONLY');await require('../api/_runtime-schema').requireRuntimeTables(c,Object.keys(require('../api/_runtime-schema').COLUMNS));await c.query('ROLLBACK');}finally{c.release();}
   await require('../api/_boards-storage').ensureBoardsTable();await require('../api/_document-records').ensureDocumentTables();await require('../api/social-connector/schema').ensureSocialConnectorSchema(db);
  });
  const email='runtime@example.test',user={email,name:'Runtime fixture'};
  const workspace=await require('../api/workspaces').createFirstWorkspace({db,canonicalEmail:email,input:{name:'Runtime Workspace',locale:'en',requestId:randomUUID(),workspaceId:randomUUID()}});
  const W=workspace.workspace.id,I=(await db.query('SELECT id FROM app_identities WHERE canonical_email=$1',[email])).rows[0].id;
  await check('actual first Workspace identity and accepted owner membership persistence',async()=>{assert.equal((await db.query('SELECT role,status FROM workspace_memberships WHERE workspace_id=$1 AND identity_id=$2',[W,I])).rows[0].role,'owner');await db.query('UPDATE workspaces SET name=$2,revision=revision+1,updated_at=now() WHERE id=$1',[W,'Renamed Workspace']);await denied('UPDATE app_identities SET status=\'disabled\' WHERE id=$1',[I]);await denied('UPDATE workspace_memberships SET role=\'viewer\' WHERE workspace_id=$1',[W]);});
  const input={contract:'project_command_v1',request_id:randomUUID(),workspace_id:W,project_name:'Runtime project',brand:{new_name:'Protected Runtime Brand'}};
  let project;
  await check('actual Project command atomically persists Brand, Board, snapshot and receipt',async()=>{project=await require('../api/_project-command').execute({db,user,canonicalEmail:email,input});assert.equal(project.created,true);assert.equal(project.board.brand_id,project.brand.id);assert.deepEqual(project.board.brand_core_snapshot,project.brand.brand_core);const replay=await require('../api/_project-command').execute({db,user,canonicalEmail:email,input});assert.equal(replay.created,false);assert.equal(replay.board.id,project.board.id);});
  const B=project.brand.id,board=project.board.id;
  await check('Brand creation replay holds lock without runtime UPDATE privilege',async()=>{const input={id:randomUUID(),workspace_id:W,name:'Standalone fixture'};const service=require('../api/_brand-creation');assert.equal((await service.createWorkspaceBrand({db,email,input})).created,true);assert.equal((await service.createWorkspaceBrand({db,email,input})).created,false);});
  await check('Board Canvas, editors and public-sharing persistence',async()=>{
   await db.query("UPDATE boards SET canvas_json=$2,public_view_enabled=true,public_view_token_hash=$3,public_view_token_created_at=now() WHERE id=$1",[board,{nodes:[{id:'fixture'}],edges:[]},'a'.repeat(64)]);
   await db.query("INSERT INTO board_editors(board_id,email,role) VALUES($1,'viewer@example.test','viewer')",[board]);
   await db.query("UPDATE board_editors SET role='editor' WHERE board_id=$1",[board]);assert.equal((await db.query('SELECT canvas_json FROM boards WHERE id=$1',[board])).rows[0].canvas_json.nodes[0].id,'fixture');await db.query('DELETE FROM board_editors WHERE board_id=$1',[board]);
  });
  await check('Brand membership management has only existing table authority',async()=>{await db.query("INSERT INTO brand_members(brand_id,email,role) VALUES($1,'editor@example.test','editor')",[B]);await db.query("UPDATE brand_members SET role='viewer' WHERE brand_id=$1",[B]);await db.query('DELETE FROM brand_members WHERE brand_id=$1',[B]);});
  await check('protected Core mutation and exact single history receipt',async()=>{
   const before=(await db.query('SELECT * FROM brands WHERE id=$1',[B])).rows[0];const command=require('../brand-write-contract').command(before,{name:'Governed Brand'},W,'profile_edit');
   const write=require('../api/_brand-knowledge-write');const first=await write.write({db,user,brandId:B,input:command});const again=await write.write({db,user,brandId:B,input:command});assert.equal(again.replay,true);assert.equal(first.event_id,again.event_id);assert.equal((await root.query('SELECT count(*)::int n FROM brand_knowledge_history WHERE brand_id=$1',[B])).rows[0].n,2);
  });
  await check('actual Learning governance authorizes with definer row lock and immutable events',async()=>{
   const learning=require('../api/_brand-learnings');const proposed=await learning.operate({db,user,brandId:B,input:learning.inputRequest({statement:'A bounded runtime observation',expected_brand_revision:String((await db.query('SELECT revision FROM brands WHERE id=$1',[B])).rows[0].revision)},true)});
   assert.equal(proposed.learning.status,'proposed');
   const act=async(body)=>learning.operate({db,user,brandId:B,input:learning.inputRequest(body,false)});
   const edited=await act({action:'edit',learning_id:proposed.learning.id,expected_revision:proposed.learning.revision,statement:'An edited runtime observation'});
   const approved=await act({action:'approve',learning_id:edited.learning.id,expected_revision:edited.learning.revision});assert.equal(approved.learning.status,'approved');
   await assert.rejects(()=>act({action:'reject',learning_id:approved.learning.id,expected_revision:edited.learning.revision}),e=>e.code==='STALE_LEARNING_REVISION');
   const archived=await act({action:'archive',learning_id:approved.learning.id,expected_revision:approved.learning.revision});assert.equal(archived.learning.status,'archived');
   assert.equal((await db.query('SELECT count(*)::int n FROM brand_learning_events WHERE learning_id=$1',[proposed.learning.id])).rows[0].n,4);
   await denied('DELETE FROM brand_learnings');await denied('UPDATE brand_learning_events SET snapshot=\'{}\'');
  });
  let doc,job;
  await check('document intents, replacement metadata and real processing lease workflow',async()=>{
   await db.query("INSERT INTO brand_document_upload_intents(request_id,board_id,tile_id,source_type,original_filename,display_filename,declared_media_type,extension,storage_key,created_by,expires_at) VALUES($1,$2,'km_fixture123','whitepaper','a.pdf','a.pdf','application/pdf','pdf',$3,$4,now()+interval '5 minutes')",[randomUUID(),board,randomUUID(),email]);
   doc=(await db.query("INSERT INTO brand_documents(board_id,tile_id,source_type,original_filename,display_filename,media_type,extension,file_size,content_hash,storage_key,page_count_status,created_by) VALUES($1,'km_fixture123','whitepaper','a.pdf','a.pdf','application/pdf','pdf',10,$2,$3,'unknown',$4) RETURNING *",[board,'a'.repeat(64),randomUUID(),email])).rows[0];
   const processing=require('../api/_document-processing-records'),binding=processing.documentBinding(doc);job=await processing.startJob(binding,email,db);assert.equal(job.state,'queued');const claimed=await processing.claimJob('runtime-fixture',db);assert.equal(claimed.row.id,job.id);await processing.transitionClaimedJob({jobId:job.id,leaseToken:claimed.leaseToken,workerId:'runtime-fixture',state:'blocked',scanStatus:'not_configured',safeErrorCode:'scanner_not_configured'},db);assert.equal((await processing.getBoundJob(binding,db)).state,'blocked');await denied('INSERT INTO brand_document_processing_results DEFAULT VALUES');await denied('DELETE FROM brand_documents');
  });
  await check('social OAuth, encrypted secret, account, destination, job and attempt persistence',async()=>{
   const owner='fixture-owner',secret=randomUUID(),attempt=randomUUID(),account=randomUUID(),destination=randomUUID(),publish=randomUUID();
   await db.query("INSERT INTO social_oauth_attempts(id,owner_account_id,platform,state_hash,session_binding_fingerprint,expires_at) VALUES($1,$2,'linkedin',$3,'fixture',now()+interval '5 minutes')",[attempt,owner,randomUUID()]);
   await db.query("INSERT INTO social_token_secrets(id,owner_account_id,platform,encrypted_payload,nonce,authentication_tag,encryption_key_version) VALUES($1,$2,'linkedin','fixture-ciphertext','nonce','tag',1)",[secret,owner]);
   await db.query("INSERT INTO social_connected_accounts(id,owner_account_id,platform,external_account_id,account_type,status,token_secret_id,last_oauth_attempt_id) VALUES($1,$2,'linkedin','fixture-external','personal','connected',$3,$4)",[account,owner,secret,attempt]);
   await db.query("INSERT INTO social_publishing_destinations(id,connected_account_id,owner_account_id,external_destination_id,destination_type,display_name,authorization_state,status) VALUES($1,$2,$3,'fixture','personal','Fixture','authorized','active')",[destination,account,owner]);
   await db.query("INSERT INTO social_publish_jobs(id,owner_account_id,board_id,node_id,approved_fingerprint,content_snapshot,destination_id,delivery_mode,status,idempotency_key,created_by_actor) VALUES($1,$2,$3,'node','fingerprint','{}',$4,'immediate','queued',$5,'fixture')",[publish,owner,board,destination,randomUUID()]);
   await db.query("INSERT INTO social_provider_attempts(publish_job_id,owner_account_id,adapter_platform,attempt_number,phase,status) VALUES($1,$2,'linkedin',1,'provider_request','started')",[publish,owner]);
   await db.query("INSERT INTO social_external_posts(platform,external_post_id,destination_id,publish_job_id,owner_account_id,source_board_id,source_node_id,approved_fingerprint,published_snapshot_reference,delivery_state,deletion_state) VALUES('linkedin',$1,$2,$3,$4,$5,'node','fingerprint','fixture','confirmed','retained')",[randomUUID(),destination,publish,owner,board]);
   await db.query("UPDATE social_publish_jobs SET status='delivered' WHERE id=$1",[publish]);await db.query('UPDATE social_token_secrets SET revoked_at=now() WHERE id=$1',[secret]);await denied('UPDATE social_external_posts SET delivery_state=\'deleted\'');await denied('UPDATE social_connector_schema_version SET version=5');
   await assert.rejects(()=>db.query('DELETE FROM social_token_secrets WHERE id=$1',[secret]),e=>['23503','23001'].includes(e.code));
   const orphan=randomUUID();await db.query("INSERT INTO social_token_secrets(id,owner_account_id,platform,encrypted_payload,nonce,authentication_tag,encryption_key_version) VALUES($1,$2,'linkedin','orphan-fixture','nonce','tag',1)",[orphan,owner]);
   assert.equal((await db.query('DELETE FROM social_token_secrets WHERE id=$1 AND owner_account_id=$2',[orphan,owner])).rowCount,1);
  });
  await check('anon/authenticated cannot read secrets, inherit backend or execute lock helper',async()=>{
   for(const role of ['anon','authenticated']){const c=new Client({connectionString:new URL(url).href.replace(/\/[^/]*$/,'/'+dbname)});await c.connect();clients.push(c);await c.query('SET ROLE '+role);await assert.rejects(()=>c.query('SELECT * FROM social_token_secrets'),e=>e.code==='42501');await assert.rejects(()=>c.query('SELECT tendra_runtime_private.lock_brand($1,true)',[B]),e=>e.code==='42501');}
  });
  await check('protected deletion retains canonical history through existing Learning cascade triggers',async()=>{
   const id=randomUUID(),name='Disposable delete fixture';
   await require('../api/_brand-creation').createWorkspaceBrand({db,email,input:{id,workspace_id:W,name}});
   const learning=require('../api/_brand-learnings');await learning.operate({db,user,brandId:id,input:learning.inputRequest({statement:'Disposable learning before deletion',expected_brand_revision:'1'},true)});
   const c=await db.connect();try{await c.query('BEGIN');await require('../api/_brand-knowledge-write').lifecycle({client:c,email,brandId:id,command:{contract:'canonical-brand-write/v1',operation:'delete',mutation_id:randomUUID(),workspace_id:W,expected_revision:'1',expected_logo_revision:0,confirmation_name:name}});await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   assert.equal((await db.query('SELECT FROM brands WHERE id=$1',[id])).rowCount,0);
   assert.equal((await db.query('SELECT FROM brand_learnings WHERE brand_id=$1',[id])).rowCount,0);
   assert.equal((await root.query('SELECT count(*)::int n FROM brand_knowledge_history WHERE brand_id=$1',[id])).rows[0].n,2);
  });
  await check('unexpected group member is rejected and session identity fence denies its reads',async()=>{
   const role='bw_r3_other_'+randomBytes(6).toString('hex'),secret=randomBytes(32).toString('hex');
   await admin.query('CREATE ROLE '+role+" LOGIN INHERIT PASSWORD '"+secret+"'");
   const otherUrl=new URL(local);otherUrl.username=role;otherUrl.password=secret;const outsider=new Client({connectionString:otherUrl.href});
   try{
    await admin.query('GRANT brand_knowledge_runtime TO '+role+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
    await assert.rejects(()=>root.query(verify),/UNREVIEWED_ROLE_MEMBERSHIP/);
    await outsider.connect();assert.equal((await outsider.query('SELECT * FROM social_token_secrets')).rowCount,0);
    assert.equal((await outsider.query('SELECT * FROM brands')).rowCount,0);
    await assert.rejects(()=>outsider.query('SELECT tendra_runtime_private.lock_brand($1,true)',[B]),e=>e.code==='42501');
   }finally{await outsider.end();await admin.query('DROP ROLE '+role);}
   await root.query(verify);
  });
  await check('independent connections preserve Brand lock exclusion and rollback',async()=>{
   const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT tendra_runtime_private.lock_brand($1,true)',[B]);await other.query('BEGIN');await other.query("SET LOCAL lock_timeout='100ms'");await assert.rejects(()=>other.query('SELECT tendra_runtime_private.lock_brand($1,true)',[B]),e=>e.code==='55P03');await other.query('ROLLBACK');await c.query('ROLLBACK');await other.query('SELECT tendra_runtime_private.lock_brand($1,true)',[B]);}finally{c.release();}
   const id=randomUUID();const c2=await db.connect();try{await c2.query('BEGIN');await c2.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,id,W,'Rollback fixture',{},id]);await assert.rejects(()=>c2.query('INSERT INTO boards(id,name,canvas_json) VALUES($1,\'duplicate\',\'{}\')',[board]),e=>e.code==='23505');await c2.query('ROLLBACK');assert.equal((await root.query('SELECT FROM brands WHERE id=$1',[id])).rowCount,0);assert.equal((await root.query('SELECT FROM brand_knowledge_history WHERE brand_id=$1',[id])).rowCount,0);}finally{c2.release();}
  });
  await check('policy drift aborts atomically instead of broadening access',async()=>{await root.query('ALTER POLICY bw36_23a_server_select ON social_token_secrets USING(true)');await assert.rejects(()=>root.query(sql),/RUNTIME_POLICY_DRIFT/);await root.query('ROLLBACK');await root.query("ALTER POLICY bw36_23a_server_select ON social_token_secrets USING(session_user='tendra_app_runtime'::name)");await root.query(verify);});
  await check('non-superuser operator with explicit owner SET authority can rerun installation',async()=>{
   const operator='bw_r3_op_'+randomBytes(6).toString('hex'),secret=randomBytes(32).toString('hex');
   await admin.query('CREATE ROLE '+operator+" LOGIN INHERIT NOSUPERUSER NOBYPASSRLS PASSWORD '"+secret+"'");
   const opUrl=new URL(local);opUrl.username=operator;opUrl.password=secret;const op=new Client({connectionString:opUrl.href});
   try {
    // Local postgres owns legacy tables. Membership models their owner privileges,
    // but PostgreSQL does not inherit the superuser attribute through membership.
    await admin.query('GRANT postgres TO '+operator+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
    await admin.query('GRANT brand_knowledge_owner TO '+operator+' WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
    await op.connect();assert.equal((await op.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper,false);
    await op.query(sql);await op.query(verify);
   } finally {await op.end();await admin.query('DROP ROLE '+operator);}
  });
  await check('reviewed freeze stops existing-session writes and preserves all history',async()=>{
   const before=(await root.query('SELECT count(*)::int n FROM brand_knowledge_history')).rows[0].n;
   // An incident freeze must also close accidentally added direct login grants.
   await root.query('GRANT INSERT ON boards TO tendra_app_runtime');
   await root.query('GRANT EXECUTE ON FUNCTION brand_knowledge_private.create_brand(text,uuid,uuid,text,jsonb,uuid) TO tendra_app_runtime');
   const frozen=await db.connect();
   try {
    await root.query(read(prefix+'.rollback.sql'));
    await assert.rejects(()=>frozen.query("UPDATE boards SET name='frozen'"),e=>e.code==='42501');
    await assert.rejects(()=>frozen.query('SELECT brand_knowledge_private.create_brand($1,$2,$3,$4,$5,$6)',[email,randomUUID(),W,'Frozen',{},randomUUID()]),e=>e.code==='42501');
    assert.equal((await frozen.query('SELECT count(*)::int n FROM boards')).rows[0].n>0,true);
   } finally {frozen.release();}
   assert.equal((await root.query('SELECT count(*)::int n FROM brand_knowledge_history')).rows[0].n,before);
   assert.equal((await root.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='tendra_app_runtime'")).rows[0].rolcanlogin,false);
  });
  console.log(groups+' real PostgreSQL R3 groups passed; '+(await root.query('SHOW server_version')).rows[0].server_version);
 }finally{
  for(const c of clients)await c.end();if(other)await other.end();if(db)await db.end();
  const storage=require.cache[require.resolve('../api/_boards-storage')];if(storage)await storage.exports.pool.end();
  if(operator)await operator.close();await root.end();
  // Pool releases that handled expected permission errors may still be finishing
  // their socket close. Wait for actual backend shutdown; never FORCE-kill them.
  let remaining=0;
  for(let n=0;n<100;n++){
   remaining=Number((await admin.query('SELECT count(*) n FROM pg_stat_activity WHERE datname=$1',[dbname])).rows[0].n);
   if(!remaining)break;await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(remaining,0,'Fixture connections must close before database cleanup');
  await admin.query('DROP DATABASE '+dbname);if(operator)await operator.drop(admin);await admin.query('REVOKE brand_knowledge_runtime,tendra_app_runtime,brand_knowledge_owner FROM postgres CASCADE');await admin.end();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
