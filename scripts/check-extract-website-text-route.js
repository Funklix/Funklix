#!/usr/bin/env node
const assert = require('assert');
process.env.AUTH_SECRET = 'route-test-secret';
const { createSessionToken } = require('../api/_auth-session');
const retrievalPath = require.resolve('../api/_website-retrieval');
require(retrievalPath);
require.cache[retrievalPath].exports.retrieveWebsiteText = async (url) => {
  if (url.includes('/failure')) {
    const error = new Error('The webpage could not be retrieved.'); error.code = 'retrieval_failed';
    Object.defineProperty(error, 'diagnostics', { value: {
      stage: 'socket_connection', normalizedErrorCode: 'ECONNRESET', errorName: 'Error', addressFamily: 4,
      dnsStarted: true, dnsCompleted: true, addressSelected: true, socketStarted: true, socketConnected: false,
      tlsStarted: false, tlsCompleted: false, headersReceived: false, redirectCount: 0, boundedBytesReceived: 0,
      finalStableErrorCode: 'retrieval_failed', elapsedMs: 2
    }, enumerable: false });
    throw error;
  }
  return { status: 'success', source: { url, title: 'Fixture' }, content: { text: 'Text', truncated: false } };
};
delete require.cache[require.resolve('../api/extract-website-text')];
const handler = require('../api/extract-website-text');
function invoke(req) { const result = {}; const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } }; return Promise.resolve(handler(req, res)).then(() => result); }
(async () => {
assert.strictEqual((await invoke({ method: 'GET', headers: {} })).status, 405);
assert.strictEqual((await invoke({ method: 'POST', headers: {}, body: { url: 'https://example.com' } })).status, 401);
const token = createSessionToken({ email: 'founder@example.com' });
const auth = { cookie: `funklix_session=${encodeURIComponent(token)}` };
assert.strictEqual((await invoke({ method: 'POST', headers: auth, body: { url: 'https://example.com', extra: true } })).status, 400);
const success = await invoke({ method: 'POST', headers: auth, body: { url: 'https://example.com/about' } });
assert.strictEqual(success.status, 200); assert.strictEqual(success.body.content.text, 'Text'); assert.strictEqual(JSON.stringify(success.body).includes('<html'), false);
const logs = []; const originalError = console.error; console.error = (...args) => logs.push(args);
const failure = await invoke({ method: 'POST', headers: auth, body: { url: 'https://example.com/failure?private=secret' } });
console.error = originalError;
assert.deepStrictEqual(failure, { status: 502, body: { success: false, error: { code: 'retrieval_failed', message: 'The webpage could not be retrieved.' } } });
assert.strictEqual(logs.length, 1); assert.strictEqual(logs[0][0], '[WEBSITE_TEXT_RETRIEVAL_FAILED]');
assert.strictEqual(logs[0][1].normalizedErrorCode, 'ECONNRESET');
assert.strictEqual(JSON.stringify(logs).includes('example.com'), false);
assert.strictEqual(JSON.stringify(logs).includes('private=secret'), false);
console.log('Website text route checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
