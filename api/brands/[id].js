const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail, getOwnedBrand, isBrandId } = require('../_brand-access');
const { pool, BRAND_COLUMNS, MAX_BRAND_NAME_LENGTH, ensureBrandsTable, serializeBrand } = require('../_brands-storage');

function validObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.POSTGRES_URL) return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!isBrandId(id)) return res.status(400).json({ error: 'id must be a UUID' });

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ error: 'Authentication required' });

  try {
    await ensureBrandsTable();
    if (req.method === 'GET') {
      const brand = await getOwnedBrand(id, user);
      if (!brand) return res.status(404).json({ error: 'Brand not found' });
      return res.status(200).json(serializeBrand(brand));
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const brandCore = req.body?.brand_core;
    const revision = req.body?.revision;
    if (!name || name.length > MAX_BRAND_NAME_LENGTH) return res.status(400).json({ error: `name must be between 1 and ${MAX_BRAND_NAME_LENGTH} characters` });
    if (!validObject(brandCore)) return res.status(400).json({ error: 'brand_core must be an object' });
    if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({ error: 'revision must be a positive integer' });

    const updated = await pool.query(
      `UPDATE brands SET name = $3, brand_core = $4::jsonb, revision = revision + 1, updated_at = NOW()
       WHERE id = $1 AND owner_email = $2 AND revision = $5
       RETURNING ${BRAND_COLUMNS}`,
      [id, ownerEmail, name, JSON.stringify(brandCore), revision]
    );
    if (updated.rowCount === 0) {
      const current = await getOwnedBrand(id, user, { columns: 'id, revision, updated_at' });
      if (!current) return res.status(404).json({ error: 'Brand not found' });
      return res.status(409).json({ error: 'Brand update conflict', id, revision: Number(current.revision), updated_at: current.updated_at });
    }
    return res.status(200).json(serializeBrand(updated.rows[0]));
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to load Brand' });
  }
};
