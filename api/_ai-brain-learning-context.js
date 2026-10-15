'use strict';

// Advice-only, read-only context. Never call Learning mutations or Advisor orchestration.
const crypto = require('node:crypto');
const { pool } = require('./_boards-storage');
const { getBoardAccess, normalizeEmail } = require('./_board-access');
const { getBrandAccess } = require('./_brand-access');
const { authorize } = require('./_brand-learnings');

const VERSION = 'approved_brand_learnings_v1';
const BOARD_COLUMNS = 'id, name, owner_id, owner_email, brand_id, brand_core_snapshot, brand_core_source_revision, brand_core_source_updated_at, updated_at';
class AdviceContextError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new AdviceContextError(code, status); };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validOwnership(board) {
  return board && ['owner_id', 'owner_email'].every(key => Object.hasOwn(board, key)
    && (board[key] === null || typeof board[key] === 'string'));
}
function fingerprint(board, canonical, identity) {
  // Include actual supplied values as well as revisions: legacy writes may omit revision bumps.
  return hash([board, canonical, identity ? [identity.identityId, identity.revision] : null]);
}

async function transaction(db, work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query("SET LOCAL lock_timeout = '750ms'");
    await client.query("SET LOCAL statement_timeout = '4000ms'");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* preserve original failure */ }
    throw error;
  } finally { client.release(); }
}

async function scope(client, boardId, user) {
  // Existing Board writes take Board first; Learning writes take identity/Brand first.
  // NOWAIT and bounded subsequent waits prevent an unbounded opposite-order cycle.
  const locked = await client.query(`SELECT id FROM boards WHERE id=$1 FOR SHARE NOWAIT`, [boardId]);
  if (!locked.rows.length) fail('advice_context_changed', 409);
  await client.query(`SELECT role FROM board_editors WHERE board_id=$1 AND email=$2 FOR SHARE`, [boardId, normalizeEmail(user.email)]);
  const { board, access } = await getBoardAccess(boardId, user, { columns: BOARD_COLUMNS, client });
  if (!validOwnership(board) || !access?.canEdit) fail('advice_context_changed', 409);
  let canonical = null, identity = null;
  if (board.brand_id) {
    const resolved = await getBrandAccess(board.brand_id, user, {
      columns: 'id, name, brand_core, revision, updated_at', client, skipEnsure: true
    });
    if (resolved.brand && resolved.access.canViewCanonicalBrandCore) {
      // Independently requires a unique ACTIVE application identity and current Brand read ACL.
      ({ identity } = await authorize(client, user, board.brand_id, false));
      canonical = resolved.brand;
    }
  }
  return { board, canonical, identity, fingerprint: fingerprint(board, canonical, identity) };
}

async function capture({ boardId, user, db = pool }) {
  try { return await transaction(db, async client => {
    const data = await scope(client, boardId, user);
    data.learnings = [];
    if (!data.identity) return data; // Board-only access never enumerates Brand knowledge.
    const deadline = Date.now() + 5000;
    let cursor = null, bytes = 0;
    for (;;) {
      const result = await client.query(`SELECT id, revision::text AS revision, statement, reviewed_at,
        source_board_id, source_node_id FROM public.brand_learnings
        WHERE brand_id=$1 AND status='approved' AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT 256`, [data.board.brand_id, cursor]);
      for (const row of result.rows) {
        bytes += Buffer.byteLength(JSON.stringify(row), 'utf8');
        // Technical memory/deadline bound, never a partial-success product quota.
        if (bytes > 32 * 1024 * 1024 || Date.now() > deadline) fail('learning_context_unavailable');
        data.learnings.push(row);
      }
      if (result.rows.length < 256) break;
      cursor = result.rows.at(-1).id;
    }
    return data;
  }); } catch (error) {
    if (error instanceof AdviceContextError) throw error;
    fail('learning_context_unavailable');
  }
}

async function revalidate({ data, selected, user, db = pool }) {
  try {
    await transaction(db, async client => {
      const current = await scope(client, data.board.id, user);
      if (current.fingerprint !== data.fingerprint) fail('advice_context_changed', 409);
      // Selected rows only: unrelated new approvals do not invalidate an answer.
      for (let offset = 0; offset < selected.length; offset += 256) {
        const batch = selected.slice(offset, offset + 256);
        const rows = (await client.query(`SELECT id, revision::text AS revision, statement FROM public.brand_learnings
          WHERE brand_id=$1 AND status='approved' AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE`,
        [data.board.brand_id, batch.map(row => row.id)])).rows;
        const expected = new Map(batch.map(row => [row.id, row]));
        if (rows.length !== batch.length || rows.some(row => !expected.has(row.id)
          || String(row.revision) !== String(expected.get(row.id).revision) || row.statement !== expected.get(row.id).statement)) {
          fail('advice_context_changed', 409);
        }
      }
    });
  } catch (_) { fail('advice_context_changed', 409); }
}

const STOP = new Set(('a an and are as at be by for from how i in is it of on or that the this to we what which with would you your '
  + 'aber als am an auch auf aus bei das dem den der des die ein eine einer eines es fur im in ist mit nach nicht oder sich sind und vom von was wie wir zu zum zur').split(' '));
function normalized(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '');
}
function terms(text) {
  return new Set((normalized(text).match(/[\p{L}\p{N}]+/gu) || []).filter(word => word.length > 2 && !STOP.has(word))
    .map(word => word.replace(/(?:ungen|ation|ing|en|es|s)$/u, '')));
}
function rank(learnings, { question, nodes = [], selectedNode = null, boardId, conversation = [] }) {
  const primary = terms(question), selected = terms(selectedNode
    ? [selectedNode.title, selectedNode.type, selectedNode.content, selectedNode.audience, selectedNode.channel,
      ...Object.values(selectedNode.social || {}), ...Object.values(selectedNode.landingPage || {})].filter(Boolean).join(' ') : '');
  const canvas = terms(nodes.map(node => [node.title, node.audience, node.channel].filter(Boolean).join(' ')).join(' '));
  const history = terms(conversation.at(-1)?.assistant || '');
  const broad = /\b(?:all|every|alle|allen|samtliche)\b.*\b(?:learnings?|erkenntnisse[n]?)\b/u.test(normalized(question));
  const docs = learnings.map(row => ({ row, words: terms(row.statement) }));
  const frequency = new Map();
  for (const { words } of docs) for (const word of words) frequency.set(word, (frequency.get(word) || 0) + 1);
  const score = (words, query) => [...query].reduce((sum, word) => sum + (words.has(word) ? Math.log(1 + (docs.length + 1) / (frequency.get(word) || 1)) : 0), 0);
  const seen = new Set();
  const ranked = docs.map(({ row, words }) => {
    const questionScore = score(words, primary), selectedScore = score(words, selected);
    const secondary = Math.min(2, score(words, canvas)) + Math.min(2, score(words, history));
    const match = broad || questionScore > 0 || selectedScore > 0 || secondary > 0;
    const sameBoard = !!boardId && row.source_board_id === boardId;
    const provenance = (sameBoard ? .25 : 0) + (sameBoard && selectedNode && row.source_node_id === selectedNode.id ? .5 : 0);
    return { ...row, score: questionScore * 10 + Math.min(4, selectedScore) + secondary + provenance, match };
  }).filter(row => row.match).sort((a, b) => b.score - a.score
    || (Date.parse(b.reviewed_at) || 0) - (Date.parse(a.reviewed_at) || 0) || a.id.localeCompare(b.id));
  return ranked.filter(row => { const key = normalized(row.statement).replace(/\s+/gu, ' ').trim(); if (seen.has(key)) return false; seen.add(key); return true; });
}

const encodings = new Map();
function modelConstraints(env = process.env) {
  const model = env.OPENAI_AI_BRAIN_MODEL || 'gpt-4o-mini';
  const known = /^gpt-4o-mini(?:-2024-07-18)?$/.test(model);
  const contextTokens = known ? 128000 : Number(env.OPENAI_AI_BRAIN_CONTEXT_TOKENS);
  const encoding = known ? 'o200k_base' : env.OPENAI_AI_BRAIN_TOKEN_ENCODING;
  // Custom configurations are explicitly tied to the exact provider model name.
  if ((!known && env.OPENAI_AI_BRAIN_CONTEXT_MODEL !== model) || !Number.isSafeInteger(contextTokens)
    || contextTokens <= 5120 || !['o200k_base', 'cl100k_base'].includes(encoding)) fail('model_context_unconfigured');
  return { model, contextTokens, encoding, outputTokens: 4096, framingTokens: 1024 };
}
function tokens(value, constraints) {
  const serialized = JSON.stringify(value);
  // Avoid quadratic BPE on pathological long uninterrupted input; bytes are a safe upper bound.
  if (/\S{8193}/u.test(serialized)) return Buffer.byteLength(serialized, 'utf8');
  if (!encodings.has(constraints.encoding)) encodings.set(constraints.encoding, require('js-tiktoken').getEncoding(constraints.encoding));
  return encodings.get(constraints.encoding).encode(serialized, [], []).length;
}
function prepare({ data, query, messages, env = process.env }) {
  const constraints = modelConstraints(env);
  const ranked = rank(data.learnings, query);
  const selected = [];
  const coverage = { eligible: data.learnings.length, relevant: ranked.length, included: 0, omitted_for_budget: 0, partial: false };
  const envelope = () => ({ selectionVersion: VERSION, coverage: { ...coverage }, items: selected.map((row, i) => ({ ref: `L${i + 1}`, revision: String(row.revision), statement: row.statement })) });
  const capacity = constraints.contextTokens - constraints.outputTokens - constraints.framingTokens;
  // Count full request framing/policies/Canvas/Core/history/question and envelope. Reserve
  // metadata growth, then count candidates independently to keep packing linear in library size.
  const base = tokens(messages(envelope()), constraints);
  if (base > capacity) fail('advice_context_too_large', 422);
  let used = base + 128;
  for (const row of ranked) {
    const cost = tokens({ ref: `L${selected.length + 1}`, revision: String(row.revision), statement: row.statement }, constraints) + 16;
    if (used + cost <= capacity) { selected.push(row); used += cost; }
  }
  coverage.included = selected.length;
  coverage.omitted_for_budget = ranked.length - selected.length;
  coverage.partial = coverage.omitted_for_budget > 0;
  // Validate the actual final serialized request; never dispatch an unsafe estimate.
  let input = messages(envelope());
  while (tokens(input, constraints) > capacity && selected.length) {
    selected.pop(); coverage.included--; coverage.omitted_for_budget++; coverage.partial = true;
    input = messages(envelope());
  }
  if (tokens(input, constraints) > capacity) fail('advice_context_too_large', 422);
  return { constraints, input, selected, transparency: envelope() };
}

module.exports = { AdviceContextError, VERSION, capture, revalidate, rank, terms, modelConstraints, tokens, prepare };
