const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail } = require('../_brand-access');
const { pool, MAX_BRAND_NAME_LENGTH, ensureBrandsTable, serializeBrandSummary } = require('../_brands-storage');

function validBrandCore(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validBrandName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return name && name.length <= MAX_BRAND_NAME_LENGTH ? name : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.POSTGRES_URL) {
    console.error('[BRAND_COLLECTION_FAILURE]', { method: req.method, error: 'POSTGRES_URL is not configured' });
    return res.status(500).json({ error: 'Failed to persist Brand' });
  }

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ error: 'Authentication required' });
  if (req.method === 'POST') return res.status(409).json({ code: 'PROJECT_CREATION_REQUIRED', error: 'Create a project from New project in Boards to create a Brand in your workspace.' });

  try {
    await ensureBrandsTable();
    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT b.id, b.name, b.revision, b.created_at, b.updated_at,
                CASE WHEN b.owner_email = $1 THEN 'owner' ELSE bm.role END AS brand_access_role
           FROM brands b
           LEFT JOIN brand_members bm ON bm.brand_id = b.id AND bm.email = $1
          WHERE b.owner_email = $1 OR bm.role IN ('admin', 'editor', 'viewer')
          ORDER BY CASE WHEN b.owner_email = $1 THEN 0 ELSE 1 END, b.updated_at DESC, b.created_at DESC, b.id
          LIMIT 200`,
        [ownerEmail]
      );
      return res.status(200).json({ brands: result.rows.map(serializeBrandSummary) });
    }
  } catch (error) {
    console.error('[BRAND_COLLECTION_FAILURE]', {
      method: req.method,
      ownerEmail,
      error: error?.message || 'unknown',
      stack: error?.stack || null
    });
    return res.status(500).json({ error: 'Failed to persist Brand' });
  }
};

module.exports.validBrandCore = validBrandCore;
module.exports.validBrandName = validBrandName;
