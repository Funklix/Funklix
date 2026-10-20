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
assert.match(close, /guardBrandProfileLeave/, "dirty lifecycle changes use the internal leave dialog; R5 verifies its three actions in Chromium");
// BW-36.23A delegates transport; require the actual protected invocation,
// then exercise the production editor and helper together below.
const writeContract = fs.readFileSync(path.join(root, "brand-write-contract.js"), "utf8");
assert.match(save, /BrandWriteContract\.command\(\{ \.\.\.detail\.brand, revision: detail\.draft\.revision \}, \{ name, brand_core: brandCore \}, workspaceId, 'advanced_edit'\)/, "explicit editor input builds a revision-bound field command");
assert.match(save, /BrandWriteContract\.submit\(\{ fetchImpl: fetch, brandId: detail\.brandId, command: writeCommand/, "save invokes protected transport for exactly the captured canonical Brand");
assert.match(save, /expectedState = BrandWriteContract\.apply\(detail\.brand, writeCommand\)/, "authoritative verification includes preserved unspecified knowledge");
assert.match(writeContract, /fetchImpl\(`\/api\/brands\/\$\{brandId\}`, \{ method: 'PUT'/, "shared transport retains PUT /api/brands/:id");
assert.match(writeContract, /body: JSON\.stringify\(command\)/, "transport submits the field contract rather than a legacy full-document payload");
assert.match(save, /catalogValidated[\s\S]*selection\.id !== detail\.brandId[\s\S]*detail\.brand\?\.id !== detail\.brandId/, "target is account, catalog, selection, and detail validated");
assert.match(save, /detail\.saveController\) return/, "duplicate submissions are prevented");
assert.doesNotMatch(save, /setTimeout|while\s*\(|retry|force|recursive/, "save has no automatic retry or conflict bypass");
assert.match(save, /brand\.revision !== expectedRevision[\s\S]*brand\.name !== name[\s\S]*canonicalJson/, "success requires exact authoritative identity, revision, name, and Core");
assert.match(save, /detail\.brand = brand/, "success replaces detail with the authoritative response");
assert.match(save, /reconcileConfirmedBrand\(brand\)/, "rename uses the shared confirmed projection boundary");
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
assert.match(save, /stillCurrent[\s\S]*saveId === saveId[\s\S]*state\.workspaceCatalog\.generation === generation/, "late saves are account, authoritative workspace, dialog, and generation guarded");
assert.match(load, /canonicalBrandDetail\.requestId !== requestId/, "late GET responses are generation guarded");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|currentBrand|canonicalBrandCore)/, "no global Brand authority is introduced");
assert.doesNotMatch(app, /syncCanonical|syncBrandToBoard|synchronizeBrand/, "no Brand-to-Board synchronization is introduced");
assert.match(workflow, /node scripts\/check-bw7-canonical-brand-editing\.js/, "BW-7 check is registered in runtime CI");

// Client invocation fixture, not a substitute for the real PostgreSQL suite.
// Loads the actual shared module and extracted production editor functions;
// only DOM/projection effects and external transport are disposable substitutes.
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const contract = require('../brand-write-contract');
const clone = value => JSON.parse(JSON.stringify(value));
const B = '11111111-1111-4111-8111-111111111111';
const W = '22222222-2222-4222-8222-222222222222';
const T = '2026-10-20T10:00:00.000Z';
function editor(options = {}) {
  let canonical = { id: B, workspace_id: W, name: 'Fixture', revision: 7, created_at: T, updated_at: T,
    access: { role: 'owner', canEditCanonicalBrand: true, canManageBrandMembers: true },
    brand_core: { brandCore: 'Confirmed', brandDNA: { userApproved: true, avatar: { userApproved: true, imageUrl: 'https://fixture.test/accepted.png', unknown: 1 } }, future: { keep: 42 } } };
  const requests = [], events = [], reviews = [], projected = [], receipts = new Map();
  let reviewedCommand = null;
  const control = value => ({ value, textContent: '', focus() {} });
  const context = {
    crypto: { randomUUID }, Buffer, TextEncoder, AbortController, console,
    state: { user: { email: 'fixture@example.test' }, workspaceCatalog: { status: 'ready', generation: 3, activeWorkspaceId: W,
      value: { workspaces: [{ id: W, brands: [{ id: B, revision: 7, role: 'owner' }] }] } } },
    canonicalBrandDetail: { status: 'ready', brandId: B, userEmail: 'fixture@example.test', brand: clone(canonical), draft: null, saveId: 0, saveController: null, saved: false },
    el: { brandWorkspaceDetail: { open: true }, brandWorkspaceEditName: control(''), brandWorkspaceEditCore: control(''), brandWorkspaceEditFeedback: control(''), brandWorkspaceEditOpen: control(''), brandWorkspaceDetailStatus: control('') },
    uiText: value => value, renderCanonicalBrandDetail() {}, renderEphemeralBrandSwitcherSelection() {}, renderBrandCatalog() {},
    reconcileConfirmedBrand(value) { projected.push(clone(value)); },
    confirm(message) { reviews.push(message); return options.confirm !== false; },
    async fetch(url, init) {
      assert([`/api/brands/${B}`, `/api/brands/${B}/write-preview`].includes(url), 'editor must never reach Board/Canvas/provider transport');
      const command = JSON.parse(init.body); requests.push({ url, method: init.method, command, headers: init.headers });
      if (options.wait) await options.wait;
      if (options.throwNetwork) throw new Error('Disposable network failure');
      if (options.status) return { ok: false, status: options.status, json: async () => ({ code: 'REJECTED' }) };
      contract.normalize(command);
      if (command.workspace_id !== W || command.expected_revision !== String(canonical.revision)) return { ok: false, status: 409, json: async () => ({ code: 'STALE_UPDATE' }) };
      if (url.endsWith('/write-preview')) {
        assert.equal(init.method, 'POST'); reviewedCommand = contract.stable(command);
        return { ok: true, status: 200, json: async () => ({ changes: command.changes, review_token: 'disposable-exact-review' }) };
      }
      assert.equal(init.method, 'PUT');
      if (command.changes.some(contract.destructive)) {
        assert.equal(init.headers['X-Brand-Review'], 'disposable-exact-review');
        assert.equal(contract.stable(command), reviewedCommand, 'review and commit bind identical intent');
      }
      const previous = clone(canonical);
      canonical = { ...canonical, ...contract.apply(canonical, command), revision: canonical.revision + (command.changes.length ? 1 : 0) };
      events.push({ before: previous, after: clone(canonical), command }); receipts.set(command.mutation_id, clone(canonical));
      const result = options.corrupt ? options.corrupt(clone(canonical)) : clone(canonical);
      return { ok: true, status: 200, json: async () => result };
    }
  };
  vm.createContext(context);
  vm.runInContext(writeContract, context, { filename: 'brand-write-contract.js' });
  for (const name of ['canonicalJson', 'isCanonicalBrandDetail', 'canonicalBrandSaveError', 'beginCanonicalBrandEditing', 'submitCanonicalBrandEditing']) vm.runInContext(name === 'isCanonicalBrandDetail' ? source(name).split('\n// No Board snapshot')[0] : source(name), context, { filename: 'app.js#' + name });
  return { context, requests, events, reviews, projected, get canonical() { return clone(canonical); },
    begin() { context.beginCanonicalBrandEditing(); },
    draft(name = 'Renamed', core = { brandCore: 'Edited' }) { context.el.brandWorkspaceEditName.value = name; context.el.brandWorkspaceEditCore.value = JSON.stringify(core); },
    submit() { return context.submitCanonicalBrandEditing({ preventDefault() {} }); } };
}
let groups = 0;
async function check(name, fn) { await fn(); groups++; console.log('PASS ' + name); }
(async () => {
  await check('explicit authorized edit invokes real helper PUT with correct identity revision and field intent', async () => {
    const f = editor(), old = f.canonical;
    assert.equal(f.requests.length, 0); f.begin(); assert.equal(f.context.canonicalBrandDetail.status, 'editing'); assert.equal(f.requests.length, 0);
    f.draft(); await f.submit();
    assert.equal(f.requests.length, 1); const req = f.requests[0];
    assert.equal(req.url, `/api/brands/${B}`); assert.equal(req.method, 'PUT'); assert.equal(req.command.contract, contract.CONTRACT);
    assert.deepEqual(Object.keys(req.command).sort(), ['changes', 'contract', 'expected_revision', 'mutation_id', 'operation', 'workspace_id']);
    for (const forbidden of ['owner_email', 'actor', 'permissions', 'board_id', 'source_event_id']) assert.throws(() => contract.normalize({ ...req.command, [forbidden]: 'forged' }), 'no ownership/authorization/Board fields may enter the canonical envelope');
    assert.equal(req.command.expected_revision, '7'); assert.equal(req.command.workspace_id, W); assert.equal(req.command.operation, 'advanced_edit'); assert(contract.UUID.test(req.command.mutation_id));
    assert.deepEqual(req.command.changes.map(c => c.path).sort(), ['/brand_core/brandCore', '/name']);
    assert.deepEqual(req.command.changes.find(c => c.path === '/brand_core/brandCore').expected, { exists: true, value: 'Confirmed' });
    assert.equal(f.context.canonicalBrandDetail.status, 'ready'); assert.equal(f.context.canonicalBrandDetail.saved, true); assert.equal(f.context.canonicalBrandDetail.draft, null);
    assert.equal(f.canonical.name, 'Renamed'); assert.equal(f.canonical.revision, 8); assert.equal(f.events.length, 1); assert.equal(f.projected.length, 1);
    assert.deepEqual(clone(f.context.canonicalBrandDetail.brand), f.canonical);
    assert.deepEqual(f.canonical.brand_core.brandDNA, old.brand_core.brandDNA); assert.deepEqual(f.canonical.brand_core.future, old.brand_core.future); assert.equal(f.reviews.length, 0);
  });
  await check('unchanged explicit save verifies a no-op without inventing a revision increment', async () => {
    const f = editor(); f.begin(); await f.submit(); assert.equal(f.requests[0].command.changes.length, 0); assert.equal(f.canonical.revision, 7); assert.equal(f.context.canonicalBrandDetail.saved, true);
  });
  for (const field of ['id', 'revision', 'name', 'brand_core']) await check('unverified success with wrong ' + field + ' retains draft and never projects saved state', async () => {
    const f = editor({ corrupt(value) { value[field] = field === 'revision' ? 99 : field === 'brand_core' ? {} : 'wrong'; return value; } });
    f.begin(); f.draft(); await f.submit(); assert.equal(f.context.canonicalBrandDetail.status, 'save-error'); assert.equal(f.context.canonicalBrandDetail.saved, false); assert(f.context.canonicalBrandDetail.draft); assert.equal(f.projected.length, 0);
  });
  for (const status of [409, 401, 403, 404, 422, 428, 503]) await check('HTTP ' + status + ' retains draft without canonical or history change', async () => {
    const f = editor({ status }), old = f.canonical; f.begin(); f.draft(); await f.submit();
    assert.equal(f.context.canonicalBrandDetail.status, status === 409 ? 'conflict' : 'save-error'); assert(f.context.canonicalBrandDetail.draft); assert.equal(f.context.canonicalBrandDetail.saved, false); assert.deepEqual(f.canonical, old); assert.equal(f.events.length, 0); assert.equal(f.projected.length, 0);
  });
  await check('viewer cannot enter explicit edit mode or submit', async () => {
    const f = editor(); f.context.canonicalBrandDetail.brand.access = { role: 'viewer', canEditCanonicalBrand: false, canManageBrandMembers: false }; f.begin(); await f.submit(); assert.equal(f.context.canonicalBrandDetail.status, 'ready'); assert.equal(f.requests.length, 0);
  });
  await check('reviewed clear uses preview then protected PUT with exact intent and preserves unrelated knowledge', async () => {
    const f = editor(), old = f.canonical; f.begin(); f.draft('Fixture', { brandCore: '' }); await f.submit();
    assert.deepEqual(f.requests.map(r => r.method), ['POST', 'PUT']); assert.equal(f.reviews.length, 1); assert(f.reviews[0].includes('Confirmed')); assert.equal(f.events.length, 1); assert.equal(f.canonical.brand_core.brandCore, ''); assert.deepEqual(f.canonical.brand_core.brandDNA, old.brand_core.brandDNA);
  });
  await check('cancelled destructive review sends no mutation and records no history', async () => {
    const f = editor({ confirm: false }), old = f.canonical; f.begin(); f.draft('Fixture', { brandCore: null }); await f.submit(); assert.deepEqual(f.requests.map(r => r.method), ['POST']); assert.deepEqual(f.canonical, old); assert.equal(f.events.length, 0); assert(f.context.canonicalBrandDetail.draft);
  });
  await check('network error retains the exact command and local draft for deliberate retry', async () => {
    const f = editor({ throwNetwork: true }), old = f.canonical; f.begin(); f.draft(); await f.submit(); assert.equal(f.context.canonicalBrandDetail.status, 'save-error'); assert(f.context.canonicalBrandDetail.draft); assert.deepEqual(f.canonical, old); assert.equal(f.events.length, 0); assert.deepEqual(clone(f.context.canonicalBrandDetail.pendingWrite.command), f.requests[0].command);
  });
  for (const scope of ['account', 'catalog', 'workspace', 'brand']) await check(scope + ' mismatch blocks a new canonical submission', async () => {
    const f = editor(); f.begin(); f.draft(); if (scope === 'account') f.context.state.user = { email: 'other@example.test' }; if (scope === 'catalog') f.context.state.workspaceCatalog.status = 'loading'; if (scope === 'workspace') f.context.state.workspaceCatalog.activeWorkspaceId = randomUUID(); if (scope === 'brand') f.context.canonicalBrandDetail.brand.id = randomUUID(); await f.submit(); assert.equal(f.requests.length, 0); assert.equal(f.events.length, 0);
  });
  await check('duplicate in-flight submissions cannot send a second mutation', async () => {
    let release; const wait = new Promise(resolve => { release = resolve; }); const f = editor({ wait }); f.begin(); f.draft(); const pending = f.submit(); await f.submit(); assert.equal(f.requests.length, 1); release(); await pending; assert.equal(f.events.length, 1); assert.equal(f.projected.length, 1);
  });
  for (const scope of ['account', 'generation', 'workspace']) await check('late ' + scope + ' response cannot project into a replacement context', async () => {
    let release; const wait = new Promise(resolve => { release = resolve; }); const f = editor({ wait }); f.begin(); f.draft(); const pending = f.submit();
    if (scope === 'account') f.context.state.user = { email: 'fixture@example.test' }; if (scope === 'generation') f.context.state.workspaceCatalog.generation++; if (scope === 'workspace') f.context.state.workspaceCatalog.activeWorkspaceId = randomUUID(); release(); await pending;
    assert.equal(f.projected.length, 0); assert(f.context.canonicalBrandDetail.draft); assert.equal(f.requests.length, 1); assert.equal(f.requests[0].command.workspace_id, W);
  });
  console.log(`BW-7 explicit Canonical Brand editing: source invariants and ${groups} production-path groups passed. SQL atomicity/authorization require the real PostgreSQL suite.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
