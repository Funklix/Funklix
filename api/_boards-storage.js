const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

let schemaReadyPromise = null;
let brandRelationshipReadyPromise = null;

async function reconcileBrandRelationship() {
  if (!brandRelationshipReadyPromise) {
    brandRelationshipReadyPromise = (async () => {
      const relations = await pool.query(`
        SELECT to_regclass('boards') IS NOT NULL AS boards_exist,
               to_regclass('brands') IS NOT NULL AS brands_exist;
      `);
      const { boards_exist: boardsExist, brands_exist: brandsExist } = relations.rows[0] || {};
      if (!boardsExist || !brandsExist) return false;

      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      return true;
    })().catch((error) => {
      brandRelationshipReadyPromise = null;
      throw error;
    });
  }

  const ready = await brandRelationshipReadyPromise;
  if (!ready) brandRelationshipReadyPromise = null;
  return ready;
}

async function reconcileBrandRelationshipWithoutBlockingBoards() {
  try {
    await reconcileBrandRelationship();
  } catch {
    console.error('[BOARD_BRAND_RELATIONSHIP_RECONCILIATION_FAILURE]', { error: 'Optional Brand relationship reconciliation failed' });
  }
}

async function ensureBoardsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        canvas_json JSONB NOT NULL,
        brand_core_snapshot JSONB,
        order_index INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot JSONB;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS order_index INTEGER;');

      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_id TEXT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_email TEXT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_name TEXT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS owner_avatar TEXT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS created_by TEXT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_id UUID;');
      // Runtime compatibility only; a formal migration and RLS hardening remain separate future work.
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_source_revision BIGINT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_source_updated_at TIMESTAMPTZ;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot_copied_at TIMESTAMPTZ;');
      // BW-13 keeps exactly one nullable, server-only recovery slot. Existing rows are deliberately untouched.
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot_backup JSONB;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_backup_source_revision BIGINT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_backup_source_updated_at TIMESTAMPTZ;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_backup_snapshot_copied_at TIMESTAMPTZ;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS brand_core_snapshot_backup_created_at TIMESTAMPTZ;');
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_brand_core_source_revision_check
            CHECK (brand_core_source_revision IS NULL OR brand_core_source_revision > 0);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_brand_core_backup_source_revision_check
            CHECK (brand_core_backup_source_revision IS NULL OR brand_core_backup_source_revision > 0);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS boards_brand_id_idx ON boards (brand_id);');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS board_editors (
          board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'editor',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          CHECK (email = LOWER(email)),
          CHECK (role IN ('editor'))
        );
      `);
      await pool.query('ALTER TABLE board_editors ADD COLUMN IF NOT EXISTS name TEXT;');
      await pool.query('ALTER TABLE board_editors ADD COLUMN IF NOT EXISTS avatar TEXT;');
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS board_editors_board_email_uidx ON board_editors (board_id, email);');
      await pool.query('CREATE INDEX IF NOT EXISTS board_editors_email_idx ON board_editors (email);');
      await pool.query('CREATE INDEX IF NOT EXISTS board_editors_board_id_idx ON board_editors (board_id);');
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  await schemaReadyPromise;
  await reconcileBrandRelationshipWithoutBlockingBoards();
}

module.exports = {
  pool,
  ensureBoardsTable,
  reconcileBrandRelationship
};
