const { pool, ensureBoardsTable } = require('../_boards-storage');
const { getBoardAccess, normalizeEmail, refreshOwnEditorIdentity } = require('../_board-access');
const { getSessionUser } = require('../_auth-session');
const { ensureDocumentTables, pool: documentPool } = require('../_document-records');
const { deletePrivate } = require('../_document-storage');
const { getOwnedBrand, isBrandId } = require('../_brand-access');
const { serializeBoardForAccess } = require('../_board-serializer');

const BOARD_COLUMNS = 'id, name, canvas_json, brand_core_snapshot, brand_id, brand_core_source_revision, brand_core_source_updated_at, brand_core_snapshot_copied_at, brand_core_snapshot_backup, brand_core_backup_source_revision, brand_core_backup_source_updated_at, brand_core_backup_snapshot_copied_at, brand_core_snapshot_backup_created_at, created_at, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by';

function serializeBoardItem(row = {}) {
  const { brand_core_snapshot_backup, brand_core_backup_source_revision, brand_core_backup_source_updated_at,
    brand_core_backup_snapshot_copied_at, ...safeRow } = row;
  return {
    ...safeRow,
    brand_core_restore_available: isPlainObject(brand_core_snapshot_backup),
    brand_core_source_revision: row.brand_core_source_revision == null ? null : Number(row.brand_core_source_revision)
  };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validTimestamp(value) {
  return (typeof value === 'string' || value instanceof Date) && !Number.isNaN(new Date(value).getTime());
}

function validProvenance(revision, sourceUpdatedAt, copiedAt) {
  if (revision == null && sourceUpdatedAt == null && copiedAt == null) return true;
  const normalizedRevision = Number(revision);
  return Number.isSafeInteger(normalizedRevision) && normalizedRevision > 0 && validTimestamp(sourceUpdatedAt) && validTimestamp(copiedAt);
}

async function performBrandCoreOperation(req, res, id, user) {
  const body = req.body || {};
  const operation = body.operation;
  const contracts = {
    refresh_brand_core_from_canonical: ['operation', 'brand_id', 'canonical_revision', 'board_updated_at'],
    restore_previous_brand_core_snapshot: ['operation', 'board_updated_at']
  };
  if (!Object.prototype.hasOwnProperty.call(contracts, operation)) return res.status(400).json({ error: 'Unknown Board operation' });
  const expectedKeys = contracts[operation];
  if (Object.keys(body).length !== expectedKeys.length || Object.keys(body).some((key) => !expectedKeys.includes(key))) {
    return res.status(400).json({ error: 'Invalid fields for Board operation' });
  }
  if (!validTimestamp(body.board_updated_at)) return res.status(400).json({ error: 'board_updated_at must be a valid timestamp' });
  if (operation === 'refresh_brand_core_from_canonical'
    && (!isBrandId(body.brand_id) || !Number.isSafeInteger(body.canonical_revision) || body.canonical_revision < 1)) {
    return res.status(400).json({ error: 'Invalid Canonical Brand concurrency values' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(`SELECT ${BOARD_COLUMNS} FROM boards WHERE id = $1 FOR UPDATE`, [id]);
    if (!locked.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Board not found' }); }
    const board = locked.rows[0];
    const email = normalizeEmail(user.email);
    const owns = (board.owner_email && normalizeEmail(board.owner_email) === email)
      || (board.owner_id && (user.id || user.sub) && board.owner_id === (user.id || user.sub));
    const unowned = !board.owner_email && !board.owner_id;
    const editor = owns || unowned ? false : (await client.query("SELECT 1 FROM board_editors WHERE board_id = $1 AND email = $2 AND role = 'editor' LIMIT 1", [id, email])).rowCount > 0;
    if (!owns && !unowned && !editor) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Forbidden' }); }
    const access = { role: owns ? 'owner' : unowned ? 'unowned' : 'editor', canView: true, canEdit: true, canManagePermissions: owns, canRename: owns, canDelete: owns };
    if (new Date(board.updated_at).getTime() !== new Date(body.board_updated_at).getTime()) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'Board update conflict' });
    }

    let updated;
    if (operation === 'refresh_brand_core_from_canonical') {
      if (!board.brand_id || board.brand_id !== body.brand_id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Board Brand association changed' }); }
      if (!isPlainObject(board.brand_core_snapshot) || !validProvenance(board.brand_core_source_revision, board.brand_core_source_updated_at, board.brand_core_snapshot_copied_at)) {
        await client.query('ROLLBACK'); return res.status(422).json({ error: 'Saved Board Brand Core is invalid' });
      }
      const brandResult = await client.query('SELECT id, brand_core, revision, updated_at FROM brands WHERE id = $1 AND owner_email = $2 LIMIT 1', [board.brand_id, email]);
      if (!brandResult.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Canonical Brand not found' }); }
      const brand = brandResult.rows[0];
      if (Number(brand.revision) !== body.canonical_revision) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Canonical Brand revision conflict' }); }
      if (!isPlainObject(brand.brand_core)) { await client.query('ROLLBACK'); return res.status(422).json({ error: 'Canonical Brand Core is invalid' }); }
      updated = await client.query(`UPDATE boards SET
          brand_core_snapshot_backup = brand_core_snapshot,
          brand_core_backup_source_revision = brand_core_source_revision,
          brand_core_backup_source_updated_at = brand_core_source_updated_at,
          brand_core_backup_snapshot_copied_at = brand_core_snapshot_copied_at,
          brand_core_snapshot_backup_created_at = NOW(),
          brand_core_snapshot = $2::jsonb,
          brand_core_source_revision = $3,
          brand_core_source_updated_at = $4,
          brand_core_snapshot_copied_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING ${BOARD_COLUMNS}`, [id, JSON.stringify(brand.brand_core), brand.revision, brand.updated_at]);
    } else {
      if (!isPlainObject(board.brand_core_snapshot_backup) || !validTimestamp(board.brand_core_snapshot_backup_created_at)
        || !validProvenance(board.brand_core_backup_source_revision, board.brand_core_backup_source_updated_at, board.brand_core_backup_snapshot_copied_at)) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Previous Board Brand Core is unavailable' });
      }
      updated = await client.query(`UPDATE boards SET
          brand_core_snapshot = brand_core_snapshot_backup,
          brand_core_source_revision = brand_core_backup_source_revision,
          brand_core_source_updated_at = brand_core_backup_source_updated_at,
          brand_core_snapshot_copied_at = brand_core_backup_snapshot_copied_at,
          brand_core_snapshot_backup = brand_core_snapshot,
          brand_core_backup_source_revision = brand_core_source_revision,
          brand_core_backup_source_updated_at = brand_core_source_updated_at,
          brand_core_backup_snapshot_copied_at = brand_core_snapshot_copied_at,
          brand_core_snapshot_backup_created_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING ${BOARD_COLUMNS}`, [id]);
    }
    await client.query('COMMIT');
    return res.status(200).json({ ...serializeBoardItem(updated.rows[0]), access });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  }

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }
  if (!isBrandId(id)) return res.status(400).json({ error: 'id must be a UUID' });

  let requestUser = null;
  let requestAccess = null;

  try {
    await ensureBoardsTable();

    if (req.method === 'PUT') {
      const { name = null, canvas_json = null, brand_core_snapshot = null, lastKnownUpdatedAt = null } = req.body || {};
      if (!canvas_json || typeof canvas_json !== 'object') {
        return res.status(400).json({ error: 'canvas_json is required' });
      }
      const user = getSessionUser(req);
      const { board, access } = await getBoardAccess(id, user, { columns: 'id, updated_at, owner_id, owner_email' });
      if (!board) return res.status(404).json({ error: 'Board not found' });

      if (!access?.canEdit) {
        console.warn('[Funklix Authz Enforce] Forbidden PUT write', {
          boardId: id,
          actorType: !user?.email ? 'anonymous' : access?.role || 'unknown',
          actorEmail: user?.email || null,
          ownerEmail: board.owner_email || null
        });
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (access?.role === 'editor') {
        try {
          await refreshOwnEditorIdentity(id, user, { role: access?.role, route: 'PUT /api/boards/:id' });
        } catch (error) {
          console.error('[EDITOR_IDENTITY_ENRICHMENT_FAILED]', {
            boardId: id,
            email: user?.email || null,
            role: access?.role || null,
            message: error?.message || 'unknown',
            stack: error?.stack || null
          });
        }
      }

      if (lastKnownUpdatedAt) {
        const dbUpdatedAt = new Date(board.updated_at).getTime();
        const knownUpdatedAt = new Date(lastKnownUpdatedAt).getTime();
        if (!Number.isNaN(dbUpdatedAt) && !Number.isNaN(knownUpdatedAt) && dbUpdatedAt !== knownUpdatedAt) {
          return res.status(409).json({ error: 'Board update conflict', id, updated_at: board.updated_at });
        }
      }

      const updated = await pool.query(
        `UPDATE boards
         SET name = COALESCE(NULLIF($2,''), name), canvas_json = $3::jsonb, brand_core_snapshot = $4::jsonb, updated_at = NOW()
         WHERE id = $1
         RETURNING ${BOARD_COLUMNS}`,
        [id, name, JSON.stringify(canvas_json), JSON.stringify(brand_core_snapshot || null)]
      );

      if (updated.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
      return res.status(200).json({
        ...serializeBoardItem(updated.rows[0]),
        access
      });
    }

    if (req.method === 'PATCH') {
      const { name = null, order_index = null, claim = false } = req.body || {};
      const user = getSessionUser(req);
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'operation')) {
        if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
        return performBrandCoreOperation(req, res, id, user);
      }
      let updated;
      const hasBrandAssociationUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'brand_id');
      if (hasBrandAssociationUpdate) {
        if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
        if (Object.keys(req.body || {}).some((key) => key !== 'brand_id')) {
          return res.status(400).json({ error: 'brand_id must be updated separately' });
        }
        const brandId = req.body.brand_id;
        if (brandId !== null && !isBrandId(brandId)) {
          return res.status(400).json({ error: 'brand_id must be a valid Brand id or null' });
        }
        const { board, access } = await getBoardAccess(id, user, { columns: 'id, owner_id, owner_email' });
        if (!board) return res.status(404).json({ error: 'Board not found' });
        if (!access?.canChangeBrandAssociation) return res.status(403).json({ error: 'Forbidden' });
        if (brandId !== null && !(await getOwnedBrand(brandId, user, { columns: 'id' }))) {
          return res.status(404).json({ error: 'Canonical Brand not found' });
        }
        updated = await pool.query(
          `UPDATE boards SET brand_id = $2, updated_at = NOW(), brand_core_source_revision = NULL,
             brand_core_source_updated_at = NULL, brand_core_snapshot_copied_at = NULL,
             brand_core_snapshot_backup = NULL, brand_core_backup_source_revision = NULL,
             brand_core_backup_source_updated_at = NULL, brand_core_backup_snapshot_copied_at = NULL,
             brand_core_snapshot_backup_created_at = NULL WHERE id = $1 RETURNING ${BOARD_COLUMNS}`,
          [id, brandId]
        );
        if (updated.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
        return res.status(200).json({ ...serializeBoardItem(updated.rows[0]), access });
      }
      if (claim && user?.email) {
        const boardLookup = await pool.query(
          'SELECT id, owner_id, owner_email FROM boards WHERE id = $1 LIMIT 1',
          [id]
        );
        if (boardLookup.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
        if (boardLookup.rows[0].owner_email) return res.status(403).json({ error: 'Forbidden' });

        const email = normalizeEmail(user.email);
        updated = await pool.query(
          `UPDATE boards
           SET owner_id = CASE WHEN owner_email IS NULL THEN $2 ELSE owner_id END,
               owner_email = CASE WHEN owner_email IS NULL THEN $2 ELSE owner_email END,
               owner_name = CASE WHEN owner_email IS NULL THEN $3 ELSE owner_name END,
               owner_avatar = CASE WHEN owner_email IS NULL THEN $4 ELSE owner_avatar END,
               created_by = COALESCE(created_by, $2),
               updated_at = NOW()
           WHERE id = $1
          RETURNING id, name, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at`,
          [id, email, user.name || null, user.avatar || null]
        );
      } else {
        if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
        const { board, access } = await getBoardAccess(id, user, { columns: 'id, owner_id, owner_email' });
        if (!board) return res.status(404).json({ error: 'Board not found' });
        if (!access?.canRename) return res.status(403).json({ error: 'Forbidden' });

        const hasNameUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'name');
        const hasOrderUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'order_index') && Number.isInteger(order_index);
        if (!hasNameUpdate && !hasOrderUpdate) {
          return res.status(400).json({ error: 'No supported patch fields provided' });
        }

        if (hasNameUpdate) {
          updated = await pool.query(
            `UPDATE boards
             SET name = COALESCE($2, name),
                 order_index = CASE WHEN $3::integer IS NULL THEN order_index ELSE $3::integer END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, name, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at`,
            [id, name, hasOrderUpdate ? order_index : null]
          );
        } else {
          updated = await pool.query(
            `UPDATE boards
             SET order_index = $2
             WHERE id = $1
             RETURNING id, name, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at`,
            [id, order_index]
          );
        }
      }
      if (updated.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
      return res.status(200).json(updated.rows[0]);
    }

    if (req.method === 'DELETE') {
      const user = getSessionUser(req);
      if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
      const { board, access } = await getBoardAccess(id, user, { columns: 'id, owner_id, owner_email' });
      if (!board) return res.status(404).json({ error: 'Board not found' });
      if (!access?.canDelete) return res.status(403).json({ error: 'Forbidden' });

      await ensureDocumentTables();
      // Processing jobs/results are exact board-bound rows with ON DELETE CASCADE; initialize their schema before deleting the board.
      const linkedDocuments = await documentPool.query("SELECT id::text, storage_key FROM brand_documents WHERE board_id = $1 AND deleted_at IS NULL UNION ALL SELECT id::text, storage_key FROM brand_document_upload_intents WHERE board_id = $1 AND status IN ('pending','failed','expired','cancelled')", [id]);
      const deleted = await pool.query('DELETE FROM boards WHERE id = $1 RETURNING id', [id]);
      if (deleted.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
      await Promise.allSettled(linkedDocuments.rows.map((document) => deletePrivate(document.storage_key).catch((error) => {
        console.warn('[BOARD_DOCUMENT_CLEANUP_DEFERRED]', { documentId: document.id, code: error?.name || 'storage_error' });
      })));
      return res.status(200).json({ id });
    }

    const user = getSessionUser(req);
    requestUser = user;
    const { board, access } = await getBoardAccess(id, user, { columns: BOARD_COLUMNS });
    requestAccess = access;
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (access?.role === 'editor') {
      console.error('[BOARD_GET_EDITOR_IDENTITY_REFRESH_BEFORE]', {
        boardId: id,
        email: user?.email || null,
        role: access?.role || null
      });
      try {
        await refreshOwnEditorIdentity(id, user, { role: access?.role, route: 'GET /api/boards/:id' });
      } catch (error) {
        console.error('[EDITOR_IDENTITY_ENRICHMENT_FAILED]', {
          boardId: id,
          email: user?.email || null,
          role: access?.role || null,
          message: error?.message || 'unknown',
          stack: error?.stack || null
        });
      }
      console.error('[BOARD_GET_EDITOR_IDENTITY_REFRESH_AFTER]', {
        boardId: id,
        email: user?.email || null,
        role: access?.role || null
      });
    }

    console.error('[BOARD_GET_SUCCESS]', {
      boardId: id,
      role: access?.role || null
    });

    return res.status(200).json(serializeBoardForAccess(board, access));
  } catch (error) {
    if (req.method === 'GET') {
      console.error('[BOARD_GET_FAILURE]', {
        boardId: id,
        role: requestAccess?.role || null,
        email: requestUser?.email || null,
        error: error?.message || 'unknown',
        stack: error?.stack || null
      });
    }
    return res.status(500).json({ error: error?.message || 'Failed to load board' });
  }
};
