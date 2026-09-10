'use strict';
const crypto = require('crypto');
const { getSessionUser } = require('../_auth-session');
const { createApprovalService } = require('./approval-service');
const response = require('../_authoritative-response');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
function requestId(req) { const supplied=req.headers?.['x-request-id']; return response.requestId(supplied) || `req_${crypto.randomBytes(12).toString('base64url')}`; }
function envelope(id, ok, status, extra={}) { return { contract_version:response.CONTRACT_VERSION,ok,status,classification:status,server_request_id:id,...extra }; }
module.exports = async function approve(req, res) {
  const id=requestId(req);
  if (req.method !== 'POST') return response.write(res,405,envelope(id,false,'request_invalid',{failure_category:'method_not_allowed',retryable:false}));
  const actor = getSessionUser(req); if (!actor?.email && !actor?.id) return response.write(res,401,envelope(id,false,'authentication_required',{failure_category:'authentication_required',retryable:false}));
  const body = req.body || {}; const allowed = ['boardId','nodeId','expectedCurrentStatus','expectedMaterialFingerprint','clientRequestId','warningAcknowledged'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key)) || !UUID.test(body.boardId || '') || !REF.test(body.nodeId || '') || body.expectedCurrentStatus !== 'In Review' || !REF.test(body.clientRequestId || '') || (body.expectedMaterialFingerprint != null && !/^v2-[0-9a-f]{64}$/.test(body.expectedMaterialFingerprint))) return response.write(res,400,envelope(id,false,'request_invalid',{failure_category:'invalid_approval_command',retryable:false}));
  try { const result = await createApprovalService().approve(body, actor);
    if (!result.ok) return response.write(res,result.status,envelope(id,false,'approval_rejected',{failure_category:result.code||'approval_rejected',retryable:false,rejected_field:result.code||'approval_command'}));
    return response.write(res,200,envelope(id,true,'approval_saved',{board_id:body.boardId,node_id:body.nodeId,fingerprint:result.fingerprint,fingerprint_version:result.fingerprintVersion,board_revision:result.boardRevision,approval_write_result:result.approvalAuthority}));
  } catch (error) { const construction=error?.message==='unsafe_authoritative_envelope'; return response.write(res,construction?500:503,envelope(id,false,construction?'response_construction_failed':'storage_unavailable',{failure_category:construction?'response_construction_failed':'approval_write_failed',retryable:!construction})); }
};
