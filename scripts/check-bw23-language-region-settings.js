#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const language = read("language.js");
const css = read("styles.css");
const workflow = read(".github/workflows/runtime-boot-safety.yml");
const count = (source, pattern) => (source.match(pattern) || []).length;

// One global, board-independent entry and one static modal surface are present in the shell.
assert.strictEqual(count(html, /id="settings-open-btn"/g), 1, "expected one Settings sidebar entry");
assert.strictEqual(count(html, /id="settings-dialog"/g), 1, "expected one Settings dialog");
assert(html.indexOf("settings-open-btn") < html.indexOf("</aside>"), "Settings must live in the global sidebar");
assert(/class="nav-item settings-nav-item/.test(html), "Settings should use compact sidebar navigation styling");
assert(/data-icon="⚙️"/.test(html), "Settings icon is missing");
assert(!/public-board-view[^}]*settings-open-btn[^}]*display:\s*none/s.test(html + css), "public viewers must retain Settings");
assert(/@media \(max-width: 1300px\)[\s\S]*\.sidebar \.settings-nav-item \{ display: flex/.test(css), "responsive Settings entry is missing");

// The only interactive language controls are the authoritative legacy IDs in Settings.
assert.strictEqual(count(html + app, /id=["']ui-language-select["']/g), 1, "expected exactly one Interface language selector");
assert.strictEqual(count(html + app, /id=["']campaign-language-select["']/g), 1, "expected exactly one Campaign language selector");
const utilities = app.slice(app.indexOf("function buildUtilitiesPopoverHtml"), app.indexOf("function closeUtilitiesPopover"));
assert(!/language-preferences|ui-language-select|campaign-language-select/.test(utilities), "Utilities still exposes language controls");
for (const label of ["Board", "View", "Layout", "Save Board", "Board View", "Fit to Board", "Auto Arrange", "Compact All", "Expand All"]) {
  assert(utilities.includes(label), `Utilities lost ${label}`);
}

// Existing local language authority, validation, restoration, and independent setters remain intact.
assert(language.includes('const STORAGE_KEY = "funklix.languagePreferences.v1"'), "language storage key changed");
assert(language.includes('UI_LANGUAGES = Object.freeze(["en", "de"])'), "Interface allowlist changed");
assert(language.includes('CAMPAIGN_LANGUAGES = Object.freeze(["en", "de", "es"])'), "campaign allowlist changed");
assert(/restorePreferences[\s\S]*allowed\(parsed\.uiLanguage[\s\S]*allowed\(parsed\.campaignLanguage/.test(language), "safe restoration contract changed");
assert(/setUiLanguage\?\.\(el\.uiLanguageSelect\.value\)[\s\S]*translateInterface\(document\)[\s\S]*refreshOpenInspectorLanguage/.test(app), "Interface language is not applied immediately to UI and Inspector");
assert(/setCampaignLanguage\?\.\(el\.campaignLanguageSelect\.value\)[\s\S]*Campaign language changed/.test(app), "campaign language change is not independent");
const settingsLifecycle = app.slice(app.indexOf('el.settingsOpenButton?.addEventListener'), app.indexOf('el.activityToggleButton?.addEventListener'));
assert(settingsLifecycle.includes("language?.getPreferences?.()"), "Settings does not reflect authoritative preferences when opened");
assert(!/markUnsaved|scheduleAutoSave|workspaceBrand|selectedBrand/.test(settingsLifecycle), "Settings mutates Board/autosave/Workspace Brand state");

// Accessible modal lifecycle: deliberate open, explicit close, Escape/cancel, and focus restoration.
assert(/settingsDialog\.showModal\(\)/.test(settingsLifecycle), "Settings is not opened modally");
assert(/settingsCloseButton\?\.addEventListener\("click"/.test(settingsLifecycle), "explicit Close handler missing");
assert(/settingsDialog\?\.addEventListener\("cancel"/.test(settingsLifecycle), "Escape/cancel lifecycle missing");
assert(/settingsDialog\?\.addEventListener\("close"[\s\S]*settingsOpenButton\?\.focus/.test(settingsLifecycle), "focus is not restored");
assert(/settings-dialog-title" tabindex="-1"/.test(html) && /settings-dialog-title"\)\?\.focus/.test(settingsLifecycle), "predictable initial focus missing");
assert.strictEqual(count(app, /settingsOpenButton\?\.addEventListener\("click"/g), 1, "duplicate Settings open handler");
assert(!/settingsDialog[^\n]*addEventListener\("click"/.test(settingsLifecycle), "dialog-wide click dismissal could close on field interaction");
assert(/role="status" aria-live="polite"/.test(html), "polite preference status is missing");

// Labels include readable language names alongside supportive flags, and all new copy is bilingual.
for (const id of ["ui-language-select", "campaign-language-select"]) assert(html.includes(`for="${id}"`), `${id} has no label`);
for (const option of ["🇬🇧 English", "🇩🇪 Deutsch", "🇪🇸 Español"]) assert(html.includes(option), `${option} is missing`);
for (const key of ["Settings", "Close Settings", "Language & Region", "Changes Funklix controls and messages.", "Used for newly generated campaign content.", "🇬🇧 English", "🇩🇪 German", "🇪🇸 Spanish", "Interface language changed.", "Campaign language changed."]) {
  assert(language.includes(`"${key}"`), `German translation missing for ${key}`);
}

// Guard isolation and integration scope.
const changedRuntime = html + app + language + css;
assert(!/\/api\/.*preferences|language_preferences|ALTER TABLE|CREATE TABLE/.test(changedRuntime), "backend/schema preference work was introduced");
assert(workflow.indexOf("check-bw21-1-inspector-language-coverage.js") < workflow.indexOf("check-bw23-language-region-settings.js"), "BW-23 check must follow BW-21.1");
require("./check-bw21-language-separation.js");
require("./check-bw21-1-inspector-language-coverage.js");

console.log("BW-23 Language & Region Settings checks passed.");
