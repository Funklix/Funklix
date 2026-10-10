(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./campaign-v3'));
  else root.FunklixCampaignCreation=factory(root.CampaignGeneratorV3);
}(typeof globalThis!=='undefined'?globalThis:window,function(v3){
  'use strict';
  const CONTRACT='campaign_creation_v3', UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  const error=code=>Object.assign(new Error('Campaign creation'),{code});
  function campaign(canvas,ids,setup){
    if(!object(canvas)||!Array.isArray(canvas.nodes)||!Array.isArray(canvas.edges)||!Array.isArray(ids)||!ids.length
      ||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id||id.length>160)
      ||new Set(canvas.nodes.map(n=>n?.id)).size!==canvas.nodes.length)throw error('VALIDATION');
    const nodes=ids.map(id=>canvas.nodes.find(n=>n?.id===id));
    if(nodes.some(n=>!n||!object(n.position)||!Number.isFinite(n.position.x)||!Number.isFinite(n.position.y)))throw error('VALIDATION');
    const plan=v3.buildCampaignV3PlanFromNodes(nodes.map(n=>({...n,tempId:n.id})),setup);
    if(!plan.ok)throw error('VALIDATION');
    const selected=new Set(ids),all=new Set(canvas.nodes.map(n=>n.id));
    if(canvas.edges.some(e=>!Array.isArray(e)||e.length!==2||!all.has(e[0])||!all.has(e[1])))throw error('VALIDATION');
    const edges=canvas.edges.filter(([a,b])=>selected.has(a)||selected.has(b));
    const expected=v3.buildCampaignV3Edges(plan.plan).map(e=>JSON.stringify([e.fromTempId,e.toTempId])).sort();
    if(JSON.stringify(edges.map(e=>JSON.stringify(e)).sort())!==JSON.stringify(expected))throw error('VALIDATION');
    return {nodes,edges,idea:nodes.find(n=>n.type==='Idea')};
  }
  function request(body){
    const keys=['contract','request_id','board_id','workspace_id','brand_id','board_revision','idea','context','setup','canvas_json','campaign_node_ids'];
    if(!object(body)||Object.keys(body).length!==keys.length||!keys.every(k=>Object.hasOwn(body,k))||body.contract!==CONTRACT
      ||!['request_id','board_id','workspace_id','brand_id'].every(k=>UUID.test(body[k]||''))||!date(body.board_revision)
      ||typeof body.idea!=='string'||!body.idea.trim()||body.idea.trim().length>2000||typeof body.context!=='string'||body.context.length>4000
      ||!object(body.setup)||Object.keys(body.setup).length!==5||!Number.isSafeInteger(body.canvas_json?.nodeCounter)||body.canvas_json.nodeCounter<1)throw error('VALIDATION');
    const setup=v3.normalizeCampaignV3Setup(body.setup);
    if(Object.keys(setup).some(k=>setup[k]!==body.setup[k]))throw error('VALIDATION');
    campaign(body.canvas_json,body.campaign_node_ids,setup);
    return JSON.parse(JSON.stringify({...body,idea:body.idea.trim(),context:body.context.trim(),setup}));
  }
  function validate(value,input){
    const b=value?.board;
    if(value?.contract!==CONTRACT||value.ok!==true||value.request_id!==input.request_id||typeof value.created!=='boolean'
      ||b?.id!==input.board_id||b.workspace_id!==input.workspace_id||b.brand_id!==input.brand_id||!date(b.updated_at)
      ||b.access?.canEdit!==true||!object(b.brand_core_snapshot)||typeof b.name!=='string'
      ||value.workspace?.id!==b.workspace_id||typeof value.workspace.name!=='string'
      ||value.brand?.id!==b.brand_id||value.brand.workspace_id!==b.workspace_id||typeof value.brand.name!=='string'
      ||value.next_route!==`/boards/${b.id}`)throw error('RESPONSE_INVALID');
    try{const result=campaign(b.canvas_json,input.campaign_node_ids,input.setup);if(value.node_id!==result.idea.id)throw error('VALIDATION');}catch{throw error('RESPONSE_INVALID');}
    return value;
  }
  function createBoundary({context,fetchImpl,open,onConfirmed=()=>{}}){
    let flight=null,confirmed=null;
    const origin=context();
    const assertCurrent=()=>{
      const live=context();
      if(!live.account||live.account!==origin.account||live.boardId!==origin.boardId||live.generation!==origin.generation
        ||live.workspaceId!==origin.workspaceId||live.brandId!==origin.brandId||live.canEdit!==true
        ||live.accountEmail!==origin.accountEmail||live.workspaceGeneration!==origin.workspaceGeneration||live.associationBoardId!==origin.associationBoardId||live.sessionBrandId!==origin.sessionBrandId||live.sessionWorkspaceId!==origin.sessionWorkspaceId)throw error('CONFLICT');
    };
    async function submit(input){
      input=request(input);assertCurrent();
      if(input.board_id!==origin.boardId||input.workspace_id!==origin.workspaceId||input.brand_id!==origin.brandId)throw error('CONFLICT');
      const fingerprint=JSON.stringify(input);
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
          onConfirmed(outcome);
        }
        try{assertCurrent();await open(outcome);}catch{throw Object.assign(error('OPEN_FAILED'),{outcome});}
        return outcome;
      })();
      flight=operation;try{return await operation.promise;}finally{if(flight===operation)flight=null;}
    }
    return {submit,assertCurrent};
  }
  return Object.freeze({CONTRACT,UUID,error,request,validate,campaign,createBoundary});
}));
