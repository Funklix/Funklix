(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FunklixCampaignCreation=api;
}(typeof globalThis!=='undefined'?globalThis:window,function(){
  'use strict';
  const CONTRACT='campaign_creation_v1', UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  const error=code=>Object.assign(new Error('Campaign creation'),{code});
  function request(body){
    const keys=['contract','request_id','board_id','workspace_id','brand_id','board_revision','idea','context'];
    if(!object(body)||Object.keys(body).length!==keys.length||!keys.every(k=>Object.hasOwn(body,k))||body.contract!==CONTRACT
      ||!['request_id','board_id','workspace_id','brand_id'].every(k=>UUID.test(body[k]||''))||!date(body.board_revision)
      ||typeof body.idea!=='string'||!body.idea.trim()||body.idea.trim().length>2000||typeof body.context!=='string'||body.context.length>4000)throw error('VALIDATION');
    return {contract:CONTRACT,request_id:body.request_id,board_id:body.board_id,workspace_id:body.workspace_id,brand_id:body.brand_id,board_revision:body.board_revision,idea:body.idea.trim(),context:body.context.trim()};
  }
  function validate(value,input){
    const b=value?.board,c=b?.canvas_json;
    if(value?.contract!==CONTRACT||value.ok!==true||value.request_id!==input.request_id||typeof value.created!=='boolean'
      ||b?.id!==input.board_id||b.workspace_id!==input.workspace_id||b.brand_id!==input.brand_id||!date(b.updated_at)
      ||b.access?.canEdit!==true||!object(b.brand_core_snapshot)||typeof b.name!=='string'
      ||value.workspace?.id!==b.workspace_id||typeof value.workspace.name!=='string'
      ||value.brand?.id!==b.brand_id||value.brand.workspace_id!==b.workspace_id||typeof value.brand.name!=='string'
      ||value.node_id!==`campaign-${input.request_id}`||!object(c)||!Array.isArray(c.nodes)||!Array.isArray(c.edges)
      ||!c.nodes.some(n=>n.id===value.node_id&&n.type==='Idea')||value.next_route!==`/boards/${b.id}`)throw error('RESPONSE_INVALID');
    return value;
  }
  function createBoundary({context,fetchImpl,open}){
    let flight=null,confirmed=null;
    const origin=context();
    async function submit(input){
      input=request(input);
      const fingerprint=JSON.stringify(input),captured=context();
      const same=()=>{const live=context();return live.account===captured.account&&live.boardId===captured.boardId&&live.generation===captured.generation&&live.workspaceId===captured.workspaceId&&live.brandId===captured.brandId;};
      if(captured.account!==origin.account||captured.generation!==origin.generation||!captured.account||captured.boardId!==input.board_id||captured.workspaceId!==input.workspace_id||captured.brandId!==input.brand_id)throw error('CONFLICT');
      if(confirmed&&confirmed.fingerprint!==fingerprint)throw error('CONFLICT');
      if(flight)return flight.fingerprint===fingerprint?flight.promise:Promise.reject(error('CONFLICT'));
      const operation={fingerprint};
      operation.promise=(async()=>{
        let outcome=confirmed?.outcome;
        if(!outcome){
          let response;try{response=await fetchImpl('/api/campaigns',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:fingerprint});}catch{throw error('NETWORK');}
          let payload;try{payload=await response.json();}catch{throw error('RESPONSE_INVALID');}
          if(!response.ok)throw error(payload?.contract===CONTRACT&&payload?.request_id===input.request_id?payload.error?.code||'SAVE_FAILED':'RESPONSE_INVALID');
          outcome=validate(payload,input);confirmed={fingerprint,outcome};
        }
        // Once confirmed, reconciliation/open failures must never resubmit a save.
        if(!same())throw error('OPEN_FAILED');
        try{await open(outcome);}catch{throw Object.assign(error('OPEN_FAILED'),{outcome});}
        return outcome;
      })();
      flight=operation;try{return await operation.promise;}finally{if(flight===operation)flight=null;}
    }
    return {submit};
  }
  return Object.freeze({CONTRACT,UUID,error,request,validate,createBoundary});
}));
