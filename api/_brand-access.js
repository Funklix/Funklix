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

const BRAND_ROLES = Object.freeze(['owner', 'admin', 'editor', 'viewer']);

function brandCapabilities(role) {
  const canRead = BRAND_ROLES.includes(role);
  const canWrite = ['owner', 'admin', 'editor'].includes(role);
  const canManage = role === 'owner' || role === 'admin';
  return {
    role: canRead ? role : 'unrelated',
    canReadBrand: canRead,
    canViewCanonicalBrandCore: canRead,
    canEditCanonicalBrand: canWrite,
    canCreateBrandBoards: canWrite,
    canViewAllBrandBoards: canRead,
    canEditAllBrandBoards: canWrite,
    canManageBrandMembers: canManage,
    canManageBrandAdmins: role === 'owner'
  };
}

async function getBrandAccess(brandId, user, { columns = BRAND_COLUMNS, client = pool } = {}) {
  const email = getBrandOwnerEmail(user);
  if (!brandId || !email) return { brand: null, access: brandCapabilities('unrelated') };
  await ensureBrandsTable();
  const safeColumns = columns.split(',').map((column) => `b.${column.trim()}`).join(', ');
  const result = await client.query(
    `SELECT ${safeColumns}, CASE WHEN b.owner_email = $2 THEN 'owner' ELSE bm.role END AS brand_access_role
       FROM brands b
       LEFT JOIN brand_members bm ON bm.brand_id = b.id AND bm.email = $2
      WHERE b.id = $1 AND (b.owner_email = $2 OR bm.role IN ('admin', 'editor', 'viewer'))
      LIMIT 1`, [brandId, email]
  );
  const brand = result.rows[0] || null;
  return { brand, access: brandCapabilities(brand?.brand_access_role) };
}

module.exports = { BRAND_ROLES, brandCapabilities, getBrandAccess, getBrandOwnerEmail, getOwnedBrand, isBrandId };
