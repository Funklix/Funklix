const { validateWebsiteUrl, resolvePublicAddresses } = require('./_website-url-policy');
const { requestOnce, WebsiteRetrievalError } = require('./_website-retrieval');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function retrievePublicImage(input, options = {}) {
  let url = validateWebsiteUrl(input);
  const visited = new Set();
  for (let redirects = 0; ; redirects += 1) {
    if (visited.has(url.href)) throw new WebsiteRetrievalError('redirect_loop', 'The image redirect loop could not be followed.');
    visited.add(url.href);
    const addresses = await resolvePublicAddresses(url.hostname.replace(/^\[|\]$/g, ''), options.lookup);
    const response = await requestOnce(url, addresses, { requestImpl: options.requestImpl });
    const status = Number(response.statusCode || 0);
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      if (redirects >= 5) throw new WebsiteRetrievalError('too_many_redirects', 'The image has too many redirects.');
      const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
      url = validateWebsiteUrl(new URL(location, url).href);
      continue;
    }
    if (status < 200 || status >= 300) { response.destroy(); throw new WebsiteRetrievalError('http_error', 'The image did not return a successful response.'); }
    const mimeType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) { response.destroy(); throw new WebsiteRetrievalError('unsupported_content_type', 'The logo is not a supported image.'); }
    const declared = Number(response.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The logo is too large.'); }
    const chunks = []; let total = 0;
    for await (const chunk of response) {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The logo is too large.'); }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks, total);
    if (!buffer.length) throw new WebsiteRetrievalError('empty_content', 'The logo response was empty.');
    return { buffer, mimeType, sourceUrl: url.href };
  }
}

module.exports = { retrievePublicImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };
