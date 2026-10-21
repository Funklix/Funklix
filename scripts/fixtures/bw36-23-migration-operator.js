'use strict';
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');

// Disposable cluster only, called after the suites' localhost/destructive guards.
module.exports = async function migrationOperator(root, url, migration, check) {
  const role='bw23_operator_'+randomUUID().replaceAll('-',''), password=randomUUID();
  await root.query('CREATE ROLE '+role+" LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '"+password+"'");
  // Inherit legacy object/database/schema ownership, never the superuser attribute.
  await root.query('GRANT postgres TO '+role+' WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
  await root.query('GRANT brand_knowledge_owner TO '+role+' WITH INHERIT TRUE, SET TRUE, ADMIN FALSE');
  const local=new URL(url);local.username=role;local.password=password;
  const client=new Client({connectionString:local.href});await client.connect();
  try {
    const snapshot=async()=> (await root.query(`SELECT jsonb_build_object(
      'brands',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM brands b),
      'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n),
      'classes',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_class c WHERE relnamespace='public'::regnamespace),
      'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p),
      'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','brand_knowledge_private','tendra_runtime_private'))),
      'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t)
    ) state`)).rows[0].state;
    const noCreate=async()=>assert.equal((await root.query("SELECT has_schema_privilege('brand_knowledge_owner','public','CREATE') ok")).rows[0].ok,false);
    await check('non-superuser operator has owner SET authority; NOLOGIN owner lacks public CREATE',async()=>{
      assert.deepEqual((await client.query("SELECT rolsuper,rolbypassrls,pg_has_role(current_user,'brand_knowledge_owner','SET') can_set FROM pg_roles WHERE rolname=current_user")).rows[0],{rolsuper:false,rolbypassrls:false,can_set:true});
      assert.equal((await root.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='brand_knowledge_owner'")).rows[0].rolcanlogin,false);
      await noCreate();assert.equal((await root.query("SELECT to_regclass('public.brand_knowledge_history') existing")).rows[0].existing,null);
      console.log('PostgreSQL '+(await root.query('SHOW server_version')).rows[0].server_version);
    });
    await check('original ownership transfer reproduces exact 42501 and rolls back entire install',async()=>{
      const original=migration.replace(/-- PostgreSQL checks CREATE[\s\S]*?END \$history_owner\$;/,'ALTER TABLE public.brand_knowledge_history OWNER TO brand_knowledge_owner;');
      assert.notEqual(original,migration);const before=await snapshot();
      await assert.rejects(()=>client.query(original),e=>{
        assert.equal(e.code,'42501');assert.equal(e.message,'permission denied for schema public');
        console.log('REPRODUCED '+e.code+': '+e.message+' at history OWNER TO');return true;
      });
      await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);await noCreate();
    });
    await check('late installation failure rolls back DDL grants policies baseline and temporary CREATE',async()=>{
      const before=await snapshot();
      await assert.rejects(()=>client.query(migration.replace(/COMMIT;\s*$/, () => "DO $$ BEGIN RAISE EXCEPTION 'HOTFIX_INJECTED_FAILURE'; END $$; COMMIT;")),/HOTFIX_INJECTED_FAILURE/);
      await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);await noCreate();
    });
    return {client, noCreate, snapshot,
      async preserveCreate() {
        await check('pre-existing direct CREATE WITH GRANT OPTION survives exact rerun unchanged',async()=>{
          await root.query('GRANT CREATE ON SCHEMA public TO brand_knowledge_owner WITH GRANT OPTION');
          const before=(await root.query("SELECT nspacl::text acl FROM pg_namespace WHERE nspname='public'")).rows;
          await client.query(migration);
          assert.deepEqual((await root.query("SELECT nspacl::text acl FROM pg_namespace WHERE nspname='public'")).rows,before);
          await root.query('REVOKE CREATE ON SCHEMA public FROM brand_knowledge_owner');await noCreate();
        });
        await check('inherited CREATE survives rerun without a new direct grant',async()=>{
          const creator=role+'_creator';await root.query('CREATE ROLE '+creator+' NOLOGIN');
          try {
            await root.query('GRANT CREATE ON SCHEMA public TO '+creator);
            await root.query('GRANT '+creator+' TO brand_knowledge_owner WITH INHERIT TRUE, SET FALSE, ADMIN FALSE');
            const before=(await root.query("SELECT nspacl::text acl FROM pg_namespace WHERE nspname='public'")).rows;
            await client.query(migration);
            assert.deepEqual((await root.query("SELECT nspacl::text acl FROM pg_namespace WHERE nspname='public'")).rows,before);
          } finally {
            await root.query('REVOKE '+creator+' FROM brand_knowledge_owner');
            await root.query('REVOKE CREATE ON SCHEMA public FROM '+creator);await root.query('DROP ROLE '+creator);
          }
          await noCreate();
        });
      },
      async close(){await client.end();},
      async drop(admin){await admin.query('DROP ROLE '+role);}
    };
  } catch(error) {await client.query('ROLLBACK');await client.end();await root.query('DROP ROLE '+role);throw error;}
};
