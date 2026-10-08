const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail, isBrandId } = require('../_brand-access');
const { createWorkspaceBrand } = require('../_brand-creation');
const { validateWorkspaceName } = require('../../workspace-name');
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
    return res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' });
  }

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ ok: false, code: 'AUTHENTICATION_REQUIRED' });
  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'private, no-store');
    const body = req.body;
    const checked = validateWorkspaceName(body?.name);
    const name = checked.ok ? checked.name : '';
    if (body?.contract !== 'brand_creation_v1' || !isBrandId(body.id) || !isBrandId(body.workspace_id) || !name || name.length > MAX_BRAND_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(body.name)) return res.status(422).json({ ok: false, code: 'INVALID_REQUEST' });
    try {
      const outcome = await createWorkspaceBrand({ db: pool, email: ownerEmail, input: { id: body.id.toLowerCase(), workspace_id: body.workspace_id.toLowerCase(), name } });
      return res.status(outcome.created ? 201 : 200).json(outcome);
    } catch (error) { return res.status(error.status || 503).json({ ok: false, code: error.code || 'DATABASE_UNAVAILABLE' }); }
  }

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
    console.error('[BRAND_COLLECTION_FAILURE]', { method: req.method, code: 'DATABASE_UNAVAILABLE' });
    return res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' });
  }
};

module.exports.validBrandCore = validBrandCore;
module.exports.validBrandName = validBrandName;
