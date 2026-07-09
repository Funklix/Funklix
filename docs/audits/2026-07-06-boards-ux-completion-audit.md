# Boards UX Completion Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | UX Unification Sprint 1 — Boards PR 6 audit and implementation record |
| Scope | Boards Library drag-and-drop UX completion only |
| Runtime behavior changes | Adds optional pointer drag reorder using existing PATCH `order_index` mechanism |
| Files changed | `app.js`, `styles.css`, `docs/audits/2026-07-06-boards-ux-completion-audit.md` |

## Documents Read

- `docs/audits/2026-07-06-ui-design-system-migration-audit.md`
- `docs/audits/2026-07-06-boards-design-migration-audit.md`
- `docs/audits/2026-07-06-boards-final-polish-audit.md`
- `docs/audits/2026-07-06-boards-avatar-ordering-drag-audit.md`
- `docs/audits/2026-07-06-boards-active-board-ordering-audit.md`

## Findings

The Boards Library already had polished cards, per-board Brand display data, active-board visual pinning, and existing Move Up / Move Down controls. The remaining UX gap was practical reordering: users needed repeated Move Up / Move Down clicks for larger moves.

Existing reorder behavior persists through the current PATCH `/api/boards/:id` route with `order_index`. This PR reuses that mechanism and does not introduce a new endpoint, data model, sorting model, or persistence concept.

The existing card DOM is suitable for drag-and-drop because each board is rendered as a discrete `.board-row` inside `#boards-library-list` with a stable board ID available from the rendered card.

## Implementation

Implemented optional drag-and-drop reordering on Boards cards:

- Added `data-board-id` and `draggable="true"` to each generated board row.
- Added a subtle `.board-row-drag-handle` visual affordance.
- Added DOM-order helpers:
  - `getBoardsDomOrder()`
  - `getBoardDragAfterElement()`
  - `persistBoardOrderFromDom()`
  - `bindBoardRowDragHandlers()`
  - `bindBoardsListDragHandlers()`
- Reorders cards visually during drag using DOM insertion.
- Persists order only after drag end when the DOM order changed.
- Persists through the existing per-board PATCH `order_index` mechanism.
- Reloads the Boards Library after persistence or rollback.

No APIs were added or changed.

## Drag Architecture

The drag architecture is intentionally small and scoped:

1. `renderBoardsLibrary()` renders each board card with `data-board-id`.
2. `bindBoardRowDragHandlers(row)` stores the initial DOM order on drag start.
3. `bindBoardsListDragHandlers()` handles `dragover` on the list container and moves the dragging row before/after nearby rows.
4. `persistBoardOrderFromDom(initialOrder)` compares final DOM order to the initial order.
5. If order changed, the helper PATCHes each board with its new `order_index` using the existing route.
6. The library reloads so the UI reconciles with server ordering and existing active-board pinning.

The drag start guard prevents drags from starting on interactive controls such as buttons and inputs.

## Accessibility

Move Up / Move Down remain visible and functional as the keyboard/accessibility fallback.

Keyboard users can continue to reorder boards with existing buttons. Drag-and-drop is additive for pointer users only.

Touch devices are not required to rely on drag-and-drop; all existing buttons remain available. This avoids making touch support worse while still improving pointer-based desktop reordering.

The drag handle is visual and marked `aria-hidden="true"` because the accessible reorder mechanism remains the Move Up / Move Down buttons.

## Preserved Runtime Behavior

This PR does not change:

- Board creation
- Board deletion
- Board rename
- Copy Link
- Ownership
- Permissions
- Routing
- Autosave
- Save/load
- Canvas
- Dashboard
- Brand Core
- AI Brain
- Workspace
- Board APIs
- Board data model
- active board pinning logic
- Brand Avatar / Brand name display
- empty state behavior

Move Up / Move Down remain available and still use their existing event handlers.

## Risks

### Active-board visual pinning

The active board may still be visually pinned after a drag reorder because active-board pinning is presentation-layer behavior from PR 5. This PR preserves that behavior rather than introducing a new ordering model.

### Cross-group ordering

The API still groups by owner/editor/open status before `order_index`. Dragging across groups may not persist exactly as visually previewed after reload. This preserves current ordering rules and avoids changing server sorting.

### Partial persistence failure

The implementation checks PATCH responses and reloads the Boards Library in `finally`. A failed request may leave server order partially updated if some PATCH calls succeed before one fails. A future batch reorder endpoint could improve atomicity, but that would be a separate API change and is intentionally out of scope.

### Native drag limitations

Native HTML5 drag-and-drop can vary on touch devices. The keyboard/button fallback remains available, so touch users are not blocked from reordering.

## Rollback

Rollback steps:

1. Remove the drag helper functions from `app.js`.
2. Remove `draggable`, `data-board-id`, drag binding, and drag-handle markup from generated board rows.
3. Remove the Boards drag-and-drop CSS section from `styles.css`.
4. Remove this audit file.

No persisted schema, API, routing, Canvas, Dashboard, Brand Core, AI Brain, save/load, or autosave behavior depends on this PR.

## Manual QA

- Open Boards / My Boards.
- Drag a board card to another position.
- Confirm the card reorders visually while dragging.
- Drop the card and confirm the order persists after reload.
- Confirm Move Up still works.
- Confirm Move Down still works.
- Confirm Open still works.
- Confirm Copy Link still works.
- Confirm Rename still works.
- Confirm Delete still works.
- Confirm Claim still works when available.
- Confirm Brand Avatar / Brand name still render.
- Confirm empty state still renders when no boards exist.
- Confirm Dashboard is unaffected.
- Confirm Canvas is unaffected.
- Confirm autosave/save/load are unaffected.

## Decision

Proceed with additive drag-and-drop as a pointer convenience while preserving Move Up / Move Down as the accessibility fallback. Do not add a new API, new ordering model, drag-only workflow, or changes outside the Boards Library.
