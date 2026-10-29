'use strict';

// Authenticated read-only freshness resolver. Checksums are not credentials.
// Reauthorize independently on every click; never return stored source content.
const { getSessionUser } = require('../_auth-session');
const { isBrandId } = require('../_brand-access');
const scope = require('../_ai-brain-proposal-scope');
const { canonicalType, referenceRevision } = require('../_ai-brain-social-evidence');
module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  const fail = status => res.status(status).json({ code: 'evidence_reference_unavailable' });
  if (req.method !== 'POST') return fail(405);
  const body = req.body;
  if (!body || Object.keys(body).length !== 3 || !isBrandId(body.board_id)
    || typeof body.node_id !== 'string' || !body.node_id.trim() || body.node_id.length > 160
    || typeof body.scope_revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.scope_revision)) return fail(400);
  const user = getSessionUser(req);
  if (!user?.email) return fail(401);
  try {
    const data = await scope.capture({ boardId: body.board_id, user, includeCanvas: true });
    const valid = value => referenceRevision(value, body.node_id) === body.scope_revision
      && Array.isArray(value.board.canvas_json?.nodes)
      && value.board.canvas_json.nodes.filter(node => node?.id === body.node_id).length === 1
      && value.board.canvas_json.nodes.some(node => node?.id === body.node_id && canonicalType(node.type) === 'Social Media Posting');
    if (!valid(data)) return fail(409);
    const currentUser = getSessionUser(req);
    scope.assertActor(data, currentUser);
    // Same capture shape, including raw SQL precision and saved Canvas.
    const current = await scope.capture({ boardId: body.board_id, user: currentUser, includeCanvas: true });
    scope.assertActor(data, getSessionUser(req));
    if (current.fingerprint !== data.fingerprint || !valid(current)) return fail(409);
    return res.status(200).json({ nodeId: body.node_id, scopeRevision: body.scope_revision });
  } catch (error) { return fail(error instanceof scope.ProposalScopeError && error.status !== 503 ? 409 : 503); }
};
module.exports = require('../_write-maintenance').withMaintenanceResponse(module.exports);
