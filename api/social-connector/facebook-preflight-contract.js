'use strict';

const crypto = require('crypto');
const TOKEN_VERSION = 'bw34.1.6-v1';
const TOKEN_TTL_SECONDS = 10 * 60;

function secret(env = process.env) { return env.AUTH_SECRET || env.SESSION_SECRET || ''; }
function signature(value, env) { return crypto.createHmac('sha256', secret(env)).update(value).digest('base64url'); }
function fields(input = {}) { return { boardId: input.boardId, nodeId: input.nodeId, destinationId: input.destinationId, clientRequestId: input.clientRequestId, expectedApprovedFingerprint: input.expectedApprovedFingerprint }; }
function issue(input, { env = process.env, now = () => Date.now() } = {}) {
  if (!secret(env)) throw new Error('publishing_confirmation_unavailable');
  const body = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, exp: Math.floor(now() / 1000) + TOKEN_TTL_SECONDS, ...fields(input) })).toString('base64url');
  return `${body}.${signature(body, env)}`;
}
function verify(token, input, { env = process.env, now = () => Date.now() } = {}) {
  if (!secret(env) || typeof token !== 'string') return false;
  const [body, supplied, extra] = token.split('.');
  if (!body || !supplied || extra) return false;
  const expected = signature(body, env), a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')), expectedFields = fields(input);
    return value.v === TOKEN_VERSION && Number.isInteger(value.exp) && value.exp >= Math.floor(now() / 1000)
      && Object.keys(expectedFields).every(key => value[key] === expectedFields[key]);
  } catch { return false; }
}

module.exports = { TOKEN_VERSION, fields, issue, verify };
