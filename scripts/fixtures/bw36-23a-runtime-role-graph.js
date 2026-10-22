'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Client}=require('pg'),{randomUUID}=require('node:crypto');
async function withSupabasePostgres(root,url,fn){
 // Demote the actual postgres operator while a separate disposable cluster
  // administrator retains recovery authority. Supabase postgres is not SUPERUSER.
  const adminRole='bw23_cluster_admin_'+randomUUID().replaceAll('-',''),password=randomUUID();
  await root.query('CREATE ROLE '+adminRole+" LOGIN SUPERUSER PASSWORD '"+password+"'");
  const adminUrl=new URL(url);adminUrl.username=adminRole;adminUrl.password=password;
  const recovery=new Client({connectionString:adminUrl.href});await recovery.connect();
 try {
  await recovery.query('ALTER ROLE postgres NOSUPERUSER BYPASSRLS CREATEROLE CREATEDB NOREPLICATION');
  assert.equal((await root.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolsuper,false);
  await fn();
  } finally {
   await root.query('ROLLBACK');
   await recovery.query('ALTER ROLE postgres SUPERUSER BYPASSRLS CREATEROLE CREATEDB REPLICATION');
   await recovery.end();await root.query('DROP ROLE '+adminRole);
  }
}
module.exports={
 async prepare(root,operator,core,check,url){
  // Supabase operator SET authority plus PostgreSQL 16+ creator ADMIN rows.
  // These are explicit catalog edges: superuser's implicit pg_has_role is not evidence.
  await root.query('GRANT brand_knowledge_owner TO postgres WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
  await root.query('GRANT brand_knowledge_runtime, tendra_app_runtime TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE');
  await withSupabasePostgres(root,url,async()=>{
  await check('Supabase operator ADMIN-only memberships reproduce exact P0001 postgres and atomic rollback',async()=>{
   assert.deepEqual((await root.query("SELECT r.rolname,m.inherit_option,m.set_option,m.admin_option FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.member='postgres'::regrole AND r.rolname IN ('brand_knowledge_owner','brand_knowledge_runtime','tendra_app_runtime') ORDER BY r.rolname")).rows,[
    {rolname:'brand_knowledge_owner',inherit_option:false,set_option:true,admin_option:false},
    {rolname:'brand_knowledge_runtime',inherit_option:false,set_option:false,admin_option:true},
    {rolname:'tendra_app_runtime',inherit_option:false,set_option:false,admin_option:true}]);
   const before=await operator.snapshot();
   const old=fs.readFileSync('scripts/fixtures/bw36-23a-original-runtime-verification.sql','utf8');
   const broken=core.replace(/DO \$verify\$[\s\S]*?END \$verify\$;/,()=>old);
   await assert.rejects(()=>root.query(broken),e=>{assert.equal(e.code,'P0001');assert.equal(e.message,'UNSAFE_RUNTIME_PRIVILEGES: postgres');console.log('REPRODUCED '+e.code+': '+e.message);return true;});
   await root.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);
  });
  await check('postgres operator installs and verifies protection with unchanged administrative memberships',async()=>{
   await root.query(core);
   await root.query(fs.readFileSync('migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql','utf8'));
  });
  });
 },
 async postgresChain(root,url,core,r3,verify,check){
  await check('NOSUPERUSER postgres executes complete protection and R3 verifier chain',()=>withSupabasePostgres(root,url,async()=>{
   const protectionVerify=fs.readFileSync('migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql','utf8');
   await root.query(core);await root.query(protectionVerify);
   await root.query(r3);await root.query(verify);await root.query(protectionVerify);
  }));
 },
 async unsafe(root,operator,core,r3,verify,check){
  const protectionVerify=fs.readFileSync('migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql','utf8');
  const reject=async(sql,pattern)=>{await assert.rejects(()=>operator.client.query(sql),pattern);await operator.client.query('ROLLBACK');};
  await root.query('CREATE ROLE bw23_elevated NOLOGIN BYPASSRLS; CREATE ROLE bw23_bridge NOLOGIN; CREATE ROLE bw23_untrusted NOLOGIN');
  try{
   const cases=[
    ['operator inherits runtime','GRANT brand_knowledge_runtime TO postgres WITH INHERIT TRUE, SET FALSE, ADMIN TRUE','GRANT brand_knowledge_runtime TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE'],
    ['operator can SET runtime','GRANT brand_knowledge_runtime TO postgres WITH INHERIT FALSE, SET TRUE, ADMIN TRUE','GRANT brand_knowledge_runtime TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE'],
    ['operator inherits runtime login','GRANT tendra_app_runtime TO postgres WITH INHERIT TRUE, SET FALSE, ADMIN TRUE','GRANT tendra_app_runtime TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE'],
    ['transitive elevated runtime member','GRANT brand_knowledge_runtime TO bw23_bridge WITH INHERIT TRUE, SET FALSE; GRANT bw23_bridge TO bw23_elevated WITH INHERIT FALSE, SET TRUE','REVOKE bw23_bridge FROM bw23_elevated; REVOKE brand_knowledge_runtime FROM bw23_bridge'],
    ['runtime SET elevated ancestor','GRANT bw23_elevated TO tendra_app_runtime WITH INHERIT FALSE, SET TRUE','REVOKE bw23_elevated FROM tendra_app_runtime'],
    ['runtime SET schema creator','GRANT CREATE ON SCHEMA public TO bw23_bridge; GRANT bw23_bridge TO tendra_app_runtime WITH INHERIT FALSE, SET TRUE','REVOKE bw23_bridge FROM tendra_app_runtime; REVOKE CREATE ON SCHEMA public FROM bw23_bridge'],
    ['runtime inherits owner','GRANT brand_knowledge_owner TO tendra_app_runtime WITH INHERIT TRUE, SET FALSE','REVOKE brand_knowledge_owner FROM tendra_app_runtime'],
    ['runtime SET owner','GRANT brand_knowledge_owner TO tendra_app_runtime WITH INHERIT FALSE, SET TRUE','REVOKE brand_knowledge_owner FROM tendra_app_runtime'],
    ['transitive owner inheritance','GRANT brand_knowledge_owner TO bw23_bridge WITH INHERIT TRUE, SET FALSE; GRANT bw23_bridge TO tendra_app_runtime WITH INHERIT TRUE, SET FALSE','REVOKE bw23_bridge FROM tendra_app_runtime; REVOKE brand_knowledge_owner FROM bw23_bridge']
   ];
   for(const [name,grant,revoke] of cases)await check(name+' rejected by both installers and both verifiers',async()=>{
    await root.query(grant);
    try{
     await reject(core,/UNSAFE_RUNTIME_PRIVILEGES|OWNER_MEMBERSHIP_FORBIDDEN/);
     await reject(protectionVerify,/UNSAFE_RUNTIME_PRIVILEGES/);
     await reject(r3,/UNSAFE_EXISTING_ROLE|UNREVIEWED_ROLE_MEMBERSHIP/);
     await reject(verify,/UNREVIEWED_ROLE_MEMBERSHIP|PROTECTED_ACCESS_LEAK/);
    }finally{await root.query(revoke);}
   });
   for(const [name,grant,revoke] of [
    ['untrusted ADMIN-only member','GRANT brand_knowledge_runtime TO bw23_untrusted WITH INHERIT FALSE, SET FALSE, ADMIN TRUE','REVOKE brand_knowledge_runtime FROM bw23_untrusted'],
    ['runtime administers other role','GRANT bw23_untrusted TO tendra_app_runtime WITH INHERIT FALSE, SET FALSE, ADMIN TRUE','REVOKE bw23_untrusted FROM tendra_app_runtime'],
    ['runtime membership SET changed','GRANT brand_knowledge_runtime TO tendra_app_runtime WITH INHERIT TRUE, SET TRUE, ADMIN FALSE','GRANT brand_knowledge_runtime TO tendra_app_runtime WITH INHERIT TRUE, SET FALSE, ADMIN FALSE'],
   ])await check(name+' rejected by restrictive R3 graph',async()=>{
    await root.query(grant);try{await reject(r3,/UNREVIEWED_ROLE_MEMBERSHIP|EXACT_RUNTIME_MEMBERSHIP_REQUIRED/);await reject(verify,/UNREVIEWED_ROLE_MEMBERSHIP|MEMBERSHIP_OPTIONS_INVALID/);}finally{await root.query(revoke);}
   });
   await operator.client.query(protectionVerify);await operator.client.query(verify);
  }finally{await root.query('DROP ROLE bw23_elevated,bw23_bridge,bw23_untrusted');}
 }
};
