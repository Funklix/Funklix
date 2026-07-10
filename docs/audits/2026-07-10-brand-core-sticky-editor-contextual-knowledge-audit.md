# Brand Core Sticky Editor, Overflow, and Contextual Missing Knowledge Audit

| Field | Value |
|---|---|
| Date | 2026-07-10 |
| Type | Brand Core UX Unification Sprint 1 PR 2 audit and implementation record |
| Scope | Sticky editor, Brand Workspace text overflow, and contextual missing-knowledge prompts only |
| Runtime behavior changes | No data/runtime behavior changes; visual/read-only rendering only |
| Files changed | `app.js`, `styles.css`, `docs/audits/2026-07-10-brand-core-sticky-editor-contextual-knowledge-audit.md` |

## Summary

This PR improves the usability of the migrated Brand Workspace without changing Brand Core data, persistence, APIs, prompts, generation, routing, Dashboard, Boards, Canvas, AI Brain, Insights, autosave, save/load, IDs, or event handlers.

The implementation keeps the restored Brand Workspace page scroll from the layout regression fix and adds:

1. A desktop sticky editor that remains visible while scrolling through long Brand sections.
2. Scoped overflow fixes so Brand DNA signals, cards, long URLs, long German words, Personas, Strategy cards, and editor rows remain readable.
3. Read-only contextual missing-knowledge prompts inside the Brand Workspace sections where existing Dashboard knowledge detection says those inputs are missing.

## Current Usability Problems

- The Brand Workspace can be long after adding the hero and grouped sections, and the editor can disappear from the viewport during scrolling.
- Brand DNA signal cards used a five-column grid, which could squeeze Tone, Mission, Audience, Messaging, and Visual signal content into unreadable columns.
- Existing Brand Core cards and previews used truncation/hidden overflow that could clip long URLs, long words, or long strategy copy.
- Dashboard Brand Evolution already detects missing strategic knowledge, but the Brand Workspace did not explain where each missing item belonged.

## Sticky Editor Root Constraints

The current scroll owner is `.brand-core-workspace.fk-section`, restored by the prior regression fix. Because `position: sticky` is constrained by the nearest scrolling ancestor, the editor must be sticky inside the Brand Core scroll surface rather than fixed to the viewport.

Sticky must also be disabled when `.brand-workspace-body` stacks at narrower widths. Otherwise the editor would become a sticky full-width block below the content, which is not useful and can create awkward scroll behavior.

## Scroll Ownership

Current scroll model after this PR:

- `.brand-core-workspace.fk-section` owns the page-level vertical Brand Workspace scroll.
- `#brand-core-canvas` remains naturally expanded with visible overflow so lower sections remain reachable.
- `.brand-core-side` is sticky on wide desktop only.
- `.brand-core-side` becomes internally scrollable only when its own content is taller than the available viewport.
- At narrower widths, the editor becomes static and participates in natural page flow.

This preserves one primary Brand Workspace page scroll and avoids fixed positioning.

## Text Overflow Root Causes

Root causes identified:

- `.brand-dna-signals` used `repeat(5, minmax(0, 1fr))`, which prioritized five columns even when content needed fewer, wider columns.
- `.brand-dna-score-grid` used two equal columns that could become narrow in constrained shell widths.
- `.bc-node` and `.bc-preview` used maximum heights and hidden/clamped overflow, which could hide important content in the new Brand Workspace groups.
- Long URLs and long German compound words needed scoped `overflow-wrap` handling.
- Editor list rows used flex layouts where long text and remove buttons could compete for space.

## Affected Selectors / Components

Scoped selectors affected:

- `.brand-core-workspace .brand-core-side`
- `.brand-core-workspace .brand-dna-score-grid`
- `.brand-core-workspace .brand-dna-signals`
- `.brand-core-workspace .brand-dna-score`
- `.brand-core-workspace .brand-dna-block`
- `.brand-core-workspace .brand-dna-signals > div`
- `.brand-core-workspace .brand-dna-avatar-details`
- `.brand-core-workspace .bc-row`
- `.brand-core-workspace .bc-node`
- `.brand-core-workspace .bc-preview`
- `.brand-core-workspace .bc-edit-list li`
- `.brand-core-workspace .bc-tags`
- `.brand-core-workspace .bc-assets-preview`
- `.brand-core-workspace .brand-workspace-missing-knowledge`

No global card, Dashboard, Boards, Canvas, AI Brain, or Insights selectors were changed.

## Missing Knowledge Source Logic

This PR reuses the existing read-only Dashboard knowledge detection helper:

- `getDashboardKnowledgeInputStatus()`

That helper checks existing Brand Core text, value proposition, custom tiles, and Brand Assets references for:

- Founder Story
- Market Research
- Pitch Deck
- Whitepaper
- Business Plan

No new fields, storage, upload flows, APIs, or write behavior were added.

## Contextual Mapping Decisions

Each missing item has one primary Brand Workspace location to avoid duplicate prompts:

| Missing item | Contextual section | Reason |
|---|---|---|
| Founder Story | Intelligence / Brand DNA | Founder story strengthens Brand DNA interpretation and AI personality context. |
| Market Research | Strategy | Market research supports positioning, ICP, and messaging. |
| Business Plan | Strategy | Business plan supports value proposition, ICP, and market strategy. |
| Pitch Deck | Deployment / Assets | Pitch decks are reusable strategic assets for campaigns. |
| Whitepaper | Deployment / Assets | Whitepapers are reusable proof/content assets for campaigns. |

Prompts are read-only and visually secondary. They do not open upload flows, create new canonical fields, or add unsupported click behavior.

## Files Changed

- `app.js`
  - Adds contextual missing-knowledge mapping helpers.
  - Adds read-only missing-knowledge blocks to the existing Strategy, Intelligence, and Deployment group render path.
  - Refreshes contextual blocks after Brand Core renders so completed items disappear and missing items can reappear if content is removed.
- `styles.css`
  - Adds sticky editor rules for wide desktop.
  - Adds scoped readable grid and overflow rules for Brand Workspace cards and Brand DNA signals.
  - Adds scoped contextual missing-knowledge styling.
- `docs/audits/2026-07-10-brand-core-sticky-editor-contextual-knowledge-audit.md`
  - Documents audit findings, root constraints, mapping, risks, rollback, and manual QA.

## IDs and Handlers Preserved

Preserved IDs:

- `#brand-core-workspace`
- `#brand-workspace-avatar`
- `#brand-workspace-name`
- `#brand-workspace-readiness-label`
- `#brand-workspace-readiness-detail`
- `#reset-brand-core-btn`
- `#brand-core-canvas`
- `#bc-editor-title`
- `#bc-editor-panel`
- `#brand-dna-card`

Preserved handlers / behavior targets:

- `.bc-node[data-bc-key]` delegated section selection
- existing Brand Core editor input handlers
- `custom:*` tiles
- `custom:add`
- Brand DNA generate/refine/regenerate/accept handlers
- Brand Avatar generate/edit/accept handlers
- website analysis handler
- reset handler

## Runtime Confirmation

This PR does not change:

- Brand Core state
- Brand Brain persistence
- Brand DNA generation/refine/regenerate/accept behavior
- Brand Avatar behavior
- website analysis
- custom tiles
- reset behavior
- Dashboard Brand Evolution logic or UI
- Boards Brand display snapshot
- save/load
- autosave
- routing
- Canvas
- AI Brain
- Insights
- APIs
- prompts
- Workspace/Brand runtime
- storage

## Risks

### Sticky within scroll owner

Sticky behavior depends on `.brand-core-workspace.fk-section` remaining the Brand Workspace scroll owner. If a future PR changes the scroll owner, sticky behavior should be re-audited.

### Taller cards

Removing Brand Workspace card clipping can make cards taller when users enter long content. This is intentional for readability and is safer than hiding important Brand knowledge.

### Missing-knowledge detection is literal

The existing Dashboard detection checks for literal knowledge input labels in existing Brand content/references. This PR intentionally reuses that logic and does not attempt semantic detection.

## Rollback

Rollback steps:

1. Remove the contextual missing-knowledge helpers and render calls from `app.js`.
2. Remove `data-brand-workspace-section` attributes from generated Brand Workspace groups if desired.
3. Remove the `Brand Core PR 2` CSS block from `styles.css`.
4. Remove this audit document.

Rollback does not require storage, API, prompt, Dashboard, Boards, Canvas, AI Brain, or save/load changes.

## Manual QA

1. Open Brand Workspace at desktop width.
2. Scroll from the hero to the final Brand section.
3. Confirm the editor remains visible and usable while scrolling.
4. Confirm the editor stops within its parent and does not cover the hero/footer.
5. Open an editor with long content and confirm the editor itself scrolls when needed.
6. Confirm the page still scrolls naturally.
7. Confirm sticky behavior disables/stacks correctly at narrower widths.
8. Inspect Brand DNA signal cards:
   - no overlap
   - no clipped text
   - long URLs wrap
   - long German text remains readable
9. Inspect Personas and Strategy cards:
   - no text collision
   - remove actions remain usable
   - cards wrap cleanly
10. Confirm missing items appear in their contextual sections:
   - Founder Story in Brand DNA/Intelligence
   - Market Research and Business Plan in Strategy
   - Pitch Deck and Whitepaper in Deployment/Assets
11. Confirm completed/present items do not appear as missing.
12. Confirm the global Missing Knowledge summary remains coherent and is not confusingly duplicated.
13. Confirm all Brand Core editors still work.
14. Confirm Brand DNA and Avatar still work.
15. Confirm Dashboard, Boards, Canvas, AI Brain, and Insights are unaffected.
