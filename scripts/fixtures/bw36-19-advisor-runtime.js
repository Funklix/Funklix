'use strict';
const {learningRuntime}=require('./bw36-17-local-runtime');
const {B,W,I,EMAIL,clone}=require('./bw36-13r5-local-runtime');
function advisorRuntime() {
  const config={membership:true,providerCalls:[],providerFailure:null,onProvider:null,scopeReads:0,onScope:null};
  let r;
  const rows=list=>({rows:clone(list),rowCount:list.length});
  const fetchImpl=async(url,init)=>{
    config.providerCalls.push({url,body:JSON.parse(init.body),signal:init.signal});
    if(config.onProvider)await config.onProvider();
    if(config.providerFailure==='timeout')throw Object.assign(new Error('private'),{name:'AbortError'});
    const status=config.providerFailure||200;
    return {ok:status===200,status,text:async()=>config.providerRaw??JSON.stringify(config.providerEnvelope??{status:'completed',output_text:JSON.stringify(config.output)})};
  };
  r=learningRuntime({fetchImpl,queryExtension:async(sql,args,{db,base})=>{
    if(sql.includes('FROM public.workspaces'))return rows(config.membership&&args[0]===W&&args[1]===I&&(!args[2]||args[2]===B)?[{id:W}]:[]);
    if(sql.startsWith('SELECT id,name,revision,workspace_id,brand_core')) {
      config.scopeReads++;if(config.onScope)await config.onScope(config.scopeReads);
      const b=base.db.brands.find(b=>b.id===args[0]);return rows(b?[{id:b.id,name:b.name,revision:String(b.revision),workspace_id:b.workspace_id,brand_core:b.brand_core||{}}]:[]);
    }
    if(sql.startsWith('SELECT id,status,statement,evidence_summary,revision'))return rows(db.learnings.filter(l=>l.brand_id===args[0]&&['approved','proposed'].includes(l.status)).map(l=>({id:l.id,status:l.status,statement:l.statement,evidence_summary:l.evidence_summary,revision:l.revision})));
    if(sql.startsWith('SELECT id,name,updated_at FROM public.boards'))return rows(base.db.boards.filter(b=>b.brand_id===args[0]&&b.workspace_id===args[1]).map(b=>({id:b.id,name:b.name,updated_at:b.updated_at})));
  }});
  r.base.env.OPENAI_API_KEY='mock-only';
  const board=r.base.db.boards[0];
  Object.assign(board,{brand_core_snapshot:null,brand_id:B,workspace_id:W,updated_at:'2026-10-12T10:00:00.123Z',canvas_json:{schemaVersion:1,nodes:[{id:'node-1',type:'Content',title:'CTA',content:'Use a clear next step.',postits:[{id:'p1',text:'Maybe use a slogan?',authorEmail:'private@example.test',resolved:true,replies:[{id:'r1',text:'Rejected. Use a clear next step instead.'}]}]}],edges:[]}});
  r.base.db.brands[0].brand_core={brandCore:'Make marketing useful.'};
  const scope={workspace_id:W,board_id:board.id,expected_brand_revision:'1',expected_board_updated_at:board.updated_at,include_discussions:false,excluded_threads:[],language:'en'};
  const service=r.load('api/_learning-advisor.js');
  const route=r.load('api/brands/[id]/learning-advisor.js').createHandler({db:r.pool,env:r.base.env,fetchImpl});
  const auth=r.base.load('api/_auth-session.js'),session='funklix_session='+auth.createSessionToken({email:EMAIL});
  config.output={language:'en',suggestions:[{type:'learning_candidate',statement:'Use a clear next step.',rationale:'The saved node explicitly uses this wording.',
    confidence:'medium',confidence_reason:'The source is explicit but performance is unverified.',evidence_class:'explicit_statement',decision_status:'unresolved',
    sources:[{ref:'s2',excerpt:'Use a clear next step.'}],limitations:['Campaign evidence needs human review before Brand-wide use.'],related_learning_ids:[],relationship:'new'}]};
  const args={db:r.pool,user:{email:EMAIL},brandId:B,scope,session,env:r.base.env,fetchImpl};
  async function request(body,cookie=session,query={id:B},headers={}) {
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(v){this.body=clone(v);return this;}};
    if(headers.accept==='application/x-ndjson') {
      res.stream='';res.write=value=>{res.stream+=value;};res.end=()=>res;
    }
    await route({method:body?'POST':'GET',query:body?query:{...query,workspace_id:W},body,headers:{cookie,...headers}},res);return res;
  }
  return {r,config,service,args,request,scope,board,session};
}
module.exports={advisorRuntime};
