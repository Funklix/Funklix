# Knowledge Module Phase 5C — Duplicate Prevention Prefers Persisted moduleType

## Summary

Phase 5C updates only canonical Missing Knowledge duplicate prevention in `app.js`. When a user clicks a canonical Missing Knowledge action, the create/select flow now prefers an existing Custom Tile with a valid persisted canonical `moduleType`, falls back to exact normalized canonical-title matching only for tiles without a valid canonical `moduleType`, and creates a new typed canonical tile only when neither match exists.

This preserves Phase 5A creation, Phase 5B adapter behavior, stable IDs, editor selection, deletion, rendering, persistence, and Missing Knowledge presence detection.

## Dependency Audit Findings

1. `createOrSelectMissingKnowledgeTile(rawTitle)` resolves the request through `getMissingKnowledgeModuleDefinitionForRequest()`, normalizes Brand Core state, finds an existing tile, creates through `createBrandCustomTile()` only when needed, then selects the tile via `getCustomTileRuntimeKey()` and rerenders the Brand Workspace/editor.
2. The pre-existing duplicate helper was `findBrandWorkspaceCustomTileIndexByTitle()`, which used exact normalized canonical-title comparison against `state.brandCore.customTiles` after rejecting invalid and malformed generated tiles.
3. Missing Knowledge request resolution already supports either a module id or canonical label through `getMissingKnowledgeModuleDefinitionForRequest()`.
4. `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` is used by `getMissingKnowledgeModuleDefinitions()` to constrain supported canonical Missing Knowledge modules.
5. There is exactly one top-level declaration of `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` in `app.js`.
6. Registry-backed definition lookup is centralized through `getRuntimeKnowledgeModuleDefinition()` and `getMissingKnowledgeModuleDefinitions()`.
7. Title normalization is handled by `normalizeBrandWorkspaceKnowledgeTitle()`, which trims, collapses whitespace, and lowercases values.
8. Existing-match selection stores `state.brandCoreSelectedKey` using `getCustomTileRuntimeKey(tile, index)`, preserving stable `custom-id:<id>` selection when a valid `km_` id exists and legacy `custom:<index>` otherwise.
9. Stable runtime-key selection remains `custom-id:<id>` when `KnowledgeModuleIdentity.isKnowledgeModuleInstanceId(tile.id)` accepts the persisted id, otherwise `custom:<index>`.
10. Deletion remains editor-scoped: deleting a selected Custom Tile filters the selected index, resets selection to `brandCore`, saves, and rerenders. Missing Knowledge suggestions return through the existing presence detection/search behavior; this PR does not change that detection path.
11. Before this change, the only caller of `findBrandWorkspaceCustomTileIndexByTitle()` was `createOrSelectMissingKnowledgeTile()`.
12. The title lookup helper was not used for unrelated manual Custom Tile creation/editing; manual tiles still use `custom:add`, the generic editor, and existing title/content input handlers.
13. The safest implementation remains entirely inside `app.js`; no runtime adapter, registry, identity, UI, API, stylesheet, or HTML changes are required.

## Existing Duplicate Logic

Before Phase 5C, canonical duplicate prevention was based on exact normalized canonical title only. A renamed typed tile could be missed because title was treated as identity, while a tile with another valid canonical `moduleType` could still be matched by title if it had the requested canonical title.

## New Resolution Order

Canonical Missing Knowledge create/select resolution is now:

1. Resolve and validate the requested canonical module through the existing registry-backed supported Missing Knowledge module list.
2. Select the first valid Custom Tile whose persisted canonical `moduleType` exactly matches the requested module id.
3. If no typed match exists, select the first legacy-compatible Custom Tile whose exact normalized title matches the canonical title and that does not have a valid canonical `moduleType`.
4. If neither match exists, create exactly one new tile through the existing Phase 5A creation path.

## Typed Match Behavior

A typed match requires a valid tile object, a string `tile.moduleType`, exact module id equality with the requested canonical module, and a registry definition that belongs to the supported Missing Knowledge module ids. When found, the tile is selected as-is. Its title, content, id, `moduleType`, items, and ordering are not changed.

## Legacy Title Fallback

Legacy title fallback uses the existing exact normalized canonical-title behavior: trim, collapse whitespace, lowercase, then compare with the canonical registry label. This fallback now applies only to tiles without a valid persisted canonical `moduleType`.

## Valid Type / Conflicting Title Rule

A valid persisted canonical `moduleType` is authoritative for that tile. If a tile has `moduleType: "founder_story"` and title `Market Research`, it must not count as Market Research through title fallback. The typed Founder Story tile remains unchanged, and a real Market Research tile is selected or created separately.

## Invalid Type Handling

An invalid or unknown `moduleType` is ignored for typed duplicate prevention. If such a tile has the exact canonical title, legacy title fallback may select it. The tile is not mutated, corrected, migrated, or saved by duplicate detection.

## Manual Tile Compatibility

Manual untyped Custom Tiles retain legacy compatibility. If a user renames an untyped manual tile to `Business Plan`, the Business Plan Missing Knowledge action selects that tile rather than creating a duplicate, and the tile remains untyped in this PR.

## No-Mutation Confirmation

Duplicate detection is read-only. It does not assign IDs, persist `moduleType`, rename tiles, change content, save state, reorder tiles, or delete anything. The only mutation remains the existing creation path when no typed or legacy match exists.

## Files Changed

- `app.js`
- `docs/audits/2026-07-13-knowledge-module-phase5c-duplicate-prevention-audit.md`

## Runtime Confirmation

Runtime scope is limited to `app.js`. The implementation does not modify `knowledge-module-runtime-adapter.js`, `knowledge-module-registry.js`, `knowledge-module-identity.js`, `index.html`, `styles.css`, APIs, persistence shape, identity generation, editor lookup, selection keys, deletion lookup, or Missing Knowledge presence detection.

## Risks

- Missing Knowledge visibility remains based on the existing Dashboard/search presence detection. This PR intentionally changes only create/select duplicate prevention, so any future visual inconsistency between typed renamed tiles and Missing Knowledge visibility should be handled in a separate Phase 5D if product requirements demand it.
- Legacy title fallback intentionally ignores tiles with valid conflicting canonical `moduleType`; this prevents reclassifying typed modules by editable title.

## Rollback

Rollback by reverting the `app.js` helper changes and removing this audit document. No data cleanup is required because the change does not migrate or mutate existing tiles.

## Manual QA

A. Typed duplicate prevention

1. Create Market Research through Missing Knowledge.
2. Confirm it has a stable `km_` ID and `moduleType: "market_research"`.
3. Trigger Market Research again.
4. Confirm the existing tile opens, no duplicate is created, the ID remains unchanged, and content remains unchanged.

B. Renamed typed tile

5. Rename typed Market Research to Competitor Notes.
6. Trigger Market Research again.
7. Confirm the renamed typed tile opens, no duplicate is created, title remains Competitor Notes, and `moduleType` remains `market_research`.

C. Legacy tile

8. Load or create a tile with no `moduleType` and title Market Research.
9. Trigger Market Research.
10. Confirm the legacy tile opens, no typed duplicate is created, and the legacy tile is not mutated.

D. Invalid type

11. Test a tile with `moduleType: "unknown_type"` and title Market Research.
12. Confirm legacy-title fallback finds it.
13. Confirm it is not mutated.

E. Conflicting valid type

14. Test a tile with `moduleType: "founder_story"` and title Market Research.
15. Trigger Market Research.
16. Confirm this tile does not count as Market Research.
17. Confirm a genuine Market Research tile is selected or created as appropriate.
18. Confirm the Founder Story tile remains unchanged.

F. Manual tile compatibility

19. Create a manual untyped Custom Tile.
20. Rename it to Business Plan.
21. Trigger Business Plan through Missing Knowledge.
22. Confirm the existing exact-title legacy fallback selects it.
23. Confirm no duplicate is created.
24. Confirm `moduleType` remains absent.

G. Deletion/recreation

25. Delete a typed Whitepaper tile.
26. Confirm the Missing Knowledge action returns as before.
27. Recreate Whitepaper.
28. Confirm exactly one new tile is created with a new `km_` ID and `moduleType: "whitepaper"`.

H. Boot regression

29. Open Preview in incognito.
30. Open DevTools before reload.
31. Confirm no red Funklix script errors.
32. Confirm Google Sign-In responds.
33. Confirm session, Board, Brand, and Canvas load.
34. Confirm Dashboard, Boards, Brand Workspace, AI Brain, and Insights open.
35. Confirm no duplicate declaration SyntaxError.
