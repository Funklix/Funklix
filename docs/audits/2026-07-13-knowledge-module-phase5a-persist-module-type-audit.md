# Knowledge Module Phase 5A — Persist Module Type Audit

## Summary

Phase 5A persists the canonical registry module ID as `moduleType` only when a new Missing Knowledge tile is created through the explicit canonical Brand Workspace Missing Knowledge action. The change is intentionally limited to `app.js` plus this audit document. It does not change runtime adapter reads, duplicate prevention, rendering, hydration, editing, deletion, manual custom tile creation, serializers, or storage keys.

## Dependency Findings

1. The current Missing Knowledge creation function is `createOrSelectMissingKnowledgeTile(rawTitle = "")` in `app.js`. Before this change, it resolved a canonical title, checked for an existing tile by canonical title, and pushed `createBrandCustomTile(canonicalTitle, "")` only when no matching tile existed.
2. The existing five-module allowlist is `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS`, which contains `founder_story`, `market_research`, `business_plan`, `pitch_deck`, and `whitepaper`.
3. The registry-backed lookup path already exists through `getMissingKnowledgeModuleDefinitions()`, which maps the allowlisted IDs through `getRuntimeKnowledgeModuleDefinition()` and filters missing registry definitions.
4. Stable ID creation already flows through `createBrandCustomTile()`, which calls `createKnowledgeModuleInstanceId()`. That helper delegates to `window.KnowledgeModuleIdentity.createKnowledgeModuleInstanceId()` when available and otherwise falls back to a `km_` timestamp/random ID.
5. The exact Missing Knowledge object before this change was the same object produced by `createBrandCustomTile(canonicalTitle, "")`: `{ id, title, content, items: [] }`.
6. Creation previously had access to a canonical registry-backed title but not the module ID at the push site. This change adds the existing registry module ID to the canonical Missing Knowledge action as `data-missing-knowledge-module-id` and resolves that requested ID through the existing allowlisted registry-backed definitions before creation, so the push site has both `definition.id` and `definition.label`.
7. `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` has exactly one top-level declaration in `app.js`.
8. No new allowlist or duplicate constant is required. The existing allowlist and Knowledge Module Registry remain the only source for supported Missing Knowledge module IDs.
9. Manual Add Custom Tile uses a separate creation path in `renderBrandCoreEditor()` when `state.brandCoreSelectedKey === "custom:add"`; it still calls `createBrandCustomTile("New Custom Tile", "")` without a `moduleType` option.
10. Existing persistence serializes `state.brandCore` with `clonePlainObject(state.brandCore)` and stores it with `JSON.stringify(brandState)`, so arbitrary Custom Tile object fields naturally survive without serializer changes.

## Exact Creation Path Changed

Only the canonical Missing Knowledge creation path changed:

- `createOrSelectMissingKnowledgeTile(rawTitle = "")` now resolves `definition` with `getMissingKnowledgeModuleDefinitionForRequest(rawTitle)`.
- Invalid or unsupported requested registry IDs return before mutation; the existing title path remains only as a compatibility fallback for the current title-based Missing Knowledge helpers.
- New canonical tiles are pushed with `createBrandCustomTile(canonicalTitle, "", { moduleType: definition.id })`.
- Existing duplicate prevention remains title-based via `findBrandWorkspaceCustomTileIndexByTitle(canonicalTitle)`.

## Registry Definition Reused

The change reuses the existing registry-backed Missing Knowledge configuration:

- `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS`
- `getMissingKnowledgeModuleDefinitions()`
- `getRuntimeKnowledgeModuleDefinition(moduleId)`
- `KnowledgeModuleRegistry.getModuleDefinition(moduleId)`

No hardcoded title/type map was added.

## Supported Module Types

The supported canonical Missing Knowledge module IDs remain:

- `founder_story`
- `market_research`
- `business_plan`
- `pitch_deck`
- `whitepaper`

## New Stored Shape

A newly created canonical Missing Knowledge tile now stores the registry module type while preserving the existing generated stable ID and existing supported fields:

```js
{
  id: "km_...",
  title: "Market Research",
  content: "",
  items: [],
  moduleType: "market_research"
}
```

## Manual Custom Tile Behavior

Manual Add Custom Tile remains unchanged. The manual path calls `createBrandCustomTile("New Custom Tile", "")` without `moduleType`, so a manual tile does not receive `moduleType: "custom"` or any canonical module type. Renaming a manual tile to `Market Research` only updates `tile.title`; it does not write or change `tile.moduleType`.

## Legacy Compatibility

Existing loaded tiles are not migrated or rewritten. Hydration, rendering, editing, saving, adapter reads, and Brand Workspace opening do not assign `moduleType` to legacy tiles. Existing tiles without `moduleType` remain valid.

## Persistence Verification

`saveBrandBrainState()` continues to call `getBrandCoreData()`, which serializes the normalized Brand Core snapshot via `clonePlainObject(state.brandCore)`, then writes it to localStorage with `JSON.stringify(brandState)`. Because Custom Tile objects are preserved inside `state.brandCore.customTiles`, `moduleType` persists naturally through the existing Custom Tile persistence path.

## Duplicate Declaration Check

`BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` was checked with ripgrep and the browser script integrity checker. There is exactly one top-level declaration in `app.js`, and no new duplicate constant was introduced.

## Files Changed

- `app.js`
- `docs/audits/2026-07-13-knowledge-module-phase5a-persist-module-type-audit.md`

## Runtime Confirmation

The required boot-safety commands passed after the change:

- `node --check app.js`
- `node scripts/check-browser-script-integrity.js`
- `node scripts/check-knowledge-module-browser-globals.js`

Additional requested syntax checks and scope checks also passed.

## Risks

- Existing duplicate prevention is still title-based by design, so a legacy canonical tile without `moduleType` continues to block duplicate creation.
- The runtime adapter still ignores persisted `moduleType`; adapter adoption is intentionally deferred to a later PR.

## Rollback

Rollback is straightforward: revert the `app.js` changes that add the optional `moduleType` assignment and remove this audit document. No migration or storage cleanup is required because legacy tiles and new fields are tolerated by existing serialization.

## Manual QA

A. Canonical creation

1. Open Brand Workspace.
2. Create Founder Story through its Missing Knowledge action.
3. Confirm exactly one tile appears.
4. Inspect state and confirm:
   - `id` begins with `km_`
   - `moduleType` is `founder_story`
   - `title` is `Founder Story`
   - `content` is empty
5. Reload.
6. Confirm the same `id` and `moduleType` remain.
7. Repeat for `market_research`, `business_plan`, `pitch_deck`, and `whitepaper`.

B. Manual tile

8. Create a manual Custom Tile.
9. Confirm it has a stable `km_` id.
10. Confirm `moduleType` is absent.
11. Rename it to `Market Research`.
12. Confirm `moduleType` remains absent.

C. Existing behavior

13. Confirm clicking the same canonical Missing Knowledge action does not create a duplicate.
14. Confirm existing legacy canonical tiles still work.
15. Confirm Delete Tile still works.
16. Confirm deleted Missing Knowledge suggestions return as before.

D. Boot regression

17. Open Preview in incognito.
18. Open DevTools before reloading.
19. Confirm no red errors from `app.js`, `knowledge-module-registry.js`, `knowledge-module-identity.js`, or `knowledge-module-runtime-adapter.js`.
20. Confirm Google Sign-In responds.
21. Confirm user/session loads.
22. Confirm Board and Brand context load.
23. Confirm Canvas nodes render.
24. Confirm Dashboard, Boards, Brand Workspace, AI Brain, and Insights open.
25. Confirm there is no duplicate declaration SyntaxError.
