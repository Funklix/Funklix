const crypto = require('crypto');

const PUBLIC_TOKEN_BYTES = 32;
const PUBLIC_TOKEN_LENGTH = 43;
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PUBLIC_HASH_PATTERN = /^[0-9a-f]{64}$/;

function isCanonicalPublicToken(token) {
  return typeof token === 'string' && PUBLIC_TOKEN_PATTERN.test(token)
    && Buffer.from(token, 'base64url').length === PUBLIC_TOKEN_BYTES;
}

function hashPublicToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function verifyPublicToken(storedHash, suppliedToken) {
  try {
    const validToken = isCanonicalPublicToken(suppliedToken);
    const validHash = typeof storedHash === 'string' && PUBLIC_HASH_PATTERN.test(storedHash);
    const expected = validHash ? Buffer.from(storedHash, 'hex') : Buffer.alloc(32);
    const supplied = validToken ? Buffer.from(hashPublicToken(suppliedToken), 'hex') : Buffer.alloc(32);
    const matches = crypto.timingSafeEqual(expected, supplied);
    return validToken && validHash && matches;
  } catch {
    return false;
  }
}

function generatePublicToken() {
  return crypto.randomBytes(PUBLIC_TOKEN_BYTES).toString('base64url');
}

module.exports = { generatePublicToken, hashPublicToken, isCanonicalPublicToken, verifyPublicToken };
