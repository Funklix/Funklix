# BW-36.16 — Adaptive Canvas view hierarchy

## Verified ownership before editing

Baseline: fetched origin/main, `22e12a4` (BW-36.15R1).

| Concern | Prior production owner / behavior |
| --- | --- |
| Global Compact/Standard/Detailed | `canvas-density.js` validates the global mode, reads/writes `tendra.canvasDensity.v1`; `applyCanvasDensityPresentation` marks only `#canvas`, schedules `drawLinks`; styles.css hides/clamps existing card sections. Activation is deferred by `schedulePostHydrationCanvasDensity`, outside the loader's access-error boundary. |
| Utilities | `buildUtilitiesPopoverHtml` owns Display density radio controls and Compact All/Expand All beside genuine Board/view/layout operations. |
| Primary/multiple selection | `state.selectedPrimary` / `state.selectedIds`; `selectCanvasNode`, `updateSelectionClasses`, Inspector and existing presence notifications. |
| Hover/focus | Existing CSS hover and article `tabindex=0`; no automatic Standard presentation. Editable title/content own focus/input listeners; collaborators own presence separately. |
| Drag | `enableNodeDrag`: pointerdown selects, pointermove changes selected nodes' coordinates, pointerup records movement and saves (previously even a stationary click saved). |
| Double-click | `renderNode` sets `node.compact=false`, updates card and saves; denied to readers. No separate edit modal or content load. |
| Per-node expansion | `.node-compact-toggle` changes persisted `node.compact`; expansion can invoke overlap resolution, move other nodes and save. `.node-expand-content` unclamps existing content locally. |
| Blank area | Canvas pointerdown/pointermove/pointerup owns panning, marquee and blank clearing. It previously excluded nodes/controls but not edge paths. |
| Escape | Existing inner dialogs, emoji picker, connections, image lightbox, overlay Inspector and collaborator follow controls own separate listeners; there was no density hierarchy. |
| Board/view lifecycle | `loadBoardFromUrlIfPresent` owns generation/access/hydration; `setActiveView` and `toggleListMode` own Canvas visibility. |
| Geometry/layout | `updateNodeCard` places cards at `node.position`; `nodeBottomCenter` measures actual DOM dimensions; `drawLinks` builds paths. Overlap resolution/Auto Arrange intentionally persist layout. |
| Toolbar | Existing `.canvas-toolbar` and responsive shell CSS own all groups; BW-36.15 creates Responsibilities immediately after Add node and allows wrapping in the existing left group. |

## Final state machine

`adaptive-canvas-view.js` contains an explicit session-only state machine: selected identity, Detailed flag, forced Compact flag, pointer preview, focus preview, pause flag and a temporary frozen presentation map. It has no data/storage/network dependencies. The app derives cards' `data-adaptive-view` from that model; it does not copy or duplicate the Canvas or node components.

- Board open, switch, leaving/returning Canvas, and list transitions reset to Auto, no selection, all Compact. Retired persisted density is ignored, not rewritten.
- Pointer enter and keyboard focus preview one Compact card as Standard; leaving/blur retracts it unless selected. Touch pointer events do not create hover previews.
- Single click/Space selects the existing primary identity and keeps Standard after leave. Selection changes discard stale hover/focus so the previous card returns immediately to Compact. Interactive editable descendants and buttons retain their actions and do not bubble into selection.
- Double-click selects Detailed without writing `node.compact` or saving. Every card has a localized Show details action; Enter on an already selected article opens Detailed. The former double-click expansion is preserved by Show details; inline editing and the existing Inspector remain available.
- On mobile, selection still opens the established editing Inspector. Its localized Show details action closes that covering overlay and reveals Detailed on the Canvas. This avoids hiding the only accessible Details path behind the Inspector.
- Genuine blank Canvas clicks/taps clear identity and previews; edges, controls, comments, menus and connection placement are excluded.
- Escape on the Canvas/toolbar takes Detailed → Standard → no selection/Compact. Dialogs, menus, popovers, emoji editors, type picker, lightbox, inline editors and connection creation get priority. Consumed hierarchy Escape stops propagation so unrelated surfaces do not close.
- Drag, pan/marquee, multi-selection, connection placement and inline editing freeze current presentations; expansion resumes from current state after interaction. A moved drag suppresses the resulting synthetic click and cannot select-expand a newly dragged card. Deliberate drag/connection content changes retain the established persistence behavior. A stationary selection no longer performs the previous unnecessary drag save.
- Deleted cards release resize observation; invalid primary/preview references are pruned.

## Compact View and Utilities

Exactly one visible Compact view switch is inserted immediately after Responsibilities, in its existing toolbar group. OFF is Auto. ON forces all cards Compact, including hover/focus/selection. It exposes `aria-pressed`, localized names and state-dependent tooltips, existing rounded design tokens and purple active styling; it has a 44px target and becomes icon-only below 1100px, retaining name/tooltip. Existing wrapping and toolbar ownership remain in charge; there is no extra toolbar or horizontal scrolling.

Turning it off restores a valid selected card to Standard, or its explicitly retained Detailed state. Double-click/Show details exits forced Compact immediately and selects Detailed. Compact is never stored in the database or browser storage.

Utilities no longer renders the redundant density radios or Compact All/Expand All. Fit to Board, Auto Arrange, Board actions and view actions remain. Hidden legacy DOM hooks remain for boot compatibility and delegate to the same session-only state rather than mutating campaign data. The isolated legacy density module/API remains compatible for the existing historical failure-safety checks; the production adaptive control never invokes its preference writer. BW-23's obsolete Compact All/Expand All expectation and BW-33.3R1's radio-menu literal assertion now verify toolbar/Utilities exclusivity; BW-27.4/BW-27.5's obsolete persisted-toggle literals now verify render-only Details and prohibit compact-data mutation; its hydration ordering, unsafe fixture, exception isolation, persistence and renderer-boundary checks remain unchanged.

## Geometry, performance and accessibility

The existing Compact/Standard/Detailed content sections are hidden, clamped or revealed per card using established styles. Expanded cards are elevated at their stable top-left anchors; dimensions never feed back into `node.position`. A shared ResizeObserver and one batched animation-frame callback redraw measured edge endpoints. The historical styles.css and static Inspector/toolbar DOM remain byte-for-byte unchanged; scoped overrides live in adaptive-canvas-view.css and the supplemental Inspector Details action is installed by the existing UI initialization. No Auto Arrange or overlap resolution is invoked by adaptive presentation. Only cards whose derived view changes receive a new presentation marker; no Board render or content update is performed.

Focus is visible; details are reachable by keyboard/touch; there is no hover-only information or keyboard trap. Existing token colors, forced-colors outlines/active treatment and reduced-motion behavior apply. The new cards have no dimension transition and use `touch-action: manipulation` to avoid competing double-tap zoom behavior. Toolbar names/tooltips and details names update when the UI language changes.

The model and presentation synchronization perform zero provider/AI calls, Board saves, database writes, coordinate persistence, Workspace/Brand mutations or node-content changes. Existing intentional presence, editing, drag, connection and responsibility behavior remains separately owned.

## Validation and delivery

Focused production Chromium fixture opens two authorized Boards through the real loader/render/selection/interaction lifecycle. It covers the required hierarchy sequence, Detailed Escape step, legacy preference isolation, session teardown, Details/keyboard/inner modal priority, Utilities exclusivity, editable child isolation, exact content/storage boundaries, geometry, drag/click suppression, connections and deletion. Layout matrix: 1920/1440/1280/1024/768/640/600/480/375/360/320, EN/DE and light/dark (44 cases), 640×450 at 200%-equivalent reflow, forced colors/reduced motion and mobile touch. Historical BW-36.15R1, BW-36.15, BW-36.14R1, responsive shell/Canvas and BW-33.3R1 remain protected.

The full declared Runtime Boot Safety syntax/check sequence is run locally with the installed npm dependencies and provisioned system Chromium as equivalent browser setup. Final result: **180/180 declared verification commands passed**, including BW-36.16, BW-36.15R1, BW-36.15, BW-36.14R1 and existing responsive Canvas/shell checks. Browser-script integrity (39 classic scripts), syntax for every changed JavaScript file and staged/unstaged git diff --check passed. Zero desktop/touch console errors in the focused Chromium check. No deployed-production or manual visual acceptance is claimed.

## Deployment, rollback and manual acceptance

Deploy the complete application bundle after review/merge and successful Runtime Boot Safety. No migration, manual SQL, backfill, environment variable, preference table or data conversion is needed. Existing campaign data, compact flags and positions remain unchanged by this feature. Roll back by reverting the single BW-36.16 implementation commit and redeploying the full bundle; no data rollback is required.

Manual acceptance: open an authorized existing Board; verify initial Compact, hover/focus preview, selected Standard, Details/double-click, two-stage Escape and blank clearing. Toggle Compact next to Responsibilities and verify retained identity/restoration and explicit Details exit. Repeat with a reader, on touch through the Inspector Details action, using only keyboard, in both languages/themes and at narrow/reflow sizes. Verify drag, connection, editing, comments, Responsibilities, Board switching and untouched saved coordinates/content.
