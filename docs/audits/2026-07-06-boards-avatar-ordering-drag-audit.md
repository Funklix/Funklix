# Boards Avatar, Ordering, and Drag-Reorder Feasibility Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | UX Unification Sprint 1 — Boards PR 3 audit / planning |
| Scope | Boards Library data, ordering, and drag-reorder feasibility only |
| Runtime changes | None |
| Files changed | `docs/audits/2026-07-06-boards-avatar-ordering-drag-audit.md` |

## Documents Read

- `docs/audits/2026-07-06-ui-design-system-migration-audit.md`
- `docs/audits/2026-07-06-boards-design-migration-audit.md`
- `docs/audits/2026-07-06-boards-final-polish-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/constitution/engineering-constitution.md`

## Summary

This is an audit-only PR. No runtime behavior, UI, sorting, APIs, drag-and-drop, persistence, ownership, permissions, routing, Canvas, Dashboard, Brand Core, AI Brain, Insights, save/load, or autosave behavior was changed.

The key finding is that the Boards Library currently receives a lightweight list payload from `GET /api/boards` that does **not** include `brand_core_snapshot`, Brand Avatar fields, or Brand name fields. As a result, only the currently loaded board can reliably show a Brand Avatar or Brand name from `state.brandCore`; other boards only have list metadata and must fall back to initials unless the API is extended in a future PR.

Ordering today is server-driven by access group, `order_index ASC NULLS LAST`, then `updated_at DESC`. The existing Move Up / Move Down controls persist manual order by PATCHing `order_index`, but that manual order is mixed with role grouping and timestamp fallback. Any future last-edited sorting or active-board pinning must be designed around this existing contract to avoid breaking users' manual ordering expectations.

Recommended next implementation: **extend the Boards list API payload with a safe, minimal display snapshot** for Brand Avatar and Brand name, without changing ordering yet. Ordering and drag-and-drop should be separate later PRs.

---

## Current Board List Data Findings

### Client loading path

`loadBoardsLibrary()` fetches `GET /api/boards`, expects a JSON object with `boards`, assigns it to `state.boardsLibrary`, and calls `renderBoardsLibrary()`.

The client does not currently transform or enrich the board list with additional API calls per board.

### Current list API query

`api/boards/index.js` currently selects these list fields:

- `id`
- `name`
- `updated_at`
- `order_index`
- `owner_id`
- `owner_email`
- `owner_name`
- `owner_avatar`
- `created_by`
- `created_at`
- computed `access_role`

The list query does **not** select:

- `canvas_json`
- `brand_core_snapshot`
- Brand Avatar URL
- Brand Avatar initial/icon
- Brand name
- last opened timestamp
- camelCase `updatedAt`
- camelCase `orderIndex`

### Board detail API contrast

`api/boards/[id].js` uses `BOARD_COLUMNS` including:

- `id`
- `name`
- `canvas_json`
- `brand_core_snapshot`
- `created_at`
- `updated_at`
- `order_index`
- owner fields

This means board detail loads can hydrate Brand Core / Brand Brain from `brand_core_snapshot`, but the list route intentionally does not currently provide that snapshot.

### Generated board card usage

`renderBoardsLibrary()` currently reads these per-board fields:

- `board.id`
- `board.updated_at`
- `board.name`
- `board.owner_email`
- `board.owner_name`
- `board.access_role`
- `board.brand_core_snapshot` / compatible snapshot fields if present

The last item is defensive/future-compatible client code, not evidence that the current list API returns snapshots.

---

## Current Data Model

### Available today in Boards Library payload

| Field | Available in `GET /api/boards` list? | Notes |
|---|---:|---|
| `id` | Yes | Used by open/copy/rename/delete/reorder/claim actions. |
| `name` / title | Yes | Used as board title. |
| `updated_at` | Yes | Used as current “Last edited” display. |
| `created_at` | Yes | Available but not currently used in the card. |
| `order_index` | Yes | Used by API ordering and PATCH reorder behavior. |
| `owner_email` | Yes | Used to derive ownership/access UI. |
| `owner_name` | Yes | Used to derive owner/access description. |
| `owner_avatar` | Yes | Owner avatar, not Brand Avatar. Should not be reused as Brand Avatar. |
| `access_role` | Yes | Computed by list query. Used to derive role chips. |
| `brand_core_snapshot` | No | Available on board detail/PUT response, but not the list route. |
| Brand Avatar fields | No | Not selected by list route. |
| Brand name fields | No | Not selected by list route. |
| `lastOpened` / `last_opened_at` | No | No current list field found. |
| camelCase `updatedAt` / `orderIndex` | No | Client currently consumes snake_case fields from the API. |

### Existing Brand Avatar/Brand name client lookup

The current Boards card helper reads:

1. `state.brandCore` when the board ID matches `state.currentBoardId` or the route board ID.
2. `board.brand_core_snapshot`, `board.brandCoreSnapshot`, or `board.brandCore` if already present on the board object.

Because the list API does not return `brand_core_snapshot`, the second path is usually unavailable for list cards today.

---

## Why Avatar Only Works For Current Board

Only the active/current board can show a Brand Avatar today because the current loaded board can hydrate `state.brandCore` from its board detail payload.

The Boards list itself receives lightweight metadata from `GET /api/boards`. That list payload omits `brand_core_snapshot`, so inactive board cards do not have the board-specific Brand DNA/avatar data needed to render an existing Brand Avatar.

Important constraints confirmed:

- Do not use the active board's avatar for other boards.
- Do not infer Brand from board title.
- Do not use `owner_avatar` as Brand Avatar; it is a user/owner identity field, not Brand identity.
- Do not generate avatars.
- Do not add storage or API behavior in this audit.

Conclusion: current behavior is correct and conservative. It avoids falsely showing the current board's Brand identity on unrelated boards.

---

## Per-Board Avatar Options

### Option 1 — Extend `GET /api/boards` with safe display snapshot

Add only the minimum display fields needed for each board card, likely derived from `brand_core_snapshot` server-side or returned as a small nested object.

Possible shape:

```json
{
  "id": "...",
  "name": "...",
  "updated_at": "...",
  "order_index": 0,
  "brand_display": {
    "name": "Appics",
    "avatar_url": "https://..."
  }
}
```

Pros:

- Allows every board card to show its own Brand name/avatar when available.
- Avoids sending full Brand Brain/Brand Core snapshots to the list UI.
- Keeps client rendering simple.
- Avoids using current board state for other boards.

Cons:

- Requires API change and careful privacy/performance review.
- Needs explicit server-side extraction rules for approved avatar/name fields.

Risk: **Medium-low** if only display-safe fields are returned.

### Option 2 — Include full `brand_core_snapshot` in list payload

Pros:

- Minimal backend extraction logic.
- Client can reuse existing helper.

Cons:

- Potentially heavy payload.
- Exposes more Brand Brain data than needed for a library card.
- Makes Board snapshots look more canonical than they are, which conflicts with runtime alignment guidance.

Risk: **Medium-high**.

### Option 3 — Client fetches each board detail lazily

Pros:

- No list API shape change.
- Uses existing board detail route.

Cons:

- N+1 API requests.
- Increases latency and loading complexity.
- More auth/access edge cases.
- Higher risk than a single list payload extension.

Risk: **Medium-high**.

### Recommendation

Use **Option 1** in a future PR: return a minimal `brand_display` object from `GET /api/boards` with existing, safe, display-only Brand name/avatar data. Do not return full `brand_core_snapshot` in the list response unless a later product/security review approves it.

---

## Current Ordering Behavior

### Server ordering

The Boards list is ordered by the API query:

1. owner boards first
2. editor boards next
3. unowned/open boards last
4. `order_index ASC NULLS LAST`
5. `updated_at DESC`

This means manual order is respected only inside each access group and only where `order_index` is set. Boards without `order_index` fall back to most recently updated first.

### Client ordering

The client does not sort `state.boardsLibrary` after loading. It renders the API order directly.

### Move Up / Move Down behavior

`Move Up` and `Move Down` are handled by document-level click delegation on:

- `data-up-board`
- `data-down-board`
- `data-index`

The handler calls `moveBoard(boardId, direction, index)`.

`moveBoard()`:

1. Copies `state.boardsLibrary`.
2. Computes the swap index.
3. PATCHes the current board's `order_index` to the swap index.
4. PATCHes the swapped board's `order_index` to the original index.
5. Reloads the Boards Library.

The PATCH API persists `order_index` on the board row.

### Ordering caveat

Move Up / Move Down swaps array positions from the currently rendered list, but the server also groups by role/access before applying `order_index`. If a user attempts to reorder across owner/editor/open group boundaries, server ordering may still place boards back into access groups on reload.

---

## Recommended Default Ordering

### Option A — Active board pinned first, then existing order

Pros:

- Low implementation risk.
- Keeps manual ordering mostly intact.
- Makes the board the user is currently working on easy to find.
- Does not change API ordering.

Cons:

- Client-side pinning means the rendered first item may not reflect persisted `order_index`.
- Needs a clear visual indication such as “Current board” to avoid confusion.

Risk: **Low-medium**.

### Option B — Active board pinned first, then updated_at descending

Pros:

- Feels like a recent-work library.
- Current board is always obvious.

Cons:

- Conflicts with manual `order_index` semantics.
- Makes Move Up / Move Down less meaningful.
- Would likely require removing or redefining manual order.

Risk: **Medium**.

### Option C — updated_at descending only

Pros:

- Simple mental model: recently edited boards first.
- Uses existing `updated_at`.

Cons:

- Conflicts with manual ordering and Move Up / Move Down.
- Makes `order_index` mostly irrelevant.
- Can move boards unexpectedly after autosave/save.

Risk: **Medium-high**.

### Option D — manual order only

Pros:

- Preserves current Move Up / Move Down intent.
- Lowest behavior risk.

Cons:

- Current board may be hard to find.
- Boards without order still need timestamp fallback.
- Manual ordering can feel admin-like rather than library-like.

Risk: **Low**.

### Recommendation

Recommended future implementation: **Option A — Active board pinned first, then existing order**.

Why:

- It addresses the main UX concern without discarding manual ordering.
- It can be implemented client-side as a presentation-only ordering layer after audit.
- It avoids changing API sorting, persistence, ownership, or `order_index` semantics.
- It pairs well with a visible “Current board” chip.

Do not implement updated-at-only sorting until the product intentionally chooses recency over manual order and removes/reframes Move Up / Move Down.

---

## Drag & Drop Feasibility

### Existing DOM structure

Current generated card structure is compatible with future drag handles because each card is a discrete `.board-row.fk-card` element appended to `#boards-library-list`.

Future drag implementation would need:

- stable board ID on the card, e.g. `data-board-id`
- a dedicated drag handle inside the card, not the whole card
- drag state classes for grabbed/dragging/drop-target
- keyboard-accessible reorder controls
- persistence through existing or improved `order_index` PATCH logic

### Existing data targets

Current reorder controls already expose:

- `data-up-board`
- `data-down-board`
- `data-index`

Future drag-and-drop can reuse board IDs conceptually, but should not depend on stale `data-index` values after drag hover/reorder unless the implementation recomputes order from DOM positions.

### Required drag events

A mouse/pointer implementation would likely need:

- `dragstart` / `dragover` / `drop` / `dragend`, or pointer events for custom dragging
- drag handle focus/keyboard support
- DOM reordering preview
- final persisted order PATCH after drop
- rollback on failed PATCH
- reload/reconciliation with server order

### Touch/mobile concerns

Native HTML5 drag-and-drop is inconsistent on touch devices. A robust implementation may require pointer events and careful scroll-vs-drag handling.

Because Boards cards include action buttons, the drag handle must be isolated so opening/copying/renaming/deleting does not accidentally start a drag.

### Keyboard accessibility

Drag-and-drop must not replace keyboard-friendly reordering. Minimum acceptable accessibility path:

- Keep Move Up / Move Down controls as fallback.
- Add visible/focusable drag handle only if it has accessible instructions.
- Consider `aria-grabbed` only if using a well-tested accessible drag pattern; otherwise avoid misleading ARIA.
- Announce reorder result through a polite live region in a future implementation.

### Recommendation

Drag-and-drop is feasible but should **supplement**, not replace, Move Up / Move Down at first.

Do not remove Move Up / Move Down until:

- drag behavior is proven on desktop and touch
- keyboard fallback is verified
- persistence and rollback are tested
- cross-access-group ordering behavior is resolved

---

## Accessibility / Fallback Recommendation

Keep Move Up / Move Down as the accessible fallback even if drag-and-drop is added later.

Recommended future pattern:

1. Visible drag handle for pointer users.
2. Move Up / Move Down controls remain available, possibly visually lighter or grouped in an overflow later.
3. Keyboard users can reorder with buttons first; optional keyboard drag mode can be considered only after a dedicated accessibility audit.
4. Reorder result is announced with polite status text.
5. Failed reorder restores the previous order and explains the failure.

---

## Risks

### Brand Avatar / Brand name risks

- Returning full `brand_core_snapshot` in list payload may expose more Brand Brain data than the card needs.
- Treating `brand_core_snapshot` as canonical Brand identity conflicts with runtime alignment guidance; it is a compatibility snapshot, not final Brand ownership.
- Using `owner_avatar` as Brand Avatar would be semantically wrong.
- Inferring Brand name from board title would create false identity data.

### Ordering risks

- Sorting by `updated_at` can conflict with manual order.
- Active-board pinning can make rendered order differ from persisted order unless labeled clearly.
- Existing `order_index` values are simple integers tied to current rendered positions; repeated reorder across filtered/grouped lists may produce confusing results.
- Role/access grouping currently overrides pure manual order across the full list.

### Drag-and-drop risks

- Touch drag can conflict with page scroll.
- Drag handles can interfere with existing buttons if not isolated.
- Drag-and-drop without keyboard fallback is inaccessible.
- Persisting partial order changes could fail mid-sequence without rollback.
- Drag reorder across owner/editor/open groups may not persist visually after reload because server grouping still wins.

---

## Recommended PR Sequence

### PR 4 — Boards list display snapshot API audit + implementation

Purpose:

- Extend `GET /api/boards` with a minimal `brand_display` object or equivalent display-only fields.
- Return only safe Brand Avatar URL and Brand name when already present.
- Do not return full `brand_core_snapshot` unless explicitly approved.

Files likely affected:

- `api/boards/index.js`
- `app.js`
- a new audit doc

Do not touch:

- board persistence
- board detail route behavior
- save/load
- autosave
- ownership/permissions
- Canvas
- Brand Core behavior

### PR 5 — Active board pinning presentation

Purpose:

- Pin the active/current board first in the rendered Boards Library while preserving the rest of the API order.
- Add a “Current board” chip.
- Do not change API sorting or persisted `order_index`.

Files likely affected:

- `app.js`
- `styles.css`
- audit doc

Do not touch:

- API order
- Move Up / Move Down persistence
- routing
- save/load

### PR 6 — Ordering model decision audit

Purpose:

- Decide whether Boards should remain manual-order-first or recency-first.
- Document whether `order_index` remains a user-facing concept.
- Define how owner/editor/open grouping should interact with ordering.

Files likely affected:

- docs only

### PR 7 — Drag-and-drop prototype behind safe fallback

Purpose:

- Add drag handle and pointer reorder only after ordering model is settled.
- Keep Move Up / Move Down fallback.
- Persist using the existing PATCH mechanism or a new batch endpoint if audited.

Files likely affected:

- `app.js`
- `styles.css`
- possibly `api/boards/[id].js` or new batch endpoint if approved
- audit doc

Do not touch:

- ownership
- permissions
- Board APIs beyond audited reorder persistence
- save/load/autosave

---

## Immediate Next Implementation PR

Recommended immediate next implementation PR:

**Boards Library Display Snapshot API**

Scope:

- Add minimal per-board display fields to the list payload so every board card can show its own Brand Avatar / Brand name when already available.
- Prefer a small nested `brand_display` object.
- Extract only approved/existing Brand Avatar URL and explicit Brand name fields.
- Do not send full `brand_core_snapshot` by default.
- Do not infer Brand from board title.
- Do not use `owner_avatar` as Brand Avatar.
- Do not change ordering yet.

Rationale:

This addresses the most visible remaining gap, explains why only the current board has an avatar today, and enables true per-board visual identity without changing ordering or drag behavior.

---

## Runtime Confirmation

This audit did not modify runtime behavior.

This audit did not modify:

- `app.js`
- `campaign-v3.js`
- `index.html`
- `styles.css`
- APIs
- Board API behavior
- Board list ordering
- Move Up / Move Down behavior
- drag-and-drop behavior
- routing
- save/load
- autosave
- Canvas
- Dashboard
- Brand Core
- AI Brain
- Insights
- ownership
- permissions
- data model

## Decision

Proceed with planning only. The next implementation should focus narrowly on safe per-board display snapshot data before any ordering or drag-and-drop work.
