#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js"), html = read("index.html"), source = read("language.js");
function loadLanguage(saved) {
  const store = new Map(saved ? [["funklix.languagePreferences.v1", JSON.stringify(saved)]] : []);
  const localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  const sandbox = { module: { exports: {} }, localStorage, window: { localStorage } };
  vm.runInNewContext(source, sandbox, { filename: "language.js" }); return sandbox.module.exports;
}
const deBoot = loadLanguage({ uiLanguage: "de", campaignLanguage: "en" });
assert.strictEqual(deBoot.getPreferences().uiLanguage, "de", "saved German must be authoritative at boot");
const enBoot = loadLanguage(); assert.strictEqual(enBoot.getPreferences().uiLanguage, "en");
for (const [key, expected] of [["Home", "Startseite"], ["My Boards", "Meine Boards"], ["AI Brain", "KI-Brain"], ["Activity", "Aktivität"], ["Draft", "Entwurf"], ["Approved", "Freigegeben"]]) assert.strictEqual(deBoot.t(key, "de"), expected);
assert.strictEqual(deBoot.setUiLanguage("en"), "en"); assert.strictEqual(deBoot.t("Activity"), "Activity"); assert.strictEqual(deBoot.setUiLanguage("de"), "de");
const refresh = app.slice(app.indexOf("function refreshInterfaceLanguage"), app.indexOf('window.addEventListener("funklix:themechange"'));
for (const renderer of ["renderActivityFeed", "renderBoardsLibrary", "renderBrandCoreTiles", "renderBrandCoreEditor", "renderAiBrain", "refreshDashboardIfVisible"]) assert(refresh.includes(renderer), `language refresh omits ${renderer}`);
assert(!/markUnsaved|scheduleAutoSave|saveBoardToServer|invalidateAiBrainRequest\(\)|messages\s*=|nodes\s*=/.test(refresh), "language refresh mutates persistent runtime state");
const activity = app.slice(app.indexOf("function formatActivityAction"), app.indexOf("function currentBoardAwarenessKey"));
for (const type of ["node_created", "node_moved", "node_updated", "status_changed", "owner_assigned", "owner_unassigned", "comment_added", "reply_added", "comment_resolved", "schedule_created", "schedule_rescheduled", "schedule_removed"]) assert(activity.includes(type), `activity template missing ${type}`);
assert(activity.includes('days === 1 ? "Tag" : "Tagen"'), "German relative-time pluralization missing");
assert(app.includes("preservedComposerValue"), "editable AI prompt is not preserved across chrome rerenders");
assert(/question\.textContent = turn\.question/.test(app) && /renderAiBrainFormattedAnswer\(formatted, turn\.answer\)/.test(app), "transcript content boundary changed");
assert(/board-row-title[^<]*\$\{escapeHtml\(boardName\)\}/.test(app), "Board identity must remain authored");
assert(app.includes('copy.dataset.userContent = "true"'), "generated proposal content lacks user-content boundary");
for (const id of ["dashboard-view", "boards-library-view", "brand-core-workspace", "ai-brain-view", "activity-panel"]) assert(html.includes(`id="${id}"`), `legacy DOM id removed: ${id}`);
assert(source.includes("diagnoseInterface") && source.includes("[data-user-content]"), "bounded non-content diagnostic missing");
assert(!/fetch\(|\/api\//.test(source), "localization must not add provider calls");
console.log("BW-25.2 scoped German interface localization checks passed.");
