# Boards Display Snapshot API Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | UX Unification Sprint 1 — Boards PR 4 audit and implementation record |
| Scope | Boards list display payload + client display helper only |
| Runtime behavior changes | Minimal backward-compatible API payload addition for display-only data |
| Files changed | `api/boards/index.js`, `app.js`, `docs/audits/2026-07-06-boards-display-snapshot-api-audit.md` |

## Documents Read

- `docs/audits/2026-07-06-boards-avatar-ordering-drag-audit.md`
- `docs/audits/2026-07-06-boards-final-polish-audit.md`
- `docs/audits/2026-07-06-boards-design-migration-audit.md`
- `docs/constitution/engineering-constitution.md`

## Summary

This PR implements the narrow next step recommended by the Boards avatar/ordering/drag audit: add a minimal, display-safe per-board Brand display snapshot to `GET /api/boards` and consume it in the existing Boards card helper.

The payload is backward-compatible and adds only:

```js
board.brand_display = {
  name: string | null,
  avatarUrl: string | null
}
```

No full `brand_core_snapshot` is returned to the client list payload. No Brand records are created. No avatars are generated. No Brand name is inferred from board title. No owner avatar is used as Brand Avatar. No Board ordering, permissions, ownership, routing, save/load, autosave, Canvas, Dashboard, Brand Core behavior, AI Brain, Insights, drag-and-drop, or data model behavior was changed.

---

## Audit Findings

### 1. API route inspected

The Boards list route is `api/boards/index.js` for `GET /api/boards`.

Before this PR, the list query selected lightweight Board metadata only and returned `result.rows` directly.

### 2. Board list rows selected / mapped

The list query already selected:

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

This PR adds `b.brand_core_snapshot` to the server-side SELECT only so the API can derive display-safe Brand fields. The response serializer removes `brand_core_snapshot` before returning rows to the client.

### 3. `brand_core_snapshot` availability

`brand_core_snapshot` already exists as a Boards table column and is used by board detail save/load flows. It is available in the database row, but it should not be sent wholesale in the Boards Library list payload because it can contain more Brand Brain data than a card needs.

### 4. Safe fields inside `brand_core_snapshot`

The server-side display helper reads only explicit display-like fields:

Brand name candidates:

- `brand_core_snapshot.brandName`
- `brand_core_snapshot.name`
- `brand_core_snapshot.title`
- `brand_core_snapshot.brandDNA.brandName`
- `brand_core_snapshot.brandDNA.name`
- `brand_core_snapshot.brandAssets.name`

Brand Avatar candidates:

- accepted `brand_core_snapshot.brandDNA.avatar.imageUrl`, only when both Brand DNA and avatar are user-approved
- `brand_core_snapshot.avatarImageUrl`
- `brand_core_snapshot.avatarUrl`
- `brand_core_snapshot.brandAvatarUrl`

The helper does not read board title as Brand name and does not read `owner_avatar` as Brand Avatar.

### 5. Display-safe extraction helper

Added `getBoardBrandDisplaySnapshot(board)` in `api/boards/index.js`.

It returns only:

- `name`: trimmed string or `null`
- `avatarUrl`: safe URL string or `null`

The URL helper accepts HTTP(S) URLs and data-image URLs. Other strings are treated as absent.

### 6. No full snapshot returned

Added `serializeBoardListRow(row)` in `api/boards/index.js`.

It destructures `brand_core_snapshot` out of the row and returns all existing list fields plus `brand_display`. This keeps the response backward-compatible while preventing full Brand Core snapshots from being returned in the list.

### 7. Client board card helper inspected

The current client helper is `getBoardBrandDisplay(board, boardName)` in `app.js`.

Before this PR, it read:

1. current board `state.brandCore` when the board ID matched the current route/state board
2. `board.brand_core_snapshot` / compatible client-side snapshot fields if already present
3. fallback initial from Brand name or board name

### 8. Client helper update

The client helper now prefers:

1. `board.brand_display.name`
2. `board.brand_display.avatarUrl`
3. existing current-board / compatible snapshot fallback
4. existing initial fallback

This allows inactive boards to show their own Brand name/avatar when the API provides display-safe data, while preserving current-board and initial fallback behavior.

---

## API Payload Added

Each board in `GET /api/boards` may now include:

```json
{
  "brand_display": {
    "name": "Appics",
    "avatarUrl": "https://example.com/avatar.png"
  }
}
```

If either value is unavailable, it is returned as `null`:

```json
{
  "brand_display": {
    "name": null,
    "avatarUrl": null
  }
}
```

Existing board fields remain unchanged.

---

## Client Display Logic

The existing board card display helper now reads `board.brand_display` first, then keeps its previous fallbacks.

Display order:

1. `board.brand_display.name` for Brand name if present.
2. `board.brand_display.avatarUrl` for Brand Avatar if present.
3. Active/current board `state.brandCore` if the board ID matches the current board.
4. Compatible snapshot fields if already present on a board object.
5. Initial fallback.

This preserves the current active-board avatar behavior and enables per-board avatar/name display for any board whose list payload now includes display-safe data.

---

## Runtime Confirmation

This PR does not modify:

- Board ordering
- Move Up / Move Down behavior
- drag-and-drop behavior
- Board ownership
- Board permissions
- Board creation
- Board deletion
- Board duplication
- Board detail save/load behavior
- autosave
- routing
- Canvas
- Dashboard
- Brand Core behavior
- AI Brain
- Insights
- data model

This PR does not:

- return full `brand_core_snapshot` in the list payload
- infer Brand name from board title
- use `owner_avatar` as Brand Avatar
- generate avatars
- create Brand records
- implement Active Brand runtime

---

## Risks

### Payload sensitivity

Risk is low because the response returns only display-safe `name` and `avatarUrl`, not full Brand Brain data.

### Snapshot semantics

`brand_core_snapshot` remains a Board compatibility snapshot, not canonical Brand ownership. The display helper should not be interpreted as introducing canonical Brand records.

### Missing data

Boards without explicit Brand display fields will continue to show initial fallback and omit Brand name.

### URL safety

The server helper filters avatar URLs to HTTP(S) or data-image URLs. Invalid strings are returned as `null`.

---

## Rollback

Rollback is straightforward:

1. Remove `b.brand_core_snapshot` from the list SELECT in `api/boards/index.js`.
2. Remove `getBoardBrandDisplaySnapshot()` and `serializeBoardListRow()` from `api/boards/index.js`.
3. Return `result.rows` directly again.
4. Remove the `board.brand_display` reads from `getBoardBrandDisplay()` in `app.js`.
5. Remove this audit file.

No persisted data or routing state depends on this addition.

---

## Manual QA Checklist

- Open Boards.
- Boards with stored Brand Avatar show their own avatar, even when not active.
- Boards without Brand Avatar show initial fallback.
- Boards with Brand name show Brand name.
- Boards without Brand name omit the Brand field.
- Current board avatar still works.
- Open board still works.
- Copy link still works.
- Rename still works.
- Delete still works.
- Move Up / Move Down still work.
- Dashboard unaffected.
- Canvas unaffected.

## Decision

Proceed with this minimal display snapshot payload. Defer active-board pinning, sorting changes, drag-and-drop, full Brand records, and any ordering model changes to separate audited PRs.
