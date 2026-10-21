const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
let ready;
async function reconcileBrandRelationship() {
  const result = await pool.query("SELECT 1 FROM pg_constraint WHERE conrelid='public.boards'::regclass AND confrelid='public.brands'::regclass AND contype='f' AND convalidated");
  if (!result.rowCount) throw new Error('BOARD_BRAND_SCHEMA_UNAVAILABLE');
  return true;
}
async function ensureBoardsTable() {
  if (!ready) ready = pool.query("SELECT to_regclass('public.boards') AS boards, to_regclass('public.board_editors') AS editors")
    .then(result => { if (!result.rows[0]?.boards || !result.rows[0]?.editors) throw new Error('BOARD_SCHEMA_UNAVAILABLE'); return true; })
    .catch(error => { ready=null; throw error; });
  return ready;
}
module.exports = { pool, ensureBoardsTable, reconcileBrandRelationship };
