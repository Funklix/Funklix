const { pool, ensureBoardsTable } = require('../_boards-storage');
const { getSessionUser } = require('../_auth-session');

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

  try {
    await ensureBoardsTable();

    if (req.method === 'PUT') {
      const { name = null, canvas_json = null, brand_core_snapshot = null, lastKnownUpdatedAt = null } = req.body || {};
      if (!canvas_json || typeof canvas_json !== 'object') {
        return res.status(400).json({ error: 'canvas_json is required' });
      }
      const user = getSessionUser(req);

      const current = await pool.query(
        'SELECT id, updated_at, owner_id, owner_email FROM boards WHERE id = $1 LIMIT 1',
        [id]
      );
      if (current.rowCount === 0) {
        return res.status(404).json({ error: 'Board not found' });
      }
      const board = current.rows[0];
      const sessionUserId = user?.id || user?.sub || null;
      const ownerMatchByEmail = !!board.owner_email && user?.email === board.owner_email;
      const ownerMatchById = !!board.owner_id && !!sessionUserId && board.owner_id === sessionUserId;
      const isOwner = ownerMatchByEmail || ownerMatchById;
      const actorType = !user?.email ? 'anonymous' : (!board.owner_email && !board.owner_id ? 'unowned_board' : (isOwner ? 'owner' : 'non_owner_signed_in'));
      if (!isOwner) {
        console.warn('[Funklix Authz Observe] Non-owner PUT write', {
          boardId: id,
          actorType,
          actorEmail: user?.email || null,
          ownerEmail: board.owner_email || null
        });
      }

      if (lastKnownUpdatedAt) {
        const dbUpdatedAt = new Date(current.rows[0].updated_at).getTime();
        const knownUpdatedAt = new Date(lastKnownUpdatedAt).getTime();
        if (!Number.isNaN(dbUpdatedAt) && !Number.isNaN(knownUpdatedAt) && dbUpdatedAt !== knownUpdatedAt) {
          return res.status(409).json({ error: 'Board update conflict', id, updated_at: current.rows[0].updated_at });
        }
      }

      const updated = await pool.query(

        `UPDATE boards
         SET name = COALESCE(NULLIF($2,''), name), canvas_json = $3::jsonb, brand_core_snapshot = $4::jsonb, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, canvas_json, brand_core_snapshot, created_at, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by`,
        [id, name, JSON.stringify(canvas_json), JSON.stringify(brand_core_snapshot || null)]
      );

      if (updated.rowCount === 0) {
        return res.status(404).json({ error: 'Board not found' });
      }

      return res.status(200).json(updated.rows[0]);
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

        updated = await pool.query(
          `UPDATE boards
           SET owner_id = CASE WHEN owner_email IS NULL THEN $2 ELSE owner_id END,
               owner_email = CASE WHEN owner_email IS NULL THEN $2 ELSE owner_email END,
               owner_name = CASE WHEN owner_email IS NULL THEN $3 ELSE owner_name END,
               owner_avatar = CASE WHEN owner_email IS NULL THEN $4 ELSE owner_avatar END,
               created_by = COALESCE(created_by, $2),
               updated_at = NOW()
           WHERE id = $1
          RETURNING id, name, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at`
          , [id, user.email, user.name || null, user.avatar || null]
        );
      } else {
        if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
        const boardLookup = await pool.query(
          'SELECT id, owner_id, owner_email FROM boards WHERE id = $1 LIMIT 1',
          [id]
        );
        if (boardLookup.rowCount === 0) return res.status(404).json({ error: 'Board not found' });

        const board = boardLookup.rows[0];
        const sessionUserId = user?.id || user?.sub || null;
        const ownerMatchByEmail = !!board.owner_email && user.email === board.owner_email;
        const ownerMatchById = !!board.owner_id && !!sessionUserId && board.owner_id === sessionUserId;
        if (!ownerMatchByEmail && !ownerMatchById) return res.status(403).json({ error: 'Forbidden' });

        updated = await pool.query(
          `UPDATE boards
           SET name = COALESCE($2, name),
               order_index = COALESCE($3, order_index),
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, name, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at`,
          [id, name, Number.isInteger(order_index) ? order_index : null]
        );
      }
      if (updated.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
      return res.status(200).json(updated.rows[0]);
    }

    if (req.method === 'DELETE') {
      const user = getSessionUser(req);
      if (!user?.email) return res.status(401).json({ error: 'Authentication required' });

      const current = await pool.query(
        'SELECT id, owner_id, owner_email FROM boards WHERE id = $1 LIMIT 1',
        [id]
      );
      if (current.rowCount === 0) return res.status(404).json({ error: 'Board not found' });

      const board = current.rows[0];
      const sessionUserId = user?.id || user?.sub || null;
      const ownerMatchByEmail = !!board.owner_email && user.email === board.owner_email;
      const ownerMatchById = !!board.owner_id && !!sessionUserId && board.owner_id === sessionUserId;
      if (!ownerMatchByEmail && !ownerMatchById) return res.status(403).json({ error: 'Forbidden' });

      const deleted = await pool.query('DELETE FROM boards WHERE id = $1 RETURNING id', [id]);
      if (deleted.rowCount === 0) return res.status(404).json({ error: 'Board not found' });
      return res.status(200).json({ id });
    }
    const result = await pool.query(
      'SELECT id, name, canvas_json, brand_core_snapshot, created_at, updated_at, order_index, owner_id, owner_email, owner_name, owner_avatar, created_by FROM boards WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const board = result.rows[0];
    const user = getSessionUser(req);
    const sessionUserId = user?.id || user?.sub || null;
    const ownerMatchByEmail = !!board.owner_email && !!user?.email && user.email === board.owner_email;
    const ownerMatchById = !!board.owner_id && !!sessionUserId && board.owner_id === sessionUserId;
    const isOwner = ownerMatchByEmail || ownerMatchById;
    const role = isOwner ? 'owner' : (!board.owner_email && !board.owner_id ? 'unowned' : (!user?.email ? 'anonymous_shared' : 'non_owner'));

    return res.status(200).json({
      ...board,
      access: {
        canView: true,
        canEdit: true,
        role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to load board' });
  }
};
