const PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL_ENV);

function notConfiguredProvider() {
  return Object.freeze({
    name: 'not_configured',
    version: null,
    configured: false,
    async scan() { return { status: 'not_configured', reference: null, version: null }; }
  });
}

function createScannerProvider({ testProvider } = {}) {
  if (testProvider) {
    if (PRODUCTION || process.env.ALLOW_DOCUMENT_TEST_SCANNER !== 'true') throw new Error('test_scanner_forbidden');
    if (typeof testProvider.scan !== 'function') throw new Error('invalid_test_scanner');
    return Object.freeze({ name: 'injected_test_scanner', version: String(testProvider.version || 'test'), configured: true, scan: testProvider.scan.bind(testProvider) });
  }
  return notConfiguredProvider();
}

module.exports = { createScannerProvider, notConfiguredProvider };
