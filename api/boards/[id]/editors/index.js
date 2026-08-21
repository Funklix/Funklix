const { pool, ensureBoardsTable } = require('../../../_boards-storage');
const { getBoardAccess, normalizeEmail } = require('../../../_board-access');
const { getSessionUser } = require('../../../_auth-session');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function listEditors(boardId) {
  const result = await pool.query(
    `SELECT email, role, name, avatar, created_at, created_by
     FROM board_editors
     WHERE board_id = $1
     ORDER BY created_at ASC, email ASC`,
    [boardId]
  );
  return result.rows;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  }

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    await ensureBoardsTable();
    const user = getSessionUser(req);
    if (!user?.email) return res.status(401).json({ error: 'Authentication required' });

    const { board, access } = await getBoardAccess(id, user, { columns: 'id, owner_id, owner_email' });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!access?.canManagePermissions) return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'GET') {
      const editors = await listEditors(id);
      return res.status(200).json({ editors });
    }

    const email = normalizeEmail(req.body?.email);
    const role = req.body?.role;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (role !== 'editor' && role !== 'viewer') return res.status(400).json({ error: 'Role must be editor or viewer' });

    const ownerEmail = normalizeEmail(board.owner_email || user.email);
    if (email === ownerEmail) {
      return res.status(400).json({ error: 'Owner is already the board owner' });
    }

    const existing = await pool.query(
      `SELECT email, role, name, avatar, created_at, created_by
       FROM board_editors
       WHERE board_id = $1 AND email = $2
       LIMIT 1`,
      [id, email]
    );
    const alreadyExists = existing.rowCount > 0;
    const createdBy = normalizeEmail(user.email);

    const upserted = await pool.query(
      `INSERT INTO board_editors (board_id, email, role, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (board_id, email)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING email, role, name, avatar, created_at, created_by`,
      [id, email, role, createdBy]
    );

    const editors = await listEditors(id);
    return res.status(alreadyExists ? 200 : 201).json({
      member: upserted.rows[0],
      editors,
      alreadyExists
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to manage editors' });
  }
};
