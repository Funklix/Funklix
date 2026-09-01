'use strict';

const { getSessionUser } = require('../_auth-session');
const { getBoardAccess } = require('../_board-access');
const { validateCanvasContext } = require('../_ai-brain-canvas-context');
const contract = require('../_funnel-simulator-contract');
const simulation = require('../_funnel-simulator');

function reply(res,status,code){return res.status(status).json({error:code,code});}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return reply(res,405,'method_not_allowed');
  if(Buffer.byteLength(JSON.stringify(req.body||{}),'utf8')>contract.LIMITS.bodyBytes)return reply(res,413,'payload_too_large');
  if(!contract.validateRequest(req.body).ok)return reply(res,400,'invalid_request');
  const user=getSessionUser(req);if(!user?.email)return reply(res,401,'authentication_required');
  const body=req.body;let board,access;
  try{({board,access}=await getBoardAccess(body.board_id,user,{columns:'id, name, brand_id, brand_core_snapshot, brand_core_source_revision, brand_core_source_updated_at, updated_at'}));}catch{return reply(res,404,'board_not_found');}
  if(!board)return reply(res,404,'board_not_found');if(!access?.canEdit)return reply(res,403,'simulation_unavailable_for_access');
  const currentRevision=String(board.updated_at||'');if(String(body.board_revision)!==currentRevision)return reply(res,409,'stale_context');
  const canvas=validateCanvasContext({nodes:body.canvas_context.nodes,edges:body.canvas_context.edges},null);if(!canvas.ok)return reply(res,canvas.status===413?413:canvas.status===409?409:400,canvas.classification==='stale_canvas'?'stale_context':'invalid_request');
  const revision=board.brand_core_source_revision||board.brand_core_source_updated_at||board.updated_at||'0';const available=contract.projectTargetGroups(board.brand_core_snapshot,revision);const groups=[];
  for(const selected of body.configuration.target_groups){if(selected.kind==='brand_core'){const source=available.find((item)=>item.source_id===selected.source_id);if(!source)return reply(res,409,'stale_context');groups.push({...source,id:source.source_id});}else groups.push({id:'custom-1',source:'custom',name:contract.text(selected.name,80,true),description:contract.text(selected.description,500,true)});}
  const nodeMap=new Map();for(const node of canvas.nodes){const projected=contract.projectNode(node);if(projected)nodeMap.set(projected.id,projected);}
  for(const stage of body.configuration.stages)for(const id of stage.node_ids){const node=nodeMap.get(id);if(!node||node.stage!==stage.stage)return reply(res,409,'stale_context');}
  if(!process.env.OPENAI_API_KEY)return reply(res,503,'simulation_unavailable');
  const selectedNodes=[...new Set(body.configuration.stages.flatMap((stage)=>stage.node_ids))].map((id)=>nodeMap.get(id));const context={groups,nodes:selectedNodes,stages:body.configuration.stages};const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
  try{const output=await simulation.callProvider(context,body.response_language,controller.signal);const validated=simulation.validateProviderOutput(output,groups,body.configuration.stages,nodeMap);if(!validated)return reply(res,502,'invalid_simulation_response');const ranges=contract.aggregateRanges(validated.journeys,body.configuration.stages);
    return res.status(200).json({simulation_id:body.client_run_id,response_language:body.response_language,classification:'synthetic_persona',disclosure:body.response_language==='de'?'Simuliertes Ergebnis, keine gemessene Performance oder Vorhersage.':'Simulated result, not measured performance or a prediction.',selected_target_groups:groups,selected_stages:body.configuration.stages,personas:validated.personas,journeys:validated.journeys,aggregate_insights:validated.aggregate_insights,modeled_ranges:ranges,context:{board_id:board.id,board_name:board.name,board_revision:currentRevision,canvas_revision:String(body.canvas_context.revision),saved_state:body.canvas_context.saved_state,stage_mapping_version:'bw28-v1',method_version:'bw29.3-v1'},limits:{starting_cohort:100,groups_equal_weight:true,personas_equal_weight:true,max_personas:6,max_reactions:60},changes_made:false});
  }catch(error){return reply(res,error?.name==='AbortError'?504:502,error?.name==='AbortError'?'simulation_timeout':'provider_failure');}finally{clearTimeout(timer);}
};
module.exports._simulation=simulation;
