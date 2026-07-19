# Founder Story F2.5 — Pre-AI Editor UX Polish Audit

## Summary

Founder Story F2.5 improves the existing specialized Founder Story editor through copy, field order, source/narrative hierarchy, placeholders, and explicit label/control associations. The change is intentionally limited to the editor presentation layer in `app.js` plus this audit document.

F2.5 does not add AI, API routes, prompt construction, persistence changes, state-model changes, card changes, save feedback, validation requirements, registry capabilities, legacy specialization, or generic editor changes.

## Dependency Findings

- The pre-AI UX/product review concluded Founder Story is ready for AI after minor UX polish, specifically editor copy, field order, source/narrative hierarchy, placeholders, and label associations.
- F0 section routing already keeps valid typed Founder Story tiles in the registry-defined canonical section after title edits.
- F1 already provides the typed Founder Story editor branch, seven stored keys, additive `moduleData.founderStory` merge, narrative storage in `tile.content`, immediate save-on-input behavior, and generic fallback.
- F2 already provides the card status and preview; F2.5 intentionally does not alter card labels, preview order, card markup, section routing, or selection.
- Existing `.bc-helper`, `.bc-editor-meta`, `.bc-badge`, label, input, textarea, and default heading styles are sufficient for the polish; no stylesheet change is required.

## Existing Editor Structure

Before F2.5, the Founder Story editor rendered:

- a `Founder Story Knowledge Module` helper/badge row;
- one broad introductory helper sentence;
- a title label/input without an explicit `for` attribute;
- seven fields generated from `FOUNDER_STORY_FIELD_DEFINITIONS` in the order `founderNameRole`, `background`, `observedProblem`, `motivation`, `turningPoint`, `proofPoints`, `vision`;
- field labels without explicit `for` attributes;
- no placeholders;
- a `Founder Story Narrative` label/helper/textarea without an explicit `for` attribute;
- the existing delete button.

The editor markup is generated from a field configuration structure, and event listeners are bound by stable DOM IDs derived from each storage key, not by visual row position alone.

## Copy Changes

F2.5 replaces the compressed introduction with:

> Capture the facts behind the founder’s journey. Partial answers are fine. These details stay as source material for a reusable founder story.

This copy communicates that:

- the structured fields are source facts;
- partial input is acceptable;
- the source facts support a reusable narrative;
- no unavailable AI control is promised.

## Field Order Changes

The visual order now follows the recommended story arc:

1. `founderNameRole`
2. `observedProblem`
3. `motivation`
4. `turningPoint`
5. `background`
6. `proofPoints`
7. `vision`

This maps to:

Founder → Problem → Motivation → Decision → Background → Credibility → Future.

Only the presentation order changed. Storage keys, normalization, save merge behavior, and persisted shape remain unchanged.

## Source Facts Hierarchy

F2.5 adds a clear `Source facts` heading before the seven structured fields, plus supporting copy:

> Add the moments, motivations, and proof points that make the story specific and credible.

This hierarchy makes the structured section easier to scan without adding tabs, accordions, panels, cards, or a wizard.

## Narrative Hierarchy

F2.5 adds a clearly separated `Reusable Founder Story Narrative` heading after the structured fields. The helper copy now says:

> Write or refine the narrative used across brand, campaign, website, pitch, and communication work. Changes to source facts do not automatically rewrite this narrative.

The narrative remains editable and stored in `tile.content`. No preview mode, generation control, overwrite flow, or read-only narrative state was added.

## Placeholders

F2.5 adds concise placeholders for the seven source fields and the narrative:

| Storage key | Visible label | Placeholder |
|---|---|---|
| `founderNameRole` | Founder name and role | `Alex Morgan, Founder and CEO` |
| `observedProblem` | Problem or insight | `What did the founder personally observe that needed to change?` |
| `motivation` | Personal motivation | `Why did this problem matter personally?` |
| `turningPoint` | Turning point | `What moment turned the idea into a real commitment?` |
| `background` | Relevant background | `What experience shaped the founder’s perspective?` |
| `proofPoints` | Proof points and credibility | `Relevant expertise, achievements, lived experience, or early traction` |
| `vision` | Vision and future impact | `What future does the founder want to help create?` |
| `content` | Founder Story narrative | `Write the reusable founder story here when you are ready.` |

The placeholders provide direction but do not replace labels or imply required formatting.

## Label Associations

Every Founder Story label now uses an explicit `for` attribute that matches the existing unique control ID:

- `brand-core-founder-story-title`
- `brand-core-founder-story-founder-name-role`
- `brand-core-founder-story-observed-problem`
- `brand-core-founder-story-motivation`
- `brand-core-founder-story-turning-point`
- `brand-core-founder-story-background`
- `brand-core-founder-story-proof-points`
- `brand-core-founder-story-vision`
- `brand-core-founder-story-narrative`

The existing ID naming scheme is preserved. The field IDs are generated from storage keys, and the title/narrative IDs are unchanged.

## Storage-Key Preservation

The stored shape remains exactly:

```js
moduleData: {
  founderStory: {
    founderNameRole: "",
    background: "",
    observedProblem: "",
    motivation: "",
    turningPoint: "",
    proofPoints: "",
    vision: ""
  }
}
```

F2.5 does not rename keys, split `founderNameRole`, convert `proofPoints` into an array, add required indicators, add fields, remove fields, or change `tile.content` narrative storage.

## Save Behavior Preservation

Immediate save-on-input behavior remains unchanged:

- title input mutates `tile.title`, calls `saveBrandBrainState()`, and rerenders cards;
- narrative input mutates `tile.content`, calls `saveBrandBrainState()`, and rerenders cards;
- structured field inputs merge the seven values into `moduleData.founderStory` and call `saveBrandBrainState()`;
- no explicit Save button, debounce, saving/saved indicator, async handling, error UI, or save function change was added.

Changing visual order does not affect save behavior because structured values are read and written by storage-key-derived DOM IDs.

## Generic Editor Preservation

The generic Custom Tile editor is unchanged for manual tiles, untyped Founder Story-title tiles, invalid module types, Market Research, Business Plan, Pitch Deck, Whitepaper, and all other typed modules. F2.5 does not alter generic editor copy, labels, markup, save handlers, or delete behavior.

## Card Preservation

F2 card behavior is unchanged. F2.5 does not modify card statuses, card preview resolution order, card markup, card title, card selection, card section routing, card truncation, card styling, or card helper functions.

## No-Mutation Confirmation

Rendering the polished editor remains read-only. It does not create `moduleData`, create `founderStory`, fill defaults into state, save, autosave, reorder stored properties, change content, change title, change `moduleType`, change items, change references, or assign IDs. Field reordering is visual only.

## Styling Decision

No `styles.css` change was required. Existing helper text, label, input, textarea, badge, button, and default heading styles provide enough hierarchy for this narrow polish. No global spacing, sticky editor, generic label, textarea, or card styles were modified.

## Files Changed

- `app.js`
- `docs/audits/2026-07-19-founder-story-f2-5-editor-ux-polish-audit.md`

## Runtime Confirmation

Runtime scope is exactly one runtime file: `app.js`. No registry, adapter, identity, API, persistence, script, workflow, HTML, card, generic editor, save architecture, or AI files changed.

## Risks

| Risk | Mitigation |
|---|---|
| Reordering fields could swap persisted values | Values are read/written by stable storage keys and DOM IDs, not visual index. |
| Placeholders could become the only field instruction | Visible labels and section helper text remain present. |
| Helper copy could imply AI exists now | Copy avoids active AI controls and frames source facts as reusable source material. |
| Heading markup could disturb layout | Existing styles are reused; no new CSS or layout system was added. |
| Label associations could point to missing IDs | IDs are generated from storage keys and label `for` values use the same helper. |
| Generic editor regression | The generic editor branch was not changed. |
| Card regression | Card helpers and markup were not changed. |

## Rollback

Rollback can restore the previous `FOUNDER_STORY_FIELD_DEFINITIONS` labels/order and the previous Founder Story editor copy/label markup in `app.js`, then remove this audit document. No data migration or cleanup is needed because the stored shape did not change.

## Manual QA

A. First-use clarity

1. Create Founder Story from Missing Knowledge.
2. Open the tile.
3. Confirm `Source facts` is clearly visible.
4. Confirm the introduction communicates that partial answers are acceptable.
5. Confirm the narrative is visibly separated from the source fields.

B. Field order

6. Confirm visual order is: Founder name and role, Problem or insight, Personal motivation, Turning point, Relevant background, Proof points and credibility, Vision and future impact, Reusable Founder Story Narrative.
7. Confirm keyboard tab order follows the same order.

C. Existing data mapping

8. Populate all seven fields with distinguishable values.
9. Reload.
10. Confirm each value appears under the correct field.
11. Confirm no values were swapped because of the reorder.

D. Placeholders and labels

12. Confirm every field has a concise visible label.
13. Confirm placeholders match the intended prompt.
14. Confirm placeholders disappear correctly on input.
15. Confirm clicking each label focuses the correct control.
16. Confirm placeholder text is not the only field description.

E. Source/narrative relationship

17. Confirm helper copy explains source facts and narrative roles.
18. Change a source field.
19. Confirm narrative is not automatically changed.
20. Change narrative.
21. Confirm source fields are not changed.

F. Save regression

22. Edit each structured field.
23. Switch tiles and return.
24. Confirm values persist.
25. Edit title and narrative.
26. Confirm existing immediate save behavior remains.
27. Reload and confirm all data persists.

G. Rename

28. Rename the tile to `Why We Started`.
29. Confirm specialized editor remains active.
30. Confirm canonical Founder Story label remains visible.

H. Generic editor regression

31. Open a manual Custom Tile.
32. Confirm generic editor copy and layout are unchanged.
33. Open Market Research.
34. Confirm no Founder Story polish appears.

I. Card regression

35. Confirm Founder Story card still uses `Empty`, `In progress`, and `Story ready`.
36. Confirm preview behavior is unchanged.

J. Delete

37. Delete the Founder Story tile.
38. Confirm existing deletion behavior remains.
39. Confirm Founder Story returns to Missing Knowledge.

K. Boot regression

40. Open Preview in incognito.
41. Open DevTools before reload.
42. Confirm no red Funklix script errors.
43. Confirm Google Sign-In responds.
44. Confirm session, Board, Brand, and Canvas load.
45. Confirm Dashboard, Boards, Brand Workspace, AI Brain, and Insights open.

## Deferred F3 Scope

F3 remains the appropriate place for AI generation, prompt construction, API calls, loading/error states, overwrite confirmation, generated narrative insertion, and minimum-input guidance. Passive save feedback, status label changes, and any generalized module renderer remain deferred outside F2.5.
