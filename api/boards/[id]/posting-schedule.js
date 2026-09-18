'use strict';
const crypto=require('crypto');
const {getSessionUser}=require('../../_auth-session');
const {ensureBoardsTable}=require('../../_boards-storage');
const response=require('../../_authoritative-response');
const {validateCommand,UUID}=require('../../posting-schedule/contract');
const {createPostingScheduleService}=require('../../posting-schedule/service');
function requestId(req){return response.requestId(req.headers?.['x-request-id'])||`req_${crypto.randomBytes(12).toString('base64url')}`;}
function envelope(id,ok,status,extra={}){return{contract_version:response.CONTRACT_VERSION,ok,status,classification:status,server_request_id:id,...extra};}
module.exports=async function handler(req,res){const id=requestId(req);
  if(req.method!=='PUT')return response.write(res,405,envelope(id,false,'request_invalid',{failure_category:'method_not_allowed',retryable:false}));
  const actor=getSessionUser(req);if(!actor?.email&&!actor?.id)return response.write(res,401,envelope(id,false,'authentication_required',{failure_category:'authentication_required',retryable:false}));
  const boardId=req.query?.id,body=req.body;
  if(!UUID.test(boardId||'')||body?.boardId!==boardId)return response.write(res,400,envelope(id,false,'request_invalid',{failure_category:'invalid_board_id',retryable:false}));
  const validated=validateCommand(body);if(!validated.ok)return response.write(res,400,envelope(id,false,'request_invalid',{failure_category:validated.code,retryable:false}));
  try{await ensureBoardsTable();const result=await createPostingScheduleService().mutate(validated.value,actor);
    if(!result.ok)return response.write(res,result.httpStatus,envelope(id,false,'schedule_rejected',{failure_category:result.code,retryable:result.httpStatus>=500}));
    return response.write(res,200,envelope(id,true,result.code,{board_id:boardId,node_id:body.nodeId,planning_schedule:result.planningSchedule,board_revision:result.boardRevision}));
  }catch(error){console.error('[POSTING_SCHEDULE_FAILURE]',{server_request_id:id,classification:'storage_unavailable'});return response.write(res,503,envelope(id,false,'schedule_failed',{failure_category:'storage_unavailable',retryable:true}));}
};
