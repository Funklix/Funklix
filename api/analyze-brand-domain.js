const { getSessionUser } = require('./_auth-session');
const { retrieveWebsiteText } = require('./_website-retrieval');
const { extractBrandProjection, stableBound, MAX_PROVIDER_CONTEXT } = require('./_html-text-extractor');
const { rankLogoCandidates, discoverLogo } = require('./_brand-logo');
const { getBrandAccess, isBrandId } = require('./_brand-access');
const { createHash } = require('crypto');

const STATUS_BY_CODE = {
  invalid_url: 400, unsupported_scheme: 400, credentials_not_allowed: 400, invalid_host: 400, port_not_allowed: 400,
  unsafe_destination: 400, dns_failed: 502, unsupported_content_type: 415, unsupported_encoding: 415, invalid_encoding: 422,
  response_too_large: 413, decompressed_too_large: 413, parse_limit: 422, empty_content: 422, timeout: 504,
  request_cancelled: 499, too_many_redirects: 502, redirect_loop: 502, invalid_redirect: 502, http_error: 502
};

function normalizeDomainUrl(value) {
  const trimmed = String(value || '').trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function validSuggestions(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.brandCore === 'string' && Array.isArray(value.toneOfVoice)
    && Array.isArray(value.messagingPillars) && typeof value.valueProposition === 'string'
    && Array.isArray(value.personas) && value.brandAssets && typeof value.brandAssets === 'object';
}

async function analyzeBrandDomain(domainUrl, dependencies = {}) {
  const retrieve = dependencies.retrieveWebsiteText || retrieveWebsiteText;
  const providerFetch = dependencies.fetch || fetch;
  const website = await retrieve(normalizeDomainUrl(domainUrl), { includeHtml: true });
  const normalized = website.source.url;
  const projection = extractBrandProjection(website.internalHtml, { maxProviderContext: MAX_PROVIDER_CONTEXT });
  if (projection.providerContext.length < 80) { const error = new Error('The webpage contains too little readable brand content.'); error.code = 'empty_content'; throw error; }
  const baseUrl = new URL(normalized);
  const absolute = (candidate) => { try { const value = new URL(candidate, baseUrl); return value.origin === baseUrl.origin ? value.href : ''; } catch { return ''; } };
  const rankedLogoCandidates = rankLogoCandidates(website.internalHtml, normalized);
  const providerContext = stableBound([`URL: ${normalized}`, `Title: ${projection.title}`, ...projection.metadata, ...projection.sections], MAX_PROVIDER_CONTEXT).text;
  const prompt = `Analyze this bounded semantic website projection and produce a concise Brand Brain JSON object. Return raw JSON only with exactly these keys: {"brandCore":"","toneOfVoice":[],"messagingPillars":[],"valueProposition":"","personas":[],"contentGuidelines":[],"dosAndDonts":{"dos":[],"donts":[]},"brandVoiceExamples":{"good":"","avoid":""},"keywords":[],"brandAssets":{"domain":"","logo":"","colors":[],"typography":"","references":[]}}. Keep arrays concise (3-8); persona entries are {"name":"","note":""}; be conservative when evidence is absent.\nWebsite context:\n${providerContext}`;
  const aiRes = await providerFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${dependencies.apiKey || process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4.1-mini', temperature: 0.3, messages: [{ role: 'user', content: prompt }] })
  });
  if (!aiRes.ok) { const error = new Error('The analysis provider is temporarily unavailable.'); error.code = 'provider_unavailable'; throw error; }
  const rawText = (await aiRes.json())?.choices?.[0]?.message?.content || '';
  const first = rawText.indexOf('{'); const last = rawText.lastIndexOf('}'); let parsed;
  try { parsed = JSON.parse(first >= 0 && last > first ? rawText.slice(first, last + 1) : ''); } catch { const error = new Error('The analysis provider returned an invalid response.'); error.code = 'invalid_analysis_response'; throw error; }
  if (!validSuggestions(parsed)) { const error = new Error('The analysis provider returned an invalid response.'); error.code = 'invalid_analysis_response'; throw error; }
  // Brand Core never becomes a competing logo authority. The authenticated Brand
  // mutation may consume the already-fetched HTML and persist the ranked candidate.
  parsed.brandAssets = { ...parsed.brandAssets, domain: parsed.brandAssets.domain || normalized, logo: '' };
  let logoDiscovery = { status: rankedLogoCandidates.length ? 'candidate_found' : 'not_found', candidateCount: rankedLogoCandidates.length };
  if (dependencies.previewLogo) {
    // Reuse the fetched page and BW-36.12 image safety. No object/metadata write.
    let found;
    try { found = await (dependencies.discoverLogo || discoverLogo)(normalized, {
      retrieveWebsiteText: async () => website, retrievePublicImage: dependencies.retrievePublicImage, logoOnly: true
    }); } catch { found = { status: 'not_found' }; }
    logoDiscovery = found.status === 'found' ? {
      status: 'candidate_found', candidateCount: 1, candidate_url: found.candidate.url,
      mime_type: found.image.mimeType, image_base64: found.image.buffer.toString('base64'),
      image_sha256: createHash('sha256').update(found.image.buffer).digest('hex')
    } : { status: 'not_found', candidateCount: 0 };
  }
  return { suggestions: parsed, logoDiscovery, source: { url: normalized, sections: projection.sections.length, truncated: projection.truncated } };
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });
  res.setHeader('Cache-Control', 'private, no-store');
  const user = getSessionUser(req);
  if (!user?.email) return res.status(401).json({ error: { code: 'unauthenticated' } });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: { code: 'provider_unavailable' } });
  const domainUrl = req.body?.domainUrl;
  if (typeof domainUrl !== 'string' || !domainUrl.trim()) return res.status(400).json({ error: { code: 'invalid_url' } });
  try {
    const brandId = req.body?.brandId;
    if (brandId !== undefined) {
      if (!isBrandId(brandId)) return res.status(400).json({ error: { code: 'invalid_brand' } });
      const { brand, access } = await getBrandAccess(brandId, user, { columns: 'id' });
      if (!brand || !access.canEditCanonicalBrand) return res.status(403).json({ error: { code: 'permission_denied' } });
    }
    return res.status(200).json(await analyzeBrandDomain(domainUrl, { previewLogo: brandId !== undefined }));
  }
  catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'extraction_failed';
    console.error('[BRAND_DOMAIN_ANALYSIS_FAILED]', { code, stage: error?.diagnostics?.stage || 'analysis' });
    return res.status(STATUS_BY_CODE[code] || (code === 'provider_unavailable' ? 502 : 500)).json({ error: { code } });
  }
}

module.exports = handler;
module.exports.analyzeBrandDomain = analyzeBrandDomain;
module.exports.normalizeDomainUrl = normalizeDomainUrl;
module.exports.validSuggestions = validSuggestions;
