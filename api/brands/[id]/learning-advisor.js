'use strict';
const { getSessionUser } = require('../../_auth-session');
const { isBrandId, brandCapabilities } = require('../../_brand-access');
const { getBoardAccess } = require('../../_board-access');
const learning = require('../../_brand-learnings');
const advisor = require('../../_learning-advisor');
function createHandler({db,env=process.env,fetchImpl=fetch}={}) {
  return async function handler(req,res) {
    res.setHeader?.('Cache-Control','private, no-store');
    const fail=(code,status=400)=>{throw new learning.LearningError(code,status);};
    try {
      if(!['GET','POST'].includes(req.method)) fail('INVALID_REQUEST',405);
      const user=getSessionUser(req);if(!user?.email)fail('AUTHENTICATION_REQUIRED',401);
      if(!env.POSTGRES_URL&&!db)fail('DATABASE_UNAVAILABLE',503);
      const pool=db||require('../../_boards-storage').pool;
      const query=req.query||{},brandId=query.id;
      if(!isBrandId(brandId)||Object.keys(query).some(k=>!['id','workspace_id'].includes(k))||Object.values(query).some(v=>typeof v!=='string'))fail('INVALID_REQUEST');
      // Binding is to the actual verified signed token, not browser identity fields.
      // Match _auth-session's decoded, last-cookie-wins parsing exactly. Binding
      // to the first duplicate cookie would allow reuse across distinct sessions.
      const session=Object.fromEntries((req.headers?.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(p=>{
        const i=p.indexOf('=');return [p.slice(0,i),decodeURIComponent(p.slice(i+1))];
      })).funklix_session;
      const args={db:pool,user,brandId,session,env,fetchImpl};
      if(req.method==='GET') {
        if(!isBrandId(query.workspace_id))fail('INVALID_REQUEST');
        const client=await pool.connect();
        try {
          await client.query('BEGIN');
          const {brand,identity}=await learning.authorize(client,user,brandId,false);
          if(!brandCapabilities(brand.role).canEditCanonicalBrand)fail('BRAND_ACCESS_DENIED',403);
          const membership=(await client.query(`SELECT w.id FROM public.workspaces w JOIN public.workspace_memberships m ON m.workspace_id=w.id
            JOIN public.brands b ON b.workspace_id=w.id WHERE w.id=$1 AND b.id=$3 AND w.status='active'
            AND m.identity_id=$2 AND m.status='accepted' FOR SHARE OF w,m,b`,[query.workspace_id,identity.identityId,brandId])).rows[0];
          if(!membership)fail('WORKSPACE_ACCESS_DENIED',403);
          const rows=(await client.query('SELECT id,name,updated_at FROM public.boards WHERE brand_id=$1 AND workspace_id=$2 ORDER BY name,id LIMIT 101',[brandId,query.workspace_id])).rows;
          if(rows.length>100)fail('CONTEXT_OVERFLOW',413);
          const boards=[];
          for(const row of rows){const {access}=await getBoardAccess(row.id,user,{client});if(access?.canRead&&!access.publicView)boards.push(row);}
          await client.query('COMMIT');
          return res.status(200).json({contract:advisor.CONTRACT,brand:{id:brandId,name:brand.name,revision:String(brand.revision)},boards,model:env.OPENAI_LEARNING_ADVISOR_MODEL||'gpt-4o-mini'});
        }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
      }
      const body=req.body;
      if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>24000)fail('INVALID_REQUEST');
      const keys=body.action==='adopt'?['action','receipt','suggestion_id','statement','evidence_summary']:
        body.action==='validate'?['action','receipt']:['action','scope'];
      if(Object.keys(body).length!==keys.length||keys.some(k=>!Object.hasOwn(body,k)))fail('INVALID_REQUEST');
      if(body.action==='preview'||body.action==='analyze') {
        const scope=advisor.scopeRequest(body.scope);
        if(body.action==='analyze')return res.status(200).json(await advisor.analyze({...args,scope}));
        // Preview lists whole threads without extracting their reply bodies, so even
        // unsupported/oversized threads can be explicitly excluded before analysis.
        const data=await advisor.readScope(pool,user,brandId,{...scope,include_discussions:false,excluded_threads:[]});
        return res.status(200).json({contract:advisor.CONTRACT,threads:data.threads,coverage:data.coverage,brand:{id:brandId,name:data.brand.name}});
      }
      if(body.action==='validate'){await advisor.checkReceipt({...args,receipt:body.receipt});return res.status(200).json({contract:advisor.CONTRACT,freshness:'validated'});}
      if(body.action==='adopt')return res.status(201).json(await advisor.adopt({...args,receipt:body.receipt,suggestionId:body.suggestion_id,statement:body.statement,evidence:body.evidence_summary}));
      fail('INVALID_REQUEST');
    } catch(e) {const safe=learning.boundedError(e);return res.status(safe.status).json({contract:advisor.CONTRACT,error:{code:safe.code}});}
  };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
