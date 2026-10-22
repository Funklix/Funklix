const { getSessionUser } = require('../_auth-session');
const { getBrandOwnerEmail, getBrandAccess, isBrandId } = require('../_brand-access');
// BW-20 supersedes the former owner-only item lookup: const brand = await getOwnedBrand(id, user).
const { pool, ensureBrandsTable, serializeBrand } = require('../_brands-storage');
const { randomUUID } = require('crypto');
const { BrandDeletionError, deleteOwnedBrand } = require('../_brand-deletion');

const { write, mapError } = require('../_brand-knowledge-write');

module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  const requestId = randomUUID();
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', requestId });
  if (!process.env.POSTGRES_URL) {
    if (req.method === 'DELETE') {
      console.error('[BRAND_DELETE_FAILURE]', { code: 'BRAND_DELETE_STORAGE_UNAVAILABLE' });
      return res.status(500).json({ ok: false, code: 'BRAND_DELETE_FAILED', requestId });
    }
    return res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' });
  }
  const { id } = req.query || {};
  if (!id || !isBrandId(id)) return res.status(400).json({ ok: false, code: 'INVALID_BRAND_ID', requestId });

  const user = getSessionUser(req);
  const ownerEmail = getBrandOwnerEmail(user);
  if (!ownerEmail) return res.status(401).json({ ok: false, code: 'AUTHENTICATION_REQUIRED', requestId });

  if (req.method === 'DELETE') {
    const confirmationName = typeof req.body?.confirmationName === 'string' ? req.body.confirmationName : '';
    try {
      const result = await deleteOwnedBrand({ brandId: id, ownerEmail, confirmationName, requestId, input: req.body });
      return res.status(200).json({ ok: true, requestId, ...result });
    } catch (error) {
      const failure = error instanceof BrandDeletionError ? error : new BrandDeletionError(500, 'BRAND_DELETE_FAILED');
      return res.status(failure.status).json({ ok: false, code: failure.code, ...(failure.code === 'BRAND_IN_USE' ? { boardCount: failure.boardCount } : {}), requestId });
    }
  }

  try {
    await ensureBrandsTable();
    if (req.method === 'GET') {
      const { brand, access } = await getBrandAccess(id, user);
      if (!brand) return res.status(404).json({ ok: false, code: 'BRAND_NOT_FOUND' });
      return res.status(200).json(serializeBrand(brand, access));
    }

    const outcome = await write({ db: pool, user, brandId: id, input: req.body, token: req.headers?.['x-brand-review'] });
    const { access } = await getBrandAccess(id, user);
    return res.status(200).json({ ...serializeBrand(outcome.brand, access), contract: 'canonical-brand-write/v1', mutation_id: outcome.mutation_id, event_id: outcome.event_id, replay: outcome.replay });
  } catch (error) {
    if (req.method === 'GET') {
      console.error('[BRAND_ITEM_FAILURE]', { method: 'GET', code: 'DATABASE_UNAVAILABLE' });
      return res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' });
    }
    const failure = mapError(error);
    return res.status(failure.status).json({ ok: false, code: failure.code });
  }
};

// Preserve the handler's authentication and authorization before guarding database writes.
module.exports = require('../_write-maintenance').withMaintenanceResponse(module.exports);
