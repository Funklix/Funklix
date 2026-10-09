#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const route = fs.readFileSync(path.join(root, "api/brands/[id].js"), "utf8");
const access = fs.readFileSync(path.join(root, "api/_brand-access.js"), "utf8");

function source(name) {
  const patterns = [`function ${name}(`, `async function ${name}(`];
  const start = Math.min(...patterns.map((pattern) => app.indexOf(pattern)).filter((index) => index >= 0));
  assert.ok(Number.isFinite(start), `missing ${name}`);
  const candidates = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)].filter((index) => index >= 0);
  return app.slice(start, candidates.length ? Math.min(...candidates) : app.length);
}

const open = source("openCanonicalBrandDetail");
const load = source("loadCanonicalBrandDetail");
const regular = source("openRegularBrandProfile");
const resolve = source("resolveRegularBrandProfile");
const close = source("closeCanonicalBrandDetail");
const render = source("renderCanonicalBrandDetail");
const catalog = source("loadCanonicalBrandCatalog");
const restore = source("restoreBrandSwitcherPreference");
const create = source("submitCanonicalBrandCreation");
const associate = source("submitBoardBrandAssociation");

assert.match(html, /<dialog[^>]+id="brand-workspace-detail"[^>]+aria-labelledby="brand-workspace-detail-title"/, "detail must be an accessible dialog");
assert.match(html, /id="brand-workspace-detail-context"[^>]+data-i18n="These details help shape your future campaigns\."/, "R4 reusable Profile must retain its localized, accessible description");
assert.match(html, /id="brand-workspace-detail-close"[^>]+aria-label=/, "detail must have an explicit accessible close action");
assert.match(app, /brandWorkspaceDetailOpen\?\.addEventListener\("click", openCanonicalBrandDetail\)/, "detail fetch must begin from a deliberate open action");
assert.doesNotMatch(catalog, /\/api\/brands\/\$\{|loadCanonicalBrandDetail|openCanonicalBrandDetail/, "catalog/switcher opening must not request details");
assert.doesNotMatch(restore, /fetch\(|loadCanonicalBrandDetail|openCanonicalBrandDetail/, "BW-4 restoration must not request details");
assert.doesNotMatch(create, /loadCanonicalBrandDetail|openCanonicalBrandDetail|brandWorkspaceDetail/, "creation must not open or fetch detail");
assert.doesNotMatch(associate, /loadCanonicalBrandDetail|openCanonicalBrandDetail|brandWorkspaceDetail|\/api\/brands\//, "BW-5 association must not affect detail");
assert.match(open.trim(), /^function openCanonicalBrandDetail\(\) \{ openRegularBrandProfile\(\); \}$/, "compatibility wrapper must only delegate to the regular Profile");
assert.match(regular, /resolveRegularBrandProfile\(\)/, "regular entry must resolve authorized context");
assert.match(regular, /canonicalBrandDetail\.brandId = entry\.brand\?\.id \|\| ''/, "regular entry must use the resolved Brand, not an unchecked ID");
assert.match(regular, /entry\.kind === 'brand'[\s\S]*loadCanonicalBrandDetail\(\)/, "detail loading must follow a resolved Brand entry");
assert.doesNotMatch(`${open}\n${regular}\n${resolve}`, /state\.brandCatalog|ephemeralBrandSwitcherSelection|localStorage|sessionStorage/, "regular entry authority must not depend on the legacy selector or browser storage");
assert.match(load, /fetch\(`\/api\/brands\/\$\{encodeURIComponent\(selection\.id\)\}`/, "detail must reuse authenticated GET /api/brands/:id");
assert.doesNotMatch(load, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|\/api\/boards|brandCore|canvas|autosave|localStorage|sessionStorage|location\.|history\./, "detail loading must perform no writes, Board work, synchronization, or navigation");
assert.doesNotMatch(`${open}\n${close}\n${render}`, /fetch\([^)]*,\s*\{[^}]*method:|\/api\/boards|persistBrandSwitcherPreference|removeBrandSwitcherPreference|state\.brandCore|canvas|autosave/, "default detail actions must remain read-only and isolated");
assert.match(load, /response\.status === 401/, "expired authentication must be handled");
assert.match(app, /\[403, 404\]\.includes\(status\)/, "forbidden and missing Brands must be unavailable without disclosure");
assert.match(load, /isCanonicalBrandDetail\(brand, selection\.id\)/, "authoritative response must be validated before rendering");
assert.match(load, /canonicalBrandDetail\.requestId !== requestId/, "late and superseded responses must be rejected");
assert.match(load, /state\.workspaceCatalog\.value\?\.workspaces\.find/, "load target must belong to the authorized Workspace catalog");
assert.doesNotMatch(load, /ephemeralBrandSwitcherSelection\?\.id|state\.brandCatalog\.(?:status|userEmail|entries).*selection/, "pending response authority must not depend on the legacy selection");
assert.match(close, /controller\?\.abort\(\)/, "close must abort an in-flight request");
assert.doesNotMatch(close, /persist|localStorage|sessionStorage|brandSwitcherPreference|\/api\//, "close must preserve selection and perform no write");
assert.match(app, /clearEphemeralBrandSwitcherSelection[\s\S]{0,280}closeCanonicalBrandDetail/, "no selection must clear detail locally");
assert.match(app, /brandWorkspaceDetailRetry\?\.addEventListener\("click"/, "retry must require a deliberate click");
assert.match(render, /textContent = readableBrandCoreValue/, "authorized Brand Core fields must render through textContent only");
assert.match(render, /detail\.status !== "ready"/, "only ready detail may render confirmed Brand values");
assert.doesNotMatch(render, /contenteditable/, "read-only detail values must not become directly editable");
assert.doesNotMatch(app, /(?:window|globalThis)\.(?:activeBrand|currentBrand|selectedBrand)/, "no authoritative active Brand global may be introduced");
assert.match(route, /const user = getSessionUser\(req\)/, "Brand item route must authenticate the request");
assert.match(route, /getOwnedBrand\(id, user\)/, "Brand item route must enforce owned access");
assert.match(access, /WHERE id = \$1 AND owner_email = \$2/, "Brand ownership must not derive from Board association");
assert.doesNotMatch(access, /FROM boards|board_editors/, "Board-specific access must not grant Canonical Brand access");
assert.match(app, /addEventListener\("cancel"/, "Escape must use the dialog cancel lifecycle");

// Execute the actual production resolver and loader, without network or database.
async function checkCurrentAuthority() {
  let opens = 0;
  vm.runInNewContext(open + '\nopenCanonicalBrandDetail();', { openRegularBrandProfile() { opens++; } });
  assert.equal(opens, 1);
  const authority = {
    user: { email: 'editor@example.com' }, publicBoardToken: 'public-token',
    workspaceCatalog: { status: 'ready', value: { workspaces: [] }, activeWorkspaceId: 'workspace', generation: 1 },
    currentBoardId: 'board', boardAccess: { canView: true }, session: { brandId: 'brand' }
  };
  let captured;
  const resolver = { state: authority, window: { FunklixBrandProfileSetup: { resolveEntry(input) { captured = input; return { kind: 'empty' }; } } }, getBoardIdFromPath: () => 'path-board' };
  vm.runInNewContext(resolve + '\nresolveRegularBrandProfile();', resolver);
  assert.equal(JSON.stringify(captured), JSON.stringify({ signedIn: true, publicToken: 'public-token', status: 'ready', catalog: authority.workspaceCatalog.value, boardId: 'board', boardAuthorized: true, workspaceId: 'workspace', brandId: 'brand' }));
  authority.currentBoardId = null; authority.user = null; authority.boardAccess.canView = false;
  vm.runInNewContext('resolveRegularBrandProfile();', resolver);
  assert.equal(captured.boardId, 'path-board'); assert.equal(captured.signedIn, false); assert.equal(captured.boardAuthorized, false);

  function fixture() {
    const brand = { id: 'brand', name: 'Brand', brand_core: {}, revision: 1, access: { role: 'viewer' } };
    const workspace = { id: 'workspace', brands: [brand] };
    const result = { calls: [], closes: 0, ready: 0, validated: 0 };
    const context = {
      state: { user: { email: ' Editor@Example.com ' }, publicBoardToken: null,
        brandCatalog: { status: 'error', userEmail: 'unrelated@example.com', entries: [], requestId: 1 },
        workspaceCatalog: { status: 'ready', value: { workspaces: [workspace] }, activeWorkspaceId: 'workspace', generation: 1 } },
      canonicalBrandDetail: { requestId: 1, brandId: 'brand', status: 'closed', controller: null },
      el: { brandWorkspaceDetail: { open: true } }, AbortController, sidebarProfileCache: new Map(),
      closeCanonicalBrandDetail() { result.closes++; },
      renderCanonicalBrandDetail() { if (context.canonicalBrandDetail.status === 'ready') result.ready++; },
      isCanonicalBrandDetail(value, id) { result.validated++; return value === brand && id === brand.id; },
      canonicalBrandDetailErrorStatus(status) { return status === 401 ? 'unauthenticated' : [403, 404].includes(status) ? 'unavailable' : 'error'; },
      clearEphemeralBrandSwitcherSelection() {}, renderBrandCatalog() {}, renderAuthState() {},
      fetch(url, options) { result.calls.push({ url, options }); return Promise.resolve({ ok: true, status: 200, json: async () => brand }); }
    };
    vm.createContext(context);
    vm.runInContext(load, context);
    return { context, result, workspace, brand, run: () => vm.runInContext('loadCanonicalBrandDetail()', context) };
  }
  const denied = [
    c => { c.state.user = null; },
    c => { c.state.user.email = ' '; },
    c => { c.state.publicBoardToken = 'public-token'; },
    c => { c.state.workspaceCatalog.status = 'stale'; },
    c => { c.state.workspaceCatalog.value.workspaces[0].brands = []; },
    c => { c.state.workspaceCatalog.activeWorkspaceId = 'other-workspace'; },
    c => { c.el.brandWorkspaceDetail.open = false; }
  ];
  for (const change of denied) {
    const f = fixture(); change(f.context); await f.run();
    assert.equal(f.result.calls.length, 0, 'invalid authority must issue no detail GET');
    assert.equal(f.result.closes, 1, 'invalid authority must end the Profile load');
  }
  const valid = fixture(); await valid.run();
  assert.equal(valid.result.calls.length, 1); assert.equal(valid.result.calls[0].url, '/api/brands/brand');
  assert.equal(valid.result.calls[0].options.headers.Accept, 'application/json');
  assert(valid.result.calls[0].options.signal instanceof AbortSignal); assert.equal(valid.result.ready, 1);
  assert.equal(valid.context.canonicalBrandDetail.userEmail, 'editor@example.com');

  const changes = [
    c => { c.canonicalBrandDetail.requestId++; },
    c => { c.state.user.email = 'other@example.com'; },
    c => { c.state.workspaceCatalog.generation++; },
    c => { c.state.workspaceCatalog.status = 'loading'; },
    c => { c.state.workspaceCatalog.activeWorkspaceId = 'other-workspace'; },
    c => { c.state.workspaceCatalog.value.workspaces[0].brands = []; },
    c => { c.el.brandWorkspaceDetail.open = false; }
  ];
  // Both waits matter: fetching headers and asynchronously decoding JSON.
  for (const stage of ['response', 'json']) for (const change of changes) {
    const f = fixture(); let release, reached;
    const entered = new Promise(resolve => { reached = resolve; });
    const pending = new Promise(resolve => { release = resolve; });
    f.context.fetch = () => {
      if (stage === 'response') { reached(); return pending; }
      return Promise.resolve({ ok: true, status: 200, json() { reached(); return pending; } });
    };
    const running = f.run(); await entered; change(f.context);
    release(stage === 'response' ? { ok: true, status: 200, json: async () => f.brand } : f.brand);
    await running;
    assert.equal(f.result.ready, 0, `${stage}: changed authority must not render a response`);
    assert.equal(f.result.validated, 0, `${stage}: stale data must be rejected before adoption`);
    assert.equal(f.context.sidebarProfileCache.size, 0, 'stale data must not enter the Profile cache');
  }
  for (const status of [401, 403, 404, 500]) {
    const f = fixture(); f.context.fetch = async () => ({ ok: false, status }); await f.run();
    assert.equal(f.result.ready, 0);
    assert.equal(f.context.canonicalBrandDetail.status, status === 401 ? 'unauthenticated' : [403, 404].includes(status) ? 'unavailable' : 'error');
  }
  const malformed = fixture(); malformed.context.fetch = async () => ({ ok: true, status: 200, json: async () => ({ id: 'foreign-brand' }) });
  await malformed.run(); assert.equal(malformed.context.canonicalBrandDetail.status, 'malformed'); assert.equal(malformed.result.ready, 0);
  const failed = fixture(); failed.context.fetch = async () => { throw new Error('offline'); };
  await failed.run(); assert.equal(failed.context.canonicalBrandDetail.status, 'error'); assert.equal(failed.result.ready, 0);
}
checkCurrentAuthority().then(() => console.log("BW-6 Brand Profile detail checks passed: Workspace authority, wrapper delegation, authenticated GET, both response race boundaries, read isolation, errors and retry.")).catch(error => { console.error(error); process.exitCode = 1; });
