#!/usr/bin/env node
const assert = require('assert');
const { EventEmitter } = require('events');
const { Readable } = require('stream');
const { retrieveWebsiteText } = require('../api/_website-retrieval');

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
function response(statusCode, headers, chunks = []) { const stream = Readable.from(chunks.map((x) => Buffer.from(x))); stream.statusCode = statusCode; stream.headers = headers; return stream; }
function fakeRequest(queue, captures = []) {
  return (options, callback) => {
    captures.push(options);
    const req = new EventEmitter(); req.end = () => setImmediate(() => callback(queue.shift()));
    options.signal?.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; req.emit('error', error); }, { once: true });
    return req;
  };
}

(async () => {
const captures = [];
const result = await retrieveWebsiteText('https://example.com/start?token=secret', { lookup: publicLookup, requestImpl: fakeRequest([
  response(302, { location: '/about' }), response(200, { 'content-type': 'text/html' }, ['<title>About</title><h1>Hello</h1><p>World</p>'])
], captures) });
assert.deepStrictEqual(result, { status: 'success', source: { url: 'https://example.com/about', title: 'About' }, content: { text: 'Hello\nWorld', truncated: false } });
assert.strictEqual(captures.length, 2); captures.forEach((options) => { assert.strictEqual(options.method, 'GET'); assert.deepStrictEqual(Object.keys(options.headers).sort(), ['Accept', 'Accept-Encoding', 'Host', 'User-Agent'].sort()); });
await new Promise((resolve) => captures[0].lookup('ignored', {}, (_error, address) => { assert.strictEqual(address, '93.184.216.34'); resolve(); }));
assert.strictEqual(captures[0].hostname, 'example.com');
assert.strictEqual(captures[0].servername, 'example.com', 'TLS verification must retain the submitted hostname while the socket is pinned');
assert.strictEqual(captures[0].headers.Host, 'example.com');

const theaterFixture = '<!doctype html><html><head><title>About the theatre</title></head><body><main><h1>Our Story</h1><p>Founded to create an independent stage for Hamburg.</p><p>Its ensemble built a lasting public theatre.</p></main></body></html>';
const dualStackLookup = async () => [
  { address: '93.184.216.34', family: 4 }, { address: '2001:8d8:1800:1::1', family: 6 }
];
const theater = await retrieveWebsiteText('https://about-page.example/ueber-uns', {
  lookup: dualStackLookup,
  extractionOptions: { maxTextLength: 80 },
  requestImpl: fakeRequest([response(200, { 'content-type': 'text/html; charset=utf-8' }, [theaterFixture])])
});
assert.strictEqual(theater.status, 'success');
assert.strictEqual(theater.source.title, 'About the theatre');
assert.match(theater.content.text, /^Our Story/);
assert.strictEqual(theater.content.text.length <= 80, true);
assert.strictEqual(theater.content.truncated, true);
assert.strictEqual(JSON.stringify(theater).includes('<html'), false, 'retrieval must return extracted text, never raw HTML');

await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: fakeRequest([response(302, { location: 'http://127.0.0.1/admin' })]) }), (e) => e.code === 'unsafe_destination');
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, maxRedirects: 1, requestImpl: fakeRequest([response(302, { location: '/a' }), response(302, { location: '/b' })]) }), (e) => e.code === 'too_many_redirects');
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: fakeRequest([response(302, { location: '/' })]) }), (e) => e.code === 'redirect_loop');
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, maxResponseBytes: 5, requestImpl: fakeRequest([response(200, { 'content-type': 'text/html' }, ['123', '456'])]) }), (e) => e.code === 'response_too_large');
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: fakeRequest([response(200, { 'content-type': 'image/png' }, ['binary'])]) }), (e) => e.code === 'unsupported_content_type');
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: fakeRequest([response(500, { 'content-type': 'text/html' })]) }), (e) => e.code === 'http_error');
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: fakeRequest([response(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }, ['x'])]) }), (e) => e.code === 'unsupported_encoding');

const never = (options) => { const req = new EventEmitter(); req.end = () => {}; options.signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; req.emit('error', error); }, { once: true }); return req; };
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: never, timeoutMs: 5 }), (e) => e.code === 'timeout');
const controller = new AbortController(); setImmediate(() => controller.abort());
await assert.rejects(retrieveWebsiteText('https://example.com', { lookup: publicLookup, requestImpl: never, signal: controller.signal }), (e) => e.code === 'request_cancelled');
console.log('Website retrieval and redirect checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
