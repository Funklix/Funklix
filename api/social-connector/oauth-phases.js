'use strict';
// Server-owned persisted OAuth diagnostic vocabulary. SQL is generated from this
// list so application writers and the database constraint cannot drift.
const OAUTH_PHASES=Object.freeze([
  'state_received','callback_entered','schema_ready','state_loaded','state_validated',
  'state_consumed','token_exchange_started','token_received','identity_request_started',
  'identity_resolved','credential_sealed','connection_transaction_started',
  'token_secret_written','connected_account_written','destination_written',
  'connection_committed','callback_result_created','redirect_created','completed','unknown'
]);
const PHASE_SET=new Set(OAUTH_PHASES);
function isOAuthPhase(value){return typeof value==='string'&&PHASE_SET.has(value);}
function requireOAuthPhase(value){if(!isOAuthPhase(value))throw new TypeError('Invalid server OAuth phase');return value;}
function sqlLiterals(){return OAUTH_PHASES.map(value=>`'${value}'`).join(',');}
module.exports={OAUTH_PHASES,isOAuthPhase,requireOAuthPhase,sqlLiterals};
