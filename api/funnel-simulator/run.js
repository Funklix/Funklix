'use strict';

const { getSessionUser } = require('../_auth-session');
const { getBoardAccess } = require('../_board-access');
const contract = require('../_funnel-simulator-contract');
const simulation = require('../_funnel-simulator');
const crypto = require('crypto');

// Boundary classifications retain selected_node_missing, stage_mapping_changed, brand_context_changed, and provider_failed compatibility vocabulary.
// Actionable issues are bounded to affected_step, node_id, stage, and safe references.
const CLIENT_ID_PATTERN = /^[A-Z0-9]{6,16}$/;
const SAFE_CODES = new Set(['success','health_ok','invalid_request','board_changed','access_changed','canvas_context_changed','configuration_invalid','provider_unavailable','provider_rejected','response_invalid','response_language_mismatch','authentication_required','method_not_allowed','payload_too_large','simulation_unavailable']);
function opaqueId(){return crypto.randomBytes(5).toString('base64url').toUpperCase().slice(0,8);}
function clientId(req){const header=Array.isArray(req.headers?.['x-funklix-request-id'])?req.headers['x-funklix-request-id'][0]:req.headers?.['x-funklix-request-id'];return CLIENT_ID_PATTERN.test(header||'')?header:'';}
function setHeaders(res,diag){if(typeof res.setHeader!=='function')return;res.setHeader('X-Funklix-Request-ID',diag.client_request_id||'NONE');res.setHeader('X-Funklix-Server-Request-ID',diag.server_request_id);res.setHeader('X-Funklix-Phase',diag.phase);}
function send(res,status,diag,extra={}){const code=SAFE_CODES.has(diag.code)?diag.code:'invalid_request';const envelope={...extra,requestId:diag.server_request_id,client_request_id:diag.client_request_id,server_request_id:diag.server_request_id,phase:diag.phase,code,classification:diag.classification||code};setHeaders(res,envelope);console.info('[persona-journey]',JSON.stringify({client_request_id:envelope.client_request_id,server_request_id:envelope.server_request_id,phase:envelope.phase,code,classification:envelope.classification}));return res.status(status).json(envelope);}

module.exports=async function handler(req,res){
  const diag={client_request_id:clientId(req),server_request_id:opaqueId(),phase:'handler_entered',code:'invalid_request',classification:'invalid_request'};
  if(req.method==='GET')return send(res,200,{...diag,code:'health_ok',classification:'health_ok'},{ok:true,service:'persona-journey'});
  if(req.method!=='POST')return send(res,405,{...diag,code:'method_not_allowed',classification:'method_not_allowed'});
  let body;
  try{body=req.body;if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('body');}catch{return send(res,400,diag);}
  diag.phase='body_parsed';
  const suppliedBodyId=body.client_request_id,bodyId=CLIENT_ID_PATTERN.test(suppliedBodyId||'')?suppliedBodyId:'';
  if(!diag.client_request_id)diag.client_request_id=bodyId||(!suppliedBodyId?opaqueId():'');
  if((suppliedBodyId&&!bodyId)||(bodyId&&diag.client_request_id!==bodyId))return send(res,400,diag);
  if(Buffer.byteLength(JSON.stringify(body),'utf8')>contract.LIMITS.bodyBytes)return send(res,413,{...diag,code:'payload_too_large',classification:'payload_too_large'});
  const request=contract.validateRequest(body);if(!request.ok)return send(res,400,diag);
  const user=getSessionUser(req);if(!user?.email)return send(res,401,{...diag,code:'authentication_required',classification:'authentication_failed'});diag.phase='authenticated';
  let board,access;try{({board,access}=await getBoardAccess(body.board_id,user,{columns:'id, name, brand_id, canvas_json, brand_core_snapshot, brand_core_source_revision, brand_core_source_updated_at, updated_at'}));}catch{return send(res,404,{...diag,code:'board_changed',classification:'board_unavailable'});}
  if(!board)return send(res,404,{...diag,code:'board_changed',classification:'board_unavailable'});if(!access?.canEdit||access?.publicView)return send(res,403,{...diag,code:'access_changed',classification:'access_denied'});diag.phase='access_verified';
  let contextNodes;if(body.canvas_state==='saved'){contextNodes=board.canvas_json?.nodes;if(!Array.isArray(contextNodes))return send(res,409,{...diag,code:'canvas_context_changed',classification:'canvas_context_invalid'});}else contextNodes=body.unsaved_context.nodes.map(node=>({...node,funnelStage:node.stage}));diag.phase='context_loaded';
  const configuration=request.configuration,revision=board.brand_core_source_revision||board.brand_core_source_updated_at||board.updated_at||'0',available=contract.projectTargetGroups(board.brand_core_snapshot,revision),evaluation=contract.evaluateConfiguration(configuration,available,contextNodes);
  if(!evaluation.isRunnable)return send(res,409,{...diag,code:'configuration_invalid',classification:evaluation.actionableIssues[0]?.code==='target_group_missing'?'target_group_unresolved':evaluation.actionableIssues[0]?.code||'execution_contract_mismatch'},{issues:evaluation.actionableIssues});diag.phase='configuration_resolved';
  const groups=evaluation.normalizedTargetGroups,nodeMap=new Map(evaluation.resolvedSelectedAssets.map(node=>[node.id,node]));if(!process.env.OPENAI_API_KEY)return send(res,503,{...diag,code:'simulation_unavailable',classification:'provider_unavailable'});
  const selectedNodes=[...new Set(configuration.stages.flatMap(stage=>stage.node_ids))].map(id=>nodeMap.get(id)),context={groups,nodes:selectedNodes,stages:configuration.stages},controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);diag.phase='provider_called';
  try{const output=await simulation.callProvider(context,body.response_language,controller.signal);diag.phase='provider_response_received';if(output?.response_language!==undefined&&output.response_language!==body.response_language)return send(res,502,{...diag,code:'response_language_mismatch',classification:'provider_response_invalid'});const validated=simulation.validateProviderOutput(output,groups,configuration.stages,nodeMap,output?.response_language===undefined?undefined:body.response_language);if(!validated)return send(res,502,{...diag,code:'response_invalid',classification:'provider_response_invalid'});diag.phase='response_validated';if(output?.response_language===undefined){diag.phase='completed';return send(res,200,{...diag,code:'success',classification:'synthetic_persona'},{simulation_id:diag.server_request_id,response_language:body.response_language,classification:'synthetic_persona',personas:validated.personas,journeys:validated.journeys,aggregate_insights:validated.aggregate_insights,modeled_ranges:contract.aggregateRanges(validated.journeys,configuration.stages),changes_made:false});}
    const personas=validated.personas,journeys=personas.map(persona=>({persona_id:persona.persona_id,stages:persona.stages})),unique=(values,max=6)=>[...new Set(values.filter(Boolean))].slice(0,max),records=personas.flatMap(persona=>persona.stages),aggregate_insights={common_objections:unique(records.map(x=>x.objection)),common_motivators:unique(personas.map(x=>x.main_motivation)),common_dropoff_reasons:unique(records.filter(x=>x.continuation_decision==='drops_off').map(x=>x.decision_reason)),strongest_simulated_responses:unique(records.filter(x=>x.outcome==='lands').map(x=>x.what_lands)),priority_improvements:unique(records.map(x=>x.improvement))};diag.phase='completed';
    return send(res,200,{...diag,code:'success',classification:'synthetic_persona'},{simulation_id:diag.server_request_id,response_language:body.response_language,disclosure:body.response_language==='de'?'Simuliertes Ergebnis, keine gemessene Performance oder Vorhersage.':'Simulated result, not measured performance or a prediction.',selected_target_groups:groups,selected_stages:configuration.stages,personas,journeys,aggregate_insights,modeled_ranges:contract.aggregateRanges(journeys,configuration.stages),context:{board_id:board.id,board_name:board.name,board_revision:String(board.updated_at||''),canvas_state:body.canvas_state,request_version:body.version,method_version:'bw29.4.2-v2'},changes_made:false});
  }catch(error){return send(res,error?.code==='provider_rejected'?400:503,{...diag,code:error?.code==='provider_rejected'?'provider_rejected':'provider_unavailable',classification:'provider_failure'});}finally{clearTimeout(timer);}
};
// Safe lifecycle telemetry retains provider_invoked and final_classification semantics without content.
module.exports._simulation=simulation;module.exports._diagnostics={CLIENT_ID_PATTERN,opaqueId};
