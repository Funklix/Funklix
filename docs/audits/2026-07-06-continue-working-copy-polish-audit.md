# Continue Working Copy Polish Audit

Date: 2026-07-06

## Scope

Audited and updated the Dashboard Continue Working card copy only. This change uses existing runtime data and does not add data sources, APIs, save/load changes, autosave changes, routing changes, Canvas changes, ownership changes, `getActiveContext()` changes, Brand runtime behavior, or node data changes.

## Existing runtime data inspected

The Continue Working model already reads:

- `getActiveContext()` for board-backed versus local/empty state.
- `state.currentBoardName` and the active board id for the title fallback.
- `state.nodes.length` for node count.
- `state.lastKnownUpdatedAt` / `state.canvasMetadata.updatedAt` for last-updated display.
- `state.boardAccess` through `getDashboardBoardStatus()` for board status.

The renderer already keeps the visible title, ownership, node count, last updated, board status, optional progress row, context label, and Open Board/Open Boards CTA.

## Current copy issue

For board-backed work, the card used the generic action line `Continue editing this Campaign Canvas.` and exposed a visible `Active Board ID: …` context label. Both values were technically correct, but the board id made the Dashboard feel implementation-focused instead of user-oriented.

## Change made

For board-backed contexts only:

- Action copy now reads `Pick up this campaign where you left off.`
- Context copy now reads `Board-backed workspace` instead of showing the board id.

The empty state remains unchanged:

- `No board selected`
- `Select a board to continue your campaign work.`
- `Open Boards`

## Read-only guarantee

This is presentation-only copy. It does not modify runtime state, node data, board data, Brand data, routing, persistence, or ownership behavior.
