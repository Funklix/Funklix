'use strict';

const crypto = require('crypto');
const approvalContract = require('../../approval-material-contract');

const ACTION_VERSION = 'linkedin_text_publish_v1';
const MAX_CAPTION_CODE_POINTS = 3000;
const PERSON_URN = /^urn:li:person:[A-Za-z0-9_-]{1,128}$/;
const POST_URN = /^urn:li:(?:ugcPost|share):[A-Za-z0-9_-]{1,128}$/;
const ACTIVE_JOB_STATES = Object.freeze(['queued', 'validating', 'delivering', 'outcome_unknown']);
const BLOCK_ORDER = Object.freeze([
  'authentication_required', 'board_edit_access_required', 'board_not_saved', 'node_missing',
  'node_role_unsupported', 'platform_not_linkedin', 'readiness_incomplete',
  'editorial_approval_required', 'approval_fingerprint_missing', 'approval_stale',
  'caption_invalid', 'caption_empty', 'caption_too_long', 'connection_unavailable',
  'connection_owner_mismatch', 'credential_missing', 'credential_revoked', 'token_expired',
  'destination_missing', 'destination_owner_mismatch', 'destination_type_unsupported',
  'destination_inactive', 'permission_missing', 'provider_author_invalid',
  'adapter_capability_unavailable', 'already_published', 'publishing_in_progress',
  'publishing_not_enabled'
]);

function enabled(env = process.env) {
  return typeof env.LINKEDIN_TEXT_PUBLISHING_ENABLED === 'string'
    && env.LINKEDIN_TEXT_PUBLISHING_ENABLED.trim().toLowerCase() === 'true';
}
function liveSmokeEnabled(env = process.env) { return enabled(env) && String(env.LINKEDIN_TEXT_PUBLISHING_LIVE_SMOKE_TEST || '').trim().toLowerCase() === 'true'; }

function normalizeCaption(value) {
  if (typeof value !== 'string' || value.includes('\0') || /[\uD800-\uDFFF]/u.test(value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gu, ''))) {
    return { ok: false, code: 'caption_invalid' };
  }
  const caption = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!caption) return { ok: false, code: 'caption_empty' };
  const characterCount = [...caption].length;
  if (characterCount > MAX_CAPTION_CODE_POINTS) return { ok: false, code: 'caption_too_long', characterCount, limit: MAX_CAPTION_CODE_POINTS };
  return { ok: true, caption, characterCount };
}

function materialFingerprint(node) { return approvalContract.fingerprintSync(node); }

function evaluateLinkedInTextPublishEligibility(input = {}) {
  const codes = [];
  const caption = normalizeCaption(input.node?.social?.caption);
  const add = (condition, code) => { if (condition) codes.push(code); };
  add(!input.authenticatedAccountId, 'authentication_required');
  add(input.boardEditAccess !== true, 'board_edit_access_required');
  add(input.boardSaved !== true, 'board_not_saved');
  add(!input.node, 'node_missing');
  add(!!input.node && input.node.type !== 'Social Media Posting', 'node_role_unsupported');
  add(!!input.node && String(input.node.social?.platform || input.node.channel || '').trim().toLowerCase() !== 'linkedin', 'platform_not_linkedin');
  add(!!input.node && !['Ready', 'Needs attention'].includes(input.readiness), 'readiness_incomplete');
  add(!!input.node && input.node.status !== 'Approved', 'editorial_approval_required');
  add(!!input.node && !input.node.approvedContentFingerprint, 'approval_fingerprint_missing');
  add(!!input.node?.approvedContentFingerprint && !approvalContract.isFingerprint(input.node.approvedContentFingerprint), 'approval_version_outdated');
  add(!!input.node && !!input.node.approvedContentFingerprint && input.node.approvedContentFingerprint !== input.currentFingerprint, 'approval_stale');
  if (!caption.ok) add(true, caption.code);
  add(!input.connection, 'connection_unavailable');
  add(!!input.connection && input.connection.owner_account_id !== input.authenticatedAccountId, 'connection_owner_mismatch');
  add(!!input.connection && !input.connection.token_secret_id, 'credential_missing');
  add(!!input.connection && (input.connection.status !== 'connected' || input.credential?.revoked_at), 'credential_revoked');
  add(!!input.connection && (!input.connection.token_expires_at || Date.parse(input.connection.token_expires_at) <= Date.parse(input.now)), 'token_expired');
  add(!input.destination, 'destination_missing');
  add(!!input.destination && input.destination.owner_account_id !== input.authenticatedAccountId, 'destination_owner_mismatch');
  add(!!input.destination && input.destination.destination_type !== 'personal', 'destination_type_unsupported');
  add(!!input.destination && (input.destination.active !== true || input.destination.status !== 'active'), 'destination_inactive');
  add(!!input.connection && !(input.connection.granted_scopes || []).includes('w_member_social'), 'permission_missing');
  add(!!input.destination && !PERSON_URN.test(input.destination.external_destination_id || ''), 'provider_author_invalid');
  add(input.adapterSupported !== true, 'adapter_capability_unavailable');
  add(input.successfulExternalPost === true, 'already_published');
  add(input.activeJob === true, 'publishing_in_progress');
  add(input.publishingEnabled !== true, 'publishing_not_enabled');
  const blockingCodes = [...new Set(codes)].sort((a, b) => BLOCK_ORDER.indexOf(a) - BLOCK_ORDER.indexOf(b));
  return Object.freeze({ eligible: blockingCodes.length === 0, code: blockingCodes[0] || 'ready', blockingCodes, caption: caption.ok ? caption.caption : null, characterCount: caption.ok ? caption.characterCount : 0 });
}

const FINGERPRINT = /^(?:v1-[0-9a-f]{1,16}|v2-[0-9a-f]{64})$/;
function fingerprintState(value) {
  if (value == null || value === '') return { presence: 'missing', version: 'missing' };
  if (typeof value !== 'string' || !FINGERPRINT.test(value)) return { presence: 'invalid', version: 'unknown' };
  return { presence: 'present', version: value.startsWith('v1-') ? 'v1' : 'v2' };
}
function comparison(left, right) { return left.presence === 'present' && right.presence === 'present' ? (left.value === right.value ? 'match' : 'mismatch') : 'unavailable'; }
function approvalBoundary(input, state) {
  const submitted = { ...fingerprintState(input.expectedApprovedFingerprint), value: input.expectedApprovedFingerprint };
  const storedValue = state.node?.approvedContentFingerprint;
  const stored = { ...fingerprintState(storedValue), value: storedValue };
  const recalculated = { ...fingerprintState(state.fingerprint), value: state.fingerprint };
  const expectedRevision = typeof input.expectedBoardRevision === 'string' && input.expectedBoardRevision ? 'present' : 'missing';
  const authoritativeRevision = typeof state.board?.updated_at === 'string' && state.board.updated_at ? 'present' : 'missing';
  const revision = expectedRevision === 'missing' ? 'expected_missing' : authoritativeRevision === 'missing' ? 'authoritative_missing' : input.expectedBoardRevision === state.board.updated_at ? 'match' : 'mismatch';
  let rejection = null;
  if (!state.node) rejection = 'node_unresolved';
  else if (state.node.status !== 'Approved') rejection = 'approval_status_invalid';
  else if (submitted.presence === 'missing') rejection = 'submitted_fingerprint_missing';
  else if (submitted.presence === 'invalid') rejection = 'submitted_fingerprint_invalid';
  else if (stored.presence === 'missing') rejection = 'stored_fingerprint_missing';
  else if (stored.presence === 'invalid') rejection = 'stored_fingerprint_invalid';
  else if (stored.version === 'v1') rejection = 'approval_version_outdated';
  else if (comparison(submitted, stored) === 'mismatch') rejection = 'submitted_stored_mismatch';
  else if (comparison(stored, recalculated) === 'mismatch') rejection = 'stored_recalculated_mismatch';
  else if (comparison(submitted, recalculated) === 'mismatch') rejection = 'submitted_recalculated_mismatch';
  // A Board revision is concurrency evidence, not material authority: unrelated
  // Board changes remain publishable when all three material fingerprints match.
  return { rejection, diagnostic: {
    timestamp: new Date().toISOString(), client_request_id: input.clientRequestId || null, server_request_id: input.serverRequestId || null,
    phase: 'authoritative_preflight', classification: rejection ? 'approval_stale' : (state.evaluation.eligible ? 'accepted' : 'ineligible'), rejection_category: rejection || 'none',
    board_resolution_category: state.board ? 'resolved' : 'unresolved', node_resolution_category: state.node ? 'resolved' : 'unresolved', board_revision_category: revision,
    submitted_fingerprint_presence: submitted.presence, submitted_fingerprint_version: submitted.version, stored_fingerprint_presence: stored.presence,
    stored_fingerprint_version: stored.version, recalculated_fingerprint_version: recalculated.version,
    submitted_stored_match: comparison(submitted, stored), stored_recalculated_match: comparison(stored, recalculated), submitted_recalculated_match: comparison(submitted, recalculated),
    expected_board_revision_presence: expectedRevision, authoritative_board_revision_presence: authoritativeRevision,
    expected_authoritative_revision_match: revision === 'match' ? 'match' : revision === 'mismatch' ? 'mismatch' : 'unavailable',
    save_confirmation_category: ['not_requested','request_pending','request_succeeded','authoritative_confirmed','request_failed','unknown'].includes(input.saveConfirmationCategory) ? input.saveConfirmationCategory : 'unknown',
    node_material_normalization_category: ['unchanged','image_sanitized','unsupported_image_removed','undefined_removed','persistence_normalized','unknown'].includes(input.nodeMaterialNormalizationCategory) ? input.nodeMaterialNormalizationCategory : 'unknown',
    request_lifecycle_generation: Number.isSafeInteger(input.requestLifecycleGeneration) && input.requestLifecycleGeneration >= 0 ? input.requestLifecycleGeneration : 0,
    canonical_contract_version: approvalContract.VERSION, approval_authority: 'server', approval_write_result: input.approvalWriteResult || 'not_requested',
    authoritative_reload_result: input.authoritativeReloadResult || 'not_requested', selected_node_material_change_category: comparison(stored,recalculated)==='match'?'unchanged':'changed'
  }};
}
function digest(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('base64url'); }
function idempotencyKey({ ownerAccountId, destinationId, boardId, nodeId, approvedFingerprint }) {
  return digest(['funklix-linkedin-publish-v1', ownerAccountId, destinationId, boardId, nodeId, approvedFingerprint, ACTION_VERSION].join('\0'));
}
function externalUrl(postUrn) {
  return POST_URN.test(postUrn || '') ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/` : null;
}
function classifyProviderStatus(status) {
  if (status === 400) return 'provider_request_rejected';
  if (status === 401) return 'credential_invalid';
  if (status === 403) return 'permission_missing';
  if (status === 409) return 'provider_conflict';
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'provider_request_rejected';
}

module.exports = { ACTION_VERSION, MAX_CAPTION_CODE_POINTS, PERSON_URN, POST_URN, ACTIVE_JOB_STATES, enabled, liveSmokeEnabled, normalizeCaption, materialFingerprint, evaluateLinkedInTextPublishEligibility, fingerprintState, approvalBoundary, digest, idempotencyKey, externalUrl, classifyProviderStatus };
