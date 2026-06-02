const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

let schemaReadyPromise = null;

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
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS board_editors_board_email_uidx ON board_editors (board_id, email);');
      await pool.query('CREATE INDEX IF NOT EXISTS board_editors_email_idx ON board_editors (email);');
      await pool.query('CREATE INDEX IF NOT EXISTS board_editors_board_id_idx ON board_editors (board_id);');
    })();
  }
  return schemaReadyPromise;
}

module.exports = {
  pool,
  ensureBoardsTable
};
