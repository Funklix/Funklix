const crypto = require('crypto');
const { pool, ensureBoardsTable } = require('./_boards-storage');
const { ensureDocumentProcessingTables } = require('./_document-processing-records');

const SOURCE_TYPES = new Set(['pitch_deck', 'whitepaper']);
let schemaReadyPromise;

async function ensureDocumentTables() {
  await ensureBoardsTable();
  if (!schemaReadyPromise) schemaReadyPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS brand_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      original_filename TEXT NOT NULL, display_filename TEXT NOT NULL, media_type TEXT NOT NULL, extension TEXT NOT NULL,
      file_size INTEGER NOT NULL, content_hash TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE,
      upload_status TEXT NOT NULL DEFAULT 'uploaded', malware_scan_status TEXT NOT NULL DEFAULT 'not_configured',
      page_count INTEGER, page_count_status TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), replaced_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT TRUE, revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_documents_active_tile_uidx ON brand_documents(board_id,tile_id) WHERE active AND deleted_at IS NULL;
    CREATE TABLE IF NOT EXISTS brand_document_upload_intents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id TEXT NOT NULL UNIQUE, board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      original_filename TEXT NOT NULL, display_filename TEXT NOT NULL, declared_media_type TEXT NOT NULL, extension TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE, expected_document_id UUID, created_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_document_pending_tile_uidx ON brand_document_upload_intents(board_id,tile_id) WHERE status = 'pending';
  `).then(() => ensureDocumentProcessingTables()).catch((error) => { schemaReadyPromise = null; throw error; });
  return schemaReadyPromise;
}

function isStableTileId(value) { return typeof value === 'string' && /^km_[A-Za-z0-9][A-Za-z0-9_-]{7,}$/.test(value); }
function findSourceTile(board, tileId) {
  const tiles = Array.isArray(board?.brand_core_snapshot?.customTiles) ? board.brand_core_snapshot.customTiles : [];
  return tiles.find((tile) => tile?.id === tileId) || null;
}
function verifySourceTile(board, tileId, sourceType) {
  if (!isStableTileId(tileId) || !SOURCE_TYPES.has(sourceType)) return false;
  return findSourceTile(board, tileId)?.moduleType === sourceType;
}
function publicDocument(row) {
  if (!row) return null;
  return { documentId: row.id, boardId: row.board_id, tileId: row.tile_id, sourceType: row.source_type, displayFilename: row.display_filename,
    mediaType: row.media_type, extension: row.extension, fileSize: row.file_size, contentHash: row.content_hash, uploadStatus: row.upload_status,
    malwareScanStatus: row.malware_scan_status, pageCount: row.page_count, pageCountStatus: row.page_count_status, uploadedAt: row.uploaded_at,
    replacedAt: row.replaced_at, schemaVersion: row.schema_version, revision: row.revision };
}
function createStorageKey({ boardId, tileId, extension }) { return `brand-documents/${boardId}/${tileId}/${crypto.randomUUID()}.${extension}`; }
async function getActiveDocument(boardId, tileId, client = pool, { forUpdate = false } = {}) {
  const result = await client.query(`SELECT * FROM brand_documents WHERE board_id=$1 AND tile_id=$2 AND active AND deleted_at IS NULL LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`, [boardId, tileId]);
  return result.rows[0] || null;
}

module.exports = { pool, SOURCE_TYPES, ensureDocumentTables, verifySourceTile, publicDocument, createStorageKey, getActiveDocument };
