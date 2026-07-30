const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail } = require('../_brand-access');
const { pool, BRAND_COLUMNS, MAX_BRAND_NAME_LENGTH, ensureBrandsTable, serializeBrand } = require('../_brands-storage');

function validBrandCore(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validBrandName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return name && name.length <= MAX_BRAND_NAME_LENGTH ? name : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.POSTGRES_URL) return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ error: 'Authentication required' });

  try {
    await ensureBrandsTable();
    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT ${BRAND_COLUMNS} FROM brands WHERE owner_email = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 200`,
        [ownerEmail]
      );
      return res.status(200).json({ brands: result.rows.map(serializeBrand) });
    }

    const name = validBrandName(req.body?.name);
    const brandCore = req.body?.brand_core;
    if (!name) return res.status(400).json({ error: `name must be between 1 and ${MAX_BRAND_NAME_LENGTH} characters` });
    if (!validBrandCore(brandCore)) return res.status(400).json({ error: 'brand_core must be an object' });

    const result = await pool.query(
      `INSERT INTO brands (owner_email, name, brand_core) VALUES ($1, $2, $3::jsonb) RETURNING ${BRAND_COLUMNS}`,
      [ownerEmail, name, JSON.stringify(brandCore)]
    );
    return res.status(201).json(serializeBrand(result.rows[0]));
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to persist Brand' });
  }
};

module.exports.validBrandCore = validBrandCore;
module.exports.validBrandName = validBrandName;
