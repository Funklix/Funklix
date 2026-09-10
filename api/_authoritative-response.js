'use strict';

const CONTRACT_VERSION = 'bw32.3.9-v1';
const REQUEST_ID = /^(?:req_)?[A-Za-z0-9_-]{8,128}$/;

function isPlain(value, seen = new WeakSet()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) { if(seen.has(value))return false;seen.add(value);return value.length <= 100 && value.every(item=>isPlain(item,seen)); }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  if(seen.has(value))return false;seen.add(value);
  return Object.keys(value).length <= 100 && Object.entries(value).every(([key, item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) && item !== undefined && isPlain(item,seen));
}

function requestId(value) {
  return typeof value === 'string' && REQUEST_ID.test(value) ? value : '';
}

function write(res, httpStatus, envelope) {
  const id = requestId(envelope?.server_request_id);
  if (!id || !isPlain(envelope) || typeof envelope.contract_version !== 'string' ||
      typeof envelope.ok !== 'boolean' || typeof envelope.status !== 'string' ||
      typeof envelope.classification !== 'string') throw new TypeError('unsafe_authoritative_envelope');
  const serialized = JSON.stringify(envelope);
  res.statusCode = httpStatus;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('X-Request-Id', id);
  res.end(serialized);
  return envelope;
}

function emergency(res, { server_request_id, job_id }) {
  return write(res, 503, { contract_version: CONTRACT_VERSION, ok: false,
    status: 'reconciliation_required', classification: 'response_construction_failed',
    server_request_id: requestId(server_request_id), job_id: String(job_id || ''), retryable: false });
}

module.exports = { CONTRACT_VERSION, REQUEST_ID, isPlain, requestId, write, emergency };
