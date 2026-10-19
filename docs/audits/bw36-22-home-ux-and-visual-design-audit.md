# BW-36.22 — Home UX, information architecture and visual design audit

**Status:** proposed design, ready for product/design review. Documentation and browser evidence only; implementation and the decisions in §13 are not approved by this audit.

**Baseline:** `Funklix/Funklix`, latest merged `main` **ee9f9ac53401b50f16632a2c13051cb381769383**, including PR **#792**. Inspected 19 October 2026 (Europe/Berlin). Both `git fetch origin main` and the GitHub commit connector confirmed this SHA. All source references below describe this baseline, including automatic Home diagnostics.

## 1. Executive UX assessment

Home has the right functional building blocks and unusually careful context, authorization and freshness boundaries. Its weakness is composition: an orientation-first page has accumulated two intelligence rows ahead of the saved work users want to resume. Each module is understandable alone, but the complete screen requires too much reading and scrolling. The visual language already supports a premium creative workspace; a new shell, analytics service or decorative dashboard metrics would add risk without solving that problem.

Recommend a compact Workspace header, an explicitly scoped action summary, **Continue Working before detailed intelligence**, then a coherent intelligence area and Workspace exploration. Keep selected Brand knowledge visibly separate from the loaded Board. Prefer rearranging the existing renderer's output and adding Home-scoped presentation classes. Reuse all current readers, guards, action adapters, theme tokens and native controls.

The strongest evidence is the current-source mismatch scenario: at 1440 × 900 the hero is 220 px high, Brand Intelligence starts at y=666, Campaign Insights at y=1269, and Continue Working at y=2051. At 320 × 740, Dark/DE, those module starts are y=1179, 2341 and 3868. Some actions occur earlier (Brand Profile and the mismatch notice's Continue action), so this is **poor prioritization of continuation and attention information**, not a claim that Home contains no early actionable controls. With no mismatch the extra Continue shortcut disappears; populated intelligence still precedes the saved Board list.

Success means a returning user can identify Workspace, selected Brand and actual open Board, see supported attention signals, and reach saved work quickly. It does not mean assigning a universal urgency score to unrelated data.

## 2. Evidence and current screen hierarchy

### Sources actually inspected

- [BW-36.21 architecture audit](bw36-21-start-screen-intelligence-and-insights-audit.md): data boundaries and the original MVP proposal. Its old dashboard inventory is historical.
- [Home Foundation](../implementations/bw36-21a-home-foundation.md), [Workspace/Brand navigation audit](bw36-21a-r2-workspace-and-brand-navigation-audit.md), [R2.2 navigation](../implementations/bw36-21a-r2-2-multiple-workspaces-and-brand-selection.md).
- [R2.3 Brand/Board consistency](../implementations/bw36-21a-r2-3-brand-board-context-consistency.md) and [nonblocking adoption correction](../implementations/bw36-21a-r2-3r1-nonblocking-brand-adoption.md).
- [B1 intelligence/responsibilities](../implementations/bw36-21b1-brand-intelligence-and-team-responsibilities.md), [B2 Insights/Brain](../implementations/bw36-21b2-campaign-insights-and-ai-brain-home.md), [B2-R2 automatic diagnostics](../implementations/bw36-21b2-r2-automatic-home-diagnostics.md).
- Actual [markup](../../index.html), [Home renderer](../../home-foundation.js), [Home stylesheet](../../home-foundation.css), [application adapters](../../app.js), [global stylesheet](../../styles.css), [localization](../../language.js), [theme bootstrap](../../theme-bootstrap.js), [theme controller](../../theme.js), [Workspace sidebar](../../workspace-sidebar.js), [catalog normalization](../../workspace-catalog.js) and [responsibility manager](../../campaign-responsibilities.js).
- Existing A/R2.3/B1/B2 Chromium screenshots and geometry records; visually compared representative B2 tablet and Advisor desktop evidence. [AI Learning Advisor R7](../implementations/bw36-19r7-learning-advisor-visual-experience.md) supplies the relevant established visual direction.

**Important correction to historical evidence:** B2's old screenshots/README describe a snapshot established by visiting Insights. PR #792 supersedes that behavior: Home automatically schedules the shared deterministic engine for missing/stale authorized evidence. The fresh captures here start directly from a hydrated Board and Home, without visiting Insights. Older documentation's active-Board-first ordering is also superseded by R2.3's Brand grouping and saved recency.

### Fresh browser method and limits

Used system Chromium via installed `playwright-core`, actual root HTML/scripts/styles, and **the unchanged existing B2 fixture data and transport interception** from `scripts/check-bw36-21b2-home-insights-brain.js` (`fixture()`). No new marketing data, tasks, KPIs, provider responses or recommendations were generated. Names/counts in screenshots are pre-existing disposable regression fixtures, not customer data or proposed product content. Wireframes below contain only field labels and placeholders.

Capture sequence: boot `/boards/:id`; wait for ready catalog/completed hydration and `homeCampaignInsights().status === 'ready'`; stop fixture autosave/presence/polling as the existing harness does; select its existing alternate Brand to exercise a real mismatch; set viewport/theme/language/sidebar preference; refresh Home; scroll the hero to the viewport start; record bounding rectangles and screenshot. All browser transport is intercepted before navigation, limited to localhost, rejects AI/analytics/generation endpoints, and asserts zero non-presence writes and zero page errors. Existing Brain button focus + Enter navigation was checked. No production access, SQL, paid request or deployment occurred.

[Fresh evidence and geometry](bw36-22-home-evidence/README.md) are archived with this audit. Coordinates below are relative to the **hero aligned at y=0**, not initial document chrome; this intentionally gives Home the full viewport and is a conservative scroll comparison. The scroll owner is `#dashboard-view`, so a full-page screenshot alone would clip later content; module-position captures are used instead. Heights are content-dependent observations, not production performance or population estimates.

| Viewport | Theme / language | Sidebar preference | Hero height | Brand Intelligence y | Insights y | Continue Working y |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1440 × 900 | Light / EN | expanded | 220 | 666 | 1269 | 2051 |
| 1440 × 900 | Dark / DE | collapsed | 246 | 693 | 1322 | 2124 |
| 1280 × 800 | Light / DE | expanded | 241 | 687 | 1312 | 2114 |
| 1024 × 768 | Dark / EN | expanded | 191 | 637 | 1255 | 2122 |
| 768 × 1024 | Light / EN | expanded | 166 | 664 | 1669 | 2815 |
| 768 × 1024 | System → Dark / DE | collapsed | 192 | 779 | 1784 | 2955 |
| 375 × 812 | Light / EN | collapsed | 255 | 1041 | 2105 | 3412 |
| 375 × 812 | Dark / DE | expanded | 255 | 1064 | 2149 | 3562 |
| 320 × 740 | Light / EN | collapsed | 281 | 1090 | 2175 | 3580 |
| 320 × 740 | Dark / DE | expanded | 281 | 1179 | 2341 | 3868 |

A 1920 × 1080 capture additionally checks large desktop composition; its exact measurements are in `geometry.json`. At all eleven configurations the document width equaled the viewport width. This establishes horizontal containment for this fixture, **not** absence of internal clipping, overlay occlusion or general WCAG conformance. At tablet width the responsive shell uses a narrow rail despite expanded preference; on phones the bottom navigation/context controls apply. The two preferences do not force a desktop sidebar onto mobile.

A supplemental 200% **CSS zoom stress check** at 1280 and repeated existing Board label produced no document horizontal overflow. This is not a native browser zoom or text-only zoom acceptance test; both remain required. Headless Chromium and source inspection do not establish physical touch or screen-reader usability.

### Actual DOM/reading order

`#dashboard-view > .mission-control > #home-foundation` owns visible Home. Legacy mission-control siblings remain mounted but hidden by the scoped Home stylesheet.

1. Workspace hero: avatar, eyebrow, Workspace H1, invitation.
2. Workspace label, native select, Create Workspace.
3. Brands in your Workspace: visibility counts, all authorized Brand cards, Profile actions and explanatory note.
4. Selected-Brand/open-Board mismatch notice, when applicable, with three navigation actions.
5. `.home-intelligence`: Brand Intelligence + Team Responsibilities; one column at ≤800 px. Default grid stretching makes the shorter card as tall as its neighbor.
6. `.home-board-intelligence`: Campaign Insights + AI Brain; one column at ≤800 px, `align-items:start`.
7. Continue Working: Browse Boards, permitted Create project, filters, completeness/recency note, all catalog-authorized Board cards grouped by relationship.

The hero, Brand exploration, mismatch notice and intelligence all grow before continuation. More Brands or longer translated names increase this burden further. Boards are not the cause of the initial continuation delay: their list starts after the other sections regardless of its own length.

## 3. Problems ranked by user impact

| Rank | Observed issue and consequence | Concrete correction |
| --- | --- | --- |
| High 1 | Continue Working begins beyond two desktop viewport heights and over five narrow-phone viewport heights in the populated mismatch case. Returning users must read unrelated information first. | Put it immediately after the compact attention summary; keep a direct current-Board Continue action in the header. |
| High 2 | Workspace, selected Brand and loaded Board appear in separate places; the A/X versus Y explanation is below Brand exploration. Repeated Board headings add reading without clarifying authority. | Put both scopes in the header and keep the mismatch explanation beside them. Share Board scope within the Board-intelligence group, while retaining explicit accessible module labels. |
| High 3 | Phone fixed navigation and floating Workspace/Brand controls visibly cover the lower-right content area. In the 320 Dark/DE capture they cover part of a Brand row. Zero horizontal overflow does not catch this. | Measure the existing shell's occupied bottom area; reserve scroll clearance and focus scroll margins for both navigation and context controls, including safe-area inset. Keep shell architecture/behavior. |
| Medium 4 | 220–281 px hero, separate 44 px selector row and generous margins consume the first viewport. Welcome copy provides little repeat-visit value. | Merge identity/selectors into a compact header; short optional welcome line; no standalone oversized avatar row. |
| Medium 5 | B1 equal-height grid stretches Brand Intelligence alongside the longer responsibility list. Counts have generous vertical margins; facts, caveats and actions compete. | Align cards to start, use inline count rows, 16–20 px padding and compact paragraphs. Preserve knowledge/provenance explanations through clearly labeled disclosure where approved. |
| Medium 6 | Responsibilities/Insights/Brain repeat “Current Board” and the full Board/Brand string. Brain uses an accent-filled CTA while useful review/continuation actions are secondary and farther away. | Shared Board group identity, restrained Brain entry, one visually primary continuation action. Keep per-module accessible scope and truthful capability text. |
| Medium 7 | Every Brand is rendered before work, every Board is rendered later. Auto-fit 270 px cards and 24 px Board padding favor discovery over efficient scanning. | Move full Brand exploration down; add an always-available compact Brand chooser above. Use compact Board rows/cards with explicit expansion for long lists (decision D3). |
| Medium 8 | Metadata/completeness explanations are verbose, yet essential; “recency” could easily be mistaken for visit history in a visual refresh. | One concise always-visible saved-recency/partial-coverage note plus full explanation. Never replace it with “Recently opened.” |
| Low 9 | Some headings combine English product terminology and German text (“Brands in deinem Workspace”); repeated long descriptions amplify variation in card heights. | Review new concise EN/DE copy together; retain intentional product terms, localize grammatical counts/plurals, and avoid assembled sentences. |

No evidence here supports adding deadlines, global task priorities, marketing outcomes, workspace-wide diagnoses, an activity feed or an AI-generated “daily briefing.”

## 4. Proposed information architecture

Evaluate the supplied concept as follows: A and C solve the main delay; B is useful only as a small transparent projection; D needs **scope separation rather than one undifferentiated intelligence grid**; E should remain fully available below work. A four-widget top dashboard would reproduce the present reading burden.

Recommended single DOM order, also used on mobile:

1. **Compact Workspace header** — Workspace identity/selector, selected Brand chooser, actual open Board identity and Continue, permitted creation and Profile entry. No inferred Board when none is loaded.
2. **Context notice**, only for mismatch/unknown association — distinguish selected Brand knowledge from loaded Board work; retain all three current routes.
3. **Your next moves**, subject to D1 — compact factual navigation summary, at most one row per supported source, no combined score.
4. **Continue Working** — connected and other authorized Boards with current ordering, dates, filters and Browse/Create.
5. **Intelligence** — selected-Brand knowledge section and separately labeled current-Board section containing responsibilities, structural diagnostics and contextual Brain navigation.
6. **Workspace exploration** — all accessible Brand cards, every Profile entry, visible-to-you counts and existing Workspace/Brand creation pathways.

Do not use CSS `order` to create a different visual versus keyboard sequence. Header and continuation must remain useful when every optional intelligence source is unavailable. Without approval for D1, ship the compact header directly followed by Continue Working; detailed modules retain their information.

### Proposed deterministic summary rule — requires explicit approval (D1)

Use the existing summaries only, in fixed source order: (1) selected-Brand Learning reviews, (2) current-Board assignments to the signed-in user, (3) current-Board applicable structural findings, (4) saved Board continuation fallback **only if none of the first three is available/actionable**. The order is a presentation choice, not a business urgency ranking. Do not sort categories by their counts or infer a deadline. No automatic action.

| Source | Inclusion and wording | Destination / guard |
| --- | --- | --- |
| Learnings | Valid selected-Brand aggregate; known `proposed > 0`; successful `canWrite:true`. State selected Brand, count and “awaiting review.” Read-only access offers “View Learnings” in the detailed module, not a demand to review. | Existing `learnings` action, authorized Brand ID and successful current read. |
| Responsibilities | Existing supported incomplete assigned-node summary; normalized session email match; `mine > 0`. Say “Assigned to you in [Board]”; no “overdue.” | Existing responsibilities manager; preserve viewer behavior and node ordering. |
| Diagnostics | Current `ready` projection with applicable findings. Show first existing finding title/severity, not an invented aggregate health metric. | Existing Insights adapter; node-specific action only with current captured evidence key and valid target. |
| Continuation fallback | First Board in existing `model(...).boards` ordering; known saved date or explicit unavailable label. | Existing Board action; never promote current Board across Brand groups or add personal recency. |

Unknown/denied/error sources are not zeros. Keep a short source-unavailable status linked to the detailed module, rather than claiming “all caught up.” Distinguish zero pending reviews from no loaded Board/empty Canvas. With no known action offer Browse Boards/permitted Create project. Render no placeholder tasks. Counts come from the same current summary objects as detail, without another request/cache or aggregation model. Implement additional summary controls through the existing guarded button factory/delegation, including B2 WeakMap scope capture; copied `data-*` attributes alone are insufficient.

## 5. Section-by-section redesign specification

| Section | Current value, position and space | Specific presentation change | Primary action and preservation constraints |
| --- | --- | --- | --- |
| Workspace hero | Recognition and welcome; first; 166–281 px in captures. Large identity, H1 and invitation repeat the navigation context. Violet surface and typography establish product identity well. | 40–44 px identity alongside a 24–28 px H1; 16–20 px padding, optional single short welcome line. Header target 104–144 px on wide screens; intrinsic height on mobile/long names. | Workspace switch through `selectSessionWorkspace`; retain confirmed selection until leave/access checks finish. No custom workspace store. |
| Workspace/Brand selection | Workspace selector second; Brand picks below it; native/select and pressed-button semantics are strengths. Choice is spread across the page. | Keep labeled `#home-workspace-select`, integrate into header. Add compact labeled Brand chooser using the same authorized catalog/`selectSessionBrand`; keep full existing picks below. Header Profile route available for selected authorized Brand. | Selection changes preference, never saved association, loaded Core or Board nodes. Preserve generation/adoption rules, Save/Discard/Cancel and busy guards. |
| Brand cards | Useful identities, visible counts, Profile access; currently third and unbounded above work. Short cards are already reasonably compact. | Move entire list to Workspace exploration. Keep 36–44 px logo/initials, selected border + textual/state semantics and separate pick/Profile controls. No new decorative Brand metrics. | All current Brand selection and Profile routes remain; visible-to-you counts are not organization totals. Hidden association stays unknown. Do not nest buttons or make the whole card another button. |
| Context notice | Correctly distinguishes Y from A/X; useful direct Continue; adds ~131 px desktop and much more on phones. Its information is essential, repeated labels are not. | Move directly below header; one concise sentence naming both scopes and open Board, followed by wrapping existing actions. Never collapse away the mismatch itself. | Preserve `[data-home-context]`, `data-context-action=continue/boards/profile`, status semantics, same-scope validation and focus restoration. Existing Canvas notice remains separately owned. |
| Continue Working | Concrete saved work; currently last. Cards identify Brand/viewer/current status and honest saved dates but use large padding, mark/date gaps and full-width buttons. | Place before intelligence. Desktop compact 2–3-column grid only when content width permits; one-column rows on tablet/phone. Identity + title, Brand relationship/current/read-only text, saved date, explicit Open/Continue. 16 px padding, 8–12 px internal gaps; no fixed card height or clipped full names. | Retain `#home-continue-title`, filters and `model` ordering. Connected → other → no visible association; known date descending, missing last, catalog index tie-break. Active Board only marked, not promoted. Catalog authorization controls identity. Preserve incomplete date coverage and manual library order. |
| Brand Intelligence | Selected-Brand review/knowledge counts, separate authorization; first intelligence row, tall stretched card. Good native `dl`, honest unknown states. | Own selected-Brand scope block; inline label/value rows, one Profile/review CTA. Keep meaningful review count more prominent than approved-knowledge stock. Human-reviewed knowledge meaning remains accessible and visible in concise form. | `home-intelligence-title`, `data-home-module=brand`, Learning focus key and retry semantics. No identity/count before valid Learning read. Sparse valid counts ≠ malformed unknown count. Same one bounded API read; discard statements/history. |
| Team Responsibilities | Real current-Board incomplete assignments and up to three node previews; same row as Brand. Heading, identity, provenance, two counts and list make it tall. | Move into current-Board group; compact count row and ≤3 native action rows with real status; full manager entry. Maintain current Canvas order, not “mine first” without separate approval. | `home-responsibilities-title`, module marker, existing completion/type/owner logic and safe node IDs. Preserve dirty/pending-save and viewer wording, manager capability checks and lazy focus-return target. No deadlines or new task model. |
| Campaign Insights | Local structural findings, automatic and source-labeled; below B1. Long explanation + up to three findings consumes most of a screen on tablet. | Current-Board group, same-scope provenance/time line immediately before findings. Tighter finding rows: severity text, title, one supporting sentence, optional Show on Canvas. Keep up to three existing findings and full Insights action; no score or finding reorder. | `home-insights-title`, module/finding markers, captured evidence key. Keep automatic local scheduling, applicability filter, distinct analyzing/error/none/empty and saved versus live source. Do not require visiting Insights first. |
| AI Brain | Explicit current-Board editor navigation; tinted card in B2 row. Three explanatory paragraphs and repeated identity make a navigation entry oversized. | Compact footer panel of current-Board group, subdued violet accent, one descriptive sentence and clear “Open AI Brain” navigation wording (D4). Explain answer generation only on explicit question submission and conditional authorized knowledge coverage. | `home-brain-title`, module marker and guarded `brain` action; unchanged editor-only eligibility, preserved question draft, no prefetched knowledge/inference/submission, existing destination focus. |
| Empty/loading/error | Existing truthful scoped states; generic dashed `.home-empty` uses 24–40 px padding and can dominate small screens. | Compact source-specific inline status/retry within stable section frames. One onboarding panel only for whole-Home absence; no grid of giant identical empty cards. | Keep sign-in/public, no Workspace, chooser, no Brand, no Board, zero values, denied and unavailable distinctions. §9 gives full behavior. |

### Board density and many-Board behavior (D3)

Recommended later presentation cap: show the first **six** entries from the existing globally ordered Home list; insert group labels only for groups represented; provide a native **Show all visible Boards** expansion, current total from the authorized catalog, and Browse Boards. This is a proposed presentation bound, not a product limit. Expand in-place to the entire existing list without another collection request, filtering, sorting or changing authorization. Selected-Brand filter still applies through `model`, resets to All on scope change as today, then expansion resets too.

An open foreign-Brand Board outside the first six stays in its proper position; header Continue provides direct access without changing ordering. Missing collection dates cannot remove catalog links. On scope loss hide the entire old projection. When collapsing a list whose focused item would disappear, move focus to the expansion control. Until D3 is approved, render every existing Board with the new compact treatment.

## 6. Visual tokens and component guidance

Preserve Tendra's violet, Brand imagery and editorial clarity. Borrow the Advisor's restrained accent header, neutral source surfaces, progressive disclosure and consistent native action treatment. Its modal-scale hero should not be copied into a daily dashboard. Keep backgrounds subtle; don't stack global radial gradients with several prominent card gradients.

Use existing semantic variables rather than introducing a parallel palette or theme state. Current baseline values below are references; the theme controller remains authoritative.

| Role | Existing token / proposed Home-scoped size | Guidance |
| --- | --- | --- |
| Typeface | `--fk-font-family` (Inter/system fallbacks) | No font package/download; inherited family, tabular numerals for counts if supported. |
| Page/card | `--fk-color-app-bg`, `--fk-color-surface-card`, `--fk-color-surface-elevated` | Light page `#f4f5fb`, elevated `#fff`; Dark page `#0b1020`, card `#161f35`, elevated `#1b2540`. Do not force every dark surface to elevated. |
| Text | `--fk-color-text-primary`, secondary, muted, link | Light primary `#20243d`, secondary `#4e5675`; Dark primary `#f4f6fc`, secondary `#bac3d8`. Use secondary for meaningful scope/provenance, not low-contrast decorative text. |
| Accent/action | `--fk-color-primary-action`, primary-hover/subtle, `--fk-color-button-primary-text`, `--fk-color-text-link` | Light action `#6847f5`, Dark `#7c5cff`. Existing theme-specific primary text, not assumed white. One prominent Continue/Create action per context. |
| Borders/depth | `--fk-color-border-default`, border-control, existing shadow-card | 1 px border, restrained shadow; clear hover/focus without lift/size change. Use established defaults where Home currently falls back from `border-subtle`. |
| Feedback | existing warning/danger/information/success tokens | Finding severity remains text; don't use “success” for missing data or zero structural findings. |
| Focus | `--fk-color-focus-ring` | Retain 3 px ring, 3–4 px offset; ensure parent overflow does not clip it. |
| Spacing | Home-scoped 4/8/12/16/20/24/32 px scale | 16–20 px card padding; 12–16 px card gaps; 24 px section separation; avoid accumulated 32/40 px rules. |
| Type scale | H1 24–28/1.2; H2 18–20/1.3; H3 15–16/1.4; body 14–16/1.5; metadata 12–13/1.5 | Relative/rem units, not a new global type reset. Preserve full labels at zoom; no all-caps long labels. |
| Shape | Header 20 px; cards 14–16 px; controls 10–12 px | Distinct levels, fewer competing 22–28 px containers. |
| Identity | 40–44 px header, 32–40 px Board identity, 36–44 px Brand cards | `FunklixBrandLogo` safe images/initials, contained artwork and error fallback; no arbitrary replacement imagery. |
| Motion | existing 120–180 ms color/border transitions | No auto-carousel or attention animation. Existing reduced-motion override remains effective. |

These sizes are implementation targets, not runtime CSS changes in this PR. Measure text contrast ≥4.5:1 for body/action text and ≥3:1 for large text/non-text controls/focus against adjacent colors. The current capture verified a visible 3 px focus outline and 44 px Brain control; it did not audit every contrast combination.

## 7. Desktop layout concept

The [annotated layout illustration](bw36-22-home-evidence/layout-concept.svg) and text below use **field placeholders only**, with no fabricated product results.

```text
Existing sidebar │ [Workspace identity + H1]       [Workspace select]
                 │ Selected Brand: [chooser]       [Profile] [Create]
 A: compact      │ Open Board: [name] · [actual Brand]       [Continue]
                 │ [Mismatch explanation + existing routes, if applicable]
 B: attention    │ Your next moves (D1)
                 │ [Brand review link] [Board assignments] [Canvas finding]
 C: resume       │ Continue Working                   [Browse] [Create]
                 │ [All visible] [selected Brand]   saved-recency/coverage
                 │ Connected / Other / Unknown groups, existing order
                 │ [compact Board] [compact Board] [compact Board]
                 │ [Show all visible Boards — D3]
 D: intelligence │ Selected Brand [identity] │ Current Board [identity]
                 │ Brand Intelligence       │ Team Responsibilities
                 │ counts + review/view     │ counts + existing preview
                 │                          │ Campaign Insights + provenance
                 │                          │ compact AI Brain entry
 E: exploration  │ Brands in your Workspace + all Profile/pick pathways
```

At available Home content width ≥960 px use a 5/12 selected-Brand column and 7/12 current-Board column with 16–20 px gap. Board cards may use three columns only when each has ≥260 px. Between 640 and 959 px use at most two Board columns; intelligence may use one column if either scope's content becomes cramped. Below 640 px use one column. These are **content-width decisions**, accounting for the existing sidebar; do not copy viewport 1440 as a card breakpoint or alter global shell breakpoints. Prefer a scoped container query with an explicit fallback.

Retain one maximum-width Home container. The present Home nominal max is 1200 px but `.mission-control` caps its parent at 1120 px; resolve that Home-only constraint deliberately, to an effective 1200 px where space allows. At 1920 px center that container rather than stretching paragraphs across the screen. No new right sidebar or sticky dashboard header. Target in the existing 1440 × 900 fixture: next moves start within y=240 and first saved Board action within y=600; with long names/mismatch at least one current/saved continuation action should remain visible. These are acceptance targets requiring actual implementation verification.

## 8. Mobile, tablet and accessibility concept

```text
[Workspace identity]       [existing shell menu]
Workspace [native select]
Selected Brand [chooser]        [Profile]
Open Board [name · actual Brand] [Continue]
[Visible mismatch + wrapping navigation, if present]
Your next moves (D1): stacked factual action rows
Continue Working: filters + compact Board rows
[Show all visible Boards — D3] [Browse] [permitted Create]
Selected-Brand intelligence
Current-Board identity
Responsibilities → Insights → compact Brain
Workspace exploration: every Brand pick/Profile entry
[scroll clearance above existing fixed mobile controls]
```

- **375/320 px:** 16 px outer gutters, resulting 343/288 px Home width as currently observed. No horizontal action strip/carousel. Row actions wrap or become full width, minimum 44 px interactive height. Long Workspace/Brand/Board names wrap with `overflow-wrap:anywhere`; keep full accessible names, no tooltip-only recovery. Header's height grows rather than truncating identity to hit a screenshot target.
- **Tablet:** 768 px currently yields 648 px Home content next to the narrow rail; B1/B2 already stack at 800 px viewport. Keep intelligence readable in one column, use compact continuation density and avoid treating tablet as a shrunken three-column desktop. Expanded preference must still respect shell rules.
- **Laptop:** check 1024 and 1280 with both sidebar preferences; use actual content width for grids. Long German identity strings need no fixed-height cards.
- **Mobile obstruction correction:** calculate the occupied shell/context-control rectangle and add Home bottom scroll padding plus each focusable action's `scroll-margin-block-end` using that occupied height and `env(safe-area-inset-bottom)`. Add clearance for floating context controls, not just the nav bar. Verify middle-of-page as well as last controls. If shell overlays cannot be avoided by scroll clearance, a narrowly scoped shell positioning fix needs separate implementation review; do not mask it with hidden overflow or delete navigation.
- **Zoom:** test native 200% zoom at 1280/1440, 400% reflow from 1280 (320 CSS px), and text-only enlargement. CSS zoom evidence is supplemental only. No horizontal page scrolling for Home content and no obscured focused control; navigation popovers/dialogs retain their own scrolling.
- **Keyboard:** native select/real buttons; no clickable `article`, nested actions or positive tab indices. DOM order matches visual order. Maintain `data-home-focus` keys across destructive `draw()` replacement; a new summary needs unique stable keys distinct from detail. B2 controls must be created through the captured-scope path. After list collapse restore focus to Show all. After navigation retain existing destination focus; after responsibilities close retain lazy return lookup.
- **Semantics:** one visible Workspace H1; meaningful H2 sections; existing unique module heading IDs continue to label sections. Scope-group heading plus module `aria-describedby` can share Board identity without repeating its text visually. Keep selected-Brand scope independent. Use lists for Board/findings/responsibilities and `dl` for counts. Reconcile current finding H4 depth under H2 (add a real group H3 or use H3 findings). Do not delete existing heading IDs to solve depth.
- **Status:** keep existing polite loading/status and aria-busy semantics; use one changing status per source. Avoid re-announcing unchanged findings/counts on the local one-second observer; no live region around the entire dashboard. Errors must identify the failed source and preserve a reachable retry.
- **Theme:** retain `funklix.themePreference.v1`, bootstrap-before-paint, system change handling and semantic variables. Verify system resolving Light and Dark, not just explicit preferences. Forced-colors must show borders, pressed state and focus. Reduced motion disables transitions and Canvas focus pulse/smooth scrolling through the current adapter.
- **Language:** `uiText`/`FunklixLanguage`; add complete EN/DE phrases with placeholders/plural handling. Proposed labels for review: “Your next moves” / “Deine nächsten Schritte”; “Open AI Brain” / “KI-Brain öffnen”; “Show all visible Boards” / “Alle sichtbaren Boards anzeigen.” These are proposed translations, not approved runtime copy. Preserve actual user-authored names and canonical status/finding values; translate only known system strings at render time.

## 9. Empty, loading and error-state approach

| State | Required compact behavior / next action |
| --- | --- |
| Anonymous or public-token context | Sign-in welcome; no private catalog, counts or account aggregation. Public Board is not a Workspace membership grant. |
| Catalog idle/loading/refreshing | Header shell + truthful finding-Workspace status. Remove old private identities/actions; no stale skeleton containing prior names. |
| Catalog error/denied/stale | Access-unconfirmed explanation and existing Retry. Do not say there are no Workspaces. |
| No Workspace | One onboarding panel + existing first Workspace creation. Multiple Workspaces without selection retain explicit chooser. |
| Workspace with no visible Brands | Honest access-safe wording and existing permitted management. Saved Board continuation remains useful; don't infer “organization has no Brands.” |
| No selected Brand | Selection prompt; no guessed Board Brand Learning request. Board-scoped work remains separate if valid. |
| Learning read pending | Clear prior identity/counts; stable native aria-disabled action/focus key and checking-access status. No zero preview in next moves. |
| Valid zero Learning aggregate | Genuine zero, no pending-review demand; approved count retains supplementary-knowledge meaning. |
| Malformed/failed/denied Learning read | Existing retry path, unavailable unknown counts and access-safe message. No old Brand or silent all-clear. |
| Board dates loading/failed/partial | Keep authorized links, unavailable dates where needed, current recency/coverage notice, separate date retry. Do not introduce global skeleton blocking navigation. |
| No saved Boards / filter has no matches | Distinct whole-list versus selected-Brand empty copy; permitted Create project or Browse/clear filter. |
| Board loading/hydrating | Current Board-dependent rows absent, wait text; opening another Board remains disabled by current guard. |
| No loaded Board | Continue Working visible; a single current-Board-group prompt can share Browse Boards while each module remains semantically understandable. No auto-load to fill widgets. |
| Board viewer | Continue viewing/read-only text; responsibilities manager remains read-only; no actionable Brain entry. |
| Zero incomplete assigned supported nodes | Precise existing statement; unassigned nodes do not become completed tasks. No “all work done” workspace assertion. |
| Diagnostics analyzing / stale | Hide obsolete findings immediately; localized analyzing state; automatic authorized local calculation continues. Keep View all Insights when allowed. |
| Empty Canvas / no applicable findings / calculation error | Three separate states; no metrics, success badge or AI recommendation. Error is not “no issues.” Keep current destination path. |
| Account/Workspace/Board/access change | Abort/invalidate, cancel obsolete scheduled diagnostic work, clear old projections, reject stale clicks. No persistent personalized action cache. |

Avoid animated skeletons for already-fast local calculations. If reserved placeholders are needed, keep them inert, source-labeled and motion-free under reduced motion; no synthetic progress/time estimates.

## 10. DOM and lifecycle risk assessment

| Contract / actual owner | Risk when redesigning | Required preservation / implementation verification |
| --- | --- | --- |
| `index.html`: `#dashboard-view`, `.mission-control`, `#home-foundation`; hidden legacy `#dashboard-title`, dashboard hero/continue/focus/support IDs; Canvas/Inspector/editor/dialog IDs | Deleting old markup can break boot, cached `el` references and isolated fallback renderers. | Keep every existing static ID and mounted lifecycle node. Existing Home-only hide rule stays; scope changes inside Home. Run DOM/browser-script integrity and root/Board boot checks. |
| Generated IDs: `home-workspace-select`, `home-brands-title`, `home-continue-title`, `home-intelligence-title`, `home-responsibilities-title`, `home-insights-title`, `home-brain-title` | Duplicate IDs when header and detail reuse the same fragment; lost labels. | Exactly one instance of each; retain `aria-labelledby`, label association. New wrappers receive new IDs. No cloned full modules for summary. |
| `home-foundation.js`: `model`, `intelligence`, `boardIntelligence`, `draw`, `sync`, `sameScope`, `learningSummary`, `responsibilitySummary` | Replacing composition can silently change order, membership, counts or lifecycle. | Leave projections/semantics unchanged; reorganize generated nodes/classes in `draw`, extract presentation helpers only where needed. `sync`/invalidate/dispose remain controller-owned. |
| `data-home-action`, `data-home-id`, `data-home-focus`; module/finding markers; B2 `boardActionContexts` WeakMap | New buttons may bypass scope/evidence checks; duplicate focus keys lose focus on redraw. | Route through existing factories/delegation; add unique focus keys for extra placements; populate WeakMap for every new B2 action. Preserve finding code/severity and evidence-key checks. |
| `renderContextNotice`; `[data-home-context]`, `data-context-action`; global `#brand-board-context-notice` | Home and Canvas notices can be accidentally conflated; stale notice routes. | Keep separate hosts, current scope lookup, hidden behavior and focus restoration. Move only Home notice output; no forced Board reassociation. |
| `selectSessionWorkspace`, `selectSessionBrand`, preference generation, nonblocking `adoptLoadedBoardBrandPreference` | Header selectors may clear a Board, change authority or block hydration. | Same guarded adapters and confirmed value behavior. Preserve Workspace pending-mutation/unsaved/Profile guards; no direct session field writes. |
| Catalog ready/account object/normalized identity/status/generation; collection join | Counts/names can leak from old scope or collection snapshots. | Authorized catalog supplies identities and visible associations. `/api/boards` only supplies minimized saved date/unassigned evidence intersected by ID. Retain abort + checks before/after JSON and accessLost revalidation. |
| `loadLearnings` + focus/visibility/Learning-change listeners | A summary can cause a second fetch, stale counts or whole-library scan. | Same bounded `status=all&offset=0` read, 12 s abort, aggregate semantics, can_write, manual retry, content discarded. No revision-only cache or per-Brand fan-out. |
| Responsibilities projection in `app.js`; supported types, normalization, completion and owner-email match | Compact counts can redefine tasks or authorization; duplicate IDs become focus targets. | Reuse current summary and manager. Same duplicate/safe ID exclusions, stable Canvas order, dirty/pending-save provenance, viewer behavior and manager focus return. |
| `homeInsightsContext`, `ensureHomeInsightsDiagnostic`, `cancelHomeInsightsRequest`, `calculateInsightsDiagnostic`, fingerprint/snapshot | Summary accidentally schedules analysis per widget, exposes stale findings or labels live as saved. | Same shared adapter and deduped idle/32 ms timer path, full account/catalog/Workspace/Board/generation/fingerprint/provenance checks. Reuse snapshots, cancel/reject stale context, retain failure deduplication and applicability/order/limits. No new observer or cache. |
| `openHomeBoardDestination`, `showInsightsFindingOnCanvas`, navigation controls | Opening destination through CSS alone misses guards/focus; Brain auto-submits. | Existing sidebar/view adapters and revalidation; same native question input/draft, no inference on navigation. Node target must remain unique, current and selector-safe. |
| Board route adapter, hydration generation, root non-restoration, autosave/revision/conflict machinery | Fetching previews changes runtime Canvas; layout changes trigger writes or stale save. | Existing current Canvas navigation or `/boards/:id` full route only. No Board detail fan-out, `applyCampaignState`, `markUnsaved`, serialization/save, association or Core writes for Home presentation. |
| One-second local presentation observer, `draw()` replacement, dispose listeners | New UI loses focus, repeatedly announces state or leaks timers. | Keep one controller/observer and same invalidation ownership; no additional polling/network loop. Preserve focus keys and lazy dialog return; recheck after count/diagnostic updates. |
| `styles.css` shell cascade, Home padding/container constraints, fixed mobile controls | New global grid/breakpoint breaks Canvas/Inspector or obscures focus. | Scope all layout to Home; use actual available width; preserve sidebar/settings/popover behavior. Any necessary small clearance integration is reviewed separately. No application-shell rewrite. |
| `language.js`, theme bootstrap/controller, logo renderer | Separate palette/preferences, untranslated actions or unsafe images. | Existing EN/DE/theme/identity infrastructure, approved URL handling, fallback initials; no new setting store. |

Most layout work is low risk if additive and scoped. Highest risk is **new duplicated action placements**, because dataset attributes do not carry B2's captured authorization/evidence by themselves, and **merging scope headers**, because selected Y must never become the label/knowledge source for loaded A/X. Test these before visual polish.

## 11. Minimal implementation sequence

1. **Approve decisions D1–D5**, especially summary rule and density. Record chosen behavior in the implementation ticket; this audit is the archived proposal, not approval.
2. **Compact orientation and continuation:** Home-only header, retain native selector and add guarded compact Brand preference control, move Home mismatch notice up, Continue Working before intelligence, move intact Brand exploration down. Preserve all readers/order/limits. Verify context/DOM/navigation before styling further.
3. **Recompose existing intelligence:** separate selected-Brand and loaded-Board scope groups, compress counts/cards, shared Board identity, compact Brain, preserve all states/provenance/actions and full descriptions through approved presentation. No new summary until its decision is approved.
4. **Add approved next-moves/Board expansion presentation:** reuse existing summaries and guarded button construction; no additional requests. Add stable focus/expansion handling. If D1/D3 are declined, omit these additions and retain all current information.
5. **Responsive/accessibility polish and acceptance:** Home typography/surfaces/gaps, mobile clearance, long-name/EN/DE/theme/zoom/keyboard/status checks. Run the existing functional gates and approved visual targets before opening the implementation PR. Do not fold unrelated AI, backend, SQL or shell work into the redesign.

Each future phase should keep the application usable and preserve all shipped capabilities. This documentation PR implements none of those phases.

## 12. Regression and visual acceptance plan

### Checks performed for this audit

- Confirmed current merged baseline through Git and GitHub connector; read the source and historical records above.
- Captured current Home at eleven viewport/theme/language/sidebar configurations plus lower Insights/Brain positions and CSS zoom/long-name stress. Geometry records document containment, module positions and actual hero heights.
- Visually inspected fresh desktop Light/Dark, tablet, phone Light and narrow phone Dark, plus representative historical B2/Advisor images. Native Brain focus showed a 3 px outline, 44 px minimum height, and Enter reached existing `ai_brain`. Browser harness asserted no page errors or Board writes; all transport intercepted.
- Documentation/link/whitespace and changed-path checks are the delivery verification. No runtime changes justify rerunning the entire 185-step workflow here. Historical implementation test totals are not claimed as tests rerun for this audit.

### Required future functional gates

Reuse the existing checks rather than replacing their semantics with new snapshots: `check:bw36.21a`, `check:bw36.21ar2.1`, `check:bw36.21ar2.2`, `check:bw36.21ar2.3`, `check:bw36.21b1`, `check:bw36.21b2`, responsive-shell/theme/localization and the complete `.github/workflows/runtime-boot-safety.yml` validation. Any added checks must test the new presentation behavior, not weaken existing authorization/order/lifecycle assertions.

| Acceptance group | Required scenarios and pass criteria |
| --- | --- |
| Scope/privacy | Selected Y + Board A/X: header, summary, knowledge and Board groups show correct independent scope; hidden/unassigned association wording differs; no unauthorized historical labels. Account replacement (including same email), logout, access loss and public token clear old identities/results and reject stale actions. |
| Workspace/Brand/Profile | Switching Workspace while dirty, hydrating, saving, pending responsibility/AI mutation and Profile dirty/busy; existing decisions remain. Nonblocking Board-Brand adoption cannot override later explicit choice or delay usable Board boot. Every Brand Profile and multiple-Workspace/Brand creation route remains reachable with existing capability checks. |
| Board continuation | Connected/other/unknown grouping, date ties, missing/invalid/partial timestamps, no selected Brand, selected filter, current foreign Board, viewer and long lists. Date failure leaves authorized links; no last-opened claim or library reorder. D3 expansion preserves whole-list order and reaches every catalog Board. |
| Learnings/responsibilities | Valid sparse counts, malformed individual count, denied/error/timeout/retry; no stale Brand identity during refresh. Assignment type/status/owner/duplicate exclusions unchanged; node navigation and manager focus restoration work after Home redraw. No extra Learning calls for summary. |
| Diagnostics/Brain | Direct hydrated Board → Home automatically analyzes without Insights visit; stale/dirty/saved/empty/error states remain distinct. Cancel pending task on account/Workspace/Board/generation/access/Canvas/view changes; one calculation per current evidence, exact engine parity, no reordered source findings. Invalid targets/evidence refuse node focus. Brain viewers blocked; editor navigation preserves draft and performs zero AI request until explicit submit. |
| Lifecycle integrity | Compare nodes/edges/Core/association/dirty/saved snapshot/revision before and after rendering/navigation; zero writes or serialization introduced. Root startup does not restore old Canvas. Direct route/reload/Back, autosave/conflict and no-DOM-removal checks pass. |
| Focus/semantics | Tab/Shift-Tab/Enter/Space on every header, summary, filter, expansion and detail action. Focus survives asynchronous Learning/diagnostic redraw and manager close. Unique IDs, correct heading hierarchy, select labels, announced scope/status and pressed/read-only state. Manual screen-reader check with NVDA/Firefox or VoiceOver/Safari; screen-reader acceptance is pending here. |

### Required visual acceptance matrix

Capture hero-top **and actual section-position views**; page-level screenshots do not expose the nested Home scroll area completely. Use the same existing fixtures, plus existing no-Workspace/no-Board/viewer/loading/denied fixtures and long-label stress; no fake dashboard metrics.

- Widths 1920, 1440, 1280, 1024, 768, 375 and 320; both sidebar preferences at desktop/tablet and actual mobile shell. Include short viewport height, safe-area device, open selector/popover and menu focus.
- EN and DE; explicit Light/Dark and system resolving both. Reduced motion and forced colors. Native zoom 200%, 400% reflow, and text enlargement. Snapshot current state before and after asynchronous counts/analysis settles.
- At 1440 × 900 with the existing populated mismatch fixture: target next moves by y=240, first saved Board action by y=600. At 375 × 812 and 320 × 740: target current-Board Continue and at least one supported action above fixed-control clearance in the initial viewport; first saved Board action by one viewport of Home scroll after the compact header. These targets must yield to full labels, accurate mismatch copy and accessible controls, never clipping.
- No document/card horizontal overflow, overlap, hidden focus ring or shell-covered focused action; all final rows scroll fully above fixed controls. Verify hit rectangles/occlusion, not only `scrollWidth`.
- Contrast thresholds from §6 pass in both themes; meaningful text remains readable. No decorative metric, generated recommendation, deadline, fake activity or empty oversized widget. Repeated scope text is removed only where its meaning remains visually and programmatically available.

These are future release gates; the proposed layout has not been implemented or measured.

## 13. Explicit product/design decisions requiring approval

| ID | Decision to approve before implementation | Recommendation / fallback |
| --- | --- | --- |
| D1 | Add “Your next moves,” fixed source priority, eligibility and fallback from §4. | Approve only as factual navigation with no unified urgency. If declined, header → Continue Working; keep existing detail information. |
| D2 | Move full Brand exploration below work and add compact top Brand chooser. | Approve with all Brand/Profile/creation routes retained and no preference-to-association write. Full list remains available without losing identities. |
| D3 | Six-entry continuation preview + in-place Show all, count and expansion reset. | Approve as a reversible presentation cap only. Otherwise render all existing Boards compactly, in unchanged order. |
| D4 | Compact Brain navigation and concise copy/disclosures; which explanatory text may move into native disclosure. | Retain always-visible current Board scope, editor/read-only eligibility, saved/live diagnostic provenance and explicit-question inference boundary. Full knowledge/coverage explanation remains accessible. Approve EN/DE wording together. |
| D5 | Effective 1200 px Home container, density/type scale, responsive targets and shared Board scope group. | Approve annotated direction with intrinsic height and per-module accessible scope. Treat visual targets as reviewed goals, not permission to truncate or alter shell behavior. |

Approving this document for archival does not approve implementing these choices. Cross-Workspace aggregation, new task priority/deadline models, personal visit tracking, new APIs/SQL, AI suggestions/automatic prompts, changed Board association semantics, diagnostic formulas or global shell replacement remain outside the redesign.

**Delivery scope:** documentation/evidence only; one normal PR against `main`, no merge. Preserve the current product until a separately authorized implementation.
