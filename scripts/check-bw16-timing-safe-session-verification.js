const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const authPath = path.join(root, 'api', '_auth-session.js');
const authSource = fs.readFileSync(authPath, 'utf8');
const packageSource = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const oauthStartSource = fs.readFileSync(path.join(root, 'api', 'auth', 'google', 'start.js'), 'utf8');
const oauthCallbackSource = fs.readFileSync(path.join(root, 'api', 'auth', 'google', 'callback.js'), 'utf8');

assert.match(authSource, /crypto\.timingSafeEqual\(expected, normalizedSupplied\)/);
assert.doesNotMatch(authSource, /sign\(body\)\s*!==?\s*sig|sign\(body\)\s*===?\s*sig/);
assert.match(authSource, /createHmac\('sha256', getSecret\(\)\).*digest\('base64url'\)/);
assert.match(authSource, /return `\$\{body\}\.\$\{sign\(body\)\}`/);
assert.match(authSource, /const TTL_SECONDS = 60 \* 60 \* 24 \* 14/);
assert.match(authSource, /const SESSION_COOKIE = 'funklix_session'/);
assert.match(authSource, /Path=\/; HttpOnly; SameSite=Lax; Max-Age=\$\{TTL_SECONDS\}/);
assert.deepStrictEqual(Object.keys(JSON.parse(packageSource).dependencies).sort(), ['@vercel/blob', 'pg']);
assert.match(oauthStartSource, /randomBytes\(16\)\.toString\('hex'\)/);
assert.match(oauthCallbackSource, /state !== cookies\.funklix_oauth_state/);

const originalSecret = process.env.AUTH_SECRET;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalNow = Date.now;
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const capturedLogs = [];

function restoreEnvironment() {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = originalSecret;
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = originalSessionSecret;
  Date.now = originalNow;
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
}

function requestFor(token) {
  return { headers: token === undefined ? {} : { cookie: `funklix_session=${encodeURIComponent(token)}` } };
}

try {
  const secret = 'bw16-controlled-test-secret';
  const nowSeconds = 2_000_000_000;
  process.env.AUTH_SECRET = secret;
  delete process.env.SESSION_SECRET;
  Date.now = () => nowSeconds * 1000;
  console.log = console.error = console.warn = (...args) => capturedLogs.push(args.join(' '));

  delete require.cache[require.resolve(authPath)];
  const { createSessionToken, getSessionUser, setSessionCookie, clearSessionCookie } = require(authPath);
  const user = { name: 'Test User', email: 'owner@example.test', avatar: 'avatar' };
  const token = createSessionToken(user);
  const [body, signature] = token.split('.');
  assert.strictEqual(signature.length, 43, 'SHA-256 base64url signature remains 43 characters');
  assert.strictEqual(Buffer.from(signature, 'base64url').length, 32, 'signature remains a 32-byte SHA-256 HMAC');
  assert.deepStrictEqual(getSessionUser(requestFor(token)), user, 'newly generated sessions verify');

  const priorPayload = { user, exp: nowSeconds + (60 * 60 * 24 * 14) };
  const priorBody = Buffer.from(JSON.stringify(priorPayload)).toString('base64url');
  const priorSignature = crypto.createHmac('sha256', secret).update(priorBody).digest('base64url');
  const priorToken = `${priorBody}.${priorSignature}`;
  assert.deepStrictEqual(getSessionUser(requestFor(priorToken)), user, 'pre-change format verifies');

  const wrongSignature = crypto.createHmac('sha256', secret).update(`${body}x`).digest('base64url');
  const mutated = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  const nonCanonicalLastCharacter = String.fromCharCode(signature.charCodeAt(signature.length - 1) + 1);
  const rejected = [
    `${body}.${wrongSignature}`,
    `${body}.${mutated}`,
    `${body}.${signature.slice(0, -1)}`,
    `${body}.${signature}A`,
    `${body}.`,
    `${body}.${signature.slice(0, -1)}!`,
    `${body}.${signature.slice(0, -1)}${nonCanonicalLastCharacter}`,
    body,
    '.signature',
    '...'
  ];
  for (const candidate of rejected) assert.doesNotThrow(() => assert.strictEqual(getSessionUser(requestFor(candidate)), null));
  assert.deepStrictEqual(getSessionUser(requestFor(`${priorToken}.ignored`)), user, 'existing split behavior ignores additional components');

  function signedPayload(payload) {
    const candidateBody = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)).toString('base64url');
    return `${candidateBody}.${crypto.createHmac('sha256', secret).update(candidateBody).digest('base64url')}`;
  }
  const malformedPayloads = [
    signedPayload('{'),
    signedPayload(null),
    signedPayload([]),
    signedPayload({ user }),
    signedPayload({ user, exp: 'not-a-number' }),
    signedPayload({ user, exp: nowSeconds - 1 })
  ];
  for (const candidate of malformedPayloads) assert.doesNotThrow(() => assert.strictEqual(getSessionUser(requestFor(candidate)), null));
  assert.strictEqual(getSessionUser(requestFor()), null, 'missing cookie is unauthenticated');
  assert.strictEqual(getSessionUser(requestFor('')), null, 'empty cookie is unauthenticated');
  assert.doesNotThrow(() => assert.strictEqual(getSessionUser({ headers: { cookie: 'funklix_session=%' } }), null));

  const tamperedBody = `${body.slice(0, -1)}${body.endsWith('A') ? 'B' : 'A'}`;
  assert.strictEqual(getSessionUser(requestFor(`${tamperedBody}.${signature}`)), null);

  const setHeaders = {};
  setSessionCookie({ setHeader(name, value) { setHeaders[name] = value; } }, token);
  assert.strictEqual(setHeaders['Set-Cookie'], `funklix_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600; `);
  clearSessionCookie({ setHeader(name, value) { setHeaders[name] = value; } });
  assert.strictEqual(setHeaders['Set-Cookie'], 'funklix_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ');

  delete process.env.AUTH_SECRET;
  delete process.env.SESSION_SECRET;
  assert.doesNotThrow(() => assert.strictEqual(getSessionUser(requestFor(token)), null), 'missing secret fails closed');

  assert.deepStrictEqual(capturedLogs, [], 'session verification emits no sensitive diagnostics');
  console.log = originalLog;
  console.log('BW-16 timing-safe session verification checks passed.');
} finally {
  restoreEnvironment();
}
