const crypto = require('crypto');
const { pool } = require('./_boards-storage');

const JOB_STATES = Object.freeze(['queued', 'scanning', 'blocked', 'processing', 'completed', 'failed', 'cancelled', 'superseded']);
const ACTIVE_JOB_STATES = Object.freeze(['queued', 'scanning', 'processing']);
const RETRYABLE_JOB_STATES = new Set(['blocked', 'failed']);
const MAX_JOB_ATTEMPTS = 3;
const LEASE_SECONDS = 120;
const PARSER_VERSION = 'none-phase-b1';
const CHUNKER_VERSION = 'none-phase-b1';
const PROCESSING_SCHEMA_VERSION = 1;
let schemaReadyPromise;

async function ensureDocumentProcessingTables(client = pool) {
  if (client !== pool) return createSchema(client);
  if (!schemaReadyPromise) schemaReadyPromise = createSchema(pool).catch((error) => { schemaReadyPromise = null; throw error; });
  return schemaReadyPromise;
}

async function createSchema(client) {
  return client.query(`
    CREATE TABLE IF NOT EXISTS brand_document_processing_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      document_id UUID NOT NULL REFERENCES brand_documents(id) ON DELETE CASCADE,
      document_revision INTEGER NOT NULL CHECK (document_revision > 0),
      content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
      state TEXT NOT NULL CHECK (state IN ('queued','scanning','blocked','processing','completed','failed','cancelled','superseded')),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
      max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 3),
      safe_error_code TEXT,
      parser_version TEXT NOT NULL DEFAULT 'none-phase-b1',
      chunker_version TEXT NOT NULL DEFAULT 'none-phase-b1',
      scan_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (scan_status IN ('not_configured','pending','clean','infected','error')),
      scan_reference TEXT,
      scan_version TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      lease_token TEXT,
      lease_owner TEXT,
      lease_expires_at TIMESTAMPTZ,
      requested_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      superseded_at TIMESTAMPTZ,
      UNIQUE(board_id,tile_id,source_type,document_id,document_revision,content_hash)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_document_processing_active_revision_uidx
      ON brand_document_processing_jobs(board_id,tile_id,source_type,document_id,document_revision,content_hash)
      WHERE state IN ('queued','scanning','processing');
    CREATE INDEX IF NOT EXISTS brand_document_processing_claim_idx
      ON brand_document_processing_jobs(state,created_at) WHERE state = 'queued';
    CREATE TABLE IF NOT EXISTS brand_document_processing_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL UNIQUE REFERENCES brand_document_processing_jobs(id) ON DELETE CASCADE,
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      document_id UUID NOT NULL REFERENCES brand_documents(id) ON DELETE CASCADE,
      document_revision INTEGER NOT NULL CHECK (document_revision > 0),
      content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
      parser_version TEXT NOT NULL,
      chunker_version TEXT NOT NULL,
      scan_reference TEXT,
      scan_version TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      superseded_at TIMESTAMPTZ,
      UNIQUE(board_id,tile_id,source_type,document_id,document_revision,content_hash)
    );
  `);
}

function publicJob(row) {
  if (!row) return null;
  return {
    jobId: row.id, boardId: row.board_id, tileId: row.tile_id, sourceType: row.source_type,
    documentId: row.document_id, documentRevision: row.document_revision, contentHash: row.content_hash,
    state: row.state, attemptCount: row.attempt_count, maxAttempts: row.max_attempts,
    errorCode: row.safe_error_code || null, parserVersion: row.parser_version, chunkerVersion: row.chunker_version,
    scanStatus: row.scan_status, scanReference: row.scan_reference || null, scanVersion: row.scan_version || null,
    schemaVersion: row.schema_version, createdAt: row.created_at, updatedAt: row.updated_at,
    startedAt: row.started_at || null, completedAt: row.completed_at || null,
    cancelledAt: row.cancelled_at || null, supersededAt: row.superseded_at || null
  };
}

async function getBoundJob(binding, client = pool, { forUpdate = false } = {}) {
  const result = await client.query(`SELECT * FROM brand_document_processing_jobs
    WHERE board_id=$1 AND tile_id=$2 AND source_type=$3 AND document_id=$4 AND document_revision=$5 AND content_hash=$6
    LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
  [binding.boardId, binding.tileId, binding.sourceType, binding.documentId, binding.documentRevision, binding.contentHash]);
  return result.rows[0] || null;
}

async function startJob(binding, requestedBy, client = pool) {
  await ensureDocumentProcessingTables();
  await client.query(`INSERT INTO brand_document_processing_jobs
    (board_id,tile_id,source_type,document_id,document_revision,content_hash,state,requested_by,parser_version,chunker_version,schema_version)
    VALUES($1,$2,$3,$4,$5,$6,'queued',$7,$8,$9,$10)
    ON CONFLICT(board_id,tile_id,source_type,document_id,document_revision,content_hash) DO NOTHING`,
  [binding.boardId, binding.tileId, binding.sourceType, binding.documentId, binding.documentRevision, binding.contentHash,
    requestedBy, PARSER_VERSION, CHUNKER_VERSION, PROCESSING_SCHEMA_VERSION]);
  return getBoundJob(binding, client);
}

async function retryJob(binding, requestedBy, client = pool) {
  await ensureDocumentProcessingTables();
  const result = await client.query(`UPDATE brand_document_processing_jobs SET state='queued', safe_error_code=NULL,
    scan_status='not_configured', scan_reference=NULL, scan_version=NULL, lease_token=NULL, lease_owner=NULL,
    lease_expires_at=NULL, requested_by=$7, updated_at=NOW(), cancelled_at=NULL, completed_at=NULL
    WHERE board_id=$1 AND tile_id=$2 AND source_type=$3 AND document_id=$4 AND document_revision=$5 AND content_hash=$6
      AND state IN ('blocked','failed') AND attempt_count < max_attempts RETURNING *`,
  [binding.boardId, binding.tileId, binding.sourceType, binding.documentId, binding.documentRevision, binding.contentHash, requestedBy]);
  return result.rows[0] || getBoundJob(binding, client);
}

async function blockUnconfiguredJob(binding, client = pool) {
  const result = await client.query(`UPDATE brand_document_processing_jobs SET state='blocked', scan_status='not_configured',
    safe_error_code='scanner_not_configured', lease_token=NULL, lease_owner=NULL, lease_expires_at=NULL,
    attempt_count=attempt_count+1, completed_at=NOW(), updated_at=NOW() WHERE board_id=$1 AND tile_id=$2 AND source_type=$3 AND document_id=$4
      AND document_revision=$5 AND content_hash=$6 AND state='queued' AND attempt_count < max_attempts RETURNING *`,
  [binding.boardId, binding.tileId, binding.sourceType, binding.documentId, binding.documentRevision, binding.contentHash]);
  return result.rows[0] || getBoundJob(binding, client);
}

async function cancelJob(binding, client = pool) {
  await ensureDocumentProcessingTables();
  const result = await client.query(`UPDATE brand_document_processing_jobs SET state='cancelled', safe_error_code=NULL,
    lease_token=NULL, lease_owner=NULL, lease_expires_at=NULL, cancelled_at=NOW(), updated_at=NOW()
    WHERE board_id=$1 AND tile_id=$2 AND source_type=$3 AND document_id=$4 AND document_revision=$5 AND content_hash=$6
      AND state IN ('queued','scanning','blocked','processing') RETURNING *`,
  [binding.boardId, binding.tileId, binding.sourceType, binding.documentId, binding.documentRevision, binding.contentHash]);
  return result.rows[0] || getBoundJob(binding, client);
}

async function claimJob(workerId, client = pool) {
  await ensureDocumentProcessingTables();
  const leaseToken = crypto.randomUUID();
  const result = await client.query(`WITH candidate AS (
      SELECT j.id FROM brand_document_processing_jobs j
      JOIN brand_documents d ON d.id=j.document_id
      WHERE j.state='queued' AND j.attempt_count < j.max_attempts
        AND d.active AND d.deleted_at IS NULL AND d.upload_status='uploaded'
        AND d.board_id=j.board_id AND d.tile_id=j.tile_id AND d.source_type=j.source_type
        AND d.revision=j.document_revision AND d.content_hash=j.content_hash
      ORDER BY j.created_at ASC FOR UPDATE OF j SKIP LOCKED LIMIT 1
    ) UPDATE brand_document_processing_jobs j SET state='scanning', attempt_count=j.attempt_count+1,
      lease_token=$1, lease_owner=$2, lease_expires_at=NOW()+($3 * INTERVAL '1 second'),
      started_at=COALESCE(j.started_at,NOW()), updated_at=NOW(), scan_status='pending'
    FROM candidate WHERE j.id=candidate.id RETURNING j.*`, [leaseToken, workerId, LEASE_SECONDS]);
  const row = result.rows[0] || null;
  return row ? { row, leaseToken } : null;
}

async function transitionClaimedJob({ jobId, leaseToken, workerId, state, scanStatus, safeErrorCode = null, scanReference = null, scanVersion = null }, client = pool) {
  if (!['blocked', 'processing', 'failed'].includes(state)) throw new Error('invalid_processing_transition');
  const result = await client.query(`UPDATE brand_document_processing_jobs j SET state=$4, scan_status=$5,
      safe_error_code=$6, scan_reference=$7, scan_version=$8, lease_token=NULL, lease_owner=NULL, lease_expires_at=NULL,
      completed_at=CASE WHEN $4 IN ('blocked','failed') THEN NOW() ELSE completed_at END, updated_at=NOW()
    FROM brand_documents d WHERE j.id=$1 AND j.lease_token=$2 AND j.lease_owner=$3 AND j.state='scanning'
      AND j.lease_expires_at > NOW() AND d.id=j.document_id AND d.active AND d.deleted_at IS NULL
      AND d.upload_status='uploaded' AND d.board_id=j.board_id AND d.tile_id=j.tile_id AND d.source_type=j.source_type
      AND d.revision=j.document_revision AND d.content_hash=j.content_hash RETURNING j.*`,
  [jobId, leaseToken, workerId, state, scanStatus, safeErrorCode, scanReference, scanVersion]);
  return result.rows[0] || null;
}

async function supersedeDocumentProcessing(documentRow, client = pool) {
  if (!documentRow) return;
  await client.query(`UPDATE brand_document_processing_jobs SET state='superseded', lease_token=NULL, lease_owner=NULL,
    lease_expires_at=NULL, superseded_at=NOW(), updated_at=NOW() WHERE board_id=$1 AND tile_id=$2 AND source_type=$3
    AND document_id=$4 AND document_revision=$5 AND content_hash=$6 AND state <> 'superseded'`,
  [documentRow.board_id, documentRow.tile_id, documentRow.source_type, documentRow.id, documentRow.revision, documentRow.content_hash]);
  await client.query(`UPDATE brand_document_processing_results SET superseded_at=COALESCE(superseded_at,NOW())
    WHERE board_id=$1 AND tile_id=$2 AND source_type=$3 AND document_id=$4 AND document_revision=$5 AND content_hash=$6`,
  [documentRow.board_id, documentRow.tile_id, documentRow.source_type, documentRow.id, documentRow.revision, documentRow.content_hash]);
}

function documentBinding(row) {
  return row ? { boardId: row.board_id, tileId: row.tile_id, sourceType: row.source_type, documentId: row.id,
    documentRevision: row.revision, contentHash: row.content_hash } : null;
}

module.exports = { JOB_STATES, ACTIVE_JOB_STATES, RETRYABLE_JOB_STATES, MAX_JOB_ATTEMPTS, LEASE_SECONDS,
  PARSER_VERSION, CHUNKER_VERSION, PROCESSING_SCHEMA_VERSION, ensureDocumentProcessingTables, publicJob,
  getBoundJob, startJob, retryJob, blockUnconfiguredJob, cancelJob, claimJob, transitionClaimedJob, supersedeDocumentProcessing, documentBinding };
