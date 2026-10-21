#!/usr/bin/env node
'use strict';
// Optional disposable SQL engine check, using the declared development dependency.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {learningRuntime}=require('./fixtures/bw36-17-local-runtime');
const {B,I,EMAIL}=require('./fixtures/bw36-13r5-local-runtime');
(async()=>{
const pg=new PGlite();
await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE public.app_identities(id uuid PRIMARY KEY,canonical_email text,status text,revision bigint);
CREATE TABLE public.brands(id uuid PRIMARY KEY,owner_email text,name text,revision bigint);
CREATE TABLE public.brand_members(brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,email text,role text,name text,UNIQUE(brand_id,email));
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,name text);
CREATE TABLE public.workspace_memberships(workspace_id uuid,identity_id uuid);
CREATE TABLE public.boards(id uuid PRIMARY KEY,brand_id uuid REFERENCES brands(id));
INSERT INTO app_identities VALUES ('${I}','${EMAIL}','active',1);
INSERT INTO brands VALUES ('${B}','${EMAIL}','Disposable Brand',1);`);
await pg.exec(fs.readFileSync('migrations/20261011_bw36_17_governed_brand_learnings.sql','utf8'));
const verification=await pg.exec(fs.readFileSync('scripts/sql/bw36-17-verify-governed-brand-learnings.sql','utf8'));
const check=verification.find(r=>r.rows?.[0]?.learnings_exist).rows[0];
for(const [key,value] of Object.entries(check))assert.equal(value,key.includes('initial_')?0:true,key);
assert.equal(verification.find(r=>r.rows?.[0]?.foreign_key_count).rows[0].foreign_key_count,8);
// Bring the historical fixture up to the schema expected by the current service.
for (const file of ['20261011_bw36_17r1_learning_provenance_schema.sql','20261012_bw36_17r2_learning_provenance_recovery.sql']) {
  await pg.exec(fs.readFileSync('migrations/'+file,'utf8'));
}
// SQL-engine fixture for the R3 lock transport used by the real service.
// Role/definer/session security is covered by the real 17.6/18.4 suites, not PGlite.
await pg.exec(`CREATE SCHEMA tendra_runtime_private;
CREATE FUNCTION tendra_runtime_private.lock_brand(p_id uuid,p_write boolean) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF p_write THEN PERFORM 1 FROM public.brands WHERE id=p_id FOR UPDATE;
  ELSE PERFORM 1 FROM public.brands WHERE id=p_id FOR SHARE; END IF;
END $$;`);
const service=learningRuntime().service,db={connect:async()=>({query:(q,a)=>pg.query(q,a),release(){}})};
const run=input=>service.operate({db,user:{email:EMAIL},brandId:B,input});
const create=statement=>run(service.inputRequest({statement,expected_brand_revision:'1'},true));
const act=(row,action,more={})=>run(service.inputRequest({action,learning_id:row.id,expected_revision:row.revision,...more},false));
let a=(await create('First governed example')).learning;
assert.equal(a.status,'proposed');a=(await act(a,'approve')).learning;
await assert.rejects(()=>pg.query("UPDATE brand_learnings SET statement='Silent overwrite',revision=revision+1 WHERE id=$1",[a.id]));
await assert.rejects(()=>pg.query('DELETE FROM brand_learning_events WHERE learning_id=$1',[a.id]));
await assert.rejects(()=>pg.query('DELETE FROM brand_learnings WHERE id=$1',[a.id]));
let b=(await act(a,'edit',{statement:a.statement,evidence_summary:'Updated governed evidence'})).learning;
assert.equal((await pg.query('SELECT status FROM brand_learnings WHERE id=$1',[a.id])).rows[0].status,'approved');
b=(await act(b,'approve')).learning;
assert.equal((await pg.query('SELECT status FROM brand_learnings WHERE id=$1',[a.id])).rows[0].status,'archived');
await assert.rejects(()=>pg.query("UPDATE brand_learnings SET revision=0 WHERE id=$1",[b.id]));
await assert.rejects(()=>pg.query("INSERT INTO brand_learnings(brand_id,status,statement,statement_key,proposed_by_identity_id,reviewed_by_identity_id,reviewed_at) VALUES ($1,'approved','Bypass',$2,$3,$3,now())",[B,service.statementKey('Bypass'),I]));
await assert.rejects(()=>pg.query("INSERT INTO brand_learning_events(brand_id,learning_id,event_type,actor_identity_id,next_status,learning_revision,snapshot) VALUES ($1,$2,'approved',$3,'approved',0,'{\"statement\":\"x\",\"raw_prompt\":\"blocked\"}')",[B,b.id,I]));
await pg.exec('SET ROLE authenticated');await assert.rejects(()=>pg.query('SELECT count(*) FROM brand_learnings'));await assert.rejects(()=>pg.query('SELECT count(*) FROM brand_learning_events'));await pg.exec('RESET ROLE');
await assert.rejects(()=>pg.exec('TRUNCATE brand_learning_events'));
const other='99999999-9999-4999-8999-999999999999';
await pg.query('INSERT INTO brands VALUES ($1,$2,$3,1)',[other,EMAIL,'Other disposable Brand']);
await assert.rejects(()=>pg.query('INSERT INTO brand_learnings(brand_id,statement,statement_key,proposed_by_identity_id,supersedes_learning_id) VALUES ($1,$2,$3,$4,$5)',[other,'Cross brand',service.statementKey('Cross brand'),I,b.id]));
await assert.rejects(()=>pg.query("INSERT INTO brand_learnings(brand_id,statement,statement_key,proposed_by_identity_id,status) VALUES ($1,'Invalid status',$2,$3,'unknown')",[B,service.statementKey('Invalid status'),I]));
await act(b,'archive');let c=(await create('Explicit rejection')).learning;await act(c,'reject');
await pg.query('DELETE FROM brands WHERE id=$1',[B]);
assert.equal((await pg.query('SELECT count(*)::int AS n FROM brand_learnings')).rows[0].n,0);
assert.equal((await pg.query('SELECT count(*)::int AS n FROM brand_learning_events')).rows[0].n,0);
console.log('PASS disposable PostgreSQL/PGlite: migration, real service queries, reviewer/lifecycle/revision guards, immutable approved text, append-only history, closed authenticated role, successor approval, rejection/archive, Brand cascade with no orphans.');
await pg.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
