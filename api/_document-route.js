const crypto = require('crypto');
const { getSessionUser } = require('./_auth-session');
const { getBoardAccess, normalizeEmail } = require('./_board-access');
const { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, sanitizeFilename, validateDocument, DocumentValidationError } = require('./_document-validation');
const storage = require('./_document-storage');
const records = require('./_document-records');
const processing = require('./_document-processing-records');
const { documentImportDisabled } = require('./_document-feature');

function noStore(res) { res.setHeader('Cache-Control', 'private, no-store, max-age=0'); res.setHeader('X-Content-Type-Options', 'nosniff'); }
function clean(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function errorResponse(res, status, code, message) { return res.status(status).json({ error: { code, message } }); }
function hasBoundedJsonBody(req) { try { return Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') <= 16 * 1024; } catch (_) { return false; } }
function validMutationOrigin(req) {
  const origin = clean(req.headers?.origin, 500); if (!origin) return true;
  const host = clean(req.headers?.['x-forwarded-host'] || req.headers?.host, 300);
  try { return new URL(origin).host === host; } catch (_) { return false; }
}
async function authorize(req, res, { edit = false } = {}) {
  if (edit && !validMutationOrigin(req)) { errorResponse(res, 403, 'invalid_origin', 'The request origin is not allowed.'); return null; }
  const user = getSessionUser(req); if (!user?.email) { errorResponse(res, 401, 'unauthenticated', 'Authentication required.'); return null; }
  const boardId = clean(req.query?.boardId || req.body?.boardId, 120); const tileId = clean(req.query?.tileId || req.body?.tileId, 180);
  const sourceType = clean(req.query?.sourceType || req.body?.sourceType, 40);
  if (!boardId || !tileId || !records.SOURCE_TYPES.has(sourceType)) { errorResponse(res, 400, 'invalid_request', 'A valid board and document-source tile are required.'); return null; }
  const { board, access } = await getBoardAccess(boardId, user, { columns: 'id, brand_core_snapshot, owner_id, owner_email' });
  if (!board) { errorResponse(res, 404, 'board_not_found', 'Board not found.'); return null; }
  if (!(edit ? access?.canEdit : access?.canView) || (!edit && ['anonymous_shared', 'non_owner'].includes(access?.role))) { errorResponse(res, 403, 'forbidden', 'You do not have permission to access this document.'); return null; }
  if (!records.verifySourceTile(board, tileId, sourceType)) { errorResponse(res, 409, 'source_tile_changed', 'The document-source tile changed. Reload and try again.'); return null; }
  return { user, board, access, boardId, tileId, sourceType };
}
async function streamToBuffer(result) {
  if (!result || result.statusCode !== 200 || !result.stream) throw new DocumentValidationError('upload_missing', 'The uploaded file could not be found.', 409);
  const reader = result.stream.getReader(); const chunks = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > MAX_DOCUMENT_BYTES) { await reader.cancel(); throw new DocumentValidationError('file_too_large', 'Documents must be 20 MB or smaller.', 413); } chunks.push(Buffer.from(value)); }
  return Buffer.concat(chunks, total);
}

async function metadata(req, res) {
  const auth = await authorize(req, res); if (!auth) return;
  await records.ensureDocumentTables(); const row = await records.getActiveDocument(auth.boardId, auth.tileId);
  return res.status(200).json({ document: records.publicDocument(row) });
}

async function intent(req, res) {
  const auth = await authorize(req, res, { edit: true }); if (!auth) return;
  return documentImportDisabled(res);
  /* Legacy implementation retained for reversible reactivation and lifecycle reference. */
  /* istanbul ignore next */
  const requestId = clean(req.body?.requestId, 180); const originalFilename = clean(req.body?.filename, 500); const declared = clean(req.body?.mediaType, 150);
  const displayFilename = sanitizeFilename(originalFilename); const extension = displayFilename.toLowerCase().split('.').pop();
  if (!requestId || !/^[A-Za-z0-9_-]{12,180}$/.test(requestId)) return errorResponse(res, 400, 'invalid_request', 'A valid upload request is required.');
  if (extension === 'doc' || extension === 'docm') return errorResponse(res, 415, 'unsupported_type', 'Legacy DOC and macro-enabled DOCM files are not supported.');
  if (!DOCUMENT_TYPES[extension] || (declared && declared !== DOCUMENT_TYPES[extension] && !(extension === 'docx' && declared === 'application/zip'))) return errorResponse(res, 415, 'unsupported_type', 'Use a PDF or DOCX file.');
  await records.ensureDocumentTables(); storage.assertConfigured();
  const expired = await records.pool.query("UPDATE brand_document_upload_intents SET status='expired' WHERE board_id=$1 AND tile_id=$2 AND status='pending' AND expires_at <= NOW() RETURNING storage_key", [auth.boardId, auth.tileId]);
  expired.rows.forEach((row) => storage.deletePrivate(row.storage_key).catch(() => {}));
  const current = await records.getActiveDocument(auth.boardId, auth.tileId);
  if (current?.upload_status === 'deleting') return errorResponse(res, 409, 'document_busy', 'The active document is being deleted.');
  const storageKey = records.createStorageKey({ ...auth, extension });
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  try { await records.pool.query(`INSERT INTO brand_document_upload_intents(request_id,board_id,tile_id,source_type,original_filename,display_filename,declared_media_type,extension,storage_key,expected_document_id,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [requestId, auth.boardId, auth.tileId, auth.sourceType, originalFilename.slice(0,500), displayFilename, declared || DOCUMENT_TYPES[extension], extension, storageKey, current?.id || null, normalizeEmail(auth.user.email), expiresAt]); }
  catch (error) { if (error?.code === '23505') return errorResponse(res, 409, 'upload_in_progress', 'An upload is already in progress for this tile.'); throw error; }
  try { const uploadUrl = await storage.createUploadUrl({ pathname: storageKey, contentType: DOCUMENT_TYPES[extension], maximumSizeInBytes: MAX_DOCUMENT_BYTES }); return res.status(201).json({ requestId, uploadUrl, expiresAt: expiresAt.toISOString(), displayFilename, mediaType: DOCUMENT_TYPES[extension], replacingDocumentId: current?.id || null }); }
  catch (error) { await records.pool.query("UPDATE brand_document_upload_intents SET status='failed' WHERE request_id=$1", [requestId]); throw error; }
}

async function cancelDisabledUploadIntent(auth, requestId) {
  await records.ensureDocumentTables();
  const found = await records.pool.query('SELECT * FROM brand_document_upload_intents WHERE request_id=$1 AND board_id=$2 AND tile_id=$3 AND source_type=$4 LIMIT 1', [requestId, auth.boardId, auth.tileId, auth.sourceType]);
  const upload = found.rows[0];
  if (upload?.status !== 'pending') return;
  const cancelled = await records.pool.query("UPDATE brand_document_upload_intents SET status='cancelled' WHERE id=$1 AND request_id=$2 AND board_id=$3 AND tile_id=$4 AND source_type=$5 AND status='pending' RETURNING storage_key", [upload.id, requestId, auth.boardId, auth.tileId, auth.sourceType]);
  if (cancelled.rows[0]?.storage_key) await storage.deletePrivate(cancelled.rows[0].storage_key).catch(() => {});
}

async function complete(req, res) {
  const auth = await authorize(req, res, { edit: true }); if (!auth) return;
  const requestId = clean(req.body?.requestId, 180);
  await cancelDisabledUploadIntent(auth, requestId);
  return documentImportDisabled(res);
  /* Legacy implementation retained for reversible reactivation and lifecycle reference. */
  /* istanbul ignore next */
  await records.ensureDocumentTables();
  const found = await records.pool.query('SELECT * FROM brand_document_upload_intents WHERE request_id=$1 AND board_id=$2 AND tile_id=$3 AND source_type=$4 LIMIT 1', [requestId, auth.boardId, auth.tileId, auth.sourceType]);
  const upload = found.rows[0];
  if (!upload || upload.status !== 'pending' || new Date(upload.expires_at) <= new Date()) return errorResponse(res, 409, 'stale_upload', 'This upload is no longer current.');
  let object;
  try { object = await storage.readPrivate(upload.storage_key); const buffer = await streamToBuffer(object); const validated = validateDocument({ buffer, filename: upload.display_filename, declaredMimeType: object.blob.contentType || upload.declared_media_type });
    const client = await records.pool.connect(); let oldKey = null;
    try { await client.query('BEGIN'); const current = await records.getActiveDocument(auth.boardId, auth.tileId, client, { forUpdate: true }); if ((current?.id || null) !== (upload.expected_document_id || null) || current?.upload_status === 'deleting') throw new DocumentValidationError('stale_upload', 'A newer document change already exists.', 409);
      if (current) { oldKey = current.storage_key; await processing.supersedeDocumentProcessing(current, client); await client.query("UPDATE brand_documents SET active=FALSE, replaced_at=NOW() WHERE id=$1", [current.id]); }
      const inserted = await client.query(`INSERT INTO brand_documents(board_id,tile_id,source_type,original_filename,display_filename,media_type,extension,file_size,content_hash,storage_key,malware_scan_status,page_count,page_count_status,created_by,replaced_at,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'not_configured',$11,$12,$13,$14,$15) RETURNING *`, [auth.boardId, auth.tileId, auth.sourceType, upload.original_filename, validated.displayFilename, validated.mediaType, validated.extension, validated.fileSize, validated.contentHash, upload.storage_key, validated.pageCount, validated.pageCountStatus, normalizeEmail(auth.user.email), current ? new Date() : null, (current?.revision || 0) + 1]);
      await client.query("UPDATE brand_document_upload_intents SET status='completed' WHERE id=$1 AND status='pending'", [upload.id]); await client.query('COMMIT');
      if (oldKey) storage.deletePrivate(oldKey).catch(() => console.warn('[DOCUMENT_CLEANUP_DEFERRED]', { documentId: current.id }));
      return res.status(201).json({ document: records.publicDocument(inserted.rows[0]) });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } catch (error) { await records.pool.query("UPDATE brand_document_upload_intents SET status='failed' WHERE id=$1 AND status='pending'", [upload.id]); storage.deletePrivate(upload.storage_key).catch(() => {}); if (error instanceof DocumentValidationError) return errorResponse(res, error.status, error.code, error.message); throw error; }
}

async function remove(req, res) {
  const auth = await authorize(req, res, { edit: true }); if (!auth) return; await records.ensureDocumentTables();
  const expected = clean(req.body?.documentId, 120); const deleteForTile = req.body?.deleteForTile === true; const client = await records.pool.connect(); let row;
  const cancelled = await records.pool.query("UPDATE brand_document_upload_intents SET status='cancelled' WHERE board_id=$1 AND tile_id=$2 AND status='pending' RETURNING storage_key", [auth.boardId, auth.tileId]);
  cancelled.rows.forEach((intent) => storage.deletePrivate(intent.storage_key).catch(() => {}));
  try { await client.query('BEGIN'); row = await records.getActiveDocument(auth.boardId, auth.tileId, client, { forUpdate: true }); if (!row) { await client.query('ROLLBACK'); return res.status(200).json({ document: null }); }
    if ((!deleteForTile && !expected) || (expected && row.id !== expected)) { await client.query('ROLLBACK'); return errorResponse(res, 409, 'stale_document', 'The active document changed. Reload and try again.'); }
    await processing.supersedeDocumentProcessing(row, client); await client.query("UPDATE brand_documents SET upload_status='deleting' WHERE id=$1", [row.id]); await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  try { await storage.deletePrivate(row.storage_key); await records.pool.query("UPDATE brand_documents SET active=FALSE, upload_status='deleted', deleted_at=NOW() WHERE id=$1 AND upload_status='deleting'", [row.id]); return res.status(200).json({ document: null }); }
  catch (_error) { await records.pool.query("UPDATE brand_documents SET upload_status='uploaded' WHERE id=$1 AND active AND deleted_at IS NULL", [row.id]); return errorResponse(res, 503, 'delete_failed', 'The document could not be deleted. Please try again.'); }
}

async function download(req, res) {
  const auth = await authorize(req, res); if (!auth) return; await records.ensureDocumentTables(); const expected = clean(req.query?.documentId, 120);
  const row = await records.getActiveDocument(auth.boardId, auth.tileId); if (!row || row.id !== expected) return errorResponse(res, 404, 'document_not_found', 'Document not found.');
  const result = await storage.readPrivate(row.storage_key); if (!result || result.statusCode !== 200) return errorResponse(res, 404, 'document_not_found', 'Document not found.');
  res.setHeader('Content-Type', row.media_type); res.setHeader('Content-Disposition', `attachment; filename="${row.display_filename.replace(/["\\\r\n]/g, '_')}"`); res.setHeader('Content-Length', String(row.file_size));
  const reader = result.stream.getReader(); while (true) { const { done, value } = await reader.read(); if (done) break; if (!res.write(Buffer.from(value))) await new Promise((resolve) => res.once('drain', resolve)); } return res.end();
}

function handler(operation) { return async (req, res) => { noStore(res); try { if (req.method !== 'GET' && !hasBoundedJsonBody(req)) return errorResponse(res, 413, 'request_too_large', 'The request is too large.'); if (operation === 'metadata' && req.method === 'GET') return metadata(req,res); if (operation === 'intent' && req.method === 'POST') return intent(req,res); if (operation === 'complete' && req.method === 'POST') return complete(req,res); if (operation === 'document' && req.method === 'DELETE') return remove(req,res); if (operation === 'download' && req.method === 'GET') return download(req,res); return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method not allowed.' } }); } catch (error) { console.error('[DOCUMENT_ROUTE_FAILED]', { operation, code: error?.code || 'internal_error' }); return errorResponse(res, 500, error?.message === 'private_document_storage_unavailable' ? 'storage_unavailable' : 'document_operation_failed', error?.message === 'private_document_storage_unavailable' ? 'Private document storage is not configured.' : 'The document operation failed.'); } }; }
module.exports = { handler, authorize, streamToBuffer, cancelDisabledUploadIntent };
