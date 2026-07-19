# Founder Story Module F2 — Card Preview and Derived Completion Status Audit

## Summary

Founder Story F2 adds read-only card presentation for valid typed Founder Story Custom Tiles. The Brand Workspace card now shows a compact derived status and one concise preview while preserving existing card selection, section routing, stable IDs, F1 editor behavior, deletion, save/load, autosave, and generic card behavior.

F2 does not add AI, APIs, persistence fields, registry metadata, editor changes, card actions, readiness architecture, percentages, or legacy migration.

## Dependency Findings

- Phase 5D already aligns visible Missing Knowledge presence with persisted canonical `moduleType`, so card preview/status can remain presentation-only.
- F0 already routes typed canonical Custom Tiles by registry-backed `moduleType`, so a renamed typed Founder Story card remains in its canonical section before F2 renders its preview.
- F1 already provides typed Founder Story structured source fields under `moduleData.founderStory` and keeps the narrative in `tile.content`.
- The existing `isFounderStoryCustomTile(tile)` discriminator validates `moduleType` through `getValidPersistedMissingKnowledgeModuleDefinition(tile)`, so F2 can reuse it without title-based specialization.
- The existing `getFounderStoryModuleData(tile)` helper returns safe display defaults without mutating source state, so F2 can reuse it for card status and preview derivation.
- Existing `escapeHtml()` is available for safe card output.

## Existing Card Render Flow

`renderBrandCoreTiles()` renders Brand Workspace sections, refreshes Missing Knowledge blocks, removes existing custom rows/cards, updates core module cards, then iterates `state.brandCore.customTiles`. For each valid non-malformed Custom Tile, it creates an `article.bc-node`, assigns the existing runtime key to `data-bc-key`, writes card HTML, resolves the section through `getBrandWorkspaceSectionForCustomTile(tile)`, and appends the card to either the matching canonical section row or the Custom Knowledge fallback row.

Before F2, every Custom Tile card shared the same markup:

- `.bc-title` with the editable tile title or `Custom Tile` fallback.
- `.bc-preview` with the first 120 characters of `tile.content`.
- `.bc-count` with the generic `custom` label.

The card is a navigation surface. It does not contain buttons or nested interactive controls, and selection continues to use existing delegated card click behavior through `data-bc-key`.

## Specialized Card Discriminator

Founder Story-specific card presentation applies only when:

```js
isFounderStoryCustomTile(tile)
```

That helper resolves the persisted `moduleType` through the existing canonical registry-backed helper and requires `founder_story`. It does not use title matching. Therefore:

- Valid typed Founder Story tiles get specialized status and preview.
- Renamed typed Founder Story tiles get specialized status and preview.
- Legacy untyped tiles titled `Founder Story` remain generic.
- Invalid `moduleType` tiles titled `Founder Story` remain generic.
- Other typed modules remain generic.

## Derived Status Model

F2 implements exactly three read-only statuses:

| Status id | Label | Rule |
|---|---|---|
| `empty` | Empty | All seven normalized structured fields are empty after trimming and `tile.content` is empty after trimming. |
| `in_progress` | In progress | At least one normalized structured field has content and `tile.content` is empty after trimming. |
| `story_ready` | Story ready | `tile.content` has meaningful trimmed narrative text. |

Narrative content is authoritative for `Story ready`. The status is derived during rendering and is never persisted.

## Preview Resolution Order

F2 derives one preview string for valid typed Founder Story cards in this order:

1. `tile.content` narrative when non-empty after whitespace normalization.
2. `observedProblem`.
3. `motivation`.
4. `turningPoint`.
5. `background`.
6. `vision`.
7. `founderNameRole`.
8. `proofPoints`.
9. Empty-state copy: `Capture the founder’s origin, motivation, turning point, and vision.`

The preview does not concatenate fields, generate content, rewrite user text, or mutate source data.

## Preview Truncation and Escaping

No reusable excerpt helper existed for Custom Tile cards beyond inline `slice(0, 120)`. F2 adds a narrowly scoped Founder Story preview helper using the same conservative 120-character card length. The helper trims leading/trailing whitespace, collapses repeated whitespace for display, and adds an ellipsis when truncation is required.

Card output is escaped with the existing `escapeHtml()` helper. F2 does not add markdown or raw HTML rendering.

## Card UX

The typed Founder Story card remains compact and keeps the existing card structure:

- `.bc-title` continues to show the editable tile title.
- `.bc-preview` shows one concise preview paragraph.
- `.bc-count` shows the status label: `Empty`, `In progress`, or `Story ready`.

No progress bar, percentage, extra badge stack, edit button, AI button, regenerate control, expander, field list, tooltip, dropdown, or new card action was added.

## Styling Decision

`styles.css` was not changed. F2 reuses existing `.bc-title`, `.bc-preview`, and `.bc-count` styles. The status text is visible in `.bc-count`, so the status is not communicated by color alone. No new global or Founder Story-scoped CSS was required.

## Generic Card Preservation

Generic Custom Tile output remains unchanged for:

- Manual Custom Tiles.
- Legacy untyped tiles titled `Founder Story`.
- Invalid type tiles.
- Market Research.
- Business Plan.
- Pitch Deck.
- Whitepaper.
- Other Custom Tiles.

The only card-render branch is a narrow `isFounderStoryCustomTile(tile)` check around the existing Custom Tile card markup assignment.

## F1 Editor Preservation

F2 does not modify the Founder Story specialized editor, seven structured fields, DOM IDs, save-on-input behavior, title editing, narrative editing, delete behavior, `getFounderStoryModuleData()` semantics, moduleData storage shape, or save merge behavior.

## No-Mutation Confirmation

All F2 helpers are read-only. Card rendering and derived helpers do not create `moduleData`, create `founderStory`, fill defaults into state, trim or rewrite stored strings, save, autosave, reorder data, change title, change content, change items, change references, assign IDs, or change `moduleType`.

## Files Changed

- `app.js`
- `docs/audits/2026-07-19-founder-story-f2-card-preview-status-audit.md`

## Runtime Confirmation

Runtime scope is exactly one runtime file: `app.js`. No stylesheet, registry, runtime adapter, identity, HTML, campaign, API, script, workflow, persistence, editor field, Missing Knowledge, Dashboard, or AI file changed.

## Risks

| Risk | Mitigation |
|---|---|
| Card render accidentally mutates structured data | F2 uses normalization helpers that return display strings and never writes to tile state. |
| Status becomes confused with persisted readiness | Status is derived during render and no status fields are saved. |
| Generic Custom Tiles change unexpectedly | The generic card markup remains the fallback branch and is unchanged. |
| Legacy title-only Founder Story is specialized by mistake | The branch uses validated `moduleType`, not title. |
| Preview overflows card | Preview is whitespace-normalized and truncated to the existing 120-character card length. |
| Raw user HTML renders in specialized preview | Founder Story card title, preview, and status are escaped with `escapeHtml()`. |
| Click behavior regresses | F2 adds no buttons, nested controls, or event listeners to cards. |
| F1 editor behavior changes | F2 only reads F1 data and does not alter editor code or save merge logic. |

## Rollback

Rollback can remove the Founder Story card helper functions and restore the Custom Tile card `innerHTML` assignment to the single generic markup line. No data migration or cleanup is required because F2 persists no status or preview fields.

## Manual QA

A. Empty tile

1. Create Founder Story through Missing Knowledge.
2. Confirm the card shows `Empty` and the empty-state preview.
3. Confirm clicking the card opens the F1 specialized editor.

B. Structured data only

4. Enter only motivation.
5. Confirm the card updates through the existing render/save flow.
6. Confirm status is `In progress` and motivation appears as the preview.
7. Enter observed problem.
8. Confirm observed problem becomes the preferred structured preview.

C. Narrative

9. Enter narrative content.
10. Confirm status is `Story ready` and narrative becomes the preview.
11. Clear narrative while keeping structured fields.
12. Confirm status returns to `In progress`.

D. Whitespace handling

13. Enter whitespace-only narrative.
14. Confirm it does not count as `Story ready`.
15. Enter whitespace around meaningful text.
16. Confirm preview is normalized for display without mutating stored source.

E. Rename

17. Rename Founder Story to `Why We Started`.
18. Confirm custom title remains, status and preview remain visible, tile remains in the canonical section, and the specialized editor still opens.

F. Legacy and generic tiles

19. Open or create an untyped manual tile titled `Founder Story`.
20. Confirm its card remains generic.
21. Open Market Research.
22. Confirm its card remains unchanged.
23. Open a normal manual Custom Tile.
24. Confirm its card remains unchanged.

G. Malformed data

25. Test missing, null, or malformed `moduleData.founderStory`.
26. Confirm no card-render exception.
27. Confirm no red console error.
28. Confirm source state is unchanged merely by rendering.

H. Selection regression

29. Click status text and preview area.
30. Confirm the tile still selects normally.
31. Confirm no duplicate click behavior.
32. Confirm runtime key and selected tile remain correct.

I. Reload

33. Save Founder Story fields and narrative.
34. Reload.
35. Confirm status and preview derive correctly from restored data.

J. Delete

36. Delete Founder Story through the existing editor.
37. Confirm the card disappears, Missing Knowledge returns, and no stale card status remains.

K. Boot regression

38. Open Preview in incognito.
39. Open DevTools before reload.
40. Confirm no red Funklix script errors.
41. Confirm Google Sign-In responds.
42. Confirm session, Board, Brand, and Canvas load.
43. Confirm Dashboard, Boards, Brand Workspace, AI Brain, and Insights open.

## Deferred F3 Scope

F3 remains the appropriate follow-up for one AI-assisted Founder Story generation action. F2 intentionally does not add API calls, prompt construction, loading states, error states, overwrite confirmation, generated content, readiness metadata, or registry-driven specialized card infrastructure.
