const { isBrandId } = require('./_brand-access');
const { pool, MAX_BRAND_NAME_LENGTH, ensureBrandsTable } = require('./_brands-storage');

class BrandDeletionError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'BrandDeletionError';
    this.status = status;
    this.code = code;
  }
}

async function deleteOwnedBrand({ brandId, ownerEmail, confirmationName, requestId }) {
  if (!isBrandId(brandId)) throw new BrandDeletionError(400, 'INVALID_BRAND_ID');
  if (typeof confirmationName !== 'string' || !confirmationName || confirmationName.length > MAX_BRAND_NAME_LENGTH) {
    throw new BrandDeletionError(400, 'CONFIRMATION_REQUIRED');
  }

  let client;
  try {
    await ensureBrandsTable();
    client = await pool.connect();
    await client.query('BEGIN');
    const resolved = await client.query(
      'SELECT id, name FROM brands WHERE id = $1 AND owner_email = $2 FOR UPDATE',
      [brandId, ownerEmail]
    );
    const brand = resolved.rows[0];
    if (!brand) throw new BrandDeletionError(404, 'BRAND_NOT_FOUND');
    if (confirmationName !== brand.name) throw new BrandDeletionError(409, 'CONFIRMATION_MISMATCH');

    // Boards, their snapshots, Canvas nodes, and every Board-scoped durable record survive.
    const detached = await client.query('UPDATE boards SET brand_id = NULL WHERE brand_id = $1', [brandId]);
    // Memberships have no lifecycle outside their Canonical Brand.
    await client.query('DELETE FROM brand_members WHERE brand_id = $1', [brandId]);
    const deleted = await client.query('DELETE FROM brands WHERE id = $1 AND owner_email = $2', [brandId, ownerEmail]);
    if (deleted.rowCount !== 1) throw new Error('brand_delete_race');
    await client.query('COMMIT');
    return { code: 'BRAND_DELETED', deletedBrandId: brandId, detachedBoardCount: detached.rowCount };
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* original failure is authoritative */ }
    }
    if (error instanceof BrandDeletionError) throw error;
    console.error('[BRAND_DELETE_FAILURE]', { requestId, code: 'BRAND_DELETE_TRANSACTION_FAILED' });
    throw new BrandDeletionError(500, 'BRAND_DELETE_FAILED');
  } finally {
    client?.release();
  }
}

module.exports = { BrandDeletionError, deleteOwnedBrand };
