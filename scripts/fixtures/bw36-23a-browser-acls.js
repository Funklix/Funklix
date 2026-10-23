'use strict';
const assert=require('node:assert/strict');
const tables=["boards","board_editors","app_identities","workspaces","workspace_memberships","brand_members","project_commands","brand_learnings","brand_learning_events","brand_documents","brand_document_upload_intents","brand_document_processing_jobs","brand_document_processing_results","social_token_secrets","social_connected_accounts","social_publishing_destinations","social_oauth_attempts","social_publish_jobs","social_provider_attempts","social_external_posts","social_connector_schema_version"];
const policySnapshot=async root=>(await root.query("SELECT * FROM pg_policies WHERE roles && ARRAY['anon','authenticated']::name[] ORDER BY schemaname,tablename,policyname")).rows;
module.exports={
 async seedPolicies(root){
  // Model old board_editor browser policies as well as an explicit deny.
  await root.query(`ALTER TABLE board_editors ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_board_editors_select ON board_editors FOR SELECT TO authenticated USING (true);
    CREATE POLICY legacy_board_editors_update ON board_editors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY legacy_board_editors_deny ON board_editors AS RESTRICTIVE FOR ALL TO anon,authenticated USING (false) WITH CHECK (false)`);
 },
 async prepare(root,operator,sql,check){
  await check('legacy authenticated board_editors table/column ACLs reproduce exact P0001 and atomic rollback',async()=>{
   await root.query('GRANT SELECT,INSERT,UPDATE,DELETE ON board_editors TO authenticated; GRANT SELECT(email),UPDATE(role),REFERENCES(board_id) ON board_editors TO authenticated');
   const before=await operator.snapshot(),policies=await policySnapshot(root);
   const original=sql.replace(/-- BEGIN obsolete browser ACL cleanup[\s\S]*?-- END obsolete browser ACL cleanup/,'');
   assert.notEqual(original,sql);
   await assert.rejects(()=>operator.client.query(original),e=>{
    assert.equal(e.code,'P0001');assert.equal(e.message,'BROWSER_PRIVILEGE_LEAK: authenticated board_editors');
    console.log('REPRODUCED '+e.code+': '+e.message);return true;
   });
   await operator.client.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);assert.deepEqual(await policySnapshot(root),policies);
   // A table-level revoke alone leaves explicit column grants behind.
   await root.query('BEGIN; REVOKE ALL ON board_editors FROM authenticated');
   assert.equal((await root.query("SELECT has_table_privilege('authenticated','board_editors','SELECT') t,has_any_column_privilege('authenticated','board_editors','SELECT,UPDATE,REFERENCES') c")).rows[0].t,false);
   assert.equal((await root.query("SELECT has_any_column_privilege('authenticated','board_editors','SELECT,UPDATE,REFERENCES') c")).rows[0].c,true);
   await root.query('ROLLBACK');
  });
  // Production-equivalent superset: defaults, grant options and all column ACLs.
  // Every R3 server-only relation participates; unrelated catalogs are untouched.
  for(const t of tables)await root.query('GRANT ALL ON '+t+' TO anon,authenticated; GRANT ALL PRIVILEGES ('+
    (await root.query("SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) cols FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped",[t])).rows[0].cols+
    ') ON '+t+' TO PUBLIC,anon,authenticated');
  await root.query('GRANT SELECT(email) ON board_editors TO authenticated WITH GRANT OPTION; CREATE TABLE browser_acl_unrelated(id int); GRANT SELECT ON browser_acl_unrelated TO authenticated; GRANT SELECT ON boards TO PUBLIC');
 },
 async verify(root,check){
  await check('all 21 table and column browser ACLs removed, unrelated ACL retained',async()=>{
   for(const t of tables){
    const r=(await root.query("SELECT EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee IN (0,'anon'::regrole,'authenticated'::regrole)) t, EXISTS(SELECT FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a WHERE c.attrelid=$1::regclass AND a.grantee IN (0,'anon'::regrole,'authenticated'::regrole)) c",[t])).rows[0];
    assert.deepEqual(r,{t:false,c:false});
   }
   assert.equal((await root.query("SELECT has_table_privilege('authenticated','browser_acl_unrelated','SELECT') ok")).rows[0].ok,true);
  });
 },
 async negatives(root,operator,sql,verify,check){
  await root.query('CREATE ROLE bw23_browser_shared NOLOGIN; GRANT bw23_browser_shared TO authenticated WITH INHERIT TRUE, SET FALSE');
  try{
   for(const [name,grant,revoke,source] of [
    ['table','GRANT SELECT ON board_editors TO bw23_browser_shared','REVOKE SELECT ON board_editors FROM bw23_browser_shared','TABLE'],
    ['column','GRANT UPDATE(role) ON board_editors TO bw23_browser_shared','REVOKE UPDATE(role) ON board_editors FROM bw23_browser_shared','COLUMN role']
   ])await check('shared inherited browser '+name+' ACL identified and rejected atomically',async()=>{
    await root.query(grant);const before=await operator.snapshot(),policies=await policySnapshot(root);
    try{
     await assert.rejects(()=>operator.client.query(sql),e=>{assert.match(e.message,/UNREVIEWED_INHERITED_BROWSER_ACCESS: authenticated board_editors/);assert.ok(e.detail.includes(source));assert.ok(e.detail.includes('bw23_browser_shared'));assert.ok(e.detail.includes('granted by postgres'));return true;});
     await operator.client.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);assert.deepEqual(await policySnapshot(root),policies);
     await assert.rejects(()=>operator.client.query(verify),/BROWSER_PRIVILEGE_LEAK: authenticated board_editors/);
     await operator.client.query('ROLLBACK');
    }finally{await root.query(revoke);}
   });
   await check('dependent browser regrant stops cleanup without CASCADE',async()=>{
    await root.query("GRANT SELECT(email) ON board_editors TO authenticated WITH GRANT OPTION; SET ROLE authenticated; GRANT SELECT(email) ON board_editors TO bw23_browser_shared; RESET ROLE");
    const before=await operator.snapshot();
    try{
     await assert.rejects(()=>operator.client.query(sql),e=>e.code==='2BP01');
     await operator.client.query('ROLLBACK');assert.deepEqual(await operator.snapshot(),before);
    }finally{await root.query('REVOKE SELECT(email) ON board_editors FROM authenticated CASCADE');}
   });
  }finally{await root.query('REVOKE bw23_browser_shared FROM authenticated; DROP ROLE bw23_browser_shared');}
  await check('fresh document creation enables all four RLS flags before commit',async()=>{
   const before=await operator.snapshot();
   await operator.client.query('BEGIN');
   try{
    await operator.client.query('DROP TABLE brand_document_processing_results,brand_document_processing_jobs,brand_document_upload_intents,brand_documents');
    await operator.client.query(sql.replace(/^BEGIN;$/m,'').replace(/COMMIT;\s*$/,''));
    const rows=(await operator.client.query("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1)",[tables.filter(t=>t.startsWith('brand_document'))])).rows;
    assert.equal(rows.length,4);assert.ok(rows.every(r=>r.relrowsecurity));
    await operator.client.query(verify);
   }finally{await operator.client.query('ROLLBACK');}
   assert.deepEqual(await operator.snapshot(),before);
  });
 }
};
