const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

let schemaReadyPromise = null;

async function ensureBoardsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        canvas_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
  return schemaReadyPromise;
}

module.exports = {
  pool,
  ensureBoardsTable
};
