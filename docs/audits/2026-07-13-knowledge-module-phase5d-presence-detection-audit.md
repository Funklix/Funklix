# Knowledge Module Phase 5D Audit — Missing Knowledge Presence Detection

## Executive Summary

Phase 5D is required. The completed Phase 5A/5B/5C identity behavior now treats a valid persisted canonical Custom Tile `moduleType` as authoritative for creation, adapter views, and duplicate prevention, but current visible presence detection still uses title/content substring search and title-only section routing in `app.js`.

The most important inconsistency is `getDashboardKnowledgeInputStatus()`: it builds a lowercase searchable string from Brand Core fields, Custom Tile titles, Custom Tile content, and Brand Asset references, then marks each canonical label as present when the label appears as a substring. That means a typed renamed `market_research` tile titled `Competitor Intelligence` can still appear missing if neither its title nor content contains `Market Research`, while a valid conflicting `founder_story` tile titled `Market Research` can incorrectly make Market Research appear present.

This audit is documentation-only. No runtime code was modified. The smallest safe follow-up is an `app.js`-only runtime PR that changes the read-only canonical presence helper used by Dashboard Brand Evolution, Brand Workspace Missing Knowledge suggestions, and Dashboard Suggested Opportunities. The recommended identity order should match Phase 5C: valid persisted canonical `moduleType`, exact canonical-title fallback only when the tile has no valid canonical `moduleType`, then absent.

## Current Phase 5 State

- Phase 5A persists `moduleType` on newly created canonical Missing Knowledge Custom Tiles.
- Phase 5B makes the passive runtime adapter prefer valid persisted `moduleType` before legacy canonical-title matching.
- Phase 5C makes canonical Missing Knowledge create/select duplicate prevention prefer valid persisted `moduleType` and use exact canonical-title matching only as a legacy fallback.
- Phase 5C intentionally did not change Missing Knowledge presence detection, Dashboard Brand Evolution detection, Brand Workspace Missing Knowledge visibility detection, or global missing-knowledge helpers.

## Presence Detection Inventory

### 1. `getDashboardKnowledgeInputStatus()`

- **File / location:** `app.js`, near the Dashboard Brand signal and Missing Knowledge helper block.
- **Callers:** `getBrandWorkspaceMissingKnowledgeForSection()`, `getDashboardBrandEvolutionModel()`, and `getDashboardSuggestedOpportunities()`.
- **Consumer/UI surface:** Brand Workspace Missing Knowledge suggestion pills; Dashboard Brand Evolution completeness, improvement copy, and missing pills; Dashboard Suggested Opportunities.
- **Data source used:** `normalizeBrandCoreState(state.brandCore)`, `state.brandCore.customTiles`, `state.brandCore.brandAssets.references`, `brandCore.brandCore`, and `brandCore.valueProposition`.
- **Current identity logic:** substring search against lowercased user-visible text and content. It does not use `moduleType`, registry definitions, adapter output, stable IDs, tile position, or exact canonical normalization.
- **Editable title impact:** Yes. Renaming a typed canonical tile can make that module appear missing if content also lacks the canonical label. Renaming an unrelated tile to a canonical label can make that module appear present.
- **Valid `moduleType` precedence:** No.
- **Invalid `moduleType` fallback:** Not explicitly handled. Invalid type is ignored because all `moduleType` values are ignored.
- **Legacy untyped canonical-title support:** Yes, but through broad substring matching rather than exact canonical-title fallback.
- **Conflicting valid type/title handling:** Incorrect. A valid `founder_story` tile titled `Market Research` can mark Market Research present.
- **Deletion behavior:** Deleted tiles are removed from `customTiles`, so the searchable text is removed and the canonical label becomes missing again if it appears nowhere else.

### 2. `getBrandWorkspaceMissingKnowledgeForSection(section)`

- **File / location:** `app.js`, immediately after `createOrSelectMissingKnowledgeTile()`.
- **Callers:** `renderBrandWorkspaceMissingKnowledgeBlock(section)`.
- **Consumer/UI surface:** Section-level Brand Workspace Missing Knowledge blocks in Strategy, Intelligence, and Deployment.
- **Data source used:** `getBrandWorkspaceMissingKnowledgeSections()` for section-to-label mapping, then `getDashboardKnowledgeInputStatus()` for present/missing status.
- **Current identity logic:** inherits title/content substring presence from `getDashboardKnowledgeInputStatus()`, then filters by registry-derived section labels.
- **Editable title impact:** Yes, inherited.
- **Valid `moduleType` precedence:** No, inherited.
- **Invalid `moduleType` fallback:** Not explicit, inherited.
- **Legacy untyped canonical-title support:** Yes, inherited, but substring-based.
- **Conflicting valid type/title handling:** Incorrect, inherited.
- **Deletion behavior:** Inherited; deleted tile text disappears, so the suggestion can return.

### 3. `renderBrandWorkspaceMissingKnowledgeBlock(section)`

- **File / location:** `app.js`, immediately after `getBrandWorkspaceMissingKnowledgeForSection()`.
- **Callers:** `renderBrandCoreTiles()` during initial section markup and `refreshBrandWorkspaceMissingKnowledgeBlocks()` during refresh.
- **Consumer/UI surface:** Renders the actual Missing Knowledge suggestion buttons, including `data-missing-knowledge-title` and `data-missing-knowledge-module-id`.
- **Data source used:** Missing items from `getBrandWorkspaceMissingKnowledgeForSection()` and request resolution through `getMissingKnowledgeModuleDefinitionForRequest(item.label)`.
- **Current identity logic:** Does not independently detect presence; inherits status from `getBrandWorkspaceMissingKnowledgeForSection()`.
- **Editable title impact:** Yes, inherited.
- **Valid `moduleType` precedence:** No, inherited.
- **Invalid `moduleType` fallback:** Not explicit, inherited.
- **Legacy untyped canonical-title support:** Yes, inherited.
- **Conflicting valid type/title handling:** Incorrect, inherited.
- **Deletion behavior:** Inherited.

### 4. `refreshBrandWorkspaceMissingKnowledgeBlocks()`

- **File / location:** `app.js`, after `renderBrandWorkspaceMissingKnowledgeBlock()`.
- **Callers:** `renderBrandCoreTiles()`.
- **Consumer/UI surface:** Keeps Brand Workspace Missing Knowledge blocks in sync after tile edits, creation, deletion, and rerenders.
- **Data source used:** DOM groups plus HTML generated from `renderBrandWorkspaceMissingKnowledgeBlock()`.
- **Current identity logic:** Does not independently detect presence; it only replaces/inserts/removes DOM blocks based on rendered missing-block HTML.
- **Editable title impact:** Yes, inherited from upstream status.
- **Valid `moduleType` precedence:** No, inherited.
- **Invalid `moduleType` fallback:** Not explicit, inherited.
- **Legacy untyped canonical-title support:** Yes, inherited.
- **Conflicting valid type/title handling:** Incorrect, inherited.
- **Deletion behavior:** Inherited.

### 5. `getDashboardBrandEvolutionModel()`

- **File / location:** `app.js`, Dashboard Brand Evolution model block.
- **Callers:** `renderDashboardBrandEvolution()`.
- **Consumer/UI surface:** Dashboard Brand Evolution title, completeness copy, learning copy, improvement copy, and `missingKnowledge` pill model.
- **Data source used:** `getDashboardBrandSignals()` for built-in Brand Core signals and `getDashboardKnowledgeInputStatus()` for the five canonical Missing Knowledge inputs.
- **Current identity logic:** built-in Brand Core signals use meaningful-value checks by state key; canonical Missing Knowledge inputs inherit substring text search from `getDashboardKnowledgeInputStatus()`.
- **Editable title impact:** Yes for canonical Knowledge Modules.
- **Valid `moduleType` precedence:** No for canonical Knowledge Modules.
- **Invalid `moduleType` fallback:** Not explicit for canonical Knowledge Modules.
- **Legacy untyped canonical-title support:** Yes, inherited, but substring-based.
- **Conflicting valid type/title handling:** Incorrect for canonical Knowledge Modules.
- **Deletion behavior:** Inherited for canonical Knowledge Modules.

### 6. `renderDashboardBrandEvolution()`

- **File / location:** `app.js`, after `getDashboardBrandEvolutionModel()`.
- **Callers:** `refreshDashboardIfVisible()` and a later direct dashboard refresh path.
- **Consumer/UI surface:** Dashboard Brand Evolution card and missing pills that open Brand Workspace.
- **Data source used:** `getDashboardBrandEvolutionModel()`.
- **Current identity logic:** Does not independently detect presence; renders model output.
- **Editable title impact:** Yes, inherited.
- **Valid `moduleType` precedence:** No, inherited.
- **Invalid `moduleType` fallback:** Not explicit, inherited.
- **Legacy untyped canonical-title support:** Yes, inherited.
- **Conflicting valid type/title handling:** Incorrect, inherited.
- **Deletion behavior:** Inherited.

### 7. `getDashboardSuggestedOpportunities()`

- **File / location:** `app.js`, after Dashboard Brand Evolution rendering.
- **Callers:** `renderDashboardSuggestedOpportunities()`.
- **Consumer/UI surface:** Dashboard Suggested Opportunities cards, currently for Founder Story and Market Research gaps when Brand signals exist.
- **Data source used:** `getDashboardBrandSignals()`, `getDashboardKnowledgeInputStatus()`, and campaign node counts/statuses.
- **Current identity logic:** Uses a `Set` of missing labels derived from `getDashboardKnowledgeInputStatus()`.
- **Editable title impact:** Yes for Founder Story and Market Research opportunity visibility.
- **Valid `moduleType` precedence:** No.
- **Invalid `moduleType` fallback:** Not explicit.
- **Legacy untyped canonical-title support:** Yes, inherited, but substring-based.
- **Conflicting valid type/title handling:** Incorrect for Founder Story and Market Research opportunity decisions.
- **Deletion behavior:** Inherited.

### 8. `renderDashboardSuggestedOpportunities()`

- **File / location:** `app.js`, immediately after `getDashboardSuggestedOpportunities()`.
- **Callers:** `refreshDashboardIfVisible()`.
- **Consumer/UI surface:** Dashboard Suggested Opportunities list.
- **Data source used:** `getDashboardSuggestedOpportunities()`.
- **Current identity logic:** Does not independently detect presence; renders opportunity model output.
- **Editable title impact:** Yes, inherited.
- **Valid `moduleType` precedence:** No, inherited.
- **Invalid `moduleType` fallback:** Not explicit, inherited.
- **Legacy untyped canonical-title support:** Yes, inherited.
- **Conflicting valid type/title handling:** Incorrect, inherited.
- **Deletion behavior:** Inherited.

### 9. `getBrandWorkspaceSectionForCustomTileTitle(value)`

- **File / location:** `app.js`, near Missing Knowledge registry helpers.
- **Callers:** `renderBrandCoreTiles()` custom tile rendering loop.
- **Consumer/UI surface:** Brand Workspace placement of canonical Custom Tiles into Strategy, Intelligence, or Deployment instead of the Custom Knowledge group.
- **Data source used:** tile title passed from `state.brandCore.customTiles`, registry-backed `getMissingKnowledgeModuleDefinitions()` labels and sections.
- **Current identity logic:** exact normalized canonical-title matching only. It does not inspect `moduleType`.
- **Editable title impact:** Yes. A renamed typed `market_research` tile no longer routes to Strategy by type; a valid `founder_story` tile titled `Market Research` routes to Strategy by title.
- **Valid `moduleType` precedence:** No.
- **Invalid `moduleType` fallback:** Not applicable because `moduleType` is ignored.
- **Legacy untyped canonical-title support:** Yes, exact normalized title fallback works.
- **Conflicting valid type/title handling:** Incorrect for placement because the valid type is ignored.
- **Deletion behavior:** Deleted tiles are removed from rendering; a later recreated typed tile with canonical title routes by title again.

### 10. `renderBrandWorkspaceHero()`

- **File / location:** `app.js`, Brand Workspace hero block.
- **Callers:** `renderBrandCoreTiles()` and `renderBrandDnaCard()`.
- **Consumer/UI surface:** Brand Workspace readiness label/detail.
- **Data source used:** `getDashboardBrandSignals()` only.
- **Current identity logic:** Built-in Brand Core meaningful-value checks by state key. It does not count or inspect the five canonical Custom Tile modules.
- **Editable title impact:** No for the five canonical Knowledge Modules because they are not included in this readiness count.
- **Valid `moduleType` precedence:** Not applicable.
- **Invalid `moduleType` fallback:** Not applicable.
- **Legacy untyped canonical-title support:** Not applicable.
- **Conflicting valid type/title handling:** Not applicable.
- **Deletion behavior:** Not applicable for canonical Custom Tile modules.

### 11. `KnowledgeModuleRuntimeAdapter.getKnowledgeModuleRuntimeViews()` and `adaptCustomTileToKnowledgeModule()`

- **File / location:** `knowledge-module-runtime-adapter.js`, custom tile adapter and runtime view list functions.
- **Callers:** No `app.js` caller found for rendering, Missing Knowledge presence, Dashboard Brand Evolution, Dashboard Suggested Opportunities, editor selection, or persistence.
- **Consumer/UI surface:** Passive infrastructure only in current runtime.
- **Data source used:** supplied `brandCoreState.customTiles`, registry API, and identity API.
- **Current identity logic:** Phase 5B adapter resolution prefers persisted `moduleType`, then legacy exact canonical-title fallback, then `custom`.
- **Editable title impact:** No when a valid persisted `moduleType` exists. Yes only for legacy untyped or invalidly typed tiles.
- **Valid `moduleType` precedence:** Yes.
- **Invalid `moduleType` fallback:** Yes, it falls back to title and then custom.
- **Legacy untyped canonical-title support:** Yes.
- **Conflicting valid type/title handling:** Correct for adapter interpretation.
- **Deletion behavior:** A deleted tile is absent from the supplied `customTiles` array and therefore absent from adapter output.

## Function and Caller Map

| Function | Callers | Consumer/UI surface | Presence role |
|---|---|---|---|
| `getDashboardKnowledgeInputStatus()` | `getBrandWorkspaceMissingKnowledgeForSection()`, `getDashboardBrandEvolutionModel()`, `getDashboardSuggestedOpportunities()` | Brand Workspace Missing Knowledge, Dashboard Brand Evolution, Dashboard Suggested Opportunities | Primary visible canonical Missing Knowledge presence detector |
| `getBrandWorkspaceMissingKnowledgeForSection(section)` | `renderBrandWorkspaceMissingKnowledgeBlock(section)` | Brand Workspace section Missing Knowledge suggestions | Section-specific missing suggestion model |
| `renderBrandWorkspaceMissingKnowledgeBlock(section)` | `renderBrandCoreTiles()`, `refreshBrandWorkspaceMissingKnowledgeBlocks()` | Brand Workspace Missing Knowledge pills | Renders suggestion buttons from missing model |
| `refreshBrandWorkspaceMissingKnowledgeBlocks()` | `renderBrandCoreTiles()` | Brand Workspace Missing Knowledge blocks | DOM refresh for missing suggestions |
| `getDashboardBrandEvolutionModel()` | `renderDashboardBrandEvolution()` | Dashboard Brand Evolution | Dashboard completeness/improvement model |
| `renderDashboardBrandEvolution()` | `refreshDashboardIfVisible()`, direct refresh path | Dashboard Brand Evolution card and missing pills | Renders dashboard missing status |
| `getDashboardSuggestedOpportunities()` | `renderDashboardSuggestedOpportunities()` | Dashboard Suggested Opportunities | Adds opportunities from missing Founder Story/Market Research |
| `renderDashboardSuggestedOpportunities()` | `refreshDashboardIfVisible()` | Dashboard Suggested Opportunities list | Renders opportunity model |
| `getBrandWorkspaceSectionForCustomTileTitle(value)` | `renderBrandCoreTiles()` | Brand Workspace custom tile section placement | Title-only canonical placement, not missing suggestion status |
| `renderBrandWorkspaceHero()` | `renderBrandCoreTiles()`, `renderBrandDnaCard()` | Brand Workspace readiness label/detail | Built-in Brand Core signal count only; not canonical custom module presence |
| `KnowledgeModuleRuntimeAdapter.getKnowledgeModuleRuntimeViews()` | No app UI callers found | Passive infrastructure | Correct typed adapter identity, currently unused for visible presence |

## UI Surface Map

| UI surface | Runtime path | Current basis | Phase 5 consistency |
|---|---|---|---|
| Brand Workspace Missing Knowledge blocks | `renderBrandCoreTiles()` → `renderBrandWorkspaceMissingKnowledgeBlock()` → `getBrandWorkspaceMissingKnowledgeForSection()` → `getDashboardKnowledgeInputStatus()` | title/content/reference substring search | Inconsistent for renamed typed and conflicting valid type/title cases |
| Dashboard Brand Evolution completeness/improvement/missing pills | `renderDashboardBrandEvolution()` → `getDashboardBrandEvolutionModel()` → `getDashboardKnowledgeInputStatus()` | title/content/reference substring search | Inconsistent for renamed typed and conflicting valid type/title cases |
| Dashboard Suggested Opportunities | `renderDashboardSuggestedOpportunities()` → `getDashboardSuggestedOpportunities()` → `getDashboardKnowledgeInputStatus()` | title/content/reference substring search | Inconsistent for Founder Story and Market Research opportunity decisions |
| Brand Workspace custom tile placement | `renderBrandCoreTiles()` → `getBrandWorkspaceSectionForCustomTileTitle(tile.title)` | exact normalized title only | Inconsistent for typed renamed and conflicting valid type/title placement |
| Brand Workspace readiness label | `renderBrandWorkspaceHero()` → `getDashboardBrandSignals()` | built-in Brand Core field values | Not applicable to five canonical Custom Tile modules |
| Runtime adapter views | `KnowledgeModuleRuntimeAdapter` | persisted `moduleType`, then title fallback | Consistent, but not consumed by visible presence surfaces |

## Current Identity Rules

Current visible presence detection for the five canonical modules is mixed:

1. Missing Knowledge and Dashboard status use broad title/content/reference substring search through `getDashboardKnowledgeInputStatus()`.
2. Brand Workspace section placement uses exact normalized title matching through `getBrandWorkspaceSectionForCustomTileTitle()`.
3. Duplicate prevention uses Phase 5C's typed-first canonical lookup.
4. Runtime adapter views use Phase 5B's typed-first read-only resolution but are not currently used by app UI presence detection.
5. Stable IDs are used for selection/editor lookup, not to determine canonical module presence.

## Scenario Matrix

| Scenario | Brand Workspace | Brand Evolution | Other Surface | Expected | Consistent? |
|---|---|---|---|---|---|
| A. Normal typed tile: `moduleType: "market_research"`, title `Market Research` | Missing suggestion hidden by title substring; tile routes to Strategy by title | Market Research treated as present by title substring | Suggested Opportunities do not add Market Research gap | `market_research` present | Yes, but accidentally title-driven rather than type-driven |
| B. Renamed typed tile: `moduleType: "market_research"`, title `Competitor Intelligence` | Missing suggestion can remain/show if content lacks `Market Research`; tile routes to Custom Knowledge rather than Strategy | Market Research can appear missing | Market Research opportunity can appear | `market_research` present | No |
| C. Legacy untyped tile: title `Market Research` | Missing suggestion hidden; tile routes to Strategy by title | Market Research treated as present | Market Research opportunity suppressed | `market_research` present through legacy fallback | Mostly yes, though broad substring rather than exact fallback for presence |
| D. Invalid type with canonical title: `moduleType: "unknown_type"`, title `Market Research` | Missing suggestion hidden; tile routes to Strategy by title | Market Research treated as present | Market Research opportunity suppressed | invalid type ignored; title fallback may mark present | Mostly yes, though no explicit invalid-type rule |
| E. Conflicting valid type/title: `moduleType: "founder_story"`, title `Market Research` | Market Research missing suggestion hidden incorrectly; tile routes to Strategy by title instead of Founder Story's section | Market Research incorrectly treated as present; Founder Story may be missing unless text contains Founder Story | Market Research opportunity suppressed incorrectly; Founder Story opportunity may appear incorrectly | `founder_story` present; `market_research` absent | No |
| F. Manual untyped tile renamed to `Business Plan` | Business Plan missing suggestion hidden; tile routes to Strategy by title | Business Plan treated as present | No specific Business Plan opportunity path found | `business_plan` may be present through legacy fallback | Yes for current compatibility, though substring-based |
| G. Multiple conflicting tiles: Tile 1 typed `market_research` titled `Competitor Notes`; Tile 2 typed `founder_story` titled `Market Research` | Market Research hidden due to Tile 2 title; Founder Story may show missing; placement routes Tile 2 to Strategy and Tile 1 to Custom Knowledge | Market Research appears present for the wrong tile; Founder Story can appear missing | Market Research opportunity suppressed; Founder Story opportunity may appear | Market Research present via Tile 1, Founder Story present via Tile 2, Tile 2 title must not create Market Research identity | No |

## Renamed Typed Tile Findings

Renamed typed canonical tiles are the clearest remaining gap. Phase 5C duplicate prevention will correctly find a typed `market_research` tile even after the title is changed to `Competitor Intelligence`, but `getDashboardKnowledgeInputStatus()` can still mark Market Research missing because it ignores `moduleType`. The Brand Workspace Missing Knowledge action may therefore remain visible even though clicking it would select the existing typed tile rather than create a duplicate.

Brand Workspace section placement also remains title-only. A renamed typed Market Research tile can render under Custom Knowledge instead of Strategy because `getBrandWorkspaceSectionForCustomTileTitle()` receives only `tile.title` and does not inspect the tile's valid persisted `moduleType`.

## Valid Type / Conflicting Title Findings

Valid conflicting type/title combinations are not handled correctly by visible presence detection. A tile with `moduleType: "founder_story"` and title `Market Research` can make Market Research look present in Dashboard Brand Evolution and Brand Workspace Missing Knowledge suggestions even though Phase 5C duplicate prevention correctly refuses to count that tile as Market Research.

This creates a direct inconsistency with the Phase 5 architecture principle: `moduleType` identifies the canonical module, while title is user-facing and editable.

## Legacy Compatibility Findings

Legacy untyped canonical-title tiles still work in current presence detection because their canonical titles are included in the searchable text. Manual untyped tiles renamed to canonical labels also work for the same reason. A Phase 5D implementation should preserve this compatibility but tighten it to exact normalized canonical-title fallback rather than broad substring matching.

## Invalid Type Findings

Invalid `moduleType` values are currently ignored because visible presence detection does not inspect `moduleType` at all. In practical terms, a tile with `moduleType: "unknown_type"` and title `Market Research` is considered present by title text. That matches the desired legacy fallback outcome, but the current path reaches it accidentally rather than through an explicit safe invalid-type rule.

## Deletion and Recreation Findings

Deletion removes the selected Custom Tile from `state.brandCore.customTiles`, resets selection to `brandCore`, saves, and rerenders. For current presence detection, deletion generally makes a canonical module missing again when the canonical label no longer appears in title/content/references. However, because the detector is broad substring search, deletion can fail to make a module missing if the canonical phrase remains in another tile's content, another tile's editable title, Brand Core text, Value Proposition text, or Brand Asset references.

Creation/recreation through Missing Knowledge now uses the Phase 5C typed-first duplicate prevention path and persists a new typed canonical tile only when no typed or legacy match exists.

## Consistency With Phase 5C

Current visible presence detection is not consistent with Phase 5C. Phase 5C's create/select path uses:

1. valid persisted canonical `moduleType`,
2. exact canonical-title fallback only when a tile has no valid canonical `moduleType`,
3. create when absent.

The remaining visible presence paths use either title/content substring search or title-only section routing. These paths can disagree with Phase 5C in both directions:

- They can say a typed renamed module is missing even though Phase 5C will select it.
- They can say another module is present because a conflicting valid typed tile has an editable title matching that module.

## Risk Assessment

- **User confusion risk:** Medium. Users can see a Missing Knowledge prompt for a module that already exists by typed identity, especially after renaming the tile.
- **Duplicate creation risk:** Low after Phase 5C. Even when the prompt appears incorrectly, clicking it should select the typed existing tile rather than create a duplicate.
- **Misleading dashboard risk:** Medium. Dashboard Brand Evolution and Suggested Opportunities can report the wrong missing/present status for Founder Story and Market Research.
- **Runtime change risk for follow-up:** Low to medium if scoped to an `app.js` read-only helper consumed by existing presence paths. Higher if combined with adapter adoption, UI redesign, readiness semantics, migration, or section-rendering refactors.

## Final Decision

**Phase 5D is required.**

Phase 5 is not complete because visible presence detection still relies on editable title/content text and can misclassify typed renamed tiles and valid conflicting type/title tiles. Multiple separate follow-ups are not required for the core presence inconsistency because Dashboard Brand Evolution, Brand Workspace Missing Knowledge suggestions, and Dashboard Suggested Opportunities all share `getDashboardKnowledgeInputStatus()` as their primary canonical presence source.

A separate later follow-up may be appropriate for Brand Workspace section placement if the product wants typed renamed canonical tiles to remain in registry-defined sections. That placement issue is related but not required to correct Missing Knowledge presence and dashboard gap detection.

## Recommended Follow-up Scope

Smallest safe implementation scope for Phase 5D:

- **Runtime files:** `app.js` only.
- **Primary function/helper to change:** Replace or revise `getDashboardKnowledgeInputStatus()` so it delegates canonical Custom Tile identity to a shared read-only presence helper.
- **Potential helper shape:** `getBrandWorkspaceCanonicalModulePresence()` or `hasBrandWorkspaceCanonicalModuleTile(moduleType, canonicalTitle)`.
- **Existing helpers to reuse:** Reuse the Phase 5C validation helpers and exact-title normalization behavior where safe: `isSupportedMissingKnowledgeModuleDefinition()`, `getValidPersistedMissingKnowledgeModuleDefinition()`, `normalizeBrandWorkspaceKnowledgeTitle()`, and the supported registry-backed Missing Knowledge definitions.
- **Callers affected:** `getBrandWorkspaceMissingKnowledgeForSection()`, `getDashboardBrandEvolutionModel()`, and `getDashboardSuggestedOpportunities()` through their existing call to `getDashboardKnowledgeInputStatus()`.
- **UI surfaces affected:** Brand Workspace Missing Knowledge suggestions, Dashboard Brand Evolution, and Dashboard Suggested Opportunities.
- **Expected resolution order:**
  1. valid persisted canonical `moduleType`,
  2. exact canonical-title fallback only when the tile has no valid canonical `moduleType`,
  3. absent.
- **Read-only guarantee:** The helper must not mutate source tiles, persist `moduleType`, rename titles, assign IDs, save state, reorder, or delete anything.
- **Adapter adoption:** Do not broadly adopt the runtime adapter in Phase 5D unless a separate audit proves it is necessary; current app presence can be fixed with registry-backed `app.js` helpers.
- **Section placement:** Consider leaving `getBrandWorkspaceSectionForCustomTileTitle()` unchanged in the minimum Phase 5D fix unless the PR explicitly scopes Brand Workspace placement. Presence and placement should not be combined if that would broaden risk.

## Explicit Non-Goals

A Phase 5D implementation should explicitly avoid:

- title-only detection for typed renamed tiles,
- reclassifying a tile with a valid canonical `moduleType` through its editable title,
- migrating state,
- mutating legacy tiles,
- writing `moduleType` to existing tiles,
- fuzzy title matching,
- inferring type from arbitrary content,
- broad adapter adoption,
- UI redesign,
- changing creation or duplicate-prevention behavior,
- changing stable IDs or selection keys,
- changing deletion behavior,
- combining readiness/completion semantics with canonical identity detection.

## Suggested Manual QA

1. Create a typed Market Research tile through Missing Knowledge and confirm Dashboard Brand Evolution and Brand Workspace no longer show Market Research missing.
2. Rename the typed Market Research tile to `Competitor Intelligence` and confirm Market Research still does not show as missing.
3. Create or load an untyped legacy tile titled `Market Research` and confirm Market Research is considered present without mutating the tile.
4. Create or load a tile with `moduleType: "unknown_type"` and title `Market Research`; confirm Market Research is considered present through legacy fallback and the tile is not mutated.
5. Create or load a tile with `moduleType: "founder_story"` and title `Market Research`; confirm Founder Story is present and Market Research is not considered present because of that title.
6. Create the multiple-conflict case with typed Market Research titled `Competitor Notes` and typed Founder Story titled `Market Research`; confirm both Market Research and Founder Story are present through their valid types and the Founder Story title does not create a second Market Research identity.
7. Create a manual untyped Custom Tile renamed to `Business Plan`; confirm Business Plan remains legacy-present and the tile remains untyped.
8. Delete a typed Whitepaper tile; confirm Whitepaper becomes missing again unless a valid typed Whitepaper or exact legacy Whitepaper tile remains.
9. Confirm Dashboard Brand Evolution, Brand Workspace Missing Knowledge suggestions, and Dashboard Suggested Opportunities agree on canonical present/missing status.
10. Confirm no source tile is mutated by presence checks.

## Files Inspected

- `docs/audits/2026-07-10-knowledge-module-architecture-audit.md`
- `docs/audits/2026-07-12-knowledge-module-registry.md`
- `docs/audits/2026-07-12-knowledge-module-runtime-adapter-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5a-persist-module-type-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5b-adapter-module-type-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5c-duplicate-prevention-audit.md`
- `docs/audits/2026-07-13-runtime-boot-and-change-scope-stabilization.md`
- `docs/constitution/engineering-constitution.md`
- `app.js`
- `knowledge-module-registry.js`
- `knowledge-module-runtime-adapter.js`

## Files Changed

- `docs/audits/2026-07-13-knowledge-module-phase5d-presence-detection-audit.md`
