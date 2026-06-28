# Dashboard Continue Working Empty-State Polish Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Continue Working empty-state polish audit |
| Scope | Visual/conditional presentation only for Dashboard Continue Working |
| Runtime behavior changes | None |
| Expected files | `index.html`, `styles.css`, `app.js`, `docs/audits/2026-06-28-dashboard-empty-state-polish-audit.md` |

## Audit Findings

### Current Dashboard state

The Mission Control layout is restored, and the runtime-backed Continue Working card has a single DOM render target. However, when no Board is active, the card still renders Board-specific metadata rows such as Ownership, Nodes, Last Updated, and Board Status.

### Problem

For the empty state, those rows make the Dashboard feel noisy and imply Board-specific information exists when it does not. The clean empty state should only show:

- `No board selected`
- `Select a board to continue your campaign work.`
- `Open Boards`
- optional note: `Dashboard reads current runtime state only.`

### Runtime logic review

The existing Dashboard renderer already derives an `opensCanvas` value from `getActiveContext()` and current canvas state. No Active Context changes are needed. The smallest safe change is to add a presentational `isEmpty` flag to the Continue Working render model and toggle a CSS class on the existing card.

### Markup review

The existing Continue Working IDs should be preserved so runtime-backed rendering remains intact for real Boards. No duplicate render targets were found.

### CSS review

The metadata area can be hidden with scoped `#dashboard-view` CSS when the card receives an empty-state class. CSS changes should remain under `#dashboard-view`.

### Hero copy review

The Daily Briefing headline should change from:

`Good morning. I have the brand ready.`

to:

`Good morning. I have your focus ready.`

## Smallest Safe Implementation

1. Change the static hero headline copy in `index.html`.
2. Add `isEmpty` to the Dashboard Continue Working render model based on the existing `isCurrentCanvas` calculation.
3. Toggle `is-empty` on `#dashboard-continue-working` during rendering.
4. Add scoped CSS to simplify the card when empty:
   - single-column layout,
   - hide the metadata rows,
   - keep the footer note and Open Boards button.

## Runtime Confirmation

This polish must not change:

- runtime model
- `getActiveContext()`
- routing
- save/load
- autosave
- Canvas
- Dashboard data ownership
- Inspector
- Sidebar
- Toolbar
- APIs

## Manual QA Checklist

1. Root Home with no Board shows clean Continue Working empty state.
2. Empty state shows only the title, one sentence, Open Boards button, and optional runtime-state note.
3. No duplicate Open Board actions appear.
4. Real Board state still shows runtime-backed metadata details.
5. Open Boards button still works.
6. Hero headline reads `Good morning. I have your focus ready.`
