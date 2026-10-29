'use strict';

// Verify persistence separately from working Canvas. Never send the stored
// Canvas or hidden fields to the provider; expose only per-goal provenance.
const { pool } = require('./_boards-storage');
const scope = require('./_ai-brain-proposal-scope');
const { AdviceContextError } = require('./_ai-brain-learning-context');
const changed = () => { throw new AdviceContextError('advice_context_changed', 409); };
const canonicalType = type => type === 'Social Media Post' ? 'Social Media Posting' : type;
async function capture({ boardId, user, nodes, revision, requireScope = false, db = pool }) {
  if (!requireScope && !nodes.some(node => node.goal)) return null;
  if (typeof revision !== 'string' || revision.length > 40 || !Number.isFinite(Date.parse(revision))) changed();
  try {
    // Reuse existing Workspace, Board, association and identity checks, without
    // acquiring canonical Brand read permission or enumerating Brand knowledge.
    // The raw SQL revision and Canvas share the authorization snapshot. Browser
    // revisions use milliseconds; PostgreSQL NOW() can include microseconds.
    const authorized = await scope.capture({ boardId, user, db, includeCanvas: true });
    const current = scope.publicScope(authorized.board).updated_at;
    if (new Date(revision).toISOString() !== current) changed();
    const saved = authorized.board.canvas_json;
    if (!saved || !Array.isArray(saved.nodes)) changed();
    const byId = new Map();
    for (const node of saved.nodes) {
      if (!node || typeof node.id !== 'string' || byId.has(node.id)) changed();
      byId.set(node.id, node);
    }
    const sources = nodes.filter(node => node.goal).map(node => {
      const persisted = byId.get(node.id);
      return { nodeId: node.id, type: node.type, field: 'goal',
        state: persisted && canonicalType(persisted.type) === node.type && persisted.goal === node.goal ? 'saved' : 'unsaved',
        boardRevision: current };
    });
    return { authorized, sources, nodes, revision, requireScope };
  } catch (error) {
    if (error instanceof AdviceContextError) throw error;
    if (error instanceof scope.ProposalScopeError && error.status !== 503) changed();
    throw new AdviceContextError('learning_context_unavailable');
  }
}
async function revalidate({ data, user, db = pool }) {
  if (!data) return;
  const current = await capture({ boardId: data.authorized.board.id, user, nodes: data.nodes, revision: data.revision, requireScope: data.requireScope, db });
  if (current.authorized.fingerprint !== data.authorized.fingerprint || JSON.stringify(current.sources) !== JSON.stringify(data.sources)) changed();
}
module.exports = { capture, revalidate };
