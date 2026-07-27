#!/usr/bin/env node
const assert = require('assert');
const { EventEmitter } = require('events');
const { retrieveWebsiteText } = require('../api/_website-retrieval');

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const secret = {
  url: 'https://diagnostic-secret.example/private?token=secret', hostname: 'diagnostic-secret.example',
  address: '93.184.216.34', answer: '93.184.216.34,2001:db8::1', body: '<html>private body</html>',
  header: 'authorization: secret', message: 'raw private transport message'
};

function requestFailure(code, { socket, synchronous = false } = {}) {
  return (_options, _callback) => {
    const error = Object.assign(new Error(secret.message), { code });
    if (synchronous) throw error;
    const req = new EventEmitter();
    req.end = () => setImmediate(() => {
      let transportSocket;
      if (socket) {
        transportSocket = new EventEmitter();
        req.emit('socket', transportSocket);
        if (socket === 'tls') { transportSocket.emit('connect'); }
      }
      if (socket) transportSocket.emit('error', error); else req.emit('error', error);
    });
    return req;
  };
}

async function capture(options) {
  try {
    await retrieveWebsiteText(secret.url, { lookup: publicLookup, ...options });
    assert.fail('expected retrieval failure');
  } catch (error) {
    assert.strictEqual(error.code, options.expectedStable || 'retrieval_failed');
    assert(error.diagnostics && typeof error.diagnostics === 'object');
    return error.diagnostics;
  }
}

(async () => {
  const resolver = await capture({
    lookup: async () => { throw Object.assign(new Error(secret.message), { code: 'EAI_AGAIN' }); },
    expectedStable: 'dns_failed'
  });
  assert.strictEqual(resolver.stage, 'dns_lookup');
  assert.strictEqual(resolver.normalizedErrorCode, 'EAI_AGAIN');
  assert.strictEqual(resolver.dnsStarted, true);
  assert.strictEqual(resolver.dnsCompleted, false);
  assert.strictEqual(resolver.addressSelected, false);

  const lookupContractRequest = (options) => options.lookup('ignored', {}, () => {
    throw Object.assign(new Error(secret.message), { code: 'ERR_INVALID_ARG_TYPE' });
  });
  const lookupContract = await capture({ requestImpl: lookupContractRequest });
  assert.strictEqual(lookupContract.normalizedErrorCode, 'ERR_INVALID_ARG_TYPE');
  assert.strictEqual(lookupContract.stage, 'request_creation');
  assert.strictEqual(lookupContract.addressSelected, true);
  assert.strictEqual(lookupContract.addressFamily, 4);
  assert.strictEqual(lookupContract.socketStarted, false);

  const creation = await capture({ requestImpl: requestFailure('EINVAL', { synchronous: true }) });
  assert.strictEqual(creation.stage, 'request_creation');
  assert.strictEqual(creation.normalizedErrorCode, 'EINVAL');

  const socket = await capture({ requestImpl: requestFailure('ECONNREFUSED', { socket: 'plain' }) });
  assert.strictEqual(socket.stage, 'socket_connection');
  assert.strictEqual(socket.normalizedErrorCode, 'ECONNREFUSED');
  assert.strictEqual(socket.socketStarted, true);
  assert.strictEqual(socket.socketConnected, false);

  const tls = await capture({ requestImpl: requestFailure('ERR_TLS_CERT_ALTNAME_INVALID', { socket: 'tls' }) });
  assert.strictEqual(tls.stage, 'tls_handshake');
  assert.strictEqual(tls.normalizedErrorCode, 'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.strictEqual(tls.socketConnected, true);
  assert.strictEqual(tls.tlsStarted, true);
  assert.strictEqual(tls.tlsCompleted, false);

  const never = (options) => {
    const req = new EventEmitter(); req.end = () => {};
    options.signal.addEventListener('abort', () => {
      const error = new Error(secret.message); error.name = 'AbortError'; req.emit('error', error);
    }, { once: true });
    return req;
  };
  const timeout = await capture({ requestImpl: never, timeoutMs: 5, expectedStable: 'timeout' });
  assert.strictEqual(timeout.normalizedErrorCode, 'ETIMEDOUT');
  assert.strictEqual(timeout.finalStableErrorCode, 'timeout');

  for (const diagnostics of [resolver, lookupContract, creation, socket, tls, timeout]) {
    const serialized = JSON.stringify(diagnostics);
    for (const forbidden of Object.values(secret)) assert.strictEqual(serialized.includes(forbidden), false, forbidden);
    assert.deepStrictEqual(Object.keys(diagnostics).sort(), [
      'addressFamily', 'addressSelected', 'boundedBytesReceived', 'dnsCompleted', 'dnsStarted',
      'elapsedMs', 'errorName', 'finalStableErrorCode', 'headersReceived', 'normalizedErrorCode',
      'redirectCount', 'socketConnected', 'socketStarted', 'stage', 'tlsCompleted', 'tlsStarted'
    ].sort());
  }
  console.log('Website retrieval bounded diagnostics checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
