const { pool, ensureBoardsTable } = require('../_boards-storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  }

  try {
    if (req.method === 'GET') {
      await ensureBoardsTable();
      const result = await pool.query('SELECT id, name, updated_at, order_index FROM boards ORDER BY order_index ASC NULLS LAST, updated_at DESC LIMIT 200');
      return res.status(200).json({ boards: result.rows });
    }

    const { name: rawName = '', canvas_json = null, brand_core_snapshot = null } = req.body || {};
    const trimmedName = typeof rawName === 'string' ? rawName.trim() : '';
    const name = trimmedName || `Campaign Canvas ${new Date().toISOString()}`;
    if (!canvas_json || typeof canvas_json !== 'object') {
      return res.status(400).json({ error: 'canvas_json is required' });
    }

    await ensureBoardsTable();
    const result = await pool.query(
      'INSERT INTO boards (name, canvas_json, brand_core_snapshot) VALUES ($1, $2::jsonb, $3::jsonb) RETURNING id, name, canvas_json, brand_core_snapshot, updated_at',
      [name, JSON.stringify(canvas_json), JSON.stringify(brand_core_snapshot || null)]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to save board' });
  }
};
