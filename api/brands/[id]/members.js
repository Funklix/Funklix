const { getSessionUser } = require('../../_auth-session');
const { normalizeEmail } = require('../../_board-access');
const { getBrandAccess, isBrandId } = require('../../_brand-access');
const { pool, ensureBrandsTable } = require('../../_brands-storage');

const MEMBER_ROLES = new Set(['admin', 'editor', 'viewer']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeMember(row) {
  return { email: row.email, role: row.role, name: row.name || null, avatar: row.avatar || null, created_at: row.created_at, updated_at: row.updated_at };
}

async function listMembers(brandId) {
  const result = await pool.query(`SELECT email, role, name, avatar, created_at, updated_at FROM brand_members
    WHERE brand_id = $1 AND role IN ('admin', 'editor', 'viewer') ORDER BY created_at, email`, [brandId]);
  return result.rows.map(safeMember);
}

module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.POSTGRES_URL) return res.status(500).json({ error: 'Failed to manage Brand members' });
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!isBrandId(id)) return res.status(400).json({ error: 'id must be a UUID' });
  const user = getSessionUser(req);
  const actorEmail = normalizeEmail(user?.email);
  if (!actorEmail) return res.status(401).json({ error: 'Authentication required' });
  try {
    await ensureBrandsTable();
    const { brand, access } = await getBrandAccess(id, user, { columns: 'id, owner_email' });
    if (!brand || !access.canManageBrandMembers) return res.status(404).json({ error: 'Brand not found' });
    if (req.method === 'GET') return res.status(200).json({ members: await listMembers(id) });

    const targetEmail = normalizeEmail(req.method === 'DELETE' ? (req.body?.email || req.query?.email) : req.body?.email);
    if (!targetEmail || !EMAIL_PATTERN.test(targetEmail) || targetEmail.length > 320) return res.status(400).json({ error: 'A valid member email is required' });
    if (targetEmail === normalizeEmail(brand.owner_email)) return res.status(400).json({ error: 'The Brand owner cannot be a member' });
    const existing = await pool.query('SELECT role FROM brand_members WHERE brand_id = $1 AND email = $2 LIMIT 1', [id, targetEmail]);

    if (req.method === 'DELETE') {
      if (!existing.rowCount) return res.status(404).json({ error: 'Member not found' });
      if (!access.canManageBrandAdmins && (existing.rows[0].role === 'admin' || targetEmail === actorEmail)) return res.status(403).json({ error: 'Forbidden' });
      await pool.query('DELETE FROM brand_members WHERE brand_id = $1 AND email = $2', [id, targetEmail]);
      return res.status(200).json({ members: await listMembers(id) });
    }

    const role = req.body?.role;
    if (!MEMBER_ROLES.has(role)) return res.status(400).json({ error: 'role must be admin, editor, or viewer' });
    if (!access.canManageBrandAdmins && (role === 'admin' || existing.rows[0]?.role === 'admin' || targetEmail === actorEmail)) return res.status(403).json({ error: 'Forbidden' });
    const saved = await pool.query(`INSERT INTO brand_members (brand_id, email, role, name, avatar, invited_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (brand_id, email) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
      RETURNING email, role, name, avatar, created_at, updated_at`,
      [id, targetEmail, role, null, null, actorEmail]);
    return res.status(existing.rowCount ? 200 : 201).json({ member: safeMember(saved.rows[0]) });
  } catch (error) {
    console.error('[BRAND_MEMBERS_FAILURE]', { brandId: id, actorEmail, error: error?.message || 'unknown' });
    return res.status(500).json({ error: 'Failed to manage Brand members' });
  }
};

module.exports.MEMBER_ROLES = MEMBER_ROLES;
