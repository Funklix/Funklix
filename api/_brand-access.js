const { normalizeEmail } = require('./_board-access');
const { pool, BRAND_COLUMNS, ensureBrandsTable } = require('./_brands-storage');

function getBrandOwnerEmail(user) {
  return normalizeEmail(user?.email);
}

function isBrandId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getOwnedBrand(brandId, user, { columns = BRAND_COLUMNS } = {}) {
  const ownerEmail = getBrandOwnerEmail(user);
  if (!brandId || !ownerEmail) return null;
  await ensureBrandsTable();
  const result = await pool.query(
    `SELECT ${columns} FROM brands WHERE id = $1 AND owner_email = $2 LIMIT 1`,
    [brandId, ownerEmail]
  );
  return result.rows[0] || null;
}

module.exports = { getBrandOwnerEmail, getOwnedBrand, isBrandId };
