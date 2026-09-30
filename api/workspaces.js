'use strict';

const crypto = require('crypto');
const { getSessionUser } = require('./_auth-session');
const { pool } = require('./_boards-storage');
const { APP_IDENTITY_ERRORS, lookupRequestFromVerifiedSession, validateIdentityRow, compareIdentityToSessionEmail } = require('./_app-identity');
const { WorkspaceCatalogError, loadWorkspaceCatalog } = require('./_workspace-catalog');

const CONTRACT = 'workspace_catalog_v1';
const IDENTITY_SELECT = 'SELECT id, canonical_email, status, revision FROM public.app_identities WHERE canonical_email = $1 ORDER BY id LIMIT 2';
const ERROR_STATUS = Object.freeze({ METHOD_NOT_ALLOWED: 405, AUTHENTICATION_REQUIRED: 401, SESSION_INVALID: 401,
  IDENTITY_INVALID: 422, IDENTITY_DISABLED: 403, IDENTITY_AMBIGUOUS: 409, WORKSPACE_SCHEMA_UNAVAILABLE: 503,
  WORKSPACE_CATALOG_CONFLICT: 409, DATABASE_UNAVAILABLE: 503, RESPONSE_INVALID: 500, INTERNAL_ERROR: 500 });

function requestId() { return crypto.randomBytes(12).toString('hex'); }
function durationBucket(started) { const ms = Date.now() - started; return ms < 100 ? 'lt_100ms' : ms < 500 ? 'lt_500ms' : 'gte_500ms'; }
function send(res, status, body) { res.status(status); return res.json(body); }
function failure(res, id, code, stage) { return send(res, ERROR_STATUS[code] || 500, { contract: CONTRACT, request_id: id, error: { code, stage } }); }
function identityCode(code) {
  if (code === APP_IDENTITY_ERRORS.DISABLED) return 'IDENTITY_DISABLED';
  if (code === APP_IDENTITY_ERRORS.AMBIGUOUS) return 'IDENTITY_AMBIGUOUS';
  return 'IDENTITY_INVALID';
}
function databaseCode(error) {
  if (['42P01', '42703', '42883'].includes(error?.code)) return 'WORKSPACE_SCHEMA_UNAVAILABLE';
  if (['ECONNREFUSED', 'ETIMEDOUT', '57P01', '57P03'].includes(error?.code)) return 'DATABASE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}
function identityRows(result) {
  return result && typeof result === 'object' && !Array.isArray(result) && Array.isArray(result.rows)
    ? result.rows : null;
}

function createHandler({ sessionReader = getSessionUser, db = pool, catalogLoader = loadWorkspaceCatalog } = {}) {
  return async function handler(req, res) {
    const id = requestId(); const started = Date.now();
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Request-Id', id);
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return failure(res, id, 'METHOD_NOT_ALLOWED', 'method'); }
    let user;
    try { user = sessionReader(req); } catch { return failure(res, id, 'SESSION_INVALID', 'session'); }
    if (!user) {
      const hasSessionCookie = /(?:^|;\s*)funklix_session=/.test(req.headers?.cookie || '');
      return failure(res, id, hasSessionCookie ? 'SESSION_INVALID' : 'AUTHENTICATION_REQUIRED', 'session');
    }
    const lookup = lookupRequestFromVerifiedSession({ verified: true, user });
    if (!lookup.ok) return failure(res, id, 'SESSION_INVALID', 'session');
    let currentStage = 'identity_query_construction';
    const diagnostic = (stage, code = 'OK') => {
      currentStage = stage;
      console.info('[WORKSPACE_CATALOG_STAGE]', { request_id: id, stage, code });
    };
    try {
      diagnostic('identity_query_construction');
      diagnostic('identity_query_execution');
      const identityResult = await db.query(IDENTITY_SELECT, [lookup.canonicalEmail]);
      diagnostic('identity_response_normalization');
      const rows = identityRows(identityResult);
      if (!rows) {
        diagnostic('identity_response_normalization', 'IDENTITY_INVALID');
        return failure(res, id, 'IDENTITY_INVALID', 'identity');
      }
      diagnostic('identity_row_validation');
      const identity = validateIdentityRow(rows);
      if (!identity.ok && identity.code === APP_IDENTITY_ERRORS.NOT_FOUND) {
        return send(res, 200, { contract: CONTRACT, request_id: id, workspaces: [] });
      }
      if (!identity.ok) {
        diagnostic('identity_row_validation', identityCode(identity.code));
        return failure(res, id, identityCode(identity.code), 'identity');
      }
      diagnostic('identity_canonical_comparison');
      const match = compareIdentityToSessionEmail(identity, lookup.canonicalEmail);
      if (!match.ok) {
        diagnostic('identity_canonical_comparison', 'IDENTITY_INVALID');
        return failure(res, id, 'IDENTITY_INVALID', 'identity');
      }
      const workspaces = await catalogLoader({ db, identityId: match.identityId, canonicalEmail: lookup.canonicalEmail, diagnostic });
      console.info('[WORKSPACE_CATALOG]', { request_id: id, stage: 'complete', code: 'OK', workspace_count: workspaces.length,
        brand_count: workspaces.reduce((n, w) => n + w.brands.length, 0), board_count: workspaces.reduce((n, w) => n + w.boards.length, 0),
        membership_count: workspaces.length, duration_bucket: durationBucket(started) });
      diagnostic('response_construction');
      return send(res, 200, { contract: CONTRACT, request_id: id, workspaces });
    } catch (error) {
      const code = error instanceof WorkspaceCatalogError ? error.code : databaseCode(error);
      const stage = error instanceof WorkspaceCatalogError ? error.stage : 'database';
      const diagnosticStage = error instanceof WorkspaceCatalogError ? error.stage : currentStage;
      console.error('[WORKSPACE_CATALOG]', { request_id: id, stage: diagnosticStage, code, workspace_count: 0, brand_count: 0, board_count: 0,
        membership_count: 0, duration_bucket: durationBucket(started) });
      return failure(res, id, code, stage);
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.CONTRACT = CONTRACT;
module.exports.IDENTITY_SELECT = IDENTITY_SELECT;
