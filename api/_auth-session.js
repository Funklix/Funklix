const crypto = require('crypto');

const SESSION_COOKIE = 'funklix_session';
const TTL_SECONDS = 60 * 60 * 24 * 14;

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

function createSessionToken(user) {
  const payload = { user, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if (sign(body) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
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
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[SESSION_COOKIE]);
}

module.exports = { createSessionToken, setSessionCookie, clearSessionCookie, getSessionUser };
