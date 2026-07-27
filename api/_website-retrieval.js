const http = require('http');
const https = require('https');
const { validateWebsiteUrl, resolvePublicAddresses, WebsitePolicyError } = require('./_website-url-policy');
const { extractHtmlText } = require('./_html-text-extractor');

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10000;
const USER_AGENT = 'Funklix-Website-Text/1.0';

class WebsiteRetrievalError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function safeError(error) {
  if (error instanceof WebsitePolicyError || error instanceof WebsiteRetrievalError || error?.code === 'empty_content') return error;
  if (error?.name === 'AbortError') return new WebsiteRetrievalError('request_cancelled', 'The webpage request was cancelled.');
  return new WebsiteRetrievalError('retrieval_failed', 'The webpage could not be retrieved.');
}

function requestOnce(url, addresses, { signal, requestImpl } = {}) {
  const selected = addresses[0];
  const transport = requestImpl || (url.protocol === 'https:' ? https.request : http.request);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; callback(value); };
    const req = transport({
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      servername: url.protocol === 'https:' ? url.hostname.replace(/^\[|\]$/g, '') : undefined,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: { Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': USER_AGENT, Host: url.host },
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
      signal
    }, (response) => finish(resolve, response));
    req.on('error', (error) => finish(reject, error));
    req.end();
  });
}

async function readBounded(response, maxBytes) {
  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The webpage is too large to import.'); }
  const chunks = [];
  let total = 0;
  for await (const chunk of response) {
    total += chunk.length;
    if (total > maxBytes) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The webpage is too large to import.'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

async function retrieveWebsiteText(input, options = {}) {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    let url = validateWebsiteUrl(input);
    const visited = new Set();
    for (let redirects = 0; ; redirects += 1) {
      if (visited.has(url.href)) throw new WebsiteRetrievalError('redirect_loop', 'The webpage redirect loop could not be followed.');
      visited.add(url.href);
      const addresses = await resolvePublicAddresses(url.hostname.replace(/^\[|\]$/g, ''), options.lookup);
      const response = await requestOnce(url, addresses, { signal: controller.signal, requestImpl: options.requestImpl });
      const status = Number(response.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (redirects >= (options.maxRedirects ?? MAX_REDIRECTS)) throw new WebsiteRetrievalError('too_many_redirects', 'The webpage has too many redirects.');
        const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
        if (!location) throw new WebsiteRetrievalError('invalid_redirect', 'The webpage returned an invalid redirect.');
        try { url = validateWebsiteUrl(new URL(location, url).href); } catch (error) { throw safeError(error); }
        continue;
      }
      if (status < 200 || status >= 300) { response.destroy(); throw new WebsiteRetrievalError('http_error', 'The webpage did not return a successful response.'); }
      const contentEncoding = String(response.headers['content-encoding'] || 'identity').toLowerCase();
      if (contentEncoding !== 'identity') { response.destroy(); throw new WebsiteRetrievalError('unsupported_encoding', 'The webpage uses an unsupported response encoding.'); }
      const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!['text/html', 'application/xhtml+xml'].includes(type)) { response.destroy(); throw new WebsiteRetrievalError('unsupported_content_type', 'Only HTML webpages are supported.'); }
      const html = await readBounded(response, options.maxResponseBytes ?? MAX_RESPONSE_BYTES);
      const extracted = extractHtmlText(html, options.extractionOptions);
      return { status: 'success', source: { url: url.href, title: extracted.title }, content: { text: extracted.text, truncated: extracted.truncated } };
    }
  } catch (error) {
    if (controller.signal.aborted) {
      if (options.signal?.aborted) throw new WebsiteRetrievalError('request_cancelled', 'The webpage request was cancelled.');
      throw new WebsiteRetrievalError('timeout', 'The webpage took too long to respond.');
    }
    throw safeError(error);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

module.exports = { retrieveWebsiteText, requestOnce, WebsiteRetrievalError, MAX_REDIRECTS, MAX_RESPONSE_BYTES, TIMEOUT_MS };
