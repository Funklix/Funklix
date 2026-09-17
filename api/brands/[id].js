const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail, getBrandAccess, isBrandId } = require('../_brand-access');
// BW-20 supersedes the former owner-only item lookup: const brand = await getOwnedBrand(id, user).
const { pool, BRAND_COLUMNS, MAX_BRAND_NAME_LENGTH, ensureBrandsTable, serializeBrand } = require('../_brands-storage');
const { randomUUID } = require('crypto');

function validObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = async function handler(req, res) {
  const requestId = randomUUID();
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', requestId });
  if (!process.env.POSTGRES_URL) {
    if (req.method === 'DELETE') {
      console.error('[BRAND_DELETE_FAILURE]', { requestId, code: 'BRAND_DELETE_STORAGE_UNAVAILABLE' });
      return res.status(500).json({ ok: false, code: 'BRAND_DELETE_FAILED', requestId });
    }
    console.error('[BRAND_ITEM_FAILURE]', { method: req.method, brandId: req.query?.id || null, error: 'POSTGRES_URL is not configured' });
    return res.status(500).json({ ok: false, code: 'BRAND_OPERATION_FAILED', requestId });
  }
  const { id } = req.query || {};
  if (!id || !isBrandId(id)) return res.status(400).json({ ok: false, code: 'INVALID_BRAND_ID', requestId });

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ ok: false, code: 'AUTHENTICATION_REQUIRED', requestId });

  try {
    await ensureBrandsTable();
    if (req.method === 'DELETE') {
      const confirmationName = typeof req.body?.confirmationName === 'string' ? req.body.confirmationName : '';
      if (!confirmationName || confirmationName.length > MAX_BRAND_NAME_LENGTH) {
        return res.status(400).json({ ok: false, code: 'CONFIRMATION_REQUIRED', requestId });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const resolved = await client.query(
          `SELECT id, name FROM brands WHERE id = $1 AND owner_email = $2 FOR UPDATE`,
          [id, ownerEmail]
        );
        const brand = resolved.rows[0];
        if (!brand) {
          await client.query('ROLLBACK');
          return res.status(404).json({ ok: false, code: 'BRAND_NOT_FOUND', requestId });
        }
        if (confirmationName !== brand.name) {
          await client.query('ROLLBACK');
          return res.status(409).json({ ok: false, code: 'CONFIRMATION_MISMATCH', requestId });
        }
        // Boards and their snapshots/content are durable independently of a Canonical Brand.
        // Clear only the association; the FK is SET NULL as a second line of defense.
        const detached = await client.query('UPDATE boards SET brand_id = NULL WHERE brand_id = $1', [id]);
        // Memberships are exclusively scoped to the Brand and have no independent lifecycle.
        await client.query('DELETE FROM brand_members WHERE brand_id = $1', [id]);
        const deleted = await client.query('DELETE FROM brands WHERE id = $1 AND owner_email = $2', [id, ownerEmail]);
        if (deleted.rowCount !== 1) throw new Error('brand_delete_race');
        await client.query('COMMIT');
        return res.status(200).json({ ok: true, code: 'BRAND_DELETED', requestId, deletedBrandId: id, detachedBoardCount: detached.rowCount });
      } catch (_error) {
        try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* original failure is authoritative */ }
        console.error('[BRAND_DELETE_FAILURE]', { requestId, code: 'BRAND_DELETE_TRANSACTION_FAILED' });
        return res.status(500).json({ ok: false, code: 'BRAND_DELETE_FAILED', requestId });
      } finally {
        client.release();
      }
    }
    if (req.method === 'GET') {
      const { brand, access } = await getBrandAccess(id, user);
      if (!brand) return res.status(404).json({ error: 'Brand not found' });
      return res.status(200).json(serializeBrand(brand, access));
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const brandCore = req.body?.brand_core;
    const revision = req.body?.revision;
    if (!name || name.length > MAX_BRAND_NAME_LENGTH) return res.status(400).json({ error: `name must be between 1 and ${MAX_BRAND_NAME_LENGTH} characters` });
    if (!validObject(brandCore)) return res.status(400).json({ error: 'brand_core must be an object' });
    if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({ error: 'revision must be a positive integer' });

    const resolved = await getBrandAccess(id, user, { columns: 'id, revision, updated_at' });
    if (!resolved.brand) return res.status(404).json({ error: 'Brand not found' });
    if (!resolved.access.canEditCanonicalBrand) return res.status(404).json({ error: 'Brand not found' });
    const updated = await pool.query(
      `UPDATE brands SET name = $3, brand_core = $4::jsonb, revision = revision + 1, updated_at = NOW()
       WHERE id = $1 AND revision = $5
       RETURNING ${BRAND_COLUMNS}`,
      [id, ownerEmail, name, JSON.stringify(brandCore), revision]
    );
    if (updated.rowCount === 0) {
      const { brand: current } = await getBrandAccess(id, user, { columns: 'id, revision, updated_at' });
      if (!current) return res.status(404).json({ error: 'Brand not found' });
      return res.status(409).json({ error: 'Brand update conflict', id, revision: Number(current.revision), updated_at: current.updated_at });
    }
    return res.status(200).json(serializeBrand(updated.rows[0], resolved.access));
  } catch (error) {
    if (req.method === 'DELETE') {
      console.error('[BRAND_DELETE_FAILURE]', { requestId, code: 'BRAND_DELETE_SETUP_FAILED' });
      return res.status(500).json({ ok: false, code: 'BRAND_DELETE_FAILED', requestId });
    }
    console.error('[BRAND_ITEM_FAILURE]', {
      method: req.method,
      brandId: id,
      ownerEmail,
      error: error?.message || 'unknown',
      stack: error?.stack || null
    });
    return res.status(500).json({ error: 'Failed to load Brand' });
  }
};
