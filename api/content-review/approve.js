'use strict';
const crypto = require('crypto');
const { getSessionUser } = require('../_auth-session');
const { createApprovalService } = require('./approval-service');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
function send(res, status, value) { res.statusCode = status; res.setHeader('content-type','application/json; charset=utf-8'); res.setHeader('cache-control','private, no-store'); res.end(JSON.stringify(value)); }
module.exports = async function approve(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok:false, code:'method_not_allowed' });
  const actor = getSessionUser(req); if (!actor?.email && !actor?.id) return send(res, 401, { ok:false, code:'authentication_required' });
  const body = req.body || {}; const allowed = ['boardId','nodeId','expectedCurrentStatus','expectedMaterialFingerprint','clientRequestId','warningAcknowledged'];
  if (Object.keys(body).some(key => !allowed.includes(key)) || !UUID.test(body.boardId || '') || !REF.test(body.nodeId || '') || body.expectedCurrentStatus !== 'In Review' || !REF.test(body.clientRequestId || '') || (body.expectedMaterialFingerprint != null && !/^v2-[0-9a-f]{64}$/.test(body.expectedMaterialFingerprint))) return send(res,400,{ok:false,code:'invalid_approval_command'});
  try { const result = await createApprovalService().approve(body, actor); return send(res, result.status, { serverRequestId:`req_${crypto.randomBytes(12).toString('base64url')}`,...result }); }
  catch { return send(res,500,{ok:false,code:'approval_write_failed'}); }
};
