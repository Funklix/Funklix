# Founder Story F0 — moduleType Section Routing Audit

## Summary

Founder Story F0 updates Brand Workspace Custom Tile section routing so a valid persisted canonical `moduleType` determines a tile's canonical section before editable-title fallback is considered. This aligns section placement with the completed Phase 5 identity model while changing section placement only.

Runtime scope is limited to `app.js`. No Founder Story specialized editor, `moduleData`, AI generation, registry metadata, runtime adapter, creation, duplicate-prevention, presence detection, stable ID, selection, editor lookup, deletion, persistence, stylesheet, script, workflow, or API behavior is changed.

## Dependency Findings

1. The previous section-routing helper was `getBrandWorkspaceSectionForCustomTileTitle(value = "")` in `app.js`. It accepted only a title, resolved a canonical Missing Knowledge title through `getCanonicalMissingKnowledgeTitle()`, matched exact normalized labels from `getMissingKnowledgeModuleDefinitions()`, and returned the matched registry section or `""`.
2. The only caller was the Custom Tile rendering loop in `renderBrandCoreTiles()`, which passed `tile?.title || ""` and appended the card to a section row when the helper returned a section.
3. The Custom Tile grouping flow creates each Custom Tile card, assigns `data-bc-key` from `getCustomTileRuntimeKey(tile, idx)`, then appends the card either to the matching canonical section row or to the Custom Knowledge row.
4. Current Brand Workspace section names used by the DOM are `strategy`, `intelligence`, and `deployment`; Custom Knowledge is the fallback group when no section row is found.
5. Registry section values are: `founder_story` → `intelligence`, `market_research` → `strategy`, `business_plan` → `strategy`, `pitch_deck` → `deployment`, `whitepaper` → `deployment`, and `custom` → `custom`.
6. The previous helper received only a title, but its only caller already has the full tile object, so it can safely pass the complete tile without broad render refactoring.
7. No other Custom Tile section-routing helper was found in `app.js`; presence detection, duplicate prevention, and adapter routing use separate helpers.
8. Section routing affects rendering/grouping only. It does not affect selection, runtime keys, editor lookup, deletion, save/load, persistence, Missing Knowledge status, Dashboard Brand Evolution, or Dashboard Suggested Opportunities.
9. Phase 5C duplicate prevention uses `findBrandWorkspaceCanonicalModuleTileIndex()` and title fallback helpers, not the section-routing helper.
10. Phase 5D presence detection uses `getDashboardKnowledgeInputStatus()` and `getPresentBrandWorkspaceCanonicalModuleIds()`, not the section-routing helper.
11. Registry section values map directly to existing Brand Workspace sections for all five supported canonical modules.
12. `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` still has exactly one top-level declaration in `app.js`.
13. `app.js` alone is sufficient because the only runtime change needed is the section helper and its single caller.

## Existing Section Routing

Before this change, Custom Tile placement was title-only. A typed Founder Story tile renamed to `Why We Started` no longer matched the canonical `Founder Story` title, so it fell back to Custom Knowledge. A valid `founder_story` tile titled `Market Research` could be placed in the Market Research section because the editable title controlled routing.

## Callers and UI Surface

The section-routing helper is called only by `renderBrandCoreTiles()` while rendering `state.brandCore.customTiles`. It controls where the card appears in the Brand Workspace: a matching registry section row or the Custom Knowledge fallback row. It does not change the card runtime key, selected key, editor behavior, saved state, or Missing Knowledge status.

## New Resolution Order

Custom Tile section placement now resolves in this order:

1. valid persisted canonical `moduleType` resolved through the existing registry and supported Missing Knowledge module IDs;
2. exact normalized canonical-title fallback for tiles with no valid persisted canonical `moduleType`;
3. existing Custom Knowledge fallback when no canonical section is returned or no DOM row exists.

## Registry Metadata Reuse

The implementation reuses the existing registry-backed helpers and supported module set:

- `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS`
- `getRuntimeKnowledgeModuleDefinition()`
- `getMissingKnowledgeModuleDefinitions()`
- `getValidPersistedMissingKnowledgeModuleDefinition()`
- `getCanonicalMissingKnowledgeTitle()`
- `normalizeBrandWorkspaceKnowledgeTitle()`

No title-to-section map, moduleType-to-section map, hardcoded per-module section logic, new allowlist, runtime adapter change, or registry metadata duplication was added.

## Typed Renamed Tile Behavior

A tile such as:

```js
{ moduleType: "founder_story", title: "Why We Started" }
```

now routes to the Founder Story registry section, `intelligence`, because valid persisted `moduleType` is authoritative. The title remains editable and unchanged.

A tile such as:

```js
{ moduleType: "market_research", title: "Competitor Intelligence" }
```

now routes to the Market Research registry section, `strategy`, even though the editable title no longer matches the canonical label.

## Valid Type / Conflicting Title Behavior

A tile such as:

```js
{ moduleType: "founder_story", title: "Market Research" }
```

routes using `founder_story`, not the conflicting title. The tile remains in the Founder Story registry section and is not routed as Market Research. Neither `moduleType` nor `title` is mutated.

## Legacy Compatibility

Legacy untyped exact canonical-title tiles keep the existing behavior. A tile with title `Founder Story` and no valid canonical `moduleType` routes to the Founder Story registry section through exact normalized title fallback. A manual untyped tile renamed to `Business Plan` still routes to the Business Plan registry section and remains untyped.

## Invalid Type Handling

Invalid or unknown `moduleType` values are ignored for typed section routing. If the tile title is an exact canonical match, legacy title fallback can route it to the canonical section. The invalid value is not corrected, removed, persisted, or otherwise mutated.

## Custom Knowledge Fallback

Untyped unrelated manual Custom Tiles still return no canonical section. If no section is returned or no matching section row exists, the existing rendering path appends the card to Custom Knowledge.

## No-Mutation Confirmation

Section routing is read-only. It does not add `moduleType`, correct invalid `moduleType`, rename tiles, assign IDs, save state, reorder the source array, modify content, migrate legacy tiles, modify references, trigger autosave, select tiles, or invoke editor logic.

## Files Changed

- `app.js`
- `docs/audits/2026-07-19-founder-story-f0-module-type-section-routing-audit.md`

## Runtime Confirmation

Runtime scope is exactly one runtime file: `app.js`. The change replaces the misleading title-only helper with `getBrandWorkspaceSectionForCustomTile(tile)` and updates the single render caller to pass the tile object. Phase 5A creation, Phase 5B adapter behavior, Phase 5C duplicate prevention, Phase 5D presence detection, stable IDs, runtime keys, selection, editing, deletion, save/load, autosave, Dashboard, Boards, AI Brain, Insights, DOM IDs, event handlers, and Custom Tile source data remain unchanged.

## Risks

- A malformed or missing registry section could leave a typed tile in Custom Knowledge. Current registry definitions for all five supported canonical modules map to existing section rows.
- This PR intentionally does not implement the Founder Story specialized editor, so clicking a routed Founder Story tile still opens the generic Custom Tile editor.
- Legacy untyped canonical-title routing remains title-based by design, so manual untyped tiles renamed to canonical titles continue to route canonically.
- The helper uses registry availability, consistent with the existing Phase 5 runtime helpers and script load order safeguards.

## Rollback

Rollback is safe by reverting the `app.js` helper/signature change and removing this audit document. No data cleanup is required because section routing does not mutate source state or persistence.

## Manual QA

A. Typed Founder Story

1. Open Brand Workspace.
2. Create Founder Story through Missing Knowledge.
3. Confirm stable `km_` ID, `moduleType: "founder_story"`, and placement in the Founder Story registry-defined canonical section.
4. Rename it to `Why We Started`.
5. Confirm it remains in the same canonical section, title remains `Why We Started`, `moduleType` remains `founder_story`, and selection/editor still work.
6. Reload.
7. Confirm placement remains correct.

B. Typed Market Research

8. Create Market Research.
9. Rename it to `Competitor Intelligence`.
10. Confirm it remains in the Market Research registry-defined section.

C. Conflicting valid type/title

11. Test `moduleType: "founder_story"` and title `Market Research`.
12. Confirm section is determined by `founder_story`, title does not route it as Market Research, and source tile remains unchanged.

D. Legacy untyped tile

13. Test title `Founder Story` with no `moduleType`.
14. Confirm it routes to the Founder Story canonical section.
15. Confirm `moduleType` remains absent.

E. Invalid type

16. Test `moduleType: "unknown_type"` and title `Founder Story`.
17. Confirm exact legacy title fallback routes it correctly.
18. Confirm it is not mutated.

F. Manual Custom Tile

19. Create a manual Custom Tile titled `Competitor Notes`.
20. Confirm it remains in Custom Knowledge.
21. Rename it to Business Plan.
22. Confirm existing legacy canonical-title section behavior remains.
23. Confirm `moduleType` remains absent.

G. Presence regression

24. Rename a typed Founder Story tile.
25. Confirm Founder Story still remains absent from Missing Knowledge.
26. Confirm Dashboard still considers Founder Story present.

H. Core behavior regression

27. Confirm tile selection works.
28. Confirm sticky editor opens.
29. Confirm editing and autosave work.
30. Confirm Delete Tile works.
31. Confirm deletion returns the Missing Knowledge suggestion.
32. Confirm stable runtime keys remain unchanged.

I. Boot regression

33. Open Preview in incognito.
34. Open DevTools before reload.
35. Confirm no red Funklix script errors.
36. Confirm Google Sign-In responds.
37. Confirm session, Board, Brand, and Canvas load.
38. Confirm Dashboard, Boards, Brand Workspace, AI Brain, and Insights open.
39. Confirm no duplicate declaration SyntaxError.

## Deferred Founder Story Editor Scope

Founder Story F1 remains out of scope for this PR. The specialized editor should be implemented later as its own focused PR, with no `moduleData`, founderStory fields, AI generation, narrative output, completion status, card redesign, uploads, or registry capability changes included in F0.
