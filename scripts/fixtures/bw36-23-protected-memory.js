'use strict';
// Deliberately bounded external database adapter. Never handles unknown SQL.
// It checks controller integration; the migration is verified on PostgreSQL separately.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const writes = require('../../brand-write-contract');
const clone = value => structuredClone(value);
const reject = (message, code) => { throw Object.assign(new Error(message), code ? { code } : {}); };
function protectedQuery(sql, args, { state, db, email, workspace, now }) {
  if (!sql.startsWith('SELECT brand_knowledge_private.')) return null;
  const current = state(); current.history ||= [];
  const [actor, id] = args;
  if (actor !== email || db.identityStatus === 'disabled' || db.membershipStatus !== 'accepted') reject('PERMISSION_DENIED', '42501');
  function authorize(brand, operation) {
    if (!brand) reject('BRAND_NOT_FOUND');
    if (brand.workspace_id !== workspace) reject('WORKSPACE_CONTEXT_CHANGED');
    const role = brand.owner_email === actor ? 'owner' : db.brandRole;
    if (!['owner', 'admin', 'editor'].includes(role) || operation === 'delete' && role !== 'owner') reject('PERMISSION_DENIED', '42501');
  }
  function record(brand, command, before, operation) {
    if (db.failHistory) reject('Injected history failure');
    const event = { event_id: randomUUID(), brand_id: id, mutation_id: command.mutation_id, actor, command: clone(command),
      before_state: clone(before), after_state: clone(brand), operation };
    current.history.push(event); return event;
  }
  if (sql.includes('.create_brand(')) {
    const [, , targetWorkspace, name, raw, mutation] = args;
    if (targetWorkspace !== workspace || !['owner', 'admin'].includes(db.workspaceRole)) reject('PERMISSION_DENIED', '42501');
    assert(writes.UUID.test(id)); assert(writes.UUID.test(mutation));
    const core = JSON.parse(raw); assert(writes.object(core));
    const command = { mutation_id: mutation, name, core, workspace: targetWorkspace };
    const previous = current.history.find(h => h.brand_id === id && h.mutation_id === mutation);
    if (previous) { assert.deepEqual(previous.command, command); return { rows: [{ brand: clone(previous.after_state) }], rowCount: 1 }; }
    if (current.brands.some(b => b.id === id)) reject('BRAND_ID_REUSE_DENIED');
    if (db.failPut) reject('Injected creation failure');
    const brand = { id, owner_email: actor, workspace_id: workspace, name, brand_core: core, revision: 1, logo_revision: 0,
      knowledge_event_seq: 1, created_at: now, updated_at: now };
    record(brand, command, null, 'create'); current.brands.push(brand);
    return { rows: [{ brand: clone(brand) }], rowCount: 1 };
  }
  const brand = current.brands.find(b => b.id === id);
  if (sql.includes('.logo_receipt(')) {
    authorize(brand, 'logo');
    const h = current.history.find(h => h.brand_id === id && h.actor === actor && h.mutation_id === args[2]);
    if (h && (h.operation !== 'logo' || h.command.input_digest !== args[3])) reject('IDEMPOTENCY_CONFLICT');
    return { rows: [{ brand: h ? clone(h.after_state) : null }], rowCount: 1 };
  }
  const command = JSON.parse(args[2]); authorize(brand, command.operation);
  const review = args[3] && JSON.parse(args[3]);
  const previous = current.history.find(h => h.brand_id === id && h.actor === actor && h.mutation_id === command.mutation_id);
  if (previous) {
    if (!writes.equal(previous.command, command)) reject('IDEMPOTENCY_CONFLICT');
    return { rows: [{ outcome: { brand: clone(previous.after_state), event_id: previous.event_id, mutation_id: command.mutation_id, replay: true } }], rowCount: 1 };
  }
  if (String(brand.revision) !== command.expected_revision) reject('STALE_UPDATE');
  if (command.workspace_id !== brand.workspace_id) reject('WORKSPACE_CONTEXT_CHANGED');
  const before = clone(brand);
  let after;
  if (sql.includes('.write_brand(')) {
    writes.normalize(command); const candidate = writes.apply(brand, command);
    const destructive = command.changes.some(writes.destructive);
    if (args[4]) return { rows: [{ outcome: { candidate, requires_review: destructive } }], rowCount: 1 };
    if (destructive && (!review || !writes.equal(review.command, command))) reject('DESTRUCTIVE_REVIEW_REQUIRED');
    if (db.failPut) reject('Injected protected write failure');
    after = { ...brand, ...candidate, revision: brand.revision + (command.changes.length ? 1 : 0), updated_at: now };
  } else if (sql.includes('.lifecycle(')) {
    if (!review || !writes.equal(review.command, command)) reject('DESTRUCTIVE_REVIEW_REQUIRED');
    if (command.expected_logo_revision !== Number(brand.logo_revision)) reject('STALE_UPDATE');
    if (command.operation === 'delete') {
      const boardCount = current.boards.filter(b => b.brand_id === id).length;
      if (boardCount) throw Object.assign(new Error('BRAND_IN_USE'), { detail: JSON.stringify({ boardCount }) });
      if (command.confirmation_name !== brand.name) reject('CONFIRMATION_MISMATCH');
      record(null, command, before, 'delete'); current.brands = current.brands.filter(b => b.id !== id);
      if (current.members) current.members = current.members.filter(m => m.brand_id !== id);
      return { rows: [{ outcome: { deleted: true } }], rowCount: 1 };
    }
    assert.equal(command.operation, 'logo');
    if (db.failLogoMetadata || db.zeroLogoUpdate) reject('Injected metadata failure');
    after = { ...brand, ...command.metadata, logo_revision: Number(brand.logo_revision) + 1, logo_updated_at: now };
  } else throw new Error('Unsupported protected function: ' + sql);
  after.knowledge_event_seq = (brand.knowledge_event_seq || 0) + 1;
  const event = record(after, command, before, command.operation); Object.assign(brand, after);
  return { rows: [{ outcome: { brand: clone(brand), event_id: event.event_id, mutation_id: command.mutation_id, replay: false } }], rowCount: 1 };
}
module.exports = { protectedQuery };
