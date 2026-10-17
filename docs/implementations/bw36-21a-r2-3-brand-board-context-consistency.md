# BW-36.21A-R2.3 — Brand and Board context consistency

Date: 2026-10-17 (Europe/Berlin). Scope: R2.3 only.
Baseline: latest merged `main`, `d1087694f88eb8a2b9be0f9f22a818d8afee1c86`, merge of #787 (R2.2).
The initially older local checkout was synchronized with GitHub; its full source tree and commit were verified against this SHA, followed by a successful `git fetch --refetch origin main`. Work uses a dedicated branch. No merge, production SQL, migration or paid provider request is part of delivery.

## Confirmed causes and inspected dependencies

The R2 Workspace/Brand navigation audit, BW-36.21 start-screen audit and R2.2 implementation document were read against actual merged source. The three separate identity owners introduced by R2.2 are retained.

1. `home-foundation.js:model` sorted active Board first, then collection `updated_at`, irrespective of selected Brand. The all-visible view therefore promoted a more recently modified unrelated Board or an active foreign-Brand Board over connected Boards. Catalog array order supplied the fallback. Metadata was already intersected with catalog Board IDs and deliberately omitted collection names, snapshots and display associations.
2. R2.2 deliberately removed Board-response preference writes. `syncRuntimeSessionFromLegacy` correctly projects `selectedBrandPreferenceId()` rather than Board authority, but the loader had no explicit post-hydration adoption step. On reload, the session-only preference starts empty; with multiple Brands the sidebar correctly displayed a neutral chooser even for a loaded branded Board.
3. The sidebar popover displayed the catalog's open Board and visible association, and Home had a generic separation note. Neither continuously explained a deliberate selected-Y/open-X mismatch on Canvas or named both contexts on Home. The popover additionally treated a null catalog association as definitely unassigned, although that projection also uses null for restricted associations.

Inspected owners and contracts:

- Board collection: `api/boards/index.js` retains its separate authorization, manual ordering and 200-row limit. Viewer rows suppress associations. An explicit `brand_id:null` on an unrestricted collection row establishes unassigned status; an omitted property or `brand_visibility:'hidden'` does not.
- Workspace catalog: `api/_workspace-catalog.js` independently authorizes accepted memberships, Brands and Boards. Hidden Brand IDs become null; Board access alone cannot grant Brand or Workspace membership. `workspace-catalog.js` validates that projection and derives active Workspace. Neither server boundary changes here.
- Preference and Workspace lifecycle: `selectSessionBrand`, `selectSessionWorkspace`, `selectedBrandPreferenceId`, sidebar render, preference generation, account/catalog reset and R2.1 retirement remain the owners. Workspace switching still guards unsaved work and pending mutations. No second preference store is introduced.
- Board lifecycle: `loadBoardFromUrlIfPresent`, association invalidation/adoption, authoritative Brand Core snapshot, hydration/access validation, `syncRuntimeSessionFromLegacy`, save/autosave, polling and explicit association writes were traced. The new adoption is presentation-only and runs after successful hydration.
- Navigation: the Home Board route adapter, current-Board Canvas navigation, explicit Boards Brand scope, `openRegularBrandProfile`, regular Profile resolution and Profile busy/dirty leave guards are reused. DOM IDs and existing handlers remain.
- Campaign and AI: `resolveCampaignCreationContext` resolves the current Board, its saved association, independent Workspace/Brand authorization, edit access and saved revision. Its freshness identity includes navigation context without using it as canonical Core authority. AI Brain identity uses the actual Board/association; its content consumers use the Board snapshot/Canvas. Project creation legitimately uses explicit authorized selected Brand when creating a new project. These boundaries are distinct.
- Content generation/refinement, node responsibilities, publishing, exports and previews continue using existing current Board IDs, nodes and snapshot/Core serialization. No selected-preference reader was added to those paths. Canonical Profile Y remains in `canonicalBrandDetail` and does not hydrate Board A/X. A concrete decorative context dependency was found in `getApprovedBrandAvatarUrl`: its default follows a viewed canonical Profile. Canvas Brain identity, campaign visuals and AI Review comment/activity metadata now explicitly pass the current Board Core, so an independently open Profile Y cannot supply its avatar to Board X. Default Profile avatar rendering remains independent. A targeted real-handler regression covers this path. No provider prompt or inference behavior changes were needed.
- Existing Home/sidebar theme tokens, EN/DE copy, compact/collapsed sidebar, mobile styles, focus handling and reduced motion were inspected and exercised.

## Product semantics and ordering

A Workspace contains multiple Brands and Boards. Each Board has one saved Brand association or none; a Brand can have multiple Boards. The saved association remains authoritative for Canvas operations. Navigation preference and the independently viewed canonical Profile remain separate.

In Home's default **All visible Boards** view, an authorized selected Brand produces:

1. **Connected Boards**: visible saved association equals selected Brand.
2. **Other Boards**: associated with another independently visible Brand in the same authorized Workspace; each card identifies its actual Brand and says **Other Brand Board**.
3. **Boards without a visible Brand**: null/missing authorized association, with honest per-card wording. **No Brand connected** appears only when the separately authorized server collection explicitly confirms null association and does not hide it. Otherwise the neutral **No visible Brand association** is retained.

Each category sorts by valid saved server modification time descending, with missing timestamps last and catalog order as deterministic tie/fallback. Active status does not outrank Brand grouping or saved recency. A current foreign-Brand Board remains in its proper category and is marked **Currently open**. Group headings and per-card labels distinguish relationship from active status.

Without a selected authorized Brand, ordering is neutral saved modification time plus the same deterministic fallback; no connected/other claim appears. The explicit Brand filter contains only catalog-authorized Boards connected to the selected Brand. Selection does not silently apply that filter; existing Home scope-change reset-to-All behavior is retained. Optional collection failure, invalid/missing dates, incomplete collections and retry messages retain all authorized catalog links. No personal last-opened history is invented. Dedicated Boards library manual order and pagination contracts are unchanged.

## Opening a Board

After the existing loader has verified Board identity, access and valid Canvas JSON, and hydrated Canvas and snapshot, it may adopt the response's saved Brand as a navigation preference. It waits for the already-running catalog read if necessary; it does not issue another catalog request.

Adoption rechecks account object/email, catalog object/readiness/identity, actual Workspace/catalog generation, preference generation, Board-load generation, route/current Board identity, viewing capability, successful Canvas hydration generation and unchanged association. A newer explicit selection, account/scope retirement, newer Board load or changed association defeats adoption. Rejected or same-Workspace attempts do not count as an actual scope change and cannot suppress adoption. The applicable Workspace must already be authorized; the response's Workspace ID or independently authorized catalog Board determines applicability, and its Brand must be independently present in that Workspace's authorized Brand list. An explicit conflicting response Workspace cannot be overridden by a stale catalog Board link. A response association alone never establishes membership.

A visible authorized Brand updates the existing ephemeral preference and its session projection, then refreshes sidebar, Home and existing Brand-filter controls. Automatic adoption bypasses the explicit-selection creation invalidation: an already acknowledged Profile-to-project continuation must finish its existing route transition. Explicit user selection retains that invalidation. The existing Brand lifecycle journey caught and verifies this boundary. A genuinely unassigned, hidden or independently unverifiable association leaves an explicit neutral preference. Singleton fallback remains available without a Board, but cannot invent an association for an open unassigned/hidden Board. Read-only/public/shared access contracts stay as returned by the Board API; a hidden association cannot be recovered from snapshot hints.

The adoption runs outside the hydration access-failure catch. A presentation failure cannot reclassify successfully hydrated Canvas as inaccessible or erase its snapshot. Association visibility and successful Canvas hydration generation are transient Board response context, reset on retirement/new loads. Existing explicit association/polling acknowledgments update visibility. Read-only Boards retain the existing Brand Core snapshot purge: the notice uses successful Canvas hydration independently of permission to read a Brand Core snapshot.

No Board PUT, association write, Canvas save, snapshot refresh, campaign generation, advice, Learning adoption or additional persistence is triggered by preference adoption or selection. Existing normal presence behavior is unchanged.

## Context notice and navigation

Selecting Y while Board A/X remains open retains A, nodes, edges, snapshot, revision and association X. Home and Canvas use one shared read-only rendering function over authorized context. Only the current surface shows the notice, with calm theme styling and a polite status paragraph:

> Viewing [selected Brand]. Your open Campaign Canvas belongs to [Board Brand].

German:

> Ausgewählte Marke: [selected Brand]. Dein geöffnetes Campaign Canvas gehört zu [Board Brand].

The notice separately identifies the open Board by its authorized loaded name. Actions reuse existing Canvas, Brand-filtered Boards and explicit Profile adapters. Matching X clears it. No selection produces no false mismatch. An unassigned Board uses confirmed neutral wording; a hidden/unverified Brand uses an unavailable-association message without IDs or names. The selector's null catalog association also uses neutral wording.

The notice appears on Home and the Canvas/list experience, rather than repeating across unrelated panels. Read-only Boards offer continuing to view rather than editing. Native buttons, 44px targets, focus-visible rings, wrapped controls, polite status, keyboard navigation and focus preservation are retained. Light/Dark tokens and reduced-motion behavior are inherited; no new animation or blocking confirmation is introduced.

## Changed files

- `app.js`: shared authorized presentation context, post-hydration adoption guards, notice lifecycle and existing navigation adapters; transient association visibility/hydration and explicit Board-scoped avatar reads.
- `home-foundation.js`: grouping/recency, safe unassigned metadata projection, relationship/current labels and shared notice rendering.
- `home-foundation.css`: compact themed notice and group headings, mobile wrapping and keyboard focus.
- `workspace-sidebar.js`: neutral loaded-Board preference behavior and access-safe null association copy.
- `index.html`: one Canvas notice host; existing IDs unchanged.
- `language.js`: German copy for the new labels/notices/actions; English source strings remain the existing translation convention.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: new focused regression gate.
- `scripts/check-bw36-21a-r2-3-brand-board-context.js`: model, actual Chromium transport/lifecycle and visual regressions.
- `scripts/check-bw36-21a-home-foundation.js`: only the intentionally changed selected-Brand ordering expectation and description.
- `scripts/check-bw36-21a-r2-1-safe-workspace-switching.js`: settle the real dirty watcher for valid foreground AI output before observing a stale response or discard decision. This isolates ordinary foreground autosave from the stale-response assertions; no protection assertion is removed.
- `scripts/check-bw36-21a-r2-2-brand-navigation.js`: reload now expects the approved R2.3 Board-Brand adoption; all independence assertions remain.
- `scripts/check-bw28-3-1-insights-runtime-rendering.js`: add the unrelated notice-render dependency to the existing isolated view fixture; existing Insights assertions remain.
- This implementation document and eight screenshots in `bw36-21a-r2-3-visuals/`.

## Regression results

Final local result: **PASS, 183/183 Runtime Boot Safety validation blocks**, consolidated after the affected blocks were corrected and rerun. Setup uses installed project dependencies and system Chromium; the CI browser installer is unchanged. Browser transport intercepts all remote calls, uses local disposable fixtures and never contacts a paid provider. SQL fixtures use disposable test databases only. Initial failures are corrected and affected blocks rerun; no assertions are waived.

The new gate covers multiple connected Boards, separate recency, unassigned/unknown privacy, neutral selection, absent/invalid/partial metadata, incomplete collections, a current foreign Board, explicit filter, direct URL/reload and delayed catalog, mismatch equality of Canvas/snapshot/access/revision, Brain/campaign authority, Profile/Boards adapters, hidden/independently shared/read-only Boards, late explicit selection, account/Workspace/Board retirement, invalid hydration and responsive accessible EN/DE Light/Dark rendering. Existing R2.1/R1/R2 and R2.2 suites retain Workspace/pending-AI protections; existing Home tests retain direct route/reload/Back and metadata revocation cases.

Final results:

- `npm run check:bw36.21ar2.3`: **PASS, 18 groups**, plus a focused rerun verifying AI Review comment and activity avatar metadata both remain on Board X while Profile Y is viewed.
- `npm run check:bw36.21ar2.1`: **PASS, all 96 groups**, retaining R2.1/R1/R2 Workspace and pending-AI protections. Foreground dirty-watcher setup makes stale-response observation deterministic; protection assertions remain unchanged.
- `npm run check:bw36.21ar2.2`: **PASS, 12 server/client and 18 Chromium groups**.
- Home and Brand lifecycle/Profile journeys: **PASS** after the final loader changes, including direct/reload/Back, full Profile-to-project handoff and viewer boundaries.
- Premium Insights/Brand avatar and Insights runtime: **PASS** (46 runtime contracts); syntax, `git diff --check` and all 44 browser scripts: **PASS**.
- The complete workflow also covers Board lifecycle, Workspace authorization, campaign creation, responsibilities, adaptive Canvas, Brain/Learning/provider mocks and UI regressions. No production SQL or paid provider calls.

Initial failures exposed an isolated-view fixture dependency, foreground watcher timing in the stale-AI fixture, Profile-to-project invalidation during automatic adoption, and read-only hydration being incorrectly tied to snapshot access. These were corrected and their affected suites rerun without removing assertions. The initial complete-run logs remain separate from the consolidated rerun results.

Remote CI/review status is included in the delivery report and PR. Automated review status is reported as observed, not implied by local tests.

### Requested acceptance coverage

| Requested cases | Evidence |
| --- | --- |
| 1–10: connected/other/unassigned ordering, timestamps, privacy, no selection, partial/incomplete metadata, current foreign Board, explicit filter | R2.3 composition and Home browser cases; retained Home failure/revocation fixtures |
| 11–16: adoption, reload/direct route, neutral/hidden/shared Boards, account/Workspace/Board retirement | R2.3 direct/delayed catalog, read-only/shared/inaccessible and deferred-response cases; retained Home Back and R2.1 shared-Board routes |
| 17–24: intentional mismatch, correct labels, unchanged association/Canvas/snapshot, matching selection, Profile Y, no PUT/save, Brain/campaign authority | R2.3 actual application handlers and exact state equality; retained Brand lifecycle, Brain and campaign suites |
| 25: Workspace/AI mutation protections | Existing complete R2.1/R1/R2 96-group suite and R2.2 suite; no assertions removed |
| 26: EN/DE, Light/Dark, responsive/collapsed sidebar, keyboard, screen-reader structure, reduced motion | Four R2.3 geometries with Home and Canvas captures, focus retention and native accessible controls; retained shell/sidebar/Profile/Canvas media fixtures |

## Representative screenshots

Disposable local data, not production acceptance. Home includes two selected-Y connected Boards, a more recently modified currently open X Board, and separately labeled unassigned/hidden-association Boards.

- [Home desktop, Light, EN](bw36-21a-r2-3-visuals/home-1440-light-en.png)
- [Canvas desktop, Light, EN](bw36-21a-r2-3-visuals/canvas-1440-light-en.png)
- [Home desktop, Dark, DE, collapsed sidebar](bw36-21a-r2-3-visuals/home-1440-dark-de.png)
- [Canvas desktop, Dark, DE, collapsed sidebar](bw36-21a-r2-3-visuals/canvas-1440-dark-de.png)
- [Home phone, Dark, DE](bw36-21a-r2-3-visuals/home-390-dark-de.png)
- [Canvas phone, Dark, DE](bw36-21a-r2-3-visuals/canvas-390-dark-de.png)
- [Home tablet, Light, EN, collapsed sidebar](bw36-21a-r2-3-visuals/home-768-light-en.png)
- [Canvas tablet, Light, EN, collapsed sidebar](bw36-21a-r2-3-visuals/canvas-768-light-en.png)

## Remaining limits and live acceptance

The catalog intentionally collapses hidden and absent Brand associations to null. Without confirming optional collection metadata, Home therefore uses neutral wording even for a genuinely unassigned Board. The bounded Board collection can omit valid saved timestamps; catalog links remain complete relative to that authorized projection. There is no new history, pagination API, durable preference storage or global manual sorting.

Preference adoption deliberately fails closed on an intervening catalog/account/scope lifecycle; the user can select an independently authorized Brand afterwards. Public/read-only responses that suppress association remain neutral. Existing production schema/deployment parity and real-account behavior require normal rollout acceptance; local fixtures are not a production verification.

After review/deployment, use designated accounts through ordinary UI/APIs:

1. Select Brand Y with two saved connected Boards and a more recently edited X Board. Home All places both Y Boards first by modification time, then X, then unassigned/unknown. Check the explicit filter and no-selection view; library manual order stays unchanged.
2. Open A/X from Home and the library, via direct URL, reload and browser Back. Authorized X becomes navigation preference after hydration. Unassigned/hidden/shared/view-only Boards remain honestly neutral without leaked associations.
3. With A/X open, select Y using Home and collapsed/expanded sidebar. Notice identifies selected Y, A and authorized X; Canvas/snapshot/association remain X. Return to X and verify notice disappears.
4. Use each notice action. Continue returns to A; selected-Brand Boards applies existing Y scope; Profile opens independently authorized Y, respects leave/save/discard guards and returns to unchanged A/X. Inspect requests for no implicit Board PUT/save/generation.
5. Delay a Board/catalog response, select Y or retire account/Workspace/Board context, then release it. No old preference or private data may overwrite the new context. Exercise pending AI/dirty Workspace protections unchanged.
6. Repeat EN/DE, Light/Dark, 390/768/1440px, collapsed/expanded, keyboard, long labels and reduced motion. Check a revoked/inaccessible Brand and incomplete/missing modification metadata.
