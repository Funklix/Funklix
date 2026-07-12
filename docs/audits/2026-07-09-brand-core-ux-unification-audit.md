# Brand Core UX Unification Sprint 1 — Architecture & Design Audit

| Field | Value |
|---|---|
| Date | 2026-07-09 |
| Type | Documentation-only architecture and design audit |
| Scope | Brand Core / Brand Brain surface, Brand DNA, Brand Avatar, Brand state, editor UX, and future implementation blueprint |
| Runtime behavior changes | None |
| Files changed | `docs/audits/2026-07-09-brand-core-ux-unification-audit.md` |

## Documents and Code Read

- `docs/audits/2026-07-06-ui-design-system-migration-audit.md`
- `docs/audits/2026-07-06-boards-design-migration-audit.md`
- `docs/audits/2026-07-06-boards-final-polish-audit.md`
- `docs/audits/2026-07-06-boards-avatar-ordering-drag-audit.md`
- `docs/audits/2026-07-06-boards-active-board-ordering-audit.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `index.html`
- `app.js`
- `styles.css`

## Runtime Confirmation

This PR is documentation only.

No runtime files were modified. Specifically, this audit does not modify:

- Brand Core runtime
- Brand Brain state
- Brand DNA generation
- Brand Avatar generation
- APIs
- prompts
- storage
- Canvas
- Dashboard
- AI Brain
- Insights
- routing
- autosave
- save/load
- CSS
- HTML
- JavaScript behavior

---

## Executive Summary

Brand Core is strategically important but still feels like an internal editor rather than the premium Brand operating system implied by Funklix's product architecture. The current implementation contains a useful foundation: board-scoped Brand Brain state, editable knowledge tiles, Brand DNA discovery, accepted Brand DNA state, Brand Avatar generation, domain analysis, Dashboard signal extraction, and Brand snapshot serialization into board saves. However, the UX is fragmented, the design system adoption is low, and the information architecture does not yet match the approved product architecture of Workspace → Brand → Marketing Knowledge Graph → Campaign Boards → Campaign Canvas → AI Brain → Simulation → Insights.

The largest gap is not a single missing component. It is the absence of a clear Brand Core product model. The current UI mixes a visual tile canvas, a side-panel editor, AI discovery, avatar generation, custom tiles, and website analysis without a strong hierarchy for what the user should complete first, what is optional, what is approved, and what powers downstream campaign intelligence.

### Overall maturity score

| Dimension | Score | Summary |
|---|---:|---|
| Architecture readiness | 5 / 10 | Board-scoped Brand Brain exists, but Workspace/Brand separation and Marketing Knowledge Graph concepts are incomplete. |
| UX maturity | 4 / 10 | Editable tiles work, but section hierarchy, onboarding, completeness, review, approval, and AI collaboration are unclear. |
| Design-system adoption | 3.5 / 10 | Brand Core uses bespoke `brand-*`, `bc-*`, and `brand-dna-*` classes, plain buttons, custom inputs, and non-tokenized styling. |
| Data completeness model | 3 / 10 | Many inputs exist, but no user-facing completeness, readiness, health, or missing-knowledge map exists. |
| Future readiness | 4 / 10 | Brand DNA and Avatar exist, but deployment, multi-brand, language, dark mode, collaboration, simulation, and learning-loop readiness are weak. |
| Implementation risk | Medium | Brand Core is generated dynamically and persisted with board state/localStorage, but most Sprint 1 visual migration can be additive if IDs/events/state keys are preserved. |

### Highest-priority visual and product debt

1. **Brand Core needs a premium shell and hierarchy.** The current `Brand Brain` header, canvas, and side editor are functional but do not explain Brand Overview, readiness, or what the user should complete next.
2. **The editor needs design-system controls.** Inputs, textareas, add rows, delete buttons, chips, and action buttons are plain or bespoke.
3. **Brand DNA and Brand Avatar need clearer status and review states.** Generate, refine, accept, avatar, and prompt actions exist but do not yet follow a unified AI review pattern.
4. **Knowledge areas are incomplete relative to the requested product architecture.** Mission, Vision, Values, Positioning, Audience, ICP, Competitors, Product Intelligence, Product Knowledge, Memory, and Consciousness are either missing, represented indirectly, duplicated, or buried in custom tiles.
5. **No readiness model exists.** There is no Brand completeness, AI readiness, voice readiness, knowledge completeness, messaging completeness, or missing-section guidance.
6. **Future Brand vs. board scoping is unclear.** Brand Brain state is currently board-scoped; that may be useful for campaign-specific context, but it does not yet model a Workspace-level Brand entity.

---

## Current State

### Current static shell

Brand Core is mounted as `#brand-core-workspace` with a `Brand Brain` header, reset button, `#brand-core-canvas`, and a right-side `Brand Core Details` editor panel. This shell is hidden/shown by app view state and is not yet implemented as a design-system `.fk-section` surface.

Current shell inventory:

| Element | Current status | Notes |
|---|---|---|
| `#brand-core-workspace` | Exists | Main Brand Core surface; uses bespoke `brand-core-workspace`. |
| `.brand-mode-header` | Exists | Header says `Brand Brain`, not `Brand Core`; includes plain reset button. |
| `#reset-brand-core-btn` | Exists | Behavior-sensitive reset action; visually legacy. |
| `#brand-core-canvas` | Exists | Dynamic tile area; receives Brand DNA card and knowledge tiles. |
| `.brand-core-side` | Exists | Editor side panel; contains title and generated editor controls. |
| `#bc-editor-title` | Exists | Updates based on selected tile. |
| `#bc-editor-panel` | Exists | Dynamic generated form body. |

### Current state model

The default Brand Core state includes:

- `brandCore`
- `toneOfVoice`
- `messagingPillars`
- `valueProposition`
- `personas`
- `contentGuidelines`
- `dosAndDonts`
- `brandVoiceExamples`
- `keywords`
- `brandAssets`
- `brandDNA`
- `customTiles`

This is a useful working model, but it does not directly expose all requested architecture sections such as Mission, Vision, Values, Positioning, Audience, ICP, Competitors, Consciousness, Memory, Product Intelligence, or Product Knowledge.

### Current persistence and hydration model

Brand Brain state is normalized and serialized through `normalizeBrandCoreState()`, `serializeBrandCoreSnapshot()`, and `getBrandCoreData()`. It is saved locally using `saveBrandBrainState()` under a board-scoped storage key and is also serialized into board snapshots during save/load flows.

Important implementation observations:

- Brand Core state is currently board-contextual rather than clearly Workspace/Brand-level.
- `brand_core_snapshot` is used as a board payload concept.
- The Boards list API now exposes only a display-safe `brand_display`, but this does not create a full Brand entity.
- Dashboard Brand Evolution reads Brand Core signals, but the relationship is still passive and incomplete.
- AI generation calls pass `brandBrainData: state.brandCore` to multiple generation flows.

### Current rendered sections

| Requested area | Current implementation status | Notes |
|---|---|---|
| Brand Overview | Partial | `brandCore` acts as a general overview/founder/story field, but label and purpose are broad. |
| Brand Identity | Partial | Brand DNA and Brand Avatar exist; brand name/logo/domain/color/typography are stored in `brandAssets`, but not presented as a coherent identity profile. |
| Mission | Missing / indirect | May be embedded in `brandCore` or custom tiles; no first-class field. |
| Vision | Missing / indirect | No first-class field. |
| Values | Missing / indirect | Could be represented by tone, content guidelines, or custom tiles, but not first-class. |
| Positioning | Partial / indirect | `valueProposition` exists; no positioning statement, category, differentiators, proof, or alternatives. |
| Voice | Partial | `toneOfVoice`, `brandVoiceExamples`, `dosAndDonts`, and `contentGuidelines` exist. |
| Personality | Partial | Brand DNA archetypes model personality, but not integrated into editor sections. |
| Messaging | Partial | `messagingPillars` and `valueProposition` exist. |
| Audience | Partial | `personas` exists; audience segments and ICP are not first-class. |
| ICP | Missing / indirect | Could be a persona, but no dedicated ICP readiness section. |
| Personas | Exists | Simple name/note entries. |
| Competitors | Missing | No competitor field or comparison model. |
| Knowledge | Partial | `keywords`, custom tiles, and Brand Assets references exist; no unified knowledge graph. |
| Avatar | Exists | Brand Avatar can be generated after accepted Brand DNA. |
| Consciousness | Placeholder concept | Brand DNA suggests personality, but there is no Brand consciousness model/state. |
| Memory | Partial / internal | Local/board-scoped Brand Brain state acts like memory; no user-facing memory history, provenance, or learning-loop review. |
| Product Intelligence | Missing / indirect | Domain analysis may import suggestions, but no structured product intelligence area. |
| Product Knowledge | Missing / indirect | Could be custom tiles/references, but no first-class product library. |

### What already exists

- Board-scoped Brand Brain state.
- Dynamic editable Brand tiles.
- Dynamic side editor.
- Custom tiles.
- Website/domain analysis entry point.
- Brand DNA discovery, refine, accept, regenerate.
- Brand Avatar generation and prompt edit.
- Brand Avatar acceptance.
- Brand snapshot serialization.
- Dashboard Brand Evolution signal consumption.
- AI generation context passing.
- Reset Brand Core confirmation.

### What is placeholder

- Brand Switcher says Brand switching is coming soon.
- Brand Core does not have a real Workspace-level Brand identity shell.
- Consciousness and Memory are implied by Brand Brain language but not productized.
- Product Intelligence and Product Knowledge are not first-class sections.
- Marketing Knowledge Graph is represented visually by tiles, but not semantically as a graph with relationships, provenance, or readiness.

### What is duplicated or overlapping

| Overlap | Current issue |
|---|---|
| `brandCore` vs. Mission/Vision/Values | General text field may contain several strategic concepts without structure. |
| `toneOfVoice`, `brandVoiceExamples`, `dosAndDonts`, `contentGuidelines` | All influence voice; currently separate but without a combined Voice readiness model. |
| `valueProposition` vs. Positioning vs. Messaging | Value proposition and messaging pillars exist, but positioning is not distinct. |
| `personas` vs. ICP vs. Audience | Personas exist, but ICP and audience strategy are not modeled. |
| `brandAssets` vs. Brand Identity | Assets store domain/logo/colors/typography/references, but identity profile is not cohesive. |
| Brand DNA vs. Consciousness/Personality | Brand DNA captures archetypes, but the UX does not clearly tell users how this drives Brand consciousness or AI behavior. |

### What is disconnected

- Brand Core does not clearly connect to the Brand Switcher shell.
- Brand Core does not show which Campaign Boards use the Brand.
- Brand Avatar is not surfaced as part of a first-class Brand identity header inside Brand Core.
- Dashboard references Brand signals, but Brand Core does not show Dashboard readiness or downstream impact.
- AI Brain can use Brand Brain data, but Brand Core does not expose AI readiness or AI context quality.
- Insights and Simulation are not visibly connected to Brand completeness.

### What is unused or underused

- Custom tiles are flexible but do not map to readiness scoring.
- `brandAssets.references` exists in state defaults but does not have a strong upload/reference management UI in the inspected renderer.
- Brand DNA signals are displayed, but not converted into persistent readiness indicators beyond accepted result state.
- Brand Avatar can be generated, but there is no broader deployment model for where the avatar appears.

---

## Architecture Findings

### Product architecture alignment

Approved architecture target:

Workspace → Brand → Marketing Knowledge Graph → Campaign Boards → Campaign Canvas → AI Brain → Simulation → Insights

Current implementation:

Board / Canvas → board-scoped Brand Brain snapshot → Campaign generation and Dashboard signals → Boards brand display snapshot

### Inconsistency inventory

| Architecture layer | Expected role | Current Brand Core state | Gap |
|---|---|---|---|
| Workspace | Holds brands, preferences, collaborators, language/theme settings | No real Workspace surface in Brand Core | Multi-brand and workspace-level preferences are not represented. |
| Brand | Durable identity and strategy object | Board-scoped Brand Brain snapshot | Brand is not yet a first-class entity independent of a board. |
| Marketing Knowledge Graph | Structured knowledge, relationships, provenance, readiness | Visual tile grid and custom tiles | No graph semantics, links, provenance, completeness, or source confidence. |
| Campaign Boards | Library/workspace containers | Boards can display `brand_display` | Boards show Brand snapshot display, but not relationship management. |
| Campaign Canvas | Execution workspace | Receives Brand Brain data in saves/generation | Connection is functional but not explained to users. |
| AI Brain | Collaborative strategist | Receives Brand data in analysis/generation paths | Brand Core does not show what AI knows or where context is weak. |
| Simulation | Tests strategy/output | Not represented in Brand Core | Needs readiness gates and scenario inputs. |
| Insights | Learns from performance | Dashboard/Insights references are not connected to Brand learning loop | No feedback ingestion, confidence, or learning history. |

### Recommended architecture direction

Brand Core Sprint 1 should not introduce a full new data model. It should create a safer UX blueprint around the existing state and prepare for future Brand entity work.

Recommended near-term model:

1. **Brand Overview**: name/status/completeness/primary CTA.
2. **Brand Knowledge**: core statement, value proposition, messaging, audience/personas, voice, assets.
3. **Brand Intelligence**: DNA, Avatar, website analysis, AI readiness.
4. **Brand Deployment**: where this Brand powers Boards, Canvas, AI Brain, Simulation, and Insights.
5. **Missing Knowledge**: clear list of gaps and one action per gap.

Recommended future model:

- Workspace has many Brands.
- Brand has structured knowledge sections.
- Boards reference a Brand.
- Canvas and AI Brain consume the active Brand.
- Insights feed learning back into Brand Knowledge.

---

## UX Findings

### UX maturity by section

| Section | Rating | Findings |
|---|---|---|
| Brand Core shell | Needs work | The shell exists but lacks a premium product overview, explainers, progress, or clear next action. |
| Brand Overview / `brandCore` | Needs work | Current field is too broad and can absorb mission, story, positioning, values, and product notes. |
| Tone of Voice | Good | Editable list is useful; needs better hierarchy, empty state, examples, and AI assistance. |
| Messaging Pillars | Good | Clear list model; needs strategic context and readiness. |
| Value Proposition | Good | Important field exists; should become part of Positioning. |
| Personas | Needs work | Simple name/note entries; lacks ICP, segments, pains, jobs, triggers, objections. |
| Content Guidelines | Good | Useful for AI output guardrails; needs examples/status. |
| Do / Don't | Good | Useful structure; UI is utilitarian. |
| Brand Voice Examples | Good | Good/avoid model is clear; needs richer examples and review state. |
| Keywords | Needs work | Tags exist, but purpose is unclear and disconnected from SEO/content strategy. |
| Brand Assets | Needs work | Domain/logo/colors/typography exist; references are not a finished upload/reference library. |
| Custom Tiles | Needs work | Flexible but can become unstructured dumping ground. |
| Brand DNA | Good | Strongest differentiated Brand feature; needs design-system polish and clearer review/approval language. |
| Brand Avatar | Good | Exists and is valuable; needs identity placement, deployment explanation, and approval status. |
| Website analysis | Needs work | Useful AI integration; currently hidden inside Brand Assets editor and uses alert/confirm style. |
| Reset flow | Needs work | Destructive action exists; modal pattern is legacy. |

### Information hierarchy

Current hierarchy is tile-first:

1. Brand DNA card.
2. Brand Core tile.
3. Rows of knowledge tiles.
4. Brand Assets tile.
5. Custom tiles.
6. Side editor for selected tile.

Issues:

- Users must infer what to complete first.
- Brand DNA appears before the user knows whether enough Brand knowledge exists.
- Brand Avatar appears only after accepted DNA, but there is no persistent Brand identity header.
- Reset is visually prominent in the top header despite being destructive and rarely used.
- The side editor competes with the tile canvas rather than feeling like a guided workflow.

Recommended hierarchy:

1. Brand header: Brand name/avatar/status/completeness.
2. Readiness summary: Brand completeness, AI readiness, Voice readiness, Knowledge readiness.
3. Suggested next action: one clear action based on missing data.
4. Core knowledge sections.
5. Intelligence modules: Brand DNA, Avatar, Domain Analysis.
6. Deployment/readiness: where Brand powers Campaigns, AI Brain, Simulation, Insights.

### Navigation

Current navigation:

- Brand Core is a sidebar nav item.
- Inside Brand Core, tile selection drives editor content.
- There is no section nav, tabs, checklist, or progress path.

Recommended Sprint 1 navigation:

- Keep sidebar nav unchanged.
- Add internal section anchors or grouped cards only after auditing behavior-facing selectors.
- Prefer a two-column layout with grouped section cards and the existing editor panel before introducing new routes.

### Editing flow

Current editing flow:

1. Click a tile.
2. Side editor changes.
3. Input changes save immediately to local Brand Brain state and mark unsaved.
4. Tiles preview updates live.

Strengths:

- Fast and direct.
- Existing state is normalized.
- Live preview reinforces edit feedback.

Weaknesses:

- No saved/unsaved section-level status.
- No validation or required fields.
- No completion guidance.
- No review/approval step for core knowledge except Brand DNA/Avatar.
- Some controls are ambiguous, such as tag click-to-remove.

### Review and approval flow

Current approval states:

- Brand DNA can be generated, refined, accepted.
- Brand Avatar can be generated and accepted.
- Website analysis uses a confirmation modal before applying suggestions.

Missing approval states:

- Brand Overview approval.
- Voice approval.
- Messaging approval.
- Audience/ICP approval.
- Assets/reference approval.
- AI readiness approval.
- Brand deployment approval.

Sprint 1 should not add complex approval workflows, but it should label generated vs. accepted vs. incomplete states consistently.

### AI integration

Current AI integrations:

- Analyze website/domain.
- Discover/refine Brand DNA.
- Generate/edit Brand Avatar.
- Brand Brain data is passed into campaign generation and other AI flows.

UX gaps:

- AI actions are scattered.
- Loading states do not fully explain what AI is doing.
- Alerts/prompts are used for some AI interactions.
- There is no AI readiness checklist.
- Users cannot easily see which Brand inputs improve AI output.

### Discoverability

Weak discoverability areas:

- Brand Assets domain analysis is hidden inside one tile editor.
- Brand Avatar depends on accepted DNA but the dependency is not clearly taught.
- Custom tiles are available but not tied to suggested knowledge gaps.
- References exist in state but not surfaced as a strong management area.
- Dashboard Brand Evolution references missing signals, but Brand Core does not mirror that guidance.

### Consistency with Dashboard and Boards

Dashboard and Boards now feel more premium because they use clearer cards, hierarchy, badges, and action hierarchy. Brand Core still uses older bespoke surfaces and should adopt the same calm/premium language:

- `.fk-section` shell.
- `.fk-card` section cards.
- `.fk-btn` action hierarchy.
- `.fk-input`, `.fk-textarea`, `.fk-pill`, `.fk-badge` controls.
- Standard empty states: headline, description, one clear action.
- Reduced visual density.
- Clear primary next action.

---

## Design Findings

### Legacy component inventory

| Component area | Current legacy patterns | Migration notes |
|---|---|---|
| Buttons | `#reset-brand-core-btn`, Brand DNA buttons, avatar buttons, editor add/delete buttons, confirmation buttons use bespoke/plain styles | Migrate class-only where possible; preserve IDs. |
| Cards | `.bc-node`, `.brand-dna-card`, `.brand-dna-score`, `.brand-dna-block`, `.brand-core-side` are bespoke | Can adopt `.fk-card` styling carefully, but tile layout should be audited before structural changes. |
| Inputs | Generated editor inputs/textareas lack `.fk-input` / `.fk-textarea` | Safe class additions likely possible if IDs and event listeners remain. |
| Headers | `.brand-mode-header` is bespoke and less polished than Dashboard/Boards headers | Add audit-backed shell PR before changing layout. |
| Badges | `.bc-badge`, `.bc-count`, `.brand-dna-eyebrow` are bespoke | Could align to `.fk-badge` / `.fk-pill`. |
| Spacing | Brand Core uses bespoke 12px/16px spacing and dense cards | Needs tokenized spacing and calmer grouping. |
| Forms | Dynamic forms use mixed labels, action rows, tag chips, delete buttons | Needs form primitive pass. |
| Tables | None observed | No table migration required in Sprint 1. |
| Expanders | Avatar prompt uses native `details/summary` with bespoke styling | Should align with future disclosure pattern. |
| Action bars | Brand DNA and editor add rows are custom | Need primary/secondary/ghost/danger hierarchy. |
| Empty states | Brand DNA empty exists; tile empties often show counts or blank previews | Need consistent empty-state anatomy. |
| Loading states | Brand DNA loading and Avatar loading exist; website analysis uses button text and alerts | Need AI loading copy and status component. |
| Status indicators | Accepted/generated/loading states are text labels, badges, and copy | Need consistent Brand status taxonomy. |

### Theme readiness

Brand Core has many hardcoded colors in `styles.css` and inline generated HTML styles for colors. This will be fragile under dark mode.

High-risk areas for dark mode:

- `.brand-core-workspace` background.
- `.bc-node` backgrounds and shadows.
- `.bc-good` / `.bc-bad` semantic backgrounds.
- `.brand-dna-card` gradients.
- `.brand-dna-score` and signal cards.
- Inline palette swatches are fine as data, but surrounding chip borders/backgrounds need tokens.

### Responsive readiness

Brand Core uses a two-column grid with a 360px side panel. The Brand DNA card has some responsive handling, but the broader Brand Core workspace needs a dedicated responsive pass.

Risks:

- Side editor may crowd the canvas on medium widths.
- Tile grid uses four columns, which can become dense.
- Brand DNA signal grid uses five columns before breakpoint.
- Avatar preview has only one breakpoint.
- Long text in tiles can truncate important strategy.

### Accessibility readiness

Known gaps:

- Tile cards are clickable articles, but they should be validated for keyboard access/focus semantics before implementation.
- Click-to-remove tags need accessible buttons or explicit labels.
- AI prompts using `window.prompt` are not ideal.
- Alerts are disruptive and not product-consistent.
- Destructive reset action needs standard confirmation semantics.
- Generated dynamic controls need labels associated with inputs.

---

## Product Architecture Audit

### Brand Core vs. Brand Brain naming

The navigation says `Brand Core`, while the page header says `Brand Brain`. Both terms are valuable but currently ambiguous.

Recommended language:

- **Brand Core** = the user-facing product area and structured source of truth.
- **Brand Brain** = the AI-readable knowledge layer derived from Brand Core.
- **Brand DNA** = AI-generated personality/archetype analysis.
- **Brand Avatar** = visual embodiment of accepted Brand DNA.

### Workspace / Brand gap

The product architecture expects Workspace → Brand, but the current implementation stores Brand Brain inside board context. Sprint 1 should not introduce a new storage model, but it should avoid language that implies multi-brand is complete.

Recommended audit-backed copy direction for future implementation:

- `Current board Brand Core` until Workspace Brand exists.
- Show `Brand deployment coming later` rather than implying global brand switching.
- Document future migration from board-scoped snapshot to Workspace Brand entity.

### Marketing Knowledge Graph gap

Current tiles look graph-like but are not a graph. A future Marketing Knowledge Graph should include:

- Knowledge node type.
- Source/provenance.
- Confidence.
- Last reviewed.
- Relationship to campaigns/nodes.
- Missing information.
- AI consumption status.

Sprint 1 should only visually prepare grouped knowledge sections, not implement graph semantics.

### Learning Loop gap

Insights do not feed Brand Core. There is no history of learnings, no accepted/rejected insight loop, and no Brand memory timeline.

Future loop:

1. Campaign output/performance produces insight.
2. Insight proposes Brand learning.
3. User reviews/accepts learning.
4. Brand Core updates with provenance.
5. AI Brain and future campaigns use updated knowledge.

---

## Missing Features

### Readiness and health

Missing:

- Brand health score.
- Brand completeness score.
- AI readiness score.
- Voice readiness score.
- Knowledge completeness score.
- Messaging completeness score.
- Audience/ICP readiness.
- Asset readiness.
- Brand DNA readiness.
- Avatar readiness.
- Deployment readiness.

Recommended Sprint 1 version:

- Do not compute complex scores yet.
- Add a simple section-completeness audit model in documentation first.
- Future implementation can derive basic completeness from existing fields only.

### Strategy sections

Missing or indirect:

- Mission.
- Vision.
- Values.
- Positioning statement.
- Category.
- Differentiators.
- Proof points.
- Competitors.
- ICP.
- Audience segments.
- Persona pains/jobs/triggers/objections.
- Product Intelligence.
- Product Knowledge.
- Offers/pricing/packages.
- Objection handling.
- Brand promises.

### Knowledge and references

Missing or incomplete:

- Reference upload/library UI.
- Source provenance.
- Knowledge confidence.
- Last reviewed timestamps.
- Duplicate knowledge detection.
- Structured product facts.
- Website analysis review diff.
- Approved vs. draft suggestions.

### AI collaboration

Missing:

- Explainable Brand Brain readiness.
- AI action recommendations by missing section.
- AI-generated suggestions in editor sections.
- Review queue for AI suggestions.
- AI loading states with educational copy.
- Clear separation between user-authored, AI-suggested, and accepted knowledge.

### Collaboration

Missing:

- Section owner/reviewer.
- Last edited by.
- Comments/review on Brand sections.
- Approval status per section.
- Shared Brand governance.

### Language and localization

Missing:

- Interface language preference.
- Generated content language preference.
- Per-brand language profile.
- Tone/voice examples by language.
- Localization readiness status.

### Multi-brand workspace

Missing:

- Brand list.
- Brand switcher behavior.
- Brand creation flow.
- Active Brand binding to board.
- Brand permissions.
- Brand archive/delete.
- Brand-level avatar/name display.

---

## Future Readiness

| Future area | Readiness | Notes |
|---|---|---|
| Brand Avatar | Medium | Generation/acceptance exists; needs identity header and deployment explanation. |
| Brand Deployment | Low | No UX for where Brand powers Boards/Canvas/AI/Insights. |
| AI Brain | Medium-low | Data is passed, but no AI readiness or visible context quality. |
| Simulation | Low | No simulation inputs/readiness gates. |
| Mission Control | Medium-low | Dashboard consumes some Brand signals; not bidirectional. |
| Funnel Simulator | Low | No structured funnel/positioning/product facts. |
| Collaboration | Low | No section-level ownership/review/comments. |
| Insights | Low | No learning-loop ingestion. |
| Learning Loop | Low | No accepted learnings, provenance, or memory timeline. |
| Language | Low | Hardcoded strings and no language settings. |
| Dark Mode | Low-medium | Many hardcoded colors and bespoke gradients. |
| Multi-brand workspace | Low | Brand Switcher is placeholder and Brand is board-scoped. |

---

## Migration Roadmap

### Guiding principles

1. Keep Sprint 1 additive.
2. Do not change Brand storage or AI prompts in the first visual PR.
3. Preserve all IDs and behavior-facing selectors.
4. Convert classes and hierarchy before changing data shape.
5. Separate visual migration from product capability implementation.
6. Keep Canvas, Dashboard, AI Brain, APIs, prompts, and save/load out of scope unless a later audit explicitly approves changes.

### Recommended PR sequence

#### PR 1 — Brand Core Shell and Hierarchy Polish

- **Scope:** Upgrade Brand Core shell to a premium `.fk-section`-like layout, improve header hierarchy, add explanatory copy, reduce reset prominence, and group canvas/editor as a Brand workspace.
- **Affected files likely:** `index.html`, `styles.css`, `docs/audits/brand-core-shell-audit.md`.
- **Risk:** Low-medium.
- **Non-goals:** No state changes, no AI changes, no new fields, no storage changes, no prompt changes.
- **Manual QA:** Open Brand Core, switch away/back, reset still opens confirmation, Canvas/Dashboard unaffected.
- **Rollback:** Revert class/header/style changes.

#### PR 2 — Brand Core Editor Design-System Migration

- **Scope:** Add `.fk-input`, `.fk-textarea`, `.fk-btn`, `.fk-pill`, `.fk-badge`, and safer form spacing to generated editor controls where IDs/listeners are preserved.
- **Affected files likely:** `app.js`, `styles.css`, audit doc.
- **Risk:** Medium.
- **Non-goals:** No field additions, no validation model, no storage changes.
- **Manual QA:** Edit every existing section, add/remove list items, add/remove tags, add/remove custom tile, save dirty state still works.
- **Rollback:** Revert class additions and scoped CSS.

#### PR 3 — Brand Knowledge Card Polish

- **Scope:** Improve `.bc-node` tiles into calmer cards with consistent empty previews, counts, selected state, and section hierarchy.
- **Affected files likely:** `app.js`, `styles.css`, audit doc.
- **Risk:** Medium.
- **Non-goals:** No semantic graph, no new data model, no tile reorder.
- **Manual QA:** Select each tile, previews update live, custom tiles still render, editor still syncs.
- **Rollback:** Revert tile markup/style changes.

#### PR 4 — Brand DNA and Avatar Review Pattern

- **Scope:** Migrate Brand DNA/Avatar card visual hierarchy, actions, empty/loading states, accepted/draft labels, and avatar preview to design-system patterns.
- **Affected files likely:** `app.js`, `styles.css`, audit doc.
- **Risk:** Medium.
- **Non-goals:** No prompt/API changes, no generation behavior changes, no avatar storage changes.
- **Manual QA:** Generate/refine/accept Brand DNA, generate/edit/accept Avatar, preview Avatar, loading states render.
- **Rollback:** Revert Brand DNA/Avatar markup/style changes.

#### PR 5 — Brand Completeness and Missing Knowledge Audit Model

- **Scope:** Documentation-first scoring model for completeness/readiness using existing fields only; no implementation unless separately approved.
- **Affected files likely:** docs only.
- **Risk:** Low.
- **Non-goals:** No runtime scoring, no UI changes.
- **Manual QA:** None beyond docs review.
- **Rollback:** Remove doc.

#### PR 6 — Brand Completeness Surface

- **Scope:** Add a simple read-only completeness/readiness summary derived from existing fields only.
- **Affected files likely:** `app.js`, `styles.css`, possibly `index.html`, audit doc.
- **Risk:** Medium.
- **Non-goals:** No new fields, no persistence changes, no AI calls.
- **Manual QA:** Empty Brand shows missing items, filled sections improve readiness, no save/load changes.
- **Rollback:** Remove summary helper and markup.

#### PR 7 — Website Analysis UX Cleanup

- **Scope:** Replace alert/confirm-like UX with standard modal/status presentation while preserving `/api/analyze-brand-domain` behavior and apply flow.
- **Affected files likely:** `app.js`, `styles.css`, audit doc.
- **Risk:** Medium-high.
- **Non-goals:** No prompt/API changes, no suggestion schema changes.
- **Manual QA:** Analyze valid domain, cancel apply, apply suggestions, failed analysis state, dirty/save state.
- **Rollback:** Restore previous alert/confirmation flow.

#### PR 8 — Future Brand Entity Architecture ADR

- **Scope:** Document path from board-scoped Brand Brain snapshot to Workspace-level Brand entity, Brand Switcher, multi-brand permissions, and Board-to-Brand references.
- **Affected files likely:** docs only.
- **Risk:** Low.
- **Non-goals:** No implementation.
- **Manual QA:** None beyond architecture review.
- **Rollback:** Remove ADR.

---

## Immediate Next Recommended PR

**PR 1: Brand Core Shell and Hierarchy Polish**

Why first:

- It is the smallest safe implementation step.
- It improves perceived quality without changing Brand data, prompts, APIs, storage, or AI behavior.
- It aligns Brand Core with the improved Dashboard and Boards surfaces.
- It creates the visual frame needed for later editor, Brand DNA, readiness, and deployment work.

Strict scope:

- Add design-system classes to static Brand Core shell where safe.
- Improve header copy and hierarchy.
- Keep `#brand-core-workspace`, `#reset-brand-core-btn`, `#brand-core-canvas`, `#bc-editor-title`, and `#bc-editor-panel` intact.
- Add scoped CSS only for Brand Core shell.
- Do not touch generation, storage, save/load, Canvas, Dashboard, AI Brain, APIs, or prompts.

---

## Runtime Confirmation for Future Implementations

Every future Brand Core implementation PR should explicitly confirm:

- Existing IDs are preserved.
- Existing event listeners still bind.
- `saveBrandBrainState()` still marks dirty when expected.
- `loadBrandBrainState()` still hydrates existing boards.
- `serializeBrandCoreSnapshot()` still returns compatible data.
- Board save/load still includes Brand snapshot as before.
- Brand DNA generation/refine/accept still works.
- Brand Avatar generation/edit/accept still works.
- Domain analysis still works.
- Dashboard Brand Evolution still renders.
- Canvas and AI Brain are unaffected unless explicitly in scope.

## Manual QA Recommendations

For Brand Core Sprint 1 implementation PRs, run this checklist:

- Open Brand Core from sidebar.
- Switch from Brand Core to Dashboard and back.
- Edit Brand Core overview text.
- Add/remove Tone of Voice item.
- Add/remove Messaging Pillar.
- Edit Value Proposition.
- Add/remove Persona.
- Add/remove Content Guideline.
- Add/remove Do and Don't rules.
- Edit Brand Voice good/avoid examples.
- Add/remove Keyword.
- Edit Brand Assets domain/logo/typography.
- Add/remove color.
- Analyze a domain and cancel apply.
- Analyze a domain and apply suggestions.
- Generate Brand DNA.
- Refine Brand DNA.
- Accept Brand DNA.
- Generate Brand Avatar.
- Edit Avatar prompt.
- Accept Avatar.
- Add/remove custom tile.
- Reset Brand Core and cancel.
- Reset Brand Core and confirm on a test board.
- Save board and reload.
- Confirm Dashboard Brand Evolution still reads Brand signals.
- Confirm Canvas nodes and edges are unaffected.
- Confirm AI Brain still opens.
- Confirm browser console has no new errors.

## Final Recommendation

Proceed with a small Brand Core shell polish PR first. Do not add missing fields, readiness scoring, new storage, Brand entity APIs, prompt changes, or AI behavior until the shell and generated editor are migrated safely and a separate completeness/readiness audit defines the exact model.
