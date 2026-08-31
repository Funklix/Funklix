# BW-28 AI Insights and Analytics product architecture audit

**Audit date:** 2026-08-31  
**Package:** documentation only; implementation target is one later combined PR  
**Evidence convention:** **Confirmed** describes repository behavior; **Inferred** is a code-supported consequence not directly asserted at runtime; **Recommendation** is future BW-28 design; **Unresolved** requires a product decision. Line regions are approximate and refer to the audited revision.

## Executive summary

**Confirmed.** AI Insights is a client-only, read-only view reached by `#insights-nav-btn`. `setActiveView("insights")` calls `renderCampaignIntelligence()`, which synchronously runs `analyzeCampaign(state.nodes, state.edges, state.brandCore)`, captures an identity-bound snapshot, and renders both Insights and the separate AI Brain destination. The page cleanly separates an honest Measured performance empty state from seven deterministic Canvas cards, but has no overview, prioritization, affected-node navigation, methodology detail, reporting history, analytics API, connector, import path, or analytics persistence. The displayed “Canvas readiness” and component scores are fixed heuristics over the live loaded Canvas, not observed performance (`index.html` 241, 579-581; `app.js` 5051-5196, 5198-5211, 5538-5612, 16212-16255, 17183-17190).

**Confirmed.** The snapshot is Board/account/access-generation scoped through `currentInsightsIdentity()` and rejected when identity changes. It is computed from live `state.nodes`, so it includes unsaved edits; `state.isDirty` controls the disclosure. There is no snapshot timestamp or Canvas fingerprint, and recalculation occurs when Insights/AI Brain opens and at the existing `renderCampaignIntelligence()` call sites, not through a dedicated mutation subscription (`app.js` 85-162, 5198-5211, 5538-5602, 16248-16254).

**Recommendation.** Keep AI Insights as structured evidence and organize the smallest useful V1 as vertically stacked **Overview**, **Measured Performance**, **Canvas Diagnostics**, **Opportunities**, and collapsible **Data and Methodology** sections. Do not use metric-card placeholders or tabs that imply populated analytics. Every value must implement the provenance contract below. Reuse selection/reveal helpers for “Show on Canvas”; add a deliberate, single user turn for “Ask AI Brain,” without mutation. Keep AI Review node-specific and reserve a separate future Simulator module/navigation destination for assumption-based scenarios.

**Go decision:** proceed with one combined BW-28 implementation PR only if the truthfulness, provenance, source lifecycle, read-only action, authorization, translation, accessibility, and regression gates in this audit are accepted. No critical technical blocker was found.

## 1. Current AI Insights architecture

| Concern | Finding and evidence |
|---|---|
| Navigation/DOM | **Confirmed:** sidebar button `#insights-nav-btn` (`.nav-item.fk-btn`, label `Insights`) and destination `section#insights-view.board-list-view.hidden` containing `#insights-cards.boards-library-panel`; heading is “AI Insights” (`index.html` 241, 579-581). The cached element is `el.insightsView`/`el.insightsCards` in the main DOM map (`app.js` approximately 250-350). |
| View state | **Confirmed:** `state.activeView` defaults to `board`. The nav handler calls `setAppMode("canvas")` then `setActiveView("insights")`. `setActiveView` toggles `.hidden`, active nav state, toolbar/inspector visibility, and calls `renderCampaignIntelligence()` for Insights or AI Brain (`app.js` 85, 16212-16255, 17183-17190). |
| Rendering | **Confirmed:** `renderCampaignIntelligence()` → `analyzeCampaign()` → `captureInsightsDiagnostic()` → `renderInsightsSurface()` and `renderAiBrain()`. `renderInsightsSurface()` uses `innerHTML` with system-owned values plus Canvas-authored platform/audience strings; current code does not escape those strings, a blast-radius/security concern for interactive expansion (`app.js` 5198-5211, 5569-5612). |
| State | **Confirmed:** relevant fields are `nodes`, `edges`, `brandCore`, `activeView`, `currentBoardId`, `isDirty`, `isBoardLoading`, `initialServerLoadInFlight`, `boardLoadGeneration`, `user`, `boardAccess`, `publicBoardToken`, `insightsDiagnosticSnapshot`, and AI Brain state (`app.js` 59-162). `analysisRefreshing`, `analysisLastUpdatedAt`, and `analysisError` exist but are not used by the current Insights renderer (`app.js` 149-154). |
| Snapshot/identity | **Confirmed:** `currentInsightsIdentity()` includes user email, Board ID, load generation, and access denial/reason. `captureInsightsDiagnostic()` stores only `{identity, analysis}` when a viewable nonempty loaded Board exists (`app.js` 5538-5548). |
| Empty/loading/error | **Confirmed:** explicit states cover loading, no Board, denied access, empty Canvas, and invalid/calculation failure. Measured Performance always shows “No campaign analytics are connected yet” and no numbers/actions (`app.js` 5573-5608). |
| Data/API/persistence | **Confirmed:** Insights makes no fetch, database, local-storage, or save call. The diagnostic snapshot is memory-only. The only input is live client state; `brandCore` is accepted by `analyzeCampaign` but unused in its calculations (`app.js` 5051-5098, 5569-5612). |
| Saved/unsaved | **Confirmed:** analysis reads live `state.nodes`; disclosure is “Includes unsaved Canvas changes” when `state.isDirty`, otherwise “Based on the currently loaded saved Canvas” (`app.js` 5051, 5198-5208, 5599-5602). Navigation does not save. Existing autosave machinery is independent and may fire while another view is open because this view does not cancel it (**Inferred**, `state.autosaveTimer`; `app.js` 90-110 and save lifecycle around 4800-4900). |
| Language | **Confirmed:** English is the canonical key/fallback. `language.js` provides German Insights keys; `INSIGHTS_DIAGNOSTIC_MESSAGES` closes the translatable system message set. Canvas-authored audience/platform strings remain unchanged. UI-language change rerenders open Insights from the cached snapshot without analysis (`language.js` 1-45, 147-179; `app.js` 5550-5567, 16320-16331). |
| Theme/design | **Confirmed:** base styles use `.insights-boundary`, `.insights-section`, `.insights-grid`, `.insight-card`, `.insight-step`, `.insights-provenance`, and state classes; BW-27 token overrides cover surfaces/chips/cards in Dark Mode (`styles.css` 2557-2580, 7059-7084, 7363-7376). Light Mode still uses older literal colors/gradients in this region. |
| Responsive | **Confirmed:** auto-fit cards use `minmax(220px,1fr)`; only the hero span and section padding change at 640px. Funnel and provenance chips wrap. There is no tab overflow, affected-node list, long-label action layout, or explicit inspector-width rule (`styles.css` 2557-2580). |
| Board/account/access | **Confirmed:** snapshot identity rejects prior account/Board/load-generation/access reason; unavailable states suppress diagnostics. Board load and access machinery controls `boardLoadGeneration`/`boardAccess`. A Public Viewer with `canView !== false` can see read-only diagnostics; no Insights buttons exist, so no write trigger is exposed (`app.js` 653-741, 8266 onward, 5538-5612; `scripts/check-bw25-honest-ai-insights-baseline.js` 42-64). |
| Relationship to AI Brain | **Confirmed:** both destinations share `analyzeCampaign`; `renderCampaignIntelligence()` rerenders Brain. Brain requests send an independently projected live Canvas and selected node to `/api/ai-brain/advice`; server-side diagnostics are separately derived, not the client snapshot. Brain copy says it can explain diagnostics. No selected-insight handoff exists (`app.js` 5198-5211, 5213-5448; `api/_ai-brain-diagnostics.js` 1-approximately 70). |
| Relationship to AI Review | **Confirmed:** no direct Insights link. AI Review calls `/api/review-node`, formats node-level score/summary/strengths/improvements/rewrite, and persists a post-it through `saveCampaignCanvasState()`; it can also preview/apply fixes (`app.js` 13880-14240, 15133-15165; `api/review-node.js`). |
| Relationship to generation | **Confirmed:** Insights renderer has no generation trigger. `analyzeCampaign` feeds legacy `suggestNextNodes()`/creation code elsewhere, and V3 generation runs its own quality/strategic diagnostics. Current Insights exposes neither those issue arrays nor generation actions (`app.js` 5051-5196, 10380-11420, 12200-12750). |

## 2. Current displayed-value inventory

All numeric values below are **Board-specific, live-Canvas, deterministic heuristic, memory-only, not measured, not persisted**, may become stale until `renderCampaignIntelligence()` runs, and are not inherently Brand-specific. “Brand-specific” is therefore **No**, despite `brandCore` being passed. Source state may include unsaved edits.

| UI value | Actual calculation/source | Accuracy/actionability assessment |
|---|---|---|
| Measured performance status | Constant copy: no analytics connected; status chip “Data status: No analytics connected.” No schema/source check (`app.js` 5603-5606). | **Accurate, unavailable classification; actionable only as expectation-setting.** |
| Canvas readiness / Diagnostic score | `healthScore = clamp(round(40 + stage coverage×25 + trust?10 + ≥2 unique CTAs?10 + ≤1 audiences?10 + ≤2 tones?5),0,100)` (`app.js` 5070-5073). | Label is substantially honest, but unexplained base 40 and mixed dimensions overstate readiness certainty. Primary only with methodology tooltip and scope. |
| Funnel-stage coverage | Five fixed stages. Explicit `funnelStage`; Idea/Social→Awareness, Content→Interest, Landing/goal or stage Conversion/nonempty landing CTA→Conversion. Confidence is covered/5×100 but is not displayed (`app.js` 5052-5063, 5076). | Useful **inference**, not purely structural fact. Show rule and never call confidence measured. |
| Covered/missing stages | Set difference over inferred stages; five chips (`app.js` 5052-5063, 5589-5592). | Actionable gap map; heuristic role inference needs tooltip. |
| Canvas nodes by platform | Counts only `type === "Social Media Posting"`; platform is `social.platform || "Unknown"`; total is sum (`app.js` 5064, 5069, 5090, 5593). | Reliable primary count for normalized nodes; platform name is user content. |
| CTA structure score | Unique lowercase values from landing `cta` or social `preview`; `unique/max(cta count,1)×100`. Missing CTA warning only when no CTA; variation suggestion if fewer than 2 (`app.js` 5065-5067, 5078). | Approximate and potentially misleading: uniqueness is not quality and ignores node coverage. Rename “CTA variation diagnostic”; tooltip required. |
| ICP consistency | Distinct trimmed `audience`; score 90 for zero/one value, else 55; issues list raw audiences (`app.js` 5067, 5079). | Heuristic can reward missing data. Group under strategic consistency; do not claim validated ICP fit. |
| Tone consistency | Distinct trimmed `tone`; 90 for ≤1, 75 for 2, 50 for >2; warning only >2 (`app.js` 5068, 5080). | Heuristic can reward missing tone and intentional variation. Tooltip required. |
| Trust-layer coverage | Any Landing Page with nonempty `landingPage.trust` gives 80, otherwise 35 and suggestion (`app.js` 5069, 5081). | Presence check, not trust quality. Rename accordingly; primary supporting check. |
| Provenance chips | Constant “Source: Current Canvas,” “Analysis type: Deterministic diagnostic,” plus dirty-state disclosure (`app.js` 5607-5609). | Directionally correct. “Deterministic” does not mean factual; needs analyzed-at, Board, methodology, and inferred subtyping. |
| Issues/none | CTA warnings+suggestions; raw ICP variants; tone warnings; trust suggestions (`app.js` 5594-5597). | Advisory language is embedded in structured evidence. Actionable but not prioritized or mapped to nodes. |

**Not currently displayed.** `analyzeCampaign` also returns funnel `confidence`, platform `summary`, `strengths`, `weaknesses`, and generic `suggestions`; these are memory-only and can be consumed elsewhere (`app.js` 5075-5085). V3 returns validation issues, optimization issues, structural/strategic/overall scores, strategic dimensions and social findings, but current Insights does **not** render or capture them. Thus there are currently no visible validation/optimization issue counts, V3 structural/strategic scores, or social diagnostic findings (`app.js` 10380-11420). This distinction prevents mistakenly inventorying generation diagnostics as shipped Insights cards.

## 3. Diagnostic calculation paths

### 3.1 Current Insights path

`state.nodes/state.edges` → `analyzeCampaign()` role and field scans → scalar/object result → `captureInsightsDiagnostic()` with lifecycle identity → `isValidInsightsDiagnostic()` shape/finite checks → `renderInsightsSurface()` cards (`app.js` 5051-5098, 5198-5211, 5538-5614).

No normalization beyond trim/lowercase/sets occurs in this path. Edges and Brand Core do not affect the result. Node roles use exact `type` strings. Title/body extraction, tokenization, Jaccard, generic/fallback/label-only tests, length thresholds, V3 validation issues, strategic/social issues and V3 scores belong to the separate V3 generation-quality path below.

### 3.2 V3 quality/strategic path

**Confirmed path and formulas** (`app.js` approximately 10380-11420):

1. Generated/raw nodes pass structural normalizers: `normalizeCampaignV3AIEmailNodes`, `normalizeCampaignV3AILandingNodes`, overcount removal, and fallback-node normalization/builders. `campaignV3QualityNormalized()` collapses whitespace and lowercases comparison text (around 10950).
2. Role-sensitive body extractors include `campaignV3EmailBodyText`, `campaignV3LandingBodyText`, and `campaignV3StrategicTextForNode`. Required-title/body validation is performed in `evaluateCampaignV3Quality()`.
3. `campaignV3StrategicNormalize()` normalizes case/punctuation; `campaignV3StrategicTokens()` removes a bounded stopword set and deduplicates; `campaignV3StrategicJaccardSimilarity()` computes intersection/union (around 11040-11095).
4. `campaignV3StrategicLooksLikeGenericTitle()` uses type-aware generic-title patterns; `campaignV3StrategicKnownFallbackMatches()` tests known fallback phrases; `campaignV3StrategicLooksLabelOnly()` recognizes bodies made only of labels; `campaignV3StrategicBodyTooShort()` applies role/context-dependent length thresholds (around 11096-11150).
5. `evaluateCampaignV3Quality()` accumulates `validationIssues` with code, level, field, node identity and message. Structural score is reduced by bounded issue weights. `evaluateCampaignV3StrategicDiagnostics()` accumulates `optimizationIssues`; penalties produce dimensions including specificity, differentiation, and audience fit, and `strategicScore = max(0,100-min(30,totalOptimizationWeight))` (around 11227-11335).
6. `addCampaignV3StrategicSocialDiagnostics()` selects normalized platform and adds platform-specific issues using paragraph count, LinkedIn takeaway, TikTok hook, Instagram visual context, CTA/hashtag/body rules (around 11151-11226).
7. The quality result combines structural and strategic results into the generator’s overall score/report (around 11350-11420). These results are used during campaign generation/quality reporting, not the current Insights renderer.

| Classification | Recommendation |
|---|---|
| Reliable primary | Exact node/platform counts; explicit-field presence; validation issue counts/codes; exact affected-node mapping; explicit funnel-stage values. |
| Approximate heuristic | Role-inferred stages, readiness, CTA uniqueness, ICP/tone cardinality, trust presence, text-length/generic/fallback/label-only and social conventions, Jaccard duplication, strategic dimensions. Label method and limitations. |
| Group | Structure (required roles/fields), funnel/channel coverage, strategic consistency, content-quality heuristics, social-platform heuristics. |
| Potential AI Review duplication | Generic title, short/label-only body, social copy quality, specificity, CTA/content improvements. Insights should aggregate codes/counts; AI Review retains prose/rewrite per selected node. |
| Keep internal | Raw penalty weights, fallback phrase lists, arbitrary base/threshold math unless shown in methodology; generator normalization mutations must never be run by viewing Insights. |
| Simulator seeds | Explicit funnel stages, platform/channel, objective/goal, node/content volume and ICP/audience; diagnostic scores are not performance priors. |

## 4. Measured-performance infrastructure findings

**Confirmed.** Repository-wide code search found no measured-performance domain model, analytics table/migration, normalized metric record, reporting endpoint, provider interface, connector authorization/token store, campaign mapping, CSV/manual import, reporting-period state, or metric timestamp used by Insights. No reach, impressions, spend, clicks, engagement, conversion, revenue, CAC/CPL/CPA/ROAS/CTR/CPC/CPM or attribution value is rendered. Relevant terms elsewhere are campaign copy/fields, dashboard truthfulness copy, or conceptual diagnostics—not analytics infrastructure (`app.js` 5603-5606; `index.html` 504; `api/` and storage migrations).

**Confirmed conceptual placeholders:** the static empty state names verified sources and future metrics; dashboard copy says deployment status appears only when data exists. These are product copy, not abstractions. **No mock data exists in Insights.** Therefore Measured Performance is an honest empty UI only.

## 5. Shared provenance contract

**Recommendation:** require one normalized metadata object per visible value/finding:

```text
{ classification, sourceId, sourceLabel, sourceType, boardId, campaignId?,
  periodStart?, periodEnd?, analyzedAt|updatedAt?, canvasState?, canvasRevision?,
  confidence?, methodologyId, methodologyLabel, assumptions?, qualityStatus? }
```

`classification` is exactly `measured | deterministic_diagnostic | inferred | simulated | user_entered | unavailable`. `canvasState` is `live_unsaved | loaded_saved | not_applicable`. Confidence is allowed only as **data/method confidence** with a definition; never expose model reasoning. Measured values require source account, campaign mapping, period, source-update/import timestamps, currency where relevant, attribution and quality. Inferred values require rule/method. Simulated values require scenario ID and visible assumptions.

| Classification | English label | German label |
|---|---|---|
| measured | Measured | Gemessen |
| deterministic diagnostic | Deterministic diagnostic | Deterministische Diagnose |
| inferred | Inferred from Canvas | Aus dem Canvas abgeleitet |
| simulated | Simulation | Simulation |
| user entered | User-entered | Manuell eingegeben |
| unavailable | Unavailable | Nicht verfügbar |
| source | Source | Quelle |
| current live Canvas | Current Canvas (live) | Aktueller Canvas (live) |
| unsaved | Includes unsaved changes | Enthält ungespeicherte Änderungen |
| saved | Loaded saved Canvas | Geladener gespeicherter Canvas |
| reporting period | Reporting period | Berichtszeitraum |
| last updated | Last updated | Zuletzt aktualisiert |
| methodology | Methodology | Methodik |
| assumptions | Assumptions | Annahmen |
| method confidence | Method confidence | Methodensicherheit |

## 6. AI Brain boundary

**Confirmed overlap:** Insights issue strings include suggested actions (“Add CTA variations…”, “Add trust-building proof…”). Brain’s empty state explicitly offers to explain Canvas diagnostics. Brain gets authorized Board ID, live bounded Canvas projection, selected node, response language, and bounded successful history; `/api/ai-brain/advice` validates Board/context and derives diagnostics separately (`app.js` 5078-5085, 5364-5448; `api/ai-brain/advice.js`; `api/_ai-brain-diagnostics.js`). No “Ask AI Brain” insight handoff exists.

**Recommendation boundary:** Insights states evidence, gaps, scope, source and classification. AI Brain explains relevance, options and improvement strategy. A handoff button should:

1. Capture an immutable, bounded descriptor `{findingId, code, label, evidence, affectedNodeIds, provenance, boardId, canvasIdentity}` from current authorized state—never raw hidden reasoning.
2. Navigate to AI Brain and prefill a localized question plus visible context preview. Do **not** send on navigation.
3. On explicit Send, create exactly one normal user turn so history truthfully records the handoff; reuse existing `submitAiBrainQuestion()` lifecycle rather than injecting an assistant/system transcript entry.
4. Re-resolve Board/account/access/Canvas identity at send time. If changed, reject or rebuild context visibly. Preserve existing selected-node authorization and bounded projection.

## 7. AI Review boundary

**Confirmed:** AI Review is one-node, provider-backed evaluation. `reviewNodeWithAI()` calls `fetchNodeReview()`/`/api/review-node`, then `addAiReviewPostitToNode()` persists score, summary, strengths, improvements and optional rewrite as a node post-it. Applying a suggested fix is a controlled mutation (`app.js` 13880-14240, 15133-15165; `api/review-node.js`). Board diagnostics are deterministic aggregate heuristics with different 0-100 formulas; AI Review commonly reports `/10`. They are not shared scores and can contradict because scope/method differ.

**Recommendation rules:** Insights summarizes Board-level patterns/codes and shows calculation scope; it may list/link affected nodes but must not reproduce full AI Review prose or rewrite. AI Review stays selected-node only; its score is never performance. “Open AI Review” is separate from “Show on Canvas” and may initiate a provider call only after deliberate user action. Existing `selectNodeForAiWorkspace()` and Canvas helpers `focusNodeInCanvas()`/`forceNodeVisible()` are reusable foundations (`app.js` 13984-13992, approximately 12600-12850, 16180-16195).

## 8. Future Funnel Simulator boundary

**Recommendation:** classify every scenario output **simulated**, assumption-based, scenario-specific, never measured and never a deterministic Canvas diagnosis. Safe future seeds: explicit ICP/audience, channel/platform, campaign type, funnel stage, objective/goal and content volume. Geography, price/AOV, benchmarks and any historical results are unavailable unless separately user-entered or verified. Never seed conversion assumptions from diagnostic scores.

Place the Simulator as a **separate navigation destination/module linked from Insights**, not a Measured Performance tab. The current `activeView`/sidebar pattern supports a distinct destination; this preserves a strong semantic boundary. **Unresolved:** final navigation label and scenario persistence ownership belong to a later Simulator audit. No Simulator UI/schema/calculation is in BW-28.

## 9. Recommended information architecture and smallest V1

Use stacked sections and anchored in-page navigation, not a hidden tab set: it matches `.insights-boundary` and is safest for mobile, keyboard access, honest empty data, and inspector coexistence.

1. **Overview:** data-status sentence; Canvas diagnostic scope/state; three to five top findings; no “campaign health” unless explicitly “Canvas diagnostic summary.”
2. **Measured Performance:** one useful empty panel; no empty metric grid.
3. **Canvas Diagnostics:** grouped readiness/scope, structure, funnel, strategy/content, channel/platform, CTA/trust; each number gets provenance and methodology disclosure.
4. **Opportunities:** deterministic severity/reason/affected nodes; “Show on Canvas” and optional “Ask AI Brain”; no repair/edit/generation.
5. **Data and Methodology:** collapsible definitions, analysis time, Canvas state, limitations and future-data roadmap.

### Measured Performance empty-state copy

**English:**

> **No measured analytics connected**  
> Funklix is not currently reporting real reach, engagement, conversions, or revenue for this campaign. Canvas diagnostics are still available, so you can improve campaign structure and content coverage now. When a verified data source is connected in a future release, measured performance will appear here with its source and reporting period.  
> **Future capability:** Data connections and report import are not available yet.

**German:**

> **Keine gemessenen Analysedaten verbunden**  
> Funklix berichtet für diese Kampagne derzeit keine realen Werte zu Reichweite, Interaktionen, Conversions oder Umsatz. Canvas-Diagnosen sind weiterhin verfügbar, sodass du Kampagnenstruktur und Inhaltsabdeckung jetzt verbessern kannst. Sobald in einer zukünftigen Version eine verifizierte Datenquelle verbunden ist, erscheint die gemessene Performance hier mit Quelle und Berichtszeitraum.  
> **Zukünftige Funktion:** Datenverbindungen und Berichtsimport sind noch nicht verfügbar.

Do not render “Connect data source,” “Import report,” or “Add metrics manually” as buttons in BW-28. Use roadmap copy; optionally link only to an existing, factual help document. A disabled control still implies designed functionality and keyboard/accessibility burden.

## 10. Deterministic prioritization

**Recommendation:** normalize existing issues to `{code, category, severityRank, affectedNodeIds, occurrenceCount, scope, ruleOrder}`. Rank by: (1) validation severity `error > warning > opportunity`; (2) required campaign-stage/structural gap before text heuristic; (3) affected-node count descending; (4) existing bounded issue weight/strategic dimension impact descending where defined; (5) stable category order; (6) code lexical order; (7) lowest node ID. Deduplicate identical codes, cap affected IDs displayed, and show three findings (maximum five).

Explain each rank as “Required structure missing,” “Affects N nodes,” or “Repeated diagnostic rule.” Do not claim revenue/business impact, invent percentages, use model ranking, or let selected-node order change rank. Campaign objective/status may be used only where an existing explicit deterministic rule defines relevance; otherwise defer.

## 11. Action model

| Action | Classification | Guardrails |
|---|---|---|
| Navigate within Insights/methodology | Already available pattern / small implementation | Anchor only; no state mutation. |
| Select node | Safely reusable | Reuse selection helpers; no `markDirty`/save. |
| Show/reveal node on Canvas | Safely reusable with small adapter | `setActiveView("board")`, select, then `focusNodeInCanvas`/`forceNodeVisible`; verify node still belongs to authorized live Board. |
| Open inspector | Safely reusable | Selection opens/fills current inspector; focus must be managed. |
| Open AI Review | Requires small implementation; provider side effect | Navigate/select only by default; user explicitly starts review. Do not auto-call API. |
| Ask AI Brain | Requires small implementation | Deliberate prefill + Send; one turn; identity/authorization revalidation. |
| Filter affected nodes | Requires implementation | Useful later; keep local/view-only and bounded. |
| Repair/regenerate/create/apply/edit/status/owner/Brand Core | High risk; defer | These mutate, mark dirty and/or save. Never couple to Insights navigation. |

Tests must prove no Insights action calls `saveCampaignCanvasState`, autosave, generation, repair, review application, or Brand Core mutation.

## 12. Saved/unsaved Canvas behavior and refresh lifecycle

**Confirmed:** current cards use one live snapshot from `state.nodes`; all share the same source. Dirty disclosure is accurate at capture time, but is evaluated at render time rather than stored with snapshot. Therefore a snapshot can theoretically be paired with a later dirty flag if state changes without recalculation (**Inferred**). Opening Insights recalculates. Language rerender deliberately reuses it. No analysis timestamp/history exists (`app.js` 5198-5208, 5538-5612; `scripts/check-bw25-1-dynamic-insights-translations.js` 64-67).

**Recommendation authoritative model:** analyze the **live loaded Canvas**, including unsaved changes. Capture atomically `{board/account/access generation, canvasFingerprint/revision, isDirtyAtAnalysis, analyzedAt, analysis}`. Recalculate once on: authorized Board hydration completion; opening Insights when fingerprint differs; a debounced/bounded live Canvas revision while Insights is visible; save completion only if revision/source label changes; generation/repair/AI Review mutation through the same Canvas revision event. Language/theme changes render only. Board/account/access invalidation clears immediately before rendering loading/unavailable state.

For empty and large Boards, run the same bounded pure analyzer: empty safely returns unavailable diagnostics; cap finding lists/affected-node rendering while counts remain exact. Avoid duplicate analysis from `renderCampaignIntelligence()` rendering both destinations. No request race currently exists because analysis is synchronous, but future async work must carry identity+revision and discard stale completion. Viewing/navigation must not affect autosave.

## 13. Historical-data findings

**Confirmed:** there are no timestamped Insights snapshots or measured records. `insightsDiagnosticSnapshot` is one in-memory latest result without timestamp. Do not draw trends. Diagnostic trends require explicit Board-scoped snapshot persistence, schema/versioned methodology, Canvas revision, timestamp and retention policy in a future package. Measured trends require verified periodized facts. Both are deferred (`app.js` 154, 5542-5548).

## 14. Future analytics integration readiness

Start later with **manual CSV report import** for one well-defined provider/export format, because it can establish mapping, validation, provenance and normalized metrics without OAuth/token custody. Then choose one paid-media connector based on customer demand; do not launch Meta, Google, LinkedIn, TikTok, GA4, HubSpot and Shopify together.

Use a server-side connector interface (`authorize`, `accounts`, `campaigns`, `sync`, `revoke`, `freshness`) plus encrypted credentials outside Board JSON. Map external campaign ID to Board/campaign explicitly; store source/account identity, period and currency; upsert with provider+account+campaign+period+metric uniqueness; record attribution limitations and quality/errors. Never send provider tokens to browser or logs. States: disconnected, connecting, syncing, current, stale, partial, mapping-required, authorization-expired, failed.

## 15. Minimal future measured metric schema

| Field | Rule |
|---|---|
| identity | `id`, `source_provider`, `source_type`, `source_account_id/name`, `external_campaign_id/name`, `funklix_board_id`, optional internal campaign mapping |
| period | `period_start`, `period_end`, timezone/granularity |
| money | ISO `currency`, nullable `spend`, nullable `revenue` |
| base metrics | nullable `impressions`, `reach`, `clicks`, `engagements`, `conversions`; nonnegative; preserve unavailable as null |
| conversion | required `conversion_definition` when conversions present; optional customer-acquisition definition for CAC |
| provenance | `attribution_model/window`, `imported_at`, `source_updated_at`, `quality_status`, connector/import version, raw-row fingerprint/dedup key |

Derived only when operands are present and denominator > 0: `CTR=clicks/impressions`, `CPC=spend/clicks`, `CPM=spend/impressions×1000`, `conversion rate=conversions/clicks` (definition must be explicit), `CPA=spend/conversions`, `ROAS=revenue/spend`, `engagement rate=engagements/defined denominator`, and `CAC=spend/new customers` only when “new customer” is verified. Zero is a reported zero; null is unknown/unavailable. Never coerce null to zero. For denominator zero, result is unavailable (not 0 or infinity). Mixed currencies/attribution/periods may not be silently aggregated.

## 16. Truthfulness and terminology

| Use | English | German | Rule |
|---|---|---|---|
| page | AI Insights | KI-Einblicke | Umbrella only; do not imply all content is AI-generated. |
| observed data | Measured Performance | Gemessene Performance | Only verified records. |
| current score | Canvas readiness / Board-level diagnostic score | Canvas-Bereitschaft / Diagnosewert auf Board-Ebene | Never “performance score” or bare “health.” |
| evidence | Canvas Diagnostics | Canvas-Diagnosen | State scope and current/saved source. |
| inferred | Inferred from Canvas rules | Aus Canvas-Regeln abgeleitet | Use for stage/role inference. |
| future scenario | Simulation / Simulated scenario | Simulation / Simuliertes Szenario | Always show assumptions; never “prediction.” |
| benchmark | User-entered benchmark / Verified benchmark source | Manuell eingegebener Benchmark / Verifizierte Benchmark-Quelle | Name source/date/segment. |
| optimization | Improvement opportunity | Verbesserungspotenzial | “Optimized” only after a defined completed process; never business outcome. |
| confidence | Data quality / Method confidence | Datenqualität / Methodensicherheit | No hidden model reasoning. |
| unavailable | No measured analytics connected | Keine gemessenen Analysedaten verbunden | Show unavailable, not zeros. |

“Conversion,” “ROI/ROAS,” “CAC,” “predicted,” and “performance” require definitions/source/period. Prefer “Based on current Canvas structure / Basierend auf der aktuellen Canvas-Struktur.”

## 17. Visual hierarchy, responsive behavior and accessibility

### Visual/design-system

**Confirmed:** Insights already uses established cards/panels/chips, responsive grid, tokenized Dark Mode overrides, and shared maximum width. It has two `h3` section headings below page `h2`, but card labels are `small` and card scores use `h3/h4`; statuses are textual as well as colored. There are no controls, charts, live status announcements, focus targets or affected-node links (`index.html` 579-581; `styles.css` 2557-2580, 7363-7376).

**Recommendation:** retain the BW-27 surface ladder: app background → page/panel → card → chip/status. Replace literal local colors opportunistically only within BW-28 styling with existing tokens; do not create an analytics palette. Reserve chart containers only when real data exists; future charts require adjacent data tables.

### Responsive

* Desktop/laptop: 12-column or auto-fit diagnostic cards, top findings at comfortable reading width; inspector coexistence must not cause horizontal page overflow.
* Tablet/mobile: stack sections/cards; avoid semantic content hidden behind horizontal tabs. If anchors become a scroll row, use visible focus and no trapped overflow.
* Actions stack below copy at narrow widths; touch targets meet 44×44 CSS pixels. Chips wrap; long German strings may wrap without truncating classification.
* Affected nodes: show bounded first items and “N more”; never render hundreds of chips. Methodology uses native `<details>` and remains keyboard accessible.
* Future populated data: metric grid collapses 4→2→1; tables scroll in a labeled region, while empty state remains a single panel.

### Accessibility requirements

1. Preserve one `h1`/page-title convention and ordered `h2` sections/`h3` cards; do not use heading levels for visual score size.
2. Every metric has a programmatic label, value, unit, scope and visually available provenance; screen-reader text must announce “diagnostic,” not merely `73/100`.
3. Loading/error/access state uses appropriate `role="status"`/`aria-live="polite"` only for changes, without noisy rerenders. Never encode severity only by color/icon.
4. Use real buttons/links, keyboard focus, visible `:focus-visible`, deterministic focus after Show on Canvas, and a return path. Affected-node controls include node title/type and action purpose.
5. Empty state contains no disabled phantom actions. Respect `prefers-reduced-motion`; smooth reveal must fall back to instant. Methodology `<summary>` has a useful label/state.
6. Future charts need text summary and accessible table; provenance must be associated with each metric (`aria-describedby` or grouped description).

## 18. Existing test inventory

| Test | Proves | Does not prove / BW-28 impact |
|---|---|---|
| `scripts/check-bw25-honest-ai-insights-baseline.js` | DOM IDs, measured/diagnostic separation/order, no fake metrics/connectors/actions, deterministic formulas, dirty disclosure, identity/access guards, no protected Brand leakage/write trigger, Brain separation, language workflow. | Mostly source-string assertions; no browser semantics, XSS, computed accessibility/responsive behavior. Structural renderer assertions must be intentionally superseded while semantic guarantees remain. |
| `scripts/check-bw25-1-dynamic-insights-translations.js` | Closed system message translation, raw Canvas audience/platform preservation, card order, cached language rerender/no recalculation. | No visual truncation or screen-reader test. Update for new EN/DE terminology and provenance while preserving authored content. |
| BW-26 checks (`check-bw26-read-only-ai-brain.js`, BW-26.1 through BW-26.6.2) | Read-only conversation, real bounded Canvas/history, formatting, reference resolution/language, controlled proposal and stale/failure/UI transition safety. | No Insights handoff. BW-28 must not weaken request identity, add duplicate turn, or bypass controlled proposal. |
| `scripts/check-bw27*.js` through `check-bw27-4-canvas-component-polish.js` | tokens, Light/Dark surface coverage/contrast fixtures, focus/reduced motion, responsive selectors, Canvas component behavior and persisted state fixtures. | Static checks are not visual contrast/layout tests. New selectors must use established hierarchy and keep both themes. |
| `scripts/check-browser-script-integrity.js` | browser script registration/load/reference invariants and Runtime Boot Safety expectations. | Not product behavior; future BW-28 check must be registered. |
| Board/access tests: BW-10/11/13/18/19 and workspace-shell checks | Brand-scoped Board lifecycle, access roles, public sharing, navigation IDs. | No Insights runtime switching; add explicit Board/account/access/public cases. |
| AI Review/API-related tests and current review code | Node-level route/format/mutation flows remain distinct. | No contradiction/duplication assertion; BW-28 should assert Insights only summarizes diagnostics. |
| Autosave/read-only persistence checks across existing suite | Guards and dirty/save behavior remain intact. | No action-level Insights assertion today; add spies/source guards for no dirty/autosave. |

## 19. Future `scripts/check-bw28-ai-insights-architecture.js` specification

The combined check must register with Runtime Boot Safety and run the following numbered cases (source-contract checks plus a DOM/runtime harness where interactions matter):

1. Measured Performance and Canvas Diagnostics are separate.
2. No connection renders an honest empty state.
3. Empty state has no fake zeros.
4. No fake reach, engagement, conversions, revenue, CAC, or ROAS.
5. Diagnostic values say diagnostic.
6. Every visible value has provenance classification.
7. Current Canvas source is accurate.
8. Unsaved source is accurate.
9. Readiness is not performance.
10. Score scope is exposed.
11. Funnel coverage is deterministic.
12. Platform counts match Canvas nodes.
13. Top ordering is deterministic.
14. Severity rationale is visible.
15. Affected-node counts are exact.
16. Show on Canvas selects correct node.
17. Show does not mutate it.
18. Ask Brain is deliberate contextual handoff.
19. Brain owns advice.
20. Handoff preserves Board/Canvas authorization.
21. Handoff creates no duplicate transcript turn.
22. Insights does not reproduce complete Review.
23. Review remains node-specific.
24. Simulator is not measured.
25. No simulation is implemented.
26. No integration appears connected.
27. No inactive action implies a connector.
28. Board switch clears/refreshes.
29. Account switch refreshes.
30. Access loss invalidates.
31. Public Viewer follows defined read-only behavior.
32. Empty Board is safe.
33. Large Board output is bounded.
34. Refresh lifecycle is deterministic.
35. Navigation does not mark dirty.
36. No action triggers autosave.
37. No action creates/edits nodes.
38. No action invokes repair.
39. No action invokes generation.
40. No action changes Brand Core.
41. English terminology complete.
42. German terminology complete.
43. Light Mode compatible.
44. Dark Mode compatible.
45. Responsive structure bounded.
46. BW-25 semantically compatible or intentionally superseded.
47. BW-26 through 26.6.2 compatible.
48. BW-27 through 27.4 compatible.
49. Browser script integrity intact.
50. Runtime Boot Safety registration present.

Interaction cases 16-21 and 28-40 must snapshot nodes/edges/Brand Core/dirty/save counters before and after; string absence alone is insufficient.

## 20. File-by-file blast radius for the future implementation

| File | Expected change | Primary risk |
|---|---|---|
| `app.js` (state 59-162; analysis 5051-5211; Brain 5213-5536; Insights 5538-5614; selection 13984; view/nav 16212-16255, 17183) | Provenance/normalized findings, renderer, lifecycle and safe action adapters/handoff. | Monolith coupling; stale Board/account context; unsafe `innerHTML`; accidental dirty/save/duplicate Brain turn. Avoid broad refactor. |
| `index.html` (241, 579-581) | Minimal semantic page/anchor structure if renderer does not own it. | Breaking legacy IDs/navigation and boot assertions. |
| `language.js` (1-45) | Complete exact EN keys/German values. | translating authored content or missing long German states. |
| `styles.css` (2557-2580, 7059-7084, 7363-7376) | Established surface hierarchy, actions, mobile/a11y and both themes. | divergent analytics visual language; overflow/contrast regressions. |
| `api/_ai-brain-diagnostics.js`, `api/ai-brain/advice.js` | Ideally no behavior change; verify handoff fits existing authorized request. | duplicated diagnostic truth or expanded payload/authority. Change only if proven necessary. |
| AI Review path (`api/review-node.js`; `app.js` 13880-14240, 15133-15165) | No calculation change; optional navigate-only adapter. | auto-triggering provider or mutation/persistence. |
| `scripts/check-bw28-ai-insights-architecture.js`, workflow/package registration | New 50-case regression and boot registration. | brittle string-only checks or failure to exercise side-effect safety. |
| Existing BW-25/BW-26/BW-27 scripts | Update only intentionally superseded structural assertions. | masking semantic regression to make tests pass. |

**Main blast-radius risks:** `app.js`’s shared `renderCampaignIntelligence()` couples Insights and Brain; snapshot source metadata is not atomic; Canvas-authored strings currently enter `innerHTML`; selection/reveal helpers coexist with mutation/save flows; account/Board/access/public lifecycle is security-sensitive; German copy and responsive action rows can overflow; changing legacy IDs/order breaks BW-25; styling can regress both themes; a handoff can duplicate history or bypass Brain authorization.

## 21. Combined implementation scope and stages

One PR is feasible and should contain only: new stacked Insights IA; honest measured empty state; grouped current diagnostics; atomic provenance; deterministic top findings/affected-node mapping; navigate-only Show on Canvas; deliberate Ask AI Brain handoff; methodology; EN/DE copy; Light/Dark/responsive/a11y styling; and BW-28 regression coverage.

Internal stages:

1. Terminology, provenance model, diagnostic normalization (no formula changes).
2. Information architecture and rendering.
3. Top findings and affected-node mapping.
4. Show on Canvas and Ask AI Brain handoffs.
5. Responsive, accessibility, translations and design-system alignment.
6. Regression coverage and full final validation.

## 22. Deferred scope

Real connectors; manual CSV/manual metric entry; analytics database/schema/endpoints; provider authorization/token handling; historical diagnostic or measured trend storage; charts; Funnel Simulator/scenario persistence; benchmark service; predictive performance; automated ranking by a model; automatic Canvas edits/repair/regeneration/node creation/status/ownership changes; automated application of optimization or AI Review; any change to AI Brain, Canvas diagnostic formulas, Board persistence, or broad `app.js` refactor.

## 23. Open questions

1. **Unresolved:** should Public Viewers see all Board-level diagnostics and affected-node titles, or only the current aggregate set? Default recommendation: same authorized Canvas evidence, read-only, no Brain/review actions.
2. **Unresolved:** is “Canvas readiness” retained with full formula disclosure, or renamed “Canvas diagnostic summary”? Product should approve before implementation.
3. **Unresolved:** which explicit V3 diagnostic codes are stable public contracts versus generator internals? Freeze a V1 allowlist before exposing them.
4. **Unresolved:** should Ask AI Brain prefill only or offer a second explicit Send? Recommendation: prefill plus Send for deliberate transcript authorship.
5. **Unresolved:** what is the canonical Canvas revision/fingerprint already available to avoid expensive full serialization on large Boards?

## 24. Implementation go/no-go criteria

**Go only when:** (a) terminology/provenance schema and V3 public-code allowlist are approved; (b) live Canvas including unsaved edits is accepted as authoritative; (c) Public Viewer action policy is explicit; (d) top-finding ordering is fixture-tested; (e) all actions are proven non-mutating; (f) Brain handoff produces exactly one authorized user turn; (g) empty analytics has no metrics/actions implying availability; (h) lifecycle invalidates on Board/account/access/revision; (i) EN/DE, theme, mobile and accessibility contracts are complete; and (j) all BW-25 through BW-27.4 guarantees pass or are explicitly superseded.

**No-go:** any implementation labels diagnostics as performance, renders zeros for unavailable data, exposes simulation, fabricates impact, mixes saved/live sources without disclosure, auto-starts AI Review/Brain/provider work, mutates Canvas, or requires analytics/Simulator scope to make V1 useful.

## Final recommendation

Proceed with the single staged BW-28 implementation described above. The repository already has an honest boundary, deterministic inputs, lifecycle identity, bilingual copy pattern, reusable selection/reveal behavior, and design-system surfaces. The safest value is not an empty analytics dashboard: it is a trustworthy evidence page that clearly distinguishes unavailable measured performance from current live-Canvas diagnostics, prioritizes a bounded set of explainable findings, and hands intentional advice requests to AI Brain without changing the Board. Preserve AI Review as node-specific and reserve a visibly separate, simulated future module for Funnel scenarios.
