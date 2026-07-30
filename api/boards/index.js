const { pool, ensureBoardsTable } = require('../_boards-storage');
const { getSessionUser } = require('../_auth-session');
const { normalizeEmail } = require('../_board-access');
const { getOwnedBrand, isBrandId } = require('../_brand-access');

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
  return {
    ...safeRow,
    brand_display: getBoardBrandDisplaySnapshot({ brand_core_snapshot })
  };
}

module.exports = async function handler(req, res) {
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
      let result;
      if (user?.email) {
        const email = normalizeEmail(user.email);
        result = await pool.query(
          `SELECT b.id, b.name, b.updated_at, b.order_index, b.owner_id, b.owner_email, b.owner_name, b.owner_avatar, b.created_by, b.created_at, b.brand_id, b.brand_core_snapshot,
                  CASE
                    WHEN LOWER(COALESCE(b.owner_email, '')) = $1 THEN 'owner'
                    WHEN be.email IS NOT NULL THEN 'editor'
                    WHEN b.owner_email IS NULL AND b.owner_id IS NULL THEN 'unowned'
                    ELSE 'non_owner'
                  END AS access_role
           FROM boards b
           LEFT JOIN board_editors be ON be.board_id = b.id AND be.email = $1 AND be.role = 'editor'
           WHERE LOWER(COALESCE(b.owner_email, '')) = $1 OR be.email IS NOT NULL OR (b.owner_email IS NULL AND b.owner_id IS NULL)
           ORDER BY CASE
                      WHEN LOWER(COALESCE(b.owner_email, '')) = $1 THEN 0
                      WHEN be.email IS NOT NULL THEN 1
                      ELSE 2
                    END,
                    b.order_index ASC NULLS LAST,
                    b.updated_at DESC
           LIMIT 200`,
          [email]
        );
      } else {
        result = { rows: [] };
      }
      return res.status(200).json({ boards: result.rows.map(serializeBoardListRow) });
    }

    const { name: rawName = '', canvas_json = null, brand_core_snapshot = null, brand_id = null } = req.body || {};
    const user = getSessionUser(req);
    if (!user?.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const trimmedName = typeof rawName === 'string' ? rawName.trim() : '';
    const name = trimmedName || `Campaign Canvas ${new Date().toISOString()}`;
    if (!canvas_json || typeof canvas_json !== 'object') {
      return res.status(400).json({ error: 'canvas_json is required' });
    }

    await ensureBoardsTable();
    const ownerEmail = normalizeEmail(user.email);
    let authoritativeSnapshot = brand_core_snapshot;
    let linkedBrandId = null;
    if (brand_id !== null && brand_id !== undefined && brand_id !== '') {
      if (typeof brand_id !== 'string') return res.status(400).json({ error: 'brand_id must be a string' });
      const requestedBrandId = brand_id.trim();
      if (!isBrandId(requestedBrandId)) return res.status(400).json({ error: 'brand_id must be a UUID' });
      let brand;
      try {
        brand = await getOwnedBrand(requestedBrandId, user, { columns: 'id, brand_core' });
      } catch (error) {
        console.error('[BOARD_BRAND_LOOKUP_FAILURE]', {
          brandId: requestedBrandId,
          ownerEmail,
          error: error?.message || 'unknown',
          stack: error?.stack || null
        });
        return res.status(500).json({ error: 'Failed to save board' });
      }
      if (!brand) return res.status(404).json({ error: 'Brand not found' });
      linkedBrandId = brand.id;
      authoritativeSnapshot = brand.brand_core;
    }
    const result = await pool.query(
      'INSERT INTO boards (name, canvas_json, brand_core_snapshot, brand_id, owner_id, owner_email, owner_name, owner_avatar, created_by) VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9) RETURNING id, name, canvas_json, brand_core_snapshot, brand_id, updated_at, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at',
      [name, JSON.stringify(canvas_json), JSON.stringify(authoritativeSnapshot || null), linkedBrandId, ownerEmail, ownerEmail, user?.name || null, user?.avatar || null, ownerEmail]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to save board' });
  }
};
