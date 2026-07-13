# Knowledge Module Runtime Adapter Audit

| Field | Value |
|---|---|
| Date | 2026-07-12 |
| Type | Read-only legacy tile adapter audit and implementation record |
| Scope | Passive Knowledge Module runtime views derived from existing Brand Core and custom tile state |
| Runtime behavior changes | None intended; adapter is read-only and not used by render/editor/persistence flows |
| Files changed | `knowledge-module-runtime-adapter.js`, `knowledge-module-registry.js`, `index.html`, `app.js`, `docs/audits/2026-07-12-knowledge-module-runtime-adapter-audit.md` |

## Summary

This PR introduces a standalone, passive **Knowledge Module Runtime Adapter**. The adapter creates normalized read-only module view objects from existing Brand Core state and legacy custom tiles.

The adapter does not replace Brand Core state, migrate custom tiles, write module metadata into storage, add persistent IDs, change rendering, change editor behavior, change persistence, change snapshots, change APIs, or activate capabilities.

Existing Brand Core and custom tile state remain authoritative. The adapter is only a compatibility/read layer for future renderers, editors, AI actions, uploads, search, readiness, history, and Knowledge Graph projection.

## Dependency Audit Findings

### 1. Current `state.brandCore` shape

Current Brand Core state remains board-scoped and contains built-in fields plus `customTiles`:

- `brandCore`
- `toneOfVoice`
- `messagingPillars`
- `valueProposition`
- `personas`
- `contentGuidelines`
- `dosAndDonts`
- `brandVoiceExamples`
- `keywords`
- `brandAssets`
- `brandDNA`
- `customTiles`

Risk:

- High if the adapter writes back to this object or normalizes values in-place.

Decision:

- Adapter helpers clone view content and never mutate `brandCoreState`.

### 2. Current `state.brandCore.customTiles` shape

Legacy custom tiles still use:

```js
{
  title: string,
  content: string,
  items?: array
}
```

Risk:

- High if the adapter adds `moduleType`, IDs, section metadata, status, readiness, or history to saved tiles.

Decision:

- Adapter returns wrapper/view objects only.
- Source tiles remain unchanged.

### 3. Current built-in Brand Core key-to-registry mapping

The previous runtime adoption PR introduced a Brand Core key-to-registry ID mapping inside `app.js`.

Risk:

- Medium if the adapter introduces a competing duplicate map.

Decision:

- The mapping has been moved into registry metadata as `runtimeStateKeys`.
- `app.js` now asks the registry for definitions by runtime state key.
- The adapter uses the same registry metadata, avoiding a second map.

### 4. Current custom tile identity mechanism

Custom tile runtime identity remains:

```text
custom:{index}
```

Risk:

- High if the adapter claims this is a stable persistent module ID.

Decision:

- Adapter exposes `runtimeKey: "custom:{index}"` and `sourceReference.customTileIndex` only.
- The audit and view shape label this as legacy/runtime-only identity.

### 5. Current custom tile title, content, and section behavior

Custom tile behavior remains:

- exact canonical Missing Knowledge titles can render in Strategy, Intelligence, or Deployment.
- unrelated custom tiles render as Custom.
- user-entered titles and content remain authoritative.

Risk:

- Medium if the adapter fuzzy-matches titles or reinterprets unrelated tiles.

Decision:

- Adapter uses exact normalized canonical matching only for Founder Story, Market Research, Business Plan, Pitch Deck, and Whitepaper.
- A tile titled `Research Ideas` remains `moduleType: "custom"`.

### 6. Current Missing Knowledge-created tile shape

Missing Knowledge actions currently create:

```js
{ title: canonicalTitle, content: "", items: [] }
```

Risk:

- High if the adapter assumes module metadata is saved on those tiles.

Decision:

- Adapter resolves known suggested modules from title only and does not write resolved type back to the tile.

### 7. Current custom tile editor selection

The editor still selects custom tiles by `custom:{index}`.

Risk:

- High if adapter runtime keys are used to change editor selection.

Decision:

- Adapter runtime keys mirror existing selection keys for compatibility but are not connected to editor behavior.

### 8. Current `saveBrandBrainState()` path

Brand Brain persistence still serializes `state.brandCore` through existing snapshot/local storage paths.

Risk:

- High if adapter views are persisted or injected into Brand Core state.

Decision:

- Adapter never calls `saveBrandBrainState()`.
- Adapter is not referenced by save/load code.

### 9. Current Board snapshot serialization and hydration

Board snapshots continue to serialize `brand_core_snapshot` from normalized Brand Core state.

Risk:

- High if module views are added to snapshots before a migration plan.

Decision:

- Adapter output is not serialized.
- No snapshot shape changes are included.

### 10. Current registry helpers and browser-global exposure

The registry exposes:

- CommonJS exports
- `window.KnowledgeModuleRegistry`
- `getModuleDefinition()`
- `getModulesForSection()`
- `isKnownModule()`
- `getModuleCategory()`
- `getModuleDefinitionForRuntimeStateKey()`

Risk:

- Low for a read-only adapter that consumes these helpers.

Decision:

- Adapter supports CommonJS and browser-global access like the registry.

### 11. Existing normalized display helpers

No existing helper currently produces normalized Knowledge Module runtime view objects.

Existing helpers produce narrower models:

- Dashboard Brand signals
- Dashboard Missing Knowledge status
- Brand Workspace Missing Knowledge sections
- Brand Core editor/render previews

Decision:

- Add a standalone adapter rather than extending render/editor helpers.

### 12. Potential accidental mutation points

Mutation could happen if future consumers modify:

- returned content objects/arrays
- returned registry metadata
- returned capabilities arrays
- source custom tile references

Decision:

- Adapter returns newly constructed frozen view objects.
- Adapter clones object/array content.
- Adapter clones definition/capability arrays.
- Adapter source references contain locator metadata only, not source object references.

### 13. Safest insertion point

The safest insertion point is a standalone file:

```text
knowledge-module-runtime-adapter.js
```

It is loaded after the registry and before `app.js` to make the read-only browser global available for future/debug use, but `app.js` does not depend on it for rendering, editing, saving, loading, or event handling.

## Existing State Sources

The adapter reads only from a caller-provided Brand Core state object and registry metadata.

It adapts:

- built-in Brand Core fields identified by registry `runtimeStateKeys`
- legacy custom tiles in `customTiles`

It does not read directly from localStorage, board snapshots, APIs, DOM nodes, editor elements, or Canvas state.

## Adapter Boundary

The adapter boundary is:

```text
Existing Brand Core / Custom Tile State
↓
Read-only Runtime Adapter
↓
Normalized Knowledge Module View
↓
Future consumers
```

The adapter never becomes a source of truth. It only creates runtime views.

## Normalized Module View Shape

Each view uses this shape:

```js
{
  runtimeKey,
  sourceType,
  moduleType,
  definition,
  title,
  content,
  section,
  category,
  capabilities,
  sourceReference,
  isKnownModule,
  isLegacy,
  isCustom,
  isPersisted
}
```

### Field notes

- `runtimeKey` is current-runtime identity only.
- `sourceType` is `built-in` or `custom-tile`.
- `moduleType` is a registry ID when conservatively known, or `custom`.
- `definition` is cloned registry metadata.
- `title` preserves current visible/source title.
- `content` is cloned from existing source content where needed.
- `section` comes from registry metadata for known modules or Custom fallback.
- `category` comes from registry metadata.
- `capabilities` are metadata only and do not activate logic.
- `sourceReference` stores locators, not source object references.
- `isKnownModule` is true only for known registry-backed non-custom module types.
- `isLegacy` is true because current views adapt existing state.
- `isCustom` is true for custom tile sources.
- `isPersisted` reports whether the source exists in the provided state only.

## Known Module Resolution

Known custom tile titles resolve only when they exactly match a canonical registry label after conservative normalization:

- Founder Story
- Market Research
- Business Plan
- Pitch Deck
- Whitepaper

Rules:

- trim whitespace
- collapse internal whitespace
- compare case-insensitively
- no fuzzy matching
- no semantic matching
- no inference from related words

Examples:

| Custom tile title | Adapter moduleType |
|---|---|
| `Founder Story` | `founder_story` |
| ` founder story ` | `founder_story` |
| `MARKET RESEARCH` | `market_research` |
| `Research Ideas` | `custom` |
| `Pitch Deck Notes` | `custom` |

## Legacy Identity Handling

The adapter does not introduce stable persistent module IDs.

Built-in views use existing Brand Core state keys, such as:

- `brandCore`
- `valueProposition`
- `personas`
- `brandAssets`

Custom views use existing runtime identities:

- `custom:0`
- `custom:1`
- `custom:2`

These keys are runtime/source locators only. Stable module identity remains a future migration PR.

## No-Mutation Guarantee

Adapter helpers:

- return new wrapper/view objects
- freeze returned view objects
- clone registry definitions
- clone capability arrays
- clone object/array content values
- do not save
- do not render
- do not call APIs
- do not trigger events
- do not mutate Brand Core state
- do not mutate custom tiles

## Files Changed

- `knowledge-module-runtime-adapter.js`
  - adds the standalone read-only adapter and helpers.
  - exposes CommonJS and `window.KnowledgeModuleRuntimeAdapter`.

- `knowledge-module-registry.js`
  - adds read-only `runtimeStateKeys` metadata for built-in Brand Core modules.
  - adds `getModuleDefinitionForRuntimeStateKey()`.

- `app.js`
  - removes the local built-in Brand Core key map and reads it through registry metadata instead.
  - does not import/use the adapter for rendering or editor behavior.

- `index.html`
  - loads `knowledge-module-runtime-adapter.js` after the registry and before `app.js`.

- `docs/audits/2026-07-12-knowledge-module-runtime-adapter-audit.md`
  - documents this audit and implementation.

## Future Consumers

Future PRs may use the adapter for:

- Typed Module migration
- specialized module cards
- specialized editors
- AI module actions
- attachments
- module history
- search
- readiness
- Knowledge Graph projection

Those consumers are intentionally not connected in this PR.

## Runtime Confirmation

This PR does **not** change:

- Brand Workspace layout
- Brand Workspace sections
- sticky editor
- custom tile creation
- custom tile duplicate prevention
- custom tile deletion
- custom tile rendering
- custom tile section grouping
- built-in Brand Core editors
- Brand DNA
- Brand Avatar
- Website Analysis
- Missing Knowledge actions
- Dashboard Brand Evolution
- Brand Brain persistence
- Board snapshots
- save/load
- autosave
- routing
- Canvas
- Boards
- AI Brain
- Insights
- DOM IDs
- event handlers

## Risks

### Adapter misuse

Risk:

- Future code may treat adapter runtime keys as persistent IDs.

Mitigation:

- Runtime keys are documented as legacy/runtime-only.
- Stable IDs require a future dedicated migration PR.

### Registry metadata drift

Risk:

- Changing registry labels/sections can affect adapter classification.

Mitigation:

- Known custom tile resolution is limited to the five canonical module IDs.
- Future label/section changes require scoped QA.

### Debug/runtime load order

Risk:

- Adapter expects registry access for full metadata resolution.

Mitigation:

- `index.html` loads registry first.
- CommonJS smoke tests require the registry directly.

## Rollback

Rollback steps:

1. Remove `knowledge-module-runtime-adapter.js`.
2. Remove its script tag from `index.html`.
3. Revert `runtimeStateKeys` / `getModuleDefinitionForRuntimeStateKey()` additions in `knowledge-module-registry.js`.
4. Restore the previous local Brand Core key map in `app.js`.
5. Delete this audit document.

No storage, snapshot, API, localStorage, data migration, or persistence rollback is required.

## Manual QA

1. Open Brand Workspace.
2. Confirm every built-in Brand Core card renders exactly as before.
3. Confirm all custom tiles render exactly as before.
4. Confirm Missing Knowledge creation still works.
5. Confirm Delete Tile still works.
6. Confirm custom tile editing and reload persistence still work.
7. Confirm Brand DNA works.
8. Confirm Brand Avatar works.
9. Confirm Website Analysis works.
10. If using the adapter from the console, call `window.KnowledgeModuleRuntimeAdapter.getKnowledgeModuleRuntimeViews(window.getBrandCoreData())` and confirm:
    - built-in modules have registry-backed `moduleType` values.
    - canonical Founder Story / Market Research / Business Plan / Pitch Deck / Whitepaper tiles resolve correctly.
    - unrelated custom titles remain `moduleType: "custom"`.
    - source Brand Core/custom tile state remains unchanged after the call.
11. Confirm Dashboard unchanged.
12. Confirm Boards unchanged.
13. Confirm Canvas unchanged.
14. Confirm AI Brain unchanged.
15. Confirm no console errors.
