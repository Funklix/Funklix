'use strict';

const definitions = {
  connector_not_configured:['configuration',false,'administrator',true], encryption_key_unavailable:['configuration',false,'administrator',true], unsupported_platform:['configuration',false,'none',false], unsupported_capability:['configuration',false,'none',false],
  authentication_required:['authorization',false,'sign_in',false], account_mismatch:['authorization',false,'sign_in',true], board_access_denied:['authorization',false,'permissions',false], destination_access_denied:['authorization',false,'permissions',true],
  oauth_state_invalid:['oauth_state',false,'retry',false], oauth_state_expired:['oauth_state',false,'retry',false], oauth_state_consumed:['oauth_state',false,'retry',true], oauth_session_mismatch:['oauth_state',false,'sign_in',true], oauth_return_invalid:['oauth_state',false,'retry',false],
  connection_missing:['connection',false,'reconnect',false], connection_revoked:['connection',false,'reconnect',false], connection_needs_attention:['connection',false,'reconnect',false], destination_missing:['connection',false,'reconnect',false], destination_unavailable:['connection',true,'retry',false],
  content_not_approved:['publishing',false,'edit_content',false], approval_stale:['publishing',false,'review',false], content_incomplete:['publishing',false,'edit_content',false], unsupported_content:['publishing',false,'edit_content',false], idempotency_conflict:['publishing',false,'none',true], job_stale:['publishing',false,'review',true], outcome_unknown:['publishing',true,'wait',true],
  connector_storage_unavailable:['storage',true,'retry',true], connector_contract_invalid:['storage',false,'none',true]
};
function safeError(code, requestId) {
  const definition = definitions[code] || definitions.connector_contract_invalid;
  return Object.freeze({ code: definitions[code] ? code : 'connector_contract_invalid', classification: definition[0], retryable: definition[1], userAction: definition[2], supportCorrelation: definition[3], ...(requestId ? { requestId } : {}) });
}
function connectorError(code) { const error = new Error('Social connector operation failed'); error.connector = safeError(code); return error; }
module.exports = { definitions: Object.freeze(definitions), safeError, connectorError };
