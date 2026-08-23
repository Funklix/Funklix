const { pool, reconcileBrandRelationship } = require('./_boards-storage');

const BRAND_COLUMNS = 'id, owner_email, name, brand_core, revision, created_at, updated_at';
const BRAND_SUMMARY_COLUMNS = 'id, name, revision, created_at, updated_at';
const MAX_BRAND_NAME_LENGTH = 160;

let schemaReadyPromise = null;

async function ensureBrandsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        brand_core JSONB NOT NULL DEFAULT '{}'::jsonb,
        revision BIGINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (owner_email = LOWER(owner_email)),
        CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND ${MAX_BRAND_NAME_LENGTH}),
        CHECK (jsonb_typeof(brand_core) = 'object'),
        CHECK (revision >= 1)
      );
      CREATE INDEX IF NOT EXISTS brands_owner_email_idx ON brands (owner_email);
      CREATE TABLE IF NOT EXISTS brand_members (
        brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NULL,
        avatar TEXT NULL,
        invited_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT brand_members_brand_email_key UNIQUE (brand_id, email),
        CONSTRAINT brand_members_email_lowercase_check CHECK (email = LOWER(email)),
        CONSTRAINT brand_members_role_check CHECK (role IN ('admin', 'editor', 'viewer'))
      );
      CREATE INDEX IF NOT EXISTS brand_members_email_brand_idx ON brand_members (email, brand_id);
      CREATE INDEX IF NOT EXISTS brand_members_brand_idx ON brand_members (brand_id);
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  await schemaReadyPromise;
  try {
    await reconcileBrandRelationship();
  } catch {
    console.error('[BRAND_BOARD_RELATIONSHIP_RECONCILIATION_FAILURE]', { error: 'Optional Board relationship reconciliation failed' });
  }
}

function serializeBrand(row, access = null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    brand_core: row.brand_core,
    revision: Number(row.revision),
    created_at: row.created_at,
    updated_at: row.updated_at,
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
