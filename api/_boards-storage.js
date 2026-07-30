const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

let schemaReadyPromise = null;

async function ensureBoardsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const { ensureBrandsTable } = require('./_brands-storage');
      await ensureBrandsTable();
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
      await pool.query('CREATE INDEX IF NOT EXISTS boards_brand_id_idx ON boards (brand_id);');
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE boards ADD CONSTRAINT boards_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

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
  return schemaReadyPromise;
}

module.exports = {
  pool,
  ensureBoardsTable
};
