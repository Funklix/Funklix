'use strict';
// Read-only click validation. A digest is freshness data, never authorization.
const { getSessionUser } = require('../_auth-session');
const { isBrandId } = require('../_brand-access');
const scope = require('../_ai-brain-proposal-scope');
const { NODE_TYPES } = require('../_ai-brain-canvas-context');
const { canonicalType } = require('../_ai-brain-social-evidence');
const { referenceRevision } = require('../_ai-brain-node-references');
const { serializeBoardForAccess } = require('../_board-serializer');
module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  const fail = status => res.status(status).json({ code: 'node_reference_unavailable' });
  const body = req.body;
  if (req.method !== 'POST') return fail(405);
  const insights = body?.source === 'insights';
  const keys = insights ? ['source', 'board_id', 'node_id', 'node_type', 'expected_scope'] : ['board_id', 'node_id', 'scope_revision'];
  const expected = body?.expected_scope;
  // Hidden means the existing viewer serializer withheld both associations; it
  // is never an invented UUID or a claim that either saved association is NULL.
  const hiddenScope = insights && expected?.brand_id === 'hidden' && expected?.workspace_id === 'hidden';
  const normalizedExpected = hiddenScope ? scope.publicScope({ updated_at: expected.updated_at, brand_id: null, workspace_id: null }) : expected && scope.publicScope(expected);
  const expectedValid = expected && typeof expected === 'object' && !Array.isArray(expected)
    && Object.keys(expected).length === 3 && ['updated_at', 'brand_id', 'workspace_id'].every(key => Object.hasOwn(expected, key))
    && typeof expected.updated_at === 'string' && expected.updated_at.length <= 40
    && scope.validExpected(normalizedExpected);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== keys.length
    || !keys.every(key => Object.hasOwn(body, key)) || !isBrandId(body.board_id)
    || typeof body.node_id !== 'string' || !body.node_id.trim() || body.node_id.length > 160
    || (insights ? !NODE_TYPES.has(body.node_type) || canonicalType(body.node_type) !== body.node_type || !expectedValid
      : typeof body.scope_revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.scope_revision))) return fail(400);
  const user = getSessionUser(req);
  if (!user?.email) return fail(401);
  try {
    const valid = data => {
      const nodes = data.board.canvas_json?.nodes;
      if (insights) {
        if (hiddenScope) {
          const projected = serializeBoardForAccess(data.board, data.access);
          if (projected.brand_visibility !== 'hidden' || Object.hasOwn(projected, 'brand_id') || Object.hasOwn(projected, 'workspace_id')) return false;
          // Keep hidden associations server-side. The saved timestamp is checked
          // against the client; exact associations remain in both fingerprints.
          const savedExpected = scope.publicScope(data.board);
          savedExpected.updated_at = expected.updated_at;
          scope.assertExpected(data, savedExpected);
        } else scope.assertExpected(data, normalizedExpected);
      }
      return (insights || referenceRevision(data, body.node_id) === body.scope_revision) && Array.isArray(nodes)
        && nodes.every(node => node && typeof node.id === 'string' && node.id.length > 0)
        && new Set(nodes.map(node => node.id)).size === nodes.length
        && nodes.filter(node => node.id === body.node_id && NODE_TYPES.has(canonicalType(node.type))
          && (!insights || canonicalType(node.type) === body.node_type)).length === 1;
    };
    const data = await scope.capture({ boardId: body.board_id, user, includeCanvas: true, capability: insights ? 'view' : 'edit' });
    if (!valid(data)) return fail(409);
    const currentUser = getSessionUser(req);
    scope.assertActor(data, currentUser);
    const current = await scope.capture({ boardId: body.board_id, user: currentUser, includeCanvas: true, capability: insights ? 'view' : 'edit' });
    scope.assertActor(data, getSessionUser(req));
    if (current.fingerprint !== data.fingerprint || !valid(current)) return fail(409);
    return res.status(200).json({ nodeId: body.node_id, scopeRevision: insights ? referenceRevision(current, body.node_id) : body.scope_revision });
  } catch (error) { return fail(error instanceof scope.ProposalScopeError && error.status !== 503 ? 409 : 503); }
};
module.exports = require('../_write-maintenance').withMaintenanceResponse(module.exports);
