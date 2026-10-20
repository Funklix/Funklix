const { pool } = require('./_boards-storage');
const { projectLogo } = require('./_brand-logo');

const BRAND_COLUMNS = 'id, owner_email, name, brand_core, revision, created_at, updated_at, logo_object_path, logo_mime_type, logo_source, logo_revision, logo_updated_at, logo_source_host, workspace_id';
const BRAND_SUMMARY_COLUMNS = 'id, name, revision, created_at, updated_at';
const MAX_BRAND_NAME_LENGTH = 160;

// Schema is installed only by reviewed migrations. Catalog reads never run DDL.
async function ensureBrandsTable() {
  const result = await pool.query("SELECT to_regclass('public.brands') AS brands, to_regclass('public.brand_members') AS members");
  if (!result.rows[0]?.brands || !result.rows[0]?.members) throw new Error('BRAND_SCHEMA_UNAVAILABLE');
}

function serializeBrand(row, access = null) {
  if (!row) return null;
  if (!Number.isSafeInteger(Number(row.revision))) throw new Error('REVISION_RANGE_EXCEEDED');
  // Logo presentation must not block unrelated canonical profile operations.
  // Transactional logo writes still require strict, authoritative readback.
  let logo;
  try { logo = projectLogo(row); }
  catch { logo = { logo_url: null, logo_revision: 0 }; }
  return {
    id: row.id,
    workspace_id: row.workspace_id ?? null,
    name: row.name,
    brand_core: row.brand_core,
    revision: Number(row.revision),
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...logo, logo_source: row.logo_source || null, logo_updated_at: row.logo_updated_at || null,
    ...(access ? { access } : {})
  };
}

function serializeBrandSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    revision: Number(row.revision),
    created_at: row.created_at,
    updated_at: row.updated_at,
    role: row.brand_access_role || row.role || 'owner'
  };
}

module.exports = {
  pool,
  BRAND_COLUMNS,
  BRAND_SUMMARY_COLUMNS,
  MAX_BRAND_NAME_LENGTH,
  ensureBrandsTable,
  serializeBrand,
  serializeBrandSummary
};
