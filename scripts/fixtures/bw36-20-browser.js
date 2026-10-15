'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
async function browserChecks() {
  const app = fs.readFileSync('app.js', 'utf8');
  const source = app.slice(app.indexOf('const AI_BRAIN_LEARNING_TEXT'), app.indexOf('function aiBrainRequestContextIdentity'));
  assert(source.includes('function renderAiBrainLearningContext'));
  assert(app.includes('renderAiBrainLearningContext(advisor, turn)'));
  assert(app.includes('approvedLearnings: data.context?.approved_learnings || null'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH
    || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const language of ['en', 'de']) for (const width of [1280, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      await page.route('**/*', route => {
        const url = new URL(route.request().url()); assert.equal(url.hostname, 'localhost');
        if (['/styles.css', '/ai-brain-learning-context.css'].includes(url.pathname)) return route.fulfill({ path: path.resolve('.' + url.pathname) });
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/ai-brain-learning-context.css"></head><body><main class="ai-brain-transcript" style="padding:16px"><article class="ai-brain-message is-advisor" style="max-width:100%"><span class="ai-brain-advisor-avatar">AI</span><strong>AI Brain</strong><p>Advice</p></article></main></body></html>' });
      });
      await page.goto('http://localhost/'); await page.addScriptTag({ content: source });
      const statement = '<img src=x onerror=alert(1)> Community participation. ' + 'ü'.repeat(2000);
      await page.evaluate(({ theme, language, statement }) => {
        document.documentElement.dataset.theme = theme;
        const advisor = document.querySelector('article');
        renderAiBrainLearningContext(advisor, { responseLanguage: language, approvedLearnings: { items: [] } });
        if (advisor.querySelector('details')) throw new Error('Empty disclosure');
        renderAiBrainLearningContext(advisor, { responseLanguage: language, approvedLearnings: { items: [{ ref: 'L1', statement, revision: '1' }], coverage: { partial: true } } });
      }, { theme, language, statement });
      const summary = page.locator('summary'); await summary.focus(); await page.keyboard.press('Enter');
      assert(await page.locator('details').evaluate(n => n.open), 'Keyboard opens disclosure');
      assert.equal(await page.locator('details li').textContent(), statement);
      assert.equal(await page.locator('details img, details a, details script').count(), 0);
      assert((await summary.textContent()).includes(language === 'de' ? 'Freigegebene' : 'Approved'));
      assert.equal(await page.locator('details p').count(), 2, 'Explanation and partial coverage');
      assert(await page.locator('details').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'Long text wraps');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}/${language}/${width}: no horizontal overflow`);
      await page.keyboard.press('Enter'); assert(!(await page.locator('details').evaluate(n => n.open)));
      await page.close();
    }
    console.log('PASS BW-36.20 browser: production disclosure DOM/CSS, EN/DE, light/dark, desktop/375px, keyboard, whole hostile statements as text, no empty section, partial coverage.');
  } finally { await browser.close(); }
}
module.exports = { browserChecks };
