const { getSessionUser } = require('./_auth-session');

// Reuse the existing generator for the reusable Brand, under Brand authority.
// Board callers keep their established snapshot contract.
async function resolveGenerationBrand(req, res) {
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const { getBrandAccess, isBrandId } = require('./_brand-access');
  const { getBoardAccess } = require('./_board-access');
  if (!Object.hasOwn(req.body || {}, 'brandId')) {
    if (!isBrandId(req.body?.boardId)) { res.status(400).json({ code: 'INVALID_BOARD_ID' }); return null; }
    const { board, access } = await getBoardAccess(req.body.boardId, user);
    if (!board) { res.status(404).json({ code: 'BOARD_NOT_FOUND' }); return null; }
    if (!access?.canEdit) { res.status(403).json({ code: 'PERMISSION_DENIED' }); return null; }
    return req.body;
  }
  if (!isBrandId(req.body.brandId)) { res.status(400).json({ code: 'INVALID_BRAND_ID' }); return null; }
  const { brand, access } = await getBrandAccess(req.body.brandId, user);
  if (!brand) { res.status(404).json({ code: 'BRAND_NOT_FOUND' }); return null; }
  if (!access.canEditCanonicalBrand) { res.status(403).json({ code: 'PERMISSION_DENIED' }); return null; }
  if (Number(brand.revision) !== req.body.revision) { res.status(409).json({ code: 'STALE_UPDATE' }); return null; }
  return { ...req.body, boardId: '', brandBrainData: brand.brand_core, brandDNA: brand.brand_core.brandDNA };
}
module.exports = { resolveGenerationBrand };
