# Brand Core Actionable Missing Knowledge Tiles Audit

| Field | Value |
|---|---|
| Date | 2026-07-10 |
| Type | Brand Core UX Unification Sprint 1 PR 3 audit and implementation record |
| Scope | Turn contextual Missing Knowledge prompts into safe Custom Brand Tile setup shortcuts |
| Runtime behavior changes | Uses existing custom tile state and Brand Brain persistence only |
| Files changed | `app.js`, `styles.css`, `docs/audits/2026-07-10-brand-core-actionable-missing-knowledge-audit.md` |

## Summary

This PR makes contextual Missing Knowledge prompts actionable without adding Brand fields, AI generation, uploads, APIs, new persistence, canonical Brand records, Dashboard changes, Boards changes, Canvas changes, AI Brain changes, Insights changes, routing changes, or autosave changes.

Clicking a Missing Knowledge item now creates or selects a matching existing Custom Brand Tile and opens it in the existing Brand Core editor. The action creates structure only: title is the canonical missing-knowledge title, content is an empty string, and no invented Brand truth is saved.

## Existing Custom Tile Architecture

Current custom tiles live in the existing board-scoped Brand Core state:

- `state.brandCore.customTiles`
- tile shape currently used by the editor: `{ title, content, items }`
- selection key: `custom:${index}`
- editor path: `renderBrandCoreEditor()` handles `custom:*`
- add path: the existing `custom:add` branch pushes `{ title: "New Custom Tile", content: "", items: [] }`
- persistence path: `saveBrandBrainState()` serializes existing Brand Core state and marks the board dirty

No category or section metadata exists on custom tiles today. This PR does not add persisted section metadata.

## Missing Knowledge Source Logic

The existing source of truth remains `getDashboardKnowledgeInputStatus()`.

That helper checks existing Brand Core text, value proposition, custom tile title/content, and Brand Assets references for the five existing labels:

- Founder Story
- Market Research
- Pitch Deck
- Whitepaper
- Business Plan

Once a custom tile with one of those canonical titles exists, the existing detection logic naturally marks the item present because custom tile titles are already included in the searchable Brand knowledge text.

## Canonical Title Mapping

Supported canonical titles and primary visual sections are intentionally limited to:

| Canonical title | Primary visual section |
|---|---|
| Founder Story | Intelligence |
| Market Research | Strategy |
| Business Plan | Strategy |
| Pitch Deck | Deployment |
| Whitepaper | Deployment |

No additional mappings, semantic inference, or fuzzy matching were added.

## Duplicate Prevention

Duplicate prevention is conservative:

- Trim leading/trailing whitespace.
- Collapse internal whitespace to a single space.
- Compare case-insensitively.
- Compare only against the supported canonical title set.
- Do not fuzzy-match semantic alternatives.
- Do not overwrite existing tile content.

Examples that resolve to the same existing tile:

- `Founder Story`
- `founder story`
- ` Founder Story `
- `FOUNDER STORY`

If a matching tile exists, the click selects it and opens the editor. If not, one tile is created.

## Section Placement Approach

Because custom tiles do not currently support category or section metadata, this PR uses deterministic title-based visual placement only:

- Custom tiles whose titles match a supported canonical missing-knowledge title are visually rendered in the mapped Strategy, Intelligence, or Deployment section.
- Other custom tiles remain in Custom Knowledge.
- No persisted schema is changed.
- Existing custom tiles are not migrated or rewritten.
- Unrelated user-created custom tiles are not moved.

This satisfies the setup shortcut goal while avoiding a new storage model.

## Persistence Path Reused

Creation reuses only existing Brand Core paths:

1. Normalize current Brand Core state with `normalizeBrandCoreState()`.
2. Push `{ title: canonicalTitle, content: "", items: [] }` into `state.brandCore.customTiles` when no match exists.
3. Select `custom:${index}`.
4. Call `saveBrandBrainState()` only for newly created tiles.
5. Re-render tiles/editor with existing render functions.

No localStorage key, board snapshot shape, API, save/load payload, table, endpoint, prompt, or generation path was changed.

## Files Changed

- `app.js`
  - Adds canonical title normalization and lookup helpers.
  - Adds duplicate-preventing create/select helper.
  - Renders Missing Knowledge pills as accessible buttons.
  - Adds event delegation for Missing Knowledge actions on `#brand-core-canvas`.
  - Visually places canonical missing-knowledge custom tiles in their mapped sections.
- `styles.css`
  - Adds hover/focus/pointer styling for actionable Missing Knowledge pills.
- `docs/audits/2026-07-10-brand-core-actionable-missing-knowledge-audit.md`
  - Documents architecture, mapping, duplicate prevention, persistence reuse, risks, rollback, and QA.

## IDs and Handlers Preserved

Preserved IDs:

- `#brand-core-workspace`
- `#brand-core-canvas`
- `#bc-editor-title`
- `#bc-editor-panel`
- `#reset-brand-core-btn`
- `#brand-dna-card`

Preserved existing behavior:

- `.bc-node[data-bc-key]` delegated selection
- `custom:add`
- existing custom tile editing/removal
- Brand Brain persistence
- Brand DNA generation/refine/regenerate/accept
- Brand Avatar behavior
- website analysis
- reset behavior
- Dashboard Brand Evolution
- Boards Brand display snapshot
- save/load
- autosave
- routing
- Canvas
- AI Brain
- Insights

The new Missing Knowledge action uses the existing `#brand-core-canvas` delegated click surface and returns before `.bc-node` selection, avoiding duplicate tile-selection behavior.

## Runtime Confirmation

This PR does not:

- generate Founder Story content
- analyze Market Research
- upload Pitch Decks
- upload Whitepapers
- parse Business Plans
- add file storage
- add document ingestion
- add AI prompts
- create canonical Brand fields
- change Workspace/Brand ownership
- redesign individual editors
- change Dashboard UI
- change Boards UI
- change Canvas
- change AI Brain
- change Insights
- change APIs
- change storage schema

## Risks

### Title-based section placement

Because there is no persisted custom tile section field, visual placement is based on canonical title matching only. If a user renames a tile away from the canonical title, it returns to Custom Knowledge and the Missing Knowledge prompt may return through existing detection logic.

### Literal detection

The existing missing-knowledge detection is literal string detection, not semantic analysis. This PR intentionally preserves that behavior.

### Existing custom tiles with canonical titles

An existing user-created tile titled `Founder Story`, `Market Research`, `Business Plan`, `Pitch Deck`, or `Whitepaper` will be selected rather than duplicated and visually placed in the mapped section. Its content is never overwritten.

## Rollback

Rollback steps:

1. Remove canonical title / duplicate-prevention helpers from `app.js`.
2. Render Missing Knowledge items as non-actionable pills again.
3. Remove the Missing Knowledge click branch from `#brand-core-canvas` delegation.
4. Remove title-based custom tile section placement.
5. Remove the PR 3 Missing Knowledge action CSS block from `styles.css`.
6. Remove this audit document.

Existing created custom tiles can remain because they use the existing custom tile schema and can be edited or removed by users.

## Manual QA

1. Open Brand Workspace with all five items missing.
2. Click Founder Story.
3. Confirm exactly one Founder Story custom tile is created.
4. Confirm the new tile is selected and opened in the editor.
5. Confirm its content is empty and no invented Brand truth is saved.
6. Confirm Founder Story disappears from Missing Knowledge.
7. Click the same action again or reproduce with title casing differences.
8. Confirm no duplicate tile is created.
9. Repeat for:
   - Market Research
   - Business Plan
   - Pitch Deck
   - Whitepaper
10. Confirm each tile appears in the intended visual section.
11. Reload the page.
12. Confirm created tiles persist using the existing persistence path.
13. Edit tile content and confirm it saves normally.
14. Remove a created tile.
15. Confirm the corresponding Missing Knowledge prompt returns.
16. Confirm sticky editor and scrolling remain correct.
17. Confirm Brand DNA, Avatar, website analysis, and reset still work.
18. Confirm Dashboard Brand Evolution updates consistently.
19. Confirm Boards, Canvas, AI Brain, and Insights are unaffected.
