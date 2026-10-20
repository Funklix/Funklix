const { isBrandId } = require('./_brand-access');
const { pool, MAX_BRAND_NAME_LENGTH, ensureBrandsTable } = require('./_brands-storage');

class BrandDeletionError extends Error {
  constructor(status, code, boardCount = 0) {
    super(code);
    this.name = 'BrandDeletionError';
    this.status = status;
    this.code = code;
    this.boardCount = boardCount;
  }
}

async function deleteOwnedBrand({ brandId, ownerEmail, confirmationName, requestId, input }) {
  if (!isBrandId(brandId)) throw new BrandDeletionError(400, 'INVALID_BRAND_ID');
  if (typeof confirmationName !== 'string' || !confirmationName || confirmationName.length > MAX_BRAND_NAME_LENGTH) {
    throw new BrandDeletionError(400, 'CONFIRMATION_REQUIRED');
  }

  let client;
  try {
    await ensureBrandsTable();
    client = await pool.connect();
    await client.query('BEGIN');
    if (!input || input.contract !== 'canonical-brand-write/v1' || !/^[1-9][0-9]*$/.test(input.expected_revision || '') || !Number.isSafeInteger(input.expected_logo_revision) || !isBrandId(input.mutation_id)) throw new BrandDeletionError(428, 'WRITE_CONTRACT_REQUIRED');
    const command = { contract: input.contract, operation: 'delete', workspace_id: input.workspace_id, expected_revision: input.expected_revision, expected_logo_revision: input.expected_logo_revision, mutation_id: input.mutation_id, confirmation_name: confirmationName };
    await require('./_brand-knowledge-write').lifecycle({ client, email: ownerEmail, brandId, command });
    await client.query('COMMIT');
    return { code: 'BRAND_DELETED', deletedBrandId: brandId, detachedBoardCount: 0 };
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* original failure is authoritative */ }
    }
    if (error instanceof BrandDeletionError) throw error;
    const failure = require('./_brand-knowledge-write').mapError(error);
    throw new BrandDeletionError(failure.status, failure.code);
  } finally {
    client?.release();
  }
}

module.exports = { BrandDeletionError, deleteOwnedBrand };
