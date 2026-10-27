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
  if (!body || Object.getPrototypeOf(body) !== Object.prototype || Object.keys(body).length !== 3
    || !['board_id', 'expected_scope', 'scope_revision'].every(k => Object.hasOwn(body, k))
    || !isBrandId(body.board_id) || !scope.validExpected(body.expected_scope)
    || typeof body.scope_revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.scope_revision)) return fail(400, 'proposal_request_invalid');
  const user = getSessionUser(req);
  if (!user?.email) return fail(401, 'proposal_unauthorized');
  try {
    const data = await scope.capture({ boardId: body.board_id, user });
    scope.assertExpected(data, body.expected_scope);
    if (scope.revision(data) !== body.scope_revision) return fail(409, 'proposal_context_changed');
    await scope.revalidate({ data, user: getSessionUser(req) });
    scope.assertActor(data, getSessionUser(req));
    return res.status(200).json({ scope_revision: scope.revision(data) });
  } catch (error) {
    return fail(error instanceof scope.ProposalScopeError ? error.status : 503,
      error instanceof scope.ProposalScopeError ? error.code : 'proposal_generic_failed');
  }
};
