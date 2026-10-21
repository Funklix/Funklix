'use strict';
// Client-controller fixture only. SQL guarantees are tested on real PostgreSQL.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const writes=require('../../brand-write-contract');
const profile=require('../../brand-profile-setup');
function runtime(){
 const id=randomUUID(),workspace=randomUUID(),account={};
 let brand={id,workspace_id:workspace,name:'Fixture',revision:1,logo_revision:0,logo_url:null,access:{role:'owner',canEditCanonicalBrand:true},brand_core:{brandCore:'Original',brandDNA:{primaryArchetype:'Sage',secondaryArchetype:'Creator',userApproved:true,unknown:{keep:1},avatar:{userApproved:true,imageUrl:'https://fixture.test/old.png',future:'retained'}},customTiles:[{id:'founder',text:'Founder story',future:true}],future:{nested:1}}};
 const context={account,generation:1,brandId:id,workspaceId:workspace,authorized:true};
 const requests=[],reviews=[],receipts=new Map();let loseResponse=false;
 const fetchImpl=async(url,init={})=>{
  assert(url.startsWith('/api/brands/'+id),'No provider, production or Board transport permitted');
  const input=init.body?JSON.parse(init.body):null;requests.push({url,method:init.method||'GET',input});
  const response=(status,body)=>({ok:status<300,status,json:async()=>structuredClone(body)});
  if(url.endsWith('/write-preview'))return response(200,{changes:input.changes,requires_review:true,review_token:'fixture-token'});
  if(init.method==='PUT'){
   const command=writes.normalize(input),saved=receipts.get(command.mutation_id);
   if(saved){assert(writes.equal(saved.command,command));return response(200,saved.brand);}
   if(command.expected_revision!==String(brand.revision))return response(409,{code:'STALE_UPDATE'});
   const next=writes.apply(brand,command);brand={...brand,...next,revision:brand.revision+(command.changes.length?1:0)};
   receipts.set(command.mutation_id,{command,brand:structuredClone(brand)});
   if(loseResponse){loseResponse=false;throw new Error('Synthetic lost committed response');}
  }
  return response(200,brand);
 };
 const session=profile.createSession({brand:structuredClone(brand),getContext:()=>context,fetchImpl,requestId:randomUUID,validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision),confirmReview:async text=>{reviews.push(text);return true;},onSave(){},onLogo(){}});
 return {session,context,requests,reviews,receipts,get brand(){return structuredClone(brand);},loseResponse(){loseResponse=true;}};
}
module.exports={runtime};
