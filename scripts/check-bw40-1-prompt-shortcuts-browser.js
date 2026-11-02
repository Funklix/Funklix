'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const expected = {
  analyze_social_ctas: [['Improve my calls to action', 'Review my social posts', 'Make the next step clearer'], ['Meine Handlungsaufforderungen verbessern', 'Meine Social-Posts prüfen', 'Den nächsten Schritt klarer machen']],
  general: [['What should I improve?', 'Help me clarify my goal', 'What should I focus on?'], ['Was kann ich verbessern?', 'Hilf mir, mein Ziel zu klären', 'Worauf sollte ich mich konzentrieren?']],
  review_strategy: [['Check campaign alignment', 'Review my campaign priorities', 'What should I improve first?'], ['Die Ausrichtung meiner Kampagne prüfen', 'Meine Kampagnenprioritäten prüfen', 'Was sollte ich zuerst verbessern?']],
  explore_ideas: [['Give me 3 campaign ideas', 'Find a fresh angle', 'Suggest a creative hook'], ['Gib mir 3 Kampagnenideen', 'Eine neue Perspektive finden', 'Einen kreativen Aufhänger vorschlagen']],
  find_gaps: [['Find gaps in my Canvas', 'What assumptions should I check?', 'What evidence is missing?'], ['Lücken in meinem Canvas finden', 'Welche Annahmen sollte ich prüfen?', 'Welche Belege fehlen?']],
  evaluate_options: [['Compare my campaign options', 'Which option fits my goal?', 'Explain the main trade-offs'], ['Meine Kampagnenoptionen vergleichen', 'Welche Option passt zu meinem Ziel?', 'Die wichtigsten Zielkonflikte erklären']]
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await require('./fixtures/home-browser')(browser)({ empty: true });
    const p = f.page, requests = [], surfaces = new Set();
    await p.route('**/api/ai-brain/advice', route => {
      const body = route.request().postDataJSON(); requests.push(body);
      return route.fulfill({ json: { answer: 'A clear next step helps your campaign.', nodeReferences: [], context: { response_language: body.response_language }, disclaimer: 'Advice' } });
    });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setAppMode('canvas'); setActiveView('ai_brain'); });
    assert.deepEqual(await p.locator('#ai-brain-mode option').evaluateAll(nodes => nodes.map(n => n.value)), Object.keys(expected));
    for (const width of [1440, 375]) for (const zoom of [1, 2]) for (const theme of ['light', 'dark']) for (const language of ['en', 'de']) {
      await p.setViewportSize({ width, height: 1000 });
      await p.evaluate(({ theme, language, zoom }) => { document.documentElement.dataset.theme = theme; document.documentElement.style.zoom = zoom; state.uiLanguage = window.FunklixLanguage.setUiLanguage(language); renderAiBrain(); }, { theme, language, zoom });
      const input = p.locator('#ai-brain-question'), chips = p.locator('.ai-brain-suggestion');
      await input.fill('My own question');
      for (const [mode, prompts] of Object.entries(expected)) {
        await p.locator('#ai-brain-mode').selectOption(mode);
        assert.equal(await input.inputValue(), 'My own question', 'Changing mode preserves manually typed text');
        assert.deepEqual(await chips.allTextContents(), prompts[language === 'de' ? 1 : 0]);
        for (let i = 0; i < 3; i++) {
          await chips.nth(i).focus(); await p.keyboard.press(i % 2 ? 'Space' : 'Enter');
          assert.equal(await input.inputValue(), prompts[language === 'de' ? 1 : 0][i]);
          assert.equal(await input.evaluate(node => document.activeElement === node), true);
          await input.press('End'); await input.press('!');
          assert((await input.inputValue()).endsWith('!'), 'Inserted text remains editable');
          await input.fill('My own question');
          assert(await chips.nth(i).evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'No clipped chip text');
        }
        assert(await p.locator('.ai-brain-suggestions').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      }
      surfaces.add(await chips.first().evaluate(node => getComputedStyle(node).backgroundColor));
      assert.equal(requests.length, 0, 'Displaying/changing/selecting chips never submits');
    }
    assert.equal(surfaces.size, 2, 'Native Light/Dark surfaces');
    await p.evaluate(() => { document.documentElement.style.zoom = 1; });
    // The mobile keyboard reduces usable height. Keep every shortcut reachable
    // in one horizontal row and leave the existing Ask button above controls.
    await p.setViewportSize({ width: 375, height: 520 });
    await p.evaluate(() => renderAiBrain());
    for (let i = 0; i < 3; i++) {
      const chip = p.locator('.ai-brain-suggestion').nth(i);
      await chip.focus();
      await p.waitForFunction(index => {
        const node = document.querySelectorAll('.ai-brain-suggestion')[index];
        if (document.activeElement !== node) return false;
        const r = node.getBoundingClientRect(), group = node.parentElement.getBoundingClientRect();
        return r.left >= group.left - 1 && r.right <= group.right + 1;
      }, i);
      await p.keyboard.press('Enter');
      assert.equal(await p.locator('#ai-brain-question').inputValue(), await chip.textContent());
    }
    assert.equal(requests.length, 0);
    await p.setViewportSize({ width: 375, height: 1000 });
    await p.evaluate(() => renderAiBrain());
    await p.locator('#ai-brain-mode').selectOption('general');
    await p.locator('.ai-brain-suggestion').first().click();
    const edited = (await p.locator('#ai-brain-question').inputValue()) + ' Please explain.';
    await p.locator('#ai-brain-question').fill(edited);
    await p.locator('#ai-brain-form [type=submit]').click();
    await p.waitForFunction(() => state.aiBrain.status === 'success');
    assert.equal(requests.length, 1); assert.equal(requests[0].question, edited);
    assert.equal(requests[0].advice_mode, 'general');
    assert.equal(f.errors.length, 0);
    console.log('PASS BW-40.1 all six focuses, exact EN/DE copy, insert/edit without submit, draft preservation, keyboard, Light/Dark, desktop/mobile, 200% zoom and reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
