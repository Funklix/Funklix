# Brand Core Custom Tile Integrity Bugfix Audit

**Date:** 2026-07-10  
**Scope:** Brand Core / Brand Workspace custom tile creation, rendering, selection, deletion, and persistence integrity.  
**Type:** Focused bugfix audit and implementation record.

## Summary

This bugfix restores Custom Brand Tile integrity after the actionable Missing Knowledge work introduced a render-path regression that exposed internal `custom:{index}` keys as visible cards and left stale custom cards in section rows after rerendering or deletion.

The implementation is intentionally narrow:

- no Brand Workspace redesign
- no AI generation or prompt changes
- no API changes
- no storage-key changes
- no new canonical Brand fields
- no new custom tile data model

The fix keeps the existing custom tile model and persistence path, while making creation, rendering, selection, deletion, and missing-knowledge detection safer around invalid, sparse, stale, or malformed custom tile entries.

## User-visible symptoms

Observed symptoms before this bugfix:

1. Clicking an actionable Missing Knowledge item such as **Market Research** or **Pitch Deck** created the intended tile.
2. Additional unrelated empty cards appeared with labels such as `custom:0`.
3. Clicking **Remove custom tile** did not reliably remove the selected tile from the visible Brand Workspace.
4. The selected tile could appear to become an empty `custom:0` tile after deletion or rerender.
5. Multiple empty `custom:0` cards could remain visible because stale custom cards were not removed from every visual section before rerendering.

## Exact root cause

The root cause was a combination of custom tile rendering and deletion issues rather than a new persistence schema issue.

### 1. Custom section cards were not fully cleaned before rerender

The contextual Missing Knowledge work allowed canonical custom tiles to render inside mapped Brand Workspace sections:

- **Founder Story** → Intelligence
- **Market Research** → Strategy
- **Business Plan** → Strategy
- **Pitch Deck** → Deployment
- **Whitepaper** → Deployment

However, the prior cleanup removed only the global custom row/group wrappers. Custom cards that had been appended into section rows remained in the DOM. On a later render, new custom cards were appended again while stale cards were still present.

### 2. Custom cards were processed as built-in Brand Core cards

The built-in card refresh loop selected every `.bc-node[data-bc-key]`, including custom cards with keys such as `custom:0`. Since the built-in title map does not contain `custom:0`, the fallback title exposed the internal key as the visible card title.

That is why users saw phantom cards labeled `custom:0`.

### 3. Deletion only refreshed the editor

The delete handler removed the selected array entry and reset the selected key, but it only rerendered the editor panel. It did not rerender the Brand Workspace tile list, so stale DOM cards remained visible even after state changed.

### 4. Array-index identity became unsafe when stale DOM remained

Custom tiles currently use the existing `custom:{index}` identity convention. That identity can remain workable only if rendering always starts from clean state-derived DOM and if invalid selected indices are guarded. The stale DOM left behind after rerenders made index-based keys appear as user-facing labels and made deletion look incorrect.

## Existing Custom Tile state shape

The existing state shape is:

```js
state.brandCore.customTiles = [
  {
    title: string,
    content: string,
    items?: array
  }
]
```

Existing custom tiles do not have a stable persisted `id` field or a persisted section/category field. This bugfix does not introduce a new identity system or migrate storage.

A valid custom tile for rendering can have:

- a non-empty `title`, even if `content` is empty, or
- non-empty `content`, or
- a non-empty `items` array.

This allows legitimate newly created Missing Knowledge tiles to render with an empty content value as required.

## Identity mechanism

The current identity mechanism remains the existing `custom:{index}` convention.

This PR keeps that identity mechanism but makes it safer by:

- removing all previously rendered custom-card DOM before drawing from state
- excluding custom cards from the built-in tile refresh loop
- validating the selected custom index before opening the editor
- resetting the editor selection if it points at an invalid or malformed custom tile
- using an immutable array filter for deletion
- rerendering both tiles and editor after deletion

No second competing identity system was added.

## Creation bug

Creation through the Missing Knowledge action path already created the intended tile using the canonical title and empty content. The visible bug happened because rendering did not clean stale custom cards and then reprocessed old custom DOM as built-in Brand Core DOM.

The creation path is preserved, but duplicate detection now ignores malformed generated placeholders so they cannot block creation/opening of a valid canonical tile.

## Deletion bug

The previous delete flow used an in-place array removal and rerendered only the editor. That allowed stale visual cards to remain after state changed.

The corrected deletion flow:

1. resolves the selected `custom:{index}`
2. removes exactly that index using `filter(...)`
3. resets selection to the main Brand Core editor
4. persists through the existing Brand Brain save path
5. rerenders Brand Workspace tiles
6. rerenders the editor

This prevents deleted tiles from remaining as empty or `custom:0` placeholder cards.

## Rendering bug

Rendering now only emits valid persisted tile objects and skips malformed generated placeholders.

The render path now avoids exposing internal fallback keys by:

- removing all custom cards before rendering fresh from state
- limiting the built-in tile refresh loop to non-custom keys
- skipping invalid entries, sparse holes, primitive values, nulls, undefined values, empty fallback objects, and empty generated `custom:{index}` placeholders

A legitimate custom tile with a real title and empty content still renders normally.

## Section grouping bug

Section grouping was part of the visible regression. Canonical custom tiles rendered in Strategy, Intelligence, and Deployment section rows, but those rows were not included in the old custom cleanup selector.

The fix removes all rendered custom-card nodes before rerendering, regardless of whether they were previously in the global custom group or a contextual section row. Each custom tile is then rendered exactly once in its primary mapped section or in the global custom knowledge group.

## Persistence/hydration findings

The bugfix does not change persistence keys, API payloads, board snapshot shape, or hydration schema.

The round trip remains:

```text
create/delete/edit
→ update state.brandCore.customTiles
→ saveBrandBrainState()
→ existing board-scoped Brand Brain persistence
→ reload/hydrate
→ render from state.brandCore.customTiles
```

Deletion now updates the array immutably and persists the updated array immediately. Because stale DOM is removed and the workspace rerenders from state, a deleted tile should stay absent after reload.

## Malformed legacy-entry handling

This bugfix does not perform an aggressive global data migration.

It conservatively skips rendering entries that match the generated placeholder pattern:

- title matches `custom:{number}`
- content is empty
- no `items` are present

It does **not** delete those entries from saved state automatically. It also does not delete valid user-created tiles based only on empty content. A valid canonical title such as **Market Research** with empty content remains visible and editable.

If a user intentionally created a tile titled `custom:0` with meaningful content, it is not treated as an empty malformed placeholder.

## Files changed

- `app.js`
  - added custom tile validity/malformed-placeholder guards
  - made duplicate detection ignore malformed placeholder entries
  - updated Missing Knowledge copy to reflect actionable tile creation
  - guarded custom editor selection against invalid entries
  - changed custom tile deletion to an immutable update plus full rerender
  - cleaned all custom DOM before rerendering
  - excluded custom cards from the built-in Brand Core tile refresh loop
  - skipped invalid/malformed custom entries during render

- `docs/audits/2026-07-10-brand-core-custom-tile-integrity-bugfix-audit.md`
  - records root cause, risks, rollback, and QA plan

## Runtime confirmation

Confirmed by static checks that the bugfix does not introduce JavaScript syntax errors and does not require runtime/API/schema changes.

Behavior intentionally preserved:

- Brand Workspace hierarchy
- sticky editor
- natural Brand Workspace scrolling
- built-in Brand Core editors
- Brand DNA
- Brand Avatar
- website analysis
- reset behavior
- Dashboard Brand Evolution
- Boards Brand display
- save/load and autosave paths
- routing
- Canvas
- AI Brain
- Insights

## Risks

### Low risk

- The fix is scoped to Brand Core custom tile validation, rendering, and deletion.
- No API or storage schema changes are included.
- Legitimate empty-content canonical tiles remain valid.

### Moderate risk

- Existing custom tile identity still uses `custom:{index}` because no stable persisted IDs exist. This is acceptable for this focused bugfix, but a later architecture PR should consider a backward-compatible stable custom tile ID if custom tiles become more complex.

### Legacy data risk

- Previously saved malformed `custom:{index}` empty entries are hidden but not automatically deleted. This avoids accidental loss of valid user content, but it means saved malformed entries may remain in persisted snapshots until a future explicit cleanup/migration is approved.

## Rollback

Rollback is straightforward:

1. Revert this commit.
2. Custom tile creation returns to the previous render behavior.
3. No database migration or storage rollback is needed because this PR does not change storage shape.

If rollback is needed after users create valid canonical tiles, those tiles remain compatible with the existing `{ title, content, items }` custom tile shape.

## Manual QA

### A. Creation

1. Open Brand Workspace with all five knowledge items initially missing.
2. Click **Market Research** once.
3. Confirm exactly one **Market Research** tile appears.
4. Confirm no `custom:0` or unrelated tiles appear.
5. Confirm the tile opens in the editor.
6. Confirm content is empty.
7. Enter test content.
8. Reload.
9. Confirm exactly one tile persists with its content.

### B. Duplicate prevention

1. Trigger **Market Research** again through any available route.
2. Confirm the existing tile opens.
3. Confirm no duplicate tile is created.
4. Repeat with title casing/spacing variations if test controls allow it.

### C. Multiple tiles

1. Create **Business Plan**.
2. Create **Pitch Deck**.
3. Create **Whitepaper**.
4. Create **Founder Story**.
5. Confirm exactly five intended tiles exist.
6. Confirm every tile appears once in its correct section.
7. Confirm no empty `custom:0` cards exist.

### D. Deletion

1. Delete **Market Research**.
2. Confirm the **Market Research** card disappears immediately.
3. Confirm other custom tiles remain unchanged.
4. Confirm the editor no longer points at the deleted tile.
5. Reload.
6. Confirm **Market Research** remains deleted.
7. Confirm its Missing Knowledge action returns.
8. Recreate **Market Research**.
9. Confirm exactly one new valid tile appears.

### E. Existing tiles

1. Edit a pre-existing unrelated custom tile.
2. Confirm it still saves.
3. Delete it.
4. Confirm exactly that tile is removed.

### F. Regression

1. Confirm Brand Core built-in tiles are unchanged.
2. Confirm Brand DNA still works.
3. Confirm Brand Avatar still works.
4. Confirm website analysis still works.
5. Confirm sticky editor and page scrolling remain correct.
6. Confirm Dashboard, Boards, Canvas, AI Brain, and Insights are unaffected.
7. Confirm no console errors.
