'use strict';

const PLATFORMS = Object.freeze(['linkedin', 'instagram', 'facebook', 'x']);
const CONNECTION_STATUSES = Object.freeze(['pending', 'connected', 'needs_attention', 'revoked', 'disconnected']);
const DESTINATION_STATUSES = Object.freeze(['active', 'unavailable', 'unauthorized']);
const PUBLISH_JOB_STATUSES = Object.freeze(['draft', 'queued', 'validating', 'delivering', 'delivered', 'failed', 'cancelled', 'outcome_unknown']);
const PROVIDER_ATTEMPT_STATUSES = Object.freeze(['started', 'accepted', 'rejected', 'temporary_failure', 'permanent_failure', 'outcome_unknown', 'reconciled']);
const EXTERNAL_POST_STATES = Object.freeze(['confirmed', 'outcome_unknown', 'unavailable', 'deleted']);
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

function plain(value) { if(value===null||typeof value!=='object'||Array.isArray(value))return false;const prototype=Object.getPrototypeOf(value);return prototype===null||prototype===Object.prototype; }
function exact(value, required, optional = []) {
  if (!plain(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}
function stableId(value) { return typeof value === 'string' && ID.test(value); }
function boundedText(value, max, nullable = false) { return nullable && value === null || typeof value === 'string' && value.length > 0 && value.length <= max; }
function timestamp(value, nullable = false) { return nullable && value === null || typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)); }
function platform(value) { return PLATFORMS.includes(value); }
function boundedContext(value) {
  return exact(value, ['requestId', 'accountId'], ['connectionId', 'destinationId', 'jobId'])
    && stableId(value.requestId) && boundedText(value.accountId, 320)
    && ['connectionId', 'destinationId', 'jobId'].every((key) => value[key] === undefined || stableId(value[key]));
}

module.exports = { PLATFORMS, CONNECTION_STATUSES, DESTINATION_STATUSES, PUBLISH_JOB_STATUSES,
  PROVIDER_ATTEMPT_STATUSES, EXTERNAL_POST_STATES, plain, exact, stableId, boundedText,
  timestamp, platform, boundedContext };
