'use strict';
const assert=require('assert'),crypto=require('crypto');
const schema=require('../api/social-connector/schema'),settings=require('../api/social-connector/settings-projection');
assert.strictEqual(schema.SCHEMA_VERSION,3);
for(const step of ['advisory_lock_acquire','transaction_begin','oauth_return_path_backfill','oauth_return_path_constraint','oauth_connection_constraint','schema_version_write','transaction_commit','transaction_rollback'])assert(schema.STEPS.includes(step));
assert.strictEqual(schema.databaseErrorCategory('23514'),'check_violation');
assert.strictEqual(schema.databaseErrorCategory('42501'),'insufficient_privilege');
assert.strictEqual(schema.databaseErrorCategory('not-safe'),'unknown_database_error');
assert(!/TRUNCATE|DROP TABLE|DELETE FROM|revoked_at\s*=|consumed_at\s*=/i.test(schema.SCHEMA_SQL));
const limited=settings.project({configuration:{ready:true,keyVersion:1},row:{id:'11111111-1111-4111-8111-111111111111',status:'connected',external_display_name:'Felix Sander',account_type:'personal',granted_scopes:['r_liteprofile'],token_secret_id:'22222222-2222-4222-8222-222222222222',token_secret_exists:true,token_secret_valid:true,encryption_key_version:1,destination_exists:true,destination_active:true}});
assert.strictEqual(limited.state,'connected_limited');assert(limited.disconnectAllowed);
const diagnostic=settings.unavailable('req_safe',{phase:'schema_initialization',operation_category:'oauth_return_path_backfill',database_error_category:'check_violation'}).diagnostic;
assert.deepStrictEqual(Object.keys(diagnostic),settings.DIAGNOSTIC_FIELDS);assert.strictEqual(diagnostic.operation_category,'oauth_return_path_backfill');assert.strictEqual(diagnostic.database_error_category,'check_violation');assert(!JSON.stringify(diagnostic).includes('UPDATE '));
async function integration(){
 const url=process.env.BW326_DATABASE_URL;if(!url){console.log('BW-32.2.6 deterministic migration contract passed; PostgreSQL integration skipped (BW326_DATABASE_URL not set).');return;}
 const {Pool}=require('pg'),namespace=`bw326_${crypto.randomBytes(6).toString('hex')}`;
 const admin=new Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${namespace}`);
 const pool=new Pool({connectionString:url,options:`-c search_path=${namespace}`});
 try{
  await pool.query('CREATE TABLE boards(id UUID PRIMARY KEY)');
  const first=await schema.ensureSocialConnectorSchema(pool,{});assert(first.changed);const second=await schema.ensureSocialConnectorSchema(pool,{});assert.strictEqual(second.version,3);
  const version=await pool.query('SELECT version FROM social_connector_schema_version');assert.strictEqual(version.rows[0].version,3);
  // A production-shaped legacy row proves backfill preserves consumption and committed records.
  await pool.query("ALTER TABLE social_oauth_attempts DROP CONSTRAINT social_oauth_attempts_return_path_check; ALTER TABLE social_oauth_attempts ADD CONSTRAINT social_oauth_attempts_return_path_check CHECK(return_path ~ '^/settings'); UPDATE social_connector_schema_version SET version=1");
  const attempt=crypto.randomUUID();await pool.query("INSERT INTO social_oauth_attempts(id,owner_account_id,platform,return_path,state_hash,session_binding_fingerprint,created_at,expires_at,consumed_at) VALUES($1,'owner','linkedin','/settings','state','session',NOW(),NOW()+INTERVAL '1 hour',NOW())",[attempt]);
  // A new pool represents a concurrent/serverless cold instance rather than the process promise cache.
  const retryPool=new Pool({connectionString:url,options:`-c search_path=${namespace}`}),concurrentPool=new Pool({connectionString:url,options:`-c search_path=${namespace}`});try{await Promise.all([schema.ensureSocialConnectorSchema(retryPool,{}),schema.ensureSocialConnectorSchema(concurrentPool,{})]);}finally{await Promise.all([retryPool.end(),concurrentPool.end()]);}
  const kept=await pool.query('SELECT return_path,consumed_at FROM social_oauth_attempts WHERE id=$1',[attempt]);assert.strictEqual(kept.rows[0].return_path,'/');assert(kept.rows[0].consumed_at);
  console.log('BW-32.2.6 PostgreSQL clean, repeat, concurrent, legacy backfill, preservation, and projection checks passed.');
 }finally{await pool.end();await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();}
}
integration().catch(error=>{console.error('BW-32.2.6 PostgreSQL integration failed safely.');process.exitCode=1;});
