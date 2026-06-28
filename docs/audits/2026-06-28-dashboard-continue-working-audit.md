# Dashboard Continue Working Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Intelligence MVP PR 9 audit |
| Scope | Continue Working card reads current runtime information only |
| Runtime behavior changes | Dashboard display only; no persistence, routing, ownership, autosave, API, or Active Context changes |
| Files changed | `index.html`, `styles.css`, `app.js`, `docs/audits/2026-06-28-dashboard-continue-working-audit.md` |

## Documents Read

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-06-27-active-context-resolver-audit.md`
- `docs/audits/2026-06-27-active-context-consumers-audit.md`
- `docs/constitution/engineering-constitution.md`

## Missing Requested Documents

- `docs/product/dashboard-2.0-implementation-spec.md` is not present in the current working tree. This audit therefore uses the Dashboard 2.0 product spec, Runtime Alignment Readiness, Active Context Resolver audit, Active Context Consumers audit, and Engineering Constitution as the available guidance.

## Product Intent

The Continue Working card should answer the user's immediate question:

> What was I working on?

The Dashboard must not own data. It should read current runtime state and summarize it calmly. This PR only replaces the Continue Working placeholder with real, existing runtime values and fallbacks.

## Current Runtime Field Audit

| Question | Current runtime source | Available? | Implementation decision |
|---|---|---:|---|
| Where does current Board name come from? | `state.currentBoardName`, set by Board load/save/duplicate flows. | Yes, when loaded/saved Board data includes a name. | Display real name when present; fallback to `Untitled board` for board-backed work or `No board selected` when no Board exists. |
| Where does Board updated timestamp come from? | `state.lastKnownUpdatedAt`, with `state.canvasMetadata.updatedAt` as local metadata fallback. | Sometimes. | Display formatted timestamp only when parseable; otherwise `Not available yet`. |
| Where can node count be read? | `state.nodes.length`. | Yes. | Display exact current node count. |
| Does Board status already exist? | No canonical campaign/Board status exists. `state.boardAccess` only describes access/permission state. | Partially. | Display access-backed status such as `Owned board`, `Editable board`, `View-only board`, `Claim available`, or fallback `Board-backed`/`Not available yet`; do not invent campaign status. |
| Does progress already exist? | No canonical Board progress field exists. Node statuses exist but are not campaign progress. | No. | Keep Progress row hidden unless a real progress field exists in a future PR. |
| Does open-board navigation already exist? | Existing Dashboard CTA delegation, `el.campaignCanvasNavButton?.click()`, and `el.boardsNavButton?.click()`. | Yes. | Reuse existing navigation buttons; do not create routes. |
| Does Active Context exist? | `getActiveContext()`. | Yes. | Read only; do not mutate or change resolver behavior. |

## Implementation Boundary

Allowed in this PR:

- Dashboard markup for the Continue Working card.
- Scoped Dashboard CSS for the card.
- Read-only Dashboard JavaScript that builds and renders the card from existing runtime state.
- Reusing existing navigation buttons for the card's action.

Not allowed and not performed:

- No new APIs.
- No Board model changes.
- No save/load changes.
- No autosave changes.
- No Active Context changes.
- No Board ownership changes.
- No Campaign Canvas rendering changes.
- No Brand runtime changes.
- No AI Brain changes.

## Fallback Behavior

| Missing value | Fallback |
|---|---|
| No active Board ID | `No board selected` title, `No active board` ownership, `Open Boards` button. |
| Board ID exists but no Board name | `Untitled board`. |
| No updated timestamp | `Not available yet`. |
| No canonical Board status | Permission-backed status where available; otherwise `Not available yet` or `Board-backed`. |
| No canonical progress | Progress row remains hidden. |
| No current Canvas work | Next suggested action is `Select a board to continue your campaign work.` |

## Runtime Fields Used

The implementation reads:

- `getActiveContext()`
- `state.currentBoardName`
- `state.nodes.length`
- `state.lastKnownUpdatedAt`
- `state.canvasMetadata.updatedAt`
- `state.boardAccess.reason`
- `state.boardAccess.canEdit`

These reads are display-only. None of these fields become Dashboard-owned.

## Open Board Button Behavior

The Continue Working button reuses existing navigation:

- If a Board-backed or currently loaded Canvas exists, it clicks the existing Campaign Canvas navigation button.
- If no Board/Canvas exists, it clicks the existing Boards navigation button.

The PR does not create URLs, push history, call APIs, save data, or create Boards.

## Architecture Compliance

This change complies with the Dashboard architecture because:

- Dashboard reads current runtime state only.
- Dashboard owns no canonical knowledge.
- Dashboard does not persist Board, Brand, Canvas, Node, or task data.
- Dashboard does not infer Brand ownership.
- Dashboard does not alter Active Context.
- Dashboard does not create analytics, AI suggestions, or fake progress.

## Blast Radius

Low.

Changed areas:

- Dashboard Continue Working markup.
- Dashboard Continue Working scoped styles.
- Dashboard display-only renderer and action delegation.
- Audit documentation.

Unaffected areas:

- save/load
- autosave
- APIs
- routing
- Board ownership
- Active Context resolver
- Campaign Canvas rendering
- Campaign Generator
- Campaign V3
- Brand Core
- AI Brain
- Insights
- authentication

## Risks

| Risk | Mitigation |
|---|---|
| Accidentally presenting fake status/progress. | Use fallbacks and hide progress when unavailable. |
| Dashboard becoming an owner of Board state. | Read existing runtime state only; no writes except DOM text rendering. |
| Open Board button changing routing. | Reuse existing nav button clicks instead of creating routes. |
| Active Context becoming behavior authority too early. | Use `getActiveContext()` only for Dashboard display model and button target selection. |
| Timestamp parsing inconsistency. | Show `Not available yet` when missing or invalid. |

## Manual QA Checklist

1. Root Home
   - Continue Working shows `No board selected` when no Board-backed Canvas is loaded.
   - Node count reflects current runtime state.
   - Button opens Boards when no current Canvas exists.

2. Real Board
   - Load `/boards/:id`, return Home, and confirm Board name, Board-backed status, node count, timestamp when available, and Board status appear.
   - Open Board button returns to Campaign Canvas.

3. Board with no timestamp
   - Last Updated shows `Not available yet`.

4. Board with no progress
   - Progress row remains hidden.

5. Open Board button
   - Uses existing Campaign Canvas or Boards navigation.
   - Does not create routes or Boards.

## Runtime Confirmation

Dashboard reads only.

This PR does not change:

- Board ownership
- Active Context
- startup
- routing
- save/load
- autosave
- APIs
- Campaign Canvas rendering
- Campaign Generator
- Campaign V3
- Brand runtime
- AI Brain
- Insights
- authentication

## Decision

Proceed with the smallest Dashboard Intelligence MVP: replace only the Continue Working placeholder with real runtime information and safe fallbacks.
