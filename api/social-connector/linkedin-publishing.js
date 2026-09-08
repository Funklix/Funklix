'use strict';

const crypto = require('crypto');

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

// Kept byte-for-byte compatible with the browser's approval fingerprint contract.
function materialFingerprint(node) {
  const material = { type: node?.type || '', title: node?.title || '', content: node?.content || '', channel: node?.channel || '', funnelStage: node?.funnelStage || '', social: node?.social || null, landingPage: node?.landingPage || null, images: node?.images || null, variants: node?.variants || null, cta: node?.cta || '', audience: node?.audience || '', tone: node?.tone || '' };
  let hash = 2166136261;
  const serialized = JSON.stringify(material);
  for (let index = 0; index < serialized.length; index += 1) { hash ^= serialized.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `v1-${(hash >>> 0).toString(16)}`;
}

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

module.exports = { ACTION_VERSION, MAX_CAPTION_CODE_POINTS, PERSON_URN, POST_URN, ACTIVE_JOB_STATES, enabled, liveSmokeEnabled, normalizeCaption, materialFingerprint, evaluateLinkedInTextPublishEligibility, digest, idempotencyKey, externalUrl, classifyProviderStatus };
