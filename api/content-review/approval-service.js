'use strict';
const contract = require('../../approval-material-contract');

function nodes(board) { return Array.isArray(board?.canvas_json) ? board.canvas_json : Array.isArray(board?.canvas_json?.nodes) ? board.canvas_json.nodes : []; }
function readiness(node) {
  const caption = contract.scalar(node?.social?.caption);
  const platform = contract.scalar(node?.social?.platform || node?.channel);
  if (!caption || !platform) return 'Incomplete';
  return contract.scalar(node?.social?.cta) || /(https?:\/\/|\b(link|learn|shop|book|join|download|discover|visit)\b)/i.test(caption) ? 'Ready' : 'Needs attention';
}
function createApprovalService({ pool, getBoardAccess, now = () => new Date() } = {}) {
  if (!pool) pool = require('../_boards-storage').pool;
  if (!getBoardAccess) getBoardAccess = require('../_board-access').getBoardAccess;
  return { async approve(input, actor) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const resolved = await getBoardAccess(input.boardId, actor, { columns: 'id,canvas_json,owner_id,owner_email,updated_at', client });
      if (!resolved.board) { await client.query('ROLLBACK'); return { status: 404, code: 'board_not_found' }; }
      if (resolved.access?.canEdit !== true) { await client.query('ROLLBACK'); return { status: 403, code: 'board_edit_access_required' }; }
      const locked = await client.query('SELECT id,canvas_json,updated_at FROM boards WHERE id=$1 FOR UPDATE', [input.boardId]);
      const board = locked.rows[0];
      const node = nodes(board).find(candidate => candidate?.id === input.nodeId);
      if (!node) { await client.query('ROLLBACK'); return { status: 404, code: 'node_missing' }; }
      if (node.status !== 'In Review' || input.expectedCurrentStatus !== 'In Review') { await client.query('ROLLBACK'); return { status: 409, code: 'approval_status_invalid' }; }
      const level = readiness(node);
      if (level === 'Incomplete') { await client.query('ROLLBACK'); return { status: 422, code: 'readiness_incomplete' }; }
      if (level === 'Needs attention' && input.warningAcknowledged !== true) { await client.query('ROLLBACK'); return { status: 422, code: 'warning_acknowledgement_required' }; }
      const expected = input.expectedMaterialFingerprint;
      const fingerprint = contract.fingerprintSync(node);
      if (expected && expected !== fingerprint) { await client.query('ROLLBACK'); return { status: 409, code: 'material_expectation_changed' }; }
      const at = now().toISOString();
      node.status = 'Approved';
      node.approvedContentFingerprint = fingerprint;
      node.approvalMetadata = { version: 2, authority: 'server', approvedByAccountId: String(actor?.email || actor?.id || '').slice(0, 120), approvedAt: at, clientRequestId: input.clientRequestId };
      const canvas = board.canvas_json;
      if (Array.isArray(canvas?.activityFeed)) canvas.activityFeed.push({ type: 'status_changed', nodeId: node.id, status: 'Approved', timestamp: at, authority: 'server' });
      const saved = await client.query('UPDATE boards SET canvas_json=$2::jsonb,updated_at=NOW() WHERE id=$1 RETURNING updated_at', [input.boardId, JSON.stringify(canvas)]);
      await client.query('COMMIT');
      return { status: 200, ok: true, fingerprint, fingerprintVersion: contract.VERSION, boardRevision: new Date(saved.rows[0].updated_at).toISOString(), nodeIdentity: { boardId: input.boardId, nodeId: node.id, role: contract.ROLE }, approvalAuthority: 'server' };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  }};
}
module.exports = { createApprovalService, readiness, nodes };
