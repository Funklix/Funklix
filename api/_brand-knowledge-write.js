'use strict';
const { createHmac, createHash, timingSafeEqual, randomUUID } = require('crypto');
const contract = require('../brand-write-contract');

function error(code, status = 422) { return Object.assign(new Error(code), { code, status }); }
function signingKey() {
  const key = process.env.BRAND_KNOWLEDGE_REVIEW_KEY;
  if (!key || Buffer.byteLength(key) < 32) throw error('REVIEW_SIGNING_UNAVAILABLE', 503);
  return key;
}
function proof(email, brandId, command) {
  return { version: 1, email, brand_id: brandId, command, expires: Math.floor(Date.now() / 1000) + 300 };
}
function signReview(review) {
  const payload = Buffer.from(JSON.stringify({ version: review.version, email: review.email, brand_id: review.brand_id, expires: review.expires, digest: createHash('sha256').update(contract.stable(review.command)).digest('hex') })).toString('base64url');
  return payload + '.' + createHmac('sha256', signingKey()).update(payload).digest('base64url');
}
function verifyReview(token, email, brandId, command) {
  if (!token) return null;
  if (typeof token !== 'string' || token.length > 4096) throw error('INVALID_REVIEW');
  const [payload, signature, extra] = token.split('.');
  const expected = createHmac('sha256', signingKey()).update(payload || '').digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw error('INVALID_REVIEW');
  let review; try { review = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw error('INVALID_REVIEW'); }
  if (review.version !== 1 || review.email !== email || review.brand_id !== brandId || review.expires < Date.now() / 1000
    || review.digest !== createHash('sha256').update(contract.stable(command)).digest('hex')) throw error('INVALID_REVIEW');
  return { ...review, command };
}
function mapError(e) {
  if (e.status) return e;
  const code = String(e.message || '');
  if (code === 'BRAND_IN_USE') {
    let count;
    try { count = JSON.parse(e.detail).boardCount; } catch {}
    const failure = error(code, 409);
    if (Number.isSafeInteger(count) && count > 0) failure.boardCount = count;
    return failure;
  }
  if (e.code === '40001') return error('STALE_UPDATE', 409);
  if (['STALE_UPDATE','STALE_FIELD','IDEMPOTENCY_CONFLICT','CONFIRMATION_MISMATCH','BRAND_IN_USE','INITIALIZATION_REQUIRES_EMPTY_CORE','INITIALIZATION_SOURCE_CHANGED'].includes(code)) return error(code, 409);
  if (e.code === '42501') return error('PERMISSION_DENIED', 403);
  if (code === 'BRAND_NOT_FOUND') return error(code, 404);
  if (['WRITE_CONTRACT_REQUIRED','DESTRUCTIVE_REVIEW_REQUIRED'].includes(code)) return error(code, 428);
  if (/^(INVALID_|OVERLAPPING_|SERVER_OWNED_|PATH_TYPE_|AVATAR_DEPENDENCY_|FILL_ONLY_|REVISION_RANGE_|BRAND_ID_REUSE_)/.test(code)) return error(code, 422);
  return error('BRAND_PROTECTION_UNAVAILABLE', 503);
}
async function write({ db, user, brandId, input, token, preview = false }) {
  const email = user?.email?.trim().toLowerCase();
  if (!email) throw error('AUTHENTICATION_REQUIRED', 401);
  let command;
  try { command = contract.normalize(input); } catch (e) { throw error(e.code, e.code === 'WRITE_CONTRACT_REQUIRED' ? 428 : 422); }
  let review = null, reviewFailure = null;
  try { review = preview ? null : verifyReview(token, email, brandId, command); }
  catch (failure) { reviewFailure = failure; }
  let client;
  try {
    client = await db.connect();
    await client.query(command.operation === 'initialize' ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    if (reviewFailure) {
      // An invalid/expired token never authorizes a mutation. A read-only preview
      // may return an already committed, currently authorized exact receipt.
      const receipt = (await client.query('SELECT brand_knowledge_private.write_brand($1,$2::uuid,$3::jsonb,NULL,true) AS outcome', [email, brandId, JSON.stringify(command)])).rows[0]?.outcome;
      if (!receipt?.replay) throw reviewFailure;
      await client.query('COMMIT');
      return receipt;
    }
    const result = (await client.query('SELECT brand_knowledge_private.write_brand($1,$2::uuid,$3::jsonb,$4::jsonb,$5) AS outcome', [email, brandId, JSON.stringify(command), review && JSON.stringify(review), preview])).rows[0]?.outcome;
    if (!result) throw error('BRAND_PROTECTION_UNAVAILABLE', 503);
    await client.query('COMMIT');
    if (preview) return { contract: contract.CONTRACT, changes: command.changes, requires_review: result.requires_review, review_token: signReview(proof(email, brandId, command)), expires_in: 300 };
    return result;
  } catch (e) { if (client) await client.query('ROLLBACK').catch(() => {}); throw mapError(e); }
  finally { client?.release(); }
}
async function create({ client, email, brandId, workspaceId, name, core, mutationId = brandId }) {
  const result = await client.query('SELECT brand_knowledge_private.create_brand($1,$2::uuid,$3::uuid,$4,$5::jsonb,$6::uuid) AS brand', [email, brandId, workspaceId, name, JSON.stringify(core), mutationId]);
  if (!result.rows[0]?.brand) throw error('BRAND_PROTECTION_UNAVAILABLE', 503);
  return result.rows[0].brand;
}
async function lifecycle({ client, email, brandId, command }) {
  // Only typed backend endpoints call this after their concrete confirmation flow.
  const result = await client.query('SELECT brand_knowledge_private.lifecycle($1,$2::uuid,$3::jsonb,$4::jsonb) AS outcome', [email, brandId, JSON.stringify(command), JSON.stringify(proof(email, brandId, command))]);
  if (!result.rows[0]?.outcome) throw error('BRAND_PROTECTION_UNAVAILABLE', 503);
  return result.rows[0].outcome;
}
module.exports = { write, create, lifecycle, mapError, proof, signReview, verifyReview, error, randomUUID };
