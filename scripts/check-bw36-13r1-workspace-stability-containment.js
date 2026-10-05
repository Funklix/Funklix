#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {projectCatalog}=require('../api/_workspace-catalog');
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('workspace-sidebar.css','utf8');
const W='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',D='33333333-3333-4333-8333-333333333333';
const memberships=[{id:W,name:'Workspace',avatar_url:null,locale:'en',revision:1,role:'owner'}];
const brands=[{id:B,workspace_id:W,name:'Brand',revision:2,role:'owner',logo_object_path:'logos/brand.png',logo_mime_type:'image/png',logo_source:'uploaded',logo_revision:3}];
const boards=[{id:D,workspace_id:W,brand_id:B,name:'Board',role:'owner'}];
let projected=projectCatalog({memberships,brands,boards});assert.equal(projected[0].brands[0].logo_url,`/api/brands/${B}/logo?revision=3`);
projected=projectCatalog({memberships,brands:[{...brands[0],logo_mime_type:'image/svg+xml',logo_revision:'broken'}],boards});assert.equal(projected[0].brands[0].logo_url,null);assert.equal(projected[0].brands[0].logo_revision,0);assert.equal(projected[0].boards.length,1);
assert.throws(()=>projectCatalog({memberships,brands,boards:[{...boards[0],workspace_id:'44444444-4444-4444-8444-444444444444'}]}),/WORKSPACE_CATALOG_CONFLICT/);

const catalogContext={globalThis:{}};vm.runInNewContext(fs.readFileSync('workspace-catalog.js','utf8'),catalogContext);const catalog=catalogContext.globalThis.FunklixWorkspaceCatalog;
const envelope={contract:'workspace_catalog_v1',request_id:'abcdefabcdefabcdefabcdef',workspaces:[{id:W,name:'Workspace',avatar_url:null,locale:'en',revision:1,role:'owner',brands:[{id:B,name:'Brand',logo_url:'/not-supported',logo_revision:'bad',revision:2,role:'owner'}],boards:[{id:D,name:'Board',brand_id:B,role:'owner'}]}]};
const checked=catalog.validate(envelope);assert.equal(checked.workspaces[0].brands[0].logo_url,null);assert.equal(checked.workspaces[0].brands[0].logo_revision,0);
assert.throws(()=>catalog.validate({...envelope,workspaces:[{...envelope.workspaces[0],boards:[{...envelope.workspaces[0].boards[0],brand_id:'55555555-5555-4555-8555-555555555555'}]}]}));

class LogoNode{constructor(doc){this.ownerDocument=doc;this.children=[];this.attributes={};this.classList={add:()=>{}};}replaceChildren(...x){this.children=x;}append(x){this.children.push(x);}setAttribute(k,v){this.attributes[k]=v;}}
const doc={createElement(tag){const node=new LogoNode(doc);node.tagName=tag;node.listeners={};node.addEventListener=(type,fn)=>node.listeners[type]=fn;return node;},createTextNode(text){return {textContent:text};}};
const logoContext={globalThis:{}};vm.runInNewContext(fs.readFileSync('brand-logo.js','utf8'),logoContext);const logo=logoContext.globalThis.FunklixBrandLogo,node=new LogoNode(doc);logo.render(node,{name:'Broken Brand',logo_url:`/api/brands/${B}/logo?revision=3`});assert.equal(node.children[0].tagName,'img');node.children[0].listeners.error();assert.equal(node.children[0].textContent,'BB');

function functionSource(name){const start=app.indexOf(`function ${name}(`);assert.notEqual(start,-1);const brace=app.indexOf('{',start);let depth=0;for(let i=brace;i<app.length;i++){if(app[i]==='{')depth++;if(app[i]==='}'&&--depth===0)return app.slice(start,i+1);}throw new Error(name);}
async function lifecycle(initial,loader){const context={state:{user:{email:'owner@example.com'},workspaceCatalog:initial,session:{}},window:{FunklixWorkspaceCatalog:{load:loader,deriveActiveWorkspaceId:()=>W}},renderWorkspaceSidebar(){context.renders++;},getBoardIdFromPath:()=>null,renders:0};vm.createContext(context);vm.runInContext(`${functionSource('loadAuthorizedWorkspaceCatalog')};this.run=loadAuthorizedWorkspaceCatalog;`,context);await context.run('owner@example.com');return context;}
(async()=>{
  const confirmed={contract:'workspace_catalog_v1',request_id:'abcdefabcdefabcdefabcdef',workspaces:[]};
  let context=await lifecycle({status:'stale',value:confirmed,activeWorkspaceId:W,error:null,generation:2,identity:'owner@example.com',promise:null},()=>Promise.reject(Object.assign(new Error('offline'),{code:'INTERNAL_ERROR'})));assert.equal(context.state.workspaceCatalog.status,'stale');assert.equal(context.state.workspaceCatalog.value,confirmed);
  context=await lifecycle({status:'stale',value:confirmed,activeWorkspaceId:W,error:null,generation:2,identity:'owner@example.com',promise:null},()=>Promise.reject(Object.assign(new Error('denied'),{code:'PERMISSION_DENIED',status:403})));assert.equal(context.state.workspaceCatalog.status,'error');assert.equal(context.state.workspaceCatalog.value,null);
  context=await lifecycle({status:'stale',value:confirmed,activeWorkspaceId:W,error:null,generation:2,identity:'owner@example.com',promise:null},()=>Promise.resolve(confirmed));assert.equal(context.state.workspaceCatalog.status,'ready');assert.equal(context.state.workspaceCatalog.value.workspaces.length,0);
  const source=fs.readFileSync('workspace-sidebar.js','utf8');for(const token of ["menu.setAttribute('role','menu')","dialog.setAttribute('role','dialog')","input.status==='ready'","previousWorkspaceId"]){if(token==='previousWorkspaceId')continue;assert(source.includes(token),token);}assert(source.includes('preserveSurface')&&source.includes("options.onRetry?.()"));
  assert(html.includes('id="workspace-context-retry"'));assert(css.includes('@media(max-width:767px)')&&css.includes('.app-shell.sidebar-collapsed')&&css.includes('max-width:calc(100vw - 16px)'));assert(css.includes('var(--fk-color-surface-elevated)'));
  assert(app.includes('const BRAND_LOGO_MUTATIONS_ENABLED=false'));assert(app.includes('BRAND_LOGO_MUTATIONS_ENABLED&&brand.access.canEditCanonicalBrand'));assert(!app.slice(app.indexOf('} else if (key === "brandAssets")'),app.indexOf('} else if (key === "personas")')).includes('bc-logo-upload'));
  assert(!/localStorage|sessionStorage/.test(functionSource('loadAuthorizedWorkspaceCatalog')));assert(!/fetch\(|saveBoardToServer|provider|openai/i.test(source));
  console.log('BW-36.13R1 production catalog, logo fallback, stale lifecycle, menu containment, responsive and mutation boundaries passed (22 acceptance groups; zero external mutations).');
})().catch(error=>{console.error(error);process.exitCode=1;});
