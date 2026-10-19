#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { heroContinuation, model } = require('../home-foundation');
const { W, B, D } = require('./fixtures/bw36-13r5-local-runtime');
const Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-000000000001';
const account = { email: 'test@example.test' };
const context = { account, identity: account.email, status: 'ready', workspaceId: W, brandId: B, boardId: D,
  openBoard: { name: 'Hydrated rename', brandId: B, canEdit: true },
  catalog: { workspaces: [{ id: W, brands: [{ id: B }, { id: Y }], boards: [
    { id: D, name: 'Stale catalog', brand_id: B }, { id: OTHER, name: 'Other catalog label', brand_id: Y }
  ] }, { id: W2, brands: [], boards: [] }] } };
const metadata = [{ id: D, updated_at: '2026-10-01T10:00:00Z' }, { id: OTHER, updated_at: '2026-10-18T10:00:00Z' }];
const before = JSON.stringify([context, metadata]);
assert.equal(heroContinuation(context, metadata).name, 'Hydrated rename');
assert.equal(heroContinuation(context, metadata).id, D);
assert.equal(heroContinuation(context, metadata).savedAt, metadata[0].updated_at);
assert.equal(heroContinuation({ ...context, brandId: null }, metadata).name, 'Hydrated rename', 'Current fallback also uses hydration');
assert.equal(heroContinuation({ ...context, brandId: Y }, metadata).name, 'Other catalog label');
assert.equal(heroContinuation({ ...context, brandId: Y, openBoard: { ...context.openBoard, brandId: Y } }, metadata).name, 'Hydrated rename');
assert.equal(heroContinuation({ ...context, boardId: OTHER, openBoard: { name: 'Second hydrated name', brandId: Y }, brandId: Y }, metadata).name, 'Second hydrated name');
for (const patch of [{ loading: true }, { openBoard: null }, { boardId: 'unauthorized' }])
  assert.equal(heroContinuation({ ...context, ...patch }, metadata).name, 'Stale catalog', 'Hydration never authorizes a candidate');
for (const patch of [{ workspaceId: W2 }, { identity: 'other@example.test' }, { account: null }, { publicToken: 'public' }, { status: 'loading' }])
  assert.equal(heroContinuation({ ...context, ...patch }, metadata), null);
assert.equal(model(context, metadata).boards.find(b => b.id === D).name, 'Stale catalog');
assert.equal(JSON.stringify([context, metadata]), before, 'No catalog or saved metadata mutation');
console.log('PASS pure candidate names, authorization, association, switching and immutable metadata');
const snapshot = p => p.evaluate(() => JSON.stringify({ id: state.currentBoardId, name: state.currentBoardName,
  nodes: state.nodes, edges: state.edges, core: state.brandCore, association: state.boardBrandAssociation,
  saved: state.lastSavedSnapshot, dirty: state.isDirty, revision: state.lastKnownUpdatedAt }));
const refresh = p => p.evaluate(() => { refreshDashboardIfVisible(); clearAutosaveTimer(); });
const resume = p => p.locator('[data-home-action=living-board]');
async function expectCurrent(p, name) {
  assert.equal(await p.locator('.home-living-board h3').innerText(), name);
  assert.equal(await resume(p).getAttribute('data-home-id'), D);
  assert.equal(await resume(p).getAttribute('aria-label'), 'Continue open Board: ' + name);
  assert.equal(await p.getByRole('button', { name: 'Continue open Board: ' + name, exact: true }).count(), 1);
  assert((await p.locator('.home-avatar-entry').innerText()).includes(name));
  assert((await p.locator('.home-details-heading').innerText()).includes(name));
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const fixture = require('./fixtures/home-browser')(browser);
  try {
    const f = await fixture({ manyBoards: true }), p = f.page;
    await p.locator('.home-living-continue time').waitFor();
    const savedAt = await p.locator('.home-living-continue time').getAttribute('datetime');
    // The catalog response was already retrieved. The real loader now hydrates a newer name.
    f.r.db.boards[0].name = 'Renamed after catalog retrieval';
    await p.evaluate(async () => { await loadBoardFromUrlIfPresent(); clearAutosaveTimer(); setActiveView('home'); });
    await expectCurrent(p, f.r.db.boards[0].name);
    assert.equal(await p.evaluate(() => state.workspaceCatalog.value.workspaces[0].boards.find(b => b.id === state.currentBoardId).name), 'Autumn Launch');
    const hydrated = await snapshot(p), requests = f.requests.filter(q => !q.path.includes('/presence/'));
    for (let i = 0; i < 3; i++) await refresh(p);
    await expectCurrent(p, f.r.db.boards[0].name);
    assert.equal(await p.locator('.home-living-continue time').getAttribute('datetime'), savedAt);
    assert.equal(await snapshot(p), hydrated);
    assert.deepEqual(f.requests.filter(q => !q.path.includes('/presence/')), requests);
    await p.locator('#home-brand-select').selectOption(Y);
    assert.equal(await p.locator('.home-living-board h3').innerText(), 'Saved campaign 1');
    assert.equal(await resume(p).getAttribute('aria-label'), 'Open saved Board: Saved campaign 1');
    assert.equal(await resume(p).getAttribute('data-home-id'), OTHER);
    assert.equal(await snapshot(p), hydrated, 'Brand preference never switches or modifies the Board');
    await p.locator('#home-brand-select').selectOption(B);
    await expectCurrent(p, f.r.db.boards[0].name);
    await resume(p).press('Enter');
    assert.equal(await p.evaluate(() => state.activeView), 'board');
    assert.equal(await snapshot(p), hydrated, 'Continuation selects the existing Board without persistence mutation');
    await p.route('**/api/boards/' + OTHER, route => route.fulfill({ json: {
      ...f.r.db.boards[1], name: 'Second hydrated Board', access: { role: 'owner', canView: true, canEdit: true, canViewBoardBrandCore: true, canViewPresence: false }
    } }));
    await p.evaluate(async id => {
      history.replaceState({}, '', '/boards/' + id);
      await loadBoardFromUrlIfPresent(id); clearAutosaveTimer(); setActiveView('home');
    }, OTHER);
    await p.locator('#home-brand-select').selectOption(Y);
    assert.equal(await p.locator('.home-living-board h3').innerText(), 'Second hydrated Board');
    assert.equal(await resume(p).getAttribute('data-home-id'), OTHER);
    assert.equal(await resume(p).getAttribute('aria-label'), 'Continue open Board: Second hydrated Board');
    assert.equal(await p.evaluate(() => state.currentBoardId), OTHER);
    assert(!(await p.locator('.home-living-continue').innerText()).includes('Renamed after catalog retrieval'));
    await f.close();
    console.log('PASS real rehydration, stale catalog, other labels, accessible names, identity and no reads/writes');

    const g = await fixture(), q = g.page;
    await q.evaluate(() => { state.currentBoardName = 'Retired Board name'; refreshDashboardIfVisible(); });
    await expectCurrent(q, 'Retired Board name');
    // Capture before each scope transition and activate synchronously before redraw.
    for (const change of ['board', 'account']) {
      await q.evaluate(change => {
        const button = document.querySelector('[data-home-action=living-board]');
        if (change === 'board') state.boardLoadGeneration++;
        else state.user = { ...state.user };
        button.click();
      }, change);
      assert.equal(await q.evaluate(() => state.activeView), 'home');
      await refresh(q);
      if (change === 'board') {
        assert(!(await q.locator('.home-living-continue').innerText()).includes('Retired Board name'));
        await q.evaluate(async () => { await loadBoardFromUrlIfPresent(); clearAutosaveTimer(); setActiveView('home'); });
      }
    }
    await q.locator('#home-workspace-select').selectOption(W2);
    await q.waitForFunction(id => state.workspaceCatalog.activeWorkspaceId === id, W2);
    assert.equal(await resume(q).count(), 0);
    assert(!(await q.locator('.home-living').innerText()).includes('Retired Board name'));
    await q.locator('#home-workspace-select').selectOption(W);
    await q.waitForFunction(id => state.workspaceCatalog.activeWorkspaceId === id, W);
    assert(!(await q.locator('.home-living').innerText()).includes('Retired Board name'));
    await q.evaluate(() => { state.user = { email: 'another@example.test' }; refreshDashboardIfVisible(); });
    assert.equal(await resume(q).count(), 0);
    await g.close();
    console.log('PASS Board generation, account and Workspace transitions retire names and captured actions');
    const viewer = await fixture({ viewer: true }), v = viewer.page;
    await v.evaluate(() => { state.currentBoardName = 'Renamed view-only Board'; refreshDashboardIfVisible(); clearAutosaveTimer(); });
    assert.equal(await v.locator('.home-living-board h3').innerText(), 'Renamed view-only Board');
    assert.equal(await v.getByRole('button', { name: 'View Board: Renamed view-only Board', exact: true }).count(), 1);
    assert.equal(await resume(v).getAttribute('data-home-id'), D);
    const viewState = await snapshot(v);
    await resume(v).press('Enter');
    assert.equal(await v.evaluate(() => state.activeView), 'board');
    assert.equal(await snapshot(v), viewState);
    await viewer.close();
    console.log('PASS view-only hydrated card and accessible action label retain Board identity');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
