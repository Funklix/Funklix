const crypto = require('crypto');

const SESSION_COOKIE = 'funklix_session';
const TTL_SECONDS = 60 * 60 * 24 * 14;
const SIGNATURE_BYTES = 32;
const SIGNATURE_LENGTH = 43;

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing AUTH_SECRET (or SESSION_SECRET)');
  return secret;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function timingSafeSignatureEqual(expectedSignature, suppliedSignature) {
  try {
    if (typeof expectedSignature !== 'string' || typeof suppliedSignature !== 'string') return false;

    const decodedExpected = Buffer.from(expectedSignature, 'base64url');
    const expected = Buffer.alloc(SIGNATURE_BYTES);
    decodedExpected.copy(expected, 0, 0, SIGNATURE_BYTES);
    const validEncoding = /^[A-Za-z0-9_-]{43}$/.test(suppliedSignature) && /[AEIMQUYcgkosw048]$/.test(suppliedSignature);
    const supplied = validEncoding ? Buffer.from(suppliedSignature, 'base64url') : Buffer.alloc(0);
    const normalizedSupplied = Buffer.alloc(SIGNATURE_BYTES);
    supplied.copy(normalizedSupplied, 0, 0, Math.min(supplied.length, normalizedSupplied.length));
    const exactLength = expectedSignature.length === SIGNATURE_LENGTH
      && decodedExpected.length === SIGNATURE_BYTES
      && suppliedSignature.length === SIGNATURE_LENGTH
      && supplied.length === SIGNATURE_BYTES;
    const matches = crypto.timingSafeEqual(expected, normalizedSupplied);

    return validEncoding && exactLength && matches;
  } catch {
    return false;
  }
}

function createSessionToken(user) {
  const payload = { user, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    if (!timingSafeSignatureEqual(sign(body), sig)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.user || null;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map((x) => x.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
  }));
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SECONDS}; ${secure ? 'Secure;' : ''}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${secure ? 'Secure;' : ''}`);
}

function getSessionUser(req) {
  try {
    const cookies = parseCookies(req);
    return verifySessionToken(cookies[SESSION_COOKIE]);
  } catch {
    return null;
  }
}

module.exports = { createSessionToken, setSessionCookie, clearSessionCookie, getSessionUser };
