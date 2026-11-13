'use strict';
// Production controller + HTTP handlers + restricted runtime login; mocked inference only.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async function({db,brandId,workspaceId,email,boardId}){
 const key='_profileEvidence';
 const {createSessionToken}=require('../../api/_auth-session');
 let description='We repair tools for independent workshops.';
 const enrich=require('../../api/enrich-brand-profile').createHandler({fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({fields:{brandCore:{value:description,classification:'user_provided',evidence:[{sourceId:'user',excerpt:description}]}}})}}]})})});
 const brandHandler=require('../../api/brands/[id]'),preview=require('../../api/brands/[id]/write-preview');
 const transport=async(url,init={})=>{
  const req={method:init.method||'GET',query:{id:brandId},body:init.body&&JSON.parse(init.body),headers:{...Object.fromEntries(Object.entries(init.headers||{}).map(([k,v])=>[k.toLowerCase(),v])),cookie:'funklix_session='+createSessionToken({email})}};
  const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
  await (url==='/api/enrich-brand-profile'?enrich:url.endsWith('/write-preview')?preview:brandHandler)(req,res);
  return {status:res.statusCode,ok:res.statusCode===200,json:async()=>res.body};
 };
 const row=async()=>(await db.query('SELECT * FROM brands WHERE id=$1',[brandId])).rows[0];
 const initial=await(await transport('/api/brands/'+brandId)).json();
 const snapshot=(await db.query('SELECT brand_core_snapshot FROM boards WHERE id=$1',[boardId])).rows[0].brand_core_snapshot;
 const context={account:{},brandId,workspaceId,generation:1,authorized:true};
 const session=require('../../brand-profile-setup').createSession({brand:initial,getContext:()=>context,fetchImpl:transport,requestId:randomUUID,validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision),confirmReview:async()=>true,onSave(){}});
 const revision=(await row()).revision;
 assert(await session.enrichProfile({description}));assert.equal((await row()).revision,revision);
 assert(session.editEnrichment('brandCore','Reviewed workshop repair'));
 assert(await session.decideEnrichment('brandCore','accepted'),session.state.message);
 assert.equal((await row()).brand_core.brandCore,'Reviewed workshop repair');assert((await row()).brand_core[key].fields.brandCore.userEdited);
 description='We provide workshop tool maintenance.';
 assert(await session.enrichProfile({description}));assert(await session.decideEnrichment('brandCore','rejected'),session.state.message);
 let saved=await row();assert.equal(saved.brand_core.brandCore,'Reviewed workshop repair');assert.equal(Object.keys(saved.brand_core[key].inputs).length,1,'atomic replacement prunes an unreferenced original input on real JSONB');
 assert(await session.enrichProfile({description}));assert(await session.decideEnrichment('brandCore','postponed'));
 assert(await session.reload());session.state.core.brandCore='Manual correction';assert(await session.save());assert.equal((await row()).brand_core.brandCore,'Manual correction');
 assert(await session.enrichProfile({description}));
 const before=await row();const command=require('../../brand-write-contract').command(before,{name:before.name+' newer'},workspaceId);
 await require('../../api/_brand-knowledge-write').write({db,user:{email},brandId,input:command});
 assert.equal(await session.decideEnrichment('brandCore','accepted'),false,'real PostgreSQL revision rejects stale adoption');
 assert.equal((await row()).brand_core.brandCore,'Manual correction');
 assert.deepEqual((await db.query('SELECT brand_core_snapshot FROM boards WHERE id=$1',[boardId])).rows[0].brand_core_snapshot,snapshot);
 assert(await session.reload());session.state.core.brandCore='';assert(await session.save());assert.equal((await row()).brand_core.brandCore,'');
};
