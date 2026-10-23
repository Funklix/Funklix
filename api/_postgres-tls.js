'use strict';
const { X509Certificate } = require('node:crypto');

function configurationError(reason) {
  return Object.assign(new Error('PostgreSQL TLS configuration: ' + reason), {
    code: 'POSTGRES_TLS_CONFIGURATION_ERROR'
  });
}

// Keep the original pg defaults for disposable local development/test databases.
// Every configured remote database requires an explicit server-only trust anchor.
function postgresPoolOptions(env = process.env) {
  const connectionString = env.POSTGRES_URL;
  if (!connectionString) return { connectionString };
  let url;
  try { url = new URL(connectionString); }
  catch { throw configurationError('POSTGRES_URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw configurationError('POSTGRES_URL must be a valid PostgreSQL URL.');
  }
  const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  // pg also accepts a query-string host override. It must not turn the local
  // fixture exception into an unverified remote connection.
  const local = loopback(url.hostname) &&
    url.searchParams.getAll('host').every(loopback) &&
    !url.searchParams.has('hostaddr') && !url.searchParams.has('service');
  const supplied = env.SUPABASE_CA_CERT !== undefined;
  if (local && !supplied) return { connectionString };

  if (typeof env.SUPABASE_CA_CERT !== 'string' || !env.SUPABASE_CA_CERT.trim()) {
    throw configurationError('SUPABASE_CA_CERT is required for remote PostgreSQL connections.');
  }
  const ca = env.SUPABASE_CA_CERT.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').trim();
  // X509Certificate alone accepts trailing data. Require the entire value to be
  // one or more PEM certificates and validate each block before constructing pg.
  const blocks = ca.match(/-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\n]+\n-----END CERTIFICATE-----/g);
  try {
    if (!blocks?.length || blocks.join('').replace(/\s/g, '') !== ca.replace(/\s/g, '')) throw new Error();
    for (const block of blocks) new X509Certificate(block);
  } catch {
    throw configurationError('SUPABASE_CA_CERT must contain complete valid PEM certificates.');
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw configurationError('Global TLS certificate verification must be enabled.');
  }

  // pg parses connectionString AFTER explicit options. sslmode=require (and
  // sslcert/sslkey/sslrootcert/ssl) can replace the entire ssl object. Strip only
  // URL TLS controls from our in-memory copy; preserve the configured secret,
  // endpoint, credentials, database and all other connection/pool behavior.
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('ssl') || key.toLowerCase() === 'uselibpqcompat') {
      url.searchParams.delete(key);
    }
  }
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}

module.exports = { postgresPoolOptions };
