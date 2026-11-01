'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { fixture } = require('./fixtures/bw36-20-database');
const REV = '2026-10-29T08:00:00.123Z';
(async () => {
  const sql = await fixture({ goals: true, signedSession: true });
  sql.env.AUTH_SECRET = 'fictional-bw40-browser-session';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await require('./fixtures/home-browser')(browser)({ empty: true, prepare(r) {
      r.db.boards[0].updated_at = REV;
      r.db.boards[0].canvas_json.nodes = ['node-27', '7b910c24-8bda-42fb-b4a8-497f12c62c39'].map((id, i) => ({
        id, type: i ? 'Landing Page' : 'Content', title: 'Workshop invitation', content: 'Join our fictional community workshop.',
        status: 'Draft', position: { x: 180 + i * 600, y: 240 }, images: [], tags: [], postits: [], variants: [], reactions: {},
        social: { platform: '', caption: '', hashtags: [] }, landingPage: { headerClaim: 'Make together', cta: '', trust: '' }
      }));
    } });
    const p = f.page, boardId = f.r.db.boards[0].id, email = await p.evaluate(() => state.user.email);
    sql.user = { email };
    await sql.pg.query('UPDATE app_identities SET canonical_email=$1', [email]);
    await sql.pg.query('UPDATE board_editors SET board_id=$1,email=$2', [boardId, email]);
    await sql.pg.query('UPDATE boards SET id=$1,canvas_json=$2::jsonb,updated_at=$3', [boardId, JSON.stringify(f.r.db.boards[0].canvas_json), '2026-10-29T08:00:00.123456Z']);
    const resolver = sql.load('api/ai-brain/node-reference.js'), auth = sql.load('api/_auth-session.js');
    let opens = 0, writes = 0, denied = false, release = null, started = null;
    await p.route('**/api/ai-brain/advice', async route => {
      const body = route.request().postDataJSON();
      sql.answer = body.response_language === 'de'
        ? 'Ich würde Node #1 klarer auf das Ziel ausrichten. Node #1 braucht einen konkreten nächsten Schritt.\n\nAuch Node #2 sollte die Einladung erklären.'
        : 'I would clarify Node #1. Node #1 needs a concrete next step.\n\nThen align Node #2 with the invitation.';
      const result = await sql.invoke(body); return route.fulfill({ status: result.statusCode, json: result.body });
    });
    await p.route('**/api/ai-brain/node-reference', async route => {
      opens++;
      if (started) { started(); started = null; await new Promise(resolve => { release = resolve; }); }
      const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await resolver({ method: 'POST', body: route.request().postDataJSON(), headers: { cookie: 'funklix_session=' + auth.createSessionToken(sql.user) } }, res);
      return route.fulfill({ status: denied ? 409 : res.statusCode, json: denied ? { code: 'node_reference_unavailable' } : res.body });
    });
    await p.route('**/api/boards/*', route => {
      if (route.request().method() === 'GET') return route.fallback();
      writes++; return route.fulfill({ status: 500, json: { error: 'References must not write' } });
    });
    async function boot() {
      await p.reload(); await p.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating);
      await p.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setAppMode('canvas'); setActiveView('ai_brain'); });
    }
    async function ask() {
      await p.locator('#ai-brain-question').fill('Review this Canvas and identify improvements.');
      await p.locator('#ai-brain-form [type=submit]').click();
      await p.waitForFunction(() => state.aiBrain.status !== 'loading');
      assert.equal(await p.evaluate(() => state.aiBrain.status), 'success');
      await p.locator('[data-ai-brain-node-open="node-27"]').waitFor();
    }
    const stable = () => p.evaluate(() => JSON.stringify({ nodes: state.nodes, edges: state.edges, history: state.history, dirty: state.isDirty }));
    const themeSurfaces = new Set();
    for (const width of [1440, 375]) for (const theme of ['light', 'dark']) for (const language of ['en', 'de']) {
      await boot(); await p.setViewportSize({ width, height: 1000 });
      await p.evaluate(({ theme, language }) => { document.documentElement.dataset.theme = theme; state.uiLanguage = language; renderAiBrain(); }, { theme, language });
      await ask();
      assert.equal(await p.locator('.ai-brain-node-reference').count(), 2, 'Repeated reference deduplicated in section');
      assert.equal(await p.locator('.ai-brain-formatted-answer > p').count(), 2);
      const surface = await p.locator('.ai-brain-node-reference').first().evaluate(n => getComputedStyle(n).backgroundColor);
      assert.notEqual(surface, 'rgba(0, 0, 0, 0)', 'Reference stylesheet is loaded'); themeSurfaces.add(surface);
      assert((await p.locator('.ai-brain-node-reference').nth(1).textContent()).includes('Make together'), 'Native Landing Page preview');
      assert((await p.locator('.ai-brain-node-reference').first().textContent()).includes('Workshop invitation'));
      assert((await p.locator('.ai-brain-node-reference').first().textContent()).includes('fictional community'));
      assert((await p.locator('.ai-brain-node-reference').first().textContent()).includes(language === 'de' ? 'Im Canvas öffnen' : 'Open in Canvas'));
      assert(await p.locator('.ai-brain-node-reference').first().evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      const before = await stable(), inference = sql.calls.length, read = opens;
      const button = p.locator('[data-ai-brain-node-open="7b910c24-8bda-42fb-b4a8-497f12c62c39"]');
      await button.focus(); await p.keyboard.press(language === 'de' ? 'Space' : 'Enter');
      await p.waitForFunction(() => state.activeView === 'board' && state.selectedPrimary === '7b910c24-8bda-42fb-b4a8-497f12c62c39');
      assert.equal(await p.evaluate(() => state.selectedIds.size), 1);
      assert.equal(await p.evaluate(() => el.inputs.title.value), 'Workshop invitation');
      assert(await p.evaluate(() => !el.inspectorPanel.classList.contains('hidden')));
      assert.equal(await stable(), before); assert.equal(sql.calls.length, inference); assert.equal(opens, read + 1);
    }
    assert.equal(themeSurfaces.size, 2, 'Distinct native Light/Dark Canvas surfaces');
    await boot(); await ask();
    await p.evaluate(() => { state.aiBrain.messages.at(-1).answer = '## First\nNode #1.\n\nNode #1 again.\n\n- Node #2.\n- Node #2 again.\n\n## Second\nNode #1.'; renderAiBrain(); });
    assert.equal(await p.locator('.ai-brain-node-reference').count(), 3, 'Deduplicate paragraphs/lists within a section; allow reference after a new heading');
    assert.equal(await p.locator('.ai-brain-formatted-answer li').count(), 2, 'Advice list stays readable');
    for (const mutation of ['delete', 'board', 'workspace', 'permission']) {
      await boot(); await ask(); const before = opens;
      await p.evaluate(mutation => {
        if (mutation === 'delete') state.nodes = state.nodes.filter(n => n.id !== 'node-27');
        if (mutation === 'board') state.currentBoardId = '99999999-9999-4999-8999-999999999999';
        if (mutation === 'workspace') state.workspaceCatalog = { ...state.workspaceCatalog, generation: 999 };
        if (mutation === 'permission') state.boardAccess = { ...state.boardAccess, canEdit: false };
      }, mutation);
      await p.locator('[data-ai-brain-node-open="node-27"]').click();
      assert.equal(opens, before); assert.equal(await p.evaluate(() => state.activeView), 'ai_brain');
      assert(await p.locator('[role=status]').filter({ hasText: /unavailable|nicht verfügbar/ }).count());
    }
    await boot(); await ask(); denied = true;
    await p.locator('[data-ai-brain-node-open="node-27"]').click();
    await p.waitForFunction(() => state.aiBrain.messages.at(-1).nodeReferences.unavailable);
    assert.equal(await p.evaluate(() => state.activeView), 'ai_brain'); denied = false;
    // A scope change while click reauthorization is pending cannot navigate.
    await boot(); await ask();
    const pending = new Promise(resolve => { started = resolve; });
    await p.locator('[data-ai-brain-node-open="node-27"]').click(); await pending;
    await p.evaluate(() => { state.boardLoadGeneration++; }); release();
    await p.waitForFunction(() => state.aiBrain.messages.at(-1).nodeReferences.unavailable);
    assert.equal(await p.evaluate(() => state.activeView), 'ai_brain');
    assert.equal(writes, 0); assert.equal(f.errors.length, 0);
    assert(sql.queries.every(q => /^(SELECT|BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(q.sql)));
    console.log('PASS BW-40 browser production Advice/resolver + Canvas/Inspector; EN/DE, light/dark, desktop/mobile, keyboard, duplicates, similar titles, stale/deleted/wrong Board/Workspace/revoked/pending scope, no inference on click or writes');
  } finally { await browser.close(); await sql.pg.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
