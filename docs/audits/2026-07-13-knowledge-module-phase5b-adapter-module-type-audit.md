# Knowledge Module Phase 5B — Adapter moduleType Resolution Audit

## Summary

Phase 5B updates only the read-only Knowledge Module Runtime Adapter so Custom Tile runtime views prefer a valid persisted `customTile.moduleType` before falling back to legacy canonical-title matching and then the `custom` registry definition. The adapter remains passive infrastructure: it does not mutate Brand Core state, does not write `moduleType`, does not save, does not render, and is not activated for current product behavior.

## Dependency Findings

1. The current Custom Tile adapter function is `adaptCustomTileToKnowledgeModule(tile, index, options = {})` in `knowledge-module-runtime-adapter.js`.
2. Before this change, exact canonical-title resolution used `getKnownCustomTileDefinition(tileTitle, registryApi)`, which normalizes whitespace/case and compares only against the five `KNOWN_CUSTOM_TILE_MODULE_IDS` registry labels.
3. The current Custom fallback uses `resolveCustomDefinition(registryApi)`, which reads `registry.getModuleDefinition("custom")`.
4. Registry helpers available for validation are `getModuleDefinition(moduleId)`, `isKnownModule(moduleId)`, `getModuleCategory(moduleId)`, and `getModuleDefinitionForRuntimeStateKey(stateKey)`. This change uses the existing `getModuleDefinition(moduleId)` helper so registry normalization and known-module validation remain centralized in the registry.
5. Current normalized Custom Tile runtime view fields include `moduleType`, `definition`, `section`, `category`, `capabilities`, and `isKnownModule`, along with `runtimeKey`, `sourceType`, `title`, `content`, `sourceReference`, `isLegacy`, `isCustom`, and `isPersisted`.
6. Stable ID behavior currently uses `custom-id:<id>` when `KnowledgeModuleIdentity.isKnowledgeModuleInstanceId(tile.id)` accepts the persisted ID, otherwise `custom:<index>`. The `sourceReference` includes `runtimeKey`, `id`, `customTileIndex`, and `legacyRuntimeOnly`.
7. The adapter has hardened CommonJS/browser-global guards: it requires registry and identity modules only when `module.exports` is present and `require` is a function, otherwise browser globals are used.
8. `app.js` does not currently consume `KnowledgeModuleRuntimeAdapter` output for rendering, duplicate prevention, Missing Knowledge detection, editor selection, or persistence. Repository search found `KnowledgeModuleRuntimeAdapter` references only in `knowledge-module-runtime-adapter.js`; app behavior continues to use its existing Brand Core and Custom Tile paths.
9. No `app.js` change is required. This PR changes adapter interpretation only.

## Existing Adapter Resolution

Before Phase 5B, Custom Tile module resolution was:

1. Exact canonical-title match against the five known Missing Knowledge module labels.
2. `custom` registry fallback when no canonical title matched.

`tile.moduleType` was ignored even when present.

## New Resolution Order

Custom Tile module resolution is now:

1. Valid persisted `tile.moduleType` that resolves through `registry.getModuleDefinition(tile.moduleType)`.
2. Existing exact normalized canonical-title fallback through `getKnownCustomTileDefinition(tile.title, registry)`.
3. `custom` registry fallback through `resolveCustomDefinition(registry)`.

## Valid moduleType Handling

When `tile.moduleType` is a string and resolves to a known registry definition, that definition is authoritative for adapter type interpretation. The returned runtime view uses:

- `moduleType: definition.id`
- `definition` cloned from that registry definition
- `section`, `category`, and `capabilities` from that registry definition
- `isKnownModule: true` for non-`custom` known module definitions

The source tile is not modified.

## Invalid moduleType Fallback

If `tile.moduleType` is absent, non-string, unknown, or otherwise does not resolve through the registry, the adapter does not throw and does not trust it. It falls back to legacy canonical-title matching and then to `custom`.

Examples:

- `{ moduleType: "unknown_type", title: "Market Research" }` resolves to `moduleType: "market_research"` through the existing title fallback.
- `{ moduleType: "unknown_type", title: "Research Ideas" }` resolves to `moduleType: "custom"` through the Custom fallback.

## Title / Type Conflict Rule

When a valid persisted `moduleType` conflicts with the visible title, the valid persisted type wins for adapter interpretation and the title remains untouched.

Example:

```js
{
  moduleType: "market_research",
  title: "Competitor Notes"
}
```

The adapter returns a view whose type/definition/section/category/capabilities are based on `market_research`, while `title` remains `Competitor Notes`. The adapter does not overwrite title, normalize the source `moduleType`, or synchronize fields.

## Legacy Compatibility

Legacy tiles without `moduleType` still resolve exactly as before by canonical title. Untyped unrelated tiles still resolve to `custom`. Existing `custom-id:<id>` and `custom:<index>` runtime keys are unchanged, as are `sourceReference.id`, `sourceReference.customTileIndex`, and `sourceReference.legacyRuntimeOnly`.

## No-Mutation Confirmation

The adapter constructs frozen runtime view wrappers and clones definition/capability data. It does not write to the source Custom Tile object, assign IDs, save Brand state, call APIs, render UI, trigger events, or update persistence.

## Files Changed

- `knowledge-module-runtime-adapter.js`
- `docs/audits/2026-07-13-knowledge-module-phase5b-adapter-module-type-audit.md`

## Runtime Confirmation

The implementation preserves the existing browser-global/CommonJS boundary and changes only adapter definition resolution. The required syntax, browser integrity, browser-global compatibility, smoke, and scope checks passed.

## Risks

- Future consumers of the adapter may begin observing typed views for renamed canonical tiles that carry a valid persisted `moduleType`; this is intended but currently passive.
- A persisted valid non-canonical registry ID on a Custom Tile would now be interpreted as that known registry module type by the adapter. This follows the stated valid-registry-definition rule and does not change saved state or UI behavior.

## Rollback

Rollback by reverting the `knowledge-module-runtime-adapter.js` resolution change and removing this audit document. Because the adapter is read-only and no persisted state is migrated or rewritten, no data cleanup is required.

## Manual QA

A. Typed tile

1. Create or load a canonical Market Research tile from Phase 5A.
2. Inspect the runtime adapter view.
3. Confirm:
   - `moduleType === "market_research"`
   - `definition.id === "market_research"`
   - `isKnownModule` is true
   - section/category/capabilities come from registry
   - title remains the persisted visible title

B. Legacy tile

4. Load a legacy tile with no `moduleType` and title `Market Research`.
5. Confirm it still resolves to `market_research`.

C. Custom tile

6. Load an untyped tile titled `Research Ideas`.
7. Confirm it resolves to `custom`.

D. Invalid type

8. Test `moduleType: "unknown_type"` and `title: "Market Research"`.
9. Confirm canonical-title fallback resolves it to `market_research`.
10. Test `moduleType: "unknown_type"` and `title: "Research Ideas"`.
11. Confirm it resolves to `custom`.

E. Conflict

12. Test `moduleType: "market_research"` and `title: "Competitor Notes"`.
13. Confirm type/definition use `market_research`.
14. Confirm visible title remains `Competitor Notes`.

F. Read-only guarantee

15. Snapshot the source tile before adapter execution.
16. Run adaptation.
17. Confirm source tile is unchanged.

G. Regression

18. Confirm ID-backed runtime keys remain unchanged.
19. Confirm legacy runtime keys remain unchanged.
20. Confirm browser-global smoke test passes.
21. Confirm no app UI or behavior changed.
