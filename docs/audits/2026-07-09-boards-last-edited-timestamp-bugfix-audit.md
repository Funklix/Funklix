# Boards Last Edited Timestamp Bugfix Audit

| Field | Value |
|---|---|
| Date | 2026-07-09 |
| Type | Boards bugfix audit |
| Scope | Preserve real Board `Last edited` timestamps after drag/drop and ordering polish |
| Runtime behavior changes | Order-only PATCH requests no longer update `updated_at` |
| Files changed | `api/boards/[id].js`, `app.js`, `docs/audits/2026-07-09-boards-last-edited-timestamp-bugfix-audit.md` |

## Root Cause

The Boards UX Completion PR introduced drag/drop persistence by PATCHing every board in the rendered DOM order with a new `order_index` after drop.

The existing `PATCH /api/boards/:id` route treated all non-claim patches the same way and always executed `updated_at = NOW()` when either `name` or `order_index` was patched. That meant an order-only drag/drop operation refreshed `updated_at` for every patched board even though the board content was not edited.

The card renderer then correctly displayed `board.updated_at`, but the persisted value had already been changed by the order-only PATCH requests, so many boards appeared as edited today.

## Affected Code

- `persistBoardOrderFromDom()` in `app.js` sends order-only PATCH requests with `{ order_index }` after drag/drop.
- `moveBoard()` in `app.js` also sends order-only PATCH requests for the existing Move Up / Move Down fallback.
- `PATCH /api/boards/:id` in `api/boards/[id].js` previously updated `updated_at` for order-only PATCH requests.
- `renderBoardsLibrary()` in `app.js` displays the board timestamp in the `Last edited` row.

## Fixed Behavior

Order-only PATCH requests now update only `order_index` and return the existing `updated_at` value unchanged.

Rename PATCH requests still update `updated_at` because changing the board name is a user-visible board edit.

Claim PATCH requests retain the existing ownership/status timestamp behavior and were not changed by this bugfix.

## Timestamp Source of Truth

The Boards card `Last edited` value now uses only persisted board timestamps from the list payload:

1. `board.updated_at`
2. `board.updatedAt`

If neither value is present or the value cannot be parsed as a valid date, the UI displays `Not available yet` instead of using the current date.

The UI does not use `Date.now()`, `new Date()` without a persisted timestamp, last opened time, active board state, drag/drop state, or presentation ordering as a fallback for `Last edited`.

## Mutation Prevention

- Drag/drop still reorders DOM nodes for preview only.
- `getDisplayedBoards()` still returns a presentation array without rewriting board objects.
- `persistBoardOrderFromDom()` still maps DOM IDs back to existing board objects but does not mutate their timestamp fields.
- The API no longer mutates `updated_at` for order-only PATCH requests.

## Runtime Confirmation

This bugfix does not change:

- Board creation
- Board deletion
- Board rename semantics, except preserving timestamp correctness for order-only patches
- Copy Link
- Ownership permissions
- Board access rules
- Board list API response shape
- Active-board pinning
- Drag/drop UX
- Move Up / Move Down fallback
- Board avatar or Brand display
- Dashboard
- Canvas
- Brand Core
- AI Brain
- Insights
- Routing
- Autosave
- Save/load

## Risks

### Existing records already touched by order-only PATCH

Boards that already had `updated_at` overwritten by a previous drag/drop cannot be automatically restored by this bugfix unless historical timestamps exist elsewhere. The fix prevents future order-only operations from changing `updated_at`.

### Mixed PATCH requests

If a future client sends both `name` and `order_index` in the same PATCH request, the route treats it as a rename/edit and updates `updated_at`. Current reorder code sends only `order_index`.

### Permission coupling

The existing route uses `canRename` for non-claim PATCH authorization. This bugfix preserves that behavior and does not introduce a new permission model for ordering.

## Rollback

Rollback steps:

1. Revert the `PATCH /api/boards/:id` branch split for name vs. order-only updates.
2. Revert `getBoardLastEdited()` in `app.js` and restore the previous inline timestamp formatting.
3. Remove this audit document.

Rollback would reintroduce the original bug where order-only patches can refresh `updated_at`.

## Manual QA

- Open Boards / My Boards.
- Confirm older boards show their real older `Last edited` timestamp.
- Confirm boards do not all show today.
- Open a board and return to Boards.
- Confirm only truly updated boards change timestamps.
- Drag/drop boards.
- Confirm drag/drop does not change `Last edited`.
- Use Move Up / Move Down.
- Confirm Move Up / Move Down do not change `Last edited`.
- Confirm Open, Copy Link, Rename, and Delete still work.
- Confirm Canvas is unaffected.
- Confirm Dashboard is unaffected.

## Decision

Proceed with the API bugfix because the audit proves the timestamp bug is caused by order-only PATCH requests mutating `updated_at`. Keep the client strict about timestamp display so missing data never falls back to today's date.
