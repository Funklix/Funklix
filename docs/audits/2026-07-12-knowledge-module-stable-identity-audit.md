# Knowledge Module Stable Identity Audit

| Field | Value |
|---|---|
| Date | 2026-07-12 |
| Type | Documentation-only stable identity architecture audit |
| Scope | Backward-compatible identity model for future Knowledge Module instances |
| Runtime behavior changes | None |
| Files changed | `docs/audits/2026-07-12-knowledge-module-stable-identity-audit.md` |

## Executive Summary

Funklix now has a Knowledge Module Registry and a read-only runtime adapter, but legacy custom tiles are still persisted as array entries and addressed at runtime by `custom:{index}`. That index-derived identity is useful for the current editor but is not safe as a canonical persisted identity for future typed modules, attachments, AI actions, history, review state, search, or Knowledge Graph projection.

This audit recommends the smallest safe path: introduce an optional persisted **module instance ID** field named `id` on custom tile objects in a future implementation PR. The ID should identify one persisted custom/knowledge module instance inside the current board-scoped Brand Core snapshot. It must be distinct from the **module type ID** such as `market_research`, `pitch_deck`, or `custom`.

No code is implemented in this PR. This audit does not modify Brand Workspace, Brand Core state, custom tile behavior, registry, runtime adapter, storage, snapshots, APIs, save/load, autosave, UI, DOM IDs, or event handlers.

## Current Identity Model

### Current `state.brandCore.customTiles` shape

Custom tiles currently persist as array objects with this effective shape:

```js
{
  title: string,
  content: string,
  items?: array
}
```

They do not currently have persisted IDs, module type metadata, status, readiness, history, attachments, or source metadata.

### Current custom tile creation flow

The manual Add Custom Tile flow is driven by selecting `custom:add`. The editor pushes:

```js
{ title: "New Custom Tile", content: "", items: [] }
```

Then it selects the new tile using:

```text
custom:{state.brandCore.customTiles.length - 1}
```

### Current Missing Knowledge tile creation flow

The Missing Knowledge shortcut flow creates a canonical custom tile only when no matching valid tile exists:

```js
{ title: canonicalTitle, content: "", items: [] }
```

The canonical title currently resolves from the registry-backed Missing Knowledge allowlist:

- Founder Story
- Market Research
- Business Plan
- Pitch Deck
- Whitepaper

### Current custom tile selection/editing identity

Custom tile editor selection uses `state.brandCoreSelectedKey` with a runtime key:

```text
custom:{index}
```

The editor parses the number after `custom:` and accesses `state.brandCore.customTiles[index]`.

### Current deletion/update behavior

The custom tile delete flow now removes exactly the selected index with `filter(...)`, resets selection to `brandCore`, saves through `saveBrandBrainState()`, and rerenders both tiles and editor.

Title/content editing mutates the selected tile object and calls `saveBrandBrainState()`.

### Current custom tile section grouping

Custom tile visual grouping is title/registry driven:

- exact canonical Missing Knowledge titles route to Strategy, Intelligence, or Deployment.
- unrelated custom tiles render in Custom Knowledge.
- malformed generated placeholders such as empty `custom:0` are skipped by render guards.

### Current `custom:{index}` runtime keys

`custom:{index}` appears in three roles today:

1. DOM `data-bc-key` for custom cards.
2. `state.brandCoreSelectedKey` for custom editor selection.
3. Runtime adapter `runtimeKey` / `sourceReference.runtimeKey` fallback.

This is a runtime locator, not a persisted identity.

## Dependency Map

| Area | Current dependency | Identity risk |
|---|---|---|
| Manual custom creation | pushes a new array item | new item gets identity only by index |
| Missing Knowledge creation | pushes canonical title tile if absent | title prevents duplicates but is not identity |
| Custom editor selection | parses `custom:{index}` | insertion/deletion can shift targets |
| Custom deletion | filters by selected index | wrong tile risk if stale selection/index mismatch returns |
| Custom rendering | emits `data-bc-key="custom:{index}"` | DOM identity changes when order changes |
| Section grouping | title-based canonical matching | title changes affect placement |
| Save path | serializes `state.brandCore` | no persisted ID survives reload today |
| Local storage | stores JSON Brand Core state | legacy tiles reload without IDs |
| Board snapshot | stores `brand_core_snapshot` | copied snapshots preserve current shape |
| Runtime adapter | exposes `runtimeKey` and `sourceReference` | correctly labels identity as runtime-only |
| Reset Brand Core | restores default state | clears custom tiles and future IDs |
| Board duplicate | posts current `brand_core_snapshot` | future IDs need explicit copy semantics |

## Index-Based Risks

Index-derived identity is fragile because the index describes position, not the object.

Main risks:

- wrong tile edited after insertion/deletion
- wrong tile deleted after stale selection
- runtime adapter lookup changes after array order changes
- future attachments/history pointing to the wrong tile
- Knowledge Graph references breaking when custom tile order changes
- duplicate prevention relying too heavily on title strings
- copied boards sharing or shifting ambiguous identities
- custom tile corruption if index fallback objects leak into rendering

The recent custom tile bugfix reduced visible corruption by cleaning stale DOM and validating selected indices, but it did not make index identity stable.

## Target Identity Model

### Canonical persisted module instance field

Recommend a persisted optional custom tile field:

```js
id: "km_<uuid>"
```

Use `id`, not `moduleId`, for the persisted instance ID because `moduleId` is too easy to confuse with the module type.

### Module Type vs Module Instance

| Concept | Meaning | Example | Persistence timing |
|---|---|---|---|
| Module Type ID | What kind of module this is | `market_research`, `pitch_deck`, `custom` | Later typed-module PR |
| Module Instance ID | One specific saved module/tile instance | `km_1d3c...` | First stable identity PR |

Do not conflate these. A module type may have many instances over time. A module instance must remain stable through edits, reloads, and reorder operations.

## Recommended Stored Shape

### Future full shape under consideration

```js
{
  id: "km_...",
  moduleType: "market_research",
  title: "Market Research",
  content: "",
  items: [],
  metadata: {}
}
```

### Minimum first implementation shape

For the first identity implementation PR, use only:

```js
{
  id: "km_...",
  title: "Market Research",
  content: "",
  items: []
}
```

Rationale:

- `id` solves stable instance identity.
- `title`, `content`, and `items` preserve existing behavior.
- `moduleType` should remain optional until typed module migration is approved.
- `metadata` should not be added speculatively in the identity PR.
- Built-in Brand Core fields should not be forced into `customTiles`.

## ID Generation Recommendation

Recommend a single shared helper in the future implementation PR:

```js
createKnowledgeModuleInstanceId()
```

Recommended format:

```text
km_<uuid>
```

Recommended generation:

1. Prefer `crypto.randomUUID()` when available.
2. Fallback to a dependency-free random/timestamp helper only when `crypto.randomUUID()` is unavailable.
3. Keep the `km_` prefix to distinguish Knowledge Module instance IDs from board IDs, node IDs, module type IDs, and DOM keys.

Fallback guidance:

- Use browser `crypto.getRandomValues()` if available.
- In Node tests, use global `crypto.randomUUID()` when available.
- Avoid adding a dependency solely for ID generation.
- Avoid plain `Date.now()` only; timestamp-only IDs are too collision-prone.

Do not implement this helper in the audit PR.

## Legacy Compatibility Strategy

### Options evaluated

| Option | Description | Pros | Cons | Recommendation |
|---|---|---|---|---|
| A | Assign IDs lazily in memory; persist after next legitimate tile edit/save | avoids aggressive rewrite | identity may not survive reload until persisted | good transitional behavior |
| B | Assign and persist IDs during Brand Core hydration | fast normalization | mutates saved data on load and may mark dirty unexpectedly | not first PR |
| C | Dedicated one-time migration | clean end state | high blast radius and data-loss risk | not now |
| D | Support both stable IDs and `custom:{index}` indefinitely during transition | safest compatibility | more lookup complexity | recommended |

### Recommended strategy

Use **Option D with selective Option A**:

1. New custom tiles get `id` immediately when created.
2. Existing legacy tiles without IDs remain valid and use `custom:{index}` fallback.
3. Selection/update/delete should prefer `id` when present, with index fallback for old tiles.
4. Do not bulk-migrate legacy tiles in the first PR.
5. Do not assign/persist IDs during generic hydration.
6. If a legacy tile is legitimately edited in a later PR, it may receive an ID as part of that user-initiated save.
7. Malformed `custom:0` cleanup remains separate and should not be conflated with ID migration.

This avoids duplicate tiles, data loss, aggressive global rewrites, and ID regeneration on every load.

## Built-In vs Custom Identity

### 1. Built-in Brand Core modules

Built-ins are currently addressed by stable state keys such as:

- `brandCore`
- `valueProposition`
- `personas`
- `brandAssets`
- `brandDNA`

They do not need persisted instance IDs in the first identity PR. Their identity can remain the registry runtime state key because they are singleton fields inside Brand Core state.

### 2. Legacy custom tiles

Legacy custom tiles need stable persisted instance IDs because they can be inserted, deleted, reordered, duplicated, adapted into typed modules, attached to files, or referenced by future history/search/graph systems.

### 3. Canonical Missing Knowledge modules

For current board-scoped Brand context, canonical Missing Knowledge modules should behave as one instance per type unless the registry says `allowMultiple: true`.

For the initial identity PR:

- continue duplicate prevention by canonical title for legacy compatibility.
- once `moduleType` is introduced later, duplicate prevention should use module type rules, not title alone.

### 4. Future repeatable modules

Repeatable module types, such as future competitor reports or research runs, need distinct module instance IDs. Child records such as Research Runs should have their own child IDs and should not reuse the parent module instance ID.

## Copy / Duplicate Semantics

### Current transitional board-scoped behavior

Today, duplicating a board sends the current canvas and `brand_core_snapshot` to create a separate board copy. Once custom tile instance IDs exist, copied boards should be treated as separate board-scoped module containers.

Recommendation for board duplicates during the board-scoped phase:

- **Generate new module instance IDs for custom tiles in duplicated board snapshots.**
- Preserve titles/content/items.
- Do not preserve custom tile IDs across duplicated boards unless the module is explicitly Brand-owned outside the board snapshot.

Reason:

- Board snapshots are separate copies.
- Future history/attachments/graph projections could otherwise confuse modules from two boards.
- Copying should duplicate content, not identity, for board-scoped modules.

### Future Brand-level behavior

When modules become Brand-owned outside individual board snapshots:

- Brand-owned module instance IDs should be preserved across boards because they refer to the same canonical Brand knowledge.
- Board-specific module copies should still receive new instance IDs.
- The product will need explicit clone vs reference semantics.

## Persistence Round Trip

### Create acceptance criteria

```text
create custom tile
→ generate id once
→ store id on tile object
→ saveBrandBrainState()
→ local storage / brand_core_snapshot
→ reload
→ same id present
```

### Edit acceptance criteria

- editing title/content/items preserves the same `id`.
- editing a legacy no-ID tile may assign an ID once, then preserve it.

### Delete acceptance criteria

- delete resolves the selected tile by `id` when present.
- exactly that ID is removed.
- selection resets safely.
- no empty placeholder or `custom:0` card remains.

### Reorder acceptance criteria

- array order may change in the future, but IDs remain unchanged.
- adapter/runtime lookup should not depend on order when IDs exist.

### Duplicate prevention acceptance criteria

- initial PR can preserve existing canonical title matching.
- typed-module PR should move duplicate prevention toward `moduleType` and `allowMultiple` rules.
- instance ID alone should never be used to decide whether a canonical module may be duplicated.

### Board copy acceptance criteria

- transitional board-scoped duplicate should generate new IDs for copied custom tile instances.
- copied content remains intact.
- original board IDs remain unchanged.

### Reset acceptance criteria

- reset returns default Brand Core state.
- no stale custom tile IDs remain after reset.

## Adapter Implications

Do not modify the adapter in this audit. Future implementation should update it as follows:

### `runtimeKey`

Preferred future behavior:

1. use `tile.id` when present for custom tile views.
2. fall back to `custom:{index}` for legacy no-ID tiles.
3. built-in modules continue using state keys.

### `sourceReference`

Future custom source reference should include:

```js
{
  id: tile.id || null,
  runtimeKey,
  customTileIndex
}
```

### `getKnowledgeModuleRuntimeViewByKey()`

Future lookup should support:

- stable custom tile ID
- legacy `custom:{index}` fallback
- built-in state keys

### Section filtering

Section filtering can remain unchanged because it uses module metadata and section strings, not identity.

### Known module resolution

Known module resolution should eventually prefer persisted `moduleType` when present, then fallback to exact canonical title matching for legacy tiles.

### Debug output

Debug output should clearly show:

- `runtimeKey`
- `id` if present
- `moduleType` if present/resolved
- `sourceType`
- `legacyFallback: true` for no-ID tiles

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Duplicate IDs | two modules could share references | central helper and collision-aware fallback |
| IDs regenerated on reload | breaks attachments/history/graph | generate once and persist |
| Index and ID systems disagree | wrong tile edited/deleted | prefer ID, fallback to index only for legacy |
| Wrong tile edited/deleted | user data loss | resolve by ID before index, validate target |
| Snapshot compatibility | old boards lack IDs | optional field and legacy fallback |
| Copied boards sharing IDs | cross-board confusion | regenerate IDs for board-scoped duplicates |
| Custom tile corruption | repeats recent `custom:0` bug | no sparse arrays, no placeholder objects, full rerender |
| Title/moduleType confusion | wrong duplicate prevention | distinguish module type vs instance ID |
| Premature built-in migration | broad state changes | leave built-ins as state-key identities for now |
| Graph references before identity stable | broken graph links | no Knowledge Graph projection until IDs settle |
| Multiple identity helpers | inconsistent IDs | one shared `createKnowledgeModuleInstanceId()` helper |

## Recommended PR Sequence

### PR 1 — Stable ID helper + new custom tile IDs

Scope:

- add one shared `createKnowledgeModuleInstanceId()` helper.
- add optional `id` to newly created custom tiles only.
- manual `custom:add` and Missing Knowledge creation use the helper.
- selection/update/delete prefer `id` when present, with `custom:{index}` fallback.
- runtime adapter exposes `id` when present.
- no bulk migration.
- no `moduleType` persistence.
- no UI changes.

Risk:

- medium, because custom tile selection/delete logic is touched.

Non-goals:

- no typed modules
- no board-copy ID regeneration yet unless included as a tightly scoped helper
- no built-in module migration
- no storage schema rewrite

### PR 2 — Lazy legacy ID persistence on edit

Scope:

- if a legacy no-ID custom tile is edited, assign an ID during that legitimate save.
- no load-time rewrite.

### PR 3 — Board duplicate ID semantics

Scope:

- when duplicating a board, clone `brand_core_snapshot.customTiles` content but generate new custom tile IDs for the copied board.
- original board remains unchanged.

### PR 4 — Optional `moduleType` for canonical custom tiles

Scope:

- add optional `moduleType` for canonical Missing Knowledge modules.
- adapter prefers `moduleType` over title matching.
- duplicate prevention moves toward registry `allowMultiple` rules.

### PR 5 — Typed Module migration audit and first typed module MVP

Scope:

- implement one typed module after IDs and moduleType are stable.

### PR 6 — Child records such as Research Runs

Scope:

- define child identity separate from parent module identity.
- no child record should reuse the parent module instance ID.

## Immediate Next Implementation PR

Recommended next PR:

**Knowledge Module Runtime Phase 4 — Stable ID on New Custom Tiles**

Smallest safe scope:

- add one shared ID helper.
- add `id` only to newly created custom tiles.
- update manual Add Custom Tile and Missing Knowledge creation paths.
- update custom tile selection/delete to prefer ID where present and retain index fallback.
- update runtime adapter to include `id` and use it as custom `runtimeKey` when present.
- no bulk migration.
- no moduleType persistence.
- no UI changes.
- no API or snapshot shape changes beyond optional JSON field naturally carried in `customTiles`.

## Runtime Confirmation

This audit does **not** modify:

- Brand Workspace
- Brand Core state
- custom tile creation
- custom tile deletion
- custom tile rendering
- editor behavior
- registry
- runtime adapter
- local storage
- Board snapshots
- save/load
- autosave
- APIs
- Dashboard
- Boards
- Canvas
- AI Brain
- Insights
- DOM IDs
- event handlers
- routing

## Manual QA Plan

Because this PR is documentation-only, manual QA is repository/documentation verification:

1. Confirm `docs/audits/2026-07-12-knowledge-module-stable-identity-audit.md` exists.
2. Confirm no runtime files changed.
3. Confirm the audit distinguishes module type ID from module instance ID.
4. Confirm the audit recommends optional `id` as the first persisted field.
5. Confirm the audit preserves legacy no-ID tiles.
6. Confirm the audit documents board duplicate semantics.
7. Confirm the audit documents adapter implications.
8. Confirm runtime confirmation lists all non-modified surfaces.
