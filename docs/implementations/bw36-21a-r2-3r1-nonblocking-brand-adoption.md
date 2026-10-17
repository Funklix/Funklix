# BW-36.21A-R2.3R1 — Non-blocking Board startup and Brand context adoption

Date: 2026-10-17 (Europe/Berlin). Scope: targeted P1 fix only.
Base: latest merged main `730a69404cf121d468f4cabb8865984243bdde18`, including PR #788.

## Root cause

Read the R2.3 implementation report and unresolved [P1 Codex finding on #788](https://github.com/Funklix/Funklix/pull/788#discussion_r4303095847).

R2.3 introduced `await adoptLoadedBoardBrandPreference(hydratedBoard, navigationOrigin)` in `loadBoardFromUrlIfPresent()`'s `finally`. That helper awaits `origin.catalog.promise`, the independently started `/api/workspaces` read. Even after valid Board data had hydrated and loading flags had cleared, the loader's promise could not resolve until this optional read settled. `bootApp()` awaits the loader before its remaining rendering, saved-snapshot baseline and `startAutosaveWatcher()`. A never-settling catalog therefore left an apparently editable Board without its dirty watcher.

## Critical and optional boundaries

The loader still awaits Board retrieval, response/access checks and valid Canvas hydration. It still applies the authoritative Board snapshot, initializes presence/refresh behavior, records successful hydration generation and clears loading flags through the existing lifecycle. Its post-hydration toolbar, association, Home and sidebar rendering now continues immediately. Boot can finish post-hydration Canvas rendering, establish the saved snapshot and start its ordinary autosave watcher.

Only the optional adoption call is detached with `void ... .catch(...)`. The existing async helper may await its captured catalog without holding the Board loader or boot promise. A ready catalog is adopted immediately through the same helper. A delayed catalog reconciles when it settles. A failed or never-settling request cannot prevent initialization. Presentation errors remain caught outside the Board access-failure handler, so they cannot erase a valid Board or snapshot. No polling, timeout, additional request, state manager or persistent preference mechanism is added.

## Reconciliation guards retained

After the catalog await, the helper revalidates:

- Account object and email; captured catalog object, ready status and normalized account identity.
- Catalog/Workspace generation and explicit Brand preference generation. Actual Workspace switching increments the catalog generation and retires the Board; rejected switching attempts do not.
- Current Board ID, route identity and load generation; successful hydration generation, current view permission and unchanged saved association; public-token routes cannot adopt.
- Applicable authorized Workspace: a conflicting response Workspace cannot borrow a stale catalog Board association. Where a response Workspace is absent, the authorized Workspace must independently contain the Board.
- Independent Brand visibility in that Workspace's catalog. Board access and snapshot hints never establish Brand membership. Hidden/unverifiable associations use neutral navigation.

A newer explicit Brand choice (including clearing the selection), catalog replacement, account switch, actual Workspace retirement, newer Board or newer load invalidates an older continuation. Adoption changes only the existing navigation preference/session projection and existing sidebar/Home/filter presentation. The saved Board association, Canvas, snapshot, revision, generation requests and persistence remain untouched. The selected-Brand/open-Board mismatch notice and Brand-centered Home ordering remain governed by R2.3. R2.1 switching and pending AI mutation guards are unchanged.

## Regression evidence

The existing `check:bw36.21ar2.3` gate is extended, so Runtime Boot Safety automatically runs the new cases. Browser requests are intercepted to local fixtures; no production SQL or paid AI requests run. Deferred requests are released by test actions, not arbitrary delays. The never-settling case closes the page without releasing the catalog.

New coverage verifies boot reaches the actual `startAutosaveWatcher` registration and rendered Canvas while catalog data remains pending; success after hydration; permanent pending; deferred 503 and network rejection; ordinary edits detected and PUT by the real watcher/autosave path; exact Canvas/snapshot/access/revision equality and zero writes from reconciliation; another Board or a newer generation of the same Board with a different Brand; explicit preference clearing and explicit Y selection before a pending refresh settles; Workspace retirement and account replacement; independently hidden/shared Brand associations and revoked independent Brand visibility. Existing immediate catalog, Home grouping, mismatch notice, Profile authority, read-only/access and responsive cases remain enabled.

The regression was also run against an isolated copy of unchanged merged main with the new tests: immediate and finite-delay catalog cases passed, then the deferred catalog case timed out waiting for the actual autosave watcher/startup completion. The same deferred case passes with this fix, demonstrating that the new test detects the P1 failure.

Final local validation:

- Focused R2.3: **PASS, 30 groups**, including all new deferred-request cases and retained Home ordering/mismatch tests.
- Syntax checks for application and focused test script, plus `git diff --check`: **PASS**.
- Complete Runtime Boot Safety: **PASS, 183/183 validation blocks, no failures**, including all **96 R2.1 Workspace-switching/pending-AI mutation groups**, R2.2 server/client and navigation regressions, Board/Brand lifecycle and autosave coverage, Home, Canvas and browser-global checks. The expanded 30-group R2.3 suite also passed inside this complete run. Dependencies and browser setup use installed dependencies and system Chromium locally.
- Browser script integrity: **PASS, all 44 browser scripts**.

The non-draft PR and its observed CI/Codex review status are reported in the delivery response. No merge, production SQL or paid AI request was performed.

Only `app.js`, the existing R2.3 regression script, and this implementation report change. The existing CI gate already invokes the expanded suite; no workflow changes are necessary.
