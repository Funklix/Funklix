# BW-36.16R1 — Canvas toolbar and global node view cycle

## Verified previous ownership

Started from freshly fetched `origin/main` at `8fed993c50cdb8e0a100acad35cf4d11b1c7621d`, containing merged BW-36.16. `initializeResponsibilityToolbar` inserted Responsibilities after Add node in the primary toolbar. Its click opened `openCampaignResponsibilities`, the BW-36.15R1 workspace/controller. `initializeAdaptiveCanvasToolbar` inserted the written Compact view switch immediately afterwards; `adaptive-canvas-view.js` owned its forced Compact/Auto semantics and the successful adaptive node interaction. Utilities already excluded density radios and Compact All/Expand All. The hidden legacy hooks delegated to the same model. The older isolated `canvas-density.js` compatibility API is not the production global presentation owner and its storage writer remains unused.

## Corrected toolbar hierarchy and Tasks

The existing primary row retains Create campaign, Add node, Undo, Search and account controls. The existing second-row left group now contains Filters → Utilities → Tasks → SVG view button. No third toolbar row or new toolbar is created. The static toolbar HTML remains byte-for-byte preserved; both controls and the screen-reader status are installed by their existing JavaScript toolbar owners. Board badge, collaborators and Copy Link keep their existing second-row right-group ownership.

The visible action is Tasks / Aufgaben. Its accessible name and native title tooltip are Manage campaign responsibilities / Kampagnen-Verantwortlichkeiten verwalten. It still invokes the existing responsibility workspace, with the same access/hydration visibility guard, viewer permissions, return focus, assignment, reassignment, bulk assignment, team membership, concurrency and save/retry controllers. The responsibility JavaScript implementation is unchanged.

The global control retains the compatibility DOM ID `canvas-compact-view-btn`, but displays only the established Canvas/view SVG cloned from the compact context bar. It is a fixed 44×44px rounded Tendra One secondary icon button, with existing theme tokens, active treatment, focus outline and forced-color treatment. The Responsibilities stylesheet retains the primary group’s existing conditional wrapping through the toolbar ancestor, because Tasks now lives in the second row. The existing second-row left flex group wraps at narrow widths; the icon never stretches with mobile text buttons.

## Global mode authority and adaptive precedence

One session-only `mode` lives in `adaptive-canvas-view.js`: compact, standard or detailed. The old `forced` flag and Compact/Auto toggle are removed. Clicking the view button cycles Compact → Standard → Detailed → Compact, repeatedly. Hidden legacy Compact All and Expand All hooks delegate to the same setter; Utilities contains no visible duplicate density authority. Switching modes performs no fetch, save, browser-storage write, Board mutation, node-content mutation or position change.

The presentation resolver first returns global Standard or Detailed for every node, before considering interaction pause, selection, hover or focus. In global Compact it executes the pre-existing adaptive resolver. Returning to Compact clears presentation identities, Detailed flag, frozen presentation map and Canvas presentation selection, so every card becomes Compact immediately. It does not replace or rewrite the hover, focus, click, double-click, drag, pan, connection or Escape handlers.

Compact remains: all Compact; hover/focus A temporarily Standard; leaving/blur Compact; selecting A persistent Standard; double-click A Detailed; selecting B returns A to Compact and makes B Standard; blank Canvas clears; Escape retains its existing Detailed → Standard → Compact hierarchy and inner-surface priority. Global Standard/Detailed override these per-node presentations without disabling selection or actions.

Board loading/switching and Canvas/list transitions reuse the existing reset boundaries. Account changes through session loading and sign-out explicitly reset the same UI model. Deletion retains the existing prune/resize cleanup. Retired persisted density preferences are ignored without rewriting storage. There is no database persistence or migration.

## Accessibility and responsive behavior

The button's aria-label and native tooltip expose current mode and next action, localized exactly:

| Current | English | German |
| --- | --- | --- |
| Compact | Node view: Compact. Switch to Standard | Node-Ansicht: Kompakt. Zu Standard wechseln |
| Standard | Node view: Standard. Switch to Detailed | Node-Ansicht: Standard. Zu Detailliert wechseln |
| Detailed | Node view: Detailed. Switch to Compact | Node-Ansicht: Detailliert. Zu Kompakt wechseln |

Native button Enter/Space activation is retained. A restrained screen-reader-only status uses the established `role=status`, polite aria-live, aria-atomic and sr-only pattern to announce the new mode after each switch, without visible explanatory toolbar text. Resets clear the announcement. Existing reduced-motion behavior is unchanged; card dimensions still have no animation.

The Chromium matrix covers EN/DE, light/dark and widths 1920/1440/1280/1024/768/640/600/480/375/360/320, plus 640×450 at 200%-equivalent reflow, forced colors, reduced motion and mobile touch. It checks toolbar/page overflow, the Canvas viewport boundary, 44px icon size, exact accessible labels/tooltips, keyboard activation/focus, and no overlap with the right-group Board/collaborator/link controls. The infinite Canvas retains its established internal scrolling/panning behavior.

## Regression protection

The new `check:bw36.16r1` invokes the shared BW-36.16 production Canvas fixture with additional refinement contracts, so it uses the real HTML, renderer, loader and handlers rather than a substitute Canvas. It verifies toolbar ownership/order, existing Tasks workspace, first and repeated global cycles, per-node selection/hover authority, return-to-Compact adaptive flow, Board reset, reader cycle, account/sign-out reset, exact EN/DE aria/title/status progression, keyboard, responsive layouts, drag/connection and deletion. Before intentional data actions it asserts unchanged node/edge/dirty state, fixture Board data, browser storage and zero presentation API requests. Console errors and provider/AI calls are forbidden.

BW-36.16 keeps all hover, focus, click, double-click, Escape, touch, renderer geometry, child-control, drag, connection, deletion, content/storage, theme and responsive assertions; only obsolete forced Compact/Auto expectations are replaced by the three-mode cycle. BW-33.3R1 replaces only its obsolete toolbar aria-pressed assertion with the accessible names for all three current/next states; its activation, storage, unsafe-lifecycle and renderer assertions remain unchanged. BW-23 replaces only its obsolete forced-toggle aria-pressed literal with the current-mode and localized accessible-name contract. BW-36.15R1 updates only the changed Tasks visible label and descriptive title expectations. Assignment and concurrency assertions remain intact. The focused check and its syntax check are registered in Runtime Boot Safety after BW-36.16.

Final local result: **182/182 declared Runtime Boot Safety verification commands passed in workflow order**, including BW-36.16R1, BW-36.16, BW-36.15R1, BW-36.15, BW-36.14R1, BW-33.3R1 and existing Canvas responsive checks. Dependency setup also passed: the declared npm install and equivalent browser provisioning through installed Playwright plus pre-provisioned system Chromium, rather than re-downloading Chromium locally. CI retains its original Chromium installation command. The final sequence completed in 254 seconds. Browser-script integrity passed for 39 classic scripts; syntax passed for all eight changed JavaScript files; staged and unstaged `git diff --check` passed. The focused R1 Chromium check passed all ownership, cycle, adaptive, language/theme/width, touch, drag/connection, deletion and account/sign-out checks, with zero console errors and zero mode-switch API/storage/data mutations. No deployed-production or manual visual acceptance is claimed.

## Deployment and rollback

Deploy the normal application bundle after manual review/merge and successful Runtime Boot Safety. No migration, manual SQL, database action, new environment variable, data conversion or preference write accompanies deployment. Roll back by reverting the single BW-36.16R1 correction commit and redeploying the application bundle. No data rollback is needed. This task opens one normal PR and never merges or deploys it.

## Manual acceptance

Open an authorized existing Board and verify the two toolbar rows and Tasks workspace. Cycle the grid button through all three states and confirm every node follows; select, hover and open node Details in global Standard/Detailed without collapsing other cards. Return to Compact and repeat hover A, leave A, click A, double-click A, click B, blank Canvas and Escape. Repeat the cycle, switch Boards, leave Canvas, change account and sign out. Check a reader, EN/DE, light/dark, keyboard-only operation, tooltip/focus, narrow/mobile/reflow, reduced motion and forced colors. Confirm drag, connections, comments, inline editing, responsibilities, Board badge/collaborators/Copy Link and saved campaign data remain functional. Local Chromium fixture evidence does not claim deployed-production or manual visual acceptance.
