'use strict';
const { createHash } = require('crypto');
const { validateIdentityRow, compareIdentityToSessionEmail } = require('./_app-identity');
const { brandCapabilities } = require('./_brand-access');
const { serializeBrand, BRAND_COLUMNS } = require('./_brands-storage');
const { core } = require('./_project-command');

class BrandCreationError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
function reject(status, code) { throw new BrandCreationError(status, code); }
async function createWorkspaceBrand({ db, email, input }) {
  let client, committing = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    const identity = validateIdentityRow((await client.query('SELECT id, canonical_email, status, revision FROM public.app_identities WHERE canonical_email=$1 ORDER BY id LIMIT 2 FOR UPDATE', [email])).rows);
    if (!identity.ok || !compareIdentityToSessionEmail(identity, email).ok) reject(403, 'IDENTITY_UNAVAILABLE');
    const workspace = (await client.query('SELECT id,status FROM public.workspaces WHERE id=$1 FOR UPDATE', [input.workspace_id])).rows[0];
    if (!workspace || workspace.status !== 'active') reject(404, 'WORKSPACE_NOT_FOUND');
    const member = (await client.query('SELECT role,status FROM public.workspace_memberships WHERE workspace_id=$1 AND identity_id=$2 FOR UPDATE', [workspace.id, identity.identityId])).rows[0];
    if (!member || member.status !== 'accepted' || !['owner', 'admin'].includes(member.role)) reject(403, 'PERMISSION_DENIED');
    // Global ID lock serializes simultaneous retries, including across workspaces.
    await client.query('SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 36135))', [input.id]);
    const fingerprint = createHash('sha256').update(JSON.stringify([workspace.id, email, input.name])).digest('hex');
    await client.query('SELECT tendra_runtime_private.lock_brand($1,$2)', [input.id,true]);
    let row = (await client.query(`SELECT ${BRAND_COLUMNS} FROM public.brands WHERE id=$1`, [input.id])).rows[0];
    const created = !row;
    if (row) {
      if (row.workspace_id !== workspace.id || row.owner_email !== email || row.brand_core?._creation?.fingerprint !== fingerprint) reject(409, 'IDEMPOTENCY_CONFLICT');
    } else {
      // JSONB retains the original input fingerprint without a new table or schema.
      const initial = { ...core(), _creation: { fingerprint } };
      row = await require('./_brand-knowledge-write').create({ client, email, brandId: input.id, workspaceId: workspace.id, name: input.name, core: initial });
    }
    if (!row) reject(503, 'DATABASE_UNAVAILABLE');
    const brand = { ...serializeBrand(row, brandCapabilities('owner')), workspace_id: workspace.id, role: 'owner' };
    committing = true;
    await client.query('COMMIT');
    return { contract: 'brand_creation_v1', ok: true, created, brand };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (committing) throw new BrandCreationError(503, 'OUTCOME_UNKNOWN');
    if (error instanceof BrandCreationError) throw error;
    throw new BrandCreationError(503, 'DATABASE_UNAVAILABLE');
  } finally { client?.release(); }
}
module.exports = { createWorkspaceBrand, BrandCreationError };
