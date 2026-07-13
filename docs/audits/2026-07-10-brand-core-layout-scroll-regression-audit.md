# Brand Core Layout & Scroll Regression Audit

| Field | Value |
|---|---|
| Date | 2026-07-10 |
| Type | Focused Brand Core shell regression bugfix audit |
| Scope | Restore Brand Workspace vertical scrolling and right-side editor width only |
| Runtime behavior changes | None; scoped CSS layout fix only |
| Files changed | `styles.css`, `docs/audits/2026-07-10-brand-core-layout-scroll-regression-audit.md` |

## Summary

The Brand Core Shell & Information Hierarchy PR preserved the new Brand Workspace hero and grouped sections, but it accidentally kept the old Brand Core scroll constraints after inserting a new `.brand-workspace-body` wrapper. The result was a page-level content stack that could extend below the viewport while the outer Brand Core workspace still had `overflow: hidden`.

This bugfix restores Brand Core to a natural page-scroll layout and gives the editor a stable minimum width. It does not change Brand Core data, persistence, prompts, generation, APIs, event handlers, IDs, Dashboard, Boards, Canvas, AI Brain, routing, autosave, save/load, ownership, or permissions.

## Regression Symptoms

- The right-side Brand Core editor collapsed into an unusably narrow strip at common desktop widths.
- The Brand Workspace content extended below the viewport.
- Lower sections such as Deployment and Custom Knowledge could become unreachable because the outer Brand Core surface clipped overflow.
- The new Brand Workspace hero, readiness surface, and grouped cards still rendered, proving the regression was layout/CSS-related rather than a rendering or JavaScript event issue.

## Exact Root Cause

Before the shell migration, Brand Core used a two-column grid directly on `.brand-core-workspace`:

- left: `.brand-core-canvas`
- right: `.brand-core-side`

The previous layout also set `.brand-core-workspace` to `height: 100%` and `overflow: hidden`, while `.brand-core-canvas` and `.brand-core-side` owned their own vertical scrolling.

The shell migration inserted a new structure:

- `.brand-core-workspace`
  - `.brand-workspace-hero`
  - `.brand-workspace-body`
    - `#brand-core-canvas`
    - `.brand-core-side`

The new wrapper changed the layout from direct workspace columns into a nested grid, but the old outer `overflow: hidden` remained active. The later shell styles also made `#brand-core-canvas` transparent and removed its old panel framing, but did not explicitly transfer scroll ownership to the new outer Brand Workspace surface.

The editor width issue came from `.brand-workspace-body` using `grid-template-columns: minmax(0, 1fr) 360px` only at the full viewport breakpoint. Because the app shell still reserves sidebar/inspector grid space, the usable Brand Core content column can be much narrower than the viewport. At those intermediate widths, the content/editor grid tried to remain two columns and could visually crush the editor/content relationship instead of stacking.

## Previous Scroll Ownership

Before the shell migration:

- `.brand-core-workspace` clipped overflow.
- `.brand-core-canvas` had `overflow-y: auto`.
- `.brand-core-side` had `overflow-y: auto`.
- Scrolling effectively belonged to the two direct Brand Core columns.

## Current Broken Scroll Ownership

After the shell migration:

- `.brand-core-workspace` still clipped overflow.
- `.brand-workspace-body` became the new layout wrapper but did not own scrolling.
- `#brand-core-canvas` was no longer the complete visual page because the hero and grouped shell lived outside its old scroll expectations.
- Lower grouped sections could extend beyond the clipped workspace.

## Editor Width Conflict

Responsible selectors:

- Legacy `.brand-core-workspace { height: 100%; overflow: hidden; }`
- New `.brand-core-workspace.fk-section { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }`
- New `.brand-workspace-body { grid-template-columns: minmax(0, 1fr) 360px; min-height: 0; }`
- Legacy `.brand-core-side { min-width: 0; justify-self: stretch; }`

Together, these rules kept clipping on the outer workspace and did not give the editor a protected minimum width in the new nested grid.

## Minimal Fix

The fix is scoped to Brand Core CSS only:

- Make `.brand-core-workspace.fk-section` the scroll owner with `overflow-y: auto` and `overflow-x: hidden`.
- Keep the Brand Workspace content in normal document flow with `height: auto` and `align-content: start`.
- Let `#brand-core-canvas` expand naturally with `overflow: visible` so the outer Brand Workspace owns vertical scrolling.
- Give `.brand-core-side` a stable `min-width: 320px` on desktop.
- Stack `.brand-workspace-body` at intermediate/narrow widths where the app shell leaves insufficient content width for a stable two-column layout.

No markup, JavaScript, state, API, prompt, save/load, or event-handler changes are required.

## Preserved IDs and Handlers

Preserved IDs:

- `#brand-core-workspace`
- `#brand-workspace-avatar`
- `#brand-workspace-name`
- `#brand-workspace-readiness-label`
- `#brand-workspace-readiness-detail`
- `#reset-brand-core-btn`
- `#brand-core-canvas`
- `#bc-editor-title`
- `#bc-editor-panel`
- `#brand-dna-card`

Preserved handlers and behavior-facing targets:

- `.bc-node[data-bc-key]` delegated selection
- `custom:*` tiles
- `custom:add`
- Brand Core editor input handlers
- Brand DNA generate/refine/accept handlers
- Brand Avatar generate/edit/accept handlers
- website analysis handler
- Reset Brand Core handler

## Runtime Confirmation

This PR does not change:

- Brand Core state
- Brand Brain persistence
- Brand DNA generation
- Brand Avatar generation
- website analysis
- custom tiles
- reset behavior
- save/load
- APIs
- prompts
- Dashboard
- Boards
- Canvas
- AI Brain
- Insights
- routing
- autosave
- existing IDs
- existing event handlers

## Risks

### Scroll owner change

Brand Workspace scrolling now belongs to the outer Brand Core surface instead of the inner canvas/editor columns. This is intentional because the new hero and grouped sections form a complete page-level surface.

### Intermediate-width stacking

The editor now stacks below the Brand content earlier, at intermediate widths. This avoids the unusable narrow-column state caused by the app shell reserving sidebar and inspector grid space.

### Long editor content

Long editor content contributes to the outer Brand Workspace scroll. This avoids nested competing scroll containers, but users may scroll the page rather than only the editor.

## Rollback

Rollback steps:

1. Remove the `Brand Core shell regression fix` CSS block from `styles.css`.
2. Remove this audit document.

Rollback would restore the regression where the outer workspace clips content and the editor can collapse at intermediate widths.

## Manual QA

1. Open Brand Core.
2. Confirm the Brand Workspace can scroll from the hero to the final section.
3. Confirm Foundation, Strategy, Intelligence, Deployment, and Custom Knowledge are reachable.
4. Select several existing Brand Core cards.
5. Confirm the right editor opens at a usable width.
6. Confirm editor inputs, selects, textareas, and buttons remain usable.
7. Confirm the editor does not collapse when content is long.
8. Confirm the layout remains stable when no card is selected.
9. Test a narrower viewport:
   - content remains readable
   - editor stacks rather than collapsing
   - scrolling remains available
10. Confirm Brand DNA still works.
11. Confirm Brand Avatar still works.
12. Confirm website analysis still works.
13. Confirm custom tiles still work.
14. Confirm Reset Brand Core still uses the existing behavior.
15. Confirm Dashboard, Boards, Canvas, and AI Brain are unaffected.
