'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { EMAIL, clone } = require('./fixtures/bw36-13r5-local-runtime');
const { name, description, bad } = require('./fixtures/bw47-1-brand-quality.json');

const website = 'https://frostwerk.example/';
const excerpt = 'Kälte- und Klimaanlagen';
const savedTone = ['Sachlich', 'Nahbar'];
const improvedTone = ['Fachlich präzise bei technischen Rückfragen', 'Nahbar bei der Erklärung von Wartungsoptionen'];
const reviewed = {
  decision: 'accepted', value: savedTone, classification: 'ai_interpretation', originId: 'earlier',
  evidence: [{ excerpt, url: website, origin: 'brand-domain-research/v1' }]
};
const record = (value, sourceId = 's1', quote = excerpt, classification = 'ai_interpretation') =>
  ({ value, classification, evidence: [{ sourceId, excerpt: quote }] });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await require('./fixtures/home-browser')(browser)({ empty: true, prepare(r) {
      Object.assign(r.db.brands[0], { name, brand_core: {
        brandCore: description, toneOfVoice: savedTone, contentGuidelines: ['Erkläre Wartungsabläufe verständlich.'],
        brandAssets: { domain: website }, customTiles: [{ id: 'km_fixture_values', moduleType: 'values', moduleData: { values: { content: 'Saved' } } }],
        _profileEvidence: { version: 'brand-enrichment/v1', fields: { toneOfVoice: reviewed }, inputs: { earlier: {} } }
      } });
    } });
    try {
      const p = f.page, key = k => p.locator(`[data-profile-key="${k}"]`);
      const before = clone(f.r.db.brands[0]), snapshot = clone(f.r.db.boards);
      let crawls = 0, calls = 0, targetedResult = 'identical';
      const inputs = [], results = [];
      const handler = f.r.load('api/enrich-brand-profile.js').createHandler({
        getSessionUser: () => ({ email: EMAIL }),
        logDiagnostic: () => {},
        researchDomain: async () => {
          crawls++;
          return { research: {
            selectedEvidence: [{ sourceId: 's1', url: website, excerpt: description }],
            sources: [{ id: 's1', url: website, processing: 'prepared', retrieval: 'fetched' }],
            counts: { discovered: 1, fetched: 1, processed: 0 }
          } };
        },
        fetch: async (_url, init) => {
          calls++;
          const fields = Object.fromEntries(Object.keys(JSON.parse(init.body).response_format.json_schema.schema.properties.fields.properties).map(k => [k, null]));
          if (inputs.at(-1).domainUrl) Object.assign(fields, {
            brandCore: record(description, 's1', excerpt, 'website_supported'),
            toneOfVoice: record(savedTone),
            contentGuidelines: record(bad.contentGuidelines),
            messagingPillars: record(['Wartung senkt Kosten um 80 Prozent.']),
            dosAndDonts: record({ dos: ['Explain the technology and the benefits for our customers.'], donts: [] }),
            personas: record([{ name: 'Facility teams', note: 'Service buyers' }], 's1', 'Missing quote'),
            keywords: record(7),
          });
          else if (targetedResult === 'adequate') fields.toneOfVoice = { value: null, classification: 'no_improvement', evidence: [] };
          else fields.toneOfVoice = record(targetedResult === 'identical' ? savedTone : improvedTone, 'reviewed:toneOfVoice:0');
          return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ fields }) } }] }) };
        }
      });
      await p.route('**/api/enrich-brand-profile', async route => {
        inputs.push(route.request().postDataJSON());
        const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handler({ method: 'POST', body: inputs.at(-1) }, res);
        results.push(res.body);
        await route.fulfill({ status: res.statusCode, json: res.body });
      });
      await p.evaluate(() => { state.uiLanguage = FunklixLanguage.setUiLanguage('de'); translateInterface(); openRegularBrandProfile(); });
      await p.waitForFunction(() => brandProfileController && canonicalBrandDetail.status === 'ready');
      assert.equal(calls, 0);
      if (!await p.locator('.profile-discovery').evaluate(n => n.open)) await p.locator('.profile-discovery > summary').click();
      await key('research-domain').fill(website);
      await key('research-start').click();
      await p.waitForFunction(() => !brandProfileController.busy());
      assert.equal(Object.keys(results[0].fields).length, 13);
      assert.equal(crawls, 1);
      assert.deepEqual(f.r.db.brands[0], before);
      assert.deepEqual(clone(f.r.db.boards), snapshot);
      const counts = await p.locator('.profile-review-counts').textContent();
      assert.equal(await key('accept-all-enrichment').isDisabled(), true);
      if (process.argv.includes('--baseline')) {
        assert.equal(counts, '13 Prüfpunkte · 0 Verfügbare Vorschläge · 0 Übernehmbar · 13 Überprüfung erforderlich · 1 Bereits geprüft');
        assert.equal(results[0].fields.contentGuidelines.reason, 'quality_review_required');
        assert.equal(results[0].fields.toneOfVoice.classification, 'missing');
        assert(await p.evaluate(() => brandProfileController.enrichProfile({ action: 'suggest', field: 'toneOfVoice' })));
        assert.equal(results[1].fields.toneOfVoice.classification, 'missing');
        assert.match(await p.locator('[data-disclosure="proposal-attention:toneOfVoice"] > summary').textContent(), /Weitere Informationen erforderlich/);
        console.log('Baseline reproduced: ' + counts + '; identical targeted tone displayed as missing.');
        return;
      }

      assert.equal(counts, '4 Prüfpunkte · 0 Verfügbare Vorschläge · 0 Übernehmbar · 4 Überprüfung erforderlich');
      assert.deepEqual(Object.fromEntries(Object.entries(results[0].fields).map(([k, v]) => [k, v.outcome])), {
        brandCore: 'unchanged', toneOfVoice: 'unchanged', contentGuidelines: 'quality_withheld',
        messagingPillars: 'quality_withheld', dosAndDonts: 'quality_withheld', personas: 'no_usable_evidence',
        keywords: 'invalid_field', valueProposition: 'no_value_generated', brandVoiceExamples: 'no_value_generated',
        brandAssets: 'no_value_generated', mission: 'no_value_generated', vision: 'no_value_generated', values: 'specialized_module_unavailable'
      });
      const history = p.locator('[data-disclosure="saved-profile-review"]');
      assert.match(await history.locator('summary').first().textContent(), /1 Bereits geprüft/);
      assert.equal(await history.locator('[data-disclosure="evidence:toneOfVoice"]').count(), 1);
      assert.match(await history.textContent(), /Sachlich/);
      const resultsDisclosure = p.locator('[data-disclosure="generation-results"]');
      assert.match(await resultsDisclosure.locator('summary').first().textContent(), /\(9\)/);
      assert.match(await resultsDisclosure.textContent(), /Gespeicherter Wert unverändert/);
      assert.match(await resultsDisclosure.textContent(), /Feldinhalt konnte nicht geprüft werden/);
      assert.match(await resultsDisclosure.textContent(), /Spezialisiertes Modul/);
      assert.match(await p.locator('.profile-enrichment-proposal[data-field="dosAndDonts"]').textContent(), /Ausgabesprache/);
      assert.match(await p.locator('.profile-enrichment-proposal[data-field="messagingPillars"]').textContent(), /Zahlenangabe benötigt stützende Belege/);
      assert.match(await p.locator('.profile-enrichment-proposal[data-field="personas"] > summary').textContent(), /Keine verwertbaren Belege/);
      const guidelines = p.locator('.profile-enrichment-proposal[data-field="contentGuidelines"]');
      await guidelines.locator('summary').first().click();
      assert.match(await guidelines.textContent(), /Zweck dieses Feldes/);
      assert.match(await guidelines.textContent(), /Erkläre Wartungsabläufe verständlich/);
      assert.match(await guidelines.textContent(), new RegExp(bad.contentGuidelines[0].slice(0, 18)));
      assert.equal(await key('accept-enrichment-contentGuidelines').count(), 0);
      assert.equal(await guidelines.locator('a').getAttribute('href'), website);
      await key('edit-saved-enrichment-contentGuidelines').click();
      assert.equal(await p.evaluate(() => document.activeElement.dataset.profileKey), 'Content guidelines');
      assert.equal(await key('Content guidelines').inputValue(), 'Erkläre Wartungsabläufe verständlich.');
      assert.equal(await p.locator('[data-field="contentGuidelines"] .profile-field-status').textContent(), 'Gespeichert');
      const correction = 'Erkläre, welche Wartungsschritte vor dem Termin abgestimmt werden.';
      await key('Content guidelines').fill(correction);
      await key('Confirm and save Brand Profile').click();
      await p.waitForFunction(() => !brandProfileController.busy());
      assert.deepEqual(clone(f.r.db.brands[0].brand_core.contentGuidelines), [correction]);
      assert.equal(calls, 1, 'repairing a withheld field uses the existing manual save');
      const idle = () => p.waitForFunction(() => !brandProfileController.busy());
      async function voiceAction(action) {
        await key('Voice & Messaging').click();
        const menu = p.locator('[data-disclosure="field-assistance:toneOfVoice"]');
        if (!await menu.evaluate(el => el.open)) await menu.locator('summary').click();
        await key(action + '-toneOfVoice').click();
        await idle();
      }
      const toneCard = p.locator('.profile-enrichment-proposal[data-field="toneOfVoice"]');
      await voiceAction('suggest');
      assert.equal(inputs.at(-1).intent, 'improve');
      assert.equal(results.at(-1).fields.toneOfVoice.outcome, 'unchanged');
      assert.match(await toneCard.textContent(), /Gespeicherter Wert unverändert/);
      assert.match(await toneCard.textContent(), /Vom Nutzer bestätigt/);
      assert.equal(await key('reject-enrichment-toneOfVoice').count(), 0);
      assert.equal(await key('accept-enrichment-toneOfVoice').count(), 0);
      assert.match(await p.locator('.profile-review-counts').textContent(), /^0 Prüfpunkte/);

      const beforeQuestions = calls;
      await voiceAction('questions');
      assert.equal(calls, beforeQuestions);
      assert.match(await p.locator('.profile-question-guide').textContent(), /bisherigen Stimme/);
      await key('answer-toneOfVoice').fill('Technische Rückfragen verständlicher beantworten.');
      targetedResult = 'adequate';
      await key('Prepare my suggestion').click();
      await idle();
      assert.equal(inputs.at(-1).intent, 'improve');
      assert.equal(inputs.at(-1).answers.length, 1);
      assert.equal(results.at(-1).fields.toneOfVoice.outcome, 'no_improvement');
      assert.match(await toneCard.textContent(), /Keine fundierte Verbesserung gefunden/);
      assert.equal(await key('accept-enrichment-toneOfVoice').count(), 0);

      targetedResult = 'improved';
      await voiceAction('suggest');
      assert.deepEqual(clone(f.r.db.brands[0].brand_core.toneOfVoice), savedTone);
      assert.match(await toneCard.textContent(), /Fachlich präzise/);
      assert.match(await p.locator('.profile-review-counts').textContent(), /^1 Prüfpunkte · 1 Verfügbare Vorschläge · 1 Übernehmbar/);
      async function decide(action) {
        await key(action + '-enrichment-toneOfVoice').click();
        await p.locator('.brand-suggestion-dialog[open] .fk-btn-primary').click();
        await idle();
      }
      await decide('reject');
      assert.deepEqual(clone(f.r.db.brands[0].brand_core.toneOfVoice), savedTone);
      assert.equal(f.r.db.brands[0].brand_core._profileEvidence.fields.toneOfVoice.previousAcceptance.decision, 'accepted');
      assert.equal(await history.locator('[data-disclosure="accepted-evidence:toneOfVoice"]').count(), 1);
      assert.match(await p.locator('.profile-review-counts').textContent(), /^0 Prüfpunkte/);
      await voiceAction('suggest');
      await p.locator('[data-disclosure="proposal-edit:toneOfVoice"] > summary').click();
      await key('enrichment-toneOfVoice-0').fill('Präzise bei technischen Rückfragen');
      await decide('accept');
      assert.deepEqual(clone(f.r.db.brands[0].brand_core.toneOfVoice), ['Präzise bei technischen Rückfragen', improvedTone[1]]);
      assert.equal(f.r.db.brands[0].brand_core._profileEvidence.fields.toneOfVoice.userEdited, true);
      await key('Reload latest Brand').click();
      await idle();
      await key('Voice & Messaging').click();
      assert.match(await key('Tone of Voice').inputValue(), /^Präzise bei technischen Rückfragen/);
      assert.equal(crawls, 1);
      assert.equal(calls, 5);
      assert.deepEqual(clone(f.r.db.boards), snapshot);
      console.log('BW-47.1 R1 browser PASS: 13 field outcomes, separate accepted history, exact counts, manual correction, unchanged and no-improvement labels, questions, deliberate review/edit/adoption and reload. Mocked inference.');
    } finally {
      f.writes.length = 0;
      await f.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
