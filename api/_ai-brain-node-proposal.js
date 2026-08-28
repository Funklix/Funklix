'use strict';

const crypto = require('crypto');

const LIMITS = Object.freeze({ proposalId: 80, turnId: 80, title: 120, body: 4000, rationale: 500 });
const PROVIDER_KEYS = Object.freeze(['node_type', 'title', 'body', 'rationale']);
const RESPONSE_KEYS = Object.freeze(['proposal_id', 'source_turn_id', ...PROVIDER_KEYS]);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exactKeys(value, allowed, required = allowed) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key) && !FORBIDDEN_KEYS.has(key))
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
function boundedText(value, maximum, { multiline = false, optional = false } = {}) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized || normalized.length > maximum) return optional && !normalized ? '' : null;
  const disallowed = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  return disallowed.test(normalized) ? null : normalized;
}
function validateProviderProposal(input) {
  if (!exactKeys(input, PROVIDER_KEYS, ['node_type', 'title', 'body'])) return { ok: false, classification: 'proposal_shape' };
  if (input.node_type !== 'Content') return { ok: false, classification: 'proposal_role' };
  const title = boundedText(input.title, LIMITS.title);
  const body = boundedText(input.body, LIMITS.body, { multiline: true });
  const rationale = boundedText(input.rationale, LIMITS.rationale, { multiline: true, optional: true });
  if (title === null || body === null || rationale === null) return { ok: false, classification: 'proposal_content' };
  return { ok: true, value: Object.assign(Object.create(null), { node_type: 'Content', title, body, ...(rationale ? { rationale } : {}) }) };
}
function createProposal(input, sourceTurnId) {
  const validated = validateProviderProposal(input);
  const turn = boundedText(sourceTurnId, LIMITS.turnId);
  if (!validated.ok || !turn) return { ok: false, classification: validated.classification || 'source_turn' };
  return { ok: true, value: Object.assign(Object.create(null), {
    proposal_id: crypto.randomBytes(24).toString('base64url'), source_turn_id: turn, ...validated.value
  }) };
}
function validateResponseProposal(input) {
  if (!exactKeys(input, RESPONSE_KEYS, ['proposal_id', 'source_turn_id', 'node_type', 'title', 'body'])) return { ok: false, classification: 'proposal_shape' };
  const proposalId = boundedText(input.proposal_id, LIMITS.proposalId);
  const sourceTurnId = boundedText(input.source_turn_id, LIMITS.turnId);
  const provider = validateProviderProposal(Object.assign(Object.create(null), {
    node_type: input.node_type, title: input.title, body: input.body,
    ...(Object.prototype.hasOwnProperty.call(input, 'rationale') ? { rationale: input.rationale } : {})
  }));
  if (!proposalId || !sourceTurnId || !provider.ok) return { ok: false, classification: provider.classification || 'proposal_identity' };
  return { ok: true, value: Object.assign(Object.create(null), { proposal_id: proposalId, source_turn_id: sourceTurnId, ...provider.value }) };
}

module.exports = { LIMITS, PROVIDER_KEYS, RESPONSE_KEYS, createProposal, validateProviderProposal, validateResponseProposal };
