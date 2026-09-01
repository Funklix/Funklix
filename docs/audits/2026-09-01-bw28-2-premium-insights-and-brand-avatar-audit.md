# BW-28.2 Audit — Premium AI Insights and Brand Avatar conversation design

**Date:** 2026-09-01

**Scope:** Documentation-only product-design and architecture audit of merged BW-28/BW-28.1
**Decision:** **GO only as one combined, contract-led implementation PR after the consistency and shell preconditions in this document are met.** Do not implement this document piecemeal as another layer of isolated overrides.

## 1. Executive conclusion

BW-28.1 made AI Insights honest and useful, but its presentation still treats an executive result, a warning, a supporting diagnostic, an action, and methodology as variations of the same bordered card. The next version should be one campaign-health experience: a compact health header, one composed overview, an honest five-stage journey, prominent opportunities, compact diagnostics, a collapsed measured-performance notice, and a secondary methodology disclosure.

The confirmed CTA contradiction is **not evidence that the CTA formula is wrong**. It is a rendering-contract defect: `qualityScore` measures uniqueness (`unique CTA values / CTA-bearing values`), while the fixed interpretation always says some content may need a clearer next step. A one-CTA Canvas can therefore score 100 while still producing a variation opportunity; missing-CTA detection separately evaluates eligible Landing Page and Social nodes. Preserve formulas until product semantics are explicitly redefined, but make the copy conditional on the same facts that produce the score and finding.

The apparent header clipping is also explainable without screenshots or runtime changes: the Insights view owns an outer scroll area while `#insights-cards` reuses `.boards-library-panel`, creating a second height-capped scroller. In addition, the two-row toolbar is a shrinkable flex item with visible overflow and a high stacking level. At constrained height or wrapped toolbar layouts, its painted content can extend beyond its allocated flex box and cover the following view. The fix is a single authoritative page scroller and a non-shrinking, measured toolbar—not a magic top margin.

AI Brain should visibly speak through the accepted active **Board Brand Core** avatar. Capture a small, ephemeral display identity on each newly created turn so Board/Brand changes cannot relabel earlier answers. This identity is UI-only, is never sent as conversation semantics, and is never persisted. User turns, system disclosures, and application-owned node-confirmation states must not wear the Brand Avatar.

## 2. Investigation basis and screenshot-based UX findings

This audit treats the reported production screenshots as confirmed visual evidence and verifies their causes and constraints against the merged source. No visual redesign was implemented.

| Confirmed screenshot finding | Source-confirmed explanation | Product consequence |
|---|---|---|
| Weak hierarchy and repetitive dark cards | Overview, sections, diagnostic groups, findings, and themed cards share similar surfaces, borders, radii, spacing, and token overrides. | Health, evidence, warnings, actions, and provenance compete at equal weight. |
| “Needs attention” resembles “Strong” | Diagnostic rows have no status class; the score and label are plain text in the same `.insights-score` treatment. | Status is discoverable mainly by reading. |
| Funnel resembles a checklist | Five wrapped pill/list items show `✓` or `○`; there are no connectors or item counts. | Sequence and campaign concentration are not communicated. |
| Overview is sparse but page is long | Four equal cards include values already repeated below; the nested scroller constrains the content while sections stack vertically. | Low information density inside a high-scroll page. |
| CTA score contradicts explanation | Fixed warning-like copy is rendered for every CTA score, independently of warnings, suggestions, or missing-node findings. | A perfect score can sound defective. |
| AI Brain lacks Brand identity | Header hard-codes `🧠`; assistant articles contain a text speaker label only; empty state has no avatar. | Advisor identity is generic and disconnected from Brand DNA. |

### Visual finding summary

The screenshots do not indicate a need for brighter decoration. They indicate missing **composition and semantics**. Premium here means fewer competing containers, clear reading order, calm completion states, visibly bounded attention, honest labels, and actions adjacent to the reason for acting.

## 3. Confirmed DOM, rendering, CSS, and lifecycle architecture

### 3.1 Rendering path

1. Navigation activates `#insights-view`; the stable host contains a static `<h2>` and `#insights-cards`.
2. `renderCampaignIntelligence()` runs `analyzeCampaign(state.nodes, state.edges, state.brandCore)`.
3. `captureInsightsDiagnostic()` records an in-memory snapshot containing account/Board/access identity, a Canvas projection identity, saved/unsaved state, timestamp, analysis, and sorted findings.
4. `renderInsightsSurface()` clears only `#insights-cards`, creates `.insights-boundary`, then renders header and five sections with DOM APIs.
5. Refresh reruns the deterministic analysis. It does not call an AI provider and does not mutate Canvas data.
6. `Show on Canvas` revalidates snapshot/finding/node identity before focusing an affected node. `Ask AI Brain` additionally requires authenticated edit access and a non-public context before creating a bounded descriptor and opening AI Brain.

### 3.2 Exact current DOM structure

```text
#insights-view.board-list-view
├─ h2[data-i18n="AI Insights"]                         (legacy visible title)
└─ #insights-cards.boards-library-panel                 (second scroller)
   └─ .insights-boundary
      ├─ header.insights-page-header
      │  ├─ p.insights-eyebrow
      │  ├─ p.insights-lede
      │  ├─ .insights-context > span*
      │  └─ button.insights-refresh
      ├─ section.insights-section[aria-labelledby=insights-overview-title]
      │  └─ .insights-grid.insights-overview-grid
      │     └─ article.insight-card.insights-summary-card × 4
      ├─ section.insights-section.insights-measured-empty
      ├─ section.insights-section (Canvas Diagnostics)
      │  └─ .insights-diagnostic-groups
      │     └─ section.insights-diagnostic-group × 4
      │        └─ article.insight-card.insights-diagnostic-row × 1–3
      ├─ section.insights-section (Opportunities)
      │  └─ article.insights-finding.severity-* × 0–5
      └─ section.insights-section (Data and Methodology)
         └─ details.insights-methodology
            ├─ summary
            ├─ dl.insights-classifications
            ├─ source metadata
            ├─ method list
            ├─ assumptions
            └─ limitations
```

The five current sections are **Overview, Measured performance, Canvas Diagnostics, Opportunities, and Data and Methodology**. The dynamically rendered page header is outside those five sections. Stable IDs that must survive are `#insights-view`, `#insights-cards`, `#insights-nav-btn`, the five current heading IDs, `#ai-brain-view`, `#ai-brain-summary`, and the existing AI Brain form/question IDs and `data-ai-brain-*` action hooks.

### 3.3 CSS selectors and token coverage

Insights-specific selectors are the `.insights-*` family and `.insight-card`, notably boundary/section/header/context/refresh, overview grid/summary cards, funnel stages, channel list, diagnostic groups/rows/calculation, finding/severity/actions, measured empty/data status, methodology/classifications/method list, and unavailable state. Global selectors also apply: `.board-list-view`, `.boards-library-panel`, `.fk-btn`, `.fk-card`, `.insight-card`, theme-wide card/surface rules, and dark-theme overrides.

Current Insights breakpoints are:

- `760px`: overview and diagnostic grids become one column; header/action/layout and classifications stack.
- `640px`: section padding reduces and the older hero rule collapses.
- Shell behavior also changes at `1300px`; inline toolbar layout changes at `1200px`.

Tokens cover primary/secondary text, card/panel/secondary surfaces, default/divider borders, success, warning, information, primary action, and shadows in both modes. Danger tokens exist in the BW-27 system and should be reused. Some older literal light colors remain in base declarations, then theme selectors override them. **Do not create an Insights palette or a second token system.**

### 3.4 Scroll ownership and confirmed header-clipping root cause

`body` and `.app-shell` suppress document scrolling. `.workspace-wrap` is a column flex container. `.board-list-view` is the intended view-level scroll owner (`flex: 1; min-height: 0; overflow: auto`). However, `#insights-cards` also has `.boards-library-panel`, which sets a viewport-derived `max-height` and `overflow-y: auto`. This produces two vertical scroll owners and splits the static `h2` from the actual Insights page.

The toolbar is normal-flow—not fixed or sticky—but `#canvas-topbar` has `position: relative`, `z-index: 120`, and `overflow: visible`. `.topbar` has no explicit `flex: 0 0 auto`/`flex-shrink: 0`. Its toolbar can wrap into substantially more height at 1200px, while the toolbar flex item can still be compressed when viewport height is constrained. Visible overflow then paints above the next flex child, and its stacking level makes the beginning of the view appear clipped beneath an overlay.

**Root-cause conclusion:** the defect is the combination of (a) a shrinkable toolbar whose visible contents can exceed its flex allocation and paint at `z-index:120`, and (b) nested, independently constrained Insights scrolling. It is not evidence for a fixed header, and it must not be “fixed” by guessing a static `padding-top`.

**Future shell contract:** `#canvas-topbar` is a non-shrinking normal-flow item; `#insights-view` is the only vertical page scroller; `#insights-cards` has no independent viewport max-height/overflow in this view; the legacy `h2` is consolidated accessibly with the premium header rather than left above a nested scrollport. Validate using actual bounding rectangles at all toolbar wrap states: the first visible Insights pixel must be at or below the toolbar bottom.

## 4. Current information hierarchy and duplication map

Current order is: legacy title → technical context header → Overview → empty Measured performance → Diagnostics → Opportunities → Methodology. This puts an unavailable future capability before current actions and makes Opportunities arrive after duplicated diagnostics.

| Overview value | Detailed repeat | Decision |
|---|---|---|
| Campaign readiness score and label | Structure and readiness → Campaign readiness | Keep the ring/qualitative summary only in executive overview; remove the duplicate diagnostic row. Calculation belongs in methodology/details. |
| Funnel `covered/5`, label, and full checklist | Funnel coverage → score/label/copy | Keep a single full journey after the overview. Overview gets only compact “N of 5 stages represented”; remove the duplicate diagnostic score row. |
| Areas needing attention count | Opportunities list | Replace the number-only card with the first three deterministically ordered finding titles; Opportunities remain authoritative details/actions. |
| Channel count plus distribution chips | Content and channels → channel coverage text | Overview gets explicit “2 channels represented” plus compact proportional item counts; remove the text-only diagnostic row. |
| Overview descriptions | Diagnostic fixed interpretations | Executive copy summarizes the whole Canvas; diagnostic copy explains only its own evidence. No verbatim or semantic duplication. |

## 5. Diagnostic contradiction findings

### 5.1 Current score and finding rules

| Diagnostic | Current calculation | Finding trigger | Confirmed mismatch risk |
|---|---|---|---|
| Readiness | Base 40 + stage coverage up to 25 + any trust 10 + ≥2 unique CTAs 10 + ≤1 audiences 10 + ≤2 tones 5, clamped/rounded | No direct readiness finding | Summary may be Strong while component findings remain; acceptable only if summary says “strong overall, with N refinements.” |
| Funnel | Covered unique derived stages / 5 | Any missing stage | Internally aligned, but per-stage counts are not currently calculated and explicit plus derived mappings can count the same node only once per stage if added. |
| ICP | 90 for ≤1 distinct non-empty audience; otherwise 55 | >1 distinct audience | Aligned, though empty audience fields are ignored and this limitation must be disclosed. |
| Tone | 90 for ≤1 distinct; 75 for 2; 50 for >2 | >2 distinct tones | A score of 75/Good foundation has no finding despite multiple tones; that is a deliberate threshold gap, not a contradiction if copy remains neutral. |
| Trust | 80 if any Landing Page has trust; otherwise 35 | Any trust suggestion; affected nodes are Landing Pages missing trust | **Aggregation mismatch:** one trusted Landing Page makes score 80 and suppresses all suggestions even if another Landing Page lacks trust. Do not claim per-node completeness. |
| CTA | `uniqueCtas / max(ctas.length,1) × 100` | Missing eligible CTA; otherwise suggestion when unique count <2 | **Semantic mismatch:** uniqueness ratio is labeled “quality”; 1/1 = 100 while `<2` creates a variation opportunity. Missing-node analysis uses eligible nodes, whereas denominator uses CTA-bearing values. |
| Channel | Count Social nodes per platform | No BW-28 finding | Overview count is accurate but underspecified; “2 channels represented” is required. |

### 5.2 Exact CTA diagnosis

There are three independent concepts:

1. The displayed score is a **uniqueness ratio among present CTA values**, not CTA presence or clarity.
2. `CTA_MISSING` compares eligible Landing Page/Social nodes to whether they contain a CTA-like field.
3. `CTA_VARIATIONS_MISSING` appears when fewer than two unique CTA values exist and no eligible node is missing a CTA.

The diagnostic renderer ignores all three distinctions and always prints “Calls to action are present, but some content may need a clearer next step.” Therefore the reported `100/100 · Strong` contradiction is caused by **generic interpretation copy plus a mismatched category name**, not stale issue data or score-threshold mapping. The underlying aggregation also permits `100` in a one-CTA sample, but changing that formula is outside this audit and requires an explicit product decision.

Comparable risks are readiness/attention coexistence, trust’s any-node aggregation, and tone’s score/finding threshold difference. No other current fixed interpretation is as directly contradictory as CTA, but all must use fact-derived copy.

### 5.3 Diagnostic consistency contract

The implementation must create a normalized display model before rendering. For each diagnostic, derive `{id, score|null, status, interpretationKey, issueCodes[], opportunityCodes[], severity|null, affectedNodeIds[], evidence[], calculationKey}` once, then use it everywhere.

Deterministic invariants:

1. Score thresholds remain `Strong ≥85`, `Good foundation 70–84`, `Needs attention 45–69`, `Incomplete <45` until a separately approved formula change.
2. Interpretation keys are selected from validated facts/status, never a category-wide constant.
3. `Strong` is excluded from the attention list. It may have a **Minor improvement** only if copy explicitly says the core check passed and the suggestion is optional; never use “missing,” “needs,” “unclear,” or “incomplete.”
4. High priority requires a corresponding issue code and diagnostic reason. An opportunity cannot invent a new diagnostic state.
5. Every opportunity points to exactly one existing diagnostic/finding reason; severity comes from the finding, not the score label.
6. An affected-node CTA renders only when the revalidated affected-node count is >0. Zero nodes must show no count-as-action and no `Show on Canvas`.
7. Displayed affected counts equal the revalidated ID set; the visible preview remains capped at three with a localized overflow count.
8. Missing funnel stages exactly equal `canonicalStages − coveredStages`; both overview and journey consume this same set.
9. Per-stage node counts render only from a new deterministic stage-to-unique-node-ID projection; never infer counts from edges or claim traffic/performance.
10. Channel total equals the number of distribution keys; item counts sum to Social nodes included in the same distribution. Label the unit.
11. A 100 score cannot use warning copy. If a separate optional enhancement exists, separate it visually and linguistically from the passed diagnostic.
12. Snapshot identity, Canvas identity, issue code, and affected IDs are revalidated before either action; stale data produces the existing refresh message.
13. Development validation fails on invalid combinations rather than silently selecting contradictory text.

## 6. Component map

| Current component | Confirmed problem | Recommended replacement | Data required | Interaction | Risk |
|---|---|---|---|---|---|
| Static `h2` + dynamic context pills | Split hierarchy; technical pill row; clipping exposure | One compact campaign-health header inside stable host | Board name, analyzed time, Canvas state, health/status | Refresh; state announced | Medium (shell/IDs) |
| Four overview cards | Empty space and duplication | One composed executive overview | Readiness, top 3 findings, stage count, channel counts | Attention anchors to detail | Medium |
| Funnel pills | Checklist, no sequence/concentration | Five-step campaign journey | Canonical stages, covered set; optional unique node count per stage | Stage focus/anchor only when valid | Medium |
| Number-only attention card | Hides affected areas | Bounded attention list | Sorted findings | Jump to matching opportunity/diagnostic | Low |
| Four diagnostic card groups | Equal visual weight; duplicates | Compact semantic diagnostic list grouped in one surface | Normalized display model | Row disclosure for calculation; optional action | Medium |
| Findings after diagnostics | Action layer arrives late | Opportunity cards directly after journey | Existing finding model and permissions | Show on Canvas; Ask AI Brain | Low–Medium |
| Large measured empty section | Empty feature dominates | One compact collapsed unavailable row | Availability only | Expand explanation | Low |
| Methodology section/card | Technical content has high weight | Closed disclosure at page end | Existing provenance/methods | Expand/collapse | Low |
| Generic AI Brain header/empty state | No Brand identity | Advisor identity lockup with avatar | Ephemeral active avatar identity | None beyond existing UI | Medium |
| Advisor message bubble | Text label only | Avatar rail + assistant content group | Captured turn display identity | Existing proposal controls | Medium |

## 7. Final recommended AI Insights layout

### Exact final page order

1. **Campaign health header**
2. **Executive health overview**
3. **Campaign journey coverage**
4. **Opportunities**
5. **Canvas diagnostics**
6. **Measured performance — unavailable** (compact, closed)
7. **Data and methodology** (closed)

### Current-element disposition

- **Retain:** stable hosts/heading IDs, deterministic snapshot/provenance, analyzed time, saved/unsaved state, Refresh, findings ordering, actions and authorization, source limitations.
- **Redesign:** dynamic header, overview composition, funnel visualization, status treatments, diagnostic rows, opportunity anatomy.
- **Consolidate:** legacy `AI Insights` title with the dynamic header; four summary cards into one overview; readiness/funnel/channel repetitions into one authoritative representation each.
- **Move:** Opportunities before detailed diagnostics; Measured performance after diagnostics.
- **Collapse:** Measured performance and Data and Methodology by default.
- **Remove from default view:** Board/node/source technical pills, duplicate readiness and funnel diagnostics, number-only attention and channel cards, full measured-performance paragraph, methodology classifications/method lists.
- **Do not remove from DOM/API contracts:** stable IDs and legacy host structures. Hide or repurpose the legacy heading accessibly only after its label relationship is preserved.

### 7.1 Campaign health header anatomy

Use a two-column compact band (single column below 760px):

- Eyebrow: `AI Insights`.
- H1/H2-level title: `Campaign health` / `Kampagnenstatus`.
- One sentence: `See what is ready, what is missing, and where to act next.`
- Compact overall status: qualitative label first, score second (`Strong · 85/100`); the large visualization lives in overview.
- Metadata line: `Analyzed 1 Sep 2026, 14:20 · Includes unsaved Canvas changes` (or saved equivalent).
- `Refresh insights` secondary button; while refreshing, retain dimensions, disable repeat action, and announce completion. No automatic AI request.

Board name may appear as plain supporting text only when needed to disambiguate. Node count, deterministic classification, and source belong in methodology.

## 8. Executive overview component anatomy

One `.campaign-health-overview` surface uses a 12-column composition, not four cards:

- **4 columns — readiness:** 104–120px ring, centered integer score, qualitative status below; adjacent two-sentence summary. Ring uses an SVG with accessible text outside it, not a CSS conic gradient as the sole signal.
- **5 columns — needs attention:** heading with count in prose and at most three sorted finding titles. Each line has severity icon + label and anchors to its Opportunity. If 0, show calm completion copy. If >3, show `+N more` linking to Opportunities; never expand the overview in place.
- **3 columns — coverage:** two compact rows: `4 of 5 stages represented` and `2 channels represented`; channel subline lists up to three `Name · item count` entries, then `+N more`.

At 760–1023px use readiness full-width above two equal columns. Below 760px stack in the same reading order. Minimum information density target: no overview region taller than roughly 320px at desktop with ordinary data; no decorative blank quadrants.

The attention list consumes the already deterministic findings order (severity → structural relevance → affected count → weight → category → code → first ID) and shows a maximum of three. Its anchor target must receive focus without unexpectedly moving to Canvas.

## 9. Exact funnel visualization: campaign journey coverage

Label exactly:

- **English:** `Campaign journey coverage`
- **German:** `Abdeckung der Kampagnenphasen`
- Supporting copy: `Shows which campaign stages are represented on this Canvas—not measured conversion performance.`

### Desktop/tablet structure

Use an ordered list of five equal, connected stage nodes:

```text
[✓ Awareness · 3 items] → [✓ Interest · 2 items] → [! Consideration · Missing]
   → [✓ Conversion · 1 item] → [○ Retention · Missing]
```

This is schematic only; it must never narrow geometrically like a measured conversion funnel. Each item contains ordinal (`1`–`5`, screen-reader available), localized stage name, explicit `Covered`/`Missing`, and optional mapped-item count. A visible connector communicates sequence, but connector appearance carries no status. Covered uses a check icon; missing uses an outlined warning/exclamation icon and dashed/accent boundary. Both include text.

### Data contract

Current data provides only `coveredStages` and `missingStages`. A future implementation may derive stage counts without changing diagnostic formulas by applying the **existing mapping rules** to every node and building `Map<stage, Set<nodeId>>`. One node may count in multiple stages because current coverage already derives multiple stages from one node. Deduplicate within each stage. Label `Canvas items`, not assets, users, visits, leads, or conversions. Hide all counts unless the projection passes validity checks; never display guessed zero counts while a stage is covered.

Explicit `funnelStage` and current type/goal/CTA derivations remain the source. Edges do not prove a stage. Channel distribution cannot substitute for stage evidence.

### Responsive behavior

- `≥1024px`: one five-column row with connectors.
- `760–1023px`: allow a 3+2 wrapped grid only if connector path and DOM reading order remain unambiguous; preferred is a horizontally scrollable list with scroll affordance and no trapped vertical gesture.
- `<760px`: vertical ordered journey with a left rail; no horizontal page overflow. Stage names and German status text may wrap to two lines.
- At 200% zoom and 320 CSS px, all text and controls remain available without two-dimensional scrolling.
- `prefers-reduced-motion` removes animated progress or reveal; the journey requires no animation.

## 10. Status and severity design system

Status (diagnostic result) and severity (action priority) are separate axes. Status never inherits opportunity severity. All colors use existing BW-27 semantic tokens; suggested appearances describe roles, not new literals.

| State | Icon | Foreground / background / border | Accent & score | Accessible label | Dark / Light treatment |
|---|---|---|---|---|---|
| Strong | `✓` in circle | success text; transparent-to-success-subtle; quiet default/divider border | No bright left accent; subdued filled bar/ring | `Status: Strong` | Dark: low-luminance success tint; Light: very pale success tint; never saturated whole card. |
| Good foundation | `✓` or shield | information text; information-subtle; divider border | Optional 2px info accent; compact bar | `Status: Good foundation` | Mode-specific info-subtle surface with normal text contrast. |
| Needs attention | `!` triangle | warning text; warning-subtle; warning border | 3px warning accent; partially filled bar | `Status: Needs attention` | Dark: restrained amber tint/border; Light: pale amber, dark text. |
| Incomplete | broken circle / `!` | danger text; danger-subtle; danger border | 3px danger accent; low/empty bar | `Status: Incomplete` | Dark: deep red tint without glow; Light: pale red tint. |
| High priority | filled `!` diamond | danger foreground/subtle/border | 4px danger accent on opportunity only; no score required | `Priority: High` | Strongest semantic emphasis, reserved for verified critical findings. |
| Worth improving | upward arrow/spark | warning foreground/subtle/border | 3px warning accent; no diagnostic score | `Priority: Worth improving` | Less prominent than High priority, more than neutral cards. |
| Minor improvement | plus/spark outline | information foreground/subtle/default border | Optional 2px info accent | `Priority: Minor improvement` | Quiet informational treatment. |
| Unavailable | minus-in-circle | neutral secondary text/surface/border | Dashed neutral border; no score | `Status: Unavailable` | Mode-native neutral surface, never disabled-opacity text. |

Icons are system-owned inline SVGs or established icon components with `aria-hidden=true` when adjacent text exists. Do not use emoji because glyph appearance varies. Every badge includes localized visible text. Target WCAG AA contrast (4.5:1 text, 3:1 meaningful non-text boundaries) in both themes.

## 11. Score-visualization rules

1. **One ring only:** overall readiness in the executive overview. Include visible label and raw score; its accessible name states both.
2. **Compact bars:** individual scored diagnostics, 72–120px wide, only when a numeric score genuinely supports comparison. Label remains primary; raw score is secondary.
3. **Status badge only:** opportunity severity, channel coverage, measured availability, and diagnostics without a meaningful score.
4. **Raw `/100`:** always available for transparency in readiness and scored diagnostic rows, but never the largest text except the single overview ring.
5. **Funnel:** use `N of 5 stages represented`, never a `/100` confidence in the default UI. The calculation disclosure may state the percentage.
6. **CTA:** until its semantics are renamed/proven, display `CTA variation` in calculation detail and do not present its number as overall CTA “quality.” Formula changes require separate approval.
7. Do not animate from zero on load; this suggests measurement. If transitions are used after Refresh, respect reduced motion.

## 12. Detailed diagnostic component anatomy

Use one bordered `section` containing semantic groups and compact rows—not separate large cards and not a dense data table. Tables perform poorly for long explanations/German text, while always-open cards waste height.

Each row has:

1. status icon and localized status badge;
2. diagnostic name;
3. one fact-derived sentence (maximum two lines at desktop; never truncate essential warning text);
4. optional compact bar + raw score;
5. optional contextual action (`View opportunity`) only when a matching finding exists;
6. a native `<details>` disclosure labeled `How this is calculated`, containing scope, method, limitations, evidence, and affected count.

Default rows are 64–88px. Strong rows use calm neutral/card surfaces with a small success symbol, not green card fills. Needs attention and Incomplete receive semantic border/accent. Groups remain `Strategy consistency` and `Content structure` only when they improve navigation; readiness, funnel, and channel are not repeated here. Suggested remaining rows are ICP consistency, Tone consistency, Trust-layer coverage, and CTA variation/presence with corrected semantics.

## 13. Opportunity component anatomy

Opportunities are the clearest action layer and precede diagnostics. Render a bounded stack (up to five, as today) ordered by the existing deterministic sorter.

Each card anatomy:

- severity badge and stable issue title;
- one sentence: **what is wrong**;
- one sentence: **why it matters**, derived from a closed, translated system-copy map—not provider or Canvas prose;
- affected summary: `3 Canvas items affected`; preview up to three safely rendered titles/roles and `+N more`;
- evidence/disclosure when useful;
- secondary `Show on Canvas` only with valid affected IDs;
- primary `Ask AI Brain` only for authorized authenticated editors in non-public mode.

When an opportunity represents a missing stage and has zero affected nodes, omit affected-node language and `Show on Canvas`; say `No Canvas item currently represents Consideration`. `Ask AI Brain` remains subject to existing authorization. Clicking an attention-summary item scrolls and focuses the matching opportunity card; it does not execute its action.

## 14. Measured Performance empty state

Render one closed native disclosure row after diagnostics:

- title `Measured performance`;
- neutral `Unavailable` badge;
- one sentence `No verified analytics source is connected.`;
- on expand, the existing honest limitation explaining reach, engagement, conversion, revenue, and verified sources.

Do not show a chart, empty chart frame, fake metric, connector CTA, provider logo, or projected availability. It should occupy approximately one diagnostic row while closed.

## 15. Data and Methodology disclosure

Keep the existing provenance contract in a native `<details>` at page end, closed by default. Summary: `Data and methodology` plus `Current Canvas · deterministic`. Expanded order:

1. current source/scope, Board, analyzed time, saved/unsaved Canvas state;
2. diagnostic methods;
3. classification glossary;
4. assumptions;
5. limitations.

Do not duplicate provenance pills in the header. Native disclosure keyboard behavior must remain; preserve heading hierarchy inside it. Canvas/Brand-derived names use text nodes, while classifications and method labels use the closed localized string set.

## 16. Current Brand Avatar and AI Brain architecture

### 16.1 Avatar sources and fallbacks

`getApprovedBrandAvatarUrl()` returns an image only when both Brand DNA and its avatar are user-approved and an image URL exists. Dashboard and Brand Workspace reuse this accepted image after URL scheme validation. The Dashboard then falls back through Brand avatar initials/icons, Brand name/domain initial, **user initial**, and `B`; Brand Workspace falls back through Brand/Brand DNA initials and display name to `B`.

The AI Brain must **not** reuse the Dashboard’s user-initial fallback because that can leak an account identity into the Brand advisor. Define one shared Brand-advisor resolver for future implementation:

1. approved Board Brand Core avatar image with safe URL;
2. Brand-defined avatar initial/icon;
3. active Board Brand display-name initial;
4. established Funklix AI/Brain fallback mark (`B`/Brain system asset), never account avatar or user initial.

Brand Workspace currently inserts the safe approved URL into an escaped HTML template and uses decorative empty alt text; Dashboard creates an image DOM node with `Brand avatar`. AI Brain should use DOM construction, a load-error fallback, explicit dimensions, and context-specific accessible naming.

### 16.2 Current AI Brain messages

The transcript is ephemeral `state.aiBrain.messages`. Each turn combines a user question/status with a later advisor article. User values use `textContent`. Successful provider answers pass through the bounded safe Markdown renderer, which creates a limited set of DOM nodes and text; proposal previews use `textContent`. The header is an `innerHTML` template with escaped context. Board/account/load identity invalidates requests and resets transcript through the existing lifecycle. Public/read-only viewers currently see the unavailable-advice state because asking requires an authenticated editor.

Assistant-only association is safe if the avatar is inserted into `.is-advisor` rendering and never into `.is-user`, disclosure, error, or application confirmation elements. No transcript model replacement is needed.

## 17. AI Brain Brand Avatar behavior

### 17.1 Header

Replace the generic emoji visually (retain stable containers) with a 40–48px advisor avatar, identity block, and badge:

- accessible image/fallback;
- `AI Brain` product name;
- active identity, e.g. `Acme Brand advisor` / `Acme Markenberater`;
- compact `Advisor` / `Berater` badge;
- existing read-only description, permissions, and context remain honest.

If the name is absent, use `Funklix Brand advisor`. The avatar does not imply a human or a separately authenticated agent.

### 17.2 Assistant turns

Every successful assistant response has a 28–32px Brand Avatar in a fixed avatar rail aligned with the first text line. User messages have no Brand Avatar. Consecutive assistant UI fragments belonging to one turn (answer, assumptions, proposal preview) form one visual group and use one avatar; do not repeat the avatar for each subcomponent. If future adjacent assistant turns have no user turn between them, subsequent avatars may be visually suppressed while preserving an accessible speaker label.

**Ephemeral identity capture is required.** When a new turn is created, capture an in-memory display snapshot:

```text
advisorIdentity: {
  boardIdentity, brandIdentityOrRevision, displayName,
  safeAvatarUrl, fallbackInitial, altText
}
```

This is presentation metadata only. Bound lengths, allow only safe image schemes, and freeze/copy values. Do not serialize it into Board JSON, API conversation history, local/session storage, URLs, analytics, or server conversation payloads. Retry retains the original turn’s display identity because it is the same turn; a brand/avatar change followed by a **new** turn captures the new identity. A Board/account/access change continues to use the existing transcript invalidation/reset; if any historical turns are deliberately retained by a future lifecycle, their captured identity prevents relabeling.

### 17.3 Thinking, failures, Retry, and clarification

- **Provider loading:** show the captured advisor avatar beside a live status row `Thinking…`; this signals who is preparing advice, not that content exists. Use a progress/status indicator, not fake typed characters or bouncing “already speaking” dots.
- **Response formatting:** synchronous rendering needs no separate state.
- **Retry:** pending Retry reuses the turn and captured identity; failed request remains a system status associated with the user request until an advisor answer exists. Do not fabricate an assistant bubble.
- **Clarification response:** it is a successful assistant response and uses the avatar; proposal controls remain unavailable according to existing reference-resolution rules.
- **Request/context error:** no Brand Avatar unless a genuine assistant answer exists. Error text is application-owned.

### 17.4 Empty state

When advice is available and there are no messages, show a 64–72px active Brand Avatar, `Start a conversation with {Brand}’s advisor`, and the existing honest read-only promise. Fallback uses the Funklix Brain mark. On narrow screens reduce the avatar to 48px and keep content centered; no decorative emoji.

### 17.5 Controlled Content-node proposals

The answer and its proposal preview remain within the advisor turn and therefore share the turn avatar. The **preview content** is visibly labeled `Content node preview`; `Prepare`, `Create node`, and `Cancel` remain application controls. Requesting/applying/created/failed confirmations use system status styling and no additional avatar. Copy must continue to say that the advisor proposed content and the user/application creates it; never state or imply that the provider mutated Canvas.

### 17.6 Public Viewer and authorization

Showing the active Brand Avatar is read-only presentation and can be allowed wherever existing AI Brain advice is already visible. It grants no new ability to ask, prepare, create, save, or mutate. Current Public Viewer/read-only behavior must remain unchanged: no new advice action and no write controls. If an ephemeral transcript is visible under an authorized read-only scenario, assistant turns may show their captured safe Brand Avatar; account avatars never substitute.

## 18. Avatar lifecycle and fallback rules

| Event | Required behavior |
|---|---|
| Initial authorized Board load | Resolve from the loaded Board Brand Core only after access is valid; render fallback during absence, not a broken/stale image. |
| Avatar image load error | Atomically replace image with established Brain/Brand fallback; do not retry-loop or expose URL. |
| Accepted avatar changes on same Board | Header/empty state update after authoritative state refresh; existing turns retain captured identity; new turns capture new avatar. |
| Board changes | Existing AI Brain invalidation/reset remains authoritative; abort pending request; resolve new Board identity only after authorized load. |
| Brand association/snapshot changes | Treat revision/Board-load generation as identity input; no old Brand flash; existing turns are not relabeled. |
| Account changes/sign-out | Abort/reset existing lifecycle; clear ephemeral avatar snapshots with messages. Never fall back to account avatar. |
| Access revoked | Abort/reset or unavailable state as today; do not expose stale Brand image from the previous authorized state. |
| Refresh Insights | Does not change AI Brain avatar identity unless authoritative Brand state independently changed. |
| Public token/viewer | Resolve only data already allowed by Board response; no new write or advice permission. |
| Language change | New system labels use current UI language; captured Brand name/image remain unchanged. Historical answer language and response-language disclosure remain captured as today. |

## 19. English and German UX-copy guidance

Use closed translation keys for all system labels, status, methods, errors, counts, and action copy. Canvas titles, platform names, Board names, Brand names, evidence values, and provider answers are user/provider content and must never be sent through `uiText` heuristically.

| Purpose | English | German |
|---|---|---|
| Page title | Campaign health | Kampagnenstatus |
| Purpose | See what is ready, what is missing, and where to act next. | Erkenne, was bereit ist, was fehlt und wo du als Nächstes handeln kannst. |
| Journey | Campaign journey coverage | Abdeckung der Kampagnenphasen |
| Honesty qualifier | Canvas stage coverage, not measured conversion performance. | Abdeckung der Canvas-Phasen, keine gemessene Conversion-Performance. |
| Stage summary | 4 of 5 stages represented | 4 von 5 Kampagnenphasen abgedeckt |
| Channel summary | 2 channels represented | 2 Kanäle abgedeckt |
| Attention | Needs attention | Benötigt Aufmerksamkeit |
| Overflow | +2 more | +2 weitere |
| Advisor identity | Acme Brand advisor | Acme Markenberater |
| Fallback identity | Funklix Brand advisor | Funklix Markenberater |
| Thinking | Preparing advice… | Beratung wird vorbereitet… |

German expands labels substantially. Do not constrain status badges to fixed widths; allow two-line explanatory text; use `minmax(0,1fr)` and `overflow-wrap:anywhere` for user-derived names, but do not break ordinary German labels letter-by-letter. Test `Abdeckung der Kampagnenphasen`, `Benötigt Aufmerksamkeit`, `Gute Grundlage`, and long Brand/Board names at every breakpoint. Pluralization (`1 Canvas item` vs `2 Canvas items`; German equivalents) must be deterministic rather than concatenating translated fragments.

## 20. Light and Dark Mode guidance

- Use the existing BW-27 semantic and surface tokens only.
- Dark Mode remains premium through surface layering: page background → one overview panel → quiet diagnostic rows. Avoid many luminous outlines and green washes.
- Light Mode must be designed, not obtained by inverting dark colors: use subtle neutral elevation, visible borders, readable warning/danger tints, and the same hierarchy.
- Avatar images receive a neutral ring/background that works for transparent and edge-to-edge images; never recolor the image. Fallback glyphs use primary/neutral tokens.
- Semantic subtle backgrounds must preserve text and icon contrast; test forced-colors mode, where borders/icons/text must survive background removal.
- Focus rings use the existing focus token and remain visible over all semantic surfaces.

## 21. Responsive and density specification

- The shell must provide one vertical scroller regardless of width/height; no nested scroll area for Insights content.
- Maximum readable content width remains approximately 1180px, centered, with 20–24px desktop and 12–16px mobile gutters.
- Desktop overview uses composed columns; tablet uses 1 + 2; mobile stacks.
- Opportunities use two columns only where each card retains at least 360px; otherwise one column. Diagnostic rows always span the section width.
- Touch targets are at least 44×44px. Actions stack full-width below 760px without changing DOM order.
- Funnel follows the vertical-mobile contract in §9. No viewport-wide clipping or two-dimensional scroll.
- AI Brain avatar rail is 40px including gap on mobile; user bubble remains visually separate. Long formatted answers, lists, code, and proposal previews wrap within `min-width:0`.
- Page-length target with five findings and closed disclosures: header + overview + journey + opportunities + compact diagnostics should be the meaningful scroll; empty/supporting sections together should consume fewer than 180px closed.

## 22. Accessibility requirements

1. One page heading, followed by ordered H2/H3 hierarchy; retain stable label IDs.
2. Status, severity, coverage, and missing stages are conveyed by icon shape and visible localized text, never color alone.
3. Overall ring and bars expose textual name/value/status; decorative SVG tracks are hidden.
4. Journey is an `<ol>` in canonical stage order. Connectors are decorative. Each stage accessible name includes ordinal, stage, state, and count when supported.
5. Attention anchors and opportunity actions are keyboard reachable; focus lands on the target heading/card after in-page scrolling. Respect reduced motion.
6. Native `<details>/<summary>` are preferred. Expanded content order matches visual order.
7. Refresh/status updates use a polite live region without re-announcing the whole page. Errors use appropriate alert semantics.
8. Brand Avatar has meaningful alt text in header/message when it adds speaker identity (for example, `Acme Brand advisor avatar`); decorative duplicates use empty alt. Fallback has an equivalent accessible name.
9. Each transcript article exposes speaker identity independently of the image. User and advisor messages have programmatic labels; loading is `role=status`.
10. Images have fixed dimensions to avoid layout shift and an error fallback; no broken-image icon.
11. Maintain 4.5:1 text and 3:1 meaningful UI/icon contrast, visible focus, 44px controls, zoom/reflow, screen-reader reading order, and forced-colors support.

## 23. Safe-rendering boundaries

| Data | Trust class | Rendering rule |
|---|---|---|
| System labels/status/method text | Closed application copy | Translation-key lookup; DOM text. |
| Board/Brand/Canvas node titles, roles, audiences, tones, platform values | User/Brand-derived | Bound lengths; `textContent`/DOM nodes; never interpolate unescaped; never translate as keys. |
| Finding evidence/current values | Mixed deterministic + Canvas-derived | Translate only allowlisted diagnostic messages; otherwise bound and render as text. |
| Provider answer | Untrusted provider text | Existing safe Markdown allowlist only; no raw HTML, images, links, event attributes, or unsafe URL handling. |
| Proposal preview | Provider-derived structured data | Existing validation plus `textContent`; application-owned labels/control states remain separate. |
| Avatar URL | Brand-derived URL | Accept approved avatar only; reuse safe scheme validation; escape/DOM property; image error fallback; no account-avatar fallback. |
| Avatar display name/alt | Brand-derived + closed suffix | Bound Brand name as text; construct localized accessible phrase without HTML. |

The future UI must not put Canvas/Brand content in `innerHTML`, CSS class names, IDs, selectors, analytics fields, or translation lookup. Avatar identity is presentational and must not enter prompts, conversation history, Board serialization, autosave, or AI API context.

## 24. File-by-file implementation blast radius

This audit changes none of these files; this is the anticipated combined implementation boundary.

| File | Future change | Constraints |
|---|---|---|
| `index.html` | Preserve hosts/IDs; consolidate the visible Insights heading accessibly; possibly add no new static structure because renderers own content. | Do not remove legacy hooks or alter toolbar controls. |
| `app.js` | Build normalized diagnostic display model; composed layout/journey; safe ephemeral avatar resolver/snapshot; assistant-only rendering; in-page focus. | Preserve formulas, snapshots, authorization, actions, safe Markdown, conversation and proposal lifecycles. |
| `styles.css` | Replace/organize Insights component styles; fix shell flex/scroll contract; add journey/status/avatar layouts using tokens. | No second token system; avoid broad unrelated overrides. |
| `language.js` | Add complete EN/DE closed copy, statuses, plural forms, avatar labels. | Never translate arbitrary Canvas/Brand/provider text. |
| `scripts/check-bw28-2-premium-insights-and-avatar.js` | Static/behavior regression contract for this specification. | Must prove non-mutation and compatibility, not snapshot incidental CSS strings only. |
| Existing BW-26–BW-28.1 check scripts | Ideally unchanged; run as compatibility suite. | Change only if a stable, intentionally preserved semantic contract needs an additive assertion—never weaken checks. |

### Files that should remain unchanged

- all `api/**` routes, including AI Brain advice/proposal and Brand Avatar generation;
- Board/Brand storage and serializers;
- authentication, access, Public Viewer, and sharing modules;
- Canvas analysis formulas unless a separate proof/decision explicitly approves them;
- theme bootstrap/runtime registration;
- node creation/generation/refinement/repair modules;
- geometry, edge, history, dirty-state, autosave, and persistence code;
- package dependencies and database/schema/migration files;
- conversation payload and server memory model.

## 25. Future regression specification

The combined implementation PR must add deterministic coverage for all items below.

### Shell, hierarchy, journey, and density

- [ ] At desktop, toolbar-wrapped, short-height, tablet, and mobile fixtures, first Insights content bottom/top geometry proves no header clipping.
- [ ] `#insights-view` is the one authoritative vertical page scroller; `#insights-cards` does not create a nested viewport scroller.
- [ ] Exactly one authoritative page heading and the exact final page order are present.
- [ ] Executive overview has one readiness visualization, bounded attention list, explicit stage summary, and `N channels represented` copy.
- [ ] Attention list is maximum three, uses the deterministic finding order, and `+N more` is correct.
- [ ] Attention link focus/scroll reaches the matching opportunity without Canvas mutation.
- [ ] Five-stage journey is an ordered, connected, accessible sequence in EN/DE and all breakpoints.
- [ ] Covered and missing states exactly match the analysis sets and remain understandable with color disabled/forced colors.
- [ ] Per-stage counts are absent without a valid projection; when present they equal unique mapped node IDs under existing mapping rules.
- [ ] No copy or geometry implies measured conversion performance.
- [ ] Overview no longer repeats readiness/funnel/channel as equivalent diagnostic rows.
- [ ] Typical and worst supported data fixtures meet bounded page-density targets; disclosures are closed by default.

### Status, diagnostic, opportunity, and honesty

- [ ] Strong, Needs attention, and Incomplete have distinct icon/text/border treatments in both themes.
- [ ] All eight status/severity labels have icons, visible text, accessible labels, and semantic tokens; none relies on color alone.
- [ ] Threshold boundary fixtures at 44/45/69/70/84/85/100 map correctly.
- [ ] Normalized consistency validator rejects score/label/copy/finding/severity/affected-node contradictions.
- [ ] No Strong diagnostic appears in Needs attention.
- [ ] `100/100` never renders warning copy; one-of-one CTA fixture explains optional variation separately.
- [ ] Missing CTA, CTA variation, mixed Landing Page trust, tone=2, and readiness-with-findings fixtures use accurate fact-derived copy.
- [ ] High priority always links to a diagnostic reason; opportunity/finding code round-trips.
- [ ] Zero affected nodes renders neither affected-node action nor `Show on Canvas`.
- [ ] Channel counts name the unit, keys equal represented-channel total, and item counts sum correctly.
- [ ] Opportunities precede diagnostics and retain exact Show on Canvas/Ask AI Brain permission and stale-snapshot behavior.
- [ ] Measured Performance remains Unavailable, compact/collapsed, and contains no fake chart, metric, connector UI, or automatic request.
- [ ] Methodology remains available, closed, complete, and consistent with BW-28 provenance.

### Brand Avatar conversation lifecycle

- [ ] Header uses approved active Board Brand Avatar and localized advisor identity; generic emoji is not the primary identity.
- [ ] Empty state and genuine assistant answers show avatar/fallback; every answer retains programmatic speaker text.
- [ ] User messages never show Brand Avatar. System disclosures/errors/node-creation confirmations do not masquerade as advisor messages.
- [ ] Pending genuine provider request uses captured advisor identity without fake typing; failed/no-answer state does not fabricate an assistant turn.
- [ ] Long Markdown, lists, assumptions, and node preview align/wrap beside the avatar at 320px and 200% zoom.
- [ ] Invalid URL and image-error fixtures atomically show safe fallback with no broken image.
- [ ] No accepted avatar uses Brand/Brain fallback and never an account/user avatar.
- [ ] Same-Board avatar change: existing turns keep captured identity; new turn gets new identity; Retry keeps original identity.
- [ ] Board/account/access/Brand-revision/Public Viewer changes abort/reset/re-resolve according to existing lifecycle and never flash unauthorized stale avatar.
- [ ] Public Viewer gains no ask, proposal, creation, save, or mutation capability.
- [ ] Static and serialization checks prove avatar display snapshots never enter Board JSON, browser storage, API conversation history, prompt/context, or server persistence.
- [ ] Conversation history remains ephemeral and existing bounded memory/language/Retry behavior passes.

### Safety, themes, responsive, and compatibility

- [ ] Malicious Board/Brand/node/evidence/avatar-name fixtures render only text; unsafe avatar schemes fail closed; existing safe Markdown corpus passes.
- [ ] English/German keys and plural/count forms are complete; long German labels/Brand names do not overlap or truncate essential meaning.
- [ ] Light/Dark/forced-color screenshots or computed-style checks meet contrast and token-use contracts.
- [ ] Keyboard-only traversal, focus visibility, native disclosures, live announcements, stage list semantics, image alt/fallback, and screen-reader message labels pass.
- [ ] Desktop/tablet/mobile and toolbar wrap/short-height layouts have no horizontal page overflow.
- [ ] BW-26 through BW-28.1 checks remain green: read-only advisor, bounded memory, language enforcement, safe Markdown, Retry, proposal creation, permissions, provenance, snapshots, and handoff.
- [ ] Entering/refreshing/navigating Insights and rendering/changing the avatar produce no Canvas mutation, dirty state, history snapshot, autosave, generation, repair, Content node, or automatic AI request.

## 26. Implementation go/no-go criteria

### GO when all are true

1. Product accepts the exact page order and agrees that funnel means Canvas coverage only.
2. Engineering implements a single normalized diagnostic display model and automated contradiction validator before styling.
3. CTA is either presented honestly as uniqueness/variation under the unchanged formula or a separately reviewed formula change is approved with evidence. This PR must not silently change it.
4. Shell ownership is proven by geometry and scroll tests; no magic top offset is proposed.
5. Existing stage mapping can be reused for optional counts with unique node-ID sets; otherwise counts are omitted.
6. Brand-advisor resolver explicitly excludes account avatars and turn identity remains ephemeral/non-persistent.
7. EN/DE copy, Light/Dark semantics, safe rendering, permissions, Public Viewer behavior, and BW-26–BW-28.1 compatibility have named tests.

### NO-GO triggers

- styling begins without the normalized consistency contract;
- header clipping is addressed by static padding while nested scrolling/shrink remain;
- a geometric conversion funnel, fabricated metrics, or automatic Insights AI request is introduced;
- formulas change without an isolated proof and decision;
- a second palette/token layer or broad application rewrite is required;
- avatar identity is persisted, sent to the provider, sourced from account identity, or allowed to rewrite old turns;
- stable IDs/actions/authorization/safe-rendering boundaries are removed or weakened;
- the work is split so that visual states ship before consistency, accessibility, and lifecycle guarantees.

## 27. One combined implementation-PR recommendation

Create **one implementation PR: “BW-28.2: Premium campaign health and Brand advisor identity.”** It should proceed in this internal order:

1. add display-model invariants and failing fixtures for CTA/trust/tone/readiness/funnel consistency;
2. fix toolbar flex allocation and establish the one-scroll-owner contract;
3. render the exact page hierarchy, composed overview, stage journey, opportunities, compact diagnostics, and disclosures;
4. implement the shared safe Brand-advisor resolver plus ephemeral per-turn identity capture and assistant-only avatar rail;
5. add complete EN/DE copy and token-based Light/Dark/responsive/accessibility styling;
6. run the new regression specification and all preserved BW-26–BW-28.1 contracts.

Keeping this combined is intentional: the premium hierarchy depends on diagnostic truth, the header depends on shell ownership, and chat identity depends on lifecycle/access rules. Separate cosmetic PRs would allow contradictory or misleading intermediate states. The PR must remain focused on presentation/display-model consistency; it must not change analytics formulas, APIs, persistence, Canvas behavior, or the transcript model.

## 28. Audit delivery statement

This document is the complete BW-28.2 audit. It recommends no production change in this package and establishes an implementation-ready visual, interaction, consistency, safety, accessibility, and lifecycle contract for the next combined PR.
