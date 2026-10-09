const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail, getBrandAccess, isBrandId } = require('../_brand-access');
// BW-20 supersedes the former owner-only item lookup: const brand = await getOwnedBrand(id, user).
const { pool, BRAND_COLUMNS, MAX_BRAND_NAME_LENGTH, ensureBrandsTable, serializeBrand } = require('../_brands-storage');
const { randomUUID } = require('crypto');
const { BrandDeletionError, deleteOwnedBrand } = require('../_brand-deletion');

function validObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = async function handler(req, res) {
  const requestId = randomUUID();
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', requestId });
  if (!process.env.POSTGRES_URL) {
    if (req.method === 'DELETE') {
      console.error('[BRAND_DELETE_FAILURE]', { code: 'BRAND_DELETE_STORAGE_UNAVAILABLE' });
      return res.status(500).json({ ok: false, code: 'BRAND_DELETE_FAILED', requestId });
    }
    return res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' });
  }
  const { id } = req.query || {};
  if (!id || !isBrandId(id)) return res.status(400).json({ ok: false, code: 'INVALID_BRAND_ID', requestId });

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ ok: false, code: 'AUTHENTICATION_REQUIRED', requestId });

  if (req.method === 'DELETE') {
    const confirmationName = typeof req.body?.confirmationName === 'string' ? req.body.confirmationName : '';
    try {
      const result = await deleteOwnedBrand({ brandId: id, ownerEmail, confirmationName, requestId });
      return res.status(200).json({ ok: true, requestId, ...result });
    } catch (error) {
      const failure = error instanceof BrandDeletionError ? error : new BrandDeletionError(500, 'BRAND_DELETE_FAILED');
      return res.status(failure.status).json({ ok: false, code: failure.code, ...(failure.code === 'BRAND_IN_USE' ? { boardCount: failure.boardCount } : {}), requestId });
    }
  }

  try {
    await ensureBrandsTable();
    if (req.method === 'GET') {
      const { brand, access } = await getBrandAccess(id, user);
      if (!brand) return res.status(404).json({ ok: false, code: 'BRAND_NOT_FOUND' });
      return res.status(200).json(serializeBrand(brand, access));
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const brandCore = req.body?.brand_core;
    const revision = req.body?.revision;
    if (!name || name.length > MAX_BRAND_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(name)) return res.status(400).json({ ok: false, code: 'INVALID_BRAND_NAME' });
    if (!validObject(brandCore) || Buffer.byteLength(JSON.stringify(brandCore)) > 1024 * 1024) return res.status(400).json({ ok: false, code: 'INVALID_BRAND_CORE' });
    if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({ ok: false, code: 'INVALID_REVISION' });

    const resolved = await getBrandAccess(id, user, { columns: 'id, revision, updated_at, brand_core' });
    if (!resolved.brand) return res.status(404).json({ ok: false, code: 'BRAND_NOT_FOUND' });
    if (!resolved.access.canEditCanonicalBrand) return res.status(403).json({ ok: false, code: 'PERMISSION_DENIED' });
    // The creation fingerprint is server-owned and survives subsequent editing.
    if (JSON.stringify(brandCore._creation) !== JSON.stringify(resolved.brand.brand_core?._creation)) return res.status(422).json({ ok: false, code: 'INVALID_BRAND_CORE' });
    const updated = await pool.query(
      `UPDATE brands SET name = $2, brand_core = $3::jsonb, revision = revision + 1, updated_at = NOW()
       WHERE id = $1 AND revision = $4
       RETURNING ${BRAND_COLUMNS}`,
      [id, name, JSON.stringify(brandCore), revision]
    );
    if (updated.rowCount === 0) {
      const { brand: current } = await getBrandAccess(id, user, { columns: 'id, revision, updated_at' });
      if (!current) return res.status(404).json({ ok: false, code: 'BRAND_NOT_FOUND' });
      return res.status(409).json({ ok: false, code: 'STALE_UPDATE' });
    }
    return res.status(200).json(serializeBrand(updated.rows[0], resolved.access));
  } catch (error) {
    console.error('[BRAND_ITEM_FAILURE]', { method: req.method, code: 'DATABASE_UNAVAILABLE' });
    return res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' });
  }
};
