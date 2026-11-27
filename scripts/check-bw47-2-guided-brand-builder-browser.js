'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { B, W, EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const { sections } = require('../brand-enrichment-contract');
const homeFixture = require('./fixtures/home-browser');
const output = 'work/bw47-2/screenshots';
const Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const quote = 'Northstar repairs hand tools for independent workshops.';
const sourceUrl = 'https://northstar.example/';

function prepare(r, populated = false) {
  r.db.brands[0].name = 'Northstar Toolworks';
  const core = r.db.brands[0].brand_core;
  Object.assign(core, { brandCore: '', valueProposition: '', toneOfVoice: [], personas: [], customTiles: [],
    brandAssets: { domain: '', colors: [], typography: '', references: [] } });
  if (populated) Object.assign(core, { brandCore: quote, valueProposition: 'Keep useful tools working.',
    toneOfVoice: ['Patient and specific'], personas: [{ name: 'Workshop owner', note: 'Chooses the repair service.' }] });
}

async function open(f, language, target) {
  await f.page.evaluate(({ language, target }) => {
    state.uiLanguage = FunklixLanguage.setUiLanguage(language);
    translateInterface();
    return openRegularBrandProfile(target);
  }, { language, target });
  await f.page.waitForFunction(() => brandProfileController && canonicalBrandDetail.status === 'ready');
}

async function runJourney(browser, language) {
  const f = await homeFixture(browser)({ empty: true, prepare: r => prepare(r) });
  const { page, r } = f;
  const key = value => page.locator(`[data-profile-key="${value}"]`);
  const card = value => page.locator(`[data-builder-field="${value}"]`);
  const idle = () => page.waitForFunction(() => !brandProfileController.busy());
  const dialog = page.locator('.brand-suggestion-dialog[open]');
  const writes = () => r.requests.filter(item => item.method === 'PUT');
  const snapshot = clone(r.db.boards);
  const initial = clone(r.db.brands[0]);
  const requests = [];
  const processed = [];
  const reviewHeaders = [];
  page.on('request', request => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/brands/'+B) {
      reviewHeaders.push(Object.hasOwn(request.headers(), 'x-brand-review'));
    }
  });
  let crawls = 0;
  const de = language === 'de';
  const modelDraft = (value, sourceId, excerpt, classification = 'ai_interpretation') =>
    ({ value, classification, evidence: [{ sourceId, excerpt }] });
  const handler = r.load('api/enrich-brand-profile.js').createHandler({
    getSessionUser: () => ({ email: EMAIL }),
    logDiagnostic() {},
    researchDomain: async url => {
      crawls++;
      assert.equal(url, sourceUrl);
      return { research: {
        version: 'brand-domain-research/v1',
        sources: [
          { id: 'site', url: sourceUrl, retrieval: 'fetched', extraction: 'extracted', processing: 'prepared', evidenceKind: 'visible_text' },
          { id: 'about', url: sourceUrl+'about', retrieval: 'unavailable', extraction: 'not_started', processing: 'not_started', reason: 'http_error' }
        ],
        selectedEvidence: [{ sourceId: 'site', url: sourceUrl, excerpt: quote }],
        counts: { discovered: 2, fetched: 1, extracted: 1, unavailable: 1, deferred: 0 }, remaining: { omittedUnits: 0 }
      } };
    },
    fetch: async (url, init) => {
      assert.equal(new URL(url).hostname, 'api.openai.com');
      const request = requests.at(-1);
      const prompt = JSON.parse(init.body);
      const fields = {};
      processed.push(request);
      if (request.domainUrl) {
        fields.brandCore = modelDraft(de ? 'Northstar repariert Handwerkzeuge.' : 'Northstar repairs hand tools.', 'site', quote, 'website_supported');
        fields.valueProposition = modelDraft(de ? 'Werkzeuge länger nutzen.' : 'Keep useful tools in service.', 'site', quote);
        fields.personas = modelDraft([{ name: de ? 'Werkstätten' : 'Independent workshops', note: de ? 'Nutzen den Reparaturdienst.' : 'Use the repair service.' }], 'site', quote, 'website_supported');
      } else if (request.field === 'mission' && request.answers?.length) {
        fields.mission = modelDraft(request.answers[0].answer, 'user', request.answers[0].answer, 'user_provided');
      } else if (request.field === 'brandCore') {
        assert.equal(request.intent, 'improve');
        assert.match(prompt.messages[1].content, /savedValuesForImprovement/);
        fields.brandCore = { value: null, classification: 'no_improvement', evidence: [] };
      } else if (request.section === 'voice_messaging') {
        assert.match(prompt.messages[1].content, /"sourceId":"reviewed:brandCore:0"/);
        assert(prompt.messages[1].content.includes(quote));
        fields.toneOfVoice = modelDraft(de ? ['Klar und nahbar'] : ['Clear and approachable'], 'reviewed:brandCore:0', quote);
        fields.messagingPillars = modelDraft(de ? ['Handwerkzeuge länger nutzen'] : ['Keep hand tools working longer'], 'reviewed:brandCore:0', quote);
        fields.contentGuidelines = modelDraft(de ? ['Beispiele aus dem Werkstattalltag verwenden.'] : ['Use examples from everyday workshop repairs.'], 'reviewed:brandCore:0', quote, 'conflicting');
        fields.keywords = { value: { invalid: true }, classification: 'ai_interpretation', evidence: [] };
      } else if (request.section === 'brand_identity') {
        fields.brandAssets = modelDraft({ colors: [r.db.brands[0].brand_core.brandAssets.colors.length ? '#433b92' : '#623db5'], typography: 'Geist', references: [] }, 'reviewed:brandCore:0', quote);
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ fields }) } }] }) };
    }
  });
  await page.route('**/api/enrich-brand-profile', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = clone(value); return this; } };
    await handler({ method: 'POST', body }, res);
    await route.fulfill({ status: res.statusCode, json: res.body });
  });
  const shot = async name => {
    if (de && name !== 'mobile-dark-de') return;
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
  };
  const confirm = async () => {
    await page.waitForFunction(() => !brandProfileController.busy() || document.querySelector('.brand-suggestion-dialog[open]'));
    if (await dialog.count()) await dialog.locator('.fk-btn-primary').click();
    await idle();
  };
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(f, language);
    assert.equal(await page.locator('[data-section-title]').textContent(), de ? 'Entdecken' : 'Discover');
    assert(await key('research-domain').isVisible());
    assert.equal(requests.length, 0);
    await shot('overview');
    await key('builder-continue').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('[data-section-title]').evaluate(node => document.activeElement === node));
    assert.equal(await page.locator('[data-builder-field]').count(), 5);
    assert.equal(await card('mission').locator('.profile-builder-status').textContent(), de ? 'Leer und optional' : 'Empty and optional');
    assert.equal(requests.length, 0);
    await shot('foundation');

    await key('questions-mission').click();
    await idle();
    assert.equal(requests.at(-1).action, 'questions');
    assert.equal(processed.length, 0);
    await key('answer-mission').fill(de ? 'Werkzeuge länger nutzbar machen.' : 'Keep tools useful for longer.');
    await key('skip-question-mission').click();
    assert.equal(processed.length, 0);
    assert.equal(await key('answer-mission').count(), 0);
    await key('builder-audience_offers').click();
    assert.deepEqual(await page.locator('[data-builder-field]').evaluateAll(nodes => nodes.map(node => node.dataset.builderField)), ['personas']);
    assert(await key('builder-open-offers').isVisible());
    await shot('audience');
    await key('builder-brand_foundation').click();
    await key('questions-mission').click();
    assert.equal(await key('answer-mission').inputValue(), de ? 'Werkzeuge länger nutzbar machen.' : 'Keep tools useful for longer.');
    await key('Prepare my suggestion').click();
    await idle();
    assert.deepEqual(requests.at(-1).targetFields, ['mission']);
    assert.equal(requests.at(-1).section, 'brand_foundation');
    assert.equal(requests.at(-1).answers.length, 1);
    assert(await key('accept-enrichment-mission').isEnabled());
    await key('builder-review').click();
    await key('Discard enrichment draft').click();
    assert.equal(writes().length, 0);

    await key('builder-discover').click();
    await key('research-domain').fill('northstar.example');
    await key('research-start').click();
    await idle();
    assert.equal(crawls, 1);
    assert.equal(await key('builder-brand_foundation').getAttribute('aria-current'), 'step');
    assert(await page.locator('.profile-research-results').textContent().then(value => /1/.test(value)));
    assert.equal(r.db.brands[0].brand_core.brandCore, initial.brand_core.brandCore);
    await card('brandCore').locator('[data-disclosure="proposal-edit:brandCore"] > summary').click();
    const edited = de ? 'Northstar repariert Handwerkzeuge für Werkstätten.' : 'Northstar repairs tools for independent workshops.';
    await key('enrichment-brandCore').fill(edited);
    await shot('suggestions');

    const beforeBulk = writes().length;
    const beforeRevision = r.db.brands[0].revision;
    const [preview] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/brands/'+B+'/write-preview'),
      key('accept-section-enrichment').click()
    ]);
    assert.equal((await preview.json()).requires_review, false, 'empty additions still get a server preview');
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('heading', { level: 3 }).count(), 2);
    assert(await dialog.getByRole('button', { name: de ? 'Abbrechen' : 'Cancel' }).evaluate(node => document.activeElement === node));
    await dialog.locator('.profile-confirm-changes').focus();
    await page.keyboard.press('Shift+Tab');
    assert(await dialog.locator('.fk-btn-primary').evaluate(node => document.activeElement === node));
    await shot('confirmation');
    await page.keyboard.press('Escape');
    await idle();
    assert.equal(writes().length, beforeBulk);
    assert(await key('accept-section-enrichment').evaluate(node => document.activeElement === node));
    assert.equal(await key('enrichment-brandCore').inputValue(), edited);
    await key('accept-section-enrichment').click();
    await confirm();
    assert.equal(writes().length, beforeBulk + 1);
    assert.equal(reviewHeaders.at(-1), true);
    assert.equal(r.db.brands[0].revision, beforeRevision + 1);
    assert.equal(r.db.brands[0].brand_core.brandCore, edited);
    assert.equal(r.db.brands[0].brand_core._profileEvidence.fields.brandCore.evidence[0].excerpt, quote);
    assert.equal(r.db.brands[0].brand_core._profileEvidence.fields.brandCore.userEdited, true);
    assert.equal(r.db.brands[0].brand_core.personas.length, 0);

    await key('suggest-brandCore').click();
    await idle();
    assert.equal(requests.at(-1).intent, 'improve');
    assert(await card('brandCore').textContent().then(value => value.includes(de ? 'Dein gespeicherter Inhalt kann so bleiben' : 'Keep your saved value')));
    assert.equal(await card('brandCore').locator('[data-profile-key="accept-enrichment-brandCore"]').count(), 0);

    await key('builder-voice_messaging').click();
    assert.deepEqual(await page.locator('[data-builder-field]').evaluateAll(nodes => nodes.map(node => node.dataset.builderField)), sections.voice_messaging);
    await shot('voice');
    await key('generate-section-enrichment').click();
    await idle();
    assert.deepEqual(requests.at(-1), { action: 'draft', section: 'voice_messaging', targetFields: [...sections.voice_messaging],
      intent: 'improve', brandId: B, workspaceId: W, revision: r.db.brands[0].revision, language });
    assert(await card('contentGuidelines').locator('.profile-suggestion-kind').isVisible());
    assert.equal(await card('contentGuidelines').locator('[data-profile-key="accept-enrichment-contentGuidelines"]').count(), 0);
    assert.equal(await key('accept-enrichment-keywords').count(), 0);
    await card('toneOfVoice').locator('[data-disclosure="proposal-edit:toneOfVoice"] > summary').click();
    await key('enrichment-toneOfVoice-0').fill('x'.repeat(5001));
    assert(await key('accept-enrichment-toneOfVoice').isDisabled());
    const voiceWrites = writes().length;
    await key('accept-section-enrichment').click();
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('heading', { level: 3 }).count(), 1);
    assert.match(await dialog.locator('details').textContent(), /Content guidelines|Inhaltsrichtlinien|Content-Richtlinien/i);
    await page.keyboard.press('Escape');
    await idle();
    assert.equal(writes().length, voiceWrites);

    await key('builder-brand_identity').click();
    for (const destination of ['builder-open-founder', 'builder-open-1', 'builder-open-5', 'builder-open-6']) assert(await key(destination).isVisible());
    assert.deepEqual(await page.locator('[data-builder-field]').evaluateAll(nodes => nodes.map(node => node.dataset.builderField)), ['brandAssets']);
    await shot('identity');
    await key('generate-section-enrichment').click();
    await idle();
    assert.deepEqual(requests.at(-1).targetFields, ['brandAssets']);
    await key('builder-voice_messaging').click();
    assert(await key('accept-enrichment-toneOfVoice').isDisabled(), 'invalid manual edit is retained across other sections');
    await card('toneOfVoice').locator('[data-disclosure="proposal-edit:toneOfVoice"] > summary').click();
    await key('enrichment-toneOfVoice-0').fill(de ? 'Ruhig und nahbar' : 'Calm and approachable');
    await key('accept-enrichment-toneOfVoice').click();
    await confirm();
    await key('reject-enrichment-contentGuidelines').click();
    await confirm();
    assert.equal(r.db.brands[0].brand_core._profileEvidence.fields.contentGuidelines.decision, 'rejected');
    await key('postpone-enrichment-messagingPillars').click();
    await confirm();
    assert.equal(r.db.brands[0].brand_core._profileEvidence.fields.messagingPillars.decision, 'postponed');
    assert.equal(crawls, 1);

    await key('builder-review').click();
    await key('accept-all-enrichment').click();
    await confirm();
    assert.deepEqual(r.db.brands[0].brand_core.brandAssets.colors, ['#623db5']);
    assert.equal(r.db.brands[0].brand_core.personas.length, 1);
    await key('Reload latest Brand').click();
    await idle();
    await key('builder-brand_foundation').click();
    assert(await card('brandCore').textContent().then(value => value.includes(edited)));

    // A different server revision invalidates pending proposals; it also prevents
    // a new request using the old controller revision from reaching inference.
    await key('builder-brand_identity').click();
    await key('generate-section-enrichment').click();
    await idle();
    const beforeStale = processed.length;
    r.db.brands[0].revision++;
    await key('builder-brand_foundation').click();
    await key('suggest-brandCore').click();
    await idle();
    assert.equal(processed.length, beforeStale);
    await key('Reload latest Brand').click();
    await idle();
    await key('builder-brand_identity').click();
    assert(await key('accept-section-enrichment').isDisabled());

    await key('builder-brand_foundation').click();
    await card('brandCore').locator('[data-disclosure="builder-edit:brandCore"] > summary').click();
    await key('Brand description').fill(de ? 'Manuell bearbeitet.' : 'Manually edited after reload.');
    await key('builder-save-brandCore').click();
    await idle();
    assert.equal(r.db.brands[0].brand_core.brandCore, de ? 'Manuell bearbeitet.' : 'Manually edited after reload.');
    await key('builder-brand_identity').click();
    await key('builder-open-founder').click();
    assert(await page.locator('.profile-founder').evaluate(node => node.open));
    await key('open-guided-builder').click();
    await key('builder-brand_identity').click();
    await key('builder-open-1').click();
    assert(await key('Generate Brand DNA').isVisible());
    await key('open-guided-builder').click();
    await key('builder-brand_identity').click();
    await key('builder-open-5').click();
    assert(await key('brandAssets-colors').isVisible());
    await key('open-guided-builder').click();
    await key('builder-brand_identity').click();
    await key('builder-open-6').click();
    assert(await key('Generate Avatar').isVisible());
    await key('Advanced options').click();
    await page.locator('#brand-workspace-edit-open').click();
    assert(await page.locator('#brand-workspace-edit-core').isVisible());
    await page.locator('#brand-workspace-edit-cancel').click();

    await open(f, language, { id: Y, workspace_id: W });
    await key('builder-brand_foundation').click();
    assert(await card('brandCore').textContent().then(value => value.includes('Original positioning') && !value.includes(edited)));
    assert.equal(await key('accept-section-enrichment').count(), 0);
    await open(f, language, { id: B, workspace_id: W });
    await key('builder-brand_identity').click();
    if (de) {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await page.setViewportSize({ width: 375, height: 1000 });
      await page.locator('[data-section-title]').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await shot('mobile-dark-de');
    }
    for (const width of [1280, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const selector of ['.guided-brand-profile', '.profile-section', '.profile-builder-nav']) {
        assert(await page.locator(selector).evaluate(node => node.scrollWidth <= node.clientWidth + 1), selector+' at '+width+'px');
      }
    }
    assert.deepEqual(r.db.boards, snapshot);
    assert.deepEqual(f.errors, []);
  } finally {
    f.writes.length = 0;
    await f.close();
  }
}

async function runViewer(browser) {
  const f = await homeFixture(browser)({ empty: true, prepare(r) {
    prepare(r, true);
    r.db.brands[0].owner_email = 'another-owner@example.test';
    r.db.brandRole = 'viewer';
  } });
  try {
    await open(f, 'en');
    await f.page.locator('[data-profile-key="builder-brand_foundation"]').click();
    assert(await f.page.locator('[data-builder-field="brandCore"]').textContent().then(value => value.includes(quote)));
    assert.equal(await f.page.locator('.profile-builder-tools button, [data-profile-key^="suggest-"], [data-disclosure^="builder-edit:"], .profile-actions .fk-btn-primary').count(), 0);
  } finally {
    await f.close();
  }
}

async function runNativeZoom() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bw47-2-zoom-'));
  let context, f;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      viewport: null, args: ['--no-sandbox', '--window-size=1440,1100']
    });
    const settings = await context.newPage();
    await settings.goto('chrome://settings/appearance');
    await settings.evaluate(() => chrome.settingsPrivate.setDefaultZoom(2));
    await settings.close();
    f = await homeFixture({ newPage: () => context.newPage() })({ empty: true, prepare: r => prepare(r, true) });
    await open(f, 'en');
    const geometry = await f.page.evaluate(() => ({ css: innerWidth, native: outerWidth, dpr: devicePixelRatio }));
    assert.equal(geometry.dpr, 2);
    assert(Math.abs(geometry.css * 2 - geometry.native) <= 2);
    const next = f.page.locator('[data-profile-key="builder-continue"]');
    await next.focus();
    await f.page.keyboard.press('Enter');
    for (const selector of ['.guided-brand-profile', '.profile-section', '.profile-builder-nav']) {
      assert(await f.page.locator(selector).evaluate(node => node.scrollWidth <= node.clientWidth + 1), selector+' at 200%');
    }
    await f.page.locator('[data-builder-field="brandCore"] [data-disclosure="builder-edit:brandCore"] > summary').focus();
    await f.page.keyboard.press('Enter');
    assert(await f.page.locator('[data-profile-key="Brand description"]').isVisible());
  } finally {
    if (f) await f.close();
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const language of ['en', 'de']) await runJourney(browser, language);
    await runViewer(browser);
  } finally {
    await browser.close();
  }
  await runNativeZoom();
  console.log('BW-47.2 browser PASS: guided EN/DE sections, scoped inference, saved evidence reuse, protected atomic review, permissions, editing/reload, snapshot isolation and responsive keyboard flow.');
})().catch(error => { console.error(error); process.exitCode = 1; });
