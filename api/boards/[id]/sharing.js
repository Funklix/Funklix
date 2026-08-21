const { pool, ensureBoardsTable } = require('../../_boards-storage');
const { getSessionUser } = require('../../_auth-session');
const { getBoardAccess } = require('../../_board-access');
const { isBrandId } = require('../../_brand-access');
const { generatePublicToken, hashPublicToken } = require('../../_board-public-sharing');

function status(row = {}) {
  return {
    public_view_enabled: row.public_view_enabled === true,
    public_view_token_created_at: row.public_view_token_created_at || null,
    public_link_exists: row.public_view_enabled === true && !!row.public_view_token_created_at
  };
}

module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.POSTGRES_URL) return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  const id = req.query?.id;
  if (!isBrandId(id)) return res.status(400).json({ error: 'id must be a UUID' });
  try {
    await ensureBoardsTable();
    const user = getSessionUser(req);
    if (!user?.email) return res.status(404).json({ error: 'Board not found' });
    const { board, access } = await getBoardAccess(id, user, { columns: 'id, owner_id, owner_email, public_view_enabled, public_view_token_created_at' });
    if (!board || access?.role !== 'owner') return res.status(404).json({ error: 'Board not found' });
    if (req.method === 'GET') return res.status(200).json(status(board));
    if (req.method === 'POST') {
      const body = req.body || {};
      if (Object.keys(body).length !== 1 || body.operation !== 'create_public_view_link') return res.status(400).json({ error: 'Invalid sharing operation' });
      const public_view_token = generatePublicToken();
      const tokenHash = hashPublicToken(public_view_token);
      const updated = await pool.query(`UPDATE boards SET public_view_enabled = TRUE,
        public_view_token_hash = $2, public_view_token_created_at = NOW()
        WHERE id = $1 AND (owner_id = $3 OR LOWER(owner_email) = $4)
        RETURNING public_view_enabled, public_view_token_created_at`,
      [id, tokenHash, user.id || user.sub || '', String(user.email).trim().toLowerCase()]);
      if (!updated.rowCount) return res.status(404).json({ error: 'Board not found' });
      return res.status(200).json({ ...status(updated.rows[0]), public_view_token });
    }
    const updated = await pool.query(`UPDATE boards SET public_view_enabled = FALSE,
      public_view_token_hash = NULL, public_view_token_created_at = NULL
      WHERE id = $1 AND (owner_id = $2 OR LOWER(owner_email) = $3)
      RETURNING public_view_enabled, public_view_token_created_at`,
    [id, user.id || user.sub || '', String(user.email).trim().toLowerCase()]);
    if (!updated.rowCount) return res.status(404).json({ error: 'Board not found' });
    return res.status(200).json(status(updated.rows[0]));
  } catch {
    return res.status(500).json({ error: 'Sharing operation failed' });
  }
};
