'use strict';

// Read-only scope authorization. Advice can opt into the saved Canvas in the
// same snapshot; Board edit remains independent of canonical Brand read/edit.
const { createHash } = require('node:crypto');
const { pool } = require('./_boards-storage');
const { getBoardAccess } = require('./_board-access');
const { isBrandId } = require('./_brand-access');
const { lookupRequestFromVerifiedSession, validateIdentityRow, normalizeRevision } = require('./_app-identity');
const { WORKSPACE_ROLES } = require('./_workspace-authorization');
const COLUMNS = 'id, owner_id, owner_email, workspace_id, brand_id, updated_at';
class ProposalScopeError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new ProposalScopeError(status, code); };
function timestamp(value) {
  if (!(typeof value === 'string' || value instanceof Date) || !Number.isFinite(new Date(value).getTime())) return null;
  return new Date(value).toISOString();
}
function validExpected(value) {
  return value && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === 3 && ['updated_at', 'brand_id', 'workspace_id'].every(k => Object.hasOwn(value, k))
    && typeof value.updated_at === 'string' && value.updated_at.length <= 40 && !!timestamp(value.updated_at)
    && ['brand_id', 'workspace_id'].every(k => value[k] === null || isBrandId(value[k]));
}
function publicScope(board) {
  return { updated_at: timestamp(board.updated_at), brand_id: board.brand_id, workspace_id: board.workspace_id };
}
async function capture({ boardId, user, db = pool, includeCanvas = false }) {
  const lookup = lookupRequestFromVerifiedSession({ verified: true, user });
  if (!lookup.ok) fail(401, 'proposal_unauthorized');
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '4000ms'");
    const identity = validateIdentityRow((await client.query(
      'SELECT id,canonical_email,status,revision FROM public.app_identities WHERE canonical_email=$1 ORDER BY id LIMIT 2', [lookup.canonicalEmail]
    )).rows);
    if (!identity.ok || identity.canonicalEmail !== lookup.canonicalEmail) fail(403, 'proposal_forbidden');
    const columns = COLUMNS + (includeCanvas ? ', canvas_json, updated_at::text AS canvas_revision' : '');
    const { board, access } = await getBoardAccess(boardId, user, { client, columns });
    if (!board) fail(404, 'proposal_forbidden');
    // Both explicit SQL NULLs are the existing legacy unowned policy. Missing,
    // empty or malformed owner values must never acquire that authorization.
    if (!['owner_id', 'owner_email'].every(k => Object.hasOwn(board, k)
      && (board[k] === null || (typeof board[k] === 'string' && board[k].trim().length > 0 && board[k].length <= 320)))) fail(403, 'proposal_forbidden');
    if (board.owner_email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(board.owner_email.trim())) fail(403, 'proposal_forbidden');
    if (!access?.canEdit) fail(403, 'proposal_forbidden');
    if (board.id !== boardId || !timestamp(board.updated_at)
      || !['brand_id', 'workspace_id'].every(k => Object.hasOwn(board, k) && (board[k] === null || isBrandId(board[k])))) fail(409, 'proposal_context_changed');
    let workspace = null, membership = null, association = null;
    if (board.workspace_id !== null) {
      workspace = (await client.query('SELECT id,status,revision FROM public.workspaces WHERE id=$1', [board.workspace_id])).rows[0];
      membership = (await client.query('SELECT role,status FROM public.workspace_memberships WHERE workspace_id=$1 AND identity_id=$2', [board.workspace_id, identity.identityId])).rows[0];
      if (workspace?.id !== board.workspace_id || workspace.status !== 'active' || normalizeRevision(workspace.revision) === null || membership?.status !== 'accepted'
        || !WORKSPACE_ROLES.includes(membership.role)) fail(403, 'proposal_forbidden');
    }
    if (board.brand_id !== null) {
      // Association metadata only, never brand_core, Learning rows or snapshots.
      association = (await client.query('SELECT id,workspace_id FROM public.brands WHERE id=$1', [board.brand_id])).rows[0];
      if (association?.id !== board.brand_id || association.workspace_id !== board.workspace_id) fail(409, 'proposal_context_changed');
    }
    // Null Workspace/Brand is permitted for real legacy Boards under the existing
    // Board owner/editor/unowned policy, without inventing Workspace membership.
    const data = { board, identity, workspace, membership, association, access,
      actor: { email: lookup.canonicalEmail, id: user.id || null, sub: user.sub || null } };
    await client.query('COMMIT');
    return { ...data, fingerprint: JSON.stringify(data) };
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch {} }
    if (error instanceof ProposalScopeError) throw error;
    fail(503, 'proposal_generic_failed');
  } finally { client?.release(); }
}
function assertActor(data, user) {
  const lookup = lookupRequestFromVerifiedSession({ verified: true, user });
  if (!lookup.ok || JSON.stringify(data.actor) !== JSON.stringify({ email: lookup.canonicalEmail, id: user.id || null, sub: user.sub || null })) fail(409, 'proposal_context_changed');
}
function assertExpected(data, expected) {
  const current = publicScope(data.board);
  if (!validExpected(expected) || current.updated_at !== timestamp(expected.updated_at)
    || current.brand_id !== expected.brand_id || current.workspace_id !== expected.workspace_id) fail(409, 'proposal_context_changed');
}
async function revalidate({ data, user, db = pool }) {
  let current;
  try { current = await capture({ boardId: data.board.id, user, db }); }
  catch (error) {
    if (error instanceof ProposalScopeError && error.status !== 503) fail(409, 'proposal_context_changed');
    throw error;
  }
  if (current.fingerprint !== data.fingerprint) fail(409, 'proposal_context_changed');
}
function revision(data) { return createHash('sha256').update(data.fingerprint).digest('hex'); }
// Continuation compares the same independently authorized scope, excluding only
// the Board timestamp acknowledged by the existing save owner. This is a
// freshness checksum, never a credential or a replacement for capture/revalidate.
function continuationRevision(data) {
  const value = JSON.parse(data.fingerprint);
  delete value.board.updated_at;
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
module.exports = { revision, continuationRevision, capture, revalidate, assertActor, assertExpected, validExpected, publicScope, ProposalScopeError };
