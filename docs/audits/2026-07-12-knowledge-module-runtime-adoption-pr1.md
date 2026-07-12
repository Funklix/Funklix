# Knowledge Module Runtime Adoption PR 1 — Registry as Single Source of Truth

| Field | Value |
|---|---|
| Date | 2026-07-12 |
| Type | Read-only runtime metadata adoption audit and implementation record |
| Scope | Replace duplicated static Brand Workspace metadata lookups with Knowledge Module Registry reads |
| Runtime behavior changes | None intended; metadata source only |
| Files changed | `app.js`, `index.html`, `knowledge-module-registry.js`, `docs/audits/2026-07-12-knowledge-module-runtime-adoption-pr1.md` |

## Summary

This PR is the first runtime adoption step for the Knowledge Module Registry. It keeps the registry read-only and uses it only as a static metadata provider for labels and section routing that were previously duplicated in `app.js`.

No modules are created by the registry. No custom tiles are migrated. No persistence, save/load, snapshots, APIs, AI, uploads, Brand Core state shape, editor behavior, event delegation, DOM IDs, Canvas, Boards, Dashboard, AI Brain, or Insights behavior is changed.

The only runtime wiring added is loading the metadata-only registry before `app.js`, then reading its definitions from existing Brand Workspace helper functions.

## Dependency Findings

### 1. Current Missing Knowledge mapping

Before this PR, Missing Knowledge section routing existed as hardcoded runtime metadata in `app.js`:

- `Founder Story` → `intelligence`
- `Market Research` → `strategy`
- `Business Plan` → `strategy`
- `Pitch Deck` → `deployment`
- `Whitepaper` → `deployment`

This duplicated metadata already present in the registry.

Risk:

- Medium. Missing Knowledge prompts must appear in exactly the same sections and must continue to create/select existing Custom Brand Tiles by canonical title.

Safe replacement:

- Keep the same Missing Knowledge module IDs in a tiny allowlist.
- Read labels and sections from `getModuleDefinition()`.
- Keep the existing Dashboard knowledge detection and custom tile creation logic unchanged.

### 2. Current Brand Workspace section routing

The Brand Workspace still renders the same visual sections and DOM structure:

- Foundation
- Strategy
- Intelligence
- Deployment
- Custom Knowledge

The registry now supplies section metadata for canonical Missing Knowledge modules, but the actual section DOM and layout are not refactored.

Risk:

- High if section markup changes.

Safe replacement:

- Do not change section markup.
- Only use registry metadata to resolve which Missing Knowledge labels belong in an already-existing section.

### 3. Current hardcoded module labels

`renderBrandCoreTiles()` used a duplicated `titleMap` for built-in card labels. `renderBrandCoreEditor()` used a separate duplicated `labelMap` for editor titles.

Duplicated labels included:

- Brand Core
- Tone of Voice
- Messaging Pillars
- Value Proposition
- Personas
- Content Guidelines
- Do's & Don'ts
- Brand Voice Examples
- Keywords
- Brand Assets

Risk:

- Medium. Card/editor labels must remain visually identical.

Safe replacement:

- Add a small runtime key-to-registry-ID map in `app.js`.
- Read labels from registry definitions.
- Preserve the existing editor label for Do / Don't through a registry `editorLabel` metadata field.
- Preserve the existing Brand Voice Examples label by using `Brand Voice Examples` in the registry.

### 4. Current hardcoded descriptions

Most current card descriptions are dynamic previews from Brand Core state, not static metadata. Group descriptions remain shell copy rather than per-module metadata.

Risk:

- High if dynamic previews are replaced by static descriptions.

Safe replacement:

- Do not replace dynamic previews.
- Do not alter group copy.
- Keep registry descriptions available for future PRs only.

### 5. Current icon selection

Brand Workspace does not currently render per-module registry icons. The registry includes `iconName` metadata, but runtime has no icon rendering contract for these modules yet.

Risk:

- Medium if icons are added because visible UI would change.

Safe replacement:

- Do not render icons in this PR.
- Keep `iconName` as metadata for later migration.

### 6. Current title → section mapping

The only title-to-section mapping used at runtime is for canonical Missing Knowledge custom tiles. That is now read from the registry labels/sections via the existing helper flow.

Risk:

- Medium if user-created custom tile titles are interpreted too broadly.

Safe replacement:

- Continue to match only the same five canonical Missing Knowledge modules.
- Do not fuzzy-match or infer additional modules.

### 7. Current custom tile grouping

Custom tile grouping remains unchanged:

- canonical Missing Knowledge tiles render in their registry section if the title matches a known canonical module.
- all other valid custom tiles render in Custom Knowledge.
- invalid/malformed generated placeholders remain skipped.

Risk:

- High if custom tile identity or render placement is changed.

Safe replacement:

- Only replace section lookup metadata, not custom tile rendering logic.

### 8. Current Brand Workspace rendering

Brand Workspace rendering remains centered in `renderBrandCoreTiles()` and is not refactored. The registry is loaded before `app.js` and read by helper functions only.

Risk:

- High if rendering architecture is rewritten.

Safe replacement:

- Keep all DOM IDs, `.bc-node[data-bc-key]` targets, event delegation, editor rendering, and persistence flows unchanged.

## Duplicated Metadata Found

| Duplicated metadata | Previous location | Registry source now used |
|---|---|---|
| Missing Knowledge labels | `BRAND_WORKSPACE_MISSING_KNOWLEDGE_SECTIONS` | `getModuleDefinition(id).label` |
| Missing Knowledge sections | `BRAND_WORKSPACE_MISSING_KNOWLEDGE_SECTIONS` | `getModuleDefinition(id).section` |
| Built-in card labels | `titleMap` inside `renderBrandCoreTiles()` | `getModuleDefinition(id).label` |
| Editor titles | `labelMap` inside `renderBrandCoreEditor()` | `getModuleDefinition(id).label` / `editorLabel` |
| Brand Voice Examples label | app local maps | Registry label |
| Do / Don't editor label | app local map | Registry `editorLabel` |

## Registry Adoption Points

### `index.html`

The registry is loaded before `app.js`:

```html
<script src="/knowledge-module-registry.js"></script>
<script src="/app.js"></script>
```

This makes `window.KnowledgeModuleRegistry` available before Brand Workspace helpers are evaluated.

### `knowledge-module-registry.js`

The registry now supports both environments:

- CommonJS export for Node checks/tests.
- Browser global export via `window.KnowledgeModuleRegistry`.

A tiny metadata addition preserves current editor behavior:

- `dos_and_donts.editorLabel = "Do / Don't"`

The `voice_examples` label is aligned to the existing runtime label:

- `Brand Voice Examples`

### `app.js`

Runtime adoption is intentionally narrow:

- adds `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` as the allowlist of existing Missing Knowledge modules.
- adds `BRAND_CORE_KEY_TO_KNOWLEDGE_MODULE_ID` to map existing Brand Core state keys to registry IDs.
- adds read-only registry access helpers.
- derives Missing Knowledge section labels from registry definitions.
- derives built-in card labels from registry definitions.
- derives editor titles from registry definitions.

No state mutations, rendering architecture changes, editor rewrites, or persistence changes are included.

## Files Changed

- `knowledge-module-registry.js`
  - exposes the registry as a browser global in addition to CommonJS.
  - adds `editorLabel` metadata for Do / Don't.
  - aligns Voice Examples label with existing runtime wording.

- `index.html`
  - loads `knowledge-module-registry.js` before `app.js`.

- `app.js`
  - replaces duplicated app-local module label/section maps with registry reads.
  - keeps existing Missing Knowledge allowlist, tile creation, tile deletion, editor, and render flows unchanged.

- `docs/audits/2026-07-12-knowledge-module-runtime-adoption-pr1.md`
  - records dependency findings, duplicated metadata, adoption points, runtime confirmation, risks, rollback, and QA.

## Behavior Unchanged Confirmation

This PR does **not** change:

- Brand Workspace layout
- sticky editor
- section grouping
- Missing Knowledge UX
- custom tile creation
- custom tile deletion
- custom tile rendering
- Brand DNA
- Brand Avatar
- Website Analysis
- Dashboard
- Boards
- Canvas
- AI Brain
- Insights
- routing
- autosave
- save/load
- persistence
- storage
- snapshots
- APIs
- event handlers
- DOM IDs

## Future Migration Opportunities

Future PRs can now safely consider:

1. Replacing the Missing Knowledge allowlist with registry capability metadata.
2. Moving Brand Workspace group metadata to the registry.
3. Adding helper tests for registry metadata consistency.
4. Adding stable custom tile IDs in a backward-compatible PR.
5. Adding optional module type metadata to canonical custom tiles.
6. Extracting module card renderers without changing DOM output.
7. Extracting module editor adapters without changing editor behavior.

## Risks

### Registry load order

Risk:

- `app.js` now expects `window.KnowledgeModuleRegistry` to be available for registry-backed labels and Missing Knowledge routing.

Mitigation:

- `index.html` loads `knowledge-module-registry.js` immediately before `app.js`.
- `knowledge-module-registry.js` remains syntax-checked and CommonJS-compatible.

### Label drift

Risk:

- Changing registry labels could change visible card/editor labels.

Mitigation:

- Existing visible labels are preserved.
- Future label changes should be treated as UI copy changes and QAed manually.

### Section metadata drift

Risk:

- Changing registry sections for the five Missing Knowledge modules could move prompts/tiles.

Mitigation:

- Runtime still uses a five-module allowlist.
- Future section changes should be made in a dedicated PR.

## Rollback

Rollback is straightforward:

1. Remove the registry script tag from `index.html`.
2. Restore the previous local Missing Knowledge section map in `app.js`.
3. Restore the previous local `titleMap` and `labelMap` in `app.js`.
4. Revert the browser-global export / metadata label additions in `knowledge-module-registry.js`.
5. Delete this audit document.

No storage, snapshot, API, data, or persistence rollback is required.

## Manual QA

1. Open Brand Workspace.
2. Confirm every existing module still appears.
3. Confirm section grouping is unchanged.
4. Confirm Missing Knowledge still appears exactly as before.
5. Confirm Add Tile still works.
6. Confirm Delete Tile still works.
7. Confirm existing custom tiles still render.
8. Confirm Brand DNA works.
9. Confirm Brand Avatar works.
10. Confirm Website Analysis works.
11. Confirm save/reload.
12. Confirm Dashboard unchanged.
13. Confirm Boards unchanged.
14. Confirm Canvas unchanged.
15. Confirm AI Brain unchanged.
16. Confirm no console errors.
