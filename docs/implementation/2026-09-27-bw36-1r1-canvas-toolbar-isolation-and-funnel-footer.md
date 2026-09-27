# BW-36.1R1 Canvas toolbar isolation and Funnel footer repair

## Recovery decision

BW-36.1 commit `d982c37` (represented in this repository by merged implementation commit `5aa36fd`) was reverted by `184a30c`. The implementation added a contextual identity block while the existing Canvas controls remained visible in the shared header, and it moved account controls and changed shared header presentation. That visual result affected Canvas even though Canvas was explicitly out of scope. Before R1, the production files were confirmed identical to the pre-BW-36.1 tree at `e7c5e6a`.

R1 does not restore that architecture. It preserves the single static `#canvas-topbar` DOM tree and all of its existing bindings. The only visibility rule is `activeSurfaceIsCanvas(view)`, which is true exactly when `view === "board"` and the application is not in Brand mode. Section changes apply that same predicate at the existing `setActiveView()` boundary, while the small toolbar visibility synchronizer covers Settings and application-mode transitions. Both apply `hidden` to the whole topbar for every other section, including bounded unknown sections. Because `.hidden` is the established `display:none` boundary, non-Canvas content naturally occupies the released space: there is no replacement surface, reserved header row, negative margin, or new layout mode.

## Canvas preservation proof

The Canvas toolbar markup in `index.html` was not edited. No toolbar presentation rule was edited. The focused regression hashes the complete restored topbar subtree and compares it with the pre-BW-36.1 baseline. It also normalizes only the audited Funnel declaration and hashes the rest of `styles.css` against that baseline. The regression exercises the real visibility predicate with deterministic Canvas, Home, Boards, legacy List, legacy Calendar, Content Workspace/Calendar, Brand Core, AI Brain, Insights, Funnel Simulator, Settings, Brand-mode, and unknown-section fixtures. Canvas continues to expose Create campaign, Add node, undo, search, Filters, Utilities, Board access, collaborators, Copy Link, theme, and the unchanged account controls.

The predicate changes presentation only. It does not mount or clone the toolbar, attach listeners, fetch or change a Board, select a Brand, render a workspace, invalidate Auto-plan or Export Review, or reset Content, Calendar, AI Brain, Insights, or Funnel state. Settings temporarily projects the non-Canvas visibility through the existing synchronizer and closing it restores the current section. Resize remains presentation-only and does not participate in the visibility decision.

## Funnel correction

At `max-width:768px`, only `.journey-nav` changes: it returns to normal flow with `position:static`, clears inherited inset anchoring, uses `height:auto` and `min-height:0`, and removes the opaque elevated surface. Its existing Back/Continue DOM order, disabled behavior, flex layout, and 44px targets remain unchanged. Bottom padding retains `env(safe-area-inset-bottom)` so Continue remains above the application bottom navigation without a sticky/fixed slab. No simulator renderer, selection, progress, theme, resize, or request behavior changes.

## Deployment and rollback

Deploy `app.js`, `styles.css`, the R1 regression, package/workflow registration, and this record together. There is no dependency, schema migration, feature flag, provider configuration, data rewrite, or server/API change. Rollback is the inverse bundle: restore the former section visibility line and compact `.journey-nav` declaration, remove only `check:bw36.1r1` and its Runtime Boot Safety step, and retain the reverted BW-36.1 architecture. No stored Board, Brand, schedule, approval, publication, or social-media state requires repair.

## Manual visual acceptance

Acceptance must compare Canvas at 1440px and 1024px with the restored baseline, then confirm no toolbar or empty header strip on Home, Boards, Content, Brand Core, AI Brain, Insights, Funnel Simulator, and Settings. Repeat at 768px, 480px, 375px, and 320px, in light and dark themes, during live resize, and at 200% zoom. The compact Funnel journey must keep Back and Continue reachable above bottom navigation without a theme-colored bottom slab. Source regressions are not a substitute for this browser review.

## Explicit deferral

R1 deliberately does **not** add a compact Board header, Brand-context header, account/library header, Board or Brand name in a new topbar, Google account component extraction, new header markup or mode projections, Brand Profile or Campaign Brand Snapshot terminology, or a Compare Brand Core redesign. Those items remain deferred until a separately scoped compact-header phase after this visibility boundary is accepted.
