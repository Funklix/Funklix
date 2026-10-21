'use strict';
// External database transport double only. Real signed-session, identity, route,
// authorization, normalization, transaction and lifecycle functions execute unchanged.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module'), { randomUUID } = require('node:crypto');
const { runtime, B, I, EMAIL, clone } = require('./bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname,'../..');
function learningRuntime({queryExtension,fetchImpl} = {}) {
  const base = runtime(), auth = base.load('api/_auth-session.js');
  const db = { learnings:[], events:[], role:'owner', identity:'active', missingSchema:false, failEvent:false, failCommit:false, queries:[] };
  let tx, queue = Promise.resolve();
  const rows = r => ({ rows:clone(r), rowCount:r.length });
  const state = () => tx || db;
  async function query(sql, args = []) {
    sql=sql.replace(/\s+/g,' ').trim(); db.queries.push({sql,args:clone(args)});
    if (sql.includes('SELECT tendra_runtime_private.lock_brand(')) return rows([]);
    if (sql === 'BEGIN') { tx=clone({learnings:db.learnings,events:db.events}); return rows([]); }
    if (sql === 'ROLLBACK') { tx=null; return rows([]); }
    if (sql === 'COMMIT') { if(db.failCommit)throw Object.assign(new Error('private failure'),{code:'ECONNREFUSED'}); Object.assign(db,tx);tx=null;return rows([]); }
    if (queryExtension) { const result=await queryExtension(sql,args,{db,base,transaction:state()}); if(result) return result; }
    if (sql.includes('FROM public.app_identities') && !sql.includes('brand_learnings') && !sql.includes('brand_learning_events')) {
      return rows(db.identity === 'missing' ? [] : db.identity === 'ambiguous' ? [{},{}] : [{id:I,canonical_email:EMAIL,status:db.identity,revision:'1'}]);
    }
    if (sql.includes('FROM public.brands b')) return rows(db.role && args[0]===B && args[1]===EMAIL && base.db.brands.length ? [{id:B,name:base.db.brands[0].name,revision:String(base.db.brands[0].revision),role:db.role}]:[]);
    if (sql.includes('FROM public.brand_members WHERE')) return rows(db.role && db.role!=='owner' ? [{role:db.role}]:[]);
    if (sql.includes('FROM public.boards') || sql.includes(' FROM boards WHERE')) {
      const board=base.db.boards.find(b=>b.id===args[0]);
      if(sql.includes('AS current'))return rows([{current:!!board && board.updated_at===args[1]}]);
      return rows(board?[{...board,source_updated_at:board.updated_at}]:[]);
    }
    if (sql.includes('SELECT workspace_id FROM public.brands'))return rows(base.db.brands.filter(b=>b.id===args[0]));
    if (sql.includes('FROM board_editors'))return rows([]);
    if (db.missingSchema) throw Object.assign(new Error('private schema details'),{code:'42P01'});
    const s=state();
    if (sql.startsWith('INSERT INTO public.brand_learnings')) {
      const now=new Date().toISOString(), row={id:randomUUID(),brand_id:args[0],status:'proposed',statement:args[1],statement_key:args[2],evidence_summary:args[3],proposed_by_identity_id:args[4],supersedes_learning_id:args[5],source_type:args[6]||'manual',...(args.length>6?Object.fromEntries(['source_board_id','source_node_id','source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'].map((k,i)=>[k,args[7+i]])):{}),reviewed_by_identity_id:null,reviewed_at:null,revision:'0',created_at:now,updated_at:now};s.learnings.push(row);return rows([row]);
    }
    if (sql.startsWith('INSERT INTO public.brand_learning_events')) {
      if(db.failEvent)throw new Error('private event failure');
      s.events.push({id:randomUUID(),brand_id:args[0],learning_id:args[1],event_type:args[2],actor_identity_id:args[3],previous_status:args[4],next_status:args[5],learning_revision:String(args[6]),snapshot:JSON.parse(args[7]),created_at:new Date().toISOString()});return rows([]);
    }
    if (sql.startsWith('UPDATE public.brand_learnings')) {
      const row=s.learnings.find(l=>l.brand_id===args[0]&&l.id===args[1]); if(!row)return rows([]);
      if(sql.includes('statement=$3'))Object.assign(row,{statement:args[2],statement_key:args[3],evidence_summary:args[4]});
      else {row.status=sql.includes("status='archived'")?'archived':args[2];if(row.status!=='archived'){row.reviewed_by_identity_id=args[3];row.reviewed_at=new Date().toISOString();}}
      row.revision=String(BigInt(row.revision)+1n);row.updated_at=new Date().toISOString();return rows([row]);
    }
    if (sql.includes('FROM public.brand_learning_events')) return rows(s.events.filter(e=>e.brand_id===args[0]&&e.learning_id===args[1]).slice().reverse().slice(0,10).map(e=>({...e,actor:'Fixture reviewer'})));
    if (sql.includes('GROUP BY status')) {const c={};for(const l of s.learnings.filter(l=>l.brand_id===args[0]))c[l.status]=(c[l.status]||0)+1;return rows(Object.entries(c).map(([status,count])=>({status,count})));}
    if (sql.includes('SELECT l.*')) return rows(s.learnings.filter(l=>l.brand_id===args[0]&&(args[1]==='all'||l.status===args[1])).sort((a,b)=>['proposed','approved','rejected','archived'].indexOf(a.status)-['proposed','approved','rejected','archived'].indexOf(b.status)||b.updated_at.localeCompare(a.updated_at)).slice(args[2],args[2]+51).map(l=>({...l,proposer:'Fixture proposer',reviewer:'Fixture reviewer'})));
    if (sql.includes('FROM public.brand_learnings')) {
      let list=s.learnings.filter(l=>l.brand_id===args[0]);
      if(sql.includes('statement_key'))list=list.filter(l=>l.statement_key===args[1]);
      else if(sql.includes('supersedes_learning_id = $2'))list=list.filter(l=>l.supersedes_learning_id===args[1]);
      else if(sql.includes('id = $2')||sql.includes('id=$2'))list=list.filter(l=>l.id===args[1]);
      if(sql.includes("status IN ('proposed','approved')"))list=list.filter(l=>['proposed','approved'].includes(l.status)&&(!args[2]||l.id!==args[2])&&(!args[3]||l.id!==args[3]||l.status!=='approved'));
      else if(sql.includes("status='approved'"))list=list.filter(l=>l.status==='approved'&&(!args[2]||l.id!==args[2]));
      else if(sql.includes("status = 'proposed'"))list=list.filter(l=>l.status==='proposed');
      return rows(list);
    }
    throw new Error('Unimplemented fixture SQL: '+sql);
  }
  const pool={connect:async()=>{const previous=queue;let unlock;queue=new Promise(resolve=>{unlock=resolve;});await previous;return {query,release:unlock};}};
  const modules=new Map();
  function load(relative) {
    if(modules.has(relative))return modules.get(relative).exports;
    const file=path.join(ROOT,relative), local=createRequire(file), module={exports:{}};modules.set(relative,module);
    function req(name) {
      if(!name.startsWith('.'))return local(name);
      const resolved=path.relative(ROOT,local.resolve(name));
      if(resolved==='api/_boards-storage.js')return {pool};
      if(['api/_auth-session.js','api/_brand-access.js','api/_app-identity.js'].includes(resolved))return base.load(resolved);
      return load(resolved);
    }
    vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:req,process:{env:base.env},Buffer,console,AbortController,setTimeout,clearTimeout,fetch:fetchImpl || (()=>{throw new Error('External network forbidden');})},{filename:relative});return module.exports;
  }
  const previewRoute=load('api/brands/[id]/learning-source.js'), route=load('api/brands/[id]/learnings.js'), service=load('api/_brand-learnings.js');
  const requests=[];
  async function request(method,url,body,user={email:EMAIL}) {
    const parsed=new URL(url,'http://localhost');const req={method,query:{id:parsed.pathname.split('/')[3],...Object.fromEntries(parsed.searchParams)},body,
      headers:{cookie:user?`funklix_session=${auth.createSessionToken(user)}`:''}};
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(body){this.body=clone(body);return this;}};
    requests.push({method,url,body:clone(body)});await (parsed.pathname.endsWith('/learning-source')?previewRoute:route)(req,res);return res;
  }
  return {base,db,service,request,requests,load,pool};
}
module.exports={learningRuntime};
