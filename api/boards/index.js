const { pool, ensureBoardsTable } = require('../_boards-storage');
const { getSessionUser } = require('../_auth-session');
const { normalizeEmail } = require('../_board-access');
const { getBrandAccess, isBrandId } = require('../_brand-access');
// BW-20 supersedes the former owner-only calls: getOwnedBrand(rawBrandId.trim(), user) and
// getOwnedBrand(requestedBrandId, user, { columns: 'id, brand_core, revision, updated_at' }).

function cleanBrandDisplayText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSafeBrandDisplayImageUrl(value) {
  const url = cleanBrandDisplayText(value);
  if (!url) return null;
  if (/^(https?:|data:image\/)/i.test(url)) return url;
  return null;
}

function getBoardBrandDisplaySnapshot(board = {}) {
  const snapshot = board?.brand_core_snapshot && typeof board.brand_core_snapshot === 'object' && !Array.isArray(board.brand_core_snapshot)
    ? board.brand_core_snapshot
    : {};
  const brandDNA = snapshot.brandDNA && typeof snapshot.brandDNA === 'object' && !Array.isArray(snapshot.brandDNA) ? snapshot.brandDNA : {};
  const avatar = brandDNA.avatar && typeof brandDNA.avatar === 'object' && !Array.isArray(brandDNA.avatar) ? brandDNA.avatar : {};
  const brandAssets = snapshot.brandAssets && typeof snapshot.brandAssets === 'object' && !Array.isArray(snapshot.brandAssets) ? snapshot.brandAssets : {};
  const name = [
    snapshot.brandName,
    snapshot.name,
    snapshot.title,
    brandDNA.brandName,
    brandDNA.name,
    brandAssets.name
  ].map(cleanBrandDisplayText).find(Boolean) || null;
  const avatarUrl = [
    brandDNA?.userApproved && avatar?.userApproved ? avatar.imageUrl : '',
    snapshot.avatarImageUrl,
    snapshot.avatarUrl,
    snapshot.brandAvatarUrl
  ].map(getSafeBrandDisplayImageUrl).find(Boolean) || null;
  return { name, avatarUrl };
}

function serializeBoardListRow(row = {}) {
  const { brand_core_snapshot, ...safeRow } = row;
  if (row.access_role === 'viewer') return { id: row.id, name: row.name, updated_at: row.updated_at, order_index: row.order_index, created_at: row.created_at, access_role: 'viewer', brand_visibility: 'hidden' };
  return {
    ...safeRow,
    brand_display: getBoardBrandDisplaySnapshot({ brand_core_snapshot })
  };
}

function serializeBoardItem(row = {}) {
  return {
    ...row,
    brand_core_source_revision: row.brand_core_source_revision == null ? null : Number(row.brand_core_source_revision)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Server is missing POSTGRES_URL' });
  }

  try {
    if (req.method === 'GET') {
      await ensureBoardsTable();
      const user = getSessionUser(req);
      const rawScope = Array.isArray(req.query?.scope) ? req.query.scope[0] : req.query?.scope;
      const scope = rawScope === undefined || rawScope === '' ? 'all' : rawScope;
      if (!['all', 'brand', 'unbranded'].includes(scope)) {
        return res.status(400).json({ error: 'Invalid board scope' });
      }
      const rawBrandId = Array.isArray(req.query?.brand_id) ? req.query.brand_id[0] : req.query?.brand_id;
      if (scope !== 'brand' && rawBrandId !== undefined) {
        return res.status(400).json({ error: 'brand_id is only valid with scope=brand' });
      }
      if (scope === 'brand') {
        if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
        if (typeof rawBrandId !== 'string' || !isBrandId(rawBrandId.trim())) {
          return res.status(400).json({ error: 'brand_id must be a UUID' });
        }
        const { brand: accessibleBrand } = await getBrandAccess(rawBrandId.trim(), user, { columns: 'id' });
        if (!accessibleBrand) return res.status(404).json({ error: 'Brand not found' });
      }
      let result;
      if (user?.email) {
        const email = normalizeEmail(user.email);
        const brandCondition = scope === 'brand' ? 'AND b.brand_id = $2' : (scope === 'unbranded' ? 'AND b.brand_id IS NULL' : '');
        const queryParameters = scope === 'brand' ? [email, rawBrandId.trim()] : [email];
        result = await pool.query(
          `SELECT b.id, b.name, b.updated_at, b.order_index, b.owner_id, b.owner_email, b.owner_name, b.owner_avatar, b.created_by, b.created_at, b.brand_id, b.brand_core_snapshot,
                  CASE
                    WHEN LOWER(COALESCE(b.owner_email, '')) = $1 THEN 'owner'
                    WHEN br.owner_email = $1 THEN 'brand_owner'
                    WHEN bm.role = 'admin' THEN 'brand_admin'
                    WHEN bm.role = 'editor' THEN 'brand_editor'
                    WHEN be.role = 'editor' THEN 'editor'
                    WHEN bm.role = 'viewer' THEN 'brand_viewer'
                    WHEN be.email IS NOT NULL THEN be.role
                    WHEN b.owner_email IS NULL AND b.owner_id IS NULL THEN 'unowned'
                    ELSE 'non_owner'
                  END AS access_role
           FROM boards b
           LEFT JOIN board_editors be ON be.board_id = b.id AND be.email = $1 AND be.role IN ('editor', 'viewer')
           LEFT JOIN brands br ON br.id = b.brand_id
           LEFT JOIN brand_members bm ON bm.brand_id = b.brand_id AND bm.email = $1 AND bm.role IN ('admin','editor','viewer')
           WHERE (LOWER(COALESCE(b.owner_email, '')) = $1 OR be.email IS NOT NULL OR br.owner_email = $1 OR bm.email IS NOT NULL OR (b.owner_email IS NULL AND b.owner_id IS NULL))
           ${brandCondition}
           ORDER BY CASE
                      WHEN LOWER(COALESCE(b.owner_email, '')) = $1 THEN 0
                      WHEN be.email IS NOT NULL THEN 1
                      ELSE 2
                    END,
                    b.order_index ASC NULLS LAST,
                    b.updated_at DESC
           LIMIT 200`,
          queryParameters
        );
      } else {
        result = { rows: [] };
      }
      return res.status(200).json({ boards: result.rows.map(serializeBoardListRow) });
    }

    const user = getSessionUser(req);
    if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
    return res.status(409).json({ code: 'PROJECT_CREATION_REQUIRED', error: 'This creation path is unavailable. Use New project in Boards to create a project in your workspace.' });

  } catch (error) {
    return res.status(500).json({ error: req.method === 'GET' ? 'Failed to load boards' : 'Failed to save board' });
  }
};
