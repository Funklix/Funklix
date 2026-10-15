# BW-36.19R8 — Canvas toolbar Learn entry

Base: merged GitHub main `3499a4e45ec2e0ed7f38f3b36d869b3a6a444d35` (Advisor R7, PR #772).

## Audit before implementation

- `index.html` owns the existing second row, `.toolbar-row2-left`, and the Filter/Utilities IDs (`filters-toggle-btn`, `utilities-toggle-btn`). `initializeResponsibilityToolbar` inserts `campaign-responsibilities-btn` after Utilities; `initializeAdaptiveCanvasToolbar` inserts `canvas-compact-view-btn` after Tasks. Their original listeners remain the sole owners of those actions. Grid also inserts the existing live status span. Learn is inserted immediately after the Grid button; no original DOM or listener is replaced.
- `initializeResponsibilityToolbar` and `initializeAdaptiveCanvasToolbar` execute together during Canvas boot. The new isolated IIFE loads before `app.js`, after `learning-advisor.js`, and mounts after those initializers. It introduces no top-level lexical collision, fetch during boot, or dependency on an optional popover being open.
- `brand-profile-setup.js` supplies the Brand, Workspace, account/generation validity and language to `FunklixBrandLearnings`. `brand-learnings.js` creates the existing `FunklixLearningAdvisor`, adds the Profile entry, and invalidates it on teardown. That caller still invokes `open()` without arguments.
- The existing Advisor owns modal construction, request aborts, context/language monitoring, foreground revalidation, source preview, explicit analysis, review drafts, single/bulk adoption, receipt refresh, dirty-review discard confirmation, focus trapping and teardown. Close clears its transient session and restores the origin; successful adoptions preserve the open review session. Those behaviors remain shared by both entries.
- Advisor metadata GET authorizes Brand editing capability, accepted Workspace membership, Brand/Workspace association and private saved Board read access. Preview/analysis/adoption retain their existing server validation. Board editing authority is neither required for reading a source nor sufficient for writing Brand Learnings.
- The toolbar already wraps its left group, uses a responsive single-column second row below 1200px, and provides shared button theme/focus/hover rules and mobile 44px targets. Learn uses those rules with a small decorative SVG Sparkles icon and a 44px minimum height.
- BW-36.1R1 freezes the original toolbar HTML and earlier CSS; those hashes remain unchanged. BW-36.16R1 freezes the runtime button sequence; its expected sequence gains exactly `canvas-learn-btn` after Grid, retaining all original IDs and checks.

## Integration and UI behavior

The row is Filter → Utilities → Tasks → Grid → **Learn**. The displayed and accessible label is `Learn` in English and German. `aria-haspopup="dialog"` identifies its modal action; the icon is hidden from assistive technology. Shared button styling preserves Light/Dark, keyboard focus and responsive wrapping. No original action is reordered.

`canvas-learning-advisor.js` reads current Canvas state on each explicit click. It uses `currentBoardId` rather than a URL fallback or unsaved local data, checks that the Board association belongs to that Board, and resolves its associated Brand and containing Workspace from the existing authorized Workspace catalog. It does not use an unrelated selected Brand as fallback or change the active Workspace/Board/view.

Unavailable actions stay discoverable and focusable. Clicking provides EN/DE guidance in a live status associated with the button: save/open a Board, wait for hydration, associate a Brand, recover Brand/Workspace access, or obtain the required Brand editing and Board viewing permission. During asynchronous opening, `aria-busy` communicates progress, `aria-disabled` uses the shared disabled appearance while retaining a focus origin, and repeat clicks are ignored. The existing Advisor displays server denial and unavailable-source errors; analysis stays unavailable without an authorized scope.

The only additive Advisor API is `open({ boardId, returnFocus } = {})`. After the existing metadata request succeeds, the Advisor preselects `boardId` only if it appears in the server-authorized list, then runs the existing saved-source preview. It never falls back to another Board. Existing `open()` callers retain their initial selection behavior. `returnFocus` binds Canvas close behavior to the Learn button, including keyboard entry. No provider request starts before the explicit Analyze action.

## Permission and lifecycle boundary

Client eligibility mirrors the current Brand roles (`owner`, `admin`, `editor`) and requires Board viewing permission. A Board viewer who can edit the associated Brand can open Learn; a Brand viewer or Board-only collaborator cannot infer Learning write authority from Board ownership/editing. All final access and source checks remain in the existing server endpoints.

The context predicate captures the account object/email, Board ID/load generation, association ID/generation, Workspace selection/catalog generation and language. It checks current access and catalog membership again throughout the Advisor lifecycle. Switching away and back cannot revive an earlier opening request. Existing Advisor generation checks and abort/monitor teardown reject late metadata/preview responses. This uses the same lifecycle boundaries as Brand Profile and introduces no quotas or source restrictions.

The integration reads Canvas data only. It does not call Board persistence, autosave, selection, zoom, view, generation or Node rendering methods. Learning extraction, prompts/providers, validation, API/database, governance, provenance and adoption code are unchanged.

## Changed files

| File | Change |
| --- | --- |
| `canvas-learning-advisor.js` | Isolated toolbar entry, current context, eligibility guidance and Advisor handoff |
| `app.js` | One mount call after existing toolbar initializers |
| `index.html` | Load the isolated entry module before app boot |
| `adaptive-canvas-view.css` | Learn icon spacing/44px target and wrapped unavailable guidance |
| `learning-advisor.js` | Optional saved Board preselection and explicit focus origin; guard late opening errors after teardown |
| `scripts/check-bw36-19r8-canvas-learn-entry.js` | Focused production Canvas/Advisor Chromium regression |
| `scripts/check-bw36-16-adaptive-canvas-view-hierarchy.js` | Add only the approved Learn ID to the exact runtime sequence |
| `package.json` | R8 regression command |
| `.github/workflows/runtime-boot-safety.yml` | Run R8 with existing regressions |
| This document | Audit, decisions, boundaries and regression evidence |

## Regression evidence

- `npm run check:bw36.19r8`: production Canvas and Advisor DOM in Chromium, local HTTP only. Covers exact toolbar order, current saved Board preselection, associated Brand/Workspace requests, explicit-only analysis, keyboard Enter/Space/Escape and focus return; EN/DE guidance for unsaved/loading/stale association/failed association/unassociated/missing Workspace, Brand viewer, Board-only and denied Board states; server denial and missing authorized source; Board viewer with Brand editing authority; metadata and preview races for account, Board ID/generation (including switch-away/back), Brand and Workspace changes; EN/DE × Light/Dark × 320/375/640/1280px reflow. Compares selected Canvas state, nodes, edges, dirty flag, zoom, mode/view and saved Board data, and checks Canvas scroll position across opening/closing; asserts no autosave or analysis/adoption requests.
- Existing Advisor R5/R6/R7 retain their provider mocks and production review/bulk/session/access checks. No paid provider calls or production SQL are used.
- Full Runtime Boot Safety results are recorded after completion below. Local runner executes every workflow validation command; dependencies are installed separately and system Chromium supplies the browser. Browser sandbox socket permissions require the execution tool's network-enabled profile even though fixtures intercept external traffic.

Final regression result: **all 223 workflow validation commands passed across the full run and one successful rerun**. The full run completed 222/223 successfully. `check:bw35.3r4` initially failed because its tracked-files-only fixture copied the new HTML script reference before the new module had been staged; after staging, the unchanged historical test passed on rerun. No historical assertion was removed or bypassed.

Confirmed green: Advisor R5, R6 (real HTTP handlers + disposable PGlite + Chromium, including atomic rollback/retry, edited review and session preservation) and R7 (48 existing visual-state captures and accessibility checks); Canvas BW-36.16 and BW-36.16R1; BW-36.1R1 original DOM/CSS hashes; Brand Profile and Workspace regressions; all other Runtime Boot Safety validation commands. Browser script integrity also passes for all 43 local classic scripts, and `git diff --check` is clean.

The final R8 workflow execution passed all 10 opening races, duplicate-click suppression, stale/failed association guidance, both languages, both themes, four viewport widths, preselection, access/source failures, focus restoration and Canvas preservation. Desktop Light and mobile Dark toolbar/Advisor captures were also inspected locally. No remaining functional concerns were identified. GitHub-hosted CI runs separately on the PR.
