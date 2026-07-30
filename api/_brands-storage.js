const { pool } = require('./_boards-storage');

const BRAND_COLUMNS = 'id, owner_email, name, brand_core, revision, created_at, updated_at';
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
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

function serializeBrand(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    brand_core: row.brand_core,
    revision: Number(row.revision),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

module.exports = {
  pool,
  BRAND_COLUMNS,
  MAX_BRAND_NAME_LENGTH,
  ensureBrandsTable,
  serializeBrand
};
