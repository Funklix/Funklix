# BW-36.21A-R2 — Workspace creation and direct Brand selection audit

Date: 2026-10-16 (Europe/Berlin). Status: audit proposal awaiting approval; no product implementation.

Repository: `Funklix/Funklix`. Inspected latest merged `main`: [`88373354bce2bc4018eeee8db5653c85d7498a4d`](https://github.com/Funklix/Funklix/commit/88373354bce2bc4018eeee8db5653c85d7498a4d), merge of #782 (Home loading recovery), including #781 (Home foundation). GitHub branch metadata and a subsequent `git fetch origin main` confirmed this base. Source references below refer to this SHA. This PR changes only this document.

## 1. Findings and scope

**Additional Workspace creation needs backend and client changes.** The schema and catalog already support multiple Workspaces, but the creation transaction is deliberately first-Workspace-only. Adding a button cannot overcome that restriction. Safe retries for additional creation also require a different idempotency mechanism.

**Direct Brand selection exists only when there is no active Board.** Both sidebar sizes use the same selector and handler. With an active Board, the handler refuses selection; Home disables its Brand pick buttons. Sidebar derivation also gives the Board's Brand priority and writes that result back to session state. Removing one guard would therefore be insufficient.

**Workspace switching exists, but its current transition is incomplete.** It protects a dirty Brand Profile, but does not protect dirty Canvas state, stop all outgoing Board activity, or invalidate outgoing load/save completions. This is a prerequisite for safely making multiple Workspaces commonplace.

Evidence consists of current code, four existing local regression suites, and isolated execution of actual navigation handlers. No production SQL, live product mutations, paid OpenAI requests, or runtime edits were performed. User-reported production symptoms are context, not a claim that this audit exercised production.

## 2. Confirmed root causes

### A. First-Workspace-only creation

| Layer | Actual implementation | Consequence |
| --- | --- | --- |
| Server | [`api/workspaces.js`](../../api/workspaces.js), `createRequest`, `createFirstWorkspace`, POST dispatch, lines 47–136 | Accepts only `workspace_create_v1`, `request_id`, `name`; verified session supplies identity. Under a per-email transaction advisory lock, it bootstraps/validates the application identity and locks accepted memberships in active Workspaces. |
| Existing membership | `createFirstWorkspace`, lines 77–88 | Any active accepted membership prevents creation, including member/viewer membership. Exactly one owned Workspace with matching normalized name returns that existing Workspace with `created:false`; every other case returns `WORKSPACE_ALREADY_EXISTS`. |
| UI | [`workspace-sidebar.js`](../../workspace-sidebar.js), `render`, exported `openCreate`, lines 196, 208; [`home-foundation.js`](../../home-foundation.js), `draw` and click dispatch | Create entry appears and is accepted only for an empty authorized catalog. Workspace management currently offers rename only. |
| Application | [`app.js`](../../app.js), `createFirstSessionWorkspace`, lines 5057–5080 | Rejects nonempty catalogs, deduplicates an in-flight first creation, adopts the result as the sole Workspace. |
| Client reconciliation | [`workspace-catalog.js`](../../workspace-catalog.js), `reconcileCreate` | Explicitly rejects a nonempty catalog; cannot append a second Workspace. |

The current request ID is validated and echoed, but is **not a durable creation idempotency key**. Retry safety currently comes from serialization plus the first-Workspace/name restriction. Simply removing the membership check would permit duplicate creations on retries. The `created:false` response also synthesizes empty Brand/Board arrays, so it must not replace a populated existing Workspace during future reconciliation.

### B. Board context overrides navigation Brand preference

1. `app.js:4949`, `selectSessionBrand`, validates membership in the selected Workspace, then returns `false` whenever `state.currentBoardId || getBoardIdFromPath()` is present. This includes Home reached while a Board remains loaded.
2. `home-foundation.js`, `draw`, sets Brand pick `disabled = Boolean(c.boardId)`; its click dispatch independently requires `!c.boardId`. Brand Profile buttons remain separate and enabled for authorized cards.
3. `workspace-sidebar.js:derive` (lines 14–25) prioritizes active Board Workspace and Brand over the supplied Brand. A null catalog association produces “No Brand assigned.” `renderWorkspaceSidebar` (`app.js:4907`) passes association Brand first, then writes `model.activeBrandId` into `state.session.brandId`.
4. `loadBoardFromUrlIfPresent` (`app.js:9355`, association adoption around 9404–9407) writes the loaded Board association into session Brand. `syncRuntimeSessionFromLegacy` (`app.js:6602`) replaces session context with null Workspace/Brand on several load/save paths. These writes would erase a newly independent preference unless reconciled deliberately.
5. The Brand selector opens only with more than one Brand and no unbranded Board (`openSelector`, `render`). This blocks browsing other Brands from an unbranded or hidden-association Board even when those Brands are independently authorized.

Opening a Board associated with another Brand updates the sidebar because the Board loader adopts its association and refreshes active Workspace context. This explains the reported indirect switching behavior. It is not evidence of an independent navigation preference changing.

## 3. Existing state, components, routes, and contracts to reuse

| Concern | Existing owner / boundary | Reuse and limitation |
| --- | --- | --- |
| Workspace schema | `migrations/20260928_bw36_6_workspace_schema_foundation.sql`; `20260929_bw36_7r2_application_identity_bridge.sql` | Workspace UUID primary key; memberships unique by Workspace and application identity; accepted-owner protection; identity FKs. No single-Workspace-per-identity uniqueness constraint. Do not rerun backfill migrations. |
| Workspace catalog | `api/_workspace-catalog.js:loadWorkspaceCatalog`, `projectCatalog`; GET `/api/workspaces`; `workspace-catalog.js:load`, `validate` | Already returns multiple active accepted memberships with independently authorized Brands/Boards. Board access does not imply Brand visibility; hidden Brand IDs project to null. Cross-Workspace relationships are rejected. |
| Catalog lifecycle | `app.js:4992–5046`, `clearWorkspaceCatalog`, `loadAuthorizedWorkspaceCatalog`, `refreshActiveWorkspaceContext` | Existing account identity, generation, promise, ready/stale/error handling. `retryWorkspaceCatalog` calls a loader that short-circuits when already ready; a real post-create refresh must deliberately invalidate/refresh rather than assume this issues a GET. |
| Sidebar hierarchy | `workspace-sidebar.js:create`, `derive`, `option`, `selectFrom`, `placement` | Workspace → Brand controls; Workspace selector already switches when multiple entries exist. Keep one controller, one catalog, and existing callbacks. |
| Brand preference | `app.js:3036–3147`, `ephemeralBrandSwitcherSelection`, `selectedBrandPreferenceId`, preference helpers; `selectSessionBrand` | Existing optional versioned, account-hashed localStorage preference belongs to legacy switcher. Modern sidebar selection updates memory/session but does not call its persistence helper. Restore validates legacy Brand catalog, not active Workspace. Reconcile these owners; do not create another selection store. |
| Profile | `app.js:3721–3779`, `resolveRegularBrandProfile`, `openRegularBrandProfile(target)`; `brand-profile-setup.js:resolveEntry` | Explicit catalog target can open another authorized Brand Profile without changing Board association. Untargeted resolution intentionally follows an active Board first. Profile data uses GET/PUT `/api/brands/:id`; busy/dirty save/discard/cancel guards already exist. |
| Home | `home-foundation.js:model`, `sameScope`, `create`; `app.js:18396–18419` | Uses authorized catalog identity, Workspace, Brand, Board and generations. Optional GET `/api/boards` contributes only permitted IDs and saved timestamps. Explicit All/Brand filters; selection should not implicitly alter their intent. |
| Board route / loading | `/boards/:id`, `app.js:9355–9465`, `loadBoardFromUrlIfPresent` | Loader owns hydration, Board access, public token, authoritative association, snapshot and generation. Home opens another Board via full route; same Board Continue uses Canvas nav. Preserve these contracts. |
| Board persistence | `app.js:5635–5679`, `clearAutosaveTimer`, `scheduleAutosave`; `9195–9353`, `saveBoardToServer`; `6587`, `resolveBoardPersistenceTarget` | Autosave waits 3 seconds, updates existing Boards only, respects loading/read-only/conflict guards. Saves serialize Canvas and snapshot, not selected Brand; optimistic `lastKnownUpdatedAt`, `latestSaveRequestId` control completion/conflicts. |
| Explicit association changes | `app.js:renderBoardBrandAssociation` and association form; `api/boards/[id].js:207–237` | `brand_id` PUT is a separate write requiring association-change permission and target Brand edit access. It also clears snapshot provenance/backups. Navigation must never invoke it or the explicit snapshot refresh operations. |
| Board creation / campaign consumers | `app.js:11100–11129`, `resolveCampaignCreationContext`, `campaignCreationIdentity`; project creation/hydration around 19659–19691 and setup route around 20232 | Existing project/campaign boundaries. Campaign context resolves actual Board association and snapshot; session Brand also participates in freshness identity. Preference changes must invalidate stale commands without supplying another Brand's Core to the Board. |
| Brand-filtered Boards library | `app.js:19882–19945`, `getResolvedWorkspaceBrand`, `handleWorkspaceBrandSelectionChange` | Existing filter/invalidation path reads legacy preference and Brand catalog. Must also bound resolution to active authorized Workspace; no second Boards list or alternate fetch path. |

## 4. Sidebar interaction contract and proposed behavior

### Current contract, including collapsed mode

`index.html:161–198` defines distinct Workspace and Brand trigger buttons with listbox semantics, and distinct management ellipses. Clicking either **trigger opens its selector**; it does not directly open a profile or select the icon's Brand. `selectFrom` delegates a row activation to `onBrand: selectSessionBrand`; false keeps the popover open.

Brand option ellipses stop propagation and open row management with a captured catalog target. They appear for owner/admin/editor roles; “Open profile” is available there, delete is owner-only. Viewer rows have no ellipsis. The regular Brand Profile nav resolves separately. Do not relabel these existing actions as selection.

Collapsed and expanded modes share exactly this DOM and event wiring. `workspace-sidebar.css:8–29` hides labels/management controls, later restores the collapsed Brand icon row, and has additional 768–1300px and ≤767px overrides. Mobile expanded layout can show Brand actions while hiding its trigger; later collapsed mobile rules restore it. A behavior fix alone does not guarantee access at every geometry or role.

Popovers are moved to `document.body`, positioned from trigger bounds, and close on Escape/outside interaction/view change. Preserve the existing focus return, Arrow/Home/End/Enter/Space handling, search above eight items, 44px targets, fixed placement, viewport observers, high-contrast and reduced-motion styles. Row-wrapper search currently hides the wrapper while keyboard traversal tests the option's own `hidden`; verify effective visibility before retaining that traversal. Do not add another icon click listener or depend on the hidden legacy Brand panel.

### Proposed minimum behavior (approval required)

| Action | No active Board | Active Board A associated with Brand X |
| --- | --- | --- |
| Brand icon/trigger, either sidebar size | Open existing selector | Open the same selector; do not make null/hidden Board association disable browsing independently authorized Brands. |
| Activate Brand Y row | Select authorized Y as navigation preference; stay on current Home/library surface, refresh context and explicit Brand filter as applicable. | Select authorized Y as navigation preference. Keep Board A loaded with X, Canvas and snapshot untouched. Selector/context must distinguish selected Y from “Open Board: X.” |
| Open Profile for Y | Explicit profile target Y | Use existing `openRegularBrandProfile(Y)` after profile-leave guard. Keep A/X intact; returning to Canvas continues A/X. |
| Board-specific Brand/Core operation | Unavailable without a Board | Always resolve A/X from authoritative association and snapshot; selected Y is irrelevant to reassignment, generation, sync, publication, responsibilities, learning and exports. |

Retain trigger → selector → row-selection contract. Keep profile navigation a distinct action, including for viewers and when only one Brand exists. A single-Brand trigger may open a one-entry selector with a profile action, rather than being entirely inert. Profile opening must not depend on management permission. A row ellipsis can keep management actions, but ordinary profile navigation must be reachable in collapsed/mobile/read-only layouts too.

Use the existing ephemeral preference as the canonical navigation preference, with `state.session.brandId` a reconciled projection where required by existing consumers; never introduce a third Brand state. Separate **selected navigation Brand**, **viewed profile Brand** (`canonicalBrandDetail.brandId`), and **persisted Board association** (`boardBrandAssociation` / Board response). Derive them explicitly from those existing owners. Stop writing a Board-derived sidebar result over the selected preference. Scope all preference reads/restores to the active authorized Workspace.

When opening a Board, Board context follows its saved association and the preference remains independent. If there is no selected authorized Brand, show a neutral choice (retain the existing singleton default where appropriate); do not silently choose the first of several Brands. The smallest rollout can keep modern selection session-only; cross-reload/per-Workspace preference persistence is a separate decision. Existing legacy persisted preferences remain untrusted hints and must never override authorization or pull the user into another Workspace.

## 5. Proposed Home behavior

Home card primary activation selects the Brand preference through the same `selectSessionBrand` boundary, including when a Board remains loaded. Remove both the disabled-button condition and click rejection only after state derivation is separated. Selected card/`aria-pressed`, context label, and Brand filter should reflect the selected preference. Keep the explicit Profile button, authorized target validation and no-Board empty states.

Keep “All visible Boards” as the initial filter. Selection changes context; it does not automatically hide other Boards. If the user explicitly chooses the Brand filter, show only selected Brand Boards in the active Workspace, using catalog associations. Home `sameScope` currently resets filter to All on context change; preserving an explicit Brand filter across a subsequent Brand pick would be a separately approved UX adjustment. The minimal change retains the current reset.

With A/X still open and Y selected, show both facts: selected Y and open Board A's saved Brand X. Continue still opens A, not an arbitrary Y Board; its persisted association and card label stay X. Profile Y remains usable without opening a Board. Home-only selection must issue no Board PUT, association write, snapshot hydration or AI request.

Add “Create Workspace” alongside the existing Home Workspace chooser and inside the sidebar Workspace selector, including when there is exactly one Workspace. These entries call the same existing creation dialog/controller. The selector trigger must remain operable for creation even when switching has only one option. Do not tie independent Workspace creation to owner/admin rights in the current Workspace; entitlement is decided separately below. Keep rename gated by that Workspace's role.

## 6. Workspace lifecycle and security risks

### Confirmed transition gap

`selectSessionWorkspace` (`app.js:4925–4947`) guards and closes Brand Profile, validates the target in a ready catalog, and clears current/path Board IDs only when the active Board is found in that catalog and belongs to another Workspace. It then switches context and renders Home/library.

It does **not** call `showUnsavedLeaveModal`, clear Canvas nodes/edges, reset the Board association or authoritative snapshot/access, stop autosave/presence/refresh polling, increment `boardLoadGeneration`, or retire `latestSaveRequestId`. A Board absent from the Workspace catalog (independent shared/legacy access, revoked membership, or loading discrepancy) does not enter its Board-clearing branch at all. This can leave an old Workspace's Canvas and capabilities resident while another Workspace is selected.

An isolated execution of the actual handler confirmed that switching from W1 to W2 with `isDirty:true` returns true, clears the Board ID, but retains W1 nodes, association, snapshot and load generation. This is a client lifecycle risk; it is not evidence that server authorization has been bypassed or that a production write was observed.

In-flight saves are especially important: save completion checks its request number, then can restore `state.currentBoardId` and access from its response. A Workspace switch does not currently advance that number. A pending Board load tests generation, Board ID/path and email; all must be deliberately retired at a context exit, rather than relying on ID clearing to happen to defeat one comparison. Autosave without a Board is update-only and refuses creation, but manual save chooses POST when no ID remains; retained Canvas must never become a new Workspace's accidental input.

### Required safe transition

Implement this within the existing `selectSessionWorkspace` owner and reusable lifecycle helpers, not another state manager:

1. Revalidate signed-in account, current catalog identity/readiness and target membership; no-op same-Workspace selections. Block/settle loading, hydration, save, association submission, campaign creation, responsibility retry, and conflict states before committing a switch.
2. Run existing Brand Profile busy/dirty guard. For Canvas/local draft loss, reuse/generalize `showUnsavedLeaveModal` (currently copy is “Creating a new board,” Cancel/Continue, **no save operation**) with explicit Workspace-specific discard wording. Recommended minimal behavior: Cancel or Discard; saving uses the existing Board save path and must complete before retrying the switch. Do not imply Continue saves anything.
3. After every asynchronous decision, revalidate account, target membership, catalog/Board generations and original transition identity. Cancel or failed/unconfirmed save leaves all context unchanged.
4. On approved exit, clear pending autosave; stop outgoing presence/polling; invalidate Board load/save/association generations and dependent commands/previews. Clear old Canvas, inspector selection/history, Board access, snapshot/Core, revisions/conflict metadata, collaboration state and outgoing local-draft projections using existing reset/invalidation routines. `resetCampaignCanvasState` alone is insufficient: it clears Canvas but deliberately reports unsaved changes and does not retire the whole lifecycle.
5. Adopt the authorized target Workspace and its locally valid preference (or neutral/singleton default), clear route to `/`, show Home, and synchronize sidebar/library/Home. No outgoing Workspace content or enabled capabilities may remain in the target view. No Board is automatically opened.

Preserve independent Board authorization: an accessible shared Board outside the Workspace catalog can still be opened by its existing route, but cannot be used to infer Workspace/Brand access. Explicit Workspace exit must still retire that Board. Do not broaden catalog membership or leak its hidden association to make navigation simpler.

### Other risks and containment

- **Catalog vs preference authority:** account-hashed storage is not permission. Re-resolve IDs in the active ready Workspace on every action; stale/error/public/signed-out states must not accept selection or expose cached profiles. Clear/invalidate on logout/account replacement/access loss.
- **No implicit cross-Workspace selection:** sidebar derivation currently gives any supplied Brand priority over explicitly selected Workspace. Change that for preference resolution; foreign Brand IDs must yield no selection, not silently switch Workspace.
- **Late responses:** preserve Home abort/`sameScope` checks, profile captured account/Workspace/generation checks and project boundaries. Abort/invalidate metadata and Brand-filtered library requests on Workspace change; render only catalog-authorized IDs.
- **Profile switching:** `guardBrandProfileLeave` blocks busy/submitting states, offers Save/Discard/Cancel for dirty drafts, and resumes only after confirmed save or explicit discard. Retain draft/conflict state on failure; revalidate the requested target after resume. Merely opening a profile need not discard Canvas because it keeps the Board loaded.
- **Board Core separation:** selected Y must never normalize/hydrate `state.brandCore`, replace `authoritativeBoardBrandCore`, alter `brand_id`, clear provenance/backups, or mark Canvas dirty. Canonical profile saves stay Canonical Brand saves; explicit Campaign Sync retains its own checks and Board X target.
- **Creation atomicity:** keep verified canonical identity, disabled/ambiguous identity rejection, name validation, transaction rollback, parameterized queries, accepted owner membership and last-owner invariant. A new Workspace must not inherit current Brands, Boards, sharing, public tokens or membership role.
- **Schema certainty:** committed schema supports multiple memberships. Production schema was not queried; migration/application parity remains a rollout check. Additional durable idempotency can reuse the existing Workspace UUID primary key (proposal below), so no fundamental tenant schema migration is necessary.

## 7. Exact integration points and minimal implementation sequence

1. **Approve semantics and contract below.** Fix the Workspace transition gap before enabling additional creation in the UI. Extend current handler/guards and dependent invalidation only; keep full Board loading/autosave ownership.
2. **Generalize creation server-side in `api/workspaces.js`.** Preserve `workspace_create_v1` first-Workspace semantics for compatibility. Recommended additive `workspace_create_v2` on the same POST endpoint accepts a client-generated Workspace UUID plus normalized name and request correlation ID. Insert using that UUID in the existing atomic identity/Workspace/owner transaction. On replay, return success only for the same creator, normalized input, active Workspace and accepted owner membership; conflict on differing input, foreign/revoked/archived target without leaking metadata. Do not treat matching names as the same creation. Reuse the same UUID across uncertain retries and serialize concurrent attempts. The primary key can provide durable deduplication without a new state table; validate this with transaction/concurrency tests before choosing it over a dedicated request ledger.
3. **Extend `workspace-catalog.js` request/response validation and reconciliation.** Explicitly validate the new version/UUID. Append or replace by confirmed ID within the existing catalog, preserving all other Workspaces and descendants. For replay of an existing populated Workspace, preserve/refetch descendants rather than replacing them with empty arrays. Reject stale account/catalog operations. No new catalog cache.
4. **Generalize `app.js:createFirstSessionWorkspace` and its in-flight operation.** Capture account/lifecycle/creation identity; retain immutable request input on retries. Keep the empty-state path working. Recommended successful creation stays in the current Workspace and offers an explicit switch, routed through the guarded transition, so a server success never silently discards a Board or profile. If there was no Workspace, activate the first as today.
5. **Expose the reused dialog.** Update `workspace-sidebar.js:openManagement`, `openSelector`, `render`, exported `openCreate`; Home `draw`/click handler; `app.js:18383–18419` callbacks. Remove first-only UI gating only with server/client support. Change “first workspace” dialog description/error copy and localization in `language.js`. Make creation accessible from one-entry/collapsed selectors and independent of rename permission.
6. **Separate navigation preference projections.** Update `selectSessionBrand`, `renderWorkspaceSidebar`, `refreshActiveWorkspaceContext`, catalog adoption, `workspace-sidebar.js:derive`, and load/save `syncRuntimeSessionFromLegacy` reconciliation. Reuse `ephemeralBrandSwitcherSelection` as preference; validate active Workspace rather than using the legacy catalog alone. Review all session Brand writers: Brand create/delete, project hydration, campaign adoption and setup route. Keep Board/campaign consumers on authoritative association; retain freshness invalidation in `campaignCreationIdentity`.
7. **Enable selection and profile access consistently.** Update selector counts/null-association gates, row actions and Home disabled/click guards. Feed Home preference separately from Board context; align `resolveRegularBrandProfile`/`resolveEntry` with explicit profile intent while retaining Board-specific Snapshot/Core navigation. Keep existing profile Save/Discard/Cancel. Reconcile library filter lookup/invalidation through `handleWorkspaceBrandSelectionChange`.
8. **Verify DOM/CSS and regressions.** Preserve IDs/body-owned surfaces and delegated events; adjust only scoped selector/Home CSS and translated copy as necessary. Account for hidden management controls, mobile action-only wrappers, nested row hit targets, effective keyboard visibility and focus after rerender. No toolbar redesign, parallel router, duplicate state manager, SQL backfill or paid generation is required.

## 8. Focused regression and live acceptance plan

### Audit verification executed

| Check | Result |
| --- | --- |
| `node scripts/check-bw36-13r2-first-workspace-creation.js` | PASS: 30 acceptance groups; mocked transaction/identity/bootstrap/rollback/concurrency, first-only rejection and client reconciliation. |
| `node scripts/check-bw36-10-workspace-selector-and-sidebar-hierarchy.js` | PASS: existing hierarchy, Board priority, DOM/responsive/accessibility assertions. This suite's presence checks do not prove complete dirty-Canvas switch protection. |
| `node scripts/check-bw36-9-authorized-workspace-read-boundary.js` | PASS: 12 groups with injected database doubles, identity/access/catalog separation and relationship rejection. Initial sandbox run could not complete its local git subprocess check; rerun with permitted subprocess execution passed. |
| `node scripts/check-bw36-21a-home-foundation.js` | PASS: mocked browser routes, account/public/metadata isolation, filters/focus, six layout geometries, four screenshots, delayed Board loads, Home failure recovery and route/reload/Back coverage; zero provider calls or product writes. Initial Chromium sandbox launch failed; permitted local execution passed. |
| Actual-handler VM probes, no network/database | PASS: Board priority over supplied Brand; active-Board selection returns false; dirty cross-Workspace switch retains nodes/association/snapshot/load generation. These probes establish the transition gap, not desired future behavior. |

No runtime tests were added or modified. Browser evidence is local fixture evidence, not production acceptance. Existing passing tests intentionally lock some behavior that must change in a later implementation; update those expectations deliberately rather than deleting authorization assertions.

### Regression additions for implementation

| Area | Focused assertions |
| --- | --- |
| Creation contract | Existing v1 still first-only; v2 can create a second Workspace for an eligible identity, including one whose current membership is viewer. New owner role and no descendants. Invalid/disabled/ambiguous/session failure rejects. Two concurrent identical UUID requests create one Workspace/owner; changed input conflicts; distinct UUIDs are independent; replay cannot reveal a foreign UUID or revive revoked/archived access. Rollback leaves no orphan owner/Workspace. |
| Reconciliation | Other Workspace arrays retain their contents; populated retry target is not emptied. POST timeout followed by same UUID retries safely. Account change, stale lifecycle, catalog refresh, cancellation and post-commit UI failure cannot apply another user's outcome. |
| Direct preference | No Board, active branded Board, unbranded Board, hidden association, single/multiple/zero Brands. Select Y; association and snapshot of A/X remain byte-identical, Canvas stays dirty/clean as before, no Board writes. Reload saved A still has X. |
| Profile navigation | Open authorized Y while A/X active; view/save only Y, return to A/X with Canvas unchanged. Dirty profile Save/Discard/Cancel; failed/conflicted/unconfirmed saves retain draft and do not switch. Viewer can view but not edit/delete; stale/deleted/foreign target cannot load. |
| Workspace lifecycle | Dirty Canvas/local draft Cancel preserves identity and content; explicit discard retires it. Loading/hydration/save/409 conflict/association/campaign/responsibility operations cannot race a switch. Late success/failure cannot restore old IDs, snapshots, capabilities or UI. Shared Board absent from catalog also exits safely. Same-Workspace click does not close or reset work. |
| Privacy/access | Revoked/pending membership, archived Workspace, unauthorized Brand, hidden association, logout/account replacement, malformed catalog and stale responses. No foreign names/logos/IDs/Canvas in target DOM, cache projection, selector, Home or library. Existing independent shared/public Board access stays unchanged. |
| Home/library | No-Board selection updates card and context; All default remains; explicit Brand filter uses selected Y. Open Board A card stays X and Continue stays A. Metadata error does not remove authorized links; scoped abort prevents delayed W1 rows in W2. Creation available with zero/one/multiple Workspaces. |
| DOM/layout | Expanded/collapsed ≥1440, 1024, ≤767 and 390px; desktop/mobile role matrix; long names/logo failure; one-entry selector; >8 searchable rows; Tab/arrows/Home/End/Enter/Space/Escape/outside dismissal/focus restoration; high contrast/reduced motion. Row management never selects or deletes a different row. |

Retain the four executed suites and relevant profile lifecycle/deletion/project/campaign suites (`check:bw36.13r4r1`, `check:bw36.13r5`, `check:bw36.13r6`, `check:workspace-brand-deletion`, `check:bw36.14`, `check:bw36.15r1`). Use injected databases/local browser interception; reject unexpected external/provider requests.

### Live acceptance after implementation approval and deployment

Use designated test accounts/Workspaces and normal application APIs/UI, with no direct production SQL and no AI generation. This is a future plan; it was not executed in this audit.

1. Existing account with W1, Brands X/Y and saved Board A/X: create W2 through the UI, verify one new owned empty Workspace. Retry an intentionally interrupted creation with the same creation identity; verify no duplicate. W1 Brands/Boards remain intact.
2. Switch W1/W2 from Home and both sidebar sizes. Verify only authorized target content, empty W2 Home and no W1 Canvas/profile/presence content. Test one account with read-only W1 membership and another with no W2 access.
3. With no active Board in W1, select Y via sidebar and Home. Verify context, selected card, explicit filter, and Profile Y; no Board has to be opened.
4. Open A/X, select Y and open Profile Y. Verify clear distinction between selected Y and open A/X; return to Canvas, save an ordinary A edit, reload A and verify association/snapshot provenance still X. Inspect requests to confirm selection emitted no association/snapshot write.
5. Dirty Canvas and dirty Profile: exercise Cancel, deliberate discard, confirmed save, failed save and offline retry before Workspace switch. Delay a Board read/save while switching; verify target cannot display late old data or adopt old capabilities. Verify browser Back/reload and shared Board outside catalog.
6. Revoke test access, sign out and switch accounts. Confirm selectors/Home/library/profile clear or deny appropriately and cached preferences cannot restore inaccessible context. Test keyboard/touch at desktop, tablet and phone sizes in both sidebar modes.

## 9. Explicit decisions requiring approval

These are implementation decisions for review, not changes authorized by this audit PR.

1. **Creation entitlement:** recommended: any verified active application identity eligible for initial creation can create an additional independently owned Workspace, irrespective of their role in another Workspace. Confirm quotas/billing or admin-only restrictions, if intended; none are established by the current first-only handler.
2. **Retry contract:** approve additive `workspace_create_v2` with a stable client-generated Workspace UUID, preserving v1 compatibility, versus a durable request ledger. Existing primary key deduplication is the minimal proposal; exact transaction tests must prove replay isolation. Do not weaken the first-only guard without replacement retry semantics.
3. **Post-create destination:** recommended: append confirmed Workspace and offer explicit guarded switch; first-ever creation still activates it. Automatic switching requires approval of the same dirty-work/lifecycle rules before submission or transition.
4. **Brand-row semantics:** approve row = preference selection in both sidebar modes, separate Profile action for all viewers, and selected Y/open Board X distinction. Opening a profile automatically on every row click would change the existing selector contract and is not the proposed default.
5. **Profile navigation priority:** approve explicit selected/viewed Brand for regular profile navigation when a Board is active, with Board Snapshot/Core and campaign operations continuing to resolve its persisted association. Keep an explicit way to view the open Board's associated Brand Profile.
6. **Persistence/filter scope:** recommended minimal rollout: reuse existing session preference owners, no new per-Workspace persistent store; preserve All default and existing filter reset. Persisting a per-Workspace preference across reload or retaining Brand-filter mode across picks requires separate approval.
7. **Workspace exit guard:** approve explicit Canvas Cancel/Discard wording and blocking/settling in-flight operations, with existing save available before retrying. No silent discard, automatic reassignment or success on an unconfirmed save.

No runtime code, schema, deployment or merge is included. The documentation PR is ready for review; implementation remains gated on the decisions above.

BW-36.21A-R2 NAVIGATION AUDIT READY FOR REVIEW
