#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { requestOnce } = require('../api/_website-retrieval');

const cert = fs.readFileSync(path.join(__dirname, 'fixtures', 'pinned-runtime-cert.pem'));
const key = fs.readFileSync(path.join(__dirname, 'fixtures', 'pinned-runtime-key.pem'));

function listen(host) {
  const server = https.createServer({ cert, key }, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<main><h1>Controlled About page</h1></main>');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => resolve(server));
  });
}

function close(server) { return new Promise((resolve) => server.close(resolve)); }

function trustedRequest(captures) {
  return (options, callback) => {
    captures.push(options);
    return https.request({ ...options, ca: cert }, callback);
  };
}

async function consume(response) {
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function reproduceLegacyContract(port) {
  return new Promise((resolve) => {
    const state = { socketStarted: false, socketConnected: false, tlsStarted: false, error: null };
    const req = https.request({
      hostname: 'runtime.test', servername: 'runtime.test', port, ca: cert,
      lookup: (_hostname, _options, callback) => callback(null, '127.0.0.1', 4)
    });
    req.once('socket', (socket) => {
      state.socketStarted = true;
      socket.once('connect', () => { state.socketConnected = true; state.tlsStarted = true; });
    });
    req.once('error', (error) => { state.error = error; resolve(state); });
    req.end();
  });
}

(async () => {
  const ipv4Server = await listen('127.0.0.1');
  const ipv4Port = ipv4Server.address().port;
  try {
    const legacy = await reproduceLegacyContract(ipv4Port);
    assert.strictEqual(legacy.error?.name, 'TypeError');
    assert.strictEqual(legacy.socketStarted, true);
    assert.strictEqual(legacy.socketConnected, false);
    assert.strictEqual(legacy.tlsStarted, false);
    assert.strictEqual(legacy.error?.code, 'ERR_INVALID_IP_ADDRESS');

    const captures = [];
    const response = await requestOnce(new URL(`https://runtime.test:${ipv4Port}/about`), [{ address: '127.0.0.1', family: 4 }], {
      signal: new AbortController().signal, requestImpl: trustedRequest(captures)
    });
    assert.strictEqual(response.statusCode, 200);
    assert.match(await consume(response), /Controlled About page/);
    assert.strictEqual(captures[0].hostname, 'runtime.test');
    assert.strictEqual(captures[0].servername, 'runtime.test');
    assert.strictEqual(captures[0].headers.Host, `runtime.test:${ipv4Port}`);
    await new Promise((resolve) => captures[0].lookup('ignored', { all: true }, (error, results) => {
      assert.ifError(error);
      assert.deepStrictEqual(results, [{ address: '127.0.0.1', family: 4 }]);
      resolve();
    }));

    await assert.rejects(requestOnce(new URL(`https://wrong.runtime.test:${ipv4Port}/`), [{ address: '127.0.0.1', family: 4 }], {
      signal: new AbortController().signal, requestImpl: trustedRequest([])
    }), (error) => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
  } finally {
    await close(ipv4Server);
  }

  const ipv6Server = await listen('::1');
  try {
    const port = ipv6Server.address().port;
    const response = await requestOnce(new URL(`https://runtime.test:${port}/about`), [{ address: '::1', family: 6 }], {
      signal: new AbortController().signal, requestImpl: trustedRequest([])
    });
    assert.strictEqual(response.statusCode, 200);
    assert.match(await consume(response), /Controlled About page/);
  } finally {
    await close(ipv6Server);
  }

  console.log('Pinned lookup runtime compatibility checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
