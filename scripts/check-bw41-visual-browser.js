'use strict';
// Real application DOM and event handlers, with local authenticated fixtures only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await require('./fixtures/home-browser')(browser)({ empty: true, prepare(r) {
      r.db.boards[0].canvas_json.nodes = [{ id: 'fictional-content', type: 'Content', title: 'Workshop invitation', content: 'Join our fictional workshop.', status: 'Draft', position: { x: 180, y: 240 }, images: [], tags: [], postits: [], variants: [], reactions: {}, social: { platform: '', caption: '', hashtags: [] } }];
    } });
    const p = f.page;
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setSidebarCollapsed(true); setAppMode('canvas'); setActiveView('ai_brain'); state.aiBrain.adviceMode = 'explore_ideas'; renderAiBrain(); });
    const original = await p.evaluate(() => JSON.stringify([state.nodes, state.edges, state.brandCore, state.isDirty]));
    const surfaces = new Set();
    fs.mkdirSync('work/bw41', { recursive: true });
    for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [1366, 768], [768, 1024], [375, 812], [320, 740]]) for (const zoom of (width >= 768 ? [1, 2] : [1])) {
      await p.evaluate(() => { document.documentElement.style.zoom = 1; });
      // Browser zoom halves the CSS viewport; CSS `zoom` leaves vh unchanged.
      await p.setViewportSize({ width: width / zoom, height: height / zoom });
      await p.evaluate(({ theme, zoom }) => { document.documentElement.dataset.theme = theme; renderAiBrain(); }, { theme, zoom });
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await p.waitForFunction(() => {
        const v = document.querySelector('#ai-brain-view');
        return v.getBoundingClientRect().bottom <= innerHeight + 1;
      });
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow ${theme}/${width}/${zoom}`);
      for (const selector of ['.ai-brain-composer', '#ai-brain-question', '.ai-brain-header', '.ai-brain-focus']) {
        assert(await p.locator(selector).evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${selector} overflow ${theme}/${width}/${zoom}`);
      }
      const submit = p.locator('#ai-brain-form [type=submit]');
      await submit.focus();
      assert(await submit.evaluate(n => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }), `Ask reachable ${width}/${zoom}`);
      assert(await submit.evaluate(n => getComputedStyle(n).outlineStyle !== 'none'), 'Visible keyboard focus');
      const input = p.locator('#ai-brain-question');
      await input.fill('My editable draft');
      await p.evaluate(() => renderAiBrain());
      assert.equal(await input.inputValue(), 'My editable draft');
      await p.locator('#ai-brain-transcript').evaluate(n => { n.scrollTop = 0; });
      assert(await p.locator('.ai-brain-empty').evaluate(n => n.getBoundingClientRect().top >= n.parentElement.getBoundingClientRect().top - 1), `Welcome starts inside scrollport ${width}/${zoom}`);
      assert.equal(await p.locator('.ai-brain-empty').evaluate(n => getComputedStyle(n).animationName), 'none');
      surfaces.add(await p.locator('.ai-brain-composer').evaluate(n => getComputedStyle(n).backgroundColor));
      if (zoom === 1 && [1440, 375].includes(width)) await p.screenshot({ path: `work/bw41/${theme}-${width}.png` });
    }
    assert.equal(surfaces.size, 2, 'Theme-native surfaces');
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.evaluate(() => { document.documentElement.style.zoom = 1; document.documentElement.dataset.theme = 'light'; renderAiBrain(); });
    let release, calls = 0;
    await p.route('**/api/ai-brain/advice', async route => {
      calls++;
      const body = route.request().postDataJSON();
      if (calls === 1) { await new Promise(resolve => { release = resolve; }); return route.fulfill({ status: 503, json: { error: { code: 'provider_failed' } } }); }
      return route.fulfill({ json: { answer: '## A clear next step\nStart with **one invitation**.\n\n- Explain the benefit.\n- Keep the action specific.', nodeReferences: [], context: { response_language: body.response_language }, disclaimer: 'Advice' } });
    });
    await p.locator('#ai-brain-question').fill('Help me plan the invitation');
    await p.locator('#ai-brain-form [type=submit]').click();
    await p.waitForFunction(() => state.aiBrain.status === 'loading');
    assert(await p.locator('#ai-brain-form [type=submit]').isDisabled());
    await p.locator('.ai-brain-message.is-loading').waitFor();
    await p.screenshot({ path: 'work/bw41/loading.png' });
    release();
    await p.locator('[data-ai-brain-retry]').waitFor();
    await p.screenshot({ path: 'work/bw41/error.png' });
    await p.locator('[data-ai-brain-retry]').click();
    await p.waitForFunction(() => state.aiBrain.status === 'success');
    assert.equal(await p.locator('.ai-brain-formatted-answer h4').textContent(), 'A clear next step');
    for (const theme of ['light', 'dark']) for (const width of [1440, 375, 320]) {
      await p.setViewportSize({ width, height: 900 });
      await p.evaluate(theme => { document.documentElement.dataset.theme = theme; renderAiBrain(); }, theme);
      await p.locator('#ai-brain-question').fill('What should I try next?');
      await p.locator('#ai-brain-form [type=submit]').click();
      await p.waitForFunction(() => state.aiBrain.status === 'success');
      assert(await p.locator('.ai-brain-message.is-advisor').last().evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      await p.screenshot({ path: `work/bw41/active-${theme}-${width}.png` });
    }
    assert.equal(calls, 8, 'One failed request, one retry, six follow-ups');
    assert.equal(await p.evaluate(() => JSON.stringify([state.nodes, state.edges, state.brandCore, state.isDirty])), original, 'Presentation leaves domain state untouched');
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.writes, []);
    console.log('PASS BW-41 actual app: Light/Dark, empty/active, 1440/1366/768/375/320, 200% zoom, keyboard focus, reduced motion, draft preservation, pending/error/retry, Markdown and multi-turn; zero domain writes. Screenshots: work/bw41.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
