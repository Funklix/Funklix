#!/usr/bin/env node
const assert = require('assert');
const { validateWebsiteUrl, isPublicAddress, resolvePublicAddresses } = require('../api/_website-url-policy');

(async () => {
assert.strictEqual(validateWebsiteUrl('https://example.com/about').href, 'https://example.com/about');
for (const url of ['/about', 'ftp://example.com', 'https://user:pass@example.com', 'http://localhost', 'http://127.0.0.1', 'http://10.2.3.4', 'http://169.254.169.254', 'http://[::1]', 'http://[fe80::1]', 'http://[fd00::1]', 'http://[::ffff:10.0.0.1]', 'http://2130706433', 'https://example.com:8443']) {
  assert.throws(() => validateWebsiteUrl(url), undefined, url);
}
assert.strictEqual(isPublicAddress('8.8.8.8'), true);
assert.strictEqual(isPublicAddress('2606:4700:4700::1111'), true);
assert.strictEqual(isPublicAddress('100.64.0.1'), false);
assert.deepStrictEqual(await resolvePublicAddresses('example.com', async () => [{ address: '93.184.216.34', family: 4 }]), [{ address: '93.184.216.34', family: 4 }]);
await assert.rejects(resolvePublicAddresses('evil.test', async () => [{ address: '10.0.0.1', family: 4 }]));
await assert.rejects(resolvePublicAddresses('mixed.test', async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]));
console.log('Website URL policy checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
