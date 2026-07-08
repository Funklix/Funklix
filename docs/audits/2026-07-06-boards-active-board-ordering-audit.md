# Boards Active Board Ordering Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | UX Unification Sprint 1 — Boards PR 5 audit and implementation record |
| Scope | Boards Library presentation ordering only |
| Runtime behavior changes | Presentation-only active board pinning |
| Files changed | `app.js`, `docs/audits/2026-07-06-boards-active-board-ordering-audit.md` |

## Documents Read

- `docs/audits/2026-07-06-ui-design-system-migration-audit.md`
- `docs/audits/2026-07-06-boards-design-migration-audit.md`
- `docs/audits/2026-07-06-boards-final-polish-audit.md`
- `docs/audits/2026-07-06-boards-avatar-ordering-drag-audit.md`

## Summary

This PR implements presentation-layer ordering only: when a current board exists and appears in `state.boardsLibrary`, that board is displayed first in the Boards Library. All remaining boards keep the exact order returned by the existing API.

No persisted order is rewritten. No `order_index` values are changed. No API sorting is changed. No drag-and-drop is added. Move Up / Move Down, Open, Copy Link, Rename, Delete, Claim, avatar display, Brand display, create board, empty state, and responsive layout are preserved.

---

## Findings

### Existing rendering flow

`loadBoardsLibrary()` loads `GET /api/boards`, assigns `data.boards` to `state.boardsLibrary`, and calls `renderBoardsLibrary()`.

Before this PR, `renderBoardsLibrary()` rendered `state.boardsLibrary` directly in API order.

### Existing current board sources

The current board can be detected through the same existing runtime sources used elsewhere:

- `state.currentBoardId`
- `getBoardIdFromPath()`

The helper uses those values only to decide visual placement.

### Existing reorder controls

Move Up / Move Down rely on:

- `data-up-board`
- `data-down-board`
- `data-index`
- `moveBoard(boardId, direction, index)`

Because `moveBoard()` indexes into `state.boardsLibrary`, the rendered `data-index` must continue to refer to the source index in `state.boardsLibrary`, not the visual index after pinning.

---

## Current Ordering Behavior

Server/API order remains unchanged:

1. owner boards first
2. editor boards next
3. unowned/open boards last
4. `order_index ASC NULLS LAST`
5. `updated_at DESC`

The client still receives and stores that array as `state.boardsLibrary`.

If no current board exists, or if the current board is not present in the list, rendering preserves the current order completely.

---

## Presentation Ordering Approach

Added `getDisplayedBoards()` in `app.js`.

The helper:

- copies `state.boardsLibrary` into a new array
- detects the current board ID from `state.currentBoardId || getBoardIdFromPath()`
- finds the matching board in the copied array
- if the matching board is already first, returns the copied array unchanged
- if the matching board is later in the list, moves only that board to the front
- returns the display array

The helper does not:

- mutate `state.boardsLibrary`
- write `order_index`
- call APIs
- trigger save operations
- sort by `updated_at`
- sort alphabetically
- sort by Brand
- change ownership or permissions

---

## Why Persistence Is Untouched

This PR changes only the array used for rendering.

The source list remains `state.boardsLibrary`, exactly as returned by `GET /api/boards`. The helper works on a shallow copy. It does not call `fetch()`, does not PATCH boards, does not save, and does not update database fields.

No database values are changed.

---

## Why Manual Ordering Is Preserved

Manual ordering remains preserved because:

- the API order is still stored unchanged in `state.boardsLibrary`
- remaining boards after the pinned current board retain their existing relative order
- `data-index` for Move Up / Move Down is still computed from `state.boardsLibrary.indexOf(board)`, so reorder actions continue to target the persisted source order rather than the visual index
- `moveBoard()` remains unchanged

The current board pin is visual only. It does not redefine manual order.

---

## Runtime Confirmation

This PR does not modify:

- Board APIs
- Board persistence
- `order_index` values
- Move Up / Move Down behavior
- drag-and-drop behavior
- save/load
- autosave
- routing
- Canvas
- Dashboard
- Brand Core
- AI Brain
- Insights
- Board ownership
- Board permissions
- Board creation
- Board deletion
- Board duplication
- Copy Link behavior
- Rename behavior
- Delete behavior
- Claim behavior
- Brand display logic
- Avatar display logic
- Empty state behavior
- responsive layout

---

## Risks

### Visual order differs from persisted order

The current board may render first even if it is not first in persisted order. This is intentional and presentation-only. Because no new chip or label was added in this PR, reviewers should verify the behavior feels clear enough without extra UI.

### Move Up / Move Down mental model

When the current board is pinned first, Move Up / Move Down still acts on the underlying `state.boardsLibrary` source order. This preserves behavior but may feel surprising if users expect movement relative to the pinned visual position. This is a known tradeoff of preserving manual ordering while pinning the active board.

### Missing current board

If the active board is not present in the list response because of permissions/session state, no pinning occurs and the API order is preserved.

---

## Rollback

Rollback is simple:

1. Remove `getDisplayedBoards()` from `app.js`.
2. Change `renderBoardsLibrary()` back to iterating `state.boardsLibrary` directly.
3. Use the loop index as `data-index` again.
4. Remove this audit file.

No persisted state or API behavior depends on this helper.

---

## Manual QA

- Open Boards / My Boards with an active/current board that is not first in the API-returned order.
- Confirm the current board appears first.
- Confirm all remaining boards retain their previous relative order.
- Open Boards / My Boards with no active/current board.
- Confirm the order is unchanged.
- Confirm Open still works.
- Confirm Copy Link still works.
- Confirm Rename still works.
- Confirm Delete still works.
- Confirm Move Up still works.
- Confirm Move Down still works.
- Confirm Claim still works when available.
- Confirm Brand Avatar / Brand name display still works.
- Confirm empty state still works.
- Confirm Dashboard is unaffected.
- Confirm Canvas is unaffected.
- Confirm autosave/save/load are unaffected.

## Decision

Proceed with active-board visual pinning only. Defer drag-and-drop, recency sorting, alphabetic sorting, Brand sorting, API ordering changes, and persistent ordering changes to separate audited PRs.
