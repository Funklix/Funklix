'use strict';
const { getSessionUser } = require('../../_auth-session');
const { isBrandId, getBrandAccess } = require('../../_brand-access');
const { pool } = require('../../_brands-storage');
const { write, proof, signReview } = require('../../_brand-knowledge-write');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  if (!isBrandId(req.query?.id)) return res.status(400).json({ code: 'INVALID_BRAND_ID' });
  try {
    if (req.body?.contract === 'brand_logo_v1') {
      const user = getSessionUser(req);
      if (!user?.email) return res.status(401).json({code:'AUTHENTICATION_REQUIRED'});
      const {brand,access} = await getBrandAccess(req.query.id,user);
      if (!brand || !access.canEditCanonicalBrand) return res.status(403).json({code:'PERMISSION_DENIED'});
      if (brand.workspace_id !== req.body.workspace_id || Number(brand.logo_revision) !== req.body.expected_revision) return res.status(409).json({code:'STALE_UPDATE'});
      if (!['upload','discover','remove'].includes(req.body.action)) return res.status(422).json({code:'INVALID_REQUEST'});
      const changes = [{path:'/logo',expected:{exists:!!brand.logo_object_path,value:brand.logo_object_path},value:req.body.action==='remove'?null:'selected image',action:req.body.action}];
      return res.status(200).json({ changes,review_token:signReview(proof(user.email.trim().toLowerCase(),req.query.id,req.body)),expires_in:300 });
    }
    return res.status(200).json(await write({ db: pool, user: getSessionUser(req), brandId: req.query.id, input: req.body, preview: true })); }
  catch (e) { return res.status(e.status || 503).json({ code: e.code || 'BRAND_PROTECTION_UNAVAILABLE' }); }
};
