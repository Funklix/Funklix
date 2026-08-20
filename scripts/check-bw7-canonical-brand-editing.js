#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/runtime-boot-safety.yml"), "utf8");

function source(name) {
  const starts = [`function ${name}(`, `async function ${name}(`].map((value) => app.indexOf(value)).filter((value) => value >= 0);
  assert.ok(starts.length, `missing ${name}`);
  const start = Math.min(...starts);
  const ends = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((value) => value >= 0);
  return app.slice(start, ends.length ? Math.min(...ends) : app.length);
}

const begin = source("beginCanonicalBrandEditing");
const cancel = source("cancelCanonicalBrandEditing");
const close = source("closeCanonicalBrandDetail");
const save = source("submitCanonicalBrandEditing");
const load = source("loadCanonicalBrandDetail");
const create = source("submitCanonicalBrandCreation");
const associate = source("submitBoardBrandAssociation");

assert.match(html, /id="brand-workspace-edit-open"[^>]*>Edit Canonical Brand</, "editing requires an explicit Edit action");
assert.match(html, /class="brand-workspace-edit hidden"/, "BW-6 remains read-only by default");
assert.match(html, /Save Canonical Brand[\s\S]*id="brand-workspace-edit-cancel"/, "save and cancel are explicit actions");
assert.doesNotMatch(begin, /fetch\(|persistBrand|submitCanonical|localStorage|sessionStorage/, "entering edit mode performs no request or persistence");
assert.doesNotMatch(cancel, /fetch\(|localStorage|sessionStorage/, "cancel performs no request");
assert.doesNotMatch(close, /fetch\(|localStorage|sessionStorage|persist/, "closing performs no write");
assert.match(app, /window\.confirm\("Discard unsaved Canonical Brand changes\? Nothing will be saved\."\)/, "dirty lifecycle changes require deliberate discard confirmation");
assert.match(save, /method: "PUT"/, "save reuses PUT");
assert.match(save, /fetch\(`\/api\/brands\/\$\{encodeURIComponent\(detail\.brandId\)\}`/, "save reuses /api/brands/:id");
assert.match(save, /JSON\.stringify\(\{ name, brand_core: brandCore, revision: detail\.draft\.revision \}\)/, "payload contains only accepted fields");
assert.doesNotMatch(save.match(/body: JSON\.stringify\([^\n]+/)[0], /owner|user|board|permission|timestamp|created_at/, "request body supplies no ownership, Board, or authorization fields");
assert.match(save, /catalogValidated[\s\S]*selection\.id !== detail\.brandId[\s\S]*detail\.brand\?\.id !== detail\.brandId/, "target is account, catalog, selection, and detail validated");
assert.match(save, /detail\.saveController\) return/, "duplicate submissions are prevented");
assert.doesNotMatch(save, /setTimeout|while\s*\(|retry|force|recursive/, "save has no automatic retry or conflict bypass");
assert.match(save, /brand\.revision !== expectedRevision[\s\S]*brand\.name !== name[\s\S]*canonicalJson/, "success requires exact authoritative identity, revision, name, and Core");
assert.match(save, /detail\.brand = \(\(\{ id/, "success replaces detail with the authoritative response");
assert.match(save, /entries\.findIndex[\s\S]*entries\.splice\(entryIndex, 1/, "rename updates exactly one catalog summary");
assert.doesNotMatch(save, /persistBrandSwitcherPreference|removeBrandSwitcherPreference|brandSwitcherPreferenceGeneration/, "save preserves the BW-4 preference and selected ID");
assert.doesNotMatch(`${begin}\n${cancel}\n${close}\n${save}\n${load}`, /\/api\/boards|brandCoreState|state\.brandCore|brand_core_snapshot|canvas|autosave|saveBoard|loadBoard|location\.|history\./i, "editing is isolated from Boards, snapshots, Canvas, autosave, and navigation");
assert.doesNotMatch(associate, /canonicalBrandDetail|brandWorkspaceEdit|submitCanonicalBrandEditing/, "BW-5 does not interact with editing");
assert.doesNotMatch(create, /beginCanonicalBrandEditing|openCanonicalBrandDetail|brandWorkspaceDetail/, "creation does not open editing or details");
assert.match(html, /Unknown and forward-compatible fields remain intact/, "the complete JSON editor explains unknown-field preservation");
assert.match(save, /JSON\.parse[\s\S]*!name \|\| name\.length > 160[\s\S]*Array\.isArray\(brandCore\)/, "name and plain-object Brand Core are validated locally");
assert.match(save, /response\.status === 409[\s\S]*detail\.status = "conflict"/, "409 retains the draft without overwrite");
assert.match(html, /id="brand-workspace-conflict-reload"[^>]*>Reload latest Brand</, "reload-latest is deliberate");
assert.match(load, /retainedConflictDraft/, "reload-latest retains the conflict draft");
assert.match(save, /status = "save-error"/g, "failures never present the draft as saved");
assert.match(close, /requestId: previous\.requestId \+ 1[\s\S]*saveId: previous\.saveId \+ 1/, "close invalidates late GET and PUT responses");
assert.match(save, /stillCurrent[\s\S]*saveId === saveId[\s\S]*ephemeralBrandSwitcherSelection/, "late saves are account, selection, dialog, and generation guarded");
assert.match(load, /canonicalBrandDetail\.requestId !== requestId/, "late GET responses are generation guarded");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|currentBrand|canonicalBrandCore)/, "no global Brand authority is introduced");
assert.doesNotMatch(app, /syncCanonical|syncBrandToBoard|synchronizeBrand/, "no Brand-to-Board synchronization is introduced");
assert.match(workflow, /node scripts\/check-bw7-canonical-brand-editing\.js/, "BW-7 check is registered in runtime CI");

console.log("BW-7 explicit Canonical Brand editing checks passed.");
