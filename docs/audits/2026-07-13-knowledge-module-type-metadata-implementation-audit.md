# Knowledge Module Runtime Phase 5 — Optional Module Type Metadata for Canonical Knowledge Modules

## Summary

This PR adds optional persisted `moduleType` metadata only for newly created canonical Missing Knowledge Custom Tiles. It preserves stable instance IDs, legacy `custom:{index}` compatibility, untyped manual Custom Tiles, and the existing Brand Workspace editor/render/delete lifecycle.

The implementation keeps Module Instance ID and Module Type ID separate:

- `id: "km_..."` identifies a persisted module instance.
- `moduleType: "market_research"` identifies the registry-backed module type.

No typed-module storage migration, specialized UI, AI action, upload behavior, readiness state, history, or Knowledge Graph projection is introduced.

## Dependency Audit Findings

### Runtime surfaces inspected

- `app.js` Missing Knowledge creation, manual `custom:add` creation, canonical-title duplicate prevention, Custom Tile rendering, editor update/delete, Brand Workspace missing detection, Brand Core normalization, snapshot serialization, and Board duplicate payload creation.
- `knowledge-module-runtime-adapter.js` Custom Tile module resolution, registry lookups, stable ID runtime keys, source references, and legacy canonical-title fallback.
- `knowledge-module-registry.js` canonical module definitions and read-only `getModuleDefinition()` / `isKnownModule()` helpers.
- `knowledge-module-identity.js` stable `km_` instance ID generation/validation.
- Prior audits for registry adoption, runtime adapter boundaries, stable identity, stable ID implementation, and custom tile integrity.

### Creation paths

The audit confirmed two Custom Tile creation paths:

1. Manual Custom Tile creation through `custom:add` in `renderBrandCoreEditor()`.
2. Canonical Missing Knowledge creation through `createOrSelectMissingKnowledgeTile()`.

Only the Missing Knowledge path should persist canonical `moduleType` metadata in this PR. The manual path remains generic and omits `moduleType`.

### Duplicate-prevention dependencies

Before this PR, Missing Knowledge duplicate prevention relied on exact normalized canonical title matching. The transition now prefers valid exact `moduleType` matches first, then falls back to exact canonical-title matching for legacy tiles without a valid module type.

This preserves older boards and avoids duplicate canonical modules without using instance IDs as type-level uniqueness checks.

### Persistence and hydration findings

Custom Tile objects are preserved through existing `state.brandCore.customTiles` serialization. `normalizeBrandCoreState()` spreads the incoming Brand Core object and retains the existing `customTiles` array, so optional `moduleType` fields are not stripped during normal load/normalize/save behavior.

Board duplication currently serializes the full Brand Core snapshot through the existing snapshot path. This PR does not alter copy semantics.

## Current Typed/Untyped State

- New canonical Missing Knowledge tiles can now be typed with both `id` and `moduleType`.
- New manual Custom Tiles remain untyped but still receive stable `km_` IDs.
- Legacy tiles without `id` and without `moduleType` remain supported.
- ID-backed tiles created before this PR but without `moduleType` remain supported.

## Supported Canonical Module Types

Only these five registry-backed Missing Knowledge module types are created by this PR:

- `founder_story`
- `market_research`
- `business_plan`
- `pitch_deck`
- `whitepaper`

No other Custom Tile receives inferred canonical module metadata during editing or rendering.

## Validation Strategy

Validation uses the existing registry lookup path. A `moduleType` is valid only when `KnowledgeModuleRegistry.getModuleDefinition(moduleType)` returns a definition.

The app helper resolves valid module types through registry metadata and rejects unknown arbitrary strings. The runtime adapter likewise resolves persisted `moduleType` only through the registry before trusting it.

No fuzzy matching is used for persisted `moduleType` validation.

## Creation Changes

### Canonical Missing Knowledge creation

When a user clicks a supported Missing Knowledge action and no typed or legacy matching tile exists, the new tile is stored as:

```js
{
  id: "km_...",
  moduleType: "market_research",
  title: "Market Research",
  content: "",
  items: []
}
```

The `moduleType` and title come from the registry definition.

### Manual Custom Tile creation

Manual Custom Tiles continue to use the generic shape:

```js
{
  id: "km_...",
  title: "New Custom Tile",
  content: "",
  items: []
}
```

Manual tiles are not inferred or reclassified when a user later edits the title.

## Duplicate Prevention Transition

The canonical creation flow now checks for duplicates in this order:

1. A valid tile with `moduleType === requestedType`.
2. A legacy/untyped tile whose title exactly matches the canonical registry label after conservative normalization.
3. If neither exists, create one typed tile.

Legacy title matches are selected but not silently upgraded with `moduleType` in this PR.

## Runtime Adapter Resolution

The read-only runtime adapter now resolves Custom Tile type metadata in this order:

1. Valid persisted `tile.moduleType` resolved through the registry.
2. Exact canonical title fallback for legacy tiles.
3. `custom` fallback for unrelated Custom Tiles.

If `moduleType` and title conflict, the adapter uses `moduleType` for `moduleType`, `definition`, `section`, `category`, and `capabilities`, while preserving the tile's current title as the user-facing `title` value.

The adapter remains read-only and does not write missing or corrected `moduleType` values back into source state.

## Title / Module Type Conflict Rules

For a tile such as:

```js
{
  moduleType: "market_research",
  title: "Competitor Notes"
}
```

Conservative behavior is:

- `moduleType` remains authoritative for module identity/type.
- `title` remains the user-facing editable title.
- The registry label remains available through the adapter `definition.label`.
- The app does not overwrite the title.
- The app does not silently change `moduleType` based on title edits.

## Persistence Round Trip

Expected round trip:

1. Create canonical Missing Knowledge tile.
2. Assign `id: "km_..."` and canonical `moduleType`.
3. Save through existing Brand Brain persistence.
4. Reload/hydrate through existing Brand Core normalization.
5. Preserve the same `id` and same `moduleType`.
6. Edit title/content without changing `id` or `moduleType`.
7. Delete by stable instance ID when present.
8. Recreate as a new instance with a new `id` and the same canonical `moduleType`.

No localStorage keys, API contracts, snapshot root structures, migration versions, or hydration-time bulk upgrades were added.

## Legacy Compatibility

Old tiles without `id` and without `moduleType` continue to render, edit, save, delete, reload, and satisfy duplicate prevention through exact canonical-title fallback.

Old ID-backed tiles without `moduleType` remain valid Custom Tiles. They are not automatically upgraded when Brand Workspace opens or when the adapter reads them.

Invalid or unknown `moduleType` values are ignored for type resolution and do not become trusted module definitions.

## Board Copy Limitation

This PR does not solve Board-copy identity semantics. Existing Board duplicate behavior may preserve copied Custom Tile instance IDs and `moduleType` values in `brand_core_snapshot`.

Preserving `moduleType` is expected because the module kind remains the same. Regenerating copied module instance IDs remains a dedicated future PR.

## Files Changed

- `app.js`
- `knowledge-module-runtime-adapter.js`
- `docs/audits/2026-07-13-knowledge-module-type-metadata-implementation-audit.md`

## Runtime Confirmation

This PR does not intentionally modify:

- Brand Workspace layout
- sticky editor behavior
- natural scrolling
- built-in Brand Core module storage
- Custom Tile UI
- stable ID behavior for new manual tiles
- Custom Tile delete integrity
- contextual Missing Knowledge UI structure
- Brand DNA
- Brand Avatar
- Website Analysis
- reset flow
- Dashboard UI
- Boards UI/API behavior
- Canvas
- AI Brain
- Insights
- save/load keys
- autosave
- routing
- DOM IDs
- unrelated event handlers

## Risks

- Mixed typed and untyped tiles require duplicate prevention to keep both paths compatible.
- A user can edit a typed tile title to no longer match the registry label; this is intentional and documented, but may be visually surprising until specialized module UI exists.
- Invalid legacy `moduleType` values must be ignored rather than trusted.
- Copied board snapshots may preserve instance IDs until copy-regeneration semantics are implemented.
- Dashboard Brand Evolution still uses broader existing text search in addition to typed tile detection, so text-only references can still mark an item present as before.

## Rollback

Rollback steps:

1. Revert the Missing Knowledge creation change that writes `moduleType`.
2. Revert duplicate-prevention preference for `moduleType`.
3. Revert adapter persisted-`moduleType` preference.
4. Leave existing typed tiles in storage; older code will ignore the optional `moduleType` field and continue to treat them as Custom Tiles.

## Manual QA

### A. Typed Missing Knowledge creation

1. Open Brand Workspace where all five modules are missing.
2. Create Founder Story.
3. Confirm exactly one tile is created.
4. Inspect runtime/state and confirm valid `km_` ID, `moduleType === "founder_story"`, and `title === "Founder Story"`.
5. Reload.
6. Confirm ID and `moduleType` persist.
7. Repeat for `market_research`, `business_plan`, `pitch_deck`, and `whitepaper`.
8. Confirm each has a unique instance ID and correct `moduleType`.

### B. Duplicate prevention

1. Trigger Founder Story creation again.
2. Confirm no duplicate is created.
3. Confirm the existing typed tile opens.
4. Test a legacy Founder Story tile without `moduleType`.
5. Confirm Add Tile selects the legacy tile rather than creating a typed duplicate.

### C. Manual Custom Tile

1. Create a manual tile called “Research Ideas”.
2. Confirm it has a stable ID.
3. Confirm it has no canonical `moduleType`.
4. Rename it to “Market Research”.
5. Confirm it is not silently reclassified during ordinary editing.
6. Confirm explicit Missing Knowledge creation follows the documented legacy-title fallback and does not create a duplicate.

### D. Editing

1. Edit a typed tile title and content.
2. Confirm ID remains unchanged.
3. Confirm `moduleType` remains unchanged.
4. Reload and confirm both persist.

### E. Deletion

1. Delete Market Research.
2. Confirm exactly that tile disappears.
3. Confirm Missing Knowledge suggests Market Research again when no text-only fallback marks it present.
4. Recreate it.
5. Confirm a new instance ID and `moduleType: "market_research"`.

### F. Adapter

1. Inspect runtime adapter views.
2. Confirm persisted `moduleType` is preferred.
3. Confirm legacy canonical-title fallback still works.
4. Confirm unrelated custom tiles resolve to `custom`.
5. Confirm adapter reads do not mutate source state.

### G. Regression

1. Confirm old no-ID/no-`moduleType` tiles still work.
2. Confirm ID-backed untyped tiles still work.
3. Confirm Brand DNA works.
4. Confirm Brand Avatar works.
5. Confirm Website Analysis works.
6. Confirm sticky editor and scrolling work.
7. Confirm Dashboard, Boards, Canvas, AI Brain, and Insights remain unchanged.
8. Confirm no `custom:0` corruption.
9. Confirm no console errors.
