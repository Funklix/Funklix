'use strict';
// One history event and revision through the real restricted PostgreSQL writer.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async function({db,root,brandId,workspaceId,email,boardId}){
 const token=require('../../api/_auth-session').createSessionToken({email});
 const fields={toneOfVoice:['Warm','Practical'],messagingPillars:['Reuse'],keywords:['repair'],mission:'Keep tools useful'};
 const counts={put:0,preview:0,confirm:0,get:0};let cancel=false;
 const enrich=require('../../api/enrich-brand-profile').createHandler({fetch:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({fields:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,{value,classification:'ai_interpretation',evidence:[{sourceId:'user',excerpt:'Fictional workshop repairs'}]}]))})}}]})})});
 const handler=require('../../api/brands/[id]'),preview=require('../../api/brands/[id]/write-preview');
 const transport=async(url,init={})=>{
  const method=init.method||'GET';if(method==='PUT')counts.put++;else if(url.endsWith('/write-preview'))counts.preview++;else if(method==='GET')counts.get++;
  const req={method,query:{id:brandId},body:init.body&&JSON.parse(init.body),headers:{...Object.fromEntries(Object.entries(init.headers||{}).map(([k,v])=>[k.toLowerCase(),v])),cookie:'funklix_session='+token}};
  const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
  await(url==='/api/enrich-brand-profile'?enrich:url.endsWith('/write-preview')?preview:handler)(req,res);
  return {ok:res.statusCode===200,status:res.statusCode,json:async()=>res.body};
 };
 const row=async()=>(await db.query('SELECT * FROM brands WHERE id=$1',[brandId])).rows[0];
 const history=async()=>(await root.query('SELECT count(*)::int n FROM brand_knowledge_history WHERE brand_id=$1',[brandId])).rows[0].n;
 const snapshot=(await db.query('SELECT brand_core_snapshot FROM boards WHERE id=$1',[boardId])).rows[0].brand_core_snapshot;
 const initial=await(await transport('/api/brands/'+brandId)).json(),context={account:{},brandId,workspaceId,generation:1,authorized:true};
 const session=require('../../brand-profile-setup').createSession({brand:initial,getContext:()=>context,fetchImpl:transport,validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision),confirmReview:async()=>true,confirmEnrichmentReview:async p=>{assert(p.review_token);counts.confirm++;return !cancel;},onSave(){},createTile:type=>({id:'km_'+randomUUID().replace(/-/g,''),moduleType:type,title:type,content:''})});
 assert(await session.enrichProfile({description:'Fictional workshop repairs'}));assert(session.editEnrichment('toneOfVoice',['Edited warm','Practical']));
 const before=await row(),events=await history();counts.get=0;
 cancel=true;assert.equal(await session.acceptAllEnrichment(),false);assert.equal(counts.put,0);assert.equal(await history(),events);assert.deepEqual((await row()).brand_core,before.brand_core);
 counts.preview=0;counts.confirm=0;cancel=false;
 assert(await session.acceptAllEnrichment(),session.state.message);assert.equal(counts.put,1);assert.equal(counts.preview,1);assert.equal(counts.confirm,1);assert.equal(counts.get,1);
 const saved=await row();assert.equal(Number(saved.revision),Number(before.revision)+1);assert.equal(await history(),events+1);assert.deepEqual(saved.brand_core.toneOfVoice,['Edited warm','Practical']);assert(saved.brand_core._profileEvidence.fields.toneOfVoice.userEdited);assert.equal(saved.brand_core.customTiles.find(t=>t.moduleType==='mission').content,fields.mission);
 assert(await session.reload());session.state.core.toneOfVoice=['Later correction'];assert(await session.save());assert(await session.reload());assert.deepEqual(session.state.core.toneOfVoice,['Later correction']);
 assert.deepEqual((await db.query('SELECT brand_core_snapshot FROM boards WHERE id=$1',[boardId])).rows[0].brand_core_snapshot,snapshot);
};
