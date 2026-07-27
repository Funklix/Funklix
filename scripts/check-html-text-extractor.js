#!/usr/bin/env node
const assert = require('assert');
const { extractHtmlText } = require('../api/_html-text-extractor');

const fixture = `<!doctype html><html><head><title> Example &amp; Co </title><style>bad</style><script>global.evil=true</script></head><body>
<nav>Menu repeated</nav><main><h1>Our Story</h1><p>We solve <strong>real</strong> problems.</p><ul><li>First proof</li><li>Second proof</li></ul>
<form><label>secret</label><input value="x"></form><p hidden>hidden</p><div aria-hidden="true">also hidden</div></main><footer>footer</footer></body></html>`;
const first = extractHtmlText(fixture);
assert.deepStrictEqual(first, extractHtmlText(fixture));
assert.strictEqual(first.title, 'Example & Co');
assert.strictEqual(first.text, 'Our Story\nWe solve real problems.\nFirst proof\nSecond proof');
assert(!first.text.includes('bad') && !first.text.includes('evil') && !first.text.includes('secret') && !first.text.includes('<'));
const bounded = extractHtmlText('<h1>Heading</h1><p>abcdefghij</p>', { maxTextLength: 10 });
assert.strictEqual(bounded.truncated, true); assert.strictEqual(bounded.text.length <= 10, true);
assert.throws(() => extractHtmlText('<script>alert(1)</script><form>x</form>'), (error) => error.code === 'empty_content');
console.log('HTML text extraction checks passed.');
