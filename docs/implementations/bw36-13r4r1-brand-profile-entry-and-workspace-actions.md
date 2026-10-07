# BW-36.13R4R1 — Brand Profile entry and Workspace actions

## Baseline and evidence

Based on fetched `origin/main` at `83b12a923bd75544575ed1d425b75cae7408f78c`, the merge of PR #748. The supplied production evidence reports that “Brand Profile” opens “Board Knowledge Snapshot” / “Board Brand Core”, displays the contained logo placeholder, and that the visible owner Workspace ellipsis does nothing. No production account, database, provider, AI or storage was contacted to implement or test this change.

Inspected AGENTS.md, app.js, index.html, language.js, brand-profile-setup.js/CSS, brand-logo.js, brand-sidebar.js, workspace-sidebar.js/CSS, workspace-catalog.js, project-dialog.js, Brand collection/detail/logo APIs, _brand-logo.js, _brand-access.js, analyze-brand-domain.js, R1/R4 implementation records, and the BW-36.13 lifecycle / BW-36.3 / BW-36.5 audits. The existing guided controller, catalog, API authority, snapshots, provenance and revision contracts are retained.

## Verified causes and event/render paths

**Profile:** `#brand-core-nav-btn` invoked `setAppMode('brand')`, which calls `setActiveView('brand-core')`, `renderBrandCoreTiles()` and `renderBrandCoreEditor()`. This is the Board snapshot renderer. The R4 reusable `FunklixBrandProfileSetup.mount()` was instead reached through the separate Brand detail / project handoff flow. The navigation therefore never reached the reusable uploader. Setting `BRAND_LOGO_MUTATIONS_ENABLED` true would expose a different, contained path and is not the repair.

**Ellipsis:** reproduced in Chromium with the actual index.html, production CSS, all application scripts and app.js-created controller. Initially `surface === null` and `menu === null`; `activeSurface()` returns null. `if (activeSurface() === menu)` consequently enters the toggle-close branch on the first click and returns before creating a menu. An additional click listener recorded that the real click arrived but no menu existed. There was no page error, overlay intercept, detached listener or reconciliation removal in this reproduction. The corrected `if (menu && activeSurface() === menu)` creates exactly one body-owned menu; a second actual click closes it.

Browser regression additionally identified and repaired:

- The higher-specificity mobile `.sidebar > :not(nav):not(.sidebar-settings)` rule hid the context host. A narrow Workspace-context selector overrides it; the existing management trigger remains 44px in compact rail/mobile.
- Outside pointerdown focus restoration preceded the browser's default focus change. Pointerdown now closes the portal, and the ensuing click restores the captured focus synchronously. No timer or reload is used.
- Right-edge clamping could place a compact menu over its own trigger during reflow. Compact placement now uses the available right side, left side, or space above the trigger, within viewport bounds.

These are verified local production-DOM findings, not a claim to have inspected an authenticated deployed page.

## Regular Brand resolution and controller reuse

`openRegularBrandProfile()` resolves using `FunklixBrandProfileSetup.resolveEntry()` against the already authorized Workspace catalog:

1. An open authorized Board resolves only its stored same-Workspace Brand. Missing/unavailable/unbranded/Board-only context fails closed and never substitutes the session Brand.
2. Without a Board, resolve the authorized session Brand within the current Workspace.
3. Use the sole authorized Brand when only one exists.
4. Multiple Brands without selection render explicit named choices; selecting uses the existing session Brand handler.
5. No authorized reusable Brand renders a localized empty state, without opening the snapshot automatically.

Signed-out, public-token and non-ready contexts resolve empty without Brand requests. Cross-Workspace associations fail closed. Existing Brand detail GET and its server authorization still supply edit/read capabilities. Response adoption checks account, request, catalog generation, ready state and Workspace context.

Regular navigation mounts the **same native Brand detail element and the same R4 controller** as an in-flow `brand-profile` view in the existing workspace container. The sidebar destination is active, other views are hidden, and it scrolls within the existing shell. Closing returns to the prior view. Navigation away respects the existing busy/draft discard protection. The post-project handoff continues using the existing modal, return-to-project and one-command creation flow; there is no second analysis/save/logo/revision implementation. Modal Tab wrapping remains; the regular view allows ordinary document navigation. Advanced options and existing team/permissions functionality remain available.

## Logo access and snapshot separation

Owner/admin/editor see the file input, local preview, Upload logo or Change logo, Analyze website, and candidate confirmation in the regular guided Profile. A saved logo exposes a secondary Remove logo action with localized confirmation. Viewer has no mutation controls and direct session writes issue no requests.

Upload/discover/remove continue through `/api/brands/:id/logo` with `brand_logo_v1`, captured Workspace ID, request ID and expected logo revision. Removal verifies the null URL and incremented revision. All BW-36.12 server MIME/signature/size/dimension checks, independent Brand authority, private `brand-logos` bucket, same-origin reads, transaction/replacement/compensation remain unchanged. No browser Supabase access or alternate storage path is introduced. The old application gate remains false, and the retired Board upload function also exits before any mutation or alert.

Confirmed success uses the existing `patchCatalogBrandLogo()` and project-dialog reconciliation. The same shared renderer updates the Profile, Workspace Brand row, project Brand cards and other authorized identity projections without reload. Image error uses Unicode-safe initials. Failed upload retains the file and data preview, shows local failure and allows deliberate retry; an unverified response is never success. Website candidates remain proposals requiring confirmation; uploaded-logo priority remains unchanged.

The old Board surface is labelled **Campaign Brand Snapshot / Kampagnen-Markenstand** with the specified stable-project description and a secondary **Open Brand Profile / Markenprofil öffnen** action. Its Brand Assets section has only a confirmed reusable logo/initials read; no upload, disabled placeholder or “temporarily unavailable” message. Snapshot-only/Board-only users can deliberately open their authorized snapshot from the Profile empty state, without gaining Brand access. No Profile write copies into state.brandCore; snapshot changes do not write a reusable Profile. Compare/sync are unchanged and no new automatic synchronization is added.

## Workspace portal lifecycle and authorization

Opening the existing ellipsis is purely in-memory: no Workspace GET and no PATCH. Rename uses the existing compact body-owned dialog and existing transport, issuing one PATCH only on valid submit. Menu has `role=menu`, localized accessible name and a menuitem. Same-ready-Workspace reconciliation preserves the portal and repositions it; Workspace/status/sign-in/role loss closes it. Both entry and rename submit check ready state, visible signed-in host, exact Workspace and owner/admin role. Member/viewer cannot use the hidden/disabled trigger or direct management controller call. Retry/stale behavior remains.

Escape, Outside click, toggle and cancel restore focus. Portals use existing themed tokens, focus outlines and body ownership. Responsive CSS changes only keep the current Workspace actions reachable; no new navigation, topbar, sidebar redesign or Canvas-toolbar change is introduced.

## Validation actually performed

- `npm run check:bw36.13r4r1`: actual Chromium, complete index.html/app.js and production scripts/CSS; local intercepted API envelopes. Clicks the actual ellipsis, inspects exactly one visible Body menu, opens Rename, cancels, verifies focus, submits one valid rename, clicks actual Brand Profile, sees existing editable Brand upload. Covers Board precedence, active/sole Brand, explicit choices, empty/Board-only/public denial, viewer direct writes, owner/admin/editor upload, failed upload/file retention/retry, same-origin endpoint, Profile/sidebar/project-card reconciliation, candidate offer, confirmed remove, no snapshot overwrite, no snapshot uploader/placeholder, disabled legacy function, revocation and stale/error/loading states.
- Menu/dialog tested in light and dark at 1440, 1024, 768, 480, 375 and 320px; regular Profile tested at the same widths and 720x450 CSS pixels as 200% reflow equivalent to 1440x900. Actual browser zoom was not claimed. Bounds, document horizontal overflow, 44px controls, focus outline and EN/DE menu/Profile are asserted.
- No unexpected console or page errors. The deliberate mocked HTTP 500 produces exactly one expected browser transport diagnostic, explicitly accounted for; the app displays a local retryable upload error.
- Local screenshots were captured and inspected for the regular Profile at light/1440 and dark/320. These are synthetic fixtures, not production screenshots.
- `npm run check:bw36.13r4`
- `npm run check:bw36.13r3r1`
- `npm run check:bw36.13r3`
- `npm run check:bw36.12`
- `npm run check:bw36.11r1`
- `node scripts/check-bw20-brand-team-roles.js`
- `node scripts/check-browser-script-integrity.js`
- `node --check` for all changed JavaScript files, including the new check
- `git diff --check`

Historical tests were not weakened or edited. The new check is registered in package.json and CI installs the browser test dependency and Chromium before executing it. Every fixture browser request is fulfilled locally; server authorization/storage checks remain covered by the existing boundary fixtures. No real provider/AI/storage/production database requests occur in tests. Full Runtime Boot Safety remains CI's responsibility.

## Deployment and rollback

Deploy the complete application bundle after normal PR review and CI. Deployment was not performed as part of this implementation; production acceptance remains pending. No migration, manual SQL, migration rerun, bucket change or data repair: **none**.

Rollback by reverting this application commit and deploying the prior bundle. Preserve all existing schema, revisions, objects and private bucket. Do not run BW-36.8, BW-36.12 or BW-36.13R3 again.

## Manual production acceptance — pending

1. Als Workspace owner und Brand editor anmelden.
2. Board mit zugewiesener Brand öffnen.
3. `Brand Profile` anklicken.
4. Prüfen, dass das wiederverwendbare Brand Profile erscheint.
5. Prüfen, dass nicht mehr automatisch der Board Brand Core erscheint.
6. Unter Brand Basics eine PNG-, JPEG- oder WebP-Datei auswählen.
7. Vorschau prüfen.
8. Upload bestätigen.
9. Prüfen, dass das Logo ohne Reload im Profile und in der Sidebar erscheint.
10. Website analysieren und gegebenenfalls Logo-Kandidat bestätigen.
11. Campaign Brand Snapshot öffnen.
12. Prüfen, dass dort kein zweiter Logo-Upload existiert.
13. Ellipsis neben dem Workspace anklicken.
14. Prüfen, dass `Rename workspace` sichtbar wird.
15. Rename-Dialog öffnen und abbrechen.
16. Erneut öffnen, einen gültigen Namen speichern und genau einen PATCH prüfen.
17. Viewer-Rolle prüfen: kein Rename, kein Logo-Upload.
18. Light/Dark, Tastatur und 200 % Zoom prüfen.
