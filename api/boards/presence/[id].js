const { getSessionUser } = require('../../_auth-session');
const { ensureBoardsTable } = require('../../_boards-storage');
const { refreshOwnEditorIdentity, normalizeEmail, getBoardAccess } = require('../../_board-access');

const PRESENCE_TTL_MS = 45 * 1000;
const boardsPresence = global.__funklixBoardsPresence || new Map();
global.__funklixBoardsPresence = boardsPresence;

function cleanupBoard(boardId, now = Date.now()) {
  const viewers = boardsPresence.get(boardId);
  if (!viewers) return;
  for (const [key, entry] of viewers.entries()) {
    if (!entry || !entry.lastSeenAt || now - entry.lastSeenAt > PRESENCE_TTL_MS) {
      viewers.delete(key);
    }
  }
  if (viewers.size === 0) boardsPresence.delete(boardId);
}

function safeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function safeString(value, max = 80) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function ownerIdentityDebugEnabled() {
  return process.env.OWNER_IDENTITY_DEBUG === '1' || process.env.NODE_ENV !== 'production';
}

async function refreshPresenceEditorIdentity(boardId, user) {
  if (!process.env.POSTGRES_URL || !user?.email) return;
  try {
    await ensureBoardsTable();
    const updated = await refreshOwnEditorIdentity(boardId, user, { route: 'POST /api/boards/presence/:id', role: 'unknown_presence' });
    if (ownerIdentityDebugEnabled()) {
      console.debug('[Funklix Owner Identity] Presence editor identity refresh', {
        boardId,
        sessionEmail: normalizeEmail(user.email),
        hasName: !!safeString(user.name, 120),
        hasAvatar: !!safeString(user.avatar, 1000),
        updated
      });
    }
  } catch (error) {
    console.error('[EDITOR_IDENTITY_ENRICHMENT_FAILED]', {
      boardId,
      email: user?.email || null,
      role: 'unknown_presence',
      message: error?.message || 'unknown',
      stack: error?.stack || null
    });
    if (ownerIdentityDebugEnabled()) {
      console.debug('[Funklix Owner Identity] Presence editor identity refresh skipped', {
        boardId,
        sessionEmail: normalizeEmail(user.email),
        error: error?.message || 'unknown'
      });
    }
  }
}

module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: boardId } = req.query || {};
  if (!boardId) return res.status(400).json({ error: 'id is required' });

  const user = getSessionUser(req);
  if (!process.env.POSTGRES_URL) return res.status(200).json({ viewers: [], count: 0, ttlMs: PRESENCE_TTL_MS });
  await ensureBoardsTable();
  const { board, access } = await getBoardAccess(boardId, user, { columns: 'id, owner_id, owner_email' });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!access?.canViewPresence) return res.status(200).json({ viewers: [], count: 0, ttlMs: PRESENCE_TTL_MS });
  const now = Date.now();
  cleanupBoard(boardId, now);
  const viewers = boardsPresence.get(boardId) || new Map();

  if (req.method === 'POST') {
    const { selectedNodeId = null, editingNodeId = null, editingField = null, cursorX = null, cursorY = null, viewportCenterX = null, viewportCenterY = null, hoveredNodeId = null } = req.body || {};
    const safeSelectedNodeId = safeString(selectedNodeId);
    const safeEditingNodeId = safeString(editingNodeId);
    const safeEditingField = safeEditingNodeId ? safeString(editingField, 40) : null;
    const safeCursorX = safeNumber(cursorX);
    const safeCursorY = safeNumber(cursorY);
    const hasCursor = safeCursorX !== null && safeCursorY !== null;
    const safeViewportCenterX = safeNumber(viewportCenterX);
    const safeViewportCenterY = safeNumber(viewportCenterY);
    const safeHoveredNodeId = safeString(hoveredNodeId);

    if (user?.email && ['owner', 'editor', 'viewer', 'unowned'].includes(access.role)) {
      await refreshPresenceEditorIdentity(boardId, user);
      const key = String(user.email).toLowerCase();
      viewers.set(key, {
        email: user.email,
        name: user.name || '',
        avatar: user.avatar || '',
        selectedNodeId: safeSelectedNodeId,
        editingNodeId: safeEditingNodeId,
        editingField: safeEditingField,
        cursorX: hasCursor ? safeCursorX : null,
        cursorY: hasCursor ? safeCursorY : null,
        viewportCenterX: safeViewportCenterX,
        viewportCenterY: safeViewportCenterY,
        hoveredNodeId: safeHoveredNodeId,
        cursorUpdatedAt: hasCursor ? now : null,
        lastSeenAt: now,
        lastInteractionAt: now
      });
      boardsPresence.set(boardId, viewers);
    }
    cleanupBoard(boardId, now);
  }

  const list = Array.from((boardsPresence.get(boardId) || new Map()).values()).map((v) => ({
    email: v.email,
    name: v.name,
    avatar: v.avatar,
    selectedNodeId: v.selectedNodeId || null,
    editingNodeId: v.editingNodeId || null,
    editingField: v.editingField || null,
    cursorX: Number.isFinite(v.cursorX) ? v.cursorX : null,
    cursorY: Number.isFinite(v.cursorY) ? v.cursorY : null,
    viewportCenterX: Number.isFinite(v.viewportCenterX) ? v.viewportCenterX : null,
    viewportCenterY: Number.isFinite(v.viewportCenterY) ? v.viewportCenterY : null,
    hoveredNodeId: v.hoveredNodeId || null,
    cursorUpdatedAt: v.cursorUpdatedAt || null,
    lastInteractionAt: v.lastInteractionAt || null
  }));

  return res.status(200).json({ viewers: list, count: list.length, ttlMs: PRESENCE_TTL_MS });
};
