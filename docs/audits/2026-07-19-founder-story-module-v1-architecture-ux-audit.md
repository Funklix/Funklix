# Founder Story Knowledge Module v1 — Architecture and UX Audit

## Executive Summary

Founder Story v1 should be the first specialized Knowledge Module in Funklix because it turns fragmented founder facts into an authentic, reusable strategic narrative for Brand Workspace and future campaign work. The smallest useful version should live inside the existing Brand Workspace Custom Tile infrastructure as a typed `founder_story` Custom Tile with stable `km_` identity, persisted `moduleType`, editable title, editable narrative in `content`, and additive structured source facts in a new optional `moduleData.founderStory` object.

This audit is documentation-only. It does not implement Founder Story and does not modify runtime code. The recommendation is to deliver Founder Story through a short sequence of small PRs rather than a broad module-platform rewrite. The first runtime PR should build a specialized Founder Story editor inside the existing sticky Brand Core editor shell, reuse current save/load/delete behavior, avoid AI/API changes, and preserve all existing tile data.

Key decisions:

- Founder facts are the source of truth.
- The narrative remains editable and stored in `tile.content` for compatibility with current previews, Brand Brain context, and legacy Custom Tile behavior.
- `items` should not be used for structured v1 fields because it has no clear current editor contract and is better left for generic list-style custom data.
- `moduleData.founderStory` is recommended for structured source fields because current normalization and serialization preserve arbitrary nested Custom Tile fields.
- A specialized editor is required for real v1 value, but it should be hosted inside the existing sticky editor shell rather than a modal or full-page architecture.
- The only v1 AI action should be `Generate Founder Story`, delivered after the structured manual editor is stable.
- Completion semantics should be derived read-only as `empty`, `in progress`, or `has narrative`; do not introduce a generalized persisted readiness framework in v1.
- Section routing should be handled as a small prerequisite or companion app-only PR so typed Founder Story displays in the registry section even after title edits; do not combine this with AI.

## Product Goal

Founder Story v1 should help a founder, marketer, or agency strategist capture the human origin, motivation, credibility, turning point, and vision behind a Brand, then turn that knowledge into one reusable founder narrative. It is a product capability because it creates a strategic asset that can inform About page copy, pitch decks, investor narratives, brand positioning, press materials, social content, recruitment messaging, campaign storytelling, AI Brain context, future Brand Avatar context, and future content generation.

Core v1 user value:

- collect the minimum founder facts needed for an authentic story;
- preserve raw and structured founder knowledge without forcing a perfect finished draft;
- produce or host one editable standard narrative that can be reused across Brand and campaign work;
- keep the module discoverable through Missing Knowledge and Brand Workspace.

Future platform value:

- generate channel-specific variants for About pages, pitch decks, investor updates, press bios, recruiting, and social content;
- feed richer AI Brain and Brand Avatar context;
- support source references, review status, provenance, version history, and Knowledge Graph projection;
- connect founder story signals to campaign narrative recommendations.

## User Job to Be Done

Primary job:

> When building a brand, I want to capture and refine the founder's origin, motivation, credibility, turning points, and vision so that the brand's communication feels authentic, consistent, and reusable across channels.

- **Primary user:** founder/operator, early marketing lead, brand strategist, or agency collaborator setting up the Brand Workspace.
- **Trigger:** Missing Knowledge calls out Founder Story, a user wants more authentic Brand positioning, or campaign content feels generic.
- **Input condition:** the user may have scattered notes, a rough bio, a few proof points, or only partial founder context.
- **Desired outcome:** a concise set of structured founder facts plus one editable standard Founder Story narrative.
- **Success criteria:** the user can explain who the founder is, why they care, what problem triggered the company, why they are credible, what changed, and what future they are building.
- **Common failure cases:** the story becomes a generic biography, AI invents facts, the founder's motivation is missing, proof points are vague, source facts are overwritten by generated copy, or the form feels too large to complete.
- **Complete enough in v1:** at least founder name/role plus two substantive source inputs among background, observed problem, motivation, turning point, proof points, or vision; and ideally a narrative in `content`.

## Current Architecture Findings

- Brand Core state is board-scoped and includes `customTiles` as part of `state.brandCore`.
- New canonical Missing Knowledge tiles already receive stable `km_` IDs and `moduleType` through the existing creation path.
- Phase 5C duplicate prevention and Phase 5D presence detection now treat valid persisted canonical `moduleType` as authoritative, with exact canonical-title fallback only for legacy-compatible tiles.
- The runtime adapter can expose typed read-only module views, but current Brand Workspace rendering and editing still operate directly on `state.brandCore` and Custom Tiles.
- Custom Tile rendering, selection, editing, and deletion are centralized in `app.js` and use the existing Brand Workspace/sticky editor shell.
- Current Custom Tile section placement remains title-based; typed section routing was explicitly deferred.
- Current AI patterns call app-side `fetch()` wrappers that post JSON to API routes, then mutate state only after successful responses and explicit client-side application.

## Existing State Shape

Current effective Custom Tile fields relevant to Founder Story are:

- `id`: optional stable Knowledge Module instance ID created for new Custom Tiles.
- `moduleType`: optional registry module ID persisted for canonical Missing Knowledge tiles.
- `title`: user-facing, editable presentation title.
- `content`: generic editable text currently used for Custom Tile body and card preview.
- `items`: array preserved on created tiles and through persistence, but not actively edited by the generic Custom Tile editor.
- arbitrary nested metadata: current Brand Core normalization spreads incoming state before normalizing known nested built-in fields, and current snapshot serialization deep-clones `state.brandCore`, so additive Custom Tile fields can survive save/load if editors do not replace the tile object.

No current Custom Tile state has a formal `references`, `moduleData`, status, readiness, version history, AI state, attachment metadata, or provenance contract.

## Persistence Findings

Custom Tiles are currently:

- created manually through `custom:add`, which calls `createBrandCustomTile("New Custom Tile", "")`;
- created canonically through Missing Knowledge, which calls `createBrandCustomTile(canonicalTitle, "", { moduleType: definition.id })` after Phase 5A/5C checks;
- edited in the generic Custom Tile editor by mutating `tile.title` and `tile.content` directly;
- deleted by filtering out the selected Custom Tile index, resetting selection to `brandCore`, saving, and rerendering;
- normalized through `normalizeBrandCoreState()`, which keeps `customTiles` as the incoming array when present;
- serialized through `serializeBrandCoreSnapshot()`, which calls `clonePlainObject(state.brandCore)`;
- stored locally through `localStorage.setItem(brandBrainStorageKey(), JSON.stringify(brandState))`;
- included in board persistence through `brand_core_snapshot` in board save/duplicate payloads;
- hydrated from `/api/boards/:id` by reading `brand_core_snapshot` and passing it through `normalizeBrandCoreState()`;
- stored server-side as JSONB through board API routes that stringify `brand_core_snapshot` rather than rejecting unknown nested fields.

Findings:

- Arbitrary nested fields should survive existing local and board persistence because snapshots are plain JSON clones and API storage is JSONB.
- The current generic editor mutates only `tile.title` and `tile.content`; it does not replace the whole tile object, so an additive `moduleData` object should not be removed by normal title/content edits.
- A future specialized editor must also mutate fields in place or merge nested objects carefully; replacing the whole tile object would increase data-loss risk.
- Founder Story v1 does not require a persistence schema change if `moduleData.founderStory` is additive and JSON-safe.
- API schema rejection risk is low for board save/load because `brand_core_snapshot` is accepted as JSONB, but any new AI route should validate and return a narrow JSON shape.

## Renderer and Editor Findings

Current Custom Tile UI path:

- `renderBrandCoreTiles()` renders the Brand Workspace, built-in cards, Missing Knowledge blocks, Custom Tiles, and the `custom:add` affordance.
- Custom Tile cards use `getCustomTileRuntimeKey(tile, idx)` and store it in `data-bc-key`.
- Runtime keys prefer `custom-id:<km_...>` when a stable ID exists, otherwise fallback to `custom:<index>`.
- Clicking a `.bc-node[data-bc-key]` sets `state.brandCoreSelectedKey` and calls `renderBrandCoreEditor()`.
- `renderBrandCoreEditor()` opens Custom Tiles in the existing sticky editor panel `#bc-editor-panel` and sets `#bc-editor-title`.
- The generic Custom Tile editor currently renders title and content inputs with IDs `bc-custom-title`, `bc-custom-content`, and `bc-custom-delete`.
- Input handlers mutate `tile.title` or `tile.content`, call `saveBrandBrainState()`, and rerender cards.
- Delete uses the selected index, filters it out, resets selection, saves, and rerenders.
- Section grouping for custom tiles still uses `getBrandWorkspaceSectionForCustomTileTitle(tile.title)` and therefore remains title-driven.

Recommendation:

- Founder Story v1 should use a specialized editor inside the existing sticky editor shell.
- Do not use a dedicated modal or full-page module view in v1.
- The specialized editor should preserve existing selection keys, save path, delete semantics, and card rendering unless a small section-routing prerequisite is scoped separately.

## Founder Story Content Model

Recommended v1 model balances a small number of structured source fields with one editable narrative output. The form should be useful even when incomplete.

| Field | v1 status | Storage | Required? | AI input? | User editable? |
|---|---|---|---:|---:|---:|
| Founder name | Required in v1 | `moduleData.founderStory.founderName` | Yes | Yes | Yes |
| Founder role | Required in v1 | `moduleData.founderStory.role` | Yes | Yes | Yes |
| Professional context/background | Required in v1 | `moduleData.founderStory.background` | Yes | Yes | Yes |
| Observed problem/insight | Required in v1 | `moduleData.founderStory.observedProblem` | Yes | Yes | Yes |
| Motivation/personal connection | Required in v1 | `moduleData.founderStory.motivation` | Yes | Yes | Yes |
| Turning point | Required in v1 | `moduleData.founderStory.turningPoint` | Yes | Yes | Yes |
| Proof points/credibility | Required in v1 as lightweight multiline/list input | `moduleData.founderStory.proofPoints` | Yes | Yes | Yes |
| Vision/future impact | Required in v1 | `moduleData.founderStory.vision` | Yes | Yes | Yes |
| Values/principles | Optional in v1 | `moduleData.founderStory.values` | No | Yes if present | Yes |
| Early journey/first customer/early obstacles | Optional in v1 | `moduleData.founderStory.earlyJourney` | No | Yes if present | Yes |
| Raw notes | Optional in v1 | `moduleData.founderStory.rawNotes` | No | Yes if present | Yes |
| One-sentence founder essence | AI-generated output, optional display | `moduleData.founderStory.essence` | No | Derived | Editable optional |
| Standard founder narrative | AI-generated or manually written output | `content` | No, but recommended | Derived output | Yes |
| Short founder story variant | Deferred | future `moduleData` or derived preview | No | Future | Future |
| Long-form founder story | Deferred | future `moduleData` or content variant | No | Future | Future |
| Attachments/citations/source metadata | Deferred | future metadata | No | Future | Future |
| Status/readiness/history | Deferred except derived display | read-only derived | No | No | No |
| Multi-founder relationship model | Not recommended for v1 | none | No | No | No |

## Required v1 Fields

Founder Story v1 should ask for these source inputs:

1. Founder name and role.
2. Background / professional context.
3. Problem or insight personally observed.
4. Motivation / why the founder cares.
5. Turning point / moment of commitment.
6. Proof points / credibility.
7. Vision / future impact.

These are required as v1 prompts, not hard blockers. The module should autosave partial answers and remain useful before every prompt is complete.

## Optional and Deferred Fields

Optional in v1:

- values/principles;
- early journey notes;
- raw notes;
- one-sentence essence if AI generation can return it with the standard narrative.

Deferred:

- multiple narrative variants;
- channel-specific versions;
- conversational interview mode;
- uploads and citations;
- source provenance;
- review workflow;
- generalized readiness/status architecture;
- graph/database changes;
- multi-founder modeling.

## Structured Data vs Narrative Decision

Structured founder facts should be the source of truth. The narrative should be a derived, editable output stored in `content`.

Rules:

- AI-generated narratives must never overwrite structured source fields.
- Users can manually edit the narrative after generation.
- Regeneration should use current structured fields and raw notes.
- To avoid losing manual edits, regeneration should preview or require confirmation before replacing non-empty `content`.
- v1 does not need complex version history. If overwrite protection is needed, store a simple previous narrative in memory during the interaction or require confirmation; do not introduce a versioning framework.
- Raw notes should be preserved in `moduleData.founderStory.rawNotes` or, for legacy content, displayed in a compatibility area until the user decides how to use it.

## Recommended Stored Shape

Recommended shape for a typed Founder Story tile:

```js
{
  id: "km_...",
  moduleType: "founder_story",
  title: "Founder Story",
  content: "Editable standard founder narrative...",
  items: [],
  moduleData: {
    founderStory: {
      founderName: "",
      role: "",
      background: "",
      observedProblem: "",
      motivation: "",
      turningPoint: "",
      proofPoints: [],
      vision: "",
      values: "",
      earlyJourney: "",
      rawNotes: "",
      essence: ""
    }
  }
}
```

Option assessment:

| Option | Assessment |
|---|---|
| A — content only | Lowest implementation risk and highest legacy compatibility, but poor AI usability, poor structure, and easy to become another generic text area. Not recommended as the final v1 shape. |
| B — items-based structure | Uses an existing field but lacks an editor contract, field names, or clear semantics. It risks corrupting generic list expectations and is awkward for AI prompts. Not recommended for v1 structured fields. |
| C — additive `moduleData` object | Best source-of-truth model and future extensibility. Persistence should tolerate it, but generic editor compatibility and careful merge updates are required. Recommended foundation. |
| D — hybrid `moduleData` + `content` | Best practical v1. `moduleData.founderStory` stores source facts, while `content` stores the editable narrative compatible with current previews and Brand Brain context. Recommended. |

## AI Assistance Recommendation

Founder Story v1 should eventually include one primary AI action: **Generate Founder Story**.

Recommended AI behavior:

- **Inputs:** founder name, role, background, observed problem, motivation, turning point, proof points, vision, optional values, early journey, raw notes, and existing Brand Brain context.
- **Output:** strict JSON with `essence` and `narrative`, where `narrative` is one standard Founder Story suitable for brand/campaign reuse.
- **Validation:** require at least founder name or role plus two substantive source fields before enabling generation; otherwise show missing-input guidance.
- **Overwrite behavior:** if `content` is non-empty, preview the generated narrative or ask for confirmation before replacing it.
- **Insertion behavior:** insert generated `narrative` into `content` only after confirmation or explicit action; store `essence` in `moduleData.founderStory.essence` if included.
- **Error recovery:** keep source fields untouched, restore button state, show a clear error, and allow retry.
- **Mutation model:** API requests should not mutate state directly; the client should apply returned values after validation.

AI option assessment:

| AI option | v1 recommendation |
|---|---|
| Generate Founder Story | Recommended as the only v1 AI action after manual structured editing exists. |
| Improve Story | Defer; it overlaps with generation and increases overwrite/edit-state complexity. |
| Interview Me | Defer; conversational state is a larger product surface. |
| Multiple output formats | Defer; useful later but not needed for first value. |

## Specialized Editor UX

Founder Story v1 should use the existing sticky Brand Core editor shell with a specialized editor when the selected tile has `moduleType: "founder_story"` or is a legacy exact-title Founder Story tile selected through the canonical path.

Suggested editor concept:

1. **Header:** show registry label `Founder Story`; keep the user-facing title editable but make the canonical module label visible. Add a small derived status badge only if cheap and read-only.
2. **Intro:** short explanation: capture the founder's origin, motivation, credibility, turning point, and vision; generate a reusable narrative when ready.
3. **Structured prompts:** use seven focused fields, grouped lightly but not as a wizard. Support incomplete answers and autosave every field.
4. **AI action:** one button, `Generate Founder Story`; disabled or guided until minimum input exists. Include loading, success, and failure states.
5. **Narrative output:** editable textarea backed by `content`; preserve source answers; confirmation before replacing non-empty narrative.
6. **Save behavior:** use existing autosave (`saveBrandBrainState()`) on input, plus rerender card previews as needed.
7. **Delete behavior:** preserve current Custom Tile deletion semantics.
8. **Empty state:** show prompts and guidance even before generation; do not require AI to get value.

## Completion Semantics

Use a small derived read-only status, not persisted status metadata:

- `empty`: no structured source fields and no narrative content.
- `in progress`: at least one meaningful source field or narrative exists, but no substantive narrative.
- `has narrative`: `content` has a meaningful founder narrative.

Optionally show `ready to generate` as a derived UI hint when minimum AI inputs are present. Do not store status in v1 and do not introduce generalized readiness architecture.

## Title and Section Placement Decision

- The Custom Tile `title` should remain user-editable because current Custom Tile behavior treats title as presentation text.
- The registry label `Founder Story` should be the module heading in the specialized editor so canonical identity is clear even if the user renames the tile.
- Typed Founder Story should eventually appear in the registry-defined Intelligence section regardless of renamed title.
- `getBrandWorkspaceSectionForCustomTileTitle()` should eventually become moduleType-aware or be paired with a module-aware section helper.
- Section-routing alignment should be handled in a separate small prerequisite or companion PR before or alongside the first specialized editor. It should not be bundled with AI.

## Registry Findings

Current Founder Story registry definition:

- `id`: `founder_story`
- `label`: `Founder Story`
- `section`: `intelligence`
- `description`: origin story, founder motivation, credibility, and narrative material for campaigns
- `defaultCapabilities`: base editable text capability
- `futureCapabilities`: AI actions, review workflow, readiness, history, graph projection, and search indexing
- `iconName`: `story`
- `allowMultiple`: `false`
- `category`: `knowledge`

Recommendation:

- Do not change registry metadata until a runtime consumer needs it.
- If the first specialized editor needs capability flags, add only immediately consumed flags such as `structuredFields` or `specializedEditor` in that implementation PR.
- Do not add speculative metadata for uploads, citations, readiness, versioning, or graph projection in v1.

## Legacy Compatibility

| Existing tile state | Recommended behavior | Data loss risk | Migration? |
|---|---|---:|---:|
| Typed Founder Story with only `content`/`items` | Open in specialized editor; show `content` as narrative and preserve `items` untouched. | Low if editor mutates/merges only known fields. | No |
| Legacy untyped tile titled `Founder Story` | Treat as legacy-compatible Founder Story for open/create path; specialized editor may display content and optional conversion guidance, but must not auto-write `moduleType`. | Medium if specialized editor assumes `moduleData` exists. | No automatic migration |
| Typed Founder Story renamed by user | Open specialized editor by `moduleType`; display canonical label plus editable custom title. | Low. | No |
| Manual Custom Tile renamed `Founder Story` | Keep legacy-compatible behavior; if selected through canonical path, preserve existing content and do not silently type it. | Medium if user expects generic editor. | No automatic migration |
| Multiple historical Founder Story-like tiles | Select the valid typed tile first; leave others as custom/legacy notes. | Medium if UI hides context. | No automatic merge |
| Existing content that should not be discarded | Keep as `content` narrative or raw compatibility notes; do not overwrite on generate without confirmation. | High without overwrite guard. | No destructive migration |

## Scenario Matrix

| Scenario | Recommended v1 behavior | Notes |
|---|---|---|
| New user clicks Founder Story Missing Knowledge | Create/select typed tile through existing Phase 5 path, then open specialized editor. | Creation behavior remains unchanged. |
| User has partial founder notes | Save partial structured fields and allow manual narrative editing. | Useful without AI. |
| User clicks Generate with weak input | Show guidance for missing inputs instead of generating generic story. | Prevents low-quality AI output. |
| User regenerates with existing narrative | Preview or confirm before replacing `content`. | Prevents manual edit loss. |
| Typed tile has renamed title | Open specialized editor by `moduleType`; canonical heading still says Founder Story. | Title remains presentation text. |
| Legacy untyped title match | Preserve legacy tile and content; do not auto-migrate. | Compatible with Phase 5 fallback. |
| AI route fails | Source fields and existing narrative remain unchanged; show retryable error. | Client applies output only after success. |
| Board reload | `moduleData` and `content` should restore from JSON snapshot. | Requires JSON-safe fields. |

## Implementation Blast Radius

Likely runtime blast radius is limited if implementation is staged:

- `app.js` owns Custom Tile selection, editor rendering, save calls, deletion, Missing Knowledge create/select, and Brand Workspace rendering.
- `styles.css` may be needed only for specialized editor layout polish.
- One new API route may be needed only when AI generation is introduced.
- `knowledge-module-registry.js` should remain unchanged unless a runtime consumer needs a new capability flag.
- Persistence/API board save routes should not need changes for additive JSON-safe `moduleData`.
- Runtime adapter changes are not required for v1 editor delivery unless future views need to expose `moduleData` in a normalized way.

## Recommended PR Sequence

| Phase | Responsibility | Runtime files | User-visible result | Risk |
|---|---|---|---|---|
| F0 | Typed Custom Tile section routing alignment for canonical modules | `app.js` only | Renamed typed Founder Story appears in the correct Brand Workspace section. | Low; placement-only if scoped carefully. |
| F1 | Founder Story specialized editor shell and structured manual fields | `app.js`, optional `styles.css` | Users can capture structured founder facts and edit narrative inside existing editor shell. | Medium; app editor complexity and unknown-field preservation. |
| F2 | Founder Story card preview/status polish | `app.js`, optional `styles.css` | Card shows meaningful Founder Story summary/status without changing persistence. | Low to medium; rendering-only if derived. |
| F3 | Generate Founder Story AI action | `app.js`, one new API route | Users can generate one editable standard narrative from saved source facts. | Medium; AI/API/error/overwrite handling. |
| F4 | Brand Brain context formatter enhancement | `api/_brand-brain-context.js`, possibly one audit doc | Future campaign/AI routes can consume structured Founder Story facts more explicitly. | Medium; affects AI context quality, should be separate from editor. |

## First Implementation PR

Recommended first runtime PR should be **F0 or F1 depending on product tolerance**:

- If visual placement of renamed typed modules must be correct before specialized UX, do F0 first.
- If the team accepts the known title-based placement limitation temporarily, do F1 first.

Preferred first value PR: **F1 — Founder Story specialized editor shell and structured manual fields**.

- **Responsibility:** render a specialized editor for typed Founder Story Custom Tiles inside the existing sticky editor shell; save structured `moduleData.founderStory` source fields and editable `content` narrative; preserve generic delete and selection behavior.
- **Runtime files:** `app.js`; optionally `styles.css` if existing styles cannot support readable grouped fields. If possible, keep v1 first pass to `app.js` plus an audit document.
- **Expected user-visible result:** selecting Founder Story opens a focused editor with founder prompts and narrative output rather than a generic title/content Custom Tile editor.
- **Explicit non-goals:** no AI generation, no API route, no migration, no registry refactor, no uploads, no readiness framework, no full-page module view, no campaign generation integration.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Generic editor overwrites specialized fields | Specialized editor should mutate/merge known nested fields and never replace the whole tile object. |
| State replacement drops unknown fields | Preserve additive `moduleData` through normalization; verify save/load snapshots before release. |
| Autosave timing causes lost edits | Reuse existing input autosave pattern; debounce only in a separate PR if needed. |
| Incomplete AI context produces generic story | Gate generation behind minimum source facts and include explicit missing-input guidance. |
| Generated content overwrites manual edits | Preview or confirm before replacing non-empty `content`. |
| Duplicate event listeners | Render editor controls fresh per selection and attach listeners only within the current panel render. |
| DOM ID collisions | Use Founder Story-specific IDs/classes with a consistent prefix if specialized controls are added. |
| Specialized renderer breaks generic tiles | Branch only on valid `moduleType: "founder_story"` or intentional legacy canonical selection; leave generic custom editor unchanged. |
| Title-based section routing remains confusing | Handle typed section routing in F0 or document as a known limitation until implemented. |
| Legacy data loss | No automatic migration; display legacy content and keep `items` untouched. |
| AI failure leaves inconsistent state | Client should not mutate state until response validates; always restore loading state. |
| Broad `app.js` edits increase boot risk | Keep each PR small, run syntax/browser-global checks, and avoid touching unrelated event handlers. |
| Authentication/API coupling | Follow existing API route patterns and return clear errors for missing API key/session constraints. |
| Branch or PR scope contamination | Use change-scope reports and require final diff to include only expected files. |

## Explicit Non-Goals

Founder Story v1 should not include:

- full conversational interview agent;
- real-time collaboration changes;
- generalized module version history;
- generalized readiness framework;
- graph database changes;
- broad AI Brain rewrite;
- campaign generation;
- pitch deck generation;
- website publishing;
- multi-founder relationship modeling;
- advanced permissions;
- upload processing;
- voice input;
- multiple AI providers;
- analytics dashboard;
- automatic migration;
- broad registry refactor.

## Manual QA Strategy

For the first runtime implementation:

1. Create Founder Story through Missing Knowledge and confirm stable `km_` ID and `moduleType: "founder_story"`.
2. Select Founder Story and confirm the specialized editor opens in the existing sticky editor shell.
3. Fill each structured field and confirm autosave persists after reload.
4. Edit the narrative in `content` and confirm card preview and Brand Brain context still see it.
5. Rename the tile and confirm the specialized editor still opens by `moduleType`.
6. Verify legacy untyped `Founder Story` content is preserved and not silently migrated.
7. Verify `items` are preserved if present.
8. Delete the tile and confirm existing deletion behavior and Missing Knowledge return behavior.
9. Confirm generic Custom Tiles still open the generic editor.
10. Confirm Dashboard, Boards, Brand Workspace, AI Brain, Insights, Canvas, auth, save/load, and autosave still work.
11. If AI is added later, test weak input, successful generation, overwrite confirmation, API failure, and retry.

## Files Inspected

- `docs/audits/2026-07-10-knowledge-module-architecture-audit.md`
- `docs/audits/2026-07-12-knowledge-module-registry.md`
- `docs/audits/2026-07-12-knowledge-module-runtime-adapter-audit.md`
- `docs/audits/2026-07-12-knowledge-module-stable-identity-audit.md`
- `docs/audits/2026-07-12-knowledge-module-stable-id-implementation-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5a-persist-module-type-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5b-adapter-module-type-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5c-duplicate-prevention-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5d-presence-detection-audit.md`
- `docs/audits/2026-07-13-knowledge-module-phase5d-presence-implementation-audit.md`
- `docs/audits/2026-07-13-runtime-boot-and-change-scope-stabilization.md`
- `docs/constitution/engineering-constitution.md`
- `app.js`
- `index.html`
- `styles.css`
- `knowledge-module-registry.js`
- `knowledge-module-runtime-adapter.js`
- `knowledge-module-identity.js`
- `api/_brand-brain-context.js`
- `api/discover-brand-dna.js`
- `api/refine-node.js`
- `api/generate-next-step.js`
- `api/review-node.js`
- `api/boards/[id].js`
- `api/boards/index.js`

## Files Changed

- `docs/audits/2026-07-19-founder-story-module-v1-architecture-ux-audit.md`

## Final Recommendation

Founder Story v1 should:

- capture a small structured set of founder source facts;
- store structured source fields in additive `moduleData.founderStory`;
- keep the editable standard narrative in `content`;
- preserve `id`, `moduleType`, `title`, `content`, and `items`;
- use a specialized editor inside the existing sticky Brand Core editor shell;
- support incomplete answers and autosave source fields;
- use derived read-only completion status only;
- add one AI action, `Generate Founder Story`, only after manual structured editing is stable;
- preview or confirm before replacing an existing narrative;
- preserve all legacy content without automatic migration.

Founder Story v1 should not:

- use `items` as the structured source-of-truth store;
- overwrite source facts with generated narrative;
- silently migrate or type legacy tiles;
- add a full conversational interview agent;
- introduce generalized readiness, history, provenance, graph, upload, or analytics systems;
- require a modal or full-page module architecture;
- combine specialized editor, AI generation, section routing, and AI Brain context upgrades into one broad PR.

Recommended first runtime PR:

- Responsibility: build the Founder Story specialized editor shell and manual structured fields inside the existing Brand Core sticky editor.
- Runtime files: `app.js`; optionally `styles.css` only if existing editor styles are insufficient.
- Expected user-visible result: selecting Founder Story opens a focused founder-story editor with structured prompts and an editable narrative while retaining existing save/load/delete behavior.
- Explicit non-goals: no AI generation, no API route, no migration, no registry refactor, no section-routing rewrite unless handled in a separate prerequisite, no readiness framework, no uploads, no campaign generation, and no broad UI redesign.
