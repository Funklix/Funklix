const { pool } = require('./_boards-storage');
const { getBoardAccess, normalizeEmail } = require('./_board-access');

// A projection of existing permissions, never a second ownership store.
async function assignablePeople(board, user, access, client = pool) {
  if (!user?.email || !access?.canEdit || access.publicView) return [];
  const people = new Map();
  const add = (person) => {
    const email = normalizeEmail(person.email);
    if (!email) return;
    const previous = people.get(email);
    people.set(email, { ...previous, ...person, email,
      name: person.name || previous?.name || '', avatar: person.avatar || previous?.avatar || '' });
  };
  add({ email: board.owner_email, name: board.owner_name, avatar: board.owner_avatar, role: 'owner' });
  const editors = await client.query("SELECT email, name, avatar, role FROM board_editors WHERE board_id = $1 AND role = 'editor'", [board.id]);
  editors.rows.filter(p => p.role === 'editor').forEach(add);
  if (board.brand_id) {
    const owners = await client.query('SELECT owner_email AS email FROM brands WHERE id = $1', [board.brand_id]);
    owners.rows.forEach(p => add({ ...p, role: 'brand_owner' }));
    const members = await client.query("SELECT email, name, avatar, role FROM brand_members WHERE brand_id = $1 AND role IN ('admin', 'editor')", [board.brand_id]);
    members.rows.filter(p => ['admin', 'editor'].includes(p.role)).forEach(p => add({ ...p, role: `brand_${p.role}` }));
  }
  add({ email: user.email, name: user.name, avatar: user.avatar, role: access.role });
  return [...people.values()];
}

async function saveResponsibilities(req, res, id, user) {
  if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
  const { canvas_json: canvas, lastKnownUpdatedAt: revision, responsibility_changes: changes } = req.body || {};
  if (!revision || !Number.isFinite(Date.parse(revision)) || !Array.isArray(canvas?.nodes)
    || !Array.isArray(changes) || !changes.length || changes.length > canvas.nodes.length
    || new Set(changes.map(c => c?.id)).size !== changes.length) {
    return res.status(400).json({ error: 'Invalid responsibility save' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM boards WHERE id = $1 FOR UPDATE', [id]);
    const { board, access } = await getBoardAccess(id, user, { client });
    if (!board || !access?.canEdit || access.publicView) {
      await client.query('ROLLBACK');
      return res.status(board ? 403 : 404).json({ error: board ? 'Forbidden' : 'Board not found' });
    }
    const people = await assignablePeople(board, user, access, client);
    const emails = new Set(people.map(p => p.email));
    const existingIds = new Set((board.canvas_json?.nodes || []).map(n => n.id));
    for (const change of changes) {
      const node = canvas.nodes.find(n => n.id === change.id);
      const email = normalizeEmail(change.email);
      if (!node || !existingIds.has(change.id) || normalizeEmail(node.ownerEmail) !== email || (email && !emails.has(email))) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Responsible person is no longer available' });
      }
    }
    // Replaying the exact saved snapshot after a lost response is already successful.
    const same = await client.query('SELECT id FROM boards WHERE id = $1 AND canvas_json = $2::jsonb', [id, JSON.stringify(canvas)]);
    if (!same.rowCount && Date.parse(board.updated_at) !== Date.parse(revision)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Board update conflict', updated_at: board.updated_at });
    }
    let saved = board;
    if (!same.rowCount) {
      const result = await client.query('UPDATE boards SET canvas_json = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *', [id, JSON.stringify(canvas)]);
      saved = result.rows[0];
    }
    await client.query('COMMIT');
    return res.status(200).json({ id: saved.id, updated_at: saved.updated_at, access });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

module.exports = { assignablePeople, saveResponsibilities };
