const crypto = require('crypto');
const { authorize } = require('./_document-route');
const { normalizeEmail } = require('./_board-access');
const documentRecords = require('./_document-records');
const processing = require('./_document-processing-records');
const { createScannerProvider } = require('./_document-scanner');
const { documentImportDisabled } = require('./_document-feature');

function noStore(res) { res.setHeader('Cache-Control', 'private, no-store, max-age=0'); res.setHeader('X-Content-Type-Options', 'nosniff'); }
function clean(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function errorResponse(res, status, code, message) { return res.status(status).json({ error: { code, message } }); }
function hasBoundedJsonBody(req) { try { return Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') <= 16 * 1024; } catch (_) { return false; } }
function hasOnlyKeys(value, allowed) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.has(key)); }

function parseExpectedBinding(req) {
  const source = req.method === 'GET' ? req.query : req.body;
  const documentId = clean(source?.documentId, 120);
  const contentHash = clean(source?.contentHash, 64).toLowerCase();
  const documentRevision = Number(source?.documentRevision);
  if (!/^[0-9a-f-]{36}$/.test(documentId) || !/^[0-9a-f]{64}$/.test(contentHash) || !Number.isSafeInteger(documentRevision) || documentRevision < 1) return null;
  return { documentId, documentRevision, contentHash };
}

async function authorizeBinding(req, res, { edit = false } = {}) {
  const auth = await authorize(req, res, { edit });
  if (!auth) return null;
  const expected = parseExpectedBinding(req);
  if (!expected) { errorResponse(res, 400, 'invalid_processing_target', 'An exact active document revision is required.'); return null; }
  await documentRecords.ensureDocumentTables();
  const document = await documentRecords.getActiveDocument(auth.boardId, auth.tileId);
  if (!document || document.id !== expected.documentId || document.revision !== expected.documentRevision || document.content_hash !== expected.contentHash || document.source_type !== auth.sourceType) {
    errorResponse(res, 409, 'stale_document_revision', 'The active document changed. Reload and try again.'); return null;
  }
  return { ...auth, document, binding: processing.documentBinding(document) };
}

async function start(req, res) {
  const auth = await authorizeBinding(req, res, { edit: true }); if (!auth) return;
  return documentImportDisabled(res);
  /* istanbul ignore next */
  let row = await processing.startJob(auth.binding, normalizeEmail(auth.user.email));
  if (row.state === 'queued' && !createScannerProvider().configured) row = await processing.blockUnconfiguredJob(auth.binding);
  return res.status(row.state === 'queued' ? 202 : 200).json({ job: processing.publicJob(row) });
}

async function status(req, res) {
  const auth = await authorizeBinding(req, res); if (!auth) return;
  await processing.ensureDocumentProcessingTables();
  const row = await processing.getBoundJob(auth.binding);
  return res.status(200).json({ job: processing.publicJob(row) });
}

async function retry(req, res) {
  const auth = await authorizeBinding(req, res, { edit: true }); if (!auth) return;
  return documentImportDisabled(res);
  /* istanbul ignore next */
  const before = await processing.getBoundJob(auth.binding);
  if (!before) return errorResponse(res, 404, 'processing_job_not_found', 'Processing has not been started for this document.');
  if (!processing.RETRYABLE_JOB_STATES.has(before.state) || before.attempt_count >= before.max_attempts) return errorResponse(res, 409, 'retry_not_allowed', 'This processing job cannot be retried.');
  let row = await processing.retryJob(auth.binding, normalizeEmail(auth.user.email));
  if (row.state === 'queued' && !createScannerProvider().configured) row = await processing.blockUnconfiguredJob(auth.binding);
  return res.status(row.state === 'queued' ? 202 : 200).json({ job: processing.publicJob(row) });
}

async function cancel(req, res) {
  const auth = await authorizeBinding(req, res, { edit: true }); if (!auth) return;
  const before = await processing.getBoundJob(auth.binding);
  if (!before) return errorResponse(res, 404, 'processing_job_not_found', 'Processing has not been started for this document.');
  if (!['queued', 'scanning', 'blocked', 'processing'].includes(before.state)) return errorResponse(res, 409, 'cancel_not_allowed', 'This processing job cannot be cancelled.');
  const row = await processing.cancelJob(auth.binding);
  return res.status(200).json({ job: processing.publicJob(row) });
}

function internalAuthorized(req) {
  const expected = process.env.DOCUMENT_PROCESSING_WORKER_SECRET || '';
  const supplied = clean(req.headers?.authorization, 1000).replace(/^Bearer\s+/i, '');
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

async function processClaimedJob(claim, scanner = createScannerProvider()) {
  if (!claim) return null;
  const base = { jobId: claim.row.id, leaseToken: claim.leaseToken, workerId: claim.row.lease_owner };
  if (!scanner.configured) return processing.transitionClaimedJob({ ...base, state: 'blocked', scanStatus: 'not_configured', safeErrorCode: 'scanner_not_configured' });
  try {
    const result = await scanner.scan({
      boardId: claim.row.board_id, tileId: claim.row.tile_id, sourceType: claim.row.source_type,
      documentId: claim.row.document_id, documentRevision: claim.row.document_revision, contentHash: claim.row.content_hash
    });
    if (result?.status === 'clean') return processing.transitionClaimedJob({ ...base, state: 'processing', scanStatus: 'clean', scanReference: clean(result.reference, 200) || null, scanVersion: clean(result.version || scanner.version, 100) || null });
    if (result?.status === 'infected') return processing.transitionClaimedJob({ ...base, state: 'blocked', scanStatus: 'infected', safeErrorCode: 'malware_detected', scanReference: clean(result.reference, 200) || null, scanVersion: clean(result.version || scanner.version, 100) || null });
    return processing.transitionClaimedJob({ ...base, state: 'failed', scanStatus: 'error', safeErrorCode: 'scanner_failed', scanVersion: clean(result?.version || scanner.version, 100) || null });
  } catch (_error) {
    return processing.transitionClaimedJob({ ...base, state: 'failed', scanStatus: 'error', safeErrorCode: 'scanner_failed', scanVersion: clean(scanner.version, 100) || null });
  }
}

async function run(req, res) {
  if (!internalAuthorized(req)) return errorResponse(res, 401, 'worker_unauthorized', 'Worker authentication required.');
  return documentImportDisabled(res);
  /* istanbul ignore next */
  await documentRecords.ensureDocumentTables();
  const workerId = clean(req.body?.workerId, 100);
  if (!/^[A-Za-z0-9._:-]{3,100}$/.test(workerId)) return errorResponse(res, 400, 'invalid_worker', 'A valid worker identifier is required.');
  const claim = await processing.claimJob(workerId);
  if (!claim) return res.status(200).json({ job: null });
  const row = await processClaimedJob(claim);
  return res.status(200).json({ job: processing.publicJob(row) });
}

const USER_KEYS = new Set(['boardId', 'tileId', 'sourceType', 'documentId', 'documentRevision', 'contentHash']);
const WORKER_KEYS = new Set(['workerId']);
function handler(operation) {
  return async (req, res) => {
    noStore(res);
    try {
      if (req.method !== 'GET' && !hasBoundedJsonBody(req)) return errorResponse(res, 413, 'request_too_large', 'The request is too large.');
      if (operation === 'run' && !hasOnlyKeys(req.body, WORKER_KEYS)) return errorResponse(res, 400, 'invalid_request', 'The worker request is invalid.');
      if (operation !== 'run' && !hasOnlyKeys(req.method === 'GET' ? req.query : req.body, USER_KEYS)) return errorResponse(res, 400, 'invalid_request', 'The processing request is invalid.');
      if (operation === 'run' && req.method === 'POST') return run(req, res);
      if (operation === 'start' && req.method === 'POST') return start(req, res);
      if (operation === 'status' && req.method === 'GET') return status(req, res);
      if (operation === 'retry' && req.method === 'POST') return retry(req, res);
      if (operation === 'cancel' && req.method === 'POST') return cancel(req, res);
      return errorResponse(res, 405, 'method_not_allowed', 'Method not allowed.');
    } catch (error) {
      console.error('[DOCUMENT_PROCESSING_ROUTE_FAILED]', { operation, code: clean(error?.code, 80) || 'internal_error' });
      return errorResponse(res, 500, 'processing_operation_failed', 'The processing operation failed.');
    }
  };
}

module.exports = { handler, parseExpectedBinding, authorizeBinding, internalAuthorized, processClaimedJob };
