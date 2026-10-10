# BW-36.15: Guided campaign responsibilities

## Verified before implementation

Baseline: refreshed `origin/main`, `4806fd3`, merge #756 of BW-36.14R1. Clean checkout; dedicated branch `codex/bw36-15-campaign-team-responsibilities`.

1. `getBoardAccess()` in `api/_board-access.js` resolves Board owner by session ID/email, memberships from `board_editors`, and the associated `brand_id`. Board GET supplies owner identity and access; owner-only `loadBoardEditors()` reads the sharing endpoint.
2. Associated Brand owner/admin/editor gain edit access; Brand viewer gains read access. An independent Board editor retains edit access even with Brand viewer role. Workspace membership alone is not used to grant Board editing.
3. Existing `getNodeOwnerOptions()` includes all loaded Board memberships, all email-bearing Presence participants, Board owner, and signed-in user.
4. Its membership loop does not check role and its Presence loop does not check editing permission: Viewers can appear. This is verified selection behavior, not evidence of write authorization.
5. `setNodeOwner()` stores `ownerEmail`, `ownerName`, `ownerAvatar` directly on Nodes. `sanitizeNodeForPersistence()`, `serializeState()` and `applyCampaignState()` preserve/hydrate them inside `boards.canvas_json`.
6. Inspector owner handlers call `setNodeOwner()`, `recordOwnerChangedActivity()`, refresh cards/list, and `saveCampaignCanvasState()`. Snapshot dirty detection schedules Board autosave; no separate owner table exists.
7. `refreshOwnershipDisplays()` updates cards, Inspector, open owner-filter popover and list. `matchesNodeOwnerFilter()` reads `ownerEmail`; Dashboard assigned items read the same Nodes. `recordOwnerChangedActivity()` uses existing owner_assigned/owner_unassigned activity events.
8. `addBoardEditor(email, input, role)` POSTs the existing `/api/boards/:id/editors` endpoint; its default role is viewer, so the new action must explicitly pass editor. Returned memberships replace the loaded list.
9. Only Board owner has `canManagePermissions`; Brand owner/admin do not independently manage Board invitations. Existing POST checks that capability.
10. Signed session user, Board owner_name/owner_avatar, membership name/avatar and Presence identities supply display identity. Presence alone is not proof of editing permission. Brand membership identity comes from existing brand_members; Brand owner has email but no owner name/avatar columns.
11. `saveBoardToServer()` sends `lastKnownUpdatedAt`, handles 409 using the existing conflict modal and offers loading latest/saving a new Board. Existing PUT compares revision before an unconditional UPDATE; a responsibilities save needs a locked transaction to close that race. This does not require schema changes.
12. The existing body-owned V3 ready modal supports adding a second completion action; persistent access fits the existing Utilities popover. No Canvas header change is needed. Campaign grouping uses the actual `[sourceId,targetId]` edges.

Migration/SQL: **none** (no schema changes or manually executed SQL).

## Implemented behavior

The body-owned `dialog` offers individual assignment/removal, one explicit person selection, variation actions and a counted `Assign all unassigned` action. Variations contain only their actual Variation→Content→Posting edges. Idea→Variation and Posting→Landing→Email edges determine campaign membership and shared funnel assets; titles and positions never infer membership. Existing non-campaign assets remain visible as other assets. Bulk defaults preserve existing owners; replacement requires the dedicated internal `Replace all assignments` button. No automatic owner assignment is introduced.

The V3 ready renderer adds `Assign responsibilities`; its handler uses the existing Reveal callback to open/reconcile Canvas, then opens the workspace. Reveal's handler is unchanged. Utilities provides the persistent entry without any header/toolbar change elsewhere. Native HTML dialog semantics, an explicit Tab trap, Escape, focus return, live status, scoped scrolling, fk-btn classes, tokens, responsive CSS, forced colors and reduced motion are included. EN/DE copy covers assignment, confirmation counts, invitation and recovery.

`GET /api/boards/:id/editors?assignable=true` projects existing edit permissions within the current Board and its associated Brand. It requires a signed-in editable Board context and returns no Viewer, arbitrary Workspace member, or Presence-only identity. The normal sharing manager GET/POST authorization remains owner-only. `getNodeOwnerOptions()` now filters Viewer memberships and drops Presence-only options; a historical unavailable owner remains visible but cannot be newly selected in the Inspector. The responsibility roster is bound to Board, Brand, Workspace, account and load generation. Invitation explicitly calls existing `addBoardEditor(email, input, 'editor')`, then refreshes only that Board roster.

All ownership continues through `setNodeOwner()` and the existing owner activity events. Cards, Inspector, list, search, owner filters and Dashboard consume the same Nodes. A responsibility command captures one immutable Canvas payload and one activity update per changed Node. Pending responsibility saves suppress snapshot autosave, manual Board save and remote Canvas reconciliation. Closing/reopening an unsaved workspace retains the command and its selection in this tab. Retry sends the same command without another Node mutation or activity event.

The existing Board PUT route delegates responsibility-marked saves to a locked transaction using the existing Board access resolver. It validates responsible people again on the server, rechecks the Board timestamp under the row lock, and commits one whole `canvas_json` update. An exact already-saved Canvas replay is recognized after a lost response. A 409 cannot overwrite the server Canvas: the user loads latest and reviews/confirms the affected selection again. Server confirmation precedes local storage/display reconciliation; a local failure retains Saved and offers loading latest without another write. Brand snapshot data is not rewritten by this action, and independent unsaved Brand changes retain their saved snapshot baseline.

Migration/SQL: **none**. No migrations, new tables, manual SQL, provider calls, AI calls or extra Workspace/Brand refetches.

## Exact changed files

- `app.js`
- `campaign-responsibilities.js`
- `campaign-responsibilities.css`
- `index.html`
- `language.js`
- `api/_campaign-responsibilities.js`
- `api/boards/[id].js`
- `api/boards/[id]/editors/index.js`
- `scripts/check-bw36-15-campaign-team-responsibilities.js`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `docs/implementations/bw36-15-campaign-team-responsibilities.md`

## Automated verification

- `npm run check:bw36.15`: real Chromium loads production index/modules/app/styles and executes the real V3 generator/Canvas adapter against intercepted fixtures. Generation persists 13 Nodes and 17 Edges (two variations, three posts each); real DOM rows follow those Edges. Individual/removal and variation/all-unassigned actions, default preservation, explicit replacement, shared-asset isolation, one-save bulk, identity/chips/list/Dashboard/filter/activity, invitation, reopened Not saved state, immutable retry, stale revision/reconfirmation, server-confirmed local failure and refresh hydration are exercised.
- Production server fixtures execute the real permission resolver, roster/sharing handler and transaction module: Board owner/editor, associated Brand owner/admin/editor, Viewer/public/foreign denial, owner-only invitations, atomic rollback, exact replay, stale revision and revoked edit membership.
- EN/DE, Light/Dark at 1440/1024/768/480/375/320 and 720×450 (200%-equivalent reflow), short height, visible design-system controls, forced colors, reduced motion, keyboard Tab trap, Escape and focus restoration pass in Chromium. Browser errors/native alert/confirm/prompt dialogs are rejected. Every browser request is intercepted; external destinations are forbidden. No real provider, AI, Storage or production database calls occur.
- `npm run check:bw36.14r1` and `npm run check:bw36.14` pass, including full V3 generation, quality/repair, progress/avatar/scroll, persistence recovery, stale-context protection and refresh.
- `node scripts/campaign-v3-harness.js`: all 14 valid/expected-invalid cases pass.
- All **174 configured Runtime Boot Safety check/syntax commands** pass, including Board access/sharing, Brand roles and Workspace/Brand/Canvas regressions. The tracked-files-only BW-35.3R4 check initially lacked newly untracked modules in its temporary checkout; it passed unchanged after the delivery files were staged. Chromium and network subprocesses needed execution network permission in this environment.
- Browser-script integrity passes for 38 classic scripts; changed JavaScript syntax and `git diff --check` pass.
- Byte guards protect `campaign-v3.js`, `api/generate-campaign.js`, `api/_campaign-creation.js`, `campaign-creation.js`, `campaign-creation-dialog.js` and the V3 AI/creation orchestration functions in app.js against the BW-36.14R1 baseline. Only its ready renderer gains the second completion action.

No historical test file was changed or relaxed. The manual acceptance below remains to be performed after deployment; automated local fixtures are not live deployment acceptance.

## Manual acceptance after deployment

1. Generate a campaign with two variations and several posts.
2. Open Assign responsibilities in the completion dialog.
3. Verify every variation, its Content and Posts, plus shared funnel assets.
4. Assign a whole variation to one team member.
5. Verify Landing Page and Email remain unchanged.
6. Assign one post to someone else.
7. Reopen Assign variation and check the existing-assignment count.
8. Test Assign unassigned only and verify existing individual owners survive.
9. Explicitly select Replace all assignments and verify the variation changes together.
10. Assign Landing Page and Email individually.
11. Assign all remaining unassigned assets; verify the count and preservation of existing owners.
12. Refresh the Board.
13. Verify owner chips, list, Dashboard Assigned to you and owner filters.
14. Invite a new Board Editor and assign an asset to them.
15. Verify a Viewer cannot invite or assign.
16. Test a failed save, Not saved, closing/reopening and Retry; verify no duplicate activity or mutation. Test a revision conflict and review after loading latest.
17. Test desktop/mobile, Light/Dark, keyboard and short viewport height.
18. Generate Campaign V3 again and verify the full original structure/quality/repair/animation behavior.

## BW-36.15R1: completion-action reflow correction

Existing delivery: PR #757, branch `codex/bw36-15-campaign-team-responsibilities`. This correction stays on that branch and PR.

Verified root cause: Runtime Boot Safety run 38043172742 failed the unchanged BW-36.14R1 ready-state `modal.scrollWidth <= modal.clientWidth + 1` assertion before BW-36.15 could execute. The second completion action inherited `.campaign-builder-actions` as a non-wrapping flex row. Its buttons retained automatic intrinsic minimum widths; the parent grid's automatic column could widen beyond the modal. Production Chromium measurements before repair show the German 320px ready modal at **248px client width / 289px scroll width**, with a **289px action row** and `flex-wrap: nowrap`. Local English fitting did not protect the longer German label or CI's ready-state layout.

The production repair is confined to V3 completion selectors in `campaign-creation-dialog.css`: a `minmax(0, 1fr)` grid column, `min-width: 0`, `max-width: 100%`, border-box sizing, wrapping action flex layout, full-label word wrapping and minimum 44px button heights. At viewport widths up to 480px the actions stack at full width. Existing button radius, colors, spacing, theme/focus styling and accessibility media are inherited. No text is hidden/truncated, no overflow clipping is added, and no broad button/modal overrides are introduced. Generation, topology, progress/avatar/loading, completion handlers, authorization, persistence, assignments and APIs are unchanged.

The focused BW-36.15 check now keeps an actual server-confirmed V3 ready dialog open and checks both real EN/DE buttons at **1440, 1024, 768, 480, 375, 320 and 720×450** in Light/Dark. It asserts modal and action-container horizontal fit, full labels, 44px targets, mobile stacking, hit testing and visible keyboard focus. Forced colors/reduced motion retain fit and operability. Enter on the actual Reveal button opens the created campaign; a fresh isolated campaign exercises Enter on Assign responsibilities and then the original complete responsibility regression. Chromium selection also follows the existing R1 fallback so the fixture uses Playwright's installed browser when `/usr/bin/chromium` is absent in CI. The exact protected source/function comparisons use SHA-256 digests computed from the same `4806fd3` bytes, so CI's verified depth-one checkout does not need an unavailable ancestor commit; every prior byte invariant remains enforced.

Correction files only:

- `campaign-creation-dialog.css`
- `scripts/check-bw36-15-campaign-team-responsibilities.js`
- `docs/implementations/bw36-15-campaign-team-responsibilities.md`

Required validation sequence: `npm run check:bw36.14r1`, then `npm run check:bw36.15`, browser-script integrity, changed-JavaScript syntax, `git diff --check`, then every Runtime Boot Safety workflow run step in its declared order, including its browser dependency setup. The existing BW-36.14R1 script/assertion is unchanged. Final command results are reported with the correction commit and existing PR.

Migration/manual SQL/database or production-data changes: **none**.
