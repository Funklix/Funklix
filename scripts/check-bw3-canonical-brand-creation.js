#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `missing ${name}`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

const open = functionSource("openCanonicalBrandCreation");
const reset = functionSource("resetCanonicalBrandCreation");
const submit = functionSource("submitCanonicalBrandCreation");
const select = functionSource("selectEphemeralBrandFromSwitcher");

assert.match(html, /id="brand-switcher-create-open"[^>]*disabled>Create Brand</, "authenticated rendering must enable an explicit Create Brand action");
assert.doesNotMatch(html, /Create Brand coming soon/, "the placeholder must be removed");
assert.match(html, /<form[^>]*id="brand-switcher-create-form"[^>]*aria-labelledby=/, "creation must use a named form");
assert.match(html, /<label for="brand-switcher-create-name">Brand name<\/label>/, "name input must have a real label");
assert.match(html, /id="brand-switcher-create-name"[^>]*maxlength="160"/, "client maximum must match the server contract");
assert.doesNotMatch(open, /ephemeralBrandSwitcherSelection|selectEphemeralBrandFromSwitcher/, "opening creation must not select a Brand");
assert.match(submit, /\.value\.trim\(\)/, "names must be trimmed before validation and submission");
assert.match(submit, /if \(!name \|\| name\.length > 160\)/, "empty and overlong names must be rejected client-side");
assert.match(submit, /status === "submitting"\) return/, "duplicate pending submission must be ignored");
assert.match(submit, /fetch\("\/api\/brands", \{[\s\S]*method: "POST"/, "creation must use the existing Canonical Brand collection API");
assert.match(submit, /JSON\.stringify\(\{ name, brand_core: \{\} \}\)/, "only the API-required creation fields may be sent");
assert.match(submit, /isCanonicalBrandSummary\(brand\)/, "only a validated server response may enter the catalog");
assert.match(submit, /existing\.filter\(\(\{ id \}\) => id !== summary\.id\)/, "server-confirmed catalog insertion must deduplicate by ID");
assert.doesNotMatch(submit, /selectEphemeralBrandFromSwitcher|ephemeralBrandSwitcherSelection\s*=|location\.|history\.|reload|brand_id|brandCore|boardsLibrary|autosave/i, "creation must not select, navigate, persist, or affect Boards or Canvas");
assert.doesNotMatch(reset, /fetch\(|XMLHttpRequest/, "cancellation must perform no write");
assert.match(reset, /requestId: state\.brandCreation\.requestId \+ 1/, "cancellation must invalidate late creation responses");
assert.match(app, /previousUserEmail !== currentUserEmail\) resetCanonicalBrandCreation\(\)/, "account changes must clear creation state");
assert.match(app, /state\.user = null;[\s\S]{0,300}resetCanonicalBrandCreation\(\)/, "sign-out must clear creation state");
assert.match(submit, /requestId !== state\.brandCreation\.requestId/g, "late responses must be checked before applying results");
assert.doesNotMatch(`${open}\n${reset}\n${submit}`, /localStorage|sessionStorage|document\.cookie|indexedDB|history\.|serviceWorker/, "Brand creation must add no durable selection or recovery path");

console.log("BW-3 Canonical Brand creation checks passed.");
