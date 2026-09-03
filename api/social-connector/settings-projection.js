'use strict';
const { PLATFORMS }=require('./contracts');
async function getSettingsProjection(storage,ownerAccountId){let rows=[];let configured=true;try{rows=await storage.listConnectionProjection(ownerAccountId);}catch{configured=false;}return {configured,platforms:PLATFORMS.map((platform)=>{const row=rows.find((item)=>item.platform===platform);return {platform,status:row?.status||'not_connected',availability:configured?'coming_soon':'setup_required'};}),planningIndependent:true,connectEnabled:false};}
module.exports={getSettingsProjection};
