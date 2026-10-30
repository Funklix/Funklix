'use strict';
// Production Advice with disposable SQL and mocked provider; production composer
// functions in Chromium. No live model requests or production database access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('./fixtures/bw36-20-database');
const { chromium } = require('playwright-core');
const modes = ['general', 'review_strategy', 'explore_ideas', 'find_gaps', 'evaluate_options'];
const plain = value => JSON.parse(JSON.stringify(value));
const app = fs.readFileSync('app.js', 'utf8');
async function apiChecks() {
  const f = await fixture();
  try {
    let result = await f.invoke();
    assert.equal(result.statusCode, 200); assert.equal(result.body.context.advice_mode, 'general');
    for (const advice_mode of modes) {
      await f.reset(); await f.insert();
      const history = [{ user: 'Give two ideas', assistant: '1. Community invitation\n2. Partner conversation' }];
      const question = 'Expand the second idea';
      result = await f.invoke({ advice_mode, question, conversation_history: history, response_language: 'de' });
      assert.equal(result.statusCode, 200, advice_mode);
      assert.equal(result.body.context.advice_mode, advice_mode);
      assert.equal(f.calls.length, 1); assert.equal(f.calls[0].store, false);
      const input = f.calls[0].input;
      assert.deepEqual(plain(input.map(m => m.role)), ['system', 'system', 'user', 'user', 'assistant', 'system', 'user']);
      assert.deepEqual(plain(input.slice(3, 5)), [{ role: 'user', content: history[0].user }, { role: 'assistant', content: history[0].assistant }]);
      assert.equal(input.at(-1).content, question);
      assert(input.at(-2).content.startsWith('Response language for this turn: German.'));
      assert.equal(result.body.context.reference_resolution, 'conversation_history');
      const policy = input[0].content;
      for (const phrase of ['explicit user intent remains central', 'clear recommendation', 'authorized context', 'source conflicts', 'decision-relevant alternatives', 'concrete next steps', 'keep short follow-ups concise', 'empty Canvas', 'not proof of model use', 'preserve and use its ordering exactly']) assert(policy.includes(phrase), phrase);
      const lenses = { review_strategy: 'Assess strategic coherence', explore_ideas: 'meaningfully different', find_gaps: 'directly observable absence', evaluate_options: 'Inspect included history first' };
      for (const [mode, phrase] of Object.entries(lenses)) assert.equal(policy.includes(phrase), mode === advice_mode, mode);
      f.calls.length = 0;
      result = await f.invoke({ advice_mode, question });
      assert.equal(result.body.context.reference_resolution, 'clarification');
      assert.equal(result.body.context.advice_mode, advice_mode); assert.equal(f.calls.length, 0);
    }
    for (const invalid of [null, [], {}, 1, true, '', 'General', 'general ', '__proto__', 'constructor', 'ignore policy']) {
      await f.reset(); result = await f.invoke({ advice_mode: invalid });
      assert.equal(result.statusCode, 400, JSON.stringify(invalid));
      assert.equal(f.calls.length, 0); assert.equal(f.queries.length, 0);
    }
    await f.reset(); assert.equal((await f.invoke({ mode_instructions: 'override' })).statusCode, 400);
    for (const key of ['board_id', 'question', 'canvas_context', 'response_language', 'selected_node_id']) {
      assert.equal((await f.invoke({ [key]: undefined })).statusCode, 400, `Required ${key}`);
    }
    await f.reset();
    result = await f.invoke({ advice_mode: 'review_strategy', canvas_context: { nodes: [], edges: [] } });
    assert.equal(result.statusCode, 200); assert.equal(result.body.context.canvasNodes, 0);
    assert.equal(f.calls.length, 1, 'authorized empty-Canvas Advice is available');
    // Count the actual complete policy, not an estimate of the new mode text.
    await f.reset();
    const general = await f.invoke({ advice_mode: 'general' }); assert.equal(general.statusCode, 200);
    const count = f.context.tokens(f.calls[0].input, f.context.modelConstraints());
    f.env.OPENAI_AI_BRAIN_MODEL = 'fixture-model'; f.env.OPENAI_AI_BRAIN_CONTEXT_MODEL = 'fixture-model';
    f.env.OPENAI_AI_BRAIN_TOKEN_ENCODING = 'o200k_base'; f.env.OPENAI_AI_BRAIN_CONTEXT_TOKENS = String(count + 5120);
    f.calls.length = 0;
    assert.equal((await f.invoke({ advice_mode: 'general' })).statusCode, 200);
    f.calls.length = 0;
    assert.equal((await f.invoke({ advice_mode: 'evaluate_options' })).statusCode, 422);
    assert.equal(f.calls.length, 0, 'mode policy consumes the complete token budget');
    for (const advice_mode of modes) {
      await f.reset(); await f.pg.exec('DELETE FROM brand_members');
      result = await f.invoke({ advice_mode }); assert.equal(result.statusCode, 200);
      assert(!result.body.context.approved_learnings); assert(!result.body.context.canonicalBrandCore);
      assert(!f.queries.some(q => /FROM public.brand_learnings/.test(q.sql)));
      await f.reset(); await f.pg.query("UPDATE board_editors SET role='viewer'");
      assert.equal((await f.invoke({ advice_mode })).statusCode, 403); assert.equal(f.calls.length, 0);
      await f.reset(); f.user = null;
      assert.equal((await f.invoke({ advice_mode })).statusCode, 401); assert.equal(f.calls.length, 0);
      await f.reset(); await f.pg.exec('DELETE FROM board_editors');
      assert.equal((await f.invoke({ advice_mode })).statusCode, 403); assert.equal(f.calls.length, 0);
    }
    await f.reset(); await f.insert();
    f.onProvider = () => f.pg.exec("UPDATE brand_learnings SET status='archived',revision=revision+1");
    assert.equal((await f.invoke({ advice_mode: 'review_strategy' })).statusCode, 409);
    assert.equal(f.calls.length, 1);
    await f.reset(); f.answer = 'This is the answer and it is useful for your campaign with the next steps.';
    assert.equal((await f.invoke({ advice_mode: 'find_gaps', response_language: 'de' })).body.code, 'response_language_mismatch');
    assert.equal(f.calls.length, 1, 'no automatic provider retry');
    console.log('PASS BW-37.1A API: enum/default, validation, metadata, prompt roles/lenses, complete budget, ACL, freshness, language and cost.');
  } finally { await f.pg.close(); }
}
async function browserChecks() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => {
      const url = new URL(route.request().url()); assert.equal(url.hostname, 'localhost');
      if (['/styles.css', '/ai-brain-learning-context.css'].includes(url.pathname)) return route.fulfill({ path: path.resolve('.' + url.pathname) });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/ai-brain-learning-context.css"></head><body style="margin:0"><button id="outside">Outside</button><main id="summary"></main></body></html>' });
    });
    await page.goto('http://localhost/'); await page.addScriptTag({ path: path.resolve('language.js') });
    await page.addScriptTag({ path: path.resolve('theme.js') });
    await page.addScriptTag({ content: `
      const state = { user: { email: 'editor@example.invalid' }, currentBoardId: 'A', currentBoardName: 'Board A/X', boardLoadGeneration: 1, boardAccess: { canEdit: true }, nodes: [], edges: [], uiLanguage: 'en', selectedPrimary: null, brandCore: {}, aiBrain: { adviceMode: 'general', status: 'idle', messages: [], requestId: 0, identity: '', appliedProposalIds: new Set() } };
      const el = { aiBrainSummary: document.querySelector('#summary') };
      const uiText = key => window.FunklixLanguage.t(key, state.uiLanguage);
      const uiFormat = (key, values) => Object.entries(values).reduce((s, [key,value]) => s.replaceAll('{'+key+'}', value), uiText(key));
      const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const getNode = id => state.nodes.find(n => n.id === id);
      const resolveBrandWorkspaceDisplayName = () => 'Board Brand X';
      const getApprovedBrandAvatarUrl = () => ''; const getSafeDashboardAvatarImageUrl = () => '';
      const language = window.FunklixLanguage;
      ${app.slice(app.indexOf('function translateInterface('), app.indexOf('const BRAND_CORE_STORAGE_KEY'))}
      const requests = []; let release; let fail = false;
      window.fetch = async (url, options) => {
        if (url !== '/api/ai-brain/advice') throw new Error('Unexpected handoff or network request');
        const body = JSON.parse(options.body); requests.push(body);
        await new Promise(resolve => release = resolve);
        return { ok: !fail, json: async () => fail ? { error: 'Unavailable' } : { answer: '1. First idea\\n2. Second idea\\n<img src=x onerror=alert(1)>', context: { response_language: body.response_language, advice_mode: body.advice_mode, canvasNodes: body.canvas_context.nodes.length }, disclaimer: 'Qualitative advice.' } };
      };
    ` });
    await page.addScriptTag({ content: app.slice(app.indexOf('function aiBrainIdentity()'), app.indexOf('function aiBrainNodePlacement()')) });
    await page.evaluate(() => renderAiBrain());
    const select = page.locator('#ai-brain-mode'), question = page.locator('#ai-brain-question');
    assert.equal(await select.inputValue(), 'general'); assert.equal(await select.locator('option').count(), 6);
    assert.equal(await select.locator('option[value="analyze_social_ctas"]').textContent(), 'Review social posts', 'explicit evidence analysis entry is separate from ordinary Advice modes');
    assert.equal(await select.getAttribute('aria-describedby'), 'ai-brain-mode-description ai-brain-mode-guidance');
    await question.fill('Draft <img src=x onerror=alert(1)>');
    await page.evaluate(() => { window.originalComposer = document.querySelector('#ai-brain-question'); window.domain = JSON.stringify([state.nodes, state.edges, state.brandCore, state.selectedPrimary]); });
    for (const mode of modes) {
      await select.selectOption(mode);
      assert.equal(await question.inputValue(), 'Draft <img src=x onerror=alert(1)>');
      assert(await page.evaluate(() => originalComposer === document.querySelector('#ai-brain-question')));
      assert.equal(await page.evaluate(() => requests.length), 0);
      assert.equal(await page.evaluate(() => JSON.stringify([state.nodes,state.edges,state.brandCore,state.selectedPrimary]) === domain), true);
    }
    await select.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
    assert.equal(await question.evaluate(n => n === document.activeElement), true);
    await page.keyboard.press('Enter'); assert((await question.inputValue()).includes('\n'));
    await select.selectOption('explore_ideas');
    await question.evaluate(n => { n.focus(); n.setSelectionRange(2, 6, 'backward'); });
    await page.evaluate(() => renderAiBrain());
    assert.deepEqual(await question.evaluate(n => [n === document.activeElement, n.selectionStart, n.selectionEnd, n.selectionDirection]), [true,2,6,'backward']);
    await page.locator('#outside').focus(); await page.evaluate(() => renderAiBrain());
    assert.equal(await page.locator('#outside').evaluate(n => n === document.activeElement), true);
    await question.fill('Suggest directions');
    await page.evaluate(() => { window.pending = requestAiBrainAdvice(); });
    assert(await select.isDisabled()); assert(await page.locator('[type=submit]').isDisabled());
    assert.equal(await page.evaluate(() => requests.at(-1).advice_mode), 'explore_ideas');
    await page.evaluate(async () => { release(); await pending; });
    assert.equal(await page.locator('.ai-brain-formatted-answer img, .ai-brain-question img').count(), 0);
    await select.selectOption('general'); await question.fill('Expand the second idea');
    await page.evaluate(() => { fail = true; window.pending = requestAiBrainAdvice(); });
    assert.equal(await page.evaluate(() => requests.at(-1).conversation_history.length), 1);
    await page.evaluate(async () => { release(); await pending; });
    await select.selectOption('find_gaps');
    await page.evaluate(() => { state.uiLanguage = 'de'; state.selectedPrimary = 'fresh'; state.nodes = [{ id: 'fresh', type: 'Idea', title: 'Current' }]; fail = false; window.pending = requestAiBrainAdvice(null, state.aiBrain.messages.at(-1).id); });
    assert.deepEqual(await page.evaluate(() => [requests.at(-1).advice_mode, requests.at(-1).question, requests.at(-1).response_language, requests.at(-1).selected_node_id, requests.at(-1).conversation_history.length]), ['general','Expand the second idea','de','fresh',1]);
    await page.evaluate(async () => { release(); await pending; });
    assert.equal(await select.inputValue(), 'find_gaps');
    assert.equal(await page.evaluate(() => state.aiBrain.messages.length), 2);
    // A non-General failed turn retains its lens even after the composer changes.
    await page.evaluate(() => { const turn = state.aiBrain.messages[0]; turn.status = 'failed'; window.pending = requestAiBrainAdvice(null, turn.id); });
    assert.equal(await page.evaluate(() => requests.at(-1).advice_mode), 'explore_ideas');
    assert.equal(await select.inputValue(), 'find_gaps');
    await page.evaluate(async () => { release(); await pending; });
    assert.equal(await page.evaluate(() => state.aiBrain.messages.length), 2);
    // A legacy failed turn retries as General without altering current focus.
    await page.evaluate(() => { const turn = state.aiBrain.messages[0]; turn.status = 'failed'; delete turn.adviceMode; window.pending = requestAiBrainAdvice(null, turn.id); });
    assert.equal(await page.evaluate(() => requests.at(-1).advice_mode), 'general');
    await page.evaluate(async () => { release(); await pending; });
    // Selected Brand is presentation preference, not conversation identity.
    await page.evaluate(() => { state.activeBrandId = 'Y'; renderAiBrain(); });
    assert.equal(await select.inputValue(), 'find_gaps'); assert.equal(await page.evaluate(() => state.aiBrain.messages.length), 2);
    // Each new turn now starts with a fresh composer after acceptance.
    await question.fill('Review the current Canvas');
    // Stale Canvas answers never become a successful turn.
    await page.evaluate(() => { window.pending = requestAiBrainAdvice(); state.nodes[0].title = 'Changed during inference'; });
    await page.evaluate(async () => { release(); await pending; });
    assert.equal(await page.evaluate(() => state.aiBrain.messages.at(-1).errorCode), 'changed');
    await question.fill('Review before switching');
    // Explicit invalidation aborts pending work, resets mode, suppresses late output.
    await page.evaluate(() => { window.pending = requestAiBrainAdvice(); window.signal = state.aiBrain.controller.signal; invalidateAiBrainRequest(); renderAiBrain(); });
    assert(await page.evaluate(() => signal.aborted)); assert.equal(await select.inputValue(), 'general');
    await page.evaluate(async () => { release(); await pending; });
    assert.equal(await page.evaluate(() => state.aiBrain.messages.length), 0);
    for (const theme of ['light','dark','system']) for (const language of ['en','de']) for (const width of [1280,375,320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.evaluate(({theme,language}) => { window.FunklixTheme.setPreference(theme); state.uiLanguage = language; window.FunklixLanguage.setUiLanguage(language); renderAiBrain(); }, {theme,language});
      await select.selectOption('evaluate_options');
      assert.equal(await page.locator('label[for=ai-brain-mode]').textContent(), language === 'de' ? 'Gesprächsfokus' : 'Conversation focus');
      assert((await page.locator('#ai-brain-mode-description').textContent()).startsWith(language === 'de' ? 'Vergleiche' : 'Compare'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}/${language}/${width} overflow`);
      assert((await select.boundingBox()).height >= 44);
      await page.evaluate(() => translateInterface(el.aiBrainSummary));
      assert((await page.locator('#ai-brain-mode-description').textContent()).startsWith(language === 'de' ? 'Vergleiche' : 'Compare'), 'presentation translation retains the changed helper');
      if (theme === 'system') assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
      if (process.env.BW37_SCREENSHOT_DIR && width !== 375) { fs.mkdirSync(process.env.BW37_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.BW37_SCREENSHOT_DIR, `${theme}-${language}-${width}.png`), fullPage: true }); }
      await select.focus(); await page.evaluate(() => renderAiBrain());
      assert(await select.evaluate(n => n === document.activeElement));
    }
    await page.evaluate(() => { state.currentBoardId = 'replacement'; state.boardLoadGeneration++; renderAiBrain(); });
    assert.equal(await select.inputValue(), 'general', 'Board lifecycle rerender resets the mode');
    await page.evaluate(() => { state.currentBoardId = null; renderAiBrain(); });
    assert.equal(await select.count(), 0); assert((await page.locator('.ai-brain-unavailable').textContent()).includes('gespeichertes Board'));
    console.log('PASS BW-37.1A Chromium: selection purity, draft/focus/caret, follow-ups, retries, lifecycle/stale suppression, safe DOM, native keyboard, EN/DE, themes, 320/375/desktop.');
  } finally { await browser.close(); }
}
async function fullShellChecks() {
  const { runtime, B, D, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
  const r = runtime(), selectedBrand = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  r.db.brands.push({ ...clone(r.db.brands[0]), id: selectedBrand, name: 'Sidebar Brand Y' });
  const catalog = r.catalog(); catalog.request_id = '0123456789abcdef01234567';
  for (const workspace of catalog.workspaces) { workspace.avatar_url = null; workspace.locale = 'en'; for (const item of [...workspace.brands, ...workspace.boards]) delete item.workspace_id; }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const writes = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      assert.equal(url.hostname, 'localhost', 'full shell never reaches a provider');
      assert(!/\/api\/(?:ai-brain|generate|analytics)/.test(url.pathname), 'mode/navigation cannot invoke AI');
      if (url.pathname.startsWith('/api/') && method !== 'GET' && !url.pathname.includes('/presence/')) writes.push([method, url.pathname]);
      if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: { email: EMAIL, name: 'Editor' } } });
      if (url.pathname === '/api/workspaces') return route.fulfill({ json: catalog });
      if (url.pathname === '/api/boards') return route.fulfill({ json: { boards: r.db.boards } });
      if (url.pathname === '/api/boards/' + D) return route.fulfill({ json: { ...clone(r.db.boards[0]), access: { role: 'owner', canView: true, canEdit: true, canViewBoardBrandCore: true, canViewPresence: false } } });
      if (/\/editors|\/sharing/.test(url.pathname)) return route.fulfill({ json: { people: [], editors: [] } });
      if (url.pathname.startsWith('/api/brands')) { const out = await r.request(method, url.pathname, req.postDataJSON()); return route.fulfill({ status: out.statusCode, json: out.body }); }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { members: [], editors: [], viewers: [], boards: [] } });
      const file = path.resolve(url.pathname === '/' || url.pathname.startsWith('/boards/') ? 'index.html' : '.' + url.pathname);
      return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    await page.goto('http://localhost/boards/' + D);
    await page.waitForFunction(() => state.workspaceCatalog.status === 'ready' && !state.isBoardLoading && !state.isBoardHydrating && state.activeView);
    await page.evaluate(() => { clearAutosaveTimer(); stopPresenceLite(); stopBoardRefreshPolling(); });
    await page.locator('#ai-brain-nav-btn').click();
    const question = page.locator('#ai-brain-question'), select = page.locator('#ai-brain-mode');
    await question.fill('Preserve this freeform question'); await select.selectOption('review_strategy');
    const snapshot = () => page.evaluate(() => JSON.stringify([state.nodes, state.edges, state.brandCore, state.boardBrandAssociation, state.isDirty, state.lastSavedSnapshot]));
    const before = await snapshot();
    await page.evaluate(id => selectSessionBrand(id), selectedBrand);
    assert.equal(await select.inputValue(), 'review_strategy'); assert.equal(await question.inputValue(), 'Preserve this freeform question');
    assert.equal(await page.evaluate(() => state.currentBoardId), D);
    assert.equal(await page.evaluate(() => state.boardBrandAssociation.brandId), B);
    for (const width of [1280, 375, 320]) for (const uiLanguage of ['en', 'de']) for (const theme of ['light', 'dark', 'system']) {
      await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: 'dark' });
      await page.evaluate(({ uiLanguage, theme }) => { state.uiLanguage = window.FunklixLanguage.setUiLanguage(uiLanguage); refreshInterfaceLanguage(); window.FunklixTheme.setPreference(theme); }, { uiLanguage, theme });
      assert.equal(await select.inputValue(), 'review_strategy'); assert.equal(await question.inputValue(), 'Preserve this freeform question');
      await question.focus(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
      assert((await question.inputValue()).endsWith('\n'));
      await question.fill('Preserve this freeform question');
      await page.locator('#ai-brain-form button[type=submit]').scrollIntoViewIfNeeded();
      assert(await page.locator('#ai-brain-form button[type=submit]').isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert(await select.evaluate(n => n.scrollWidth <= n.clientWidth + 2));
      if (process.env.BW37_SCREENSHOT_DIR && width !== 375 && theme !== 'system') await page.screenshot({ path: path.join(process.env.BW37_SCREENSHOT_DIR, `shell-${theme}-${uiLanguage}-${width}.png`) });
    }
    await page.evaluate(() => { setActiveView('home'); setActiveView('ai_brain'); });
    assert.equal(await question.inputValue(), 'Preserve this freeform question'); assert.equal(await select.inputValue(), 'review_strategy');
    assert.equal(await snapshot(), before); assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    console.log('PASS BW-37.1A full application: real boot/navigation, sidebar Y versus Board A/X, draft/mode continuity, reachable mobile composer, native newline, EN/DE and themes, zero writes or AI calls.');
  } finally { await browser.close(); }
}
(async () => { await apiChecks(); await browserChecks(); await fullShellChecks(); })().catch(error => { console.error(error); process.exitCode = 1; });
