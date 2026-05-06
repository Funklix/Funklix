const { pool, ensureBoardsTable } = require('../_boards-storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
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
      const { name = 'Campaign Canvas Board', canvas_json = null } = req.body || {};
      if (!canvas_json || typeof canvas_json !== 'object') {
        return res.status(400).json({ error: 'canvas_json is required' });
      }

      const updated = await pool.query(
        `UPDATE boards
         SET name = $2, canvas_json = $3::jsonb, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, canvas_json, created_at, updated_at`,
        [id, name, JSON.stringify(canvas_json)]
      );

      if (updated.rowCount === 0) {
        return res.status(404).json({ error: 'Board not found' });
      }

      return res.status(200).json(updated.rows[0]);
    }
    const result = await pool.query(
      'SELECT id, name, canvas_json, created_at, updated_at FROM boards WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to load board' });
  }
};
