'use strict';
// Read-only click validation. A digest is freshness data, never authorization.
const { getSessionUser } = require('../_auth-session');
const { isBrandId } = require('../_brand-access');
const scope = require('../_ai-brain-proposal-scope');
const { NODE_TYPES } = require('../_ai-brain-canvas-context');
const { canonicalType } = require('../_ai-brain-social-evidence');
const { referenceRevision } = require('../_ai-brain-node-references');
module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  const fail = status => res.status(status).json({ code: 'node_reference_unavailable' });
  const body = req.body;
  if (req.method !== 'POST') return fail(405);
  if (!body || Object.keys(body).length !== 3 || !isBrandId(body.board_id)
    || typeof body.node_id !== 'string' || !body.node_id.trim() || body.node_id.length > 160
    || typeof body.scope_revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.scope_revision)) return fail(400);
  const user = getSessionUser(req);
  if (!user?.email) return fail(401);
  try {
    const valid = data => {
      const nodes = data.board.canvas_json?.nodes;
      return referenceRevision(data, body.node_id) === body.scope_revision && Array.isArray(nodes)
        && nodes.every(node => node && typeof node.id === 'string' && node.id.length > 0)
        && new Set(nodes.map(node => node.id)).size === nodes.length
        && nodes.filter(node => node.id === body.node_id && NODE_TYPES.has(canonicalType(node.type))).length === 1;
    };
    const data = await scope.capture({ boardId: body.board_id, user, includeCanvas: true });
    if (!valid(data)) return fail(409);
    const currentUser = getSessionUser(req);
    scope.assertActor(data, currentUser);
    const current = await scope.capture({ boardId: body.board_id, user: currentUser, includeCanvas: true });
    scope.assertActor(data, getSessionUser(req));
    if (current.fingerprint !== data.fingerprint || !valid(current)) return fail(409);
    return res.status(200).json({ nodeId: body.node_id, scopeRevision: body.scope_revision });
  } catch (error) { return fail(error instanceof scope.ProposalScopeError && error.status !== 503 ? 409 : 503); }
};
module.exports = require('../_write-maintenance').withMaintenanceResponse(module.exports);
