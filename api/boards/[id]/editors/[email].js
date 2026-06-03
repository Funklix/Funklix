const { pool, ensureBoardsTable } = require('../../../_boards-storage');
const { getBoardAccess, normalizeEmail } = require('../../../_board-access');
const { getSessionUser } = require('../../../_auth-session');

async function listEditors(boardId) {
  const result = await pool.query(
    `SELECT email, role, created_at, created_by
     FROM board_editors
     WHERE board_id = $1
     ORDER BY created_at ASC, email ASC`,
    [boardId]
  );
  return result.rows;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  }

  const { id, email: rawEmail } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const email = normalizeEmail(Array.isArray(rawEmail) ? rawEmail[0] : rawEmail);
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    await ensureBoardsTable();
    const user = getSessionUser(req);
    if (!user?.email) return res.status(401).json({ error: 'Authentication required' });

    const { board, access } = await getBoardAccess(id, user, { columns: 'id, owner_id, owner_email' });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!access?.canManagePermissions) return res.status(403).json({ error: 'Forbidden' });

    await pool.query(
      `DELETE FROM board_editors
       WHERE board_id = $1 AND email = $2`,
      [id, email]
    );

    const editors = await listEditors(id);
    return res.status(200).json({ ok: true, email, editors });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to remove editor' });
  }
};
