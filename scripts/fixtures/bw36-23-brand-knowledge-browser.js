'use strict';
const path=require('node:path');
const {chromium}=require('playwright-core');
async function open(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 await page.route('**/*',route=>route.abort());
 await page.route('http://localhost/bw36-23-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable Brand controller fixture</title>'}));
 await page.goto('http://localhost/bw36-23-fixture');
 for(const name of ['brand-write-contract.js','brand-profile-setup.js'])await page.addScriptTag({path:path.resolve(__dirname,'../..',name)});
 await page.evaluate(()=>{
  const id='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
  let brand={id,name:'Browser fixture',workspace_id:workspace,revision:1,logo_revision:0,logo_url:null,access:{role:'owner',canEditCanonicalBrand:true},brand_core:{brandCore:'Confirmed',brandDNA:{userApproved:true,primaryArchetype:'Sage',avatar:{userApproved:true,imageUrl:'https://fixture.test/old.png',future:42}},future:{keep:true},customTiles:[{id:'founder',text:'Story',future:true}]}};
  const context={account:{},generation:1,brandId:id,workspaceId:workspace,authorized:true};
  const requests=[],reviews=[];
  const fetchImpl=async(url,init={})=>{
   if(!url.startsWith('/api/brands/'+id))throw new Error('External request forbidden');
   const input=init.body?JSON.parse(init.body):null;requests.push({url,method:init.method||'GET',input});
   const response=body=>({ok:true,status:200,json:async()=>structuredClone(body)});
   if(url.endsWith('/write-preview'))return response({changes:input.changes,review_token:'synthetic-review'});
   if(init.method==='PUT'){
    brand={...brand,...BrandWriteContract.apply(brand,input),revision:brand.revision+(input.changes.length?1:0)};
    if(window.fixture.hold)await new Promise(resolve=>window.fixture.release=resolve);
   }
   return response(brand);
  };
  window.fixture={context,requests,reviews,getBrand:()=>structuredClone(brand),session:FunklixBrandProfileSetup.createSession({brand:structuredClone(brand),getContext:()=>context,fetchImpl,requestId:()=>crypto.randomUUID(),validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision),confirmReview:async text=>{reviews.push(text);return true;},onSave(){},onLogo(){}})};
 });
 return {browser,page};
}
module.exports={open};
