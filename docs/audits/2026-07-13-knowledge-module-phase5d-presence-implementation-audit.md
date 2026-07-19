# Knowledge Module Phase 5D — Presence Detection Implementation Audit

## Summary

Phase 5D updates visible canonical Missing Knowledge presence detection in `app.js` so it follows the same identity model completed by Phase 5C: valid persisted canonical `moduleType`, exact canonical-title fallback only for tiles without a valid canonical `moduleType`, then absent.

The change is intentionally limited to one runtime file plus this audit document. It does not change tile creation, duplicate prevention, runtime adapter behavior, stable IDs, selection, editing, deletion, persistence, DOM structure, section placement, APIs, scripts, or workflows.

## Dependency Findings

1. `getDashboardKnowledgeInputStatus()` previously normalized `state.brandCore`, collected `state.brandCore.customTiles`, collected `brandAssets.references`, built one lowercase searchable string from Brand Core text, Value Proposition text, Custom Tile titles/content, and references, then marked each `DASHBOARD_KNOWLEDGE_INPUTS` label present when the lowercase label appeared as a substring.
2. Current callers of `getDashboardKnowledgeInputStatus()` are `getBrandWorkspaceMissingKnowledgeForSection()`, `getDashboardBrandEvolutionModel()`, and `getDashboardSuggestedOpportunities()`.
3. Founder Story, Market Research, Business Plan, Pitch Deck, and Whitepaper were previously marked present/missing by broad text substring matching, not by canonical Custom Tile identity.
4. The previous substring search allowed title, content, references, Brand Core, and Value Proposition text to establish canonical module presence.
5. `customTiles` were previously used only as text sources via `tile.title` and `tile.content`.
6. Existing registry-backed helpers available in `app.js` include `getRuntimeKnowledgeModuleDefinition()`, `getMissingKnowledgeModuleDefinitions()`, `getMissingKnowledgeModuleDefinitionForRequest()`, `getCanonicalMissingKnowledgeTitle()`, and `isSupportedMissingKnowledgeModuleDefinition()`.
7. Existing Phase 5C identity helpers include `getValidPersistedMissingKnowledgeModuleDefinition()`, `findBrandWorkspaceCustomTileIndexByTitle()`, and `findBrandWorkspaceCanonicalModuleTileIndex()`. The reusable read-only parts are valid type resolution and exact title normalization; the selection-specific index helpers remain unchanged.
8. Brand Workspace Missing Knowledge suggestions, Dashboard Brand Evolution, Dashboard missing pills/improvement copy, and Dashboard Suggested Opportunities all inherit status output from `getDashboardKnowledgeInputStatus()`.
9. `getBrandWorkspaceSectionForCustomTileTitle()` is independent of canonical presence detection. It is used by Custom Tile section placement in `renderBrandCoreTiles()` and remains title-based.
10. Section placement can remain unchanged in this PR because visible presence consumers use the corrected shared status output, not section-routing identity.
11. `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` still has exactly one top-level declaration in `app.js`.
12. `app.js` alone is sufficient for the runtime implementation because all affected visible presence consumers already share `getDashboardKnowledgeInputStatus()`.

## Existing Presence Logic

Before this change, the canonical status helper used broad lowercased substring matching. Any occurrence of `Market Research` in a Custom Tile title, Custom Tile content, Brand Core text, Value Proposition text, or Brand Asset reference could make Market Research present. Conversely, a typed `market_research` tile renamed to `Competitor Intelligence` could appear missing if the canonical phrase no longer appeared in the searched text.

## New Canonical Identity Helper

Added `getPresentBrandWorkspaceCanonicalModuleIds(customTiles)`, a read-only helper that returns a `Set` of supported canonical Missing Knowledge module IDs represented by the current Custom Tiles.

For each valid Custom Tile, the helper:

1. resolves a valid persisted canonical `moduleType` through the existing registry-backed supported Missing Knowledge definitions;
2. adds that type when valid and does not inspect the tile title for any other canonical identity;
3. otherwise applies exact normalized canonical-title fallback using the existing trim, whitespace-collapse, and case-insensitive normalization;
4. ignores content, references, substring matches, IDs, and tile position for canonical presence.

The helper does not mutate source tiles, assign IDs, write `moduleType`, save, render, select, trigger events, reorder, rename, or migrate state.

## Resolution Order

Canonical presence now resolves in this order:

1. valid persisted canonical `moduleType`;
2. exact normalized canonical-title fallback only when the tile has no valid canonical `moduleType`;
3. absent.

## getDashboardKnowledgeInputStatus Change

`getDashboardKnowledgeInputStatus()` now keeps its normalized Brand Core access and existing status item shape, but replaces broad text search with the read-only canonical module presence set. Each canonical label is resolved through the existing registry-backed request helper, and `exists` is true only when that resolved module ID is present in the helper result.

The function no longer uses title/content/reference substring search to establish identity for the five canonical Missing Knowledge entries.

## Visible Consumers

Because the shared status source changed, the corrected presence naturally flows through existing callers without consumer rewrites:

- `getBrandWorkspaceMissingKnowledgeForSection(section)`
- `renderBrandWorkspaceMissingKnowledgeBlock(section)`
- `refreshBrandWorkspaceMissingKnowledgeBlocks()`
- `getDashboardBrandEvolutionModel()`
- `renderDashboardBrandEvolution()`
- `getDashboardSuggestedOpportunities()`
- `renderDashboardSuggestedOpportunities()`

## Renamed Typed Tile Behavior

A typed tile such as:

```js
{ moduleType: "market_research", title: "Competitor Intelligence" }
```

now marks Market Research present because the valid persisted canonical `moduleType` is authoritative. Market Research should not appear in Missing Knowledge, Dashboard Brand Evolution should not mark it missing, and Dashboard Suggested Opportunities should not suggest Market Research solely because the title changed.

## Valid Type / Conflicting Title Behavior

A conflicting tile such as:

```js
{ moduleType: "founder_story", title: "Market Research" }
```

now marks Founder Story present and does not mark Market Research present from that tile. A valid persisted canonical `moduleType` takes precedence, and the editable title cannot reclassify the tile as another canonical module.

## Legacy Compatibility

Untyped legacy tiles with exact canonical titles remain supported. A tile with no valid canonical `moduleType` and title `Market Research` marks Market Research present through exact normalized title fallback. A manual untyped tile renamed to `Business Plan` similarly keeps current legacy-compatible behavior and remains untyped.

## Invalid Type Handling

Invalid or unknown `moduleType` values are ignored for typed presence. A tile with `moduleType: "unknown_type"` and exact title `Market Research` may mark Market Research present through legacy title fallback. The invalid value is not corrected, removed, migrated, or saved.

## Substring and Content Matching Removal

Canonical module identity is no longer established by substring title matches, content-only mentions, Brand Core text, Value Proposition text, or Brand Asset references. Examples that no longer mark Market Research present unless `moduleType` is `market_research` include:

- title `Our Market Research Notes`
- title `Research Notes` with content `This is our market research.`

## No-Mutation Confirmation

Presence detection remains read-only. It does not add `moduleType`, correct invalid `moduleType`, rename tiles, assign IDs, save state, reorder tiles, modify content, migrate legacy tiles, modify references, render, select, or trigger events.

## Section Placement Explicitly Deferred

`getBrandWorkspaceSectionForCustomTileTitle()` and Custom Tile section-placement logic were intentionally not modified. A typed renamed canonical tile may still display under Custom Knowledge until a later scoped product decision changes section placement. This PR aligns visible Missing Knowledge/dashboard presence only.

## Files Changed

- `app.js`
- `docs/audits/2026-07-13-knowledge-module-phase5d-presence-implementation-audit.md`

## Runtime Confirmation

Runtime scope is limited to `app.js`. The implementation does not modify `knowledge-module-runtime-adapter.js`, `knowledge-module-registry.js`, `knowledge-module-identity.js`, `index.html`, `styles.css`, APIs, scripts, workflows, tile creation, duplicate prevention, stable IDs, editor lookup, deletion lookup, persistence, or section placement.

## Risks

- Section placement remains title-based by design for this PR, so a renamed typed canonical tile can be present but visually grouped under Custom Knowledge.
- Removing content/reference substring identity is intentional for canonical modules, but users who relied on mentioning `Market Research` only in arbitrary content will now need a typed canonical tile or exact legacy title tile for canonical presence.
- Registry availability remains required for supported canonical module definition resolution, consistent with the existing Phase 5 paths.

## Rollback

Rollback by reverting the `app.js` changes to `getDashboardKnowledgeInputStatus()` and `getPresentBrandWorkspaceCanonicalModuleIds()`, and removing this audit document. No data cleanup is required because no source tiles are migrated or mutated.

## Manual QA

A. Normal typed module

1. Open Brand Workspace.
2. Create Market Research through Missing Knowledge.
3. Confirm the tile has a stable `km_` ID and `moduleType: "market_research"`.
4. Confirm Market Research disappears from Missing Knowledge.
5. Confirm Dashboard no longer marks Market Research missing.

B. Renamed typed module

6. Rename the typed Market Research tile to Competitor Intelligence.
7. Refresh Brand Workspace state through the normal UI path.
8. Confirm Market Research remains absent from Missing Knowledge, Dashboard still considers Market Research present, and no Market Research opportunity appears only because the title changed.
9. Reload the page.
10. Confirm the same result persists.

C. Legacy tile

11. Test a tile with no `moduleType` and title Market Research.
12. Confirm Market Research is present.

D. Invalid type

13. Test `moduleType: "unknown_type"` and title Market Research.
14. Confirm Market Research is present through legacy fallback.
15. Confirm the tile is unchanged.

E. Valid type/title conflict

16. Test `moduleType: "founder_story"` and title Market Research.
17. Confirm Founder Story is present and Market Research remains missing unless another qualifying tile exists.
18. Confirm the tile is unchanged.

F. Manual tile legacy compatibility

19. Create a manual untyped tile.
20. Rename it to Business Plan.
21. Confirm Business Plan is considered present.
22. Confirm `moduleType` remains absent.

G. Exact-match requirement

23. Create an untyped tile titled `Our Market Research Notes`.
24. Confirm it does not count as Market Research.
25. Add `market research` only inside content.
26. Confirm it still does not count as Market Research.

H. Multiple tiles

27. Test typed `market_research` titled Competitor Notes and typed `founder_story` titled Market Research.
28. Confirm Market Research present, Founder Story present, and no identity is inferred from the conflicting title.

I. Deletion

29. Delete the only qualifying Whitepaper tile.
30. Confirm Whitepaper returns to Missing Knowledge through the existing refresh flow.
31. Confirm Dashboard marks Whitepaper missing.
32. Recreate it and confirm presence returns.

J. Section placement known limitation

33. Rename a typed canonical tile.
34. Confirm presence is correct even if its visual Custom Tile section placement remains title-based.
35. Confirm no section-routing code changed.

K. Boot regression

36. Open Preview in incognito.
37. Open DevTools before reload.
38. Confirm no red Funklix script errors.
39. Confirm Google Sign-In responds.
40. Confirm session, Board, Brand, and Canvas load.
41. Confirm Dashboard, Boards, Brand Workspace, AI Brain, and Insights open.
42. Confirm no duplicate declaration SyntaxError.
