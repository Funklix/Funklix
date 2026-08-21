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
      // BW-19 is an additive private-by-default transition. Existing rows receive FALSE/NULL;
      // no token is generated or backfilled.
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_view_enabled BOOLEAN NOT NULL DEFAULT FALSE;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_view_token_hash TEXT;');
      await pool.query('ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_view_token_created_at TIMESTAMPTZ;');
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_public_view_state_check CHECK (
            (public_view_enabled = FALSE AND public_view_token_hash IS NULL AND public_view_token_created_at IS NULL)
            OR (public_view_enabled = TRUE AND public_view_token_hash ~ '^[0-9a-f]{64}$' AND public_view_token_created_at IS NOT NULL)
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

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
          CONSTRAINT board_editors_role_check CHECK (role IN ('editor', 'viewer'))
        );
      `);
      await pool.query('ALTER TABLE board_editors ADD COLUMN IF NOT EXISTS name TEXT;');
      await pool.query('ALTER TABLE board_editors ADD COLUMN IF NOT EXISTS avatar TEXT;');
      // Runtime compatibility only. A versioned migration remains separate hardening work.
      // Dropping/re-adding this metadata-only constraint preserves every invitation row.
      await pool.query(`
        DO $$ DECLARE constraint_name TEXT; BEGIN
          SELECT conname INTO constraint_name FROM pg_constraint
          WHERE conrelid = 'board_editors'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%role%';
          IF constraint_name IS NOT NULL AND pg_get_constraintdef(
            (SELECT oid FROM pg_constraint WHERE conrelid = 'board_editors'::regclass AND conname = constraint_name)
          ) NOT LIKE '%viewer%' THEN
            EXECUTE format('ALTER TABLE board_editors DROP CONSTRAINT %I', constraint_name);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'board_editors'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%' AND pg_get_constraintdef(oid) LIKE '%viewer%') THEN
            ALTER TABLE board_editors ADD CONSTRAINT board_editors_role_check CHECK (role IN ('editor', 'viewer'));
          END IF;
        END $$;
      `);
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
