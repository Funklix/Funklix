# Brand Core Shell & Information Hierarchy Audit

| Field | Value |
|---|---|
| Date | 2026-07-09 |
| Type | Brand Core UX Unification Sprint 1 PR 1 audit and implementation record |
| Scope | Brand Core shell, hierarchy, visual grouping, and design-system adoption only |
| Runtime behavior changes | None intended; visual shell and grouping only |
| Files changed | `index.html`, `app.js`, `styles.css`, `docs/audits/2026-07-09-brand-core-shell-hierarchy-audit.md` |

## Summary

This PR turns Brand Core from a generic `Brand Brain` editor shell into a clearer `Brand Workspace` surface while preserving the existing Brand Brain data model, editor controls, Brand DNA, Brand Avatar, website analysis, custom tiles, reset behavior, save behavior, generation behavior, and event handlers.

The implementation is intentionally limited to shell, hierarchy, visual grouping, and design-system alignment. It does not add new Brand functionality, fields, APIs, prompts, storage, routing, Dashboard behavior, Canvas behavior, or AI Brain behavior.

## Audit Findings

The previous Brand Core shell exposed the core editor and tile canvas but did not explain what the surface represents, what the current Brand context is, or how the sections relate to downstream AI/campaign work.

The existing dynamic tile model is behavior-sensitive because `.bc-node[data-bc-key]` selection drives the editor panel and `saveBrandBrainState()` persists edits. Therefore this PR preserves every existing `data-bc-key`, editor ID, and action ID while adding grouping wrappers around the existing section cards.

Existing Dashboard Brand signal helpers already provide a safe readiness-style summary. This PR reuses those helpers for a visual readiness shell instead of inventing new scoring or metrics.

## Hierarchy Changes

Brand Core now uses a premium Brand Workspace hero with:

- Brand Workspace title.
- Current Brand display name derived from existing Brand Core / Brand DNA / Brand Assets fields.
- Supporting sentence: `Build the strategic foundation your AI and campaigns will use.`
- Existing accepted Brand Avatar image when available, or existing fallback initials.
- A readiness summary based on existing Brand signal helper output.
- Existing reset action preserved as `#reset-brand-core-btn`.

The Brand canvas is visually grouped into:

1. **Foundation** — Brand Core / identity, mission, vision and values placeholder framing.
2. **Strategy** — Value Proposition, Personas / ICP, Messaging Pillars, Tone of Voice.
3. **Intelligence** — Brand DNA, Brand Avatar, knowledge and website analysis framing.
4. **Deployment** — Brand Assets, Keywords, Content Guidelines, Do / Don't Rules, Voice Examples.
5. **Custom Knowledge** — existing custom tiles and Add custom tile.

These groups are visual wrappers only. No data is merged, moved, renamed, or persisted differently.

## Design Changes

- Added `.fk-section` to the Brand Core workspace shell.
- Added `.fk-card` to the hero, editor side panel, and group surfaces.
- Added `.fk-badge`, `.fk-pill`, and `.fk-btn` usage where safe in static shell markup.
- Added scoped Brand Core shell CSS for spacing, typography, hero layout, avatar treatment, readiness summary, group cards, side-panel hierarchy, and responsive layout.
- Kept individual editor control redesign out of scope for a later PR.

## IDs Preserved

The following behavior-facing IDs remain in place:

- `#brand-core-workspace`
- `#reset-brand-core-btn`
- `#brand-core-canvas`
- `#bc-editor-title`
- `#bc-editor-panel`
- `#brand-dna-card`

The existing `.bc-node[data-bc-key]` section targets remain in place for:

- `brandCore`
- `valueProposition`
- `personas`
- `messagingPillars`
- `toneOfVoice`
- `brandAssets`
- `keywords`
- `contentGuidelines`
- `dosAndDonts`
- `brandVoiceExamples`
- existing `custom:*` tiles
- `custom:add`

## Runtime Confirmation

This PR does not change:

- Brand Brain logic
- Brand Core storage
- Brand Core persistence
- Brand Core save/load serialization
- Brand DNA generation
- Brand DNA refine/accept behavior
- Brand Avatar generation/edit/accept behavior
- website analysis API or apply behavior
- AI prompts
- APIs
- Dashboard behavior
- Canvas behavior
- AI Brain behavior
- Boards behavior
- routing
- autosave
- ownership or permissions

## Risks

### Dynamic Brand Core grouping

The tile groups add wrapper sections around existing `.bc-node[data-bc-key]` elements. The click listener uses event delegation from `#brand-core-canvas`, so selection should continue to work as long as the `.bc-node[data-bc-key]` targets remain unchanged.

### Readiness summary expectations

The readiness area is intentionally visual and based only on existing Dashboard Brand signal helpers. It should not be interpreted as a new completeness scoring model.

### Responsive density

The shell adds more hierarchy and spacing. Smaller screens rely on scoped responsive rules that stack the hero, canvas, and editor.

## Rollback

Rollback steps:

1. Restore the previous static Brand Core shell in `index.html`.
2. Remove Brand Workspace hero helper and element references from `app.js`.
3. Restore the previous ungrouped Brand Core tile markup in `renderBrandCoreTiles()`.
4. Remove the scoped Brand Core shell hierarchy CSS from `styles.css`.
5. Remove this audit document.

No storage, API, prompt, save/load, Dashboard, Canvas, AI Brain, or generation changes depend on this PR.

## Manual QA

- Open Brand Core from the sidebar.
- Confirm the Brand Workspace hero renders.
- Confirm the current Brand name fallback renders when no Brand name is available.
- Confirm an accepted Brand Avatar renders in the hero when available.
- Confirm the readiness summary renders without inventing scores.
- Select every existing Brand Core tile.
- Confirm the editor panel updates for each tile.
- Edit Brand Core overview text.
- Add/remove Tone of Voice item.
- Add/remove Messaging Pillar.
- Edit Value Proposition.
- Add/remove Persona.
- Add/remove Content Guideline.
- Add/remove Do and Don't rules.
- Edit Brand Voice examples.
- Add/remove Keyword.
- Edit Brand Assets domain/logo/typography/colors.
- Analyze a website and cancel/apply suggestions on a test board.
- Generate/refine/accept Brand DNA on a test board.
- Generate/edit/accept Brand Avatar on a test board.
- Add/remove a custom tile.
- Confirm Reset Brand Core still opens the existing confirmation.
- Switch to Dashboard and back.
- Confirm Canvas is unaffected.
- Confirm AI Brain is unaffected.
- Confirm no new console errors appear.
