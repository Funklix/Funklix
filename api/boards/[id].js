const { pool, ensureBoardsTable } = require('../_boards-storage');
const { getBoardAccess, normalizeEmail, refreshOwnEditorIdentity } = require('../_board-access');
const { getSessionUser } = require('../_auth-session');
const { ensureDocumentTables, pool: documentPool } = require('../_document-records');
const { deletePrivate } = require('../_document-storage');

const BOARD_COLUMNS = 'id, name, canvas_json, brand_core_snapshot, created_at, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by';

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
        ...updated.rows[0],
        access
      });
    }

    if (req.method === 'PATCH') {
      const { name = null, order_index = null, claim = false } = req.body || {};
      const user = getSessionUser(req);
      let updated;
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

    return res.status(200).json({
      ...board,
      access
    });
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
