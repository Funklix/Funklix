#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Client, Pool } = require('pg');
const { rootCertificates, checkServerIdentity } = require('node:tls');
const { X509Certificate } = require('node:crypto');
const { postgresPoolOptions } = require('../api/_postgres-tls');
const ca = rootCertificates[0];
const remote = 'postgresql://tendra_app_runtime.fixture:password%40secret@aws-0.example.pooler.supabase.com:6543/postgres?sslmode=require&application_name=tendra';
const env = { POSTGRES_URL: remote, SUPABASE_CA_CERT: ca };
let groups = 0;
function check(name, fn) { fn(); groups++; console.log('PASS ' + name); }
function effective(input) {
  const pool = new Pool(postgresPoolOptions(input));
  // This is the same Client constructor pg-pool uses when acquiring a client.
  return new Client(pool.options).connectionParameters;
}
check('multiline, CRLF, escaped newlines and certificate bundles', () => {
  for (const value of [ca, ca.replace(/\n/g, '\r\n'), ca.replace(/\n/g, '\\n'), ca.replace(/\n/g, '\\r\\n'), '  ' + ca + '\n', ca + '\n' + rootCertificates[1]]) {
    const options = postgresPoolOptions({ ...env, SUPABASE_CA_CERT: value });
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.ok(options.ssl.ca.includes('-----BEGIN CERTIFICATE-----\n'));
    assert.equal(effective({ ...env, SUPABASE_CA_CERT: value }).ssl.ca, options.ssl.ca);
  }
});
check('missing, empty and malformed CA fail closed without secret disclosure', () => {
  for (const value of [undefined, '', ' \n ', 'not a certificate', '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----', ca + '\npassword@secret', ca + '\n-----BEGIN CERTIFICATE-----\nbad\n-----END CERTIFICATE-----']) {
    assert.throws(() => postgresPoolOptions({ ...env, SUPABASE_CA_CERT: value }), error => {
      assert.equal(error.code, 'POSTGRES_TLS_CONFIGURATION_ERROR');
      assert.match(error.message, /SUPABASE_CA_CERT/);
      for (const secret of [remote, 'password', 'BEGIN CERTIFICATE']) assert.ok(!error.message.includes(secret));
      return true;
    });
  }
});
check('URL SSL controls cannot override explicit CA or disable verification in pg', () => {
  for (const query of ['sslmode=require', 'sslmode=disable', 'sslmode=no-verify', 'ssl=false', 'ssl=true', 'sslrootcert=/nonexistent&sslcert=/nonexistent&sslkey=/nonexistent', 'sslmode=require&uselibpqcompat=true', 'sslmode=disable&sslmode=no-verify']) {
    const input = { ...env, POSTGRES_URL: remote.split('?')[0] + '?' + query + '&application_name=tendra' };
    const options = postgresPoolOptions(input);
    const result = effective(input);
    assert.deepEqual(result.ssl, { ca: ca.trim(), rejectUnauthorized: true });
    assert.equal(result.host, 'aws-0.example.pooler.supabase.com');
    assert.equal(result.port, 6543);
    assert.equal(result.user, 'tendra_app_runtime.fixture');
    assert.equal(result.password, 'password@secret');
    assert.equal(result.database, 'postgres');
    assert.equal(result.application_name, 'tendra');
    assert.equal(input.POSTGRES_URL, remote.split('?')[0] + '?' + query + '&application_name=tendra');
    assert.ok(!new URL(options.connectionString).searchParams.has('sslmode'));
  }
  // Document the actual parser hazard that this helper prevents.
  assert.notDeepEqual(new Client({ connectionString: remote, ssl: { ca, rejectUnauthorized: true } }).connectionParameters.ssl, { ca, rejectUnauthorized: true });
});
check('no insecure fallback or hostname verification override', () => {
  const result = effective(env);
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(result.ssl.checkServerIdentity, undefined);
  assert.equal(result.ssl.servername, undefined);
  assert.equal(checkServerIdentity('wrong.example.test', new X509Certificate(ca).toLegacyObject()).code, 'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.throws(() => postgresPoolOptions({ ...env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }), /Global TLS certificate verification/);
  for (const mode of ['require', 'disable', 'no-verify']) {
    assert.throws(() => postgresPoolOptions({ POSTGRES_URL: remote.split('?')[0] + '?sslmode=' + mode }), /SUPABASE_CA_CERT/);
  }
});
check('connection-target overrides cannot take the local-development exception', () => {
  for (const query of [
    'host=remote.example.test&sslmode=disable', 'host=remote.example.test&ssl=0',
    'host=localhost&host=remote.example.test&sslmode=no-verify',
    'host=remote.example.test&host=localhost', 'host=localhost', 'host=',
    '%68ost=remote.example.test', 'HOST=remote.example.test',
    'hostaddr=203.0.113.1', 'service=remote', 'host=%2Ftmp%2Fpostgres',
    'port=5432', 'port=6543&port=5432', 'port=5432&port=6543',
    'port=', '%70ort=5432', 'PORT=5432', 'port=5432&sslmode=disable'
  ]) {
    for (const authority of ['localhost', '127.0.0.1', '[::1]', 'pooler.supabase.com']) {
      const connectionString = 'postgres://fixture:fixture@' + authority + '/postgres?' + query;
      for (const certificate of [undefined, ca]) {
        assert.throws(() => postgresPoolOptions({ POSTGRES_URL: connectionString, SUPABASE_CA_CERT: certificate }), error => {
          assert.equal(error.code, 'POSTGRES_TLS_CONFIGURATION_ERROR');
          assert.match(error.message, /connection-target query overrides/);
          assert.ok(!error.message.includes(connectionString));
          return true;
        });
      }
    }
  }
  // Verify the review's bypass against the installed parser, without connecting.
  const parsed = new Client({ connectionString: 'postgres://fixture:fixture@localhost/postgres?host=remote.example.test&sslmode=disable' }).connectionParameters;
  assert.equal(parsed.host, 'remote.example.test');
  assert.equal(parsed.ssl, false);
  // A query port also changes the pooler mode despite an explicit authority port.
  const portOverride = remote + '&port=5432';
  assert.equal(new Client({ connectionString: portOverride }).connectionParameters.port, 5432);
  assert.throws(() => postgresPoolOptions({ ...env, POSTGRES_URL: portOverride }), /connection-target query overrides/);
  assert.equal(effective(env).port, 6543);
});
check('local fixtures and absent URL preserve existing pg defaults', () => {
  assert.deepEqual(postgresPoolOptions({}), { connectionString: undefined });
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const connectionString = 'postgres://fixture:fixture@' + host + ':5432/postgres';
    assert.deepEqual(postgresPoolOptions({ POSTGRES_URL: connectionString }), { connectionString });
  }
  assert.throws(() => postgresPoolOptions({ POSTGRES_URL: 'postgres://localhost/test', NODE_TLS_REJECT_UNAUTHORIZED: '0' }), /Global TLS certificate verification/);
  assert.throws(() => postgresPoolOptions({ ...env, POSTGRES_URL: 'bad password@secret' }), error => error.code === 'POSTGRES_TLS_CONFIGURATION_ERROR' && !error.message.includes('secret'));
});
check('runtime storage uses strict options and retains maintenance wrapper', () => {
  const source = fs.readFileSync('api/_boards-storage.js', 'utf8');
  assert.match(source, /guardPool\(new Pool\(postgresPoolOptions\(\)\)\)/);
});
console.log('PASS ' + groups + ' PostgreSQL TLS test groups');
