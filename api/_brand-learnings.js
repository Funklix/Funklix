'use strict';
const crypto = require('crypto');
const { getBoardAccess } = require('./_board-access');
const { lookupRequestFromVerifiedSession, validateIdentityRow, compareIdentityToSessionEmail } = require('./_app-identity');
const { brandCapabilities, isBrandId } = require('./_brand-access');

class LearningError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new LearningError(code, status); };
const STATUSES = ['proposed', 'approved', 'rejected', 'archived', 'all'];
function normalizeText(value, max, optional = false) {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'string' || value.length > max * 4 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail('INVALID_STATEMENT', 422);
  const text = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (optional && !text) return null;
  if (!text || Array.from(text).length > max) fail('INVALID_STATEMENT', 422);
  return text;
}
function statementKey(text) { return crypto.createHash('sha256').update(text.toLowerCase()).digest('hex'); }
function revision(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n) return value;
  fail('INVALID_REQUEST', 400);
}
function inputRequest(body, create) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('INVALID_REQUEST');
  const allowed = create ? ['statement','evidence_summary','expected_brand_revision','source'] : ['action','learning_id','expected_revision','statement','evidence_summary'];
  if (Object.keys(body).some(k => !allowed.includes(k))) fail('INVALID_REQUEST');
  const input = create ? { action: 'create', expectedBrandRevision: revision(body.expected_brand_revision) }
    : { action: body.action, learningId: body.learning_id, expectedRevision: revision(body.expected_revision) };
  if (!create && (!['edit','approve','reject','archive'].includes(input.action) || !isBrandId(input.learningId))) fail('INVALID_REQUEST');
  if (create || input.action === 'edit') {
    input.statement = normalizeText(body.statement, 2000);
    input.evidence = normalizeText(body.evidence_summary, 4000, true);
    input.key = statementKey(input.statement);
  } else if ('statement' in body || 'evidence_summary' in body) fail('INVALID_REQUEST');
  if (create && Object.hasOwn(body, 'source')) input.source = sourceRequest(body.source);
  return input;
}
// Source labels are derived only from authorized persisted data; no Canvas payload is projected.
const SOURCE_FIELDS = ['source_board_id','source_node_id','source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'];
const SOURCE_TYPES = new Set(['Idea','Campaign Variation','Content','Social Media Posting','Social Media Post','Landing Page','Email Campaign','Visual Concept','Image Brief']);
function sourceRequest(value) {
  const keys = ['board_id','node_id','expected_board_updated_at'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3
    || Object.keys(value).some(k => !keys.includes(k)) || !isBrandId(value.board_id)
    || typeof value.node_id !== 'string' || !value.node_id.trim() || Array.from(value.node_id).length > 200
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value.node_id)
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value.node_id)
    || typeof value.expected_board_updated_at !== 'string' || value.expected_board_updated_at.length > 40
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.expected_board_updated_at)
    || !Number.isFinite(Date.parse(value.expected_board_updated_at))) fail('INVALID_SOURCE', 422);
  return { ...value };
}
function sourceLabel(value, max, fallback) {
  if (typeof value !== 'string' || value.length > 20000) fail('SOURCE_UNAVAILABLE', 422);
  const text = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) fail('SOURCE_UNAVAILABLE', 422);
  return Array.from(text || fallback).slice(0, max).join('');
}
async function validateSource(client, user, brand, source, display = false, preview = false) {
  // Brand/identity/member locks are already held. Existing Board writes lock Board first;
  // NOWAIT avoids a Brand -> Board -> Brand cycle and fails closed on contention.
  const result = await client.query(`SELECT id, brand_id, workspace_id, name, canvas_json, updated_at, owner_id, owner_email,
    to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS source_updated_at
    FROM public.boards WHERE id=$1 FOR SHARE NOWAIT`, [source.board_id]);
  const board = result.rows[0];
  if (!board || board.brand_id !== brand.id) { if (display) return null; fail('SOURCE_UNAVAILABLE', 404); }
  const workspace = await client.query('SELECT workspace_id FROM public.brands WHERE id=$1', [brand.id]);
  if (!board.workspace_id || board.workspace_id !== workspace.rows[0]?.workspace_id) { if (display) return null; fail('SOURCE_UNAVAILABLE', 403); }
  const { access } = await getBoardAccess(board.id, user, { client });
  if (!access?.canRead || access.publicView) { if (display) return null; fail('SOURCE_ACCESS_DENIED', 403); }
  // Brand membership held above independently grants current Board read under _board-access.
  // Board-only membership and share tokens never replace Brand Learning authorization.
  const canvas = board.canvas_json;
  if (!canvas || typeof canvas !== 'object' || !Array.isArray(canvas.nodes) || canvas.nodes.length > 10000) { if (display) return null; fail('SOURCE_UNAVAILABLE', 422); }
  const matches = canvas.nodes.filter(n => n && n.id === source.node_id);
  if (matches.length !== 1 || !SOURCE_TYPES.has(matches[0].type)) { if (display) return null; fail('SOURCE_UNAVAILABLE', 422); }
  if (!display) {
    // POST compares exact PostgreSQL precision. Preview accepts the millisecond Board API
    // timestamp and returns the exact persisted timestamp for subsequent POST validation.
    const current = await client.query(`SELECT (updated_at=$2::timestamptz OR ($3::boolean AND date_trunc('milliseconds',updated_at)=$2::timestamptz)) AS current FROM public.boards WHERE id=$1`, [board.id, source.expected_board_updated_at,preview]);
    if (!current.rows[0]?.current) fail('STALE_SOURCE', 409);
  }
  const n = matches[0];
  try { return { source_updated_at:board.source_updated_at, source_board_id: board.id, source_node_id: n.id,
    source_board_name_snapshot: sourceLabel(board.name, 200, 'Campaign Canvas'),
    source_node_title_snapshot: sourceLabel(n.title || '', 300, n.type),
    source_node_type_snapshot: sourceLabel(n.type, 100, n.type) };
  } catch(error) { if (display && error instanceof LearningError) return null; throw error; }
}
async function sourceContext(client, user, brand, row) {
  if (row.source_type !== 'campaign_observation') return undefined;
  if (!row.source_board_id || !row.source_node_id) return { available: false };
  const source = await validateSource(client, user, brand, { board_id:row.source_board_id, node_id:row.source_node_id }, true);
  return source ? { available:true, board_id:source.source_board_id, node_id:source.source_node_id,
    board_name:source.source_board_name_snapshot, node_title:source.source_node_title_snapshot, node_type:source.source_node_type_snapshot } : { available:false };
}
async function previewSource({ db, user, brandId, source }) {
  if (!isBrandId(brandId)) fail('INVALID_REQUEST');
  const input = sourceRequest(source), client = await db.connect();
  try {
    await client.query('BEGIN');
    const { brand } = await authorize(client, user, brandId, false);
    if (!brandCapabilities(brand.role).canEditCanonicalBrand) fail('BRAND_ACCESS_DENIED',403);
    const persisted = await validateSource(client,user,brand,input,false,true);
    await client.query('COMMIT');
    return { contract:'brand_learning_source_v1', brand:{id:brand.id,name:brand.name,revision:String(brand.revision)},
      source:{...input,expected_board_updated_at:persisted.source_updated_at}, board_name:persisted.source_board_name_snapshot, node_title:persisted.source_node_title_snapshot, node_type:persisted.source_node_type_snapshot };
  } catch(error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
const label = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : 'Brand member';
const historyText = value => typeof value === 'string' ? Array.from(value).slice(0, 500).join('') + (Array.from(value).length > 500 ? '…' : '') : null;
function project(row) {
  return { id: row.id, brand_id: row.brand_id, status: row.status, statement: row.statement,
    source_type: row.source_type, evidence_summary: row.evidence_summary, supersedes_learning_id: row.supersedes_learning_id,
    revision: String(row.revision), created_at: row.created_at, updated_at: row.updated_at, reviewed_at: row.reviewed_at,
    proposer: label(row.proposer), reviewer: row.reviewed_at ? label(row.reviewer) : null };
}
async function authorize(client, sessionUser, brandId, write) {
  const lookup = lookupRequestFromVerifiedSession({ verified: true, user: sessionUser });
  if (!lookup.ok) fail('AUTHENTICATION_REQUIRED', 401);
  const identities = await client.query(`SELECT id, canonical_email, status, revision FROM public.app_identities
    WHERE canonical_email = $1 ORDER BY id LIMIT 2 FOR SHARE`, [lookup.canonicalEmail]);
  const identity = validateIdentityRow(identities.rows);
  if (!identity.ok || !compareIdentityToSessionEmail(identity, lookup.canonicalEmail).ok) fail('IDENTITY_INVALID', 403);
  // Same predicate as getBrandAccess; no Workspace or Board membership join, no runtime DDL.
  // The Brand lock serializes Learning operations and existing Brand deletion. Membership
  // and identity locks prevent concurrent revocation/disable between validation and commit.
  await client.query('SELECT tendra_runtime_private.lock_brand($1,$2)', [brandId,write]);
  const result = await client.query(`SELECT b.id, b.name, b.revision,
    CASE WHEN b.owner_email = $2 THEN 'owner' ELSE bm.role END AS role
    FROM public.brands b LEFT JOIN public.brand_members bm ON bm.brand_id = b.id AND bm.email = $2
    WHERE b.id = $1 AND (b.owner_email = $2 OR bm.role IN ('admin','editor','viewer'))`, [brandId, identity.canonicalEmail]);
  const brand = result.rows[0];
  if (!brand) fail('BRAND_UNAVAILABLE', 404);
  const membership = await client.query(`SELECT role FROM public.brand_members WHERE brand_id = $1 AND email = $2 FOR SHARE`, [brandId, identity.canonicalEmail]);
  if (brand.role !== 'owner' && membership.rows[0]?.role !== brand.role) fail('BRAND_ACCESS_DENIED', 403);
  if (write && !brandCapabilities(brand.role).canEditCanonicalBrand) fail('BRAND_ACCESS_DENIED', 403);
  return { brand, identity };
}
async function appendEvent(client, row, actor, type, previous) {
  await client.query(`INSERT INTO public.brand_learning_events
    (brand_id, learning_id, event_type, actor_identity_id, previous_status, next_status, learning_revision, snapshot)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [row.brand_id, row.id, type, actor, previous, row.status, row.revision,
    JSON.stringify({ statement: row.statement, evidence_summary: row.evidence_summary, source_type: row.source_type, supersedes_learning_id: row.supersedes_learning_id,
      ...(row.source_type === 'campaign_observation' ? Object.fromEntries(SOURCE_FIELDS.filter(k => k !== 'source_node_id').map(k => [k,row[k] ?? null])) : {}) })]);
}
async function duplicates(client, brandId, key, exclude, predecessor) {
  const result = await client.query(`SELECT id, status FROM public.brand_learnings
    WHERE brand_id = $1 AND statement_key = $2 AND status IN ('proposed','approved') AND ($3::uuid IS NULL OR id <> $3)
    AND ($4::uuid IS NULL OR id <> $4 OR status <> 'approved')
    ORDER BY status LIMIT 1`, [brandId, key, exclude || null, predecessor || null]);
  if (result.rows[0]) fail(result.rows[0].status === 'approved' ? 'DUPLICATE_APPROVED_LEARNING' : 'DUPLICATE_PROPOSAL', 409);
}
async function readLibrary(client, brandId, filter, offset, user, brand) {
  const counts = await client.query(`SELECT status, count(*)::int AS count FROM public.brand_learnings WHERE brand_id = $1 GROUP BY status`, [brandId]);
  const records = await client.query(`SELECT l.*, pm.name AS proposer, rm.name AS reviewer
    FROM public.brand_learnings l
    JOIN public.app_identities pi ON pi.id = l.proposed_by_identity_id
    LEFT JOIN public.brand_members pm ON pm.brand_id = l.brand_id AND pm.email = pi.canonical_email
    LEFT JOIN public.app_identities ri ON ri.id = l.reviewed_by_identity_id
    LEFT JOIN public.brand_members rm ON rm.brand_id = l.brand_id AND rm.email = ri.canonical_email
    WHERE l.brand_id = $1 AND ($2 = 'all' OR l.status = $2)
    ORDER BY CASE l.status WHEN 'proposed' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, l.updated_at DESC, l.id
    LIMIT 51 OFFSET $3`, [brandId, filter, offset]);
  const hasMore = records.rows.length > 50;
  const learnings = records.rows.slice(0, 50).map(project);
  for (const [index, learning] of learnings.entries()) {
    const context = await sourceContext(client,user,brand,records.rows[index]);
    if (context) learning.source_context = context;
    const events = await client.query(`SELECT e.event_type, e.previous_status, e.next_status, e.learning_revision, e.snapshot, e.created_at, m.name AS actor
      FROM public.brand_learning_events e JOIN public.app_identities i ON i.id = e.actor_identity_id
      LEFT JOIN public.brand_members m ON m.brand_id = e.brand_id AND m.email = i.canonical_email
      WHERE e.brand_id = $1 AND e.learning_id = $2 ORDER BY e.created_at DESC, e.id DESC LIMIT 10`, [brandId, learning.id]);
    learning.history = events.rows.map(e => ({ event_type: e.event_type, previous_status: e.previous_status, next_status: e.next_status,
      revision: String(e.learning_revision), statement: historyText(e.snapshot.statement), evidence_summary: historyText(e.snapshot.evidence_summary),
      actor: label(e.actor), created_at: e.created_at }));
  }
  return { learnings, counts: Object.fromEntries(counts.rows.map(r => [r.status, r.count])), has_more: hasMore, offset };
}
async function mutate(client, brand, actor, input) {
  if (input.action === 'create') {
    if (String(brand.revision) !== input.expectedBrandRevision) fail('STALE_BRAND_REVISION', 409);
    await duplicates(client, brand.id, input.key);
    return insert(null);
  }
  const locked = await client.query(`SELECT * FROM public.brand_learnings WHERE brand_id = $1 AND id = $2 FOR UPDATE`, [brand.id, input.learningId]);
  const row = locked.rows[0];
  if (!row) fail('LEARNING_UNAVAILABLE', 404);
  if (String(row.revision) !== input.expectedRevision) fail('STALE_LEARNING_REVISION', 409);
  if (input.action === 'edit') {
    if (!['proposed','approved'].includes(row.status)) fail('INVALID_LIFECYCLE_TRANSITION', 409);
    await duplicates(client, brand.id, input.key, row.id, row.supersedes_learning_id);
    if (row.status === 'approved') {
      const existing = await client.query(`SELECT id FROM public.brand_learnings WHERE brand_id = $1 AND supersedes_learning_id = $2 AND status = 'proposed' LIMIT 1`, [brand.id, row.id]);
      if (existing.rows.length) fail('DUPLICATE_PROPOSAL', 409);
      return insert(row.id, row);
    }
    const saved = await client.query(`UPDATE public.brand_learnings SET statement=$3, statement_key=$4, evidence_summary=$5,
      revision=revision+1, updated_at=now() WHERE brand_id=$1 AND id=$2 RETURNING *`, [brand.id, row.id, input.statement, input.key, input.evidence]);
    await appendEvent(client, saved.rows[0], actor, 'proposal_edited', 'proposed');
    return project(saved.rows[0]);
  }
  if ((input.action === 'archive' && row.status !== 'approved') || (input.action !== 'archive' && row.status !== 'proposed')) fail('INVALID_LIFECYCLE_TRANSITION', 409);
  if (input.action === 'approve') {
    const duplicate = await client.query(`SELECT id FROM public.brand_learnings WHERE brand_id=$1 AND statement_key=$2 AND status='approved'
      AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`, [brand.id, row.statement_key, row.supersedes_learning_id]);
    if (duplicate.rows.length) fail('DUPLICATE_APPROVED_LEARNING', 409);
    if (row.supersedes_learning_id) {
      const prior = await client.query(`SELECT * FROM public.brand_learnings WHERE brand_id=$1 AND id=$2 FOR UPDATE`, [brand.id, row.supersedes_learning_id]);
      if (prior.rows[0]?.status !== 'approved') fail('INVALID_LIFECYCLE_TRANSITION', 409);
      const archived = await client.query(`UPDATE public.brand_learnings SET status='archived', revision=revision+1, updated_at=now()
        WHERE brand_id=$1 AND id=$2 RETURNING *`, [brand.id, row.supersedes_learning_id]);
      await appendEvent(client, archived.rows[0], actor, 'superseded', 'approved');
      await appendEvent(client, archived.rows[0], actor, 'archived', 'approved');
    }
  }
  const status = { approve:'approved', reject:'rejected', archive:'archived' }[input.action];
  const saved = await client.query(`UPDATE public.brand_learnings SET status=$3, revision=revision+1, updated_at=now(),
    reviewed_by_identity_id=CASE WHEN $3='archived' THEN reviewed_by_identity_id ELSE $4::uuid END,
    reviewed_at=CASE WHEN $3='archived' THEN reviewed_at ELSE now() END WHERE brand_id=$1 AND id=$2 RETURNING *`, [brand.id, row.id, status, actor]);
  await appendEvent(client, saved.rows[0], actor, status, row.status);
  return project(saved.rows[0]);
  async function insert(prior, inherited) {
    const provenance = inherited || input.provenance;
    const result = provenance ? await client.query(`INSERT INTO public.brand_learnings
      (brand_id, statement, statement_key, evidence_summary, proposed_by_identity_id, supersedes_learning_id, source_type, source_board_id, source_node_id, source_board_name_snapshot, source_node_title_snapshot, source_node_type_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [brand.id,input.statement,input.key,input.evidence,actor,prior,inherited?.source_type || 'campaign_observation',...SOURCE_FIELDS.map(k => provenance[k] ?? null)])
      : await client.query(`INSERT INTO public.brand_learnings
      (brand_id, statement, statement_key, evidence_summary, proposed_by_identity_id, supersedes_learning_id)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [brand.id, input.statement, input.key, input.evidence, actor, prior]);
    await appendEvent(client, result.rows[0], actor, prior ? 'successor_proposed' : 'proposed', null);
    return project(result.rows[0]);
  }
}
async function operate({ db, user, brandId, input, inputs, filter = 'all', offset = 0, beforeMutation, afterMutation }) {
  if (!isBrandId(brandId) || !STATUSES.includes(filter) || !Number.isInteger(offset) || offset < 0 || offset > 10000) fail('INVALID_REQUEST');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const writes = inputs || (input ? [input] : []);
    const { brand, identity } = await authorize(client, user, brandId, writes.length > 0);
    // Internal server hook: Advisor freshness must share the Learning write transaction.
    if (writes.length && beforeMutation) await beforeMutation({ client, brand, identity });
    const saved = [];
    for (const write of writes) {
      if (write.source) write.provenance = await validateSource(client,user,brand,write.source);
      saved.push(await mutate(client, brand, identity.identityId, write));
    }
    const learning = input ? saved[0] : undefined;
    // Internal hooks run under the same authorization/source locks and roll back
    // together with every proposal and its event if receipt renewal fails.
    const extra = afterMutation ? await afterMutation({ client, brand, identity, saved }) : {};
    const library = await readLibrary(client, brandId, filter, offset, user, brand);
    if (learning?.source_type === 'campaign_observation') {
      const row = (await client.query('SELECT * FROM public.brand_learnings WHERE brand_id=$1 AND id=$2', [brandId,learning.id])).rows[0];
      learning.source_context = await sourceContext(client,user,brand,row);
    }
    await client.query('COMMIT');
    return { contract:'brand_learnings_v1', brand: { id:brand.id, name:brand.name, revision:String(brand.revision) },
      can_write:brandCapabilities(brand.role).canEditCanonicalBrand, ...library, ...(learning ? { learning } : {}), ...extra };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* original error is authoritative */ }
    throw error;
  } finally { client.release(); }
}
function boundedError(error) {
  if (error instanceof LearningError) return error;
  if (['42P01','42703','42883'].includes(error?.code)) return new LearningError('SCHEMA_UNAVAILABLE',503);
  if (error?.code === '23505') return new LearningError(error.constraint === 'brand_learnings_approved_key' ? 'DUPLICATE_APPROVED_LEARNING' : 'DUPLICATE_PROPOSAL',409);
  if (['ECONNREFUSED','ETIMEDOUT','57P01','57P03','40001','40P01','53300','55P03'].includes(error?.code)) return new LearningError('DATABASE_UNAVAILABLE',503);
  return new LearningError('INTERNAL_ERROR',500);
}
module.exports = { LearningError, normalizeText, statementKey, revision, inputRequest, project, operate, boundedError, sourceRequest, previewSource, authorize };
