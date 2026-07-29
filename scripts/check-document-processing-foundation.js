const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

process.env.AUTH_SECRET = 'phase-b1-test-auth-secret';
process.env.DOCUMENT_PROCESSING_WORKER_SECRET = 'worker-secret-with-at-least-32-characters';
process.env.ALLOW_DOCUMENT_TEST_SCANNER = 'true';

const processing = require('../api/_document-processing-records');
const scanner = require('../api/_document-scanner');
const route = require('../api/_document-processing-route');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const schema = read('api/_document-processing-records.js');
const documentRoute = read('api/_document-route.js');
const boardCreate = read('api/boards/index.js');
const boardDelete = read('api/boards/[id].js');
const context = read('api/_brand-brain-context.js');
const app = read('app.js');

// Exact revision identity, normalized states, attempts, versions, leases, and one-job invariants.
for (const column of ['board_id', 'tile_id', 'source_type', 'document_id', 'document_revision', 'content_hash']) assert(schema.includes(column));
for (const state of processing.JOB_STATES) assert(schema.includes(`'${state}'`));
assert(schema.includes('attempt_count BETWEEN 0 AND 3'));
assert(schema.includes('parser_version') && schema.includes('chunker_version') && schema.includes('scan_reference') && schema.includes('scan_version'));
assert(schema.includes('lease_token') && schema.includes('lease_owner') && schema.includes('lease_expires_at'));
assert(schema.includes('UNIQUE(board_id,tile_id,source_type,document_id,document_revision,content_hash)'));
assert(schema.includes('FOR UPDATE OF j SKIP LOCKED'));
assert(schema.includes("j.lease_expires_at > NOW()") && schema.includes("j.state='scanning'"));
assert(schema.includes('d.revision=j.document_revision') && schema.includes('d.content_hash=j.content_hash'));

// Jobs/results contain no prohibited payload fields or private object location.
const createTables = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS brand_document_processing_jobs'), schema.indexOf('function publicJob'));
for (const prohibited of ['storage_key', 'private_url', 'source_binary', 'extracted_text', 'scan_report', 'stack_trace', 'credential', 'prompt', 'embedding', 'chunks JSON']) assert(!createTables.includes(prohibited), prohibited);

// Request binding schema is exact and rejects malformed revisions/hashes/IDs.
const exact = { method: 'POST', body: { documentId: '12345678-1234-1234-1234-123456789abc', documentRevision: 2, contentHash: 'a'.repeat(64) } };
assert.deepStrictEqual(route.parseExpectedBinding(exact), exact.body);
assert.strictEqual(route.parseExpectedBinding({ method: 'POST', body: { ...exact.body, documentRevision: 0 } }), null);
assert.strictEqual(route.parseExpectedBinding({ method: 'POST', body: { ...exact.body, contentHash: 'raw-private-data' } }), null);

// Internal authentication is deny-by-default and does not accept short or incorrect secrets.
assert.strictEqual(route.internalAuthorized({ headers: {} }), false);
assert.strictEqual(route.internalAuthorized({ headers: { authorization: 'Bearer wrong' } }), false);
assert.strictEqual(route.internalAuthorized({ headers: { authorization: `Bearer ${process.env.DOCUMENT_PROCESSING_WORKER_SECRET}` } }), true);

// Scanner is fail-closed by default; deterministic scanners require explicit test-only DI.
(async () => {
const unavailable = scanner.createScannerProvider();
assert.strictEqual(unavailable.configured, false);
assert.deepStrictEqual(await unavailable.scan(), { status: 'not_configured', reference: null, version: null });
const fake = scanner.createScannerProvider({ testProvider: { version: 'fake-v1', async scan() { return { status: 'clean', reference: 'safe-test-ref' }; } } });
assert.strictEqual(fake.configured, true);
assert.strictEqual((await fake.scan()).status, 'clean');
assert(!read('api/_document-scanner.js').includes('process.env.DOCUMENT_SCANNER_PROVIDER'));
const productionFake = spawnSync(process.execPath, ['-e', "require('./api/_document-scanner').createScannerProvider({testProvider:{scan(){}}})"], {
  cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', ALLOW_DOCUMENT_TEST_SCANNER: 'true' }, encoding: 'utf8'
});
assert.notStrictEqual(productionFake.status, 0);

// Start/retry resolve to blocked without a scanner; worker paths never map absence/failure to clean.
const processingRoute = read('api/_document-processing-route.js');
assert(processingRoute.includes("blockUnconfiguredJob(auth.binding)"));
assert(schema.includes('attempt_count=attempt_count+1') && schema.includes('attempt_count < max_attempts'));
assert(processingRoute.includes("state: 'blocked', scanStatus: 'not_configured', safeErrorCode: 'scanner_not_configured'"));
assert(processingRoute.includes("state: 'failed', scanStatus: 'error', safeErrorCode: 'scanner_failed'"));
assert(!processingRoute.includes('extractedText') && !processingRoute.includes('OpenAI') && !processingRoute.includes('embedding'));

// Same-origin user authorization is reused, edit access is required for every mutation, and bodies are bounded.
assert(processingRoute.includes("authorize(req, res, { edit })"));
assert(processingRoute.includes("authorizeBinding(req, res, { edit: true })"));
assert(processingRoute.includes('hasBoundedJsonBody(req)'));
assert(processingRoute.includes("Cache-Control', 'private, no-store"));
assert(processingRoute.includes('hasOnlyKeys'));

// Replacement/deletion supersede exact old revisions and invalidate leases before late completion.
assert(documentRoute.includes('processing.supersedeDocumentProcessing(current, client)'));
assert(documentRoute.includes('processing.supersedeDocumentProcessing(row, client)'));
assert(schema.includes("state='superseded'") && schema.includes('lease_token=NULL'));
assert(schema.includes('brand_document_processing_results SET superseded_at'));

// Board cascades clean processing rows; board creation/copy has no jobs/results path.
assert(schema.includes('board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE'));
assert(boardDelete.includes('ensureDocumentTables()'));
assert(!boardCreate.includes('brand_document_processing_jobs') && !boardCreate.includes('brand_document_processing_results'));

// Board JSON and browser state retain the Phase A privacy boundary.
assert(!app.includes('processingJobId') && !app.includes('documentProcessingResult'));
assert(!app.includes('brand_document_processing_jobs') && !app.includes('brand_document_processing_results'));

// Canonical source content remains excluded from Campaign context.
assert(context.includes('PRIVATE_DOCUMENT_SOURCE_MODULES'));
assert(context.includes('!PRIVATE_DOCUMENT_SOURCE_MODULES.has(tile?.moduleType)'));

console.log('Document processing Phase B1 schema, authorization, binding, scan-gating, lease, lifecycle, privacy, and context checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
