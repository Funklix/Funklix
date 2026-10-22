'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const gate = require('../api/_write-maintenance');
const root = path.resolve(__dirname, '..');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
function response() { return { statusCode:200, headers:{}, setHeader(k,v){this.headers[k.toLowerCase()]=v;},removeHeader(k){delete this.headers[k.toLowerCase()];},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this.end(JSON.stringify(b));},end(b){if(b)this.body=JSON.parse(b);this.finished=true;return this;} }; }
let delivered = [], readResult = { rows:[], rowCount:0 };
function rawQuery(sql, values, callback) { delivered.push(typeof sql==='string'?sql:sql.text); const result=typeof readResult==='function'?readResult(typeof sql==='string'?sql:sql.text,values):readResult;const cb=typeof values==='function'?values:callback;if(cb){cb(null,result);return;}return Promise.resolve(result); }
const client={query:rawQuery,release(){}};
const pool=gate.guardPool({query:rawQuery,connect(callback){if(callback){callback(null,client,()=>{});return;}return Promise.resolve(client);}});
function load(file, overrides={}) {
 const filename=path.resolve(root,file), native=createRequire(filename), module={exports:{}};
 const mocked=dependency=>Object.hasOwn(overrides,dependency)?overrides[dependency]:native(dependency);
 vm.runInThisContext('(function(require,module,exports,__filename,__dirname){'+fs.readFileSync(filename,'utf8')+'\n})',{filename})(mocked,module,module.exports,filename,path.dirname(filename));
 return module.exports;
}
async function blocked(fn) { const before=delivered.length;await assert.rejects(fn, error=>error.code===gate.CODE&&error.status===503);assert.equal(delivered.length,before); }
async function invoke(handler,req) { const res=response();await handler({headers:{},query:{},body:{},...req},res);return res; }
function maintenance(res) { assert.equal(res.statusCode,503);assert.equal(res.body.code,gate.CODE);assert.equal(res.headers['retry-after'],'60');assert.match(res.body.message,/retry/i);assert.equal(res.headers.location,undefined); }
(async()=>{
 const previous=process.env.TENDRA_WRITE_MAINTENANCE, dbUrl=process.env.POSTGRES_URL;
 try {
 process.env.POSTGRES_URL='postgres://unused.invalid/fixture';
 for(const value of ['1','true','ON',' true ']){process.env.TENDRA_WRITE_MAINTENANCE=value;assert(gate.enabled());}
 process.env.TENDRA_WRITE_MAINTENANCE='false';await pool.query('INSERT INTO brands VALUES(1)');assert.equal(delivered.length,1);
 process.env.TENDRA_WRITE_MAINTENANCE='1';
 // Every literal SQL operation in application code: execute through the real gate.
 // This is exhaustive over current literal query sites, rather than one happy-path per domain.
 let writes=0,reads=0;
 for(const filename of files(path.join(root,'api')).filter(f=>f.endsWith('.js')&&!f.endsWith('_write-maintenance.js'))){
  const source=fs.readFileSync(filename,'utf8');
  if(source.includes("require('pg')"))assert.equal(path.basename(filename),'_boards-storage.js','new unguarded PostgreSQL entry point');
  for(const m of source.matchAll(/\.query\(\s*(`(?:\\[\s\S]|[^`])*`|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*")/g)){
   const sql=m[1].slice(1,-1).replace(/\$\{[\s\S]*?\}/g,'');
   const mutating=/^\s*(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|CALL|DO)\b/i.test(sql)||(/^\s*WITH\b/i.test(sql)&&/\b(INSERT|UPDATE|DELETE)\b/i.test(sql))||/brand_knowledge_private\.(write_brand|create_brand|lifecycle)/.test(sql);
   if(mutating){await blocked(()=>pool.query(sql));await blocked(async()=>{const c=await pool.connect();try{await c.query(sql);}finally{c.release();}});writes++;}
   else if(/^\s*(SELECT|WITH)\b/i.test(sql)){assert(gate.isReadQuery(sql),filename+': read rejected: '+sql);await pool.query(sql);reads++;}
  }
 }
 assert(writes>100);assert(reads>100);
 const previewSql='SELECT brand_knowledge_private.write_brand($1,$2::uuid,$3::jsonb,$4::jsonb,$5) AS outcome';
 await pool.query(previewSql,['owner', 'brand', '{}', null, true]);
 await blocked(()=>pool.query(previewSql,['owner', 'brand', '{}', null, false]));
 await blocked(()=>pool.query(previewSql,['owner', 'brand', '{}', null, 'true']));
 await pool.query({text:previewSql,values:['owner','brand','{}',null,true]});
 await new Promise((resolve,reject)=>pool.query({text:previewSql,values:['owner','brand','{}',null,true]},error=>error?reject(error):resolve()));
 await pool.query("SET LOCAL lock_timeout='5s'");
 for(const sql of ['WITH x AS (DELETE FROM boards RETURNING *) SELECT * FROM x','SELECT * INTO backup FROM brands','SELECT "brand_knowledge_private"."write_brand"($1)','SELECT public.unknown_writer()','SELECT nextval($1)','SELECT pg_catalog.set_config($1,$2,false)','SELECT 1; DELETE FROM brands','TRUNCATE brands','SET default_transaction_read_only=off'])await blocked(()=>pool.query(sql));
 for(const sql of ["SELECT 'DELETE; UPDATE brands' AS value",'/* comment */ SELECT count(*) FROM boards','BEGIN','ROLLBACK','COMMIT'])await pool.query(sql);
 await new Promise(resolve=>pool.query('DELETE FROM boards',error=>{assert.equal(error.code,gate.CODE);resolve();}));
 await new Promise((resolve,reject)=>pool.connect((error,c,release)=>{if(error)return reject(error);c.query('UPDATE boards SET name=$1',[],error=>{assert.equal(error.code,gate.CODE);release();resolve();});}));
 console.log(`PASS ${writes} application mutation SQL sites blocked through pool and transaction clients; ${reads} read SQL sites allowed; callback APIs guarded`);
 // All transitively database-dependent HTTP handlers must retain a response boundary.
 const apis=files(path.join(root,'api')).filter(f=>f.endsWith('.js'));
 const sources=new Map(apis.map(f=>[f,fs.readFileSync(f,'utf8')]));
 function reaches(file,seen=new Set()){if(file.endsWith('/_boards-storage.js'))return true;if(seen.has(file))return false;seen.add(file);return [...(sources.get(file)||'').matchAll(/require\(['"]([^'"]+)['"]\)/g)].some(m=>m[1].startsWith('.')&&reaches(path.resolve(path.dirname(file),m[1]+'.js'),seen));}
 let routes=0;
 for(const [file,src] of sources){if(!path.basename(file).startsWith('_')&&/module\.exports\s*=\s*(?:async\b|createHandler\(|handler\b|require\([^\n]+\)\.handler\()/.test(src)&&reaches(file)){assert(src.includes('.withMaintenanceResponse(module.exports)'),file);routes++;}}
 assert(routes>=50);console.log(`PASS ${routes} database-dependent HTTP routes retain central response boundary`);
 const swallowed=gate.withMaintenanceResponse(async(req,res)=>{try{await pool.query('DELETE FROM brands');}catch{}res.statusCode=303;res.setHeader('location','/success');return res.end('{}');});
 maintenance(await invoke(swallowed,{}));
 const interleaved=await Promise.all([invoke(swallowed,{}),invoke(gate.withMaintenanceResponse(async(req,res)=>res.json({read:true})),{})]);maintenance(interleaved[0]);assert.equal(interleaved[1].statusCode,200);
 const id='11111111-1111-4111-8111-111111111111',user={email:'owner@example.test'};
 const storage={pool,ensureBoardsTable:async()=>{},ensureBrandsTable:async()=>{}};
 require.cache[path.join(root,'api/_boards-storage.js')]={id:path.join(root,'api/_boards-storage.js'),filename:path.join(root,'api/_boards-storage.js'),loaded:true,exports:storage};
 const auth={getSessionUser:req=>req.user};
 let access={canEdit:true,canView:true,canRead:true,canManageBrandMembers:true,canManageBrandAdmins:true,role:'owner'};
 const boardAccess={normalizeEmail:v=>(v||'').toLowerCase(),refreshOwnEditorIdentity:async()=>{},getBoardAccess:async()=>({board:{id,owner_email:user.email,updated_at:'2026-01-01'},access})};
 const boards=load('api/boards/[id].js',{'../_auth-session':auth,'../_boards-storage':storage,'../_board-access':boardAccess,'../_document-storage':{}});
 maintenance(await invoke(boards,{method:'PUT',query:{id},user,body:{canvas_json:{nodes:[]}}}));
 access={...access,canEdit:false};assert.equal((await invoke(boards,{method:'PUT',query:{id},user,body:{canvas_json:{nodes:[]}}})).statusCode,403);access={...access,canEdit:true};
 const members=load('api/brands/[id]/members.js',{'../../_auth-session':auth,'../../_board-access':boardAccess,'../../_brands-storage':storage,'../../_brand-access':{isBrandId:()=>true,getBrandAccess:async()=>({brand:{id,owner_email:user.email},access})}});
 maintenance(await invoke(members,{method:'POST',query:{id},user,body:{email:'other@example.test',role:'editor'}}));
 assert.equal((await invoke(members,{method:'GET',query:{id},user})).statusCode,200);
 assert.equal((await invoke(members,{method:'POST',query:{id},body:{email:'other@example.test',role:'editor'}})).statusCode,401);
 console.log('PASS real Board PUT and Brand member POST return retryable 503; forbidden and unauthenticated requests retain 403/401; member GET works');
 // Real Workspace rename, Project creation and Learning proposal control flow:
 // authorization reads run, and the first mutation never reaches the driver.
 const identity={id,canonical_email:user.email,status:'active',revision:'1'};
 readResult=sql=>{
  if(/FROM public.app_identities/.test(sql))return{rows:[identity],rowCount:1};
  if(/FROM public.workspaces/.test(sql))return{rows:[{id,name:'Existing',status:'active',revision:1}],rowCount:1};
  if(/FROM public.workspace_memberships/.test(sql))return{rows:[{role:'owner',status:'accepted'}],rowCount:1};
  if(/FROM public.brands b/.test(sql))return{rows:[{id,name:'Brand',revision:1,role:'owner'}],rowCount:1};
  return{rows:[],rowCount:0};
 };
 const workspaces=load('api/workspaces.js',{'./_auth-session':auth,'./_boards-storage':storage});
 maintenance(await invoke(workspaces,{method:'PATCH',user,body:{contract:'workspace_update_v1',workspace_id:id,expected_revision:1,name:'New name',request_id:'fixture-rename'}}));
 const workspaceRead=workspaces.createHandler({db:pool,sessionReader:()=>user,catalogLoader:async()=>[]});
 assert.equal((await invoke(workspaceRead,{method:'GET'})).statusCode,200);
 const executor=load('api/_project-command.js',{'./_brand-access':{getBrandAccess:async()=>({brand:{id,workspace_id:id,name:'Brand',brand_core:{},revision:1},access:{role:'owner',canCreateBrandBoards:true}})}});
 const projects=load('api/projects.js',{'./_auth-session':auth,'./_boards-storage':storage,'./_project-command':executor});
 maintenance(await invoke(projects,{method:'POST',user,body:{contract:'project_command_v1',workspace_id:id,project_name:'Project',request_id:'fixture-project',brand:{existing_id:id}}}));
 const learning=load('api/_brand-learnings.js');
 const learnings=load('api/brands/[id]/learnings.js',{'../../_auth-session':auth,'../../_boards-storage':storage,'../../_brand-learnings':learning});
 maintenance(await invoke(learnings,{method:'POST',user,query:{id},body:{expected_brand_revision:'1',statement:'A useful learning',evidence_summary:'Fixture evidence'}}));
 console.log('PASS real Workspace rename, Project creation and Learning proposal stop before writes; Workspace catalog GET remains available');
 readResult={rows:[],rowCount:0};
 // Disabled document ingestion still returns the maintenance retry contract for
 // authorized mutation attempts; cleanup of an old pending intent cannot write.
 const docRecords={pool,SOURCE_TYPES:new Set(['pitch_deck']),verifySourceTile:()=>true,ensureDocumentTables:async()=>{},getActiveDocument:async()=>null,publicDocument:x=>x};
 const doc=load('api/_document-route.js',{'./_auth-session':auth,'./_board-access':boardAccess,'./_document-records':docRecords,'./_document-processing-records':{},'./_document-storage':{}});
 for(const op of ['intent','complete']){
  readResult={rows:[{id,status:'pending'}],rowCount:1};
  const handler=load('api/documents/'+(op==='intent'?'upload-intent':op)+'.js',{'../_document-route':doc});
  maintenance(await invoke(handler,{method:'POST',user,body:{boardId:id,tileId:'tile',sourceType:'pitch_deck'}}));
 }
 const metadata=gate.withMaintenanceResponse(doc.handler('metadata'));
 assert.equal((await invoke(metadata,{method:'GET',user,query:{boardId:id,tileId:'tile',sourceType:'pitch_deck'}})).statusCode,200);
 const worker=load('api/_document-processing-route.js',{'./_document-route':doc,'./_document-records':docRecords,'./_document-processing-records':{}});
 let scans=0;await blocked(()=>worker.processClaimedJob({row:{id}}, {configured:true,scan:async()=>{scans++;}}));assert.equal(scans,0);
 // OAuth is GET but writes consumed state; its legacy redirect must become 503.
 for(const provider of ['linkedin','facebook']){
  const route={requestId:()=> 'fixture-request-id',user:req=>req.user?.email,fingerprint:()=> 'session',ensure:async()=>{},service:()=>({complete:async()=>pool.query('UPDATE social_oauth_attempts SET consumed_at=NOW()')})};
  const overrides={'./social-connector-route':route,'./_boards-storage':storage};
  if(provider==='facebook')overrides['./social-connector/facebook-service']={createService:route.service,diagnostic:code=>({code}),outcome:code=>code};
  const callback=load('api/social-connections-'+provider+'-callback.js',overrides);
  maintenance(await invoke(callback,{method:'GET',user,url:'/?state=fixture&code=fixture'}));
 }
 console.log('PASS document upload/cleanup and direct scanner job stop; document metadata reads work; both real OAuth GET callbacks return 503 instead of redirects');
 // Optional Board GET repair is skipped, not reported as a failed read.
 delivered=[];const realAccess=load('api/_board-access.js',{'./_boards-storage':storage});assert.equal(await realAccess.refreshOwnEditorIdentity(id,user),false);assert.equal(delivered.length,0);
 // Already accepted Social jobs must remain readable without reconciliation writes.
 for(const name of ['publishing-service','facebook-publishing-service']){
  const serviceModule=load('api/social-connector/'+name+'.js',{'../_boards-storage':storage});
  const factory=serviceModule.createPublishingService||serviceModule.createFacebookPublishingService;
  const service=factory({pool,adapter:{}});
  for(const fixture of [{external_post_id:'post',delivery_state:'confirmed',status:'delivering'}, {provider_attempt_state:'accepted',provider_request_reference:'123_456',status:'delivering'}]){
   readResult={rowCount:1,rows:[{id,owner_account_id:user.email,...fixture}]};delivered=[];await service.jobResult(id,user.email);assert.equal(delivered.length,1);assert.match(delivered[0],/^SELECT/);
  }
  await blocked(()=>service.publish({},user));
 }
 console.log('PASS LinkedIn/Facebook status reads skip both repairs; direct publishing jobs stop before provider work');
 process.env.TENDRA_WRITE_MAINTENANCE='0';delivered=[];await pool.query('UPDATE boards SET name=$1',['restored']);assert.equal(delivered.length,1);
 console.log('PASS deactivation restores writes without changing data or schema');
 }finally{if(previous===undefined)delete process.env.TENDRA_WRITE_MAINTENANCE;else process.env.TENDRA_WRITE_MAINTENANCE=previous;if(dbUrl===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=dbUrl;}
})().catch(error=>{console.error(error);process.exitCode=1;});
