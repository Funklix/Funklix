const { pool } = require('./_boards-storage');

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function sessionUserId(user) {
  return user?.id || user?.sub || null;
}

function isBoardOwner(board, user) {
  const userEmail = normalizeEmail(user?.email);
  const ownerEmail = normalizeEmail(board?.owner_email);
  const userId = sessionUserId(user);
  const ownerId = board?.owner_id || null;
  return (!!ownerEmail && !!userEmail && ownerEmail === userEmail) || (!!ownerId && !!userId && ownerId === userId);
}

function sessionIdentityValue(value, max = 500) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

async function refreshOwnEditorIdentity(boardId, user) {
  const email = normalizeEmail(user?.email);
  if (!boardId || !email) return false;
  const result = await pool.query(
    `UPDATE board_editors
     SET name = COALESCE($3, name), avatar = COALESCE($4, avatar)
     WHERE board_id = $1 AND email = $2 AND role = 'editor'
       AND (COALESCE(name, '') IS DISTINCT FROM COALESCE($3, name, '')
         OR COALESCE(avatar, '') IS DISTINCT FROM COALESCE($4, avatar, ''))`,
    [boardId, email, sessionIdentityValue(user?.name, 120), sessionIdentityValue(user?.avatar, 1000)]
  );
  return result.rowCount > 0;
}

async function isBoardEditor(boardId, user) {
  const email = normalizeEmail(user?.email);
  if (!boardId || !email) return false;
  const result = await pool.query(
    `SELECT 1
     FROM board_editors
     WHERE board_id = $1 AND email = $2 AND role = 'editor'
     LIMIT 1`,
    [boardId, email]
  );
  return result.rowCount > 0;
}

function accessForRole(role) {
  const canEdit = role === 'owner' || role === 'editor' || role === 'unowned';
  const isOwner = role === 'owner';
  return {
    role,
    canView: true,
    canEdit,
    canManagePermissions: isOwner,
    canRename: isOwner,
    canDelete: isOwner
  };
}

async function getBoardAccess(boardId, user, { columns = '*' } = {}) {
  const result = await pool.query(
    `SELECT ${columns} FROM boards WHERE id = $1 LIMIT 1`,
    [boardId]
  );
  if (result.rowCount === 0) return { board: null, access: null };

  const board = result.rows[0];
  const isUnowned = !board.owner_email && !board.owner_id;
  let role;
  if (isBoardOwner(board, user)) {
    role = 'owner';
  } else if (isUnowned && user?.email) {
    role = 'unowned';
  } else if (await isBoardEditor(boardId, user)) {
    role = 'editor';
  } else {
    role = user?.email ? 'non_owner' : 'anonymous_shared';
  }

  return { board, access: accessForRole(role) };
}

module.exports = {
  normalizeEmail,
  isBoardOwner,
  getBoardAccess,
  refreshOwnEditorIdentity
};
