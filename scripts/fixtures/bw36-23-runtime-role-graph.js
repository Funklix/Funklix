'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Client}=require('pg');

// Caller has already enforced the disposable localhost cluster guard.
module.exports=async function runtimeRoleGraph(root,operator,core,check){
 const group='brand_knowledge_runtime',owner='brand_knowledge_owner';
 const coreVerify=fs.readFileSync('migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql','utf8');
 const block=sql=>sql.slice(sql.indexOf('DO $verify$'),sql.indexOf('END $verify$;')+'END $verify$;'.length);
 assert.equal(block(core),block(coreVerify));
 const graph=async()=> (await root.query('SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY roleid,member,grantor')).rows;
 await root.query('GRANT '+owner+' TO postgres WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
 if(process.env.BW36_23_RESTRICTIVE_GRAPH!=='1'){
  await root.query('GRANT '+group+' TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE');
  await check('ADMIN-only operator reproduces exact P0001 postgres failure and full rollback',async()=>{
   assert.deepEqual((await root.query("SELECT admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='brand_knowledge_runtime'::regrole AND member='postgres'::regrole")).rows,[{admin_option:true,inherit_option:false,set_option:false}]);
   // Restore just the previous recursive traversal in the otherwise fixed install.
   const broken=core.replace(/\n      WHERE NOT \(m.admin_option[\s\S]*?'SET'\)\)\)/,'');
   assert.notEqual(broken,core);const before=await operator.snapshot(),members=await graph();
   await assert.rejects(()=>operator.client.query(broken),e=>{
    assert.equal(e.code,'P0001');assert.equal(e.message,'UNSAFE_RUNTIME_PRIVILEGES: postgres');
    console.log('REPRODUCED P0001: UNSAFE_RUNTIME_PRIVILEGES: postgres');return true;
   });
   await operator.client.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);assert.deepEqual(await graph(),members);
  });
  await check('Supabase-equivalent NOSUPERUSER operator reproduces failure and passes fixed final verification',async()=>{
   const role='bw23_supabase_operator',password=require('node:crypto').randomUUID();
   await root.query('CREATE ROLE '+role+" LOGIN INHERIT NOSUPERUSER BYPASSRLS CREATEROLE CREATEDB REPLICATION PASSWORD '"+password+"'");
   // The bootstrap postgres cannot be demoted. Inherit its legacy object ownership
   // in a separate login; the SUPERUSER attribute is never inherited.
   await root.query('GRANT postgres TO '+role+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
   await root.query('GRANT '+owner+' TO '+role+' WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
   await root.query('GRANT '+group+' TO '+role+' WITH INHERIT FALSE, SET FALSE, ADMIN TRUE');
   const params=root.connectionParameters;
   const op=new Client({host:params.host,port:params.port,database:params.database,user:role,password});
   try{
    await op.connect();
    assert.deepEqual((await op.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:true,rolcreaterole:true,rolcreatedb:true,rolreplication:true});
    const before=await operator.snapshot(),members=await graph();
    const broken=core.replace(/\n      WHERE NOT \(m.admin_option[\s\S]*?'SET'\)\)\)/,'');
    await assert.rejects(()=>op.query(broken),e=>e.code==='P0001'&&/^UNSAFE_RUNTIME_PRIVILEGES: (postgres|bw23_supabase_operator)$/.test(e.message));
    await op.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);assert.deepEqual(await graph(),members);
    // Complete fixed verification, then deliberately roll back so fresh/legacy
    // installation checks still see their original input.
    const rollback=core.replace(/COMMIT;\s*$/,()=>"DO $$ BEGIN RAISE EXCEPTION 'SUPABASE_FIXED_VERIFY_PASSED'; END $$; COMMIT;");
    await assert.rejects(()=>op.query(rollback),/SUPABASE_FIXED_VERIFY_PASSED/);
    await op.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);assert.deepEqual(await graph(),members);
   }finally{await op.end();await root.query('DROP ROLE '+role);}
  });
 }
 return async function verifyUnsafe(r3,r3Verify){
  if(r3)assert.equal(block(r3),block(r3Verify));
  const probes=[['protection install',core],['protection verifier',coreVerify],...(r3?[['R3 install',r3],['R3 verifier',r3Verify]]:[])];
  const reject=async()=>{
   for(const [label,sql] of probes){
    const before=await operator.snapshot(),members=await graph();
    await assert.rejects(()=>operator.client.query(sql),/UNSAFE_RUNTIME_PRIVILEGES|OWNER_MEMBERSHIP_FORBIDDEN|UNSAFE_EXISTING_ROLE|UNREVIEWED_ROLE_MEMBERSHIP|MEMBERSHIP_OPTIONS_INVALID|EXACT_RUNTIME_MEMBERSHIP_REQUIRED|UNSAFE_RUNTIME_LOGIN|UNSAFE_PROTECTION_ROLE/,label);
    await operator.client.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before,label);assert.deepEqual(await graph(),members,label);
   }
  };
  const edge=async(name,grant,revoke)=>check(name,async()=>{await root.query(grant);try{await reject();}finally{await root.query(revoke);}});
  // Even postgres is rejected if its administrative edge acquires capabilities.
  for(const options of (process.env.BW36_23_RESTRICTIVE_GRAPH==='1'?[]:['INHERIT TRUE, SET FALSE, ADMIN TRUE','INHERIT FALSE, SET TRUE, ADMIN TRUE'])){
   await edge('operator capability edge rejected: '+options,'GRANT '+group+' TO postgres WITH '+options,'GRANT '+group+' TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE');
  }
  const extra='bw23_graph_extra',bridge='bw23_graph_bridge';
  await root.query('CREATE ROLE '+extra+' NOLOGIN');await root.query('CREATE ROLE '+bridge+' NOLOGIN');
  try{
   await edge('unprivileged ADMIN-only member is rejected','GRANT '+group+' TO '+extra+' WITH INHERIT FALSE, SET FALSE, ADMIN TRUE','REVOKE '+group+' FROM '+extra);
   await root.query('ALTER ROLE '+extra+' LOGIN CREATEROLE');
   await edge('elevated ADMIN-only login without owner authority is rejected','GRANT '+group+' TO '+extra+' WITH INHERIT FALSE, SET FALSE, ADMIN TRUE','REVOKE '+group+' FROM '+extra);
   await root.query('GRANT '+owner+' TO '+extra+' WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
   await check('authorized non-superuser operator ADMIN-only membership passes without a name exemption',async()=>{
    await root.query('GRANT '+group+' TO '+extra+' WITH INHERIT FALSE, SET FALSE, ADMIN TRUE');
    try{for(const [,sql] of probes)await operator.client.query(sql);}
    finally{await root.query('REVOKE '+group+' FROM '+extra);}
   });
   await root.query('REVOKE '+owner+' FROM '+extra);
   await root.query('ALTER ROLE '+extra+' NOLOGIN NOCREATEROLE BYPASSRLS');
   await root.query('GRANT '+group+' TO '+bridge+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
   await edge('transitive elevated runtime member is rejected','GRANT '+bridge+' TO '+extra+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE','REVOKE '+bridge+' FROM '+extra);
   await edge('indirect operator inheritance is rejected despite a safe direct ADMIN edge','GRANT '+bridge+' TO postgres WITH INHERIT TRUE, SET FALSE, ADMIN FALSE','REVOKE '+bridge+' FROM postgres');
   await root.query('REVOKE '+group+' FROM '+bridge);
   await root.query('ALTER ROLE '+extra+' NOBYPASSRLS');
   const runtime=r3?'tendra_app_runtime':group;
   for(const options of ['INHERIT TRUE, SET FALSE, ADMIN FALSE','INHERIT FALSE, SET TRUE, ADMIN FALSE','INHERIT FALSE, SET FALSE, ADMIN TRUE']){
    await edge('runtime owner membership rejected: '+options,'GRANT '+owner+' TO '+runtime+' WITH '+options,'REVOKE '+owner+' FROM '+runtime);
   }
   await root.query('GRANT '+owner+' TO '+extra+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
   await edge('indirect runtime owner path rejected','GRANT '+extra+' TO '+runtime+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE','REVOKE '+extra+' FROM '+runtime);
   await root.query('REVOKE '+owner+' FROM '+extra);
   await root.query('ALTER ROLE '+extra+' CREATEROLE');
   await edge('runtime upstream elevated role rejected','GRANT '+extra+' TO '+runtime+' WITH INHERIT FALSE, SET TRUE, ADMIN FALSE','REVOKE '+extra+' FROM '+runtime);
  }finally{await root.query('DROP ROLE '+extra);await root.query('DROP ROLE '+bridge);}
  if(process.env.BW36_23_RESTRICTIVE_GRAPH!=='1')await root.query('GRANT '+group+' TO postgres WITH INHERIT FALSE, SET FALSE, ADMIN TRUE');
  for(const [,sql] of probes){await operator.client.query(sql);}
 };
};
