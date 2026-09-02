#!/usr/bin/env node
const assert = require('assert');
const { Readable } = require('stream');
const zlib = require('zlib');
const imageStoragePath = require.resolve('../api/_image-storage');
require.cache[imageStoragePath] = { id:imageStoragePath, filename:imageStoragePath, loaded:true, exports:{ uploadImageBuffer:async()=>({ imageUrl:'fixture', mimeType:'image/png' }) } };
const { extractBrandProjection, extractHtmlText, MAX_PROVIDER_CONTEXT } = require('../api/_html-text-extractor');
const { readBounded, MAX_RESPONSE_BYTES, MAX_DECOMPRESSED_BYTES, MAX_REDIRECTS, TIMEOUT_MS } = require('../api/_website-retrieval');
const { normalizeDomainUrl, analyzeBrandDomain } = require('../api/analyze-brand-domain');

function response(body, headers = {}) { const stream = Readable.from([body]); stream.headers = headers; stream.destroy = stream.destroy.bind(stream); return stream; }
function validAnalysis() { return { brandCore:'Purpose-led industrial partner', toneOfVoice:['clear'], messagingPillars:['quality'], valueProposition:'Reliable products', personas:[{name:'Buyer',note:'B2B'}], contentGuidelines:[], dosAndDonts:{dos:[],donts:[]}, brandVoiceExamples:{good:'',avoid:''}, keywords:[], brandAssets:{domain:'',logo:'',colors:[],typography:'',references:[]} }; }
(async () => {
  assert.strictEqual(normalizeDomainUrl('markmans.de'), 'https://markmans.de');
  assert.strictEqual(MAX_REDIRECTS, 5); assert.strictEqual(TIMEOUT_MS, 10000);
  const hydration = 'x'.repeat(1200000); const svg = 'y'.repeat(400000); const data = 'A'.repeat(300000);
  const html = `<!doctype html><html><head><title>Markmans — Engineering confidence</title><meta name="description" content="A dependable partner for modern industry"><link rel="canonical" href="https://markmans.de/"></head><body><nav>Products About Company Mission Products About</nav><script type="application/json">${hydration}</script><style>${hydration.slice(0,200000)}</style><svg>${svg}</svg><img src="data:image/png;base64,${data}" alt="embedded"><main><h1>Engineering confidence</h1><section><h2>Our mission</h2><p>We help industrial teams build dependable products for their customers.</p></section><section><h2>Our services</h2><p>Strategy, design and engineering for ambitious organizations.</p></section></main><div class="cookie-consent">Accept tracking</div><footer>Repeated footer Repeated footer</footer></body></html>`;
  assert(html.length > 1024 * 1024 && html.length < MAX_RESPONSE_BYTES, 'fixture reproduces old 1 MiB failure boundary');
  const projection = extractBrandProjection(html, { maxTextLength: 5000, maxProviderContext: 1000 });
  assert(projection.text.includes('Engineering confidence') && projection.text.includes('Our mission') && projection.metadata[0].includes('dependable partner'));
  assert(!projection.text.includes('xxxxx') && !projection.text.includes('yyyyy') && !projection.text.includes('Accept tracking') && !projection.assets.some(a => /^data:/.test(a.url)));
  assert(projection.providerContext.length <= 1000 && projection.sections.length <= 60);
  const units = '<h1>First complete block</h1><p>Second complete block has more words</p><p>Third block</p>';
  const bounded = extractBrandProjection(units, { maxTextLength: 42, maxProviderContext: 42 });
  assert.strictEqual(bounded.text, 'First complete block'); assert.strictEqual(bounded.truncated, true);
  assert.throws(() => extractBrandProjection('<div>x</div>'.repeat(20), { maxParsedNodes: 3 }), e => e.code === 'parse_limit');
  assert.throws(() => extractBrandProjection('<script>x</script>'), e => e.code === 'empty_content');
  const small = '<title>Small</title><h1>Hello brand</h1><p>Useful copy remains.</p>';
  assert.strictEqual(extractHtmlText(small).text, 'Hello brand\nUseful copy remains.');
  await assert.rejects(readBounded(response(Buffer.alloc(20), {'content-length':'20'}), 10, 30, {}), e => e.code === 'response_too_large');
  const bomb = zlib.gzipSync(Buffer.alloc(100));
  await assert.rejects(readBounded(response(bomb, {'content-encoding':'gzip'}), 1000, 20, {}), e => ['decompressed_too_large','invalid_encoding'].includes(e.code));
  await assert.rejects(readBounded(response(Buffer.from('x'), {'content-encoding':'compress'}), 10, 10, {}), e => e.code === 'unsupported_encoding');
  assert(MAX_DECOMPRESSED_BYTES > MAX_RESPONSE_BYTES && MAX_PROVIDER_CONTEXT === 16000);

  let providerCalls = 0;
  const fetch = async () => { providerCalls++; return { ok:true, json:async()=>({choices:[{message:{content:JSON.stringify(validAnalysis())}}]}) }; };
  const retrieveWebsiteText = async url => ({ source:{url:`${url}/`}, internalHtml:html });
  const success = await analyzeBrandDomain('markmans.de', { retrieveWebsiteText, fetch, skipLogo:true, apiKey:'test' });
  assert.strictEqual(providerCalls, 1); assert.strictEqual(success.suggestions.brandCore, 'Purpose-led industrial partner'); assert(success.source.sections > 0);
  providerCalls = 0;
  await assert.rejects(analyzeBrandDomain('markmans.de', { retrieveWebsiteText:async()=>{const e=new Error();e.code='response_too_large';throw e;}, fetch, skipLogo:true }), e => e.code === 'response_too_large');
  assert.strictEqual(providerCalls, 0, 'provider is gated behind safe retrieval and extraction');
  await assert.rejects(analyzeBrandDomain('markmans.de', { retrieveWebsiteText:async()=>({source:{url:'https://markmans.de/'},internalHtml:'<script>x</script>'}), fetch, skipLogo:true }), e => e.code === 'empty_content');
  assert.strictEqual(providerCalls, 0);

  const app = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const handler = app.slice(app.indexOf('let brandDomainImportAttempt'), app.indexOf('async function replacePrimaryBrandLogo'));
  assert(!handler.includes('alert('), 'real Analyze website event path has no native alert');
  assert(handler.includes('brandDomainImportAttempt') && handler.includes('isCurrent()') && handler.includes('finally'));
  assert(app.includes('addEventListener("click", analyzeBrandDomainFromEditor)'), 'real editor event wiring remains connected');
  assert(handler.includes('saveBrandBrainState();\n    await saveBoardToServer("brand-domain-analysis")'), 'successful projection uses existing atomic apply/persist path');
  assert(handler.includes('English') === false); // Copy is rendered, not provider-controlled.
  assert(handler.includes('Website ist nicht erreichbar') && handler.includes('website is unavailable'));
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'styles.css'), 'utf8');
  assert(css.includes('.bc-domain-import-status') && css.includes('html[data-theme="dark"] .bc-domain-import-status'));
  console.log('BW-26.6.3 bounded large Brand Core website import checks passed.');
})().catch(error => { console.error(error); process.exit(1); });
