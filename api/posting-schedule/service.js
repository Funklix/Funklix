'use strict';
const approval = require('../../approval-material-contract');
function nodes(canvas){return Array.isArray(canvas)?canvas:Array.isArray(canvas?.nodes)?canvas.nodes:[];}
function canonicalRevision(node){return Number.isInteger(node?.planningSchedule?.scheduleRevision)&&node.planningSchedule.scheduleRevision>0?node.planningSchedule.scheduleRevision:0;}
function createPostingScheduleService({pool,getBoardAccess,now=()=>new Date()}={}){
  if(!pool)pool=require('../_boards-storage').pool;
  if(!getBoardAccess)getBoardAccess=require('../_board-access').getBoardAccess;
  return{async mutate(input,actor){const client=await pool.connect();try{
    await client.query('BEGIN');
    const resolved=await getBoardAccess(input.boardId,actor,{columns:'id,canvas_json,owner_id,owner_email,updated_at',client});
    if(!resolved.board){await client.query('ROLLBACK');return{httpStatus:404,code:'board_not_found'};}
    if(resolved.access?.canEdit!==true){await client.query('ROLLBACK');return{httpStatus:403,code:'board_edit_access_required'};}
    const locked=await client.query('SELECT id,canvas_json,updated_at FROM boards WHERE id=$1 FOR UPDATE',[input.boardId]);
    if(!locked.rowCount){await client.query('ROLLBACK');return{httpStatus:404,code:'board_not_found'};}
    const board=locked.rows[0];
    if(new Date(board.updated_at).getTime()!==new Date(input.expectedBoardRevision).getTime()){await client.query('ROLLBACK');return{httpStatus:409,code:'board_revision_conflict'};}
    const node=nodes(board.canvas_json).find(n=>n?.id===input.nodeId);
    if(!node){await client.query('ROLLBACK');return{httpStatus:404,code:'node_not_found'};}
    if(node.type!=='Social Media Posting'){await client.query('ROLLBACK');return{httpStatus:422,code:'node_type_invalid'};}
    if(canonicalRevision(node)!==input.expectedScheduleRevision){await client.query('ROLLBACK');return{httpStatus:409,code:'schedule_revision_conflict'};}
    if(String(node.status||'')!==input.expectedStatus||approval.fingerprintSync(node)!==input.expectedMaterialFingerprint){await client.query('ROLLBACK');return{httpStatus:409,code:'node_material_conflict'};}
    if(['Scheduled','Published'].includes(String(node.status||''))){await client.query('ROLLBACK');return{httpStatus:409,code:'publication_finalized'};}
    const relation=await client.query("SELECT to_regclass('public.social_external_posts') AS posts,to_regclass('public.social_publish_jobs') AS jobs");
    const rel=relation.rows[0]||{};let protectedPublication=false;
    if(rel.posts){const q=await client.query("SELECT 1 FROM public.social_external_posts WHERE source_board_id=$1 AND source_node_id=$2 AND delivery_state IN ('confirmed','outcome_unknown') LIMIT 1",[input.boardId,input.nodeId]);protectedPublication=q.rowCount>0;}
    if(!protectedPublication&&rel.jobs){const q=await client.query("SELECT 1 FROM public.social_publish_jobs WHERE board_id=$1 AND node_id=$2 AND status IN ('delivered','outcome_unknown','delivering') LIMIT 1",[input.boardId,input.nodeId]);protectedPublication=q.rowCount>0;}
    if(protectedPublication){await client.query('ROLLBACK');return{httpStatus:409,code:'publication_finalized'};}
    const previous=node.planningSchedule,at=now().toISOString();
    if(input.schedule===null)delete node.planningSchedule;
    else node.planningSchedule={version:1,scheduledAtUtc:input.schedule.scheduledAtUtc,localDate:input.schedule.localDate,localTime:input.schedule.localTime,timeZone:input.schedule.timeZone,disambiguation:input.schedule.disambiguation,scheduledBy:{accountId:String(actor.email||actor.id||'').slice(0,120),name:String(actor.name||actor.email||'').slice(0,80)},createdAt:previous?.createdAt||at,updatedAt:at,scheduleRevision:canonicalRevision(node)+1,assetFingerprint:input.expectedMaterialFingerprint,scope:'internal_planning'};
    if(node.social){delete node.social.scheduledDate;delete node.social.scheduledTime;delete node.social.scheduledAt;delete node.social.addedToCalendar;}
    const saved=await client.query('UPDATE boards SET canvas_json=$2::jsonb,updated_at=NOW() WHERE id=$1 RETURNING updated_at',[input.boardId,JSON.stringify(board.canvas_json)]);
    await client.query('COMMIT');return{ok:true,httpStatus:200,code:input.schedule===null?'schedule_removed':'schedule_saved',planningSchedule:node.planningSchedule||null,boardRevision:new Date(saved.rows[0].updated_at).toISOString()};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}}};
}
module.exports={createPostingScheduleService,nodes,canonicalRevision};
