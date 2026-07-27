const { getSessionUser } = require('./_auth-session');
const { retrieveWebsiteText } = require('./_website-retrieval');

const STATUS_BY_CODE = {
  invalid_url: 400, unsupported_scheme: 400, credentials_not_allowed: 400, invalid_host: 400, port_not_allowed: 400,
  unsafe_destination: 400, dns_failed: 400, unsupported_content_type: 415, unsupported_encoding: 415,
  response_too_large: 413, timeout: 504, request_cancelled: 499
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'method_not_allowed', message: 'Method not allowed' } });
  try {
    const user = getSessionUser(req);
    if (!user?.email) return res.status(401).json({ success: false, error: { code: 'unauthenticated', message: 'Sign in before importing a webpage.' } });
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).length !== 1 || typeof body.url !== 'string') return res.status(400).json({ success: false, error: { code: 'invalid_request', message: 'Provide one webpage URL.' } });
    return res.status(200).json(await retrieveWebsiteText(body.url));
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'retrieval_failed';
    const status = STATUS_BY_CODE[code] || 502;
    console.error('[WEBSITE_TEXT_RETRIEVAL_FAILED]', { code, status });
    return res.status(status).json({ success: false, error: { code, message: error?.message || 'The webpage could not be retrieved.' } });
  }
};
