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
        const accessibleBrand = await getOwnedBrand(rawBrandId.trim(), user, { columns: 'id' });
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
                    WHEN be.email IS NOT NULL THEN be.role
                    WHEN b.owner_email IS NULL AND b.owner_id IS NULL THEN 'unowned'
                    ELSE 'non_owner'
                  END AS access_role
           FROM boards b
           LEFT JOIN board_editors be ON be.board_id = b.id AND be.email = $1 AND be.role IN ('editor', 'viewer')
           WHERE (LOWER(COALESCE(b.owner_email, '')) = $1 OR be.email IS NOT NULL OR (b.owner_email IS NULL AND b.owner_id IS NULL))
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
    let sourceRevision = null;
    let sourceUpdatedAt = null;
    if (brand_id !== null && brand_id !== undefined && brand_id !== '') {
      if (typeof brand_id !== 'string') return res.status(400).json({ error: 'brand_id must be a string' });
      const requestedBrandId = brand_id.trim();
      if (!isBrandId(requestedBrandId)) return res.status(400).json({ error: 'brand_id must be a UUID' });
      let brand;
      try {
        brand = await getOwnedBrand(requestedBrandId, user, { columns: 'id, brand_core, revision, updated_at' });
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
      sourceRevision = brand.revision;
      sourceUpdatedAt = brand.updated_at;
    }
    const result = await pool.query(
      `INSERT INTO boards (name, canvas_json, brand_core_snapshot, brand_id, brand_core_source_revision, brand_core_source_updated_at,
        brand_core_snapshot_copied_at, owner_id, owner_email, owner_name, owner_avatar, created_by)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, CASE WHEN $4::uuid IS NULL THEN NULL ELSE NOW() END, $7, $8, $9, $10, $11)
       RETURNING id, name, canvas_json, brand_core_snapshot, brand_id, brand_core_source_revision, brand_core_source_updated_at,
         brand_core_snapshot_copied_at, updated_at, owner_id, owner_email, owner_name, owner_avatar, created_by, created_at`,
      [name, JSON.stringify(canvas_json), JSON.stringify(authoritativeSnapshot || null), linkedBrandId, sourceRevision, sourceUpdatedAt, ownerEmail, ownerEmail, user?.name || null, user?.avatar || null, ownerEmail]
    );

    return res.status(200).json(serializeBoardItem(result.rows[0]));
  } catch (error) {
    return res.status(500).json({ error: req.method === 'GET' ? 'Failed to load boards' : 'Failed to save board' });
  }
};
