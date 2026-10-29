'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { fixture } = require('./fixtures/bw36-20-database');
const REV = '2026-10-29T08:00:00.123Z';
async function main() {
  const sql = await fixture({ goals: true, signedSession: true });
  sql.env.AUTH_SECRET = 'fictional-bw39-browser-session-secret';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await require('./fixtures/home-browser')(browser)({ empty: true, prepare(r) {
      r.db.boards[0].updated_at = REV;
      r.db.boards[0].canvas_json.nodes = ['first', 'exact-target', 'third'].map((id, i) => ({
        id, type: 'Social Media Posting', title: 'Content', content: 'Explore a new way of making together.',
        goal: 'Increase workshop registrations', status: 'Draft', position: { x: 180 + i * 600, y: 240 },
        images: [], tags: [], postits: [], variants: [], reactions: {},
        social: { platform: 'LinkedIn', caption: 'Explore a new way of making together.', preview: 'Discover more 🚀', cta: 'Discover more 🚀', hashtags: [] }
      }));
    } });
    const p = f.page;
    const boardId = f.r.db.boards[0].id, email = await p.evaluate(() => state.user.email);
    sql.user = { email };
    await sql.pg.query('UPDATE app_identities SET canonical_email=$1', [email]);
    await sql.pg.query('UPDATE board_editors SET board_id=$1,email=$2', [boardId, email]);
    await sql.pg.query('UPDATE boards SET id=$1,canvas_json=$2::jsonb,updated_at=$3', [boardId, JSON.stringify(f.r.db.boards[0].canvas_json), '2026-10-29T08:00:00.123456Z']);
    const resolver = sql.load('api/ai-brain/evidence-reference.js'), auth = sql.load('api/_auth-session.js');
    let opens = 0, writes = 0, fixtureSaves = 0, saveMode = null, held = null, adviceHeld = null, denied = false;
    const requests = [];
    await p.route('**/api/ai-brain/advice', async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      const de = body.response_language === 'de';
      sql.answer = JSON.stringify({ answer: de ? 'Ich würde das Ziel der Einladung konkreter benennen.' : 'I would name the destination more specifically.',
        findings: ['exact-target', 'first', 'third'].map(id => ({ title: de ? 'Die Einladung bleibt allgemein' : 'The invitation is broad',
          explanation: de ? 'Die Formulierung lässt das Ziel der Einladung im Verhältnis zum Anmeldeziel offen.' : 'The wording leaves the destination ambiguous relative to the registration goal.',
          evidence: [{ nodeId: id, field: 'social.preview', quote: 'Discover more 🚀' }, { nodeId: id, field: 'goal', quote: 'Increase workshop registrations' }] })) });
      const result = await sql.invoke(body);
      if (adviceHeld) { const hold = adviceHeld; adviceHeld = null; hold.started(); await hold.wait; }
      return route.fulfill({ status: result.statusCode, json: result.body });
    });
    await p.route('**/api/ai-brain/evidence-reference', async route => {
      opens++;
      if (held) { const hold = held; held = null; hold.started(); await hold.wait; }
      const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await resolver({ method: 'POST', body: route.request().postDataJSON(), headers: { cookie: 'funklix_session=' + auth.createSessionToken(sql.user) } }, res);
      return route.fulfill({ status: denied ? 409 : res.statusCode, json: denied ? { code: 'evidence_reference_unavailable' } : res.body }).catch(() => {});
    });
    await p.route('**/api/boards/*', async route => {
      if (route.request().method() === 'GET') return route.fallback();
      if (saveMode) {
        fixtureSaves++;
        if (saveMode === 'conflict') return route.fulfill({ status: 409, json: { error: 'Fixture revision conflict' } });
        const body = route.request().postDataJSON(), revision = new Date(Date.parse(REV) + fixtureSaves).toISOString();
        f.r.db.boards[0].canvas_json = body.canvas_json; f.r.db.boards[0].updated_at = revision;
        await sql.pg.query('UPDATE boards SET canvas_json=$1::jsonb,updated_at=$2', [JSON.stringify(body.canvas_json), revision]);
        return route.fulfill({ json: { id: boardId, updated_at: revision } });
      }
      writes++; return route.fulfill({ status: 500, json: { error: 'Opening must never write' } });
    });
    const boot = async () => {
      await p.reload(); await p.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating);
      await p.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); setAppMode('canvas'); setActiveView('ai_brain'); });
    };
    const ask = async () => {
      await p.locator('#ai-brain-mode').selectOption('analyze_social_ctas');
      await p.locator('#ai-brain-question').fill('Which existing Social posts have unclear CTAs, and why?');
      await p.locator('#ai-brain-form [type=submit]').click();
      await p.waitForFunction(() => state.aiBrain.status !== 'loading');
      assert.equal(await p.evaluate(() => state.aiBrain.status), 'success');
      await p.locator('[data-ai-brain-evidence-open="exact-target"]').waitFor();
    };
    const stable = () => p.evaluate(() => JSON.stringify({ nodes: state.nodes, edges: state.edges, history: state.history, dirty: state.isDirty, zoom: state.zoom }));
    await boot(); await ask();
    assert.equal(requests[0].canvas_revision, REV);
    assert.equal(await p.locator('.ai-brain-evidence-card:visible').count(), 1);
    assert.equal(await p.locator('.ai-brain-social-evidence>details').count(), 1);
    assert((await p.locator('.ai-brain-evidence-card').first().textContent()).includes('Saved field'));
    assert(!(await p.evaluate(() => state.aiBrain.messages.at(-1).answer)).includes('scopeRevision'));
    const natural = await p.evaluate(() => state.aiBrain.messages.at(-1).answer);
    const more = p.locator('.ai-brain-social-evidence>details>summary'); await more.focus(); await p.keyboard.press('Enter');
    assert.equal(await p.locator('.ai-brain-evidence-card:visible').count(), 3);
    await p.locator('.ai-brain-evidence-card').first().locator('details>summary').click();
    await p.locator('#ai-brain-question').fill('Keep my draft');
    await p.locator('#ai-brain-question').evaluate(node => { node.focus(); node.setSelectionRange(2, 6); });
    await p.evaluate(() => renderAiBrain());
    assert.equal(await p.locator('.ai-brain-evidence-card:visible').count(), 3);
    assert(await p.locator('.ai-brain-evidence-card').first().locator('details').evaluate(node => node.open));
    await more.focus(); await p.evaluate(() => renderAiBrain());
    assert(await more.evaluate(node => node === document.activeElement), 'evidence disclosure focus survives rerender');
    const before = await stable(), calls = sql.calls.length;
    await p.locator('[data-ai-brain-evidence-open="exact-target"]').click();
    await p.waitForFunction(() => state.activeView === 'board' && state.selectedPrimary === 'exact-target');
    await p.waitForFunction(() => document.activeElement === el.inputs.title);
    assert.equal(await stable(), before, 'Open changes only navigation, scroll and selection');
    assert.equal(await p.evaluate(() => el.inputs.caption.value), 'Explore a new way of making together.');
    assert.equal(await p.evaluate(() => [...state.selectedIds].join(',')), 'exact-target');
    assert.equal(opens, 1); assert.equal(sql.calls.length, calls); assert.equal(writes, 0);
    await p.evaluate(() => setActiveView('ai_brain'));
    assert.equal(await p.locator('#ai-brain-question').inputValue(), 'Keep my draft');
    assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n => [n.selectionStart, n.selectionEnd]), [2, 6]);
    assert.equal(await p.locator('#ai-brain-mode').inputValue(), 'analyze_social_ctas');
    assert.equal(await p.evaluate(() => state.aiBrain.messages.at(-1).answer), natural);
    console.log('PASS real projection → signed SQL Advice → mocked Responses → production cards → signed resolver → exact repeated-title ID, native Inspector/selection, zero writes/inference on Open, draft/caret/mode/disclosures/return');

    for (const mutate of [
      () => { state.user = { ...state.user }; }, () => { state.currentBoardId = 'other'; }, () => { state.boardLoadGeneration++; },
      () => { state.workspaceCatalog.generation++; }, () => { state.boardBrandAssociation.generation++; },
      () => { state.lastKnownUpdatedAt = '2026-10-29T08:00:01.000Z'; },
      () => { state.nodes.find(n => n.id === 'exact-target').social.preview = 'Edited'; },
      () => { state.nodes = state.nodes.filter(n => n.id !== 'exact-target'); }, () => { state.boardAccess.canEdit = false; }
    ]) {
      await boot(); await ask(); const count = opens;
      await p.evaluate(mutate);
      await p.evaluate(() => { const turn = state.aiBrain.messages.at(-1); return openAiBrainEvidenceReference(turn, turn.socialEvidence.findings[0], document.querySelector('[data-ai-brain-evidence-open]'), document.createElement('small')); });
      assert.equal(opens, count, 'stale local origin never sends resolver request');
      assert.equal(await p.evaluate(() => state.activeView), 'ai_brain');
    }
    // Repeat races after transport starts; no same-email object or scope change
    // can pass merely because the server response arrived successfully.
    for (const mutate of [() => { state.user = { ...state.user }; }, () => { state.workspaceCatalog.generation++; }, () => { state.nodes.pop(); }]) {
      await boot(); await ask(); let release, started;
      const wait = new Promise(resolve => { release = resolve; }), begun = new Promise(resolve => { started = resolve; }); held = { wait, started };
      const opening = p.evaluate(() => { const t = state.aiBrain.messages.at(-1); return openAiBrainEvidenceReference(t, t.socialEvidence.findings[0], document.querySelector('[data-ai-brain-evidence-open]'), document.createElement('small')); });
      await begun; await p.evaluate(mutate); release(); await opening;
      assert.equal(await p.evaluate(() => state.activeView), 'ai_brain');
    }
    await boot(); await ask(); denied = true;
    await p.locator('[data-ai-brain-evidence-open="exact-target"]').click();
    await p.waitForFunction(() => document.querySelector('.ai-brain-social-evidence')?.textContent.includes('context changed'));
    assert.equal(await p.locator('[data-ai-brain-evidence-open]').count(), 0, 'revoked references and source-checked labels are removed');
    assert.equal(await p.evaluate(() => state.activeView), 'ai_brain'); denied = false;
    await boot(); await ask();
    await p.evaluate(() => { const d = document.createElement('dialog'); d.id = 'fixture-blocker'; document.body.append(d); d.showModal(); });
    await p.evaluate(() => { const t = state.aiBrain.messages.at(-1); return openAiBrainEvidenceReference(t, t.socialEvidence.findings[0], document.querySelector('[data-ai-brain-evidence-open]'), document.createElement('small')); });
    assert.equal(await p.evaluate(() => state.activeView), 'ai_brain');
    for (const mode of ['json-await', 'animation-frame', 'unrendered', 'deferred-navigation']) {
      await boot(); await ask();
      await p.evaluate(mode => {
        if (mode === 'json-await') {
          const original = window.fetch; window.fixtureRestore = () => { window.fetch = original; };
          window.fetch = async (...args) => { const response = await original(...args); if (args[0] === '/api/ai-brain/evidence-reference') {
            const json = response.json.bind(response); response.json = async () => { const data = await json(); state.workspaceCatalog.generation++; return data; };
          } return response; };
        } else if (mode === 'animation-frame') {
          const original = requestAnimationFrame; window.fixtureRestore = () => { window.requestAnimationFrame = original; };
          window.requestAnimationFrame = callback => original(time => { state.user = { ...state.user }; window.requestAnimationFrame = original; callback(time); });
        } else if (mode === 'unrendered') {
          Array.from(el.zoomLayer.querySelectorAll('[data-id]')).find(n => n.dataset.id === 'exact-target').remove();
        } else {
          const original = setActiveView; window.fixtureRestore = () => { window.setActiveView = original; };
          window.setActiveView = view => { if (view !== 'board') original(view); };
        }
      }, mode);
      await p.evaluate(async () => { const t = state.aiBrain.messages.at(-1); await openAiBrainEvidenceReference(t, t.socialEvidence.findings[0], document.querySelector('[data-ai-brain-evidence-open]'), document.createElement('small')); window.fixtureRestore?.(); delete window.fixtureRestore; });
      assert.notEqual(await p.evaluate(() => state.selectedPrimary), 'exact-target', mode + ' cannot select stale/unrendered/deferred target');
    }
    await boot(); let releaseAdvice, adviceStarted;
    const adviceWait = new Promise(resolve => { releaseAdvice = resolve; }), adviceBegun = new Promise(resolve => { adviceStarted = resolve; }); adviceHeld = { wait: adviceWait, started: adviceStarted };
    await p.locator('#ai-brain-mode').selectOption('analyze_social_ctas'); await p.locator('#ai-brain-question').fill('Review Social CTAs');
    await p.locator('#ai-brain-form [type=submit]').click(); await adviceBegun;
    await p.evaluate(() => { state.user = { ...state.user }; }); releaseAdvice();
    await p.waitForFunction(() => state.aiBrain.status !== 'loading');
    assert.equal(await p.locator('.ai-brain-social-evidence').count(), 0, 'same-email account replacement suppresses pending evidence output');
    for (const trigger of ['manual', 'autosave', 'conflict']) {
      await boot(); await ask(); const checks = opens, calls = sql.calls.length;
      saveMode = trigger;
      const saving = p.evaluate(trigger => { state.isDirty = true; clearAutosaveTimer(); return saveBoardToServer(trigger === 'conflict' ? 'manual' : trigger); }, trigger);
      if (trigger === 'conflict') { await p.locator('#board-conflict-cancel').click(); }
      await saving; saveMode = null;
      assert.equal(await p.locator('[data-ai-brain-evidence-open]').count(), 0, 'native save start invalidates evidence, including conflicts');
      assert.equal(opens, checks); assert.equal(sql.calls.length, calls);
      assert(await p.evaluate(() => state.aiBrain.messages.at(-1).socialEvidence.status === 'stale'));
    }
    assert.equal(fixtureSaves, 3, 'only explicit disposable fixture save tests write');
    console.log('PASS stale/revoked/deleted/account/Board/load/Workspace/association/source/save before/during awaits; modal navigation guard');

    for (const width of [320, 375, 1440]) for (const theme of ['light', 'dark']) for (const locale of ['en', 'de']) {
      await p.setViewportSize({ width, height: 812 }); await p.emulateMedia({ reducedMotion: 'reduce' });
      await boot(); await p.evaluate(({ theme, locale }) => { window.FunklixTheme.setPreference(theme); state.uiLanguage = language.setUiLanguage(locale); renderAiBrain(); }, { theme, locale });
      await ask();
      const card = p.locator('.ai-brain-evidence-card').first();
      assert.equal(await card.locator('h5').textContent(), 'Content', 'actual repeated node title must not be translated as interface vocabulary');
      assert((await card.textContent()).includes(locale === 'de' ? 'Quelltext abgeglichen' : 'Source checked'));
      assert(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const button = card.locator('button'); await button.focus(); assert(await button.evaluate(node => node === document.activeElement));
      const composer = await p.locator('.ai-brain-composer').boundingBox(); assert(composer.y + composer.height <= 812);
      await p.locator('.ai-brain-social-evidence>details>summary').focus(); await p.keyboard.press('Enter');
      assert.equal(await p.locator('.ai-brain-evidence-card:visible').count(), 3);
      await button.focus(); await p.keyboard.press('Enter');
      await p.waitForFunction(() => state.activeView === 'board' && state.selectedPrimary === 'exact-target');
      assert.equal(await p.evaluate(() => el.inputs.preview.value), 'Discover more 🚀');
    }
    await p.setViewportSize({ width: 1440, height: 1100 }); await boot(); await ask();
    await p.evaluate(() => { document.documentElement.style.zoom = '2'; });
    assert(await p.locator('.ai-brain-evidence-card').first().evaluate(n => n.scrollWidth <= n.clientWidth + 1), '200% zoom card reflow');
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '200% zoom no horizontal overflow');
    await p.evaluate(() => {
      document.documentElement.style.zoom = '';
      const t = state.aiBrain.messages.at(-1); t.socialEvidence.findings[0].observation = '<img src=x onerror=alert(1)>';
      renderAiBrain();
    });
    assert.equal(await p.locator('.ai-brain-social-evidence img,.ai-brain-social-evidence a,.ai-brain-social-evidence script').count(), 0);
    assert.equal(writes, 0); assert.deepEqual(f.errors, []);
    console.log('PASS EN/DE, Light/Dark, 320/375/desktop, 200% zoom, reduced motion, keyboard disclosure/focus/opening, hostile text, bounded cards, no overflow/composer overlap');
    await p.close();
  } finally { await browser.close(); await sql.pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
