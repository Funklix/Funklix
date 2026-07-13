# Knowledge Module Runtime Phase 4 — Stable IDs on New Custom Tiles

## Summary

This implementation introduces optional, persisted Knowledge Module instance IDs for newly created Custom Brand Tiles only. It keeps legacy no-ID tiles compatible, preserves the existing Brand Workspace rendering/editor lifecycle, and avoids any migration of existing Brand Core data.

The new instance ID is a module instance identity, not a module type. This PR intentionally does not persist `moduleType`, metadata, readiness, history, attachments, AI state, upload state, or Knowledge Graph references.

## Dependency Audit Findings

### Files and runtime surfaces inspected

- `app.js` for Brand Core state initialization, Missing Knowledge actions, manual custom tile creation, rendering, editor selection, update, delete, save, and reset flows.
- `knowledge-module-runtime-adapter.js` for read-only normalized module view creation and legacy `custom:{index}` runtime keys.
- `knowledge-module-registry.js` for registry metadata and known Missing Knowledge module definitions.
- `index.html` for script load order.
- Previous audits covering Knowledge Module architecture, registry adoption, runtime adapter boundaries, stable identity planning, and custom tile integrity.

### Existing creation paths

The audit found two active Custom Tile creation paths that create new module-like instances:

1. Manual Brand Workspace creation through the `custom:add` editor path in `renderBrandCoreEditor()`.
2. Contextual Missing Knowledge creation through `createOrSelectMissingKnowledgeTile()`.

Both paths previously appended legacy objects shaped like:

```js
{ title, content, items: [] }
```

No additional direct Custom Tile clone path was identified in the runtime rendering/editor code. Board duplicate/copy behavior copies the broader Brand Core snapshot and is intentionally out of scope for this PR.

### Selection, rendering, and deletion dependencies

Before this change, Custom Tile selection used `custom:{index}` in `data-bc-key` and `state.brandCoreSelectedKey`. Rendering, editor lookup, and deletion all depended on the array index encoded in that string.

The custom tile integrity bugfix had already stabilized deletion by using immutable `filter(...)` removal and by skipping malformed generated placeholders. This implementation preserves that deletion pattern and changes only how an ID-backed tile is resolved before deletion.

### Persistence dependencies

The current Brand Brain persistence path serializes Custom Tile objects as part of `state.brandCore.customTiles`. No whitelist was found that would intentionally strip unknown optional fields from valid Custom Tile objects. Therefore, adding an optional `id` field to newly created tiles is backward-compatible and should round-trip through existing local/board snapshot persistence without storage-key or API changes.

### Safest insertion point

The safest shared insertion point for ID generation is a small standalone browser/CommonJS-compatible module loaded after the registry and before the runtime adapter/app. This avoids embedding a second ad hoc ID generator in multiple runtime files and lets Node smoke tests verify ID generation without loading the full browser app.

## Existing Creation Paths

### Manual Add Custom Tile

- Entry: `state.brandCoreSelectedKey === "custom:add"` in `renderBrandCoreEditor()`.
- Previous behavior: append a legacy custom tile and select `custom:{index}`.
- New behavior: append a custom tile with `id: "km_..."`, then select it via `custom-id:{id}`.

### Missing Knowledge Add Tile

- Entry: `createOrSelectMissingKnowledgeTile(rawTitle)`.
- Previous behavior: if no canonical title match existed, append a legacy custom tile and select `custom:{index}`.
- New behavior: if no canonical title match exists, append a custom tile with `id: "km_..."`, then select it via `custom-id:{id}`.
- Duplicate prevention remains canonical-title based; it does not use module instance IDs.

## ID Helper Location

A new standalone helper module, `knowledge-module-identity.js`, owns Knowledge Module instance ID generation and validation.

It is browser-global and CommonJS-compatible, matching the registry/adapter compatibility pattern:

- Browser: `window.KnowledgeModuleIdentity`
- Node: `require("./knowledge-module-identity")`

## ID Format

New Custom Tile instance IDs use:

```text
km_<uuid-or-fallback-token>
```

The helper prefers `crypto.randomUUID()` when available. If unavailable, it falls back to `crypto.getRandomValues()` to construct a UUID-compatible token. As a final dependency-free fallback, it combines timestamp, random chunks, and an incrementing counter. The fallback is intentionally not timestamp-only.

The helper does not assign or regenerate IDs for existing tiles.

## Runtime Key Strategy

Custom Tile runtime keys now follow a dual strategy:

- New ID-backed tiles: `custom-id:<id>`
- Legacy no-ID tiles: `custom:<index>`

Built-in Brand Core keys remain unchanged.

This preserves legacy compatibility while making newly created tile selection resilient to unrelated insertion/deletion index shifts.

## Stable ID Lookup

Small runtime lookup helpers centralize Custom Tile key handling:

- `getCustomTileRuntimeKey(tile, index)`
- `findCustomTileIndexByRuntimeKey(runtimeKey)`
- `getCustomTileByRuntimeKey(runtimeKey)`

The helpers resolve `custom-id:<id>` by exact persisted ID and resolve `custom:<index>` only as a legacy fallback. They do not use title as identity and do not mutate state.

## Legacy Fallback

Existing Custom Tiles without IDs continue to:

- render with `custom:{index}` keys,
- open in the editor,
- edit and save,
- delete through the legacy index fallback,
- persist and reload without automatic ID migration.

Opening Brand Workspace or reading adapter output does not assign IDs to old tiles.

## Selection / Update / Delete Changes

Selection and editor lookup now resolve Custom Tiles through the centralized runtime-key helpers. ID-backed tiles resolve by exact `id`; no-ID tiles resolve by index.

Updates continue to mutate the selected tile's title/content through the existing editor path and preserve any existing `id` field. Deletion continues to remove exactly one selected tile using an immutable `filter(...)` update and then resets the editor selection to `brandCore`.

No sparse arrays, placeholder tiles, title-based selection, or `custom:0` fallback labels are introduced.

## Persistence Round Trip

Expected round trip for newly created tiles:

1. Create a Custom Tile.
2. `id: "km_..."` is assigned once.
3. Existing `saveBrandBrainState()` persists `state.brandCore.customTiles`.
4. Local/board snapshot persistence stores the optional `id` field with the tile object.
5. Reload/hydration preserves the same tile object and same `id`.
6. Edits preserve the same `id`.
7. Deletion removes the exact selected tile.

No storage keys, Board APIs, snapshot root shape, migration versions, or hydration migrations were changed.

## Adapter Changes

The read-only Knowledge Module Runtime Adapter now recognizes stable IDs when present on Custom Tiles:

- ID-backed Custom Tiles expose `runtimeKey: "custom-id:<id>"`.
- `sourceReference.id` contains the stable instance ID.
- `sourceReference.customTileIndex` remains available as a locator/debug aid.
- `sourceReference.legacyRuntimeOnly` is `false` for ID-backed tiles and `true` for legacy no-ID tiles.
- Legacy no-ID tiles continue to expose `custom:{index}` runtime keys.

The adapter remains read-only and does not modify source Brand Core state.

## Board Copy Limitation

This PR does not change Board duplicate/copy semantics. If an existing Board copy flow clones `brand_core_snapshot`, newly added Custom Tile IDs inside that snapshot may be preserved in the copied board as a transitional limitation.

Regenerating module instance IDs during Board copy requires a dedicated follow-up PR because future Brand-owned modules and Knowledge Graph references may need different semantics from current board-scoped snapshots.

## Files Changed

- `knowledge-module-identity.js`
- `knowledge-module-runtime-adapter.js`
- `app.js`
- `index.html`
- `docs/audits/2026-07-12-knowledge-module-stable-id-implementation-audit.md`

## Runtime Confirmation

This PR does not intentionally modify:

- Brand Workspace layout
- sticky editor behavior
- natural scrolling
- built-in Brand Core module storage
- Brand Core prompts
- Brand Core APIs
- Brand DNA behavior
- Brand Avatar behavior
- Website Analysis behavior
- Missing Knowledge duplicate-prevention rules
- Dashboard Brand Evolution
- Boards Brand display
- Canvas
- AI Brain
- Insights
- autosave routing
- save/load storage keys
- Board APIs
- DOM IDs unrelated to Custom Tile runtime keys
- unrelated event handlers

The only runtime behavior change is internal identity handling for newly created Custom Tiles.

## Risks

- Mixed `custom-id:<id>` and `custom:{index}` keys require all Custom Tile lookup paths to use shared helpers.
- Copied board snapshots may preserve IDs until a dedicated Board-copy identity PR defines regeneration semantics.
- A missing `knowledge-module-identity.js` script would cause new app-created IDs to fall back to a local generator, but the script load order has been updated to load the shared helper before the adapter and app.
- Existing legacy no-ID tiles remain index-sensitive until a future lazy-ID persistence PR is approved.

## Rollback

Rollback is straightforward:

1. Revert `knowledge-module-identity.js` and its script tag.
2. Revert the Custom Tile runtime-key helpers and creation changes in `app.js`.
3. Revert adapter stable-ID awareness.

Existing no-ID tiles remain compatible. Newly created ID-backed tiles would still render as valid custom tile objects because the optional `id` field is ignored by the legacy shape.

## Manual QA

### A. New manual tile

1. Open Brand Workspace.
2. Create a new manual Custom Tile.
3. Confirm exactly one tile appears.
4. Inspect state/debug data and confirm it has one `km_` ID.
5. Edit title/content.
6. Confirm ID remains unchanged.
7. Reload.
8. Confirm same tile and same ID remain.
9. Delete it.
10. Reload.
11. Confirm it remains deleted.

### B. Missing Knowledge tile

1. Create Market Research through Add Tile.
2. Confirm it has a `km_` ID.
3. Confirm it opens in the editor.
4. Trigger Market Research again.
5. Confirm no duplicate is created.
6. Confirm the existing ID remains unchanged.
7. Delete Market Research.
8. Confirm its Missing Knowledge prompt returns.
9. Recreate it.
10. Confirm the new instance receives a new `km_` ID.

### C. Multiple tiles

1. Create Founder Story, Business Plan, Pitch Deck, and Whitepaper.
2. Confirm each receives a unique ID.
3. Confirm each appears once in the correct section.
4. Delete one middle tile.
5. Confirm remaining ID-backed tiles still edit/delete correctly.
6. Confirm no selection shifts to the wrong tile.

### D. Legacy compatibility

1. Load an older board containing Custom Tiles without IDs.
2. Confirm all legacy tiles render.
3. Edit one.
4. Save/reload.
5. Delete one.
6. Confirm the correct legacy tile is removed.
7. Confirm no automatic bulk ID migration occurred.

### E. Adapter

1. Inspect runtime adapter output.
2. Confirm ID-backed tiles use ID-backed runtime keys.
3. Confirm legacy tiles retain `custom:{index}`.
4. Confirm source state is not mutated by adapter reads.

### F. Regression

1. Confirm Brand DNA works.
2. Confirm Brand Avatar works.
3. Confirm Website Analysis works.
4. Confirm sticky editor and scrolling work.
5. Confirm Dashboard, Boards, Canvas, AI Brain, and Insights are unchanged.
6. Confirm no `custom:0` corruption.
7. Confirm no console errors.
