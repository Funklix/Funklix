# Founder Story Module — UX and Product Review Audit Before AI

## Executive Summary

The current Founder Story module is a credible first specialized Knowledge Module and is close to being ready for AI generation. It has the right architectural foundation: valid persisted `moduleType`, stable `km_` Custom Tile identity, registry-backed canonical section routing, a specialized sticky editor for typed Founder Story tiles only, seven manual structured source fields, editable narrative in `tile.content`, reload-safe persistence, derived card status, derived card preview, existing delete behavior, and generic fallback for legacy/untyped tiles.

The manual experience is understandable for a motivated founder, marketer, or strategist, but it is not yet fully self-guiding for a first-time user. The two largest UX gaps before AI are information architecture and copy: the editor does not strongly separate **source facts** from the **final reusable narrative**, and the current field order asks for broad background before the user has anchored the problem, motivation, and story arc. The card status also works but could be slightly more action-oriented later.

Final product verdict: **Ready for AI after minor UX polish**.

Recommended next step: one narrow F2.5 PR for editor copy, field order, and lightweight source/narrative hierarchy. Do not implement save architecture changes, status persistence, AI, schema changes, migrations, or generalized module-renderer infrastructure before F3.

## Final Product Verdict

**Ready for AI after minor UX polish.**

The product model does not require revision. The seven-field source model is sufficient for a first AI generation pass, and the current state/persistence behavior can support AI safely if F3 previews or confirms replacement before writing over non-empty narrative content. However, adding AI before small copy/order polish risks generating from vague or repetitive inputs because first-time users may not understand how much detail to provide or that source facts and narrative are separate.

## Current User Journey

| Step | Assessment |
|---|---|
| 1. Founder Story appears under Missing Knowledge | Clear. The canonical registry label is concise, though users may not know the intended output until they create it. |
| 2. User creates the tile | Low friction. Existing Missing Knowledge action creates a typed tile through the established path. |
| 3. Card appears in the canonical section | Clear and consistent after F0. Placement no longer depends on editable title. |
| 4. Card shows Empty | Useful but slightly technical. It communicates no work has started but not the next action as clearly as `Add founder details`. |
| 5. User selects the card | Clear. Existing card selection behavior remains native to Brand Workspace. |
| 6. Specialized editor appears | Clear because the module label is visible. It is differentiated enough from generic Custom Tiles without creating a new surface. |
| 7. User reads the introduction | Helpful, but it compresses too many concepts into one sentence. It should name source facts and final narrative more explicitly. |
| 8. User fills one or more structured fields | Low technical friction. Cognitive load is moderate because seven textareas appear as one long ungrouped list and no placeholders describe answer length. |
| 9. Card changes to In progress | Useful. Structured field edits save immediately but do not rerender cards, so the visible card may not update until another render path occurs. This is not an AI blocker but should be noted. |
| 10. User writes the narrative | Clear enough. The narrative label and helper text explain it is the final narrative. |
| 11. Card changes to Story ready | Understandable, but `Story ready` can overclaim if the narrative is a single rough sentence. `Narrative added` is more precise. |
| 12. User renames the tile | Works and remains consistent with F0/F1. Rename does not break identity, section routing, or specialized editor dispatch. |
| 13. User switches tiles and returns | Values should remain because the editor writes directly to the tile and saves immediately. |
| 14. User reloads | Structured fields and narrative should persist through the existing Brand Core snapshot path. |
| 15. User deletes the tile | Existing deletion semantics are clear and return Missing Knowledge through Phase 5 behavior. |

## Editor Information Architecture

Current fields:

1. Founder name and role
2. Background and professional context
3. Problem or insight personally observed
4. Personal motivation
5. Turning point
6. Proof points and credibility
7. Vision and future impact

All seven fields are useful, and none should be removed before AI. The main issue is order. Asking for broad background second may produce biography-first stories. Founder Story should guide users toward a narrative arc: who the founder is, what problem they saw, why it mattered personally, what changed, why they are credible, and what future they are building.

Recommended order before AI:

1. Founder name and role
2. Problem or insight personally observed
3. Personal motivation
4. Turning point
5. Background and professional context
6. Proof points and credibility
7. Vision and future impact
8. Founder Story Narrative

This order better supports both manual writing and later AI generation because it prioritizes causality and motivation before credentials.

## Cognitive Load

Seven fields are appropriate for v1. They are enough to support a useful narrative without becoming a full interview system. The cognitive load comes from presentation, not count:

- All seven fields currently appear as one continuous list.
- Most labels are broad and lack placeholders or concise helper examples.
- Users may not know whether to write a phrase, a sentence, or a paragraph.
- The module supports partial completion technically, but the UI does not explicitly reassure users that partial answers are acceptable.

Lightweight grouping would help but should be restrained. Recommended grouping for F2.5:

- **Founder**: Founder name and role.
- **Origin**: Observed problem, motivation, turning point.
- **Credibility**: Background, proof points.
- **Future**: Vision.
- **Narrative**: Final reusable story.

Do not use tabs, wizards, accordions, or multi-step flows for v1.

## Source Facts vs Narrative

The current implementation stores structured fields as source facts and stores the final narrative in `tile.content`, which is the right product model. The UI partially communicates this through the intro and narrative helper, but the separation should be stronger before AI.

Findings:

- The phrase `Structured fields are saved as source material and do not overwrite this narrative` is helpful.
- The editor should label the structured area as `Source facts` or `Founder source facts`.
- The narrative area should be visually and semantically separated as `Final narrative` or `Reusable Founder Story Narrative`.
- The UI should state that source facts remain useful even after a narrative exists.
- The future AI action should generate from source facts into a preview/confirmation flow, not silently overwrite narrative content.

Recommendation: keep narrative after all source fields, but give it a stronger section heading and concise helper copy. Do not introduce read-only preview mode in F2.5.

## Field-by-Field Copy Review

| Current field | Problem | Recommended label | Recommended helper/placeholder | Input type |
|---|---|---|---|---|
| Founder name and role | Combines two facts but is acceptable for v1; needs an example. | Founder name and role | `e.g. Jane Doe, Founder and CEO` | Short textarea or text input |
| Background and professional context | Useful but too early in the current order and can invite generic biography. | Relevant background | `What experience shaped the founder before this company?` | Textarea |
| Problem or insight personally observed | Strong field; label is slightly long. | Problem they saw firsthand | `What problem or unmet need did the founder personally notice?` | Textarea |
| Personal motivation | Strong field; could ask for emotional/personal stake. | Why it mattered | `Why did this problem feel personal or important enough to solve?` | Textarea |
| Turning point | Strong field; needs a prompt for action. | Turning point | `What moment made the founder commit to building this?` | Textarea |
| Proof points and credibility | Useful but broad; should invite concrete evidence without arrays. | Credibility and proof points | `Experience, wins, customer proof, credentials, or hard-earned lessons.` | Textarea |
| Vision and future impact | Strong field; label is slightly abstract. | Future vision | `What better future is the founder trying to create?` | Textarea |
| Founder Story Narrative | Correct concept; should emphasize this is the reusable output. | Reusable Founder Story Narrative | `Write or later generate the final story used across brand, pitch, and campaign copy.` | Textarea |

## Empty State Review

Current empty states are serviceable but could be more directive:

- Missing Knowledge label `Founder Story` is clear but not explanatory by itself.
- Card empty status `Empty` is understandable but less action-oriented than `Add founder details`.
- Card empty preview is useful and concise: `Capture the founder’s origin, motivation, turning point, and vision.`
- The editor introduction explains the goal but could more clearly say: source facts first, narrative after, partial answers are fine.
- Empty fields currently have no placeholders, so users may not know expected answer length.
- The narrative empty state is just an empty textarea; helper text helps, but a placeholder would reduce hesitation.

Smallest improvement: add concise placeholders/helper copy in F2.5, and state that partial answers are okay. Do not add a wizard or guided interview.

## Save and Trust Review

Actual code findings:

- Founder Story title input mutates `tile.title`, calls `saveBrandBrainState()`, and calls `renderBrandCoreTiles()`.
- Founder Story narrative input mutates `tile.content`, calls `saveBrandBrainState()`, and calls `renderBrandCoreTiles()`.
- Founder Story structured field inputs call `saveFounderStoryModuleData(tile, readFounderStoryFieldValues())` and `saveBrandBrainState()` but do not call `renderBrandCoreTiles()`.
- The editor itself is not rerendered on input, so cursor/focus should remain stable inside the sticky editor.
- `saveBrandBrainState()` is synchronous for local storage, marks unsaved state, and refreshes Dashboard if visible.
- Autosave failures are not surfaced in this editor path beyond the broader application save status model.
- Repeated writes can be frequent because every input event saves immediately.

Recommendation: do not switch to explicit Save before AI. The existing immediate-save model is consistent with the surrounding Brand Core editor. A passive `Saved`/`Saving` signal would improve trust, but it is not the highest-value pre-AI fix unless users report uncertainty. For F2.5, prioritize copy/order/source-narrative clarity. Treat save feedback as P2 unless real UX testing shows distrust.

## Card Review

The current Founder Story card is compact and useful:

- It keeps the editable custom title.
- It shows one preview rather than exposing all source fields.
- It derives status from existing data.
- It uses the same card click/selection behavior.
- It stays in the canonical section through F0.

Status language review:

- `Empty` is understandable but slightly technical.
- `In progress` is useful and familiar.
- `Story ready` may overclaim completion when `tile.content` contains only a rough sentence.

Recommendation: keep the three-state model but consider changing labels in a later small card-language polish PR to `Add founder details`, `Story in progress`, and `Narrative added`. Do not make that the required F2.5 if editor copy/order remains the bigger pre-AI risk.

Preview order is appropriate for F2: narrative wins, then observed problem, motivation, turning point, background, vision, founder identity, proof points, and empty-state copy. This gives the card a story-oriented signal without showing every field.

## Completion Semantics

Current status model:

- Empty
- In progress
- Story ready

Edge case assessment:

| Edge case | Current result | Assessment |
|---|---|---|
| Founder name only | In progress | Technically accurate; may imply more progress than the story has, but acceptable. |
| One short motivation sentence | In progress | Accurate. |
| All structured fields filled but no narrative | In progress | Accurate because final narrative is not present. |
| One-sentence narrative | Story ready | Potential overclaim; `Narrative added` would be more precise. |
| Long narrative but no source fields | Story ready | Acceptable because narrative is the output, though AI quality later may need source facts. |
| Whitespace-only values | Empty or In progress based on other fields | Correct due to trimming. |
| Malformed legacy data | Safe fallback | Correct; no exception or mutation expected. |

Recommendation: keep derived, non-persisted status. Do not add percentages or field counts. Consider label polish, but do not block F3 solely on status wording.

## AI Readiness

The current source model is sufficient for a first `Generate Founder Story` action after minor UX polish:

- Seven fields cover identity, problem, motivation, turning point, credibility, and future vision.
- Founder identity can remain combined as `founderNameRole` for v1; splitting name and role is not necessary before F3.
- Company/brand context is already available from Brand Core/Brand DNA context and should be included in F3 prompt construction.
- Tone should come from existing Brand Brain / Tone of Voice rather than another Founder Story field.
- Proof points can remain a multiline string in v1; structured arrays are not required before AI.
- Chronology is adequate if field order is adjusted to emphasize story arc before credentials.
- AI should work with partial fields, but F3 should require at least one identity clue and two substantive source fields or a non-empty existing narrative before generation.
- If narrative content already exists, F3 must preview/confirm replacement instead of overwriting silently.
- Sparse source data may generate generic output, so F3 should show missing-input guidance rather than blocking all partial use.

## Mobile and Responsive Review

Findings are based on current layout and CSS inspection, not a full device lab pass:

- Brand Workspace cards use responsive grid behavior in scoped Brand Workspace styles, which helps narrow desktop/tablet widths.
- `.bc-preview` overflow behavior is constrained in the base card style and relaxed inside `.brand-core-workspace`; long preview text should wrap rather than break layout.
- The side editor is scrollable and can handle long fields, but seven textareas may feel dense on tablet-like widths.
- Long labels are readable but may increase vertical scrolling.
- Sticky behavior appears suitable for desktop-first use; do not claim full mobile optimization.

Classification: no blocker before AI. Grouping/copy polish is P1; full mobile-specific refinement is P3.

## Accessibility Review

Founder Story-specific findings:

- DOM IDs are unique and use a consistent `brand-core-founder-story-` prefix.
- Labels are visually placed before inputs/textarea controls, but the generated markup does not currently use explicit `for` attributes tied to input IDs.
- Keyboard navigation follows DOM order and should be understandable.
- The delete action remains a semantic button.
- Card status is visible text, not color-only.
- The UI should not rely only on placeholders; concise helper text remains important.
- Textarea sizing is adequate but could benefit from placeholders for expected answer shape.

Recommendation: as part of F2.5 copy/hierarchy polish, add explicit label associations where practical while preserving DOM IDs and editor behavior. Do not start a broad accessibility redesign.

## Funklix Consistency Review

Founder Story feels native to Funklix because it:

- lives in Brand Workspace;
- uses the existing sticky editor shell;
- keeps Custom Tile title/content semantics;
- uses existing card classes;
- preserves save-on-input behavior used elsewhere in Brand Core;
- preserves delete and selection patterns;
- uses a typed module discriminator rather than title inference.

It is more complex than generic Custom Tiles, but appropriately so: it is the first specialized Knowledge Module. The main consistency concern is that the editor currently lacks the section hierarchy and microcopy polish that would make it a strong reference pattern.

## Reference Module Patterns

| Pattern | Reusable now? | Reason | Generalize when |
|---|---:|---|---|
| Valid typed discriminator | Yes | `moduleType` identity is settled by Phase 5 and avoids title inference. | Already safe for future modules. |
| Specialized editor branch | Yes, cautiously | Works for one module without new architecture. | Generalize after a second specialized module repeats the pattern. |
| `moduleData.<moduleNamespace>` | Yes | Additive, JSON-safe, and module-scoped. | Generalize naming conventions before a second specialized module ships. |
| Source fields plus narrative | Yes | Strong model for modules that turn source facts into reusable outputs. | Reuse for modules with a similar source/output workflow. |
| Derived status | Yes | Lightweight and non-persistent. | Keep status semantics module-specific until patterns stabilize. |
| Card preview | Yes | Useful compact summary without editing on card. | Generalize only after another module needs a specialized preview. |
| Canonical section routing | Yes | Already registry-backed and identity-safe. | Already safe as a platform pattern. |
| Save merge behavior | Yes | Prevents data loss for additive module data. | Extract only if repeated across modules. |
| No open-time mutation | Yes | Critical for trust and legacy compatibility. | Make mandatory for all specialized modules. |
| Generic fallback | Yes | Protects legacy and unsupported tiles. | Keep mandatory. |
| Generalized renderer framework | No | Premature for one specialized module. | Consider after two or three specialized modules share structure. |
| Generalized field schema framework | No | Current fields are bespoke and product-specific. | Consider when multiple modules need dynamic fields. |

## Findings by Priority

| Finding | Severity | User impact | Recommended action | Runtime scope |
|---|---|---|---|---|
| Source facts vs narrative separation is present but not strong enough | P1 | Users may not know which area to fill first or why both matter. | Add clear `Source facts` and `Reusable narrative` headings plus concise helper copy. | `app.js`; possibly `styles.css` only if existing styles cannot handle headings. |
| Field order is biography-first rather than story-arc-first | P1 | Inputs may produce generic founder bios and weaker AI prompts. | Reorder fields to identity, observed problem, motivation, turning point, background, proof, vision. | `app.js` only. |
| Empty fields lack placeholders/examples | P1 | First-time users may hesitate or under-answer. | Add concise placeholders/examples for each field and narrative. | `app.js` only. |
| Labels are visually clear but not explicitly associated with controls | P1 | Accessibility and screen-reader clarity can improve before AI expands usage. | Add `for` attributes tied to existing unique IDs when editing field markup. | `app.js` only. |
| `Story ready` can overclaim completion | P2 | Users may think a rough sentence is final-ready. | Consider later label polish to `Narrative added`. | `app.js` only. |
| No visible saved/saving feedback inside the Founder Story editor | P2 | Some users may wonder whether immediate saves worked. | Consider passive save feedback after AI or if user testing shows distrust. | `app.js`; maybe existing status element only. |
| Structured field edits do not immediately rerender the card | P2 | Card may not show `In progress` until another render path occurs. | Consider rerender-on-structured-input only if it does not affect typing performance. | `app.js` only. |
| Seven textareas create moderate vertical density | P2 | More scrolling on smaller screens. | Use lightweight headings and better copy before considering layout changes. | `app.js`; maybe `styles.css`. |
| Full mobile polish is not proven | P3 | Tablet/narrow layouts may feel long but functional. | Defer until Founder Story usage proves mobile need. | Future CSS/UI PR. |
| Generalized specialized-module framework is absent | P3 | Future modules may duplicate branches. | Defer abstraction until a second specialized module ships. | Future architecture PR. |

## Recommended Next Step

Choose **Path B: implement one small F2.5 UX polish PR, then F3**.

Why F2.5 is worth doing before AI:

- Better labels/order will produce better source data.
- Better source/narrative separation will reduce overwrite anxiety when AI appears.
- Placeholders will reduce first-use hesitation.
- The work is narrow and can remain inside `app.js` unless existing styles prove insufficient.
- It avoids prematurely changing save architecture, card status, persistence, registry metadata, or AI implementation.

## Recommended F2.5 Scope or Direct F3 Decision

| Phase | Responsibility | Runtime files | User-visible result | Risk |
|---|---|---|---|---|
| F2.5 | Copy, field-order, source/narrative hierarchy, and label association polish in the existing Founder Story editor. | Prefer `app.js`; optional `styles.css` only if existing headings/helper styles are insufficient. | First-time users understand what to enter, source facts and narrative feel distinct, placeholders guide answer length, and keyboard/screen-reader labeling improves. | Low if limited to editor copy/markup and no save/data behavior changes. |
| F3 | Add one AI `Generate Founder Story` action with preview/confirm overwrite behavior. | Likely `app.js` plus one API route and one audit document. | Users can generate a standard narrative from structured source facts and Brand context. | Medium due to AI output quality, overwrite safety, auth/API dependencies, and prompt validation. |
| Future | Optional status label polish or passive save feedback. | `app.js`; optional `styles.css`. | More confidence and clearer card semantics. | Low, but not required before AI. |

Recommended F2.5 non-goals:

- No AI.
- No API routes.
- No persistence/schema changes.
- No card redesign.
- No completion percentages.
- No save architecture change.
- No legacy migration.
- No generalized module renderer or field schema framework.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| User does not understand what to write | Add concise placeholders and clearer source-facts heading in F2.5. |
| Overlapping fields produce repetitive narrative | Reorder fields around story arc and tighten copy to distinguish motivation, turning point, and credibility. |
| Immediate saving feels unreliable | Keep current behavior for consistency; consider passive save feedback only after copy/order polish. |
| Card status overstates readiness | Consider `Narrative added` later; do not add percentages. |
| Generated AI content overwrites manual work | F3 must preview or confirm before replacing non-empty narrative content. |
| Sparse source data produces generic AI output | F3 should allow partial use but show minimum-input guidance. |
| Long labels create layout issues | F2.5 should shorten labels where possible and use placeholders for detail. |
| Helper copy becomes too verbose | Keep helper text one sentence per section or field. |
| Specialized module feels inconsistent | Continue using the sticky editor shell, existing cards, and existing save/delete patterns. |
| Future modules copy weak UX decisions | Treat F2.5 source/narrative hierarchy as the reference pattern before creating another specialized module. |
| app.js branching becomes difficult to maintain | Do not generalize yet; revisit after a second specialized module repeats the pattern. |
| Premature abstraction adds more risk than value | Keep F2.5 and F3 module-specific. |

## Explicit Non-Goals

Do not implement or recommend as pre-AI requirements:

- Conversational interview agent.
- AI generation in this audit.
- API routes in this audit.
- New persistence schema.
- Migrations.
- Generalized module renderer framework.
- Generalized field schema framework.
- Full mobile redesign.
- Full accessibility redesign.
- Multi-founder support.
- Uploads or voice input.
- Version history or narrative variants.
- Campaign, pitch deck, or website generation.
- Analytics, percentages, readiness dashboard, or cross-module dependency framework.
- Broad Brand Workspace redesign.

## Manual Review Checklist

1. Create Founder Story through Missing Knowledge and confirm typed identity, stable ID, and canonical section placement.
2. Confirm the empty card communicates next action clearly enough.
3. Open the editor as a first-time user and note whether the source-facts/narrative distinction is immediately clear.
4. Fill only one field and confirm partial completion feels acceptable.
5. Fill observed problem, motivation, and turning point; confirm the narrative arc is easy to understand.
6. Write a one-sentence narrative and evaluate whether the card status overclaims readiness.
7. Rename the tile and confirm title editability does not affect identity, section, card specialization, or editor specialization.
8. Switch tiles, return, reload, and confirm trust in persistence.
9. Navigate the editor by keyboard and confirm focus order follows the intended story flow.
10. Review the editor at a narrow desktop/tablet-like width and confirm scrolling remains tolerable.
11. Open untyped legacy `Founder Story` and other canonical modules and confirm they remain generic.
12. Before F3, confirm F2.5 copy/order changes are complete and no save/persistence behavior changed.

## Files Inspected

- `docs/audits/2026-07-19-founder-story-module-v1-architecture-ux-audit.md`
- `docs/audits/2026-07-19-founder-story-f0-module-type-section-routing-audit.md`
- `docs/audits/2026-07-19-founder-story-f1-specialized-editor-audit.md`
- `docs/audits/2026-07-19-founder-story-f2-card-preview-status-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5d-presence-implementation-audit.md`
- `docs/audits/2026-07-13-runtime-boot-and-change-scope-stabilization.md`
- `docs/constitution/engineering-constitution.md`
- `app.js`
- `styles.css`
- `index.html`
- `knowledge-module-registry.js`

## Files Changed

- `docs/audits/2026-07-19-founder-story-pre-ai-ux-product-review.md`

## Final Recommendation

Final verdict:

- Ready for AI after minor UX polish

Recommended next PR:

- Phase: F2.5
- Responsibility: Polish Founder Story editor copy, field order, source/narrative hierarchy, placeholders, and label associations only.
- Runtime files: Prefer `app.js`; optional `styles.css` only if existing styles are insufficient for lightweight headings.
- Expected user-visible result: A first-time founder, marketer, or strategist can understand what to enter, why source facts matter, where the reusable narrative lives, and that partial answers are acceptable before using AI.
- Explicit non-goals: No AI, API changes, persistence schema changes, card redesign, status persistence, save architecture change, migration, or generalized module framework.

Founder Story should keep:

- Valid persisted `moduleType` as the specialization discriminator.
- Stable Custom Tile identity and existing selection/deletion behavior.
- Additive `moduleData.founderStory` source fields.
- Editable narrative in `tile.content`.
- Derived, non-persisted card status and preview.
- Generic fallback for legacy/untyped/invalid tiles.
- Existing sticky editor shell and Brand Workspace card patterns.

Founder Story should change before AI:

- Reorder fields around the founder story arc.
- Add clear `Source facts` and `Reusable narrative` hierarchy.
- Add concise placeholders or helper prompts for all seven fields and the narrative.
- Add explicit label associations where practical while preserving existing DOM IDs and save behavior.
