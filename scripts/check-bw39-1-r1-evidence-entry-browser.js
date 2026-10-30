'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { fixture } = require('./fixtures/bw36-20-database');
const QUESTION = 'Which of our current social media posts have unclear or weak calls to action, and why? Identify the specific Canvas nodes and show their supporting evidence.';
async function main() {
  const sql = await fixture({ goals: true, signedSession: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await require('./fixtures/home-browser')(browser)({ empty: true });
    const p = f.page;
    sql.env.AUTH_SECRET = 'fictional-r1-browser-secret';
    const email = await p.evaluate(() => state.user.email), board = f.r.db.boards[0];
    sql.user = { email };
    await sql.pg.query('UPDATE app_identities SET canonical_email=$1', [email]);
    await sql.pg.query('UPDATE board_editors SET board_id=$1,email=$2', [board.id, email]);
    await sql.pg.query('UPDATE boards SET id=$1,canvas_json=$2::jsonb,updated_at=$3', [board.id, JSON.stringify(board.canvas_json), board.updated_at]);
    let provider, requests = 0;
    await p.route('**/api/ai-brain/advice', async route => {
      requests++; sql.providerResponse = provider;
      const result = await sql.invoke(route.request().postDataJSON());
      return route.fulfill({ status: result.statusCode, json: result.body });
    });
    const boot = async locale => {
      await p.reload(); await p.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating);
      await p.evaluate(locale => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); state.uiLanguage = language.setUiLanguage(locale); setAppMode('canvas'); setActiveView('ai_brain'); }, locale);
    };
    const ask = async () => { await p.locator('#ai-brain-question').fill(QUESTION); await p.locator('#ai-brain-form [type=submit]').click(); await p.waitForFunction(() => state.aiBrain.status !== 'loading'); };
    for (const locale of ['en', 'de']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 1440]) {
      await p.setViewportSize({ width, height: 812 }); await boot(locale);
      await p.evaluate(theme => { window.FunklixTheme.setPreference(theme); renderAiBrain(); }, theme);
      assert.equal(await p.locator('#ai-brain-mode').inputValue(), 'general');
      assert.equal(await p.locator('#ai-brain-mode option').count(), 6, 'all Advice modes preserved');
      assert.equal(await p.locator('#ai-brain-mode option[value=analyze_social_ctas]').textContent(), locale === 'de' ? 'Social-Posts prüfen' : 'Review social posts');
      assert((await p.locator('#ai-brain-mode-guidance').textContent()).includes(locale === 'de' ? 'Canvas-Belege' : 'Canvas evidence'));
      const before = requests;
      await p.locator('#ai-brain-mode').selectOption('analyze_social_ctas');
      assert.equal(requests, before, 'selection never triggers inference');
      assert.equal(await p.locator('#ai-brain-mode-description').textContent(), locale === 'de' ? 'Verbesserungsmöglichkeiten finden und zugehörige Canvas-Nodes ansehen.' : 'Find improvement opportunities and see supporting Canvas nodes.');
      const select = p.locator('#ai-brain-mode'); await select.focus(); assert(await select.evaluate(n => n === document.activeElement));
      assert(await p.locator('.ai-brain-focus').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      provider = { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } };
      await ask(); assert.equal(await p.evaluate(() => state.aiBrain.messages.at(-1).errorCode), 'evidence_response_incomplete');
      assert((await p.locator('.is-user').last().textContent()).includes(locale === 'de' ? 'nicht abgeschlossen' : 'did not finish'));
      assert.equal(requests, before + 1); assert.equal(await p.locator('.ai-brain-evidence-card').count(), 0);
      // No automatic retry after displaying or focusing the failed turn.
      await p.locator('[data-ai-brain-retry]').focus(); assert.equal(requests, before + 1);
    }
    for (const locale of ['en', 'de']) for (const [payload, code, copy] of [
      [{ output_text: '{broken' }, 'evidence_response_format', ['unusable format', 'unbrauchbaren Format']],
      [{ output_text: JSON.stringify({ answer: 'PRIVATE_COPY', findings: [], extra: true }) }, 'evidence_response_format', ['unusable format', 'unbrauchbaren Format']],
      [{ output: [] }, 'evidence_response_empty', ['returned no review', 'keine Prüfung']],
      [{ output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'PRIVATE_COPY' }] }] }, 'evidence_response_refusal', ['could not answer', 'nicht beantworten']]
    ]) {
      await boot(locale); await p.locator('#ai-brain-mode').selectOption('analyze_social_ctas'); provider = payload;
      const before = requests; await ask(); assert.equal(requests, before + 1);
      assert.equal(await p.evaluate(() => state.aiBrain.messages.at(-1).errorCode), code);
      assert((await p.locator('.is-user').last().textContent()).includes(copy[locale === 'de' ? 1 : 0]));
      assert(!(await p.locator('#ai-brain-transcript').textContent()).includes('PRIVATE_COPY'));
      assert.equal(await p.locator('.is-advisor:not(.is-loading)').count(), 0);
    }
    await boot('en'); await p.locator('#ai-brain-mode').selectOption('analyze_social_ctas');
    provider = { status: 'completed', output_text: '', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ answer: 'The available copy is insufficient for a supported finding.', findings: [] }) }] }] };
    await ask(); assert.equal(await p.evaluate(() => state.aiBrain.status), 'success', 'empty aggregate preserves valid assistant blocks in real browser');
    await boot('en'); provider = { output_text: 'Ordinary advice remains conversational.' }; await ask();
    assert.equal(await p.evaluate(() => state.aiBrain.messages.at(-1).adviceMode), 'general', 'even exact question does not silently switch contracts');
    assert.equal(await p.evaluate(() => state.aiBrain.messages.at(-1).answer), provider.output_text);
    assert.deepEqual(f.errors, []); await p.close();
    console.log('PASS real Advice route failure feedback EN/DE; unchanged six modes and explicit routing; friendly entry in Light/Dark at 320/375/1440, keyboard access, no overflow or automatic inference/retry');
  } finally { await browser.close(); await sql.pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
