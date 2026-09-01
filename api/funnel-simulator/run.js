'use strict';

const { getSessionUser } = require('../_auth-session');
const { getBoardAccess } = require('../_board-access');
const { validateCanvasContext } = require('../_ai-brain-canvas-context');
const contract = require('../_funnel-simulator-contract');
const simulation = require('../_funnel-simulator');

const SAFE_CODES=new Set(['board_changed','account_changed','access_changed','brand_context_changed','canvas_context_changed','selected_node_missing','selected_node_changed','selected_node_incomplete','stage_mapping_changed','configuration_invalid','provider_failed','response_invalid','response_language_mismatch','authentication_required','method_not_allowed','payload_too_large','simulation_unavailable']);
function reply(res,status,code){const safe=SAFE_CODES.has(code)?code:'configuration_invalid';return res.status(status).json({error:safe,code:safe});}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return reply(res,405,'method_not_allowed');
  if(Buffer.byteLength(JSON.stringify(req.body||{}),'utf8')>contract.LIMITS.bodyBytes)return reply(res,413,'payload_too_large');
  if(!contract.validateRequest(req.body).ok)return reply(res,400,'invalid_request');
  const user=getSessionUser(req);if(!user?.email)return reply(res,401,'authentication_required');
  const body=req.body;let board,access;
  try{({board,access}=await getBoardAccess(body.board_id,user,{columns:'id, name, brand_id, canvas_json, brand_core_snapshot, brand_core_source_revision, brand_core_source_updated_at, updated_at'}));}catch{return reply(res,404,'board_changed');}
  if(!board)return reply(res,404,'board_changed');if(!access?.canEdit||access?.publicView)return reply(res,403,'access_changed');
  const currentRevision=String(board.updated_at||'');
  const canvas=validateCanvasContext({nodes:body.canvas_context.nodes,edges:body.canvas_context.edges},null);if(!canvas.ok)return reply(res,canvas.status===413?413:canvas.status===409?409:400,canvas.classification==='stale_canvas'?'stale_context':'invalid_request');
  const revision=board.brand_core_source_revision||board.brand_core_source_updated_at||board.updated_at||'0';const available=contract.projectTargetGroups(board.brand_core_snapshot,revision);const groups=[];
  for(const selected of body.configuration.target_groups){if(selected.kind==='brand_core'){const source=available.find((item)=>item.source_id===selected.source_id);if(!source)return reply(res,409,'brand_context_changed');groups.push({...source,id:source.source_id});}else groups.push({id:'custom-1',source:'custom',name:contract.text(selected.name,80,true),description:contract.text(selected.description,500,true)});}
  const nodeMap=new Map();for(const node of canvas.nodes){const projected=contract.projectNode(node);if(projected)nodeMap.set(projected.id,projected);}
  for(const stage of body.configuration.stages)for(const id of stage.node_ids){const node=nodeMap.get(id);if(!node)return reply(res,409,'selected_node_missing');if(node.stage!==stage.stage)return reply(res,409,'stage_mapping_changed');const raw=canvas.nodes.find((item)=>item.id===id);if(contract.assetReadiness(raw).state==='incomplete')return reply(res,409,'selected_node_incomplete');}
  if(body.canvas_context.saved_state==='saved'&&board.canvas_json){const authoritative=validateCanvasContext({nodes:board.canvas_json.nodes||[],edges:board.canvas_json.edges||[]},null);if(!authoritative.ok)return reply(res,409,'canvas_context_changed');const authoritativeMap=new Map(authoritative.nodes.map((raw)=>[raw.id,contract.projectNode(raw)]).filter(([,value])=>value));for(const stage of body.configuration.stages)for(const id of stage.node_ids){const expected=nodeMap.get(id),actual=authoritativeMap.get(id);if(!actual)return reply(res,409,'selected_node_missing');if(actual.stage!==stage.stage)return reply(res,409,'stage_mapping_changed');if(JSON.stringify(contract.canonical(actual))!==JSON.stringify(contract.canonical(expected)))return reply(res,409,'selected_node_changed');}}
  if(!process.env.OPENAI_API_KEY)return reply(res,503,'simulation_unavailable');
  const selectedNodes=[...new Set(body.configuration.stages.flatMap((stage)=>stage.node_ids))].map((id)=>nodeMap.get(id));const context={groups,nodes:selectedNodes,stages:body.configuration.stages};const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
  try{const output=await simulation.callProvider(context,body.response_language,controller.signal);const validated=simulation.validateProviderOutput(output,groups,body.configuration.stages,nodeMap);if(!validated)return reply(res,502,'invalid_simulation_response');const ranges=contract.aggregateRanges(validated.journeys,body.configuration.stages);
    return res.status(200).json({simulation_id:body.client_run_id,response_language:body.response_language,classification:'synthetic_persona',disclosure:body.response_language==='de'?'Simuliertes Ergebnis, keine gemessene Performance oder Vorhersage.':'Simulated result, not measured performance or a prediction.',selected_target_groups:groups,selected_stages:body.configuration.stages,personas:validated.personas,journeys:validated.journeys,aggregate_insights:validated.aggregate_insights,modeled_ranges:ranges,context:{board_id:board.id,board_name:board.name,board_revision:currentRevision,canvas_revision:String(body.canvas_context.revision),saved_state:body.canvas_context.saved_state,stage_mapping_version:'bw28-v1',method_version:'bw29.3-v1'},limits:{starting_cohort:100,groups_equal_weight:true,personas_equal_weight:true,max_personas:6,max_reactions:60},changes_made:false});
  }catch(error){return reply(res,error?.name==='AbortError'?504:502,'provider_failed');}finally{clearTimeout(timer);}
};
module.exports._simulation=simulation;
