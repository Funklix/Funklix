'use strict';

const APP_IDENTITY_STATUSES = Object.freeze(['active', 'disabled']);
const APP_IDENTITY_ERRORS = Object.freeze({
  SESSION_REQUIRED: 'APP_IDENTITY_SESSION_REQUIRED',
  EMAIL_REQUIRED: 'APP_IDENTITY_EMAIL_REQUIRED',
  EMAIL_INVALID: 'APP_IDENTITY_EMAIL_INVALID',
  NOT_FOUND: 'APP_IDENTITY_NOT_FOUND',
  DISABLED: 'APP_IDENTITY_DISABLED',
  AMBIGUOUS: 'APP_IDENTITY_AMBIGUOUS',
  MISMATCH: 'APP_IDENTITY_MISMATCH',
  CONTRACT_INVALID: 'APP_IDENTITY_CONTRACT_INVALID'
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function failure(code) { return Object.freeze({ ok: false, code }); }
function normalizeCanonicalEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
function isCanonicalEmail(value) {
  return typeof value === 'string' && value.length <= 320
    && value === normalizeCanonicalEmail(value) && EMAIL.test(value);
}
function normalizeAppIdentityStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return APP_IDENTITY_STATUSES.includes(status) ? status : null;
}

// node-postgres deliberately returns PostgreSQL int8/BIGINT values as strings
// because the full database range cannot be represented safely by JavaScript.
// Revisions remain bounded to JavaScript's safe integer range at this API edge.
function normalizeRevision(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) ? revision : null;
}

// Only getSessionUser()/verifySessionToken output may be supplied here. The
// caller proves that boundary with verified: true; request body/query values
// are never an authority for this helper.
function lookupRequestFromVerifiedSession(session) {
  if (!session || session.verified !== true || !session.user || typeof session.user !== 'object') {
    return failure(APP_IDENTITY_ERRORS.SESSION_REQUIRED);
  }
  if (typeof session.user.email !== 'string' || !session.user.email.trim()) {
    return failure(APP_IDENTITY_ERRORS.EMAIL_REQUIRED);
  }
  const canonicalEmail = normalizeCanonicalEmail(session.user.email);
  if (!isCanonicalEmail(canonicalEmail)) return failure(APP_IDENTITY_ERRORS.EMAIL_INVALID);
  return Object.freeze({ ok: true, canonicalEmail });
}

function validateIdentityRow(row) {
  if (row == null) return failure(APP_IDENTITY_ERRORS.NOT_FOUND);
  if (Array.isArray(row)) {
    if (row.length === 0) return failure(APP_IDENTITY_ERRORS.NOT_FOUND);
    if (row.length !== 1) return failure(APP_IDENTITY_ERRORS.AMBIGUOUS);
    return validateIdentityRow(row[0]);
  }
  const revision = normalizeRevision(row?.revision);
  if (typeof row !== 'object' || !UUID.test(row.id || '') || !isCanonicalEmail(row.canonical_email)
      || revision === null) {
    return failure(APP_IDENTITY_ERRORS.CONTRACT_INVALID);
  }
  const status = normalizeAppIdentityStatus(row.status);
  if (!status) return failure(APP_IDENTITY_ERRORS.CONTRACT_INVALID);
  if (status === 'disabled') return failure(APP_IDENTITY_ERRORS.DISABLED);
  return Object.freeze({ ok: true, identityId: row.id.toLowerCase(), canonicalEmail: row.canonical_email, status, revision });
}

function compareIdentityToSessionEmail(identity, canonicalSessionEmail) {
  if (!identity || identity.ok !== true || !isCanonicalEmail(canonicalSessionEmail)) {
    return failure(APP_IDENTITY_ERRORS.CONTRACT_INVALID);
  }
  if (identity.canonicalEmail !== canonicalSessionEmail) return failure(APP_IDENTITY_ERRORS.MISMATCH);
  return Object.freeze({ ok: true, identityId: identity.identityId });
}

module.exports = {
  APP_IDENTITY_STATUSES,
  APP_IDENTITY_ERRORS,
  normalizeCanonicalEmail,
  isCanonicalEmail,
  normalizeAppIdentityStatus,
  normalizeRevision,
  lookupRequestFromVerifiedSession,
  validateIdentityRow,
  compareIdentityToSessionEmail
};
