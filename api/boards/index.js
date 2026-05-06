const { pool, ensureBoardsTable } = require('../_boards-storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  }

  try {
    const { name = 'Campaign Canvas Board', canvas_json = null } = req.body || {};
    if (!canvas_json || typeof canvas_json !== 'object') {
      return res.status(400).json({ error: 'canvas_json is required' });
    }

    await ensureBoardsTable();
    const result = await pool.query(
      'INSERT INTO boards (name, canvas_json) VALUES ($1, $2::jsonb) RETURNING id, updated_at',
      [name, JSON.stringify(canvas_json)]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to save board' });
  }
};
