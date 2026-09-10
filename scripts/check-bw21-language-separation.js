#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const language = require(path.join(root, "language.js"));

assert.deepStrictEqual(language.UI_LANGUAGES, ["en", "de"]);
assert.deepStrictEqual(language.CAMPAIGN_LANGUAGES, ["en", "de", "es"]);
assert.strictEqual(language.DEFAULT_UI_LANGUAGE, "en");
assert.strictEqual(language.DEFAULT_CAMPAIGN_LANGUAGE, "en");

const memory = (value) => ({ value, getItem() { return this.value; }, setItem(_key, next) { this.value = next; } });
assert.deepStrictEqual(language.restorePreferences(memory('{"uiLanguage":"de","campaignLanguage":"es"}')), { uiLanguage: "de", campaignLanguage: "es" });
assert.deepStrictEqual(language.restorePreferences(memory('{"uiLanguage":"xx","campaignLanguage":"French","token":"secret"}')), { uiLanguage: "en", campaignLanguage: "en" });
assert.deepStrictEqual(language.restorePreferences(memory("not-json")), { uiLanguage: "en", campaignLanguage: "en" });
assert.strictEqual(language.t("missing canonical English key", "de"), "missing canonical English key");
assert.strictEqual(language.generationInstruction("es").name, "Spanish");
assert.strictEqual(language.generationInstruction("free form").id, "en");

const app = read("app.js");
const html = read("index.html");
const api = read("api/generate-campaign.js");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
assert.match(app, /uiLanguage: initialLanguagePreferences\.uiLanguage/);
assert.match(app, /campaignLanguage: initialLanguagePreferences\.campaignLanguage/);
assert.match(app, /capturedCampaignLanguage = state\.campaignLanguage/);
assert.match(app, /campaignLanguage: state\.campaignLanguage/);
assert.match(app, /generationToken = Symbol\("campaign-generation"\)/);
assert.match(app, /state\.activeCampaignGeneration !== generationToken/);
assert.match(app, /campaignContext\?\.setup\?\.campaignLanguage/);
assert.match(app, /onRetry\(setup\)/);
assert.match(app, /Language preferences are UI-only browser preferences/);
assert.doesNotMatch(app.slice(app.indexOf("uiLanguageSelect?.addEventListener"), app.indexOf("campaignLanguageSelect?.addEventListener")), /markUnsaved|saveCampaign|autosave|brandSwitcher/);
assert.match(html, /language\.js[\s\S]*campaign-v3\.js[\s\S]*app\.js/);
assert.match(api, /CAMPAIGN_LANGUAGES = Object\.freeze\(\{ en: "English", de: "German", es: "Spanish" \}\)/);
assert.match(api, /structural JSON property names, node type values, status enums, validation codes, IDs, schema fields/);
assert.match(api, /campaignLanguage,/);
assert.match(workflow, /check-bw20-1-inline-brand-role-management\.js[\s\S]*check-bw21-language-separation\.js/);
assert.doesNotMatch(language.toString(), /translate\.google|deepl|i18next|fetch\(|XMLHttpRequest/);

const exposed = new Set();
for (const match of html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) exposed.add(match[1]);
[
  "Language preferences", "Interface language", "Campaign language",
  "Interface language changes Funklix controls and messages.",
  "Campaign language is used for newly generated campaign content.",
  "Existing Boards and content are not translated automatically."
].forEach((key) => exposed.add(key));
for (const key of exposed) assert.ok(language.dictionaries.de[key], `Missing German translation: ${key}`);

// Structural values remain canonical and user/Board/Brand/member content has no translation hook.
["Idea", "Campaign Variation", "Social Media Posting", "Draft", "Approved", "Published"].forEach((value) => assert.ok(app.includes(`"${value}"`)));
assert.doesNotMatch(app, /translateInterface\((?:state\.nodes|state\.brandCore|state\.boardsLibrary|state\.user)/);
console.log("BW-21 language separation checks passed.");
