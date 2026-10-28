'use strict';
// Read-only Create preflight, using the same identity/Board/Workspace owner as
// preparation. No supplied source, canonical knowledge, provider or writes.
const { getSessionUser } = require('../_auth-session');
const { isBrandId } = require('../_brand-access');
const scope = require('../_ai-brain-proposal-scope');
module.exports = async function handler(req, res) {
  const fail = (status, code) => res.status(status).json({ code });
  if (req.method !== 'POST') return fail(405, 'proposal_request_invalid');
  const body = req.body;
  const continuation = body && Object.hasOwn(body, 'prepared_updated_at') && Object.hasOwn(body, 'continuation_revision');
  if (!body || Object.getPrototypeOf(body) !== Object.prototype || Object.keys(body).length !== (continuation ? 5 : 3)
    || !['board_id', 'expected_scope', 'scope_revision'].every(k => Object.hasOwn(body, k))
    || (continuation && (typeof body.prepared_updated_at !== 'string' || body.prepared_updated_at.length > 40 || !Number.isFinite(Date.parse(body.prepared_updated_at)) || typeof body.continuation_revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.continuation_revision)))
    || !isBrandId(body.board_id) || !scope.validExpected(body.expected_scope)
    || typeof body.scope_revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.scope_revision)) return fail(400, 'proposal_request_invalid');
  const user = getSessionUser(req);
  if (!user?.email) return fail(401, 'proposal_unauthorized');
  try {
    const data = await scope.capture({ boardId: body.board_id, user });
    scope.assertExpected(data, body.expected_scope);
    if (continuation) {
      // Recover only the exact prepared scope across a client-acknowledged own
      // save. Identity, ACL, Workspace and association must still match in SQL.
      const prepared = JSON.parse(data.fingerprint);
      prepared.board.updated_at = body.prepared_updated_at;
      if (scope.continuationRevision(data) !== body.continuation_revision
        || scope.revision({ fingerprint: JSON.stringify(prepared) }) !== body.scope_revision) return fail(409, 'proposal_context_changed');
    } else if (scope.revision(data) !== body.scope_revision) return fail(409, 'proposal_context_changed');
    await scope.revalidate({ data, user: getSessionUser(req) });
    scope.assertActor(data, getSessionUser(req));
    return res.status(200).json({ scope_revision: scope.revision(data) });
  } catch (error) {
    return fail(error instanceof scope.ProposalScopeError ? error.status : 503,
      error instanceof scope.ProposalScopeError ? error.code : 'proposal_generic_failed');
  }
};

// Preserve the central database response boundary without changing read-only ACLs.
module.exports = require('../_write-maintenance').withMaintenanceResponse(module.exports);
