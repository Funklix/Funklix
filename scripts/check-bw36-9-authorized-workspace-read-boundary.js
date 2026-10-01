'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const root = path.resolve(__dirname, '..');
const ids = {
  identity: '11111111-1111-4111-8111-111111111111', workspace: '22222222-2222-4222-8222-222222222222', workspace2: '22222222-2222-4222-8222-222222222223',
  brand: '33333333-3333-4333-8333-333333333333', brand2: '33333333-3333-4333-8333-333333333334', board: '44444444-4444-4444-8444-444444444444'
};
let passed = 0;
async function test(name, fn) { try { await fn(); console.log(`ok - ${name}`); passed += 1; } catch (error) { console.error(`not ok - ${name}`); throw error; } }
function response() { return { headers: {}, statusCode: 0, body: null, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;} }; }
function loadBrowser() { const context = { globalThis: {}, fetch: null }; context.globalThis = context; vm.runInNewContext(fs.readFileSync(path.join(root,'workspace-catalog.js'),'utf8'), context); return context.FunklixWorkspaceCatalog; }
function payload(workspaces) { return { contract:'workspace_catalog_v1', request_id:'0123456789abcdef01234567', workspaces }; }
function workspace(overrides={}) { return { id:ids.workspace,name:'Invented Workspace',avatar_url:null,locale:'en',revision:1,role:'owner',brands:[],boards:[],...overrides }; }

(async()=>{
  const browser=loadBrowser();
  await test('strict valid owner, multi-Brand and single-Brand contracts',()=>{
    const valid=payload([workspace({brands:[{id:ids.brand,name:'A',avatar_url:null,revision:1,role:'owner'},{id:ids.brand2,name:'B',avatar_url:null,revision:2,role:'viewer'}],boards:[{id:ids.board,name:'Board',brand_id:ids.brand,role:'owner'}]})]);
    assert.equal(browser.validate(valid).workspaces[0].brands.length,2);
    assert.equal(browser.validate(payload([workspace({brands:[valid.workspaces[0].brands[0]]})])).workspaces[0].brands.length,1);
  });
  await test('viewer/member visibility and exact role allowlists',()=>{
    assert.equal(browser.validate(payload([workspace({role:'viewer',brands:[{id:ids.brand,name:'Allowed',avatar_url:null,revision:0,role:'editor'}]})])).workspaces[0].brands.length,1);
    for(const [area,role] of [['workspace','editor'],['brand','member'],['board','admin']]) { const w=workspace(); if(area==='workspace')w.role=role;if(area==='brand')w.brands=[{id:ids.brand,name:'A',avatar_url:null,revision:1,role}];if(area==='board')w.boards=[{id:ids.board,name:'B',brand_id:null,role}]; assert.throws(()=>browser.validate(payload([w])),/invalid/); }
  });
  await test('duplicates, malformed contract and cross relationships are rejected',()=>{
    assert.throws(()=>browser.validate({...payload([]),extra:true}),e=>e.code==='RESPONSE_INVALID');
    assert.throws(()=>browser.validate(payload([workspace(),workspace()])),e=>e.code==='RESPONSE_INVALID');
    assert.throws(()=>browser.validate(payload([workspace({brands:[{id:ids.brand,name:'A',avatar_url:null,revision:1,role:'owner'}]}),workspace({id:ids.workspace2,brands:[{id:ids.brand,name:'A',avatar_url:null,revision:1,role:'owner'}]})])),e=>e.code==='RESPONSE_INVALID');
    assert.throws(()=>browser.validate(payload([workspace({boards:[{id:ids.board,name:'B',brand_id:ids.brand,role:'viewer'}]})])),e=>e.code==='RESPONSE_INVALID');
  });
  await test('active context follows Board, Brand, singleton, then null',()=>{
    const one=browser.validate(payload([workspace({brands:[{id:ids.brand,name:'A',avatar_url:null,revision:1,role:'owner'}],boards:[{id:ids.board,name:'B',brand_id:ids.brand,role:'owner'}]})]));
    assert.equal(browser.deriveActiveWorkspaceId(one,{boardId:ids.board}),ids.workspace); assert.equal(browser.deriveActiveWorkspaceId(one,{brandId:ids.brand}),ids.workspace); assert.equal(browser.deriveActiveWorkspaceId(one,{}),ids.workspace);
    assert.equal(browser.deriveActiveWorkspaceId(browser.validate(payload([workspace(),workspace({id:ids.workspace2})])),{}),null);
  });
  await test('browser request is exact, same-origin, dependency-free and rejects malformed response',async()=>{
    let call; await browser.load(async(...args)=>{call=args;return {ok:true,json:async()=>payload([])};}); assert.deepEqual(call,['/api/workspaces',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'}}]);
    await assert.rejects(browser.load(async()=>({ok:true,json:async()=>({})})),e=>e.code==='RESPONSE_INVALID');
    const source=fs.readFileSync(path.join(root,'workspace-catalog.js'),'utf8'); assert(!/localStorage|sessionStorage|document\.|innerHTML|supabase|postgres|openai/i.test(source));
  });

  const originalLoad=Module._load; const fakePool={query:async()=>({rows:[]})};
  Module._load=function(request,parent,isMain){ if(request==='pg')return {Pool:function(){return fakePool;}}; return originalLoad.call(this,request,parent,isMain); };
  process.env.AUTH_SECRET='invented-test-secret';
  const route=require('../api/workspaces'); const { createSessionToken }=require('../api/_auth-session');
  function cookie(user){return `funklix_session=${encodeURIComponent(createSessionToken(user))}`;}
  function dbFor({identity=true,status='active',memberships=[],brands=[],boards=[],ambiguous=false,fail=null}={}) { let n=0; return {calls:[],async query(sql,params){this.calls.push({sql,params});if(fail)throw Object.assign(new Error('private'),{code:fail});n++;if(n===1)return {rows:identity?(ambiguous?[{id:ids.identity,canonical_email:'owner@example.test',status,revision:1},{id:'11111111-1111-4111-8111-111111111112',canonical_email:'owner@example.test',status,revision:1}]:[{id:ids.identity,canonical_email:'owner@example.test',status,revision:1}]):[]};if(n===2)return {rows:memberships};if(n===3)return {rows:brands};return {rows:boards};}}; }
  const membership={id:ids.workspace,name:'Invented Workspace',avatar_url:null,locale:'en',revision:1,role:'owner'};
  async function invoke(options={},req={method:'GET',headers:{cookie:cookie({email:' Owner@Example.Test '})}}){const db=dbFor(options);const res=response();await route.createHandler({db})(req,res);return {res,db};}
  await test('actual route verifies session, canonicalizes identity and projects authorized descendants',async()=>{
    const {res,db}=await invoke({memberships:[membership],brands:[{id:ids.brand,workspace_id:ids.workspace,name:'Allowed Brand',revision:1,role:'owner'}],boards:[{id:ids.board,workspace_id:ids.workspace,brand_id:ids.brand,name:'Allowed Board',role:'owner'}]});
    assert.equal(res.statusCode,200);assert.equal(res.body.contract,'workspace_catalog_v1');assert.equal(res.body.workspaces[0].boards.length,1);assert.equal(db.calls[0].params[0],'owner@example.test');assert.match(res.headers['Cache-Control'],/no-store/);
  });
  await test('no identity, no membership, revoked membership, inactive workspace and Board-only are empty',async()=>{
    assert.deepEqual((await invoke({identity:false})).res.body.workspaces,[]); assert.deepEqual((await invoke()).res.body.workspaces,[]);
    // The production query itself admits only accepted memberships joined to active Workspaces.
    const source=fs.readFileSync(path.join(root,'api/_workspace-catalog.js'),'utf8');assert.match(source,/m\.status = 'accepted'/);assert.match(source,/w\.status = 'active'/);
  });
  await test('disabled, ambiguous, method, authentication, database and cross-Workspace failures are bounded',async()=>{
    assert.equal((await invoke({status:'disabled'})).res.body.error.code,'IDENTITY_DISABLED');assert.equal((await invoke({ambiguous:true})).res.body.error.code,'IDENTITY_AMBIGUOUS');
    assert.equal((await invoke({}, {method:'POST',headers:{cookie:cookie({email:'owner@example.test'})}})).res.body.error.code,'METHOD_NOT_ALLOWED');
    assert.equal((await invoke({}, {method:'GET',headers:{}})).res.body.error.code,'AUTHENTICATION_REQUIRED');
    assert.equal((await invoke({}, {method:'GET',headers:{cookie:'funklix_session=malformed'}})).res.body.error.code,'SESSION_INVALID');
    assert.equal((await invoke({fail:'57P03'})).res.body.error.code,'DATABASE_UNAVAILABLE');assert.equal((await invoke({fail:'42P01'})).res.body.error.code,'WORKSPACE_SCHEMA_UNAVAILABLE');
    assert.equal((await invoke({memberships:[membership],brands:[{id:ids.brand,workspace_id:ids.workspace2,name:'Cross',revision:1,role:'owner'}]})).res.body.error.code,'WORKSPACE_CATALOG_CONFLICT');
  });
  Module._load=originalLoad;
  await test('catalog is read-only, private, and excludes forbidden material',()=>{
    // The catalog loader remains read-only; BW-36.11 chronologically adds an authorized PATCH to the flat route.
    const source=fs.readFileSync(path.join(root,'api/_workspace-catalog.js'),'utf8');
    assert(!/\b(INSERT|UPDATE|DELETE|UPSERT)\b/.test(source));assert(!/canvas_json|brand_core|snapshot|public_view_token|prompt|comment|schedule|publication/.test(source));assert(!/req\.(body|query)/.test(source));
  });
  await test('runtime lifecycle is isolated and registered before app',()=>{
    const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert(html.indexOf('/workspace-catalog.js')<html.indexOf('/app.js'));assert.match(app,/if \(current\.identity === identity && current\.promise\) return current\.promise/);assert.match(app,/clearWorkspaceCatalog\(\)/);assert.match(app,/state\.session\.workspaceId = null/);
    assert.equal((app.match(/FunklixWorkspaceCatalog\.load\(\)/g)||[]).length,1);assert(!/addEventListener\(["']resize["'][\s\S]{0,200}loadAuthorizedWorkspaceCatalog/.test(app));assert(!/theme[\s\S]{0,100}loadAuthorizedWorkspaceCatalog/.test(app));
  });
  await test('no UI, mutation, provider, AI, migration, or baseline scope change',()=>{
    if(fs.existsSync(path.join(root,'.git'))){const changed=require('child_process').execFileSync('git',['status','--short','--untracked-files=all'],{cwd:root,encoding:'utf8'});const unexpected=changed.split('\n').filter(Boolean).filter(line=>/migrations\//.test(line)&&!line.endsWith('migrations/20261001_bw36_12_brand_logo.sql'));assert.deepEqual(unexpected,[]);}
    const browserSource=fs.readFileSync(path.join(root,'workspace-catalog.js'),'utf8');assert(!/openai|googleapis|linkedin|facebook|anthropic|schedule|approval|publication/i.test(browserSource));
    for(const file of ['campaign-v3.js','content-workspace.js','automatic-planning.js','posting-plan-export.js','posting-plan-pdf.js','funnel-simulator.js','language.js','styles.css'])assert(fs.existsSync(path.join(root,file)));
  });
  await test('package and Runtime Boot Safety register BW-36.9 immediately after BW-36.8',()=>{
    const pkg=require('../package.json'),flow=fs.readFileSync(path.join(root,'.github/workflows/runtime-boot-safety.yml'),'utf8');assert.equal(pkg.scripts['check:bw36.9'],'node scripts/check-bw36-9-authorized-workspace-read-boundary.js');assert.equal(Object.keys(pkg.scripts).indexOf('check:bw36.9'),Object.keys(pkg.scripts).indexOf('check:bw36.8')+1);assert(flow.indexOf('check:bw36.9')>flow.indexOf('check:bw36.8'));
  });
  console.log(`BW-36.9 authorized Workspace read boundary checks passed (${passed}). Zero network/provider/AI/database requests or real mutations.`);
})().catch(()=>process.exitCode=1);
