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
  await root.query('GRANT brand_knowledge_owner TO '+role+' WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
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
      assert.deepEqual((await client.query("SELECT rolsuper,rolbypassrls,pg_has_role(current_user,'brand_knowledge_owner','SET') can_set,pg_has_role(current_user,'brand_knowledge_owner','USAGE') inherits_owner FROM pg_roles WHERE rolname=current_user")).rows[0],{rolsuper:false,rolbypassrls:false,can_set:true,inherits_owner:false});
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
    await check('premature ownership transfer reproduces exact 42501 at ENABLE ROW LEVEL SECURITY',async()=>{
      const block=migration.match(/-- PostgreSQL checks CREATE[\s\S]*?END \$history_owner\$;/)[0];
      const early=migration.replace(block,'').replace('ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY;',()=>block+'\nALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY;');
      const before=await snapshot();
      // Stop at this actual failing statement so no later failure can mask it.
      const prefix=early.slice(0,early.indexOf('ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY;')+'ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY;'.length);
      await assert.rejects(()=>client.query(prefix),e=>{
        assert.equal(e.code,'42501');assert.equal(e.message,'must be owner of table brand_knowledge_history');
        console.log('REPRODUCED '+e.code+': '+e.message+' at ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY');return true;
      });
      await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);await noCreate();
    });
    await check('failure immediately after transfer rolls back ownership and still-borrowed CREATE',async()=>{
      const before=await snapshot();
      const failed=migration.replace('ALTER TABLE public.brand_knowledge_history OWNER TO brand_knowledge_owner;',"ALTER TABLE public.brand_knowledge_history OWNER TO brand_knowledge_owner; RAISE EXCEPTION 'HOTFIX_TRANSFER_FAILURE';");
      await assert.rejects(()=>client.query(failed),/HOTFIX_TRANSFER_FAILURE/);
      await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);await noCreate();
      assert.equal((await client.query('SELECT current_user=session_user same')).rows[0].same,true);
    });
    await check('late installation failure rolls back DDL grants policies baseline and temporary CREATE',async()=>{
      const before=await snapshot();
      await assert.rejects(()=>client.query(migration.replace(/COMMIT;\s*$/, () => "DO $$ BEGIN RAISE EXCEPTION 'HOTFIX_INJECTED_FAILURE'; END $$; COMMIT;")),/HOTFIX_INJECTED_FAILURE/);
      await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);await noCreate();
      assert.equal((await client.query('SELECT current_user=session_user same')).rows[0].same,true);
    });
    let legacyRows;
    const protectedRows=async()=> (await root.query(`SELECT jsonb_build_object(
      'brands',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM brands b),
      'history',(SELECT jsonb_agg(to_jsonb(h) ORDER BY event_id) FROM brand_knowledge_history h),
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p)
    ) state`)).rows[0].state;
    return {client, noCreate, snapshot,
      async prepareLegacy(r3) {
        const fs=require('node:fs'),{createHash}=require('node:crypto');
        // Exact parent of PR #805, frozen from 74503b90ea11cf9817c79e1491c48aa6ce331338.
        const historical=fs.readFileSync('scripts/fixtures/bw36-23-pre805-protection.sql','utf8');
        assert.equal(createHash('sha256').update(historical).digest('hex'),'2770f4324f330586e45b68e6513490688a016adca75d636d0aea019178d15d47');
        await check('completed pre-805 install has installer-owned fingerprint without owner EXECUTE',async()=>{
          // Historical installation only: admin materializes the exact prior catalog.
          // All upgrade SQL and verifier calls use the NOSUPERUSER SET-only client.
          await root.query(historical);
          assert.deepEqual((await root.query("SELECT p.proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) installer_owned,has_function_privilege('brand_knowledge_owner',p.oid,'EXECUTE') owner_execute,has_function_privilege('brand_knowledge_runtime',p.oid,'EXECUTE') runtime_execute FROM pg_proc p WHERE p.oid='brand_knowledge_private.install_fingerprint()'::regprocedure")).rows[0],{installer_owned:true,owner_execute:false,runtime_execute:false});
          legacyRows=await protectedRows();
        });
        for (const [name,sql] of [['protection',migration],...(r3?[['R3',r3]]:[])]) {
          await check(name+' pre-fix preflight reproduces exact legacy fingerprint EXECUTE failure',async()=>{
            const before=await snapshot();
            const old=sql.replace(/DO \$legacy_fingerprint\$[\s\S]*?END \$legacy_fingerprint\$;/,()=>"DO $old_preflight$ BEGIN SET LOCAL ROLE brand_knowledge_owner; PERFORM brand_knowledge_private.install_fingerprint(); RESET ROLE; END $old_preflight$;");
            await assert.rejects(()=>client.query(old),e=>{assert.equal(e.code,'42501');assert.equal(e.message,'permission denied for function install_fingerprint');console.log('REPRODUCED '+name+' '+e.code+': '+e.message);return true;});
            await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);
          });
        }
        const marker=(await root.query("SELECT obj_description('brand_knowledge_private'::regnamespace) value")).rows[0].value;
        const restoreMarker=async()=>root.query((await root.query("SELECT format('COMMENT ON SCHEMA brand_knowledge_private IS %L',$1::text) sql",[marker])).rows[0].sql);
        for(const [name,sql] of [['protection',migration],...(r3?[['R3',r3]]:[])]) {
          await check(name+' rejects legacy fingerprint drift without normalizing ownership',async()=>{
            await root.query("COMMENT ON SCHEMA brand_knowledge_private IS 'legacy-drift-fixture'");
            try {
              const before=await snapshot();await assert.rejects(()=>client.query(sql),/PROTECTION_CATALOG_DRIFT/);
              await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);
            } finally {await restoreMarker();}
          });
          await check(name+' late upgrade failure rolls back all legacy owners ACLs and marker',async()=>{
            const before=await snapshot();
            const failed=sql.replace(/COMMIT;\s*$/,()=>"DO $$ BEGIN RAISE EXCEPTION 'LEGACY_UPGRADE_FAILURE'; END $$; COMMIT;");
            await assert.rejects(()=>client.query(failed),/LEGACY_UPGRADE_FAILURE/);
            await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);await noCreate();
            assert.equal((await client.query('SELECT current_user=session_user same')).rows[0].same,true);
          });
        }
        await check('EXECUTE-only authority cannot adopt a legacy fingerprint',async()=>{
          const outsider=role+'_legacy';await root.query('CREATE ROLE '+outsider+' NOLOGIN');
          try {
            await root.query('ALTER FUNCTION brand_knowledge_private.install_fingerprint() OWNER TO '+outsider);
            await root.query('GRANT EXECUTE ON FUNCTION brand_knowledge_private.install_fingerprint() TO '+role);
            // No ownership is inherited from this distinct historical function owner.
            const before=await snapshot();await assert.rejects(()=>client.query(migration),/LEGACY_INSTALLER_OWNERSHIP_REQUIRED/);
            await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);
          } finally {
            await root.query('REVOKE EXECUTE ON FUNCTION brand_knowledge_private.install_fingerprint() FROM '+role);
            await root.query('ALTER FUNCTION brand_knowledge_private.install_fingerprint() OWNER TO '+(await root.query('SELECT current_user name')).rows[0].name);
            await root.query('DROP ROLE '+outsider);await restoreMarker();
          }
        });
        await check('unknown legacy helper is rejected even with a matching saved fingerprint',async()=>{
          await root.query("CREATE FUNCTION brand_knowledge_private.unreviewed_legacy() RETURNS int LANGUAGE sql AS 'SELECT 1'; REVOKE ALL ON FUNCTION brand_knowledge_private.unreviewed_legacy() FROM PUBLIC");
          try {
            await root.query("DO $$ BEGIN EXECUTE format('COMMENT ON SCHEMA brand_knowledge_private IS %L',brand_knowledge_private.install_fingerprint()); END $$");
            const before=await snapshot();await assert.rejects(()=>client.query(migration),/UNREVIEWED_LEGACY_FUNCTION_OWNER/);
            await client.query('ROLLBACK');assert.deepEqual(await snapshot(),before);
          } finally {await root.query('DROP FUNCTION brand_knowledge_private.unreviewed_legacy()');await restoreMarker();}
        });
      },
      async assertLegacyRows() {if(legacyRows)assert.deepEqual(await protectedRows(),legacyRows);},
      async verifyCore() {
        const results=await client.query(require('node:fs').readFileSync('migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql','utf8'));
        assert.equal(results.find(r=>r.rows[0]?.catalog_matches_install!==undefined).rows[0].catalog_matches_install,true);
        assert.equal(results.find(r=>r.rows[0]?.rows_without_exact_history!==undefined).rows[0].rows_without_exact_history,'0');
        assert.equal((await client.query('SELECT current_user=session_user same')).rows[0].same,true);
        await noCreate();
        assert.deepEqual((await root.query("SELECT relowner='brand_knowledge_owner'::regrole owned,relrowsecurity rls FROM pg_class WHERE oid='public.brand_knowledge_history'::regclass")).rows[0],{owned:true,rls:true});
        assert.equal((await root.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='brand_knowledge_private'::regnamespace AND proowner<>'brand_knowledge_owner'::regrole")).rows[0].n,0);
        assert.equal((await root.query("SELECT has_schema_privilege($1,'brand_knowledge_private','USAGE,CREATE') leaked",[role])).rows[0].leaked,false);
      },
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
