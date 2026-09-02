const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { validateWebsiteUrl, resolvePublicAddresses, WebsitePolicyError } = require('./_website-url-policy');
const { extractHtmlText } = require('./_html-text-extractor');

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const USER_AGENT = 'Funklix-Website-Text/1.0';
const SAFE_NODE_ERROR_CODES = new Set([
  'EAI_AGAIN', 'ENOTFOUND', 'EINVAL', 'ERR_INVALID_ARG_TYPE', 'ECONNREFUSED', 'ECONNRESET',
  'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ERR_INVALID_IP_ADDRESS',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
]);

class WebsiteRetrievalError extends Error {
  constructor(code, message, options) { super(message, options); this.code = code; }
}

function underlyingError(error) {
  let current = error;
  while (current?.cause instanceof Error && current.cause !== current) current = current.cause;
  return current;
}

function normalizeNodeErrorCode(error) {
  const code = underlyingError(error)?.code;
  return typeof code === 'string' && SAFE_NODE_ERROR_CODES.has(code) ? code : 'UNKNOWN_TRANSPORT_ERROR';
}

function sanitizedErrorName(error) {
  const name = underlyingError(error)?.name;
  return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name) ? name : 'Error';
}

function createDiagnostics() {
  return {
    stage: 'url_policy', normalizedErrorCode: null, errorName: null, addressFamily: null,
    dnsStarted: false, dnsCompleted: false, addressSelected: false, socketStarted: false,
    socketConnected: false, tlsStarted: false, tlsCompleted: false, headersReceived: false,
    redirectCount: 0, boundedBytesReceived: 0, finalStableErrorCode: null, elapsedMs: 0
  };
}

function diagnosticSnapshot(diagnostics) { return { ...diagnostics }; }

function safeError(error) {
  if (error instanceof WebsitePolicyError || error instanceof WebsiteRetrievalError || error?.code === 'empty_content') return error;
  if (error?.name === 'AbortError') return new WebsiteRetrievalError('request_cancelled', 'The webpage request was cancelled.', { cause: error });
  return new WebsiteRetrievalError('retrieval_failed', 'The webpage could not be retrieved.', { cause: error });
}

function requestOnce(url, addresses, { signal, requestImpl, diagnostics = createDiagnostics() } = {}) {
  const selected = addresses[0];
  const transport = requestImpl || (url.protocol === 'https:' ? https.request : http.request);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; callback(value); };
    diagnostics.stage = 'request_creation';
    const req = transport({
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      servername: url.protocol === 'https:' ? url.hostname.replace(/^\[|\]$/g, '') : undefined,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: { Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'gzip, deflate, br, identity', 'User-Agent': USER_AGENT, Host: url.host },
      lookup: (_hostname, lookupOptions, callback) => {
        const result = { address: selected.address, family: Number(selected.family) };
        if (lookupOptions && typeof lookupOptions === 'object' && lookupOptions.all) callback(null, [result]);
        else callback(null, result.address, result.family);
      },
      signal
    }, (response) => {
      diagnostics.headersReceived = true;
      diagnostics.stage = 'response_validation';
      finish(resolve, response);
    });
    diagnostics.stage = 'socket_connection';
    req.once?.('socket', (socket) => {
      diagnostics.socketStarted = true;
      socket.once?.('error', (error) => finish(reject, error));
      socket.once?.('connect', () => {
        diagnostics.socketConnected = true;
        diagnostics.stage = url.protocol === 'https:' ? 'tls_handshake' : 'awaiting_headers';
        if (url.protocol === 'https:') diagnostics.tlsStarted = true;
      });
      if (url.protocol === 'https:') socket.once?.('secureConnect', () => {
        diagnostics.tlsStarted = true;
        diagnostics.tlsCompleted = true;
        diagnostics.stage = 'awaiting_headers';
      });
    });
    req.on('error', (error) => finish(reject, error));
    req.end();
  });
}

async function readBounded(response, maxBytes, maxDecompressedBytes, diagnostics) {
  diagnostics.stage = 'response_stream';
  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The webpage is too large to import.'); }
  const chunks = [];
  let total = 0;
  for await (const chunk of response) {
    total += chunk.length;
    diagnostics.boundedBytesReceived = Math.min(total, maxBytes + 1);
    if (total > maxBytes) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The webpage is too large to import.'); }
    chunks.push(chunk);
  }
  const compressed = Buffer.concat(chunks, total);
  const encoding = String(response.headers['content-encoding'] || 'identity').toLowerCase();
  let decoded;
  try {
    if (encoding === 'identity') decoded = compressed;
    else if (encoding === 'gzip') decoded = zlib.gunzipSync(compressed, { maxOutputLength: maxDecompressedBytes + 1 });
    else if (encoding === 'deflate') decoded = zlib.inflateSync(compressed, { maxOutputLength: maxDecompressedBytes + 1 });
    else if (encoding === 'br') decoded = zlib.brotliDecompressSync(compressed, { maxOutputLength: maxDecompressedBytes + 1 });
    else throw new WebsiteRetrievalError('unsupported_encoding', 'The webpage uses an unsupported response encoding.');
  } catch (error) {
    if (error instanceof WebsiteRetrievalError) throw error;
    throw new WebsiteRetrievalError(error?.code === 'ERR_BUFFER_TOO_LARGE' ? 'decompressed_too_large' : 'invalid_encoding', 'The webpage could not be decoded safely.');
  }
  if (decoded.length > maxDecompressedBytes) throw new WebsiteRetrievalError('decompressed_too_large', 'The webpage expands beyond the safe import boundary.');
  diagnostics.decompressedBytes = decoded.length;
  return decoded.toString('utf8');
}

async function retrieveWebsiteText(input, options = {}) {
  const startedAt = Date.now();
  const diagnostics = createDiagnostics();
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    let url = validateWebsiteUrl(input);
    const visited = new Set();
    for (let redirects = 0; ; redirects += 1) {
      Object.assign(diagnostics, {
        addressFamily: null, dnsStarted: false, dnsCompleted: false, addressSelected: false,
        socketStarted: false, socketConnected: false, tlsStarted: false, tlsCompleted: false,
        headersReceived: false, boundedBytesReceived: 0
      });
      if (visited.has(url.href)) throw new WebsiteRetrievalError('redirect_loop', 'The webpage redirect loop could not be followed.');
      visited.add(url.href);
      diagnostics.stage = 'dns_lookup';
      diagnostics.dnsStarted = true;
      const addresses = await resolvePublicAddresses(url.hostname.replace(/^\[|\]$/g, ''), options.lookup, diagnostics);
      diagnostics.stage = 'address_selection';
      diagnostics.addressSelected = true;
      diagnostics.addressFamily = addresses[0].family;
      const response = await requestOnce(url, addresses, { signal: controller.signal, requestImpl: options.requestImpl, diagnostics });
      const status = Number(response.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (redirects >= (options.maxRedirects ?? MAX_REDIRECTS)) throw new WebsiteRetrievalError('too_many_redirects', 'The webpage has too many redirects.');
        const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
        if (!location) throw new WebsiteRetrievalError('invalid_redirect', 'The webpage returned an invalid redirect.');
        try { url = validateWebsiteUrl(new URL(location, url).href); } catch (error) { throw safeError(error); }
        diagnostics.redirectCount = redirects + 1;
        continue;
      }
      if (status < 200 || status >= 300) { response.destroy(); throw new WebsiteRetrievalError('http_error', 'The webpage did not return a successful response.'); }
      const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!['text/html', 'application/xhtml+xml'].includes(type)) { response.destroy(); throw new WebsiteRetrievalError('unsupported_content_type', 'Only HTML webpages are supported.'); }
      const html = await readBounded(response, options.maxResponseBytes ?? MAX_RESPONSE_BYTES, options.maxDecompressedBytes ?? MAX_DECOMPRESSED_BYTES, diagnostics);
      diagnostics.stage = 'extraction';
      const extracted = extractHtmlText(html, options.extractionOptions);
      const result = { status: 'success', source: { url: url.href, title: extracted.title }, content: { text: extracted.text, truncated: extracted.truncated } };
      // HTML is exposed only to trusted server-side callers (domain analysis), never by the public extraction route.
      if (options.includeHtml === true) result.internalHtml = html;
      return result;
    }
  } catch (error) {
    let safe;
    if (controller.signal.aborted) {
      safe = options.signal?.aborted
        ? new WebsiteRetrievalError('request_cancelled', 'The webpage request was cancelled.', { cause: error })
        : new WebsiteRetrievalError('timeout', 'The webpage took too long to respond.', { cause: error });
    } else {
      safe = safeError(error);
    }
    diagnostics.normalizedErrorCode = safe.code === 'timeout' ? 'ETIMEDOUT' : normalizeNodeErrorCode(error);
    diagnostics.errorName = sanitizedErrorName(error);
    diagnostics.finalStableErrorCode = safe.code;
    diagnostics.elapsedMs = Math.max(0, Date.now() - startedAt);
    Object.defineProperty(safe, 'diagnostics', { value: diagnosticSnapshot(diagnostics), enumerable: false });
    throw safe;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

module.exports = { retrieveWebsiteText, requestOnce, readBounded, WebsiteRetrievalError, MAX_REDIRECTS, MAX_RESPONSE_BYTES, MAX_DECOMPRESSED_BYTES, TIMEOUT_MS };
