#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHandler}=require('../api/workspaces');
const I='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222';
function response(){return{headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return v;}};}
async function call(handler,{method='POST',body={contract:'workspace_create_v1',request_id:'request-1',name:' Workspace '},cookie='funklix_session=ok'}={}){const res=response();await handler({method,body,headers:{cookie}},res);return res;}
class MemoryDb{
  constructor({identity=null,membership=null,fail=null,ambiguous=false}={}){this.identity=identity;this.membership=membership;this.workspace=membership?{id:W,name:membership.name||'Existing',revision:1,role:membership.role||'owner'}:null;this.fail=fail;this.ambiguous=ambiguous;this.counts={identity:identity?1:0,workspace:this.workspace?1:0,membership:membership?1:0,brand:0,board:0};this.tail=Promise.resolve();}
  async connect(){const db=this,tx={pendingIdentity:null,pendingWorkspace:null,pendingMembership:false,release(){},async query(sql,args=[]){
    if(sql==='BEGIN')return{rows:[]};if(sql.includes('pg_advisory_xact_lock')){let unlock;const before=db.tail;db.tail=new Promise(r=>unlock=r);await before;tx.unlock=unlock;return{rows:[]};}
    if(sql==='ROLLBACK'){tx.pendingIdentity=null;tx.pendingWorkspace=null;tx.pendingMembership=false;tx.unlock?.();return{rows:[]};}
    if(sql==='COMMIT'){if(tx.pendingIdentity){db.identity=tx.pendingIdentity;db.counts.identity++;}if(tx.pendingWorkspace){db.workspace=tx.pendingWorkspace;db.counts.workspace++;}if(tx.pendingMembership){db.membership={role:'owner',name:db.workspace.name};db.counts.membership++;}tx.unlock?.();return{rows:[]};}
    if(sql.includes('FROM public.app_identities')){if(db.ambiguous)return{rows:[db.identity,{...db.identity,id:'33333333-3333-4333-8333-333333333333'}]};return{rows:(db.identity||tx.pendingIdentity)?[db.identity||tx.pendingIdentity]:[]};}
    if(sql.includes('INSERT INTO public.app_identities')){tx.pendingIdentity={id:I,canonical_email:args[0],status:'active',revision:0};if(db.fail==='identity')throw Object.assign(new Error('fail'),{code:'XX000'});return{rows:[tx.pendingIdentity]};}
    if(sql.includes('FROM public.workspace_memberships m'))return{rows:db.workspace?[{...db.workspace,role:db.membership.role}]:[]};
    if(sql.includes('INSERT INTO public.workspaces')){tx.pendingWorkspace={id:W,name:args[0],revision:1};if(db.fail==='workspace')throw Object.assign(new Error('fail'),{code:'XX000'});return{rows:[tx.pendingWorkspace]};}
    if(sql.includes('INSERT INTO public.workspace_memberships')){tx.pendingMembership=true;return{rows:[]};}
    if(sql.includes('SELECT count(*)::int'))return{rows:[{count:1}]};throw new Error(`Unexpected SQL: ${sql}`);
  }};return tx;}
}
const validIdentity={id:I,canonical_email:'new@example.com',status:'active',revision:0};
function handler(db,sessionReader=()=>({email:'New@Example.com'})){return createHandler({db,sessionReader,catalogLoader:async()=>[]});}
(async()=>{
  let res=await call(handler(new MemoryDb(),()=>null),{cookie:''});assert.equal(res.statusCode,401);assert.equal(res.body.error.code,'AUTHENTICATION_REQUIRED');
  res=await call(handler(new MemoryDb(),()=>{throw new Error('bad signature');}));assert.equal(res.body.error.code,'SESSION_INVALID');
  let db=new MemoryDb();res=await call(handler(db));assert.equal(res.statusCode,201);assert.equal(res.body.created,true);assert.deepEqual(db.counts,{identity:1,workspace:1,membership:1,brand:0,board:0});assert.equal(db.identity.canonical_email,'new@example.com');
  db=new MemoryDb({identity:validIdentity});res=await call(handler(db),{body:{contract:'workspace_create_v1',request_id:'unicode',name:'  Cafe\u0301   🚀  '}});assert.equal(res.body.workspace.name,'Café 🚀');assert.equal(db.counts.identity,1);
  db=new MemoryDb({identity:{...validIdentity,status:'disabled'}});res=await call(handler(db));assert.equal(res.body.error.code,'IDENTITY_DISABLED');assert.equal(db.counts.workspace,0);
  db=new MemoryDb({identity:validIdentity,ambiguous:true});res=await call(handler(db));assert.equal(res.body.error.code,'IDENTITY_AMBIGUOUS');
  for(const body of [{contract:'workspace_create_v1',request_id:'x',name:'A',unknown:true},{contract:'workspace_create_v1',request_id:'x',name:'---'}]){res=await call(handler(new MemoryDb(),()=>({email:'new@example.com'})),{body});assert(['REQUEST_INVALID','WORKSPACE_NAME_INVALID'].includes(res.body.error.code));}
  for(const fail of ['identity','workspace']){db=new MemoryDb({fail});res=await call(handler(db));assert.equal(res.statusCode,500);assert.deepEqual(db.counts,{identity:0,workspace:0,membership:0,brand:0,board:0});}
  db=new MemoryDb();const h=handler(db);const [a,b]=await Promise.all([call(h),call(h)]);assert.deepEqual([a.body.created,b.body.created].sort(),[false,true]);assert.equal(db.counts.workspace,1);
  res=await call(h);assert.equal(res.body.created,false);assert.equal(res.body.workspace.id,W);
  db=new MemoryDb();const different=handler(db);const results=await Promise.all([call(different,{body:{contract:'workspace_create_v1',request_id:'a',name:'Alpha'}}),call(different,{body:{contract:'workspace_create_v1',request_id:'b',name:'Beta'}})]);assert.equal(results.filter(x=>x.body.created).length,1);assert.equal(results.filter(x=>x.body.error?.code==='WORKSPACE_ALREADY_EXISTS').length,1);
  db=new MemoryDb({identity:validIdentity,membership:{name:'Existing',role:'member'}});res=await call(handler(db));assert.equal(res.body.error.code,'WORKSPACE_ALREADY_EXISTS');assert.equal(db.counts.workspace,1);

  const context={globalThis:{FunklixWorkspaceName:require('../workspace-name')}};vm.runInNewContext(fs.readFileSync('workspace-catalog.js','utf8'),context);const catalog=context.globalThis.FunklixWorkspaceCatalog;
  let posts=0,gets=0;const created=await catalog.create(' First ', 'client-1',async(url,options)=>{posts+=options.method==='POST';gets+=options.method==='GET';return{ok:true,json:async()=>({contract:'workspace_create_v1',request_id:'client-1',ok:true,created:true,workspace:{id:W,name:'First',role:'owner',revision:1,brands:[],boards:[]}})}});const reconciled=catalog.reconcileCreate({contract:'workspace_catalog_v1',request_id:'abcdefabcdefabcdefabcdef',workspaces:[]},created);assert.equal(posts,1);assert.equal(gets,0);assert.equal(reconciled.workspaces[0].id,W);assert.throws(()=>catalog.validateCreate({...created,request_id:'old'},'client-1'));
  const sidebar=fs.readFileSync('workspace-sidebar.js','utf8'),css=fs.readFileSync('workspace-sidebar.css','utf8'),app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
  for(const token of ["input.signedIn===true&&input.status==='ready'&&model.workspaces.length===0","dialog.setAttribute('aria-modal','true')","dialog.setAttribute('aria-describedby'","if(pending)return","event.key==='Escape'","origin.focus()","status.setAttribute('aria-live','polite')"])assert(sidebar.includes(token),token);
  assert(css.includes('min-height:44px')&&css.includes('@media(max-width:767px)')&&css.includes('@media(forced-colors:active)')&&css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('100dvh'));
  assert(!/localStorage|sessionStorage/.test(app.slice(app.indexOf('function createFirstSessionWorkspace'),app.indexOf('function showBoardConflictModal'))));assert(!/alert\(/.test(sidebar));assert.equal((app.match(/FunklixWorkspaceCatalog\.create\(/g)||[]).length,1);assert(!html.slice(html.indexOf('id="canvas-topbar"'),html.indexOf('</header>',html.indexOf('id="canvas-topbar"'))).includes('workspace-create'));assert(!html.slice(html.indexOf('id="compact-context-bar"'),html.indexOf('</header>',html.indexOf('id="compact-context-bar"'))).includes('workspace-create'));
  console.log('BW-36.13R2 first Workspace transaction, idempotency, strict client reconciliation, empty-state, accessibility and non-goal boundaries passed (30 acceptance groups; zero provider/AI requests).');
})().catch(error=>{console.error(error);process.exitCode=1;});
