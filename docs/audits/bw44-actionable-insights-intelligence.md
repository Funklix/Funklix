# BW-44.0 — Actionable Insights and Canvas Intelligence audit

## 1. Executive summary and decision

**Audit and architecture decision only. No application changes are included.**

Repository: Funklix/Funklix. Audited main: `373ddbe88af4819f90126b92064371fa919881a7`, the merge of PR #850. The repository was public when checked. BW-43's approved dashboard, calculations, classifications, source ownership, permissions, Canvas persistence and Brain workflow are the baseline, not redesign candidates.

**Recommend Option A for intelligence presentation:** enrich `renderInsightsSurface` with bounded, localized explanations and exact existing source fields. Keep any small formatting helpers inside the existing client module; do not create another analysis result schema, scoring engine, persistent interpretation store or model pipeline. Most of the value is already available: ranked findings, exact affected IDs, missing stages, label values, field-presence checks and an explicit editable Brain handoff.

**A separate, necessary navigation boundary must be approved with BW-44.1 if server-checked node links are required.** Current Insights findings do not contain BW-40 `scopeRevision` metadata. Their existing Show on Canvas action checks local freshness and selects the first affected ID; it does not call the BW-40 resolver. Merely styling those IDs as BW-40 cards would overstate authorization. The minimal complete proposal is Option A plus a narrowly bounded, deterministic entry into the existing BW-40 resolver, described in §8. This is a read-only authorization extension, not an intelligence layer or inference pipeline. Option B does not remove this requirement.

Highest-value existing functionality:

- One provider-free analysis/snapshot path shared with Home and Insights.
- Ranked opportunities with category, severity, supporting values and exact affected IDs.
- Existing Show on Canvas, native selection/Inspector ownership, and an editable Ask AI Brain handoff that does not submit.
- BW-40/BW-40.1's independently authorized exact-ID references and safe positional-history invalidation in Brain.
- Honest separation of structural diagnostics from measured results.

Actual intelligence gaps are evidence presentation, metric-specific explanations, applicability qualification and verified reference issuance for deterministic Insights. Strategic fit, copy quality, truth of proof and business impact are genuinely not established by these calculations. There is no demonstrated need for another model call.

Expected user benefit: understand the condition, review the actual field/node, choose a practical review task, and refresh to verify a structural change. No conversion uplift or strategic correctness is promised.

## 2. Audit basis and verified sources

Code was inspected, rather than treating the BW-43 inventory as proof. Source anchors below refer to the audited commit; function names remain the primary anchors because lines will move.

| Source | Verified responsibility |
| --- | --- |
| `app.js:6185`, `analyzeCampaign` | Actual deterministic formulas and raw analysis fields |
| `app.js:6350`, `calculateInsightsDiagnostic` | Shared calculation, exception isolation; no provider/write |
| `app.js:7898` onward, `currentInsightsIdentity`, `currentInsightsCanvasIdentity`, `captureInsightsDiagnostic` | Runtime snapshot identity, field fingerprint, saved/live label and timestamp |
| `app.js`, `homeInsightsContext`, `ensureHomeInsightsDiagnostic`, `homeCampaignInsights` | Authorized deferred Home demand, applicability filtering and duplicate-ID protection specific to Home |
| `app.js:8079`, `normalizeInsightsProvenance` | Available provenance utility; not attached to every finding or score |
| `app.js:8085`, `buildInsightsFindings` | Finding generation, evidence bounds, IDs and comparator |
| `app.js:8103` onward, `isCurrentInsightsSnapshot`, `showInsightsFindingOnCanvas`, `askAiBrainAboutFinding` | Existing local action guards and editable handoff |
| `app.js:8131`, `renderInsightsSurface`, `isValidInsightsDiagnostic` | Actual dashboard, disclosures, statuses and unavailable states |
| `app.js`, `validateAiBrainNodeReferences`, `openAiBrainNodeReference`, `captureAiBrainEvidenceOrigin`, `aiBrainEvidenceOriginCurrent` | Brain reference metadata validation, async authorization and local-origin lifecycle |
| `app.js`, `focusNodeInCanvas`, `revealAiBrainEvidenceNode` | Exact-ID DOM lookup, native selection/Inspector, visibility and focus |
| `api/_ai-brain-node-references.js` | `mapping`, `resolve`, `referenceRevision`; saved ID/type matching and destination-bound digest |
| `api/ai-brain/node-reference.js` | Existing strict three-field POST, twice-checked authorization and no source-copy response |
| `api/_ai-brain-proposal-scope.js` | `capture`, `assertActor`, `assertExpected`, `publicScope`, `revision`; verified identity, Board edit, Workspace and association lifecycle |
| `api/_ai-brain-goal-context.js` | Saved/working separation; timestamp normalization and raw saved revision in authorized scope |
| `api/ai-brain/advice.js`, `api/_ai-brain-canvas-context.js` | Explicit existing inference workflow and allowlisted Canvas projection |
| `api/boards/[id].js`, `api/_board-access.js`, `api/_board-serializer.js` | Existing Board read/visibility rules; GET can refresh editor identity, so it is not a zero-write reference-validation substitute |
| `language.js`, `styles.css`, `ai-brain-node-references.css`, `index.html` | Closed EN/DE system vocabulary, text-safe authored values, scoped themes, native details and IDs |
| `docs/implementations/bw43-insights-inventory.md`, `bw43-ai-insights-redesign.md` | Approved dashboard inventory/design and previously recorded limitations |
| `docs/implementations/bw40-simple-canvas-node-references.md`, `bw40-1-stable-references-prompt-shortcuts.md` | Exact node identity, resolver and historical-label contracts |
| `docs/audits/2026-08-31-bw28-ai-insights-analytics-architecture-audit.md` and BW-28 checks | Existing diagnostics/performance separation and regression contracts |

The environment checkout originally preceded #850. Git fetch failed at the environment proxy. The connected GitHub API verified current main and supplied its complete textual merge patches; these were applied only in an isolated audit worktree. The resulting `app.js` Git blob hash is `58eb499060c8b59716296105595499ae19e10412`, matching GitHub's file SHA at the audited commit. All textual #850 changes were available for inspection; historical PNGs were not needed to infer code behavior. Publication uses the GitHub connector and only the audit document.

### Verification performed

- PASS: `node scripts/check-bw25-honest-ai-insights-baseline.js`.
- PASS: `node scripts/check-bw25-1-dynamic-insights-translations.js`.
- PASS: `node scripts/check-bw28-ai-insights-architecture.js` (86 architecture contracts and script integrity).
- PASS: `node scripts/check-bw28-1-insights-ux-and-brain-handoff.js` (39 regression contracts and script integrity).
- PASS: `node scripts/check-bw28-3-premium-insights-and-brand-avatar.js`.
- PASS: `node scripts/check-bw28-3-1-insights-runtime-rendering.js` (46 production runtime contracts).
- PASS: `node scripts/check-bw40-node-references.js`, using its disposable local SQL fixture, signed fictional sessions and mocked provider. No paid inference or external production access.
- PASS: `node scripts/check-bw40-node-references-browser.js`, exercising production Advice/resolver and actual Canvas/Inspector navigation, EN/DE, Light/Dark, desktop/mobile, keyboard, exact IDs, stale/revoked/pending scopes, zero inference on click and zero writes.
- PASS: `node scripts/check-bw36-21b2-home-insights-brain.js`, all 30 groups including 20,000-node source parity, deferred snapshot ownership, scope changes, shared navigation, EN/DE, themes, responsive behavior, zero provider calls and zero writes.
- Additional scratch probes executed the actual extracted `analyzeCampaign` and `buildInsightsFindings` functions on seven fictional cases: Idea-only, one CTA, native social CTA only, partial Landing Page trust, same-platform social posts, noncanonical stage and case-only tone labels. Results are discussed below. These probes are audit evidence, not new committed tests.
- PASS: `node scripts/check-bw43-insights-browser.js`, 48 theme/language/sidebar/viewport combinations plus original scores, actions and provenance. The first restricted Chromium launch failed before application execution because local socket setup was prohibited; rerunning the unchanged fixture with the required execution permission succeeded.

This audit does not claim a fresh complete PostgreSQL CI matrix or real-world marketing validation. Prior BW-43 CI results belong to #850, not to new changes in this PR.

## 3. Complete existing data inventory

Legend: **E** existing; **P** partially available/bounded; **M** missing. “Snapshot” means the ephemeral `state.insightsDiagnosticSnapshot`, not database persistence. All source fields below are loaded authorized Canvas data or current working edits; field origin is not independent verification of their marketing meaning.

| Property / status | Generated by and snapshot availability | Display today | Provenance, node resolution and useful deterministic use |
| --- | --- | --- | --- |
| `healthScore` E | `analyzeCampaign`; `snapshot.analysis.healthScore` | Overview ring and Diagnostics | Weighted field/stage heuristic; explain contributions and limitations, not success |
| `funnel.coveredStages` E | Explicit stage plus type/goal/CTA rules in analyzer; in analysis | Summary, five Journey statuses, score, finding evidence | Inferred mapping; can derive supporting IDs from the same per-node predicates, but no stage-to-ID map is stored |
| `funnel.missingStages` E | Five canonical stages minus covered values; in analysis and gap finding | Count/status; specific missing values mainly in handoff | Reliable absence under current rules; no affected node exists merely because a stage is missing |
| `funnel.confidence` E | Covered-value count / five; in analysis | Funnel-stage score | Coverage ratio, not probabilistic confidence or content adequacy |
| `platformDistribution.counts` E | Social nodes' `social.platform`, fallback Unknown; in analysis | All positive finite channel counts and relative-to-largest bars | Counts per social node, no delivery/reach; source IDs can be recovered from exact social nodes |
| `platformDistribution.summary` E | Analyzer string; in analysis | Not separately rendered | Generic count summary; prefer localized templates over exposing canonical English prose |
| `cta.qualityScore` E | Distinct lowercase selected strings / selected nonempty strings; in analysis | CTA variation score | Name is stronger than semantics; neither CTA quality nor coverage |
| `cta.warnings` E | Missing all analyzer-selected CTA strings; in analysis | Not separately rendered | Does not equal per-eligible-node missing CTA; useful only with its exact predicate |
| `cta.suggestions` E | Fewer than two distinct analyzer CTA strings; in analysis | Via variation finding/handoff | Template recommendation, not proven need for more CTAs |
| `cta.values` M | Not produced by analyzer | No | Finding generator reads it; bounded currentValues therefore becomes empty. Do not invent it |
| `icp.consistencyScore`, `icp.inconsistencies` E | Distinct nonempty trimmed `audience` values; in analysis | Numeric diagnostic; variation finding title/description; values in handoff | Label equality/difference only; values and exact audience-node IDs can support a review task |
| `tone.consistencyScore`, `tone.warnings` E | Distinct nonempty trimmed `tone` values; in analysis | Diagnostic and finding; warning in handoff | Label diversity, not semantic tone analysis; raw distinct labels are recoverable from current nodes |
| `trust.score`, `trust.suggestions` E | Any Landing Page with nonempty trimmed trust; in analysis | Diagnostic and missing-proof finding | Presence anywhere, not percentage coverage or verified proof. Existing blank Landing Pages can be listed when the finding applies |
| `strengths` E/P | Analyzer templates; in analysis | No dedicated raw-strength list in current Insights | Not independently verified. “Multi-platform” currently means at least two social nodes, even on one platform; do not surface as fact |
| `weaknesses` E/P | Missing-stage string and audience-variation template; in analysis | No separate list; related findings are shown | Mostly duplicated conditions; not another opportunity queue |
| `suggestions` E/P | Two unconditional analyzer strings; in analysis | No separate list | Neither ranked nor tied to specific missing fields; do not imply individualized recommendations |
| Finding `code/title/description` E | `buildInsightsFindings`; `snapshot.findings` | All ranked cards | Stable code is internal identity, not ordinary UI copy; descriptions can overclaim (§4) |
| `severity/category/structuralRelevance/weight` E | Finding templates; in findings | Severity badge; remaining values not exposed | Existing comparator already determines importance. No numeric “AI confidence” |
| `affectedNodeIds` E/P | String IDs from finding's source nodes, sorted; in findings | Count, three title/type previews, Show action | Exact current IDs, but duplicate IDs are not rejected by this generator or Insights renderer. Require uniqueness; never resolve by title or ID suffix |
| Finding `nodes` P | Original source-node array remains through object spread | Not rendered | Some findings retain live node objects; freezing is shallow. Do not serialize these objects, mutate them or treat them as independent immutable evidence |
| `evidence` E/P | Template statements or audience/warning values; in findings | Mostly hidden; used in Brain draft | Bounded strings, not typed field/quote citations. Validate applicability; some templates assert a Landing Page when none exists |
| `currentValues` E/P | Funnel stages, audience labels, tone labels; CTA references absent `analysis.cta.values` | Mainly Brain draft | Up to eight trimmed unique values, each truncated; not a complete source inventory |
| `missingElements` E/P | Stage/CTA/trust templates; in findings | Mainly Brain draft | Useful review context; missing content is not a source node |
| Node `id/title/type/content` E | Current Canvas state; ID/title/type/content fingerprinted | Three affected title/type previews | Not copied into analysis except retained finding nodes; safe text rendering and exact unique IDs required. Content presence is not content judgment |
| `audience/tone/funnelStage/goal` E | Current Canvas fields; fingerprinted | Selected aggregate findings/diagnostics | User-entered or generated authored values; do not translate as system keys or treat as verified strategy |
| `landingPage.cta/trust`, `social.preview/cta/platform` E | Current Canvas fields; fingerprinted | Aggregate diagnostics, channel counts, affected previews | Available for exact field/value explanations without inference; predicates differ between analyzer and findings |
| Other message/proof fields, top-level `cta` and `channel` P | `content`, Landing Page claim/problem/solution, social caption and other current Canvas fields | Available through Canvas/Inspector and existing Brain projection | No deterministic semantic alignment, factual-proof validation or quoted provenance contract in this snapshot. Several fields are not in the Insights fingerprint; do not silently expand evidence scope |
| Brand context P | `state.brandCore` is passed to analyzer, but analyzer does not use it | No Brand-fit diagnostic | Existing Brain authorization/projection owns allowed context. Insights snapshot does not establish authorized canonical Brand access |
| Edges P | Passed to analyzer but unused | No edge-level diagnostic | No graph continuity, connected-path or edge-based strategic relevance analysis |
| Snapshot identity/source E/P | identity, canvasIdentity, canvasState, analyzedAt | Header/methodology, stale suppression | Account email, Board, load generation and view-reason plus selected-field fingerprint. Not BW-40 scope, saved raw revision or a server access check |
| Per-field evidence metadata M | No typed quote/field/source-state record on generic findings | No | Can explain current deterministic fields locally; must not label generic templates “verified source quotes” |
| Per-finding priority number M | Comparator produces ordering, no explicit priority field | First opportunity visually emphasized | Existing ordered array is sufficient |
| Outcome/effectiveness data M | No verified performance branch in this renderer | Honest disconnected disclosure | No conversion, revenue, uplift, attribution, experiment or before/after outcome inference |
| Generator quality diagnostics P, outside Insights | `evaluateCampaignV3Quality`, `evaluateCampaignV3StrategicDiagnostics`, `addCampaignV3StrategicSocialDiagnostics` produce validation/optimization issues, fields, heuristic dimensions and structural/strategic/overall scores during generation/repair | Not in `snapshot.analysis` or current Insights | Existing elsewhere, not a fresh Canvas evidence source. Generation setup/context and pre-adapter node identities differ; no inspected current-snapshot provenance bridge. Do not run generation/repair or import stale generator scores when opening Insights |
| BW-40 reference metadata M in Insights | Produced in Brain Advice only, through server mapping/resolve | Clickable in Brain, not Insights | Exact IDs are present, but `scopeRevision` and reference origin are not in Insights findings; bridge required for equivalent authorization |

`normalizeInsightsProvenance` supports classification, source, scope, Board, Canvas state, timestamp, method, assumptions, quality and filtered affected IDs. Its presence is not evidence that every diagnostic currently carries such an object: the inspected finding/snapshot path does not invoke it. Do not add ornamental provenance labels that imply stronger verification.

### Actual finding/evidence structure

`buildInsightsFindings` creates shallow-frozen objects containing the template properties plus frozen bounded `evidence/currentValues/missingElements` and frozen sorted `affectedNodeIds`. Each string list trims/deduplicates, truncates individual strings to 160 characters and keeps up to eight values. A source `nodes` property can remain on the object. The snapshot itself is not deeply frozen.

| Code | Trigger / associated nodes | Severity; relevance; weight; category | What evidence actually establishes |
| --- | --- | --- | --- |
| CTA_MISSING | Eligible Landing Page CTA or social preview/native CTA is blank; those nodes | important; 3; 3; content | Some eligible items lack a recognized field value; not that existing wording is unclear |
| FUNNEL_STAGE_GAPS | Any canonical missing stage; no associated nodes | important for ≥3 missing, otherwise opportunity; 4; missing count; funnel | Rule-based coverage absence and covered/missing values |
| TRUST_PROOF_MISSING | Analyzer trust suggestions exist; Landing Pages with blank trust | opportunity; 2; 2; strategy | No populated Landing Page trust field anywhere. Can fire with no Landing Pages and no IDs |
| ICP_VARIATION | Multiple audience labels; all nodes with nonblank audience | opportunity; 2; 2; strategy | Different strings; not conflicting personas or failed ICP fit |
| TONE_SHIFTS_HIGH | More than two tone labels; all nodes with nonblank tone | opportunity; 1; 1; strategy | String diversity; no dominant tone or measured “few variations” |
| CTA_VARIATIONS_MISSING | Analyzer suggests variation and no per-node missing CTA; all eligible CTA nodes | opportunity; 2; 1; content | Fewer than two analyzer-recognized values. Can fire with zero eligible nodes; currentValues is empty |

Sorting is: severity rank ascending; structural relevance descending; affected-ID count descending; weight descending; category rank (structure, funnel, strategy, content); code; first affected ID. The final `.slice(0, 5)` is pre-existing. CTA missing/variation are mutually exclusive, so current templates produce at most five simultaneous findings. Preserve the complete returned array and existing comparator/cap; add no display cap or replacement rank. Affected count can outweigh weight within the same severity/relevance; that is existing policy, not an estimate of business impact.

## 4. Diagnostic quality and limitations

The repository also has deterministic V3 generation-quality checks (generic/fallback/short copy, duplication and platform conventions). Current call sites are generation and post-repair evaluation, not `calculateInsightsDiagnostic`. Their existence prevents an app-wide claim that no richer heuristics exist, but does not make their results available or current in this Insights snapshot. Reusing them requires a separately scoped source/identity/setup audit; generation and repair must never run as an Insights read side effect.

| Metric | Actual calculation | Reliable claim / unsupported claim | Current copy and proposed safer explanation |
| --- | --- | --- | --- |
| Readiness | round/clamp 40 + 25×covered count/5 +10 any trust +10 ≥2 CTA strings +10 ≤1 audience +5 ≤2 tones | Weighted structural heuristic; not completeness of strategy, readiness to spend, or predicted success | Supporting “mostly complete” sentence is unconditional. Explain the included signals and missing-label caveat; retain score/status |
| Funnel | round(covered count/5×100) | Recognized stages by fields/types; not journey quality, conversion flow or probabilistic confidence | Journey disclaimer is good. Calculation disclosure should show canonical covered/missing stages and explain automatic mapping |
| ICP | 90 for ≤1 audience string; otherwise 55 | Label consistency; empty labels also get 90. Not fit to actual customers, personas or Brand | Generic “complete and consistent” overstates empty data. Explain number of populated/distinct labels and ask whether differences are intentional |
| Tone | 90 for ≤1 label; 75 for two; 50 otherwise | Label diversity; not semantic messaging/tone consistency. Case-sensitive after trimming | Generic explanation and “Most campaign content…” are unsupported. Show observed labels and suggest reviewing intended channel differences |
| Trust | 80 if any Landing Page trust field is nonblank; otherwise 35 | At least one populated field; no truth, quality, completeness or all-node coverage | “Coverage” sounds proportional. Explain any-field presence and populated/total Landing Pages; do not claim proof is verified |
| CTA | round(distinct lowercased selected CTA strings / max(selected count,1)×100) | Diversity among recognized values; not clarity, coverage or conversion quality | UI title already says variation. Explain recognized-field scope, denominator and separate missing-field finding; keep CTA status override unchanged |

Additional verified defects/limits, none repaired in this audit:

1. Analyzer CTAs use `landingPage.cta || social.preview` on all nodes, while missing-CTA findings restrict types and also accept `social.cta`. Whitespace is truthy in the analyzer and is not trimmed before diversity comparison. A native social CTA with empty preview can satisfy the missing-field check while analyzer CTA score remains zero. Do not silently reconcile the predicates.
2. A single populated CTA scores 100, yet variation finding is valid under the fewer-than-two rule. With any CTA opportunity, the renderer forces the diagnostic status to Good foundation regardless of numeric score, including zero. Preserve and explicitly explain the distinction; formula/classification changes need separate approval.
3. One Idea, no audiences/tones/CTAs/Landing Pages gives readiness 60, ICP 90 and tone 90, plus trust/variation findings with no affected IDs. The current variation description claiming CTAs are present is false for this case.
4. One trusted Landing Page and another blank trust field still gives trust 80 and no trust finding. Do not invent a new finding to “repair” it; a diagnostic explanation can honestly disclose one-of-two field presence.
5. Two social nodes on LinkedIn produce “Multi-platform social presence.” That raw strength is a node-count template, not distinct-platform evidence.
6. Explicit noncanonical stages enter the covered set, inflate coverage and can make coverage exceed 100 and the overview missing count negative. Readiness is clamped; funnel score is not. Journey's five canonical statuses can disagree with counts. This requires a separately approved formula/data-validation change; explain the rule, do not change results.
7. Audience/tone labels are case-sensitive. Clear, clear and CLEAR produce tone 50. Label consistency is not semantic consistency.
8. Attention lookup uses TRUST_LAYER_MISSING, but engine emits TRUST_PROOF_MISSING, so trust falls back to score 50. It can also omit a CTA-missing finding when recognized existing CTAs score 100. Attention is a filtered three-item orientation summary, not a second reliable ranking. Keep the full ordered opportunity list authoritative. Correcting this lookup/filter is a separate behavior approval.
9. “How this is calculated” currently gives method/scope and generic status copy, not all arithmetic. Retain access while adding precise explanations.
10. `isValidInsightsDiagnostic` checks finite values for several scores but does not establish semantic bounds, canonical stage membership or evidence correctness. Do not interpret validation as scientific verification.
11. A Landing Page whose `landingPage.cta` is absent rather than an empty string can throw in the missing-CTA finding predicate (`.trim()` on the undefined selected value). `calculateInsightsDiagnostic` isolates the failure and presents unavailable diagnostics. This is an existing malformed-data boundary, not evidence that all missing fields produce a finding; do not silently change it in presentation work.

## 5. Existing actions, provenance and authorization

### Show on Canvas

Current card IDs are filtered by existence in `state.nodes`; previews show at most three titles/types with a remainder count. Titles are plain text, not links. Show selects the **first sorted affected ID still present**, calls `focusNodeInCanvas`, switches to the existing Board view, selects and fills Inspector. It respects reduced motion. It does not cycle through all nodes, inspect field quality, mutate content or persist Canvas state.

The local guards check Board, view access and `isCurrentInsightsSnapshot`. They do not establish remote permission freshness, Workspace membership, raw saved revision, unique IDs or changes during the scheduled selection frame. Home already adds duplicate/selector safeguards for its preview; those are not automatically present in Insights.

Reuse the action and native navigation owner. Do not create “Fix”, “Apply” or a second competing focus button. For multiple affected nodes, existing previews can expose individual instances of the same Show action once the §8 checked adapter is approved. Do not claim the current local action has BW-40's server guarantees.

### Ask AI Brain

The signed-in, editable, nonpublic guard is already present. The immutable descriptor includes finding ID, localized title/explanation, severity/category, up to eight evidence/current/missing strings, up to three node IDs/titles/types, Canvas state and timestamp. The **editable question text** contains titles/types, evidence/context and timestamp, but not the descriptor's node IDs. The whole question is truncated to 2,000 characters; long values can remove later instructions. Do not describe the descriptor as a fully transmitted typed request.

The handoff switches views, fills and focuses the composer. It does not submit, fetch, create messages or infer. Subsequent explicit submission receives the existing authorized, bounded working Canvas projection. BW-40 can then resolve genuine Node #N mentions through its established server workflow. Duplicate titles are not identity, and no new Insights code should invent Node #N labels from ID suffixes.

Keep the handoff and limits. Guidance on a card can ask for strategic review without adding another button or automatic call. Do not pipe raw finding `nodes`, arbitrary Brand content or new unbounded values into the draft.

### Refresh and disclosures

Refresh is `renderCampaignIntelligence → calculateInsightsDiagnostic → captureInsightsDiagnostic`, then Insights/Brain render. It is local, synchronous and provider-free; it does not save Canvas. Reuse it to check whether a field/stage condition changed. It cannot show that a conversion rate improved or that copy became strategically better.

Native calculation and methodology details preserve keyboard accessibility. Their compact desktop chevrons are easy to miss; improve the existing accessible text and content, without adding a competing disclosure or redesigning the rows. Retain six classifications, seven methods, full assumptions/limitations, source and timestamp.

### BW-40 boundary

Brain references include exact persisted ID, request-local label and destination-bound `scopeRevision`. The resolver captures authorized saved Canvas twice, verifies actor and scope, rejects duplicates/deletion/staleness/revocation, then returns ID/digest only. Local origin guards include account object, saved revision, catalog/association, nodes/edges, saving/loading/hydrating state. Navigation rechecks after async boundaries, selects the exact target, reveals it and focuses Inspector.

The resolver currently accepts **exactly** `board_id/node_id/scope_revision` and requires authenticated edit scope. It cannot issue a first digest from an Insights finding. Unsaved new nodes cannot acquire saved references. A fresh inference merely to obtain reference metadata is unnecessary and prohibited by this proposal.

The existing Board GET is not a substitute: it has different authorization/freshness semantics and can perform editor identity enrichment. Use the existing read-only reference scope rather than a “read” that introduces incidental writes.

## 6. Actionable presentation model and three levels

Use existing components with normal prose, not technical Level 1/2/3 badges.

Each existing opportunity should show:

1. **Finding:** a qualified observation from its exact predicate.
2. **Why it matters:** one bounded sentence explaining a review need, without an outcome claim.
3. **Canvas context:** exact applicable fields/values and current source titles/types; checked links only under §8. Display useful absence when no relevant nodes exist.
4. **Next step:** a concrete review/edit activity the user performs in Canvas.
5. **Existing action and verification:** reuse Show on Canvas/Ask AI Brain; tell the user to refresh for the structural check, and use real analytics separately for business effect.

The observation is Level 1. “Consider whether…” / “Review whether…” naturally communicates Level 2. “Ask AI Brain to review…” delegates Level 3 explicitly. A question about strategic quality stays a question.

| Finding | Bounded interpretation and next step | Context / how to verify |
| --- | --- | --- |
| Missing CTA | A recognized next-step field is blank. Review the destination and enter an appropriate next step | Only actual eligible missing-field nodes; refresh to check field presence, not wording effectiveness |
| Funnel gaps | No recognized Retention content, for example. Review whether post-conversion communication belongs in this campaign | Missing stage names; no fabricated target. Existing Brain can suggest a concept; refresh after a deliberate Canvas change |
| Missing trust | Existing Landing Pages have blank trust fields; review whether substantiated proof can be added | Actual blank Landing Pages. With none present, say no Landing Page trust field is available, not “a page has no proof” |
| ICP labels differ | Different labels may be intentional segmentation. Review the intended audience for each item before aligning | Exact label/node pairings; refresh for label equality only; Brain for ICP/Brand judgment |
| Tone labels differ | Tone labels vary; review whether this reflects deliberate channel or audience choices | Exact labels, not a claimed dominant tone. Refresh for the label-diversity rule |
| CTA variation | Fewer than two analyzer-recognized values; review whether different stages need different next steps | Show selected field values with explicit field names. Zero eligible nodes needs an absence explanation, not “CTAs are present” |

Do not add strengths/weaknesses as a second ranked feed. Do not infer CTA quality, persona fit, trust validity, semantic messaging alignment or causality from these fields.

### Targeted changes within BW-43

- **Readiness:** retain ring, score and existing status. Replace the unconditional supporting sentence with a factual scope explanation; expand the same calculation disclosure with factors and empty-label caveats.
- **Journey:** retain five stages, ordering, icons/path, statuses and structural disclaimer. Add compact supporting-node context within existing stage content using the exact current mapping predicates; empty stages state absence. Do not route missing stages to arbitrary nodes.
- **Opportunities:** preserve every returned finding, comparator order, severity and first-card emphasis. Add bounded why/next-step text and evidence context; preserve access to all supporting IDs through an existing disclosure if the three-item preview remains compact. No new hard cap.
- **Diagnostics:** add metric-specific supporting counts/labels and limitations in existing details. Preserve numeric results, threshold classes and CTA override.
- **Measured Performance:** leave honest disconnected state; no chart, connector action, fabricated baseline or predicted improvement.
- **Data and Methodology:** keep all existing information and clarify that source presence, deterministic inference and strategic advice have different evidentiary strength.

All system templates need EN/DE in `language.js`, using `uiText/uiFormat` as appropriate. Canonical analyzer strings remain unchanged for shared consumers. Node titles, audiences and other authored values remain plain text, never localization keys or HTML. Counts and stage names should be localized templates, not blind translation of generated English evidence.

## 7. Architecture comparison

The authorization bridge is orthogonal to both presentation options.

| Criterion | A: enrich existing renderer | B: new deterministic interpretation layer |
| --- | --- | --- |
| User value | Covers why/context/next step using current findings and fields | Same immediate value; no additional verified evidence by itself |
| Existing-data coverage | High for structural facts; explicit fallback for absent values | Same sources and same missing CTA values/strategic evidence |
| Security/authorization | Keep guards; checked links need §8 bridge | Layer is not authorization; also needs §8 |
| Provenance | Preserve snapshot and use named source predicates | Risk of presenting normalized templates as stronger evidence |
| Maintenance | Small per-code templates and metric explanations in current module | Another model/contract and synchronization with engine/renderer |
| Complexity/regression | Smallest presentation change; localized behavioral tests | Additional translation/evidence drift and shared-consumer boundary |
| Performance | One pass/index per render; avoid repeated scans for every node | Can index too, but does not inherently improve complexity |
| Localization | Existing UI dictionary and authored-value rules | Must carry localization keys/parameters without translating evidence |
| AI Brain | Existing handoff unchanged | No demonstrated need for a second handoff representation |
| Saved/live state | Existing snapshot stays authoritative; link availability can differ from local evidence | Another cache/state would need invalidation across save/scope changes |

**Choose A.** A few pure helpers to format a finding or build a current unique-ID index are still A, provided no independent persisted/cached interpretation product is introduced. Do not create another scoring algorithm or AI response format. A future reused interpretation API would require an actual second consumer and a demonstrated benefit; neither is needed for this proposal.

## 8. Exact minimal implementation boundaries

### Proposed BW-44.1 boundary

This section proposes future work; it is not an account of changes in this PR. Accepting the BW-44.1 prompt approves the explicit authorization extension below. It does **not** approve score, finding generation or classification changes.

1. Preserve `analyzeCampaign`, `calculateInsightsDiagnostic`, `captureInsightsDiagnostic`, `buildInsightsFindings`, `isCurrentInsightsSnapshot`, existing snapshot shape and comparator byte-for-byte.
2. Add localized presentation templates and exact-field context within `app.js`'s Insights rendering path. Use the current snapshot and unique current-node index; no new snapshot cache.
3. Keep `askAiBrainAboutFinding` behavior and limits unchanged. No inference on render, Refresh, link verification or handoff.
4. Add checked target opening through the existing BW-40 route, rather than fabricating `scopeRevision` on the client:
   - Retain the existing three-field request and response exactly for Brain.
   - Add a strictly discriminated Insights-only request branch to the same endpoint for deterministic **resolve-and-open validation**, taking Board ID, exact node ID/type and the caller's expected saved scope (`updated_at/brand_id/workspace_id`). These come from `lastKnownUpdatedAt` and `boardBrandAssociation`, captured with the rendering origin. Unknown/missing/extra fields fail closed.
   - Reuse `capture/assertActor/assertExpected`, unique saved ID/type validation, supported types and `referenceRevision`. Capture saved Canvas twice and compare full fingerprints; return only exact node ID and the existing destination-bound digest. Do not return saved node copy, add a model call or weaken ordinary Brain validation.
   - For authenticated view-only users, add an explicitly selected read capability to the existing scope capture, with **edit remaining the default for every existing caller**. Reuse verified app identity, accepted Workspace membership/lifecycle, Board canView and association checks. Only the deterministic Insights branch selects this capability; Advice, proposals and existing Brain references continue to require edit.
   - Public-token/anonymous contexts receive no new server-checked reference capability. Preserve existing local Canvas navigation and no-Brain behavior there; do not call it a BW-40 verified reference. No new permission or canonical Brand access is acquired.
   - Check client origin before dispatch, after response and after animation frames. Include the existing snapshot identity/fingerprint plus account object, saved revision, association, catalog and loading/saving/hydrating guards. Verify response ID matches the requested ID and the target is unique locally. Reuse native focus/reveal/Inspector focus behavior from BW-40; extract only that common UI sequence if necessary, retaining each caller's distinct freshness checks.
   - Apply the checked adapter to authenticated Insights Show on Canvas and its individual source-node affordances; preserve first-affected default behavior when no explicit ID is requested. Optional ID must belong to that exact current finding. Journey source IDs must satisfy that stage's actual rule. Home must keep working through the default adapter.
   - A new unsaved node has no persisted target: keep its factual local context visible and explain saved-reference unavailability. Existing live-local navigation may remain explicitly local; never manufacture a saved reference. Unsaved edits to a persisted node remain local evidence, not saved quotes; a checked link identifies the destination only.
5. Preserve existing native details and style contracts. Add only scoped wrapping/focus/source-list rules if needed; no layout redesign or new imagery.

The expected saved timestamp is normalized to milliseconds by the existing `assertExpected` contract. The server's double capture and destination digest include the raw saved revision. This does not retroactively supply a microsecond revision to an older client snapshot; do not claim that stronger pre-request guarantee. Local field/fingerprint checks and exact saved destination checks remain necessary. Any stronger historical scope token would be a separately approved persistence/API contract.

### Exact proposed file scope

| File | Proposed change |
| --- | --- |
| `app.js` | Insights presentation/context and checked navigation adapter; smallest shared native focus extraction; existing producers and Brain handoff unchanged |
| `language.js` | New closed EN/DE explanation, guidance and unavailable/pending/retry templates |
| `styles.css` | Only scoped Insights source context, wrapping and focus rules |
| `api/ai-brain/node-reference.js` | Strict additional deterministic Insights branch; original Brain contract retained |
| `api/_ai-brain-proposal-scope.js` | Explicit read-capability capture for this branch only, default edit unchanged |
| `scripts/check-bw28-3-1-insights-runtime-rendering.js` | Production-path rendering/evidence/applicability assertions |
| `scripts/check-bw43-insights-browser.js` | Actual UI, source actions, themes/locales/devices and preserved scores/priority |
| `scripts/check-bw40-node-references.js` | New branch, viewer/default-edit isolation, scope/revocation/read-only tests |
| `scripts/check-bw40-node-references-browser.js` | Checked exact destinations, pending changes, Inspector and zero-write behavior |
| `docs/implementations/bw44-actionable-insights.md` | Implementation decisions, evidence and limitations |

No new dependency, database table, provider, quota, API route, model schema or workflow is needed: these test scripts already run in existing checks. `api/_ai-brain-node-references.js`, `api/ai-brain/advice.js`, `api/_ai-brain-canvas-context.js`, `ai-brain-node-references.css`, `index.html`, package registration and workflows are reference contracts, not proposed edit targets.

Existing legacy source-string tests may need narrowly justified expectation changes when visible copy moves into templates. Existing full-file hash contracts can also be affected by scoped CSS additions. If those failures occur, inventory the exact affected test files and preserve their assertions/security baselines; do not pre-authorize unrelated test changes or claim an exact final touched-file list before validation.

### Separate approval, not part of BW-44.1

Changes to analyzer CTA selection/trimming, stage validation/denominator, missing-audience scoring, trust coverage formula, thresholds/CTA override, opportunity generation/cap/comparator or Attention filtering require separate approval. Improving explanatory copy does not authorize any of these changes.

## 9. Risks, limitations and remaining uncertainty

- A field is not verified marketing evidence. Presence of trust text cannot establish its truth; audience/tone strings cannot establish strategy; a source link verifies identity/authorization, not content quality.
- Existing affected-ID generation can include duplicates; source strings truncate and generic evidence is not typed quotation. Use the unique current-node index and actual field labels, not the retained raw `nodes` property.
- Findings can be globally inapplicable to absent node types. Keep every source finding but qualify its presentation; do not hide it or create a target.
- Existing local Show actions can be stale relative to a remote revocation until the application learns of it. The new checked authenticated path must address that at click time; anonymous/public local navigation remains under the existing public Board lifecycle and must not acquire a false checked-reference claim.
- The proposed read-capability parameter is security-sensitive. Default-edit isolation, verified identity, accepted membership, lifecycle, association and double-capture tests are release gates, not optional cleanup.
- No reference navigation can guarantee authorization after its final validation forever. Preserve existing Canvas lifecycle and rechecks at async boundaries.
- Matching saved ID/type does not make live-unsaved content a saved quote. New unsaved IDs have no server reference.
- Additional deterministic read validation has latency and may be unavailable; show pending/retry/unavailable state on the existing action, never navigate optimistically or automatically reload/save Canvas.
- New code must avoid per-reference full-Canvas rescans and automatic reference prefetch. Build one render index; authorize a selected target on explicit click.
- We have not established useful business thresholds, improved conversion or model strategic quality. Those require user judgment or separately authorized measured evidence.
- Exact final helper size and copy wrapping remain implementation questions, not justification for a new architecture. Full CI/browser release evidence belongs to BW-44.1; this audit supplies current-path evidence only.

## 10. BW-44.1 acceptance test plan

Use fictional nodes, duplicate titles and signed fixture sessions. Run the production analyzer/snapshot/renderer and real resolver, with mocked inference only where testing the existing explicit Brain workflow. No external service or paid inference is required.

| # | Concrete acceptance assertion |
| --- | --- |
| 1 | Same canonical fixture returns identical healthScore and overview classification/ring. Existing Campaign Health consumers remain unchanged |
| 2 | Five Journey stages, order, path/icons, canonical statuses and disclaimer remain; supporting context is additive |
| 3 | Deep-compare all original analysis scores, finding objects/order and classification outcomes before/after, including one CTA at 100, native-social-only zero and noncanonical-stage edge cases. No silent normalization |
| 4 | Render every returned opportunity exactly once in engine order; no added cap/filter. Preserve three-item compact preview with access to all remaining supporting IDs |
| 5 | CTA-missing/trust/audience/tone contexts show the actual contributing current fields and unique IDs. Template evidence is never called a verified quote |
| 6 | `node-27` and a UUID with identical titles open by exact ID; no title lookup, suffix-derived number or reinterpretation of Node #N |
| 7 | Click/Enter/Space reaches current Board, exact selection and Inspector, reveals target and focuses Inspector after the real frame lifecycle; pending scope change prevents opening |
| 8 | Missing Retention and no-Landing-Page trust cases have zero fabricated targets. Zero eligible CTA nodes never claim CTAs are present. Unsaved new nodes receive no persisted reference |
| 9 | Every finding has observation, bounded why, practical next step and structural verification guidance. Audience differences are review questions, not proven conflicts |
| 10 | Compare full engine code order to rendered order; preserve severity and first-card emphasis. Do not derive priority from numeric diagnostic color |
| 11 | No card, diagnostic or handoff claims actual reach, conversion, revenue, uplift, proof truth or strategic fit. Measured Performance stays disconnected |
| 12 | Existing Ask AI Brain guards hold; editable localized evidence/context draft remains bounded and focused; no submission/message until user explicitly submits |
| 13 | Track provider requests across render, Refresh, link validation and handoff: zero additional inference. Existing explicit Advice remains its current workflow |
| 14 | Assert unchanged nodes/edges/Brand/history/dirty/saved snapshot across render, Refresh, reference resolution and navigation. Resolver SQL stays SELECT/BEGIN/SET/COMMIT/ROLLBACK; no Board GET enrichment fallback |
| 15 | Existing Brain three-field branch and default edit scope reject viewers as before. New authenticated Insights view capability cannot grant Advice/proposal/Brand access; accepted Workspace/identity/association checks remain mandatory |
| 16 | Delete/retype/duplicate target, wrong Board, changed revision, disabled identity, revoked Board access/membership, inactive Workspace, changed Brand association and in-flight account/scope/Canvas/save changes fail closed. 503 is retryable; no optimistic focus. Public contexts get no new checked references |
| 17 | All six diagnostic details, seven methods, classification definitions and full source/assumptions/limitations remain accessible; arithmetic/scope explanations are accurate |
| 18 | EN/DE system templates complete; authored audience/title/content stays unchanged, including hostile HTML-like strings. Generated canonical English strings are not blindly localized |
| 19 | Light/Dark reuse existing semantic surfaces/text/focus/status tokens; no unscoped theme regressions |
| 20 | Desktop/tablet/375px/320px and 200% zoom reflow without clipping; lists/action/disclosure remain reachable; existing BW-43 geometry retained |
| 21 | Native keyboard buttons/details, logical focus, pending/error status announcements and reduced motion; focus returns safely after failures |
| 22 | Existing relevant BW-25/BW-28/BW-36.21B2/BW-40/BW-40.1/BW-43 checks and complete Runtime Boot Safety matrix on PostgreSQL 17.6/18.4 remain green before implementation delivery |

Required fixture contrasts: no audience versus one/multiple; case-only tone labels; one CTA versus repeated/two values; whitespace; native `social.cta` versus `social.preview`; no Landing Pages versus one populated/one blank trust field; zero/one/multiple channels including two posts on one channel; canonical and custom stages; saved and live-unsaved; new unsaved ID; missing/deleted/duplicate targets; viewer/editor/public/denied/loading/error/empty contexts.

## 11. Deferred features

- Formula/scoring/finding-policy repairs listed in §4 and §8.
- Semantic ICP fit, message/offer quality, substantiated-proof assessment and channel strategy beyond explicit existing Brain questions.
- Measured analytics integrations, outcome history, experiments, uplift/attribution and automated before/after claims.
- Automatic fixes, generated nodes, Canvas writes, auto-submitted Brain prompts or model-generated Insight response schemas.
- New persistent evidence/interpretation store, second node identity system, stable positional label redesign, new providers/quotas or a complete UI redesign.
- Checked anonymous/public source-reference capability beyond the current public Board lifecycle.
- Broader historical microsecond scope-token issuance and unbounded evidence/history are not implied by this proposal.

## 12. Directly copyable BW-44.1 implementation prompt

```text
TENDRA ONE — BW-44.1: Actionable Insights using existing evidence

Repository: Funklix/Funklix.
Start from latest merged main including PR #850. Read AGENTS.md and
docs/audits/bw44-actionable-insights-intelligence.md in full.
Implement the approved minimal Option A presentation enrichment and the exact
read-only BW-40 authorization extension specified in section 8 of that audit.
This prompt authorizes that bounded extension; it does not authorize formula,
finding-policy, classification, Attention-filter or permission broadening.

Preserve the BW-43 visual design. Read:
docs/implementations/bw43-insights-inventory.md
docs/implementations/bw43-ai-insights-redesign.md
docs/implementations/bw40-simple-canvas-node-references.md
docs/implementations/bw40-1-stable-references-prompt-shortcuts.md

Verify current code before editing. The existing production functions are:
app.js: analyzeCampaign, calculateInsightsDiagnostic, captureInsightsDiagnostic,
currentInsightsIdentity, currentInsightsCanvasIdentity, buildInsightsFindings,
isCurrentInsightsSnapshot, renderInsightsSurface, showInsightsFindingOnCanvas,
askAiBrainAboutFinding, focusNodeInCanvas, captureAiBrainEvidenceOrigin,
aiBrainEvidenceOriginCurrent, openAiBrainNodeReference and
revealAiBrainEvidenceNode.
Server contracts:
api/_ai-brain-node-references.js: mapping, resolve, referenceRevision.
api/_ai-brain-proposal-scope.js: capture, assertActor, assertExpected,
publicScope and revision.
api/ai-brain/node-reference.js: strict existing three-field checked reference.
Use language.js and existing scoped styles/native disclosures.

Keep analyzeCampaign, calculateInsightsDiagnostic, captureInsightsDiagnostic,
buildInsightsFindings, isCurrentInsightsSnapshot, the snapshot shape,
all formulas/classifications/comparator and askAiBrainAboutFinding unchanged.
Do not add providers, quotas, inference calls, tables, dependencies or writes.

Within existing readiness, Journey, opportunity and diagnostic components,
show exact observed condition, bounded why, actual current field/node context,
practical next step and guidance to refresh for structural verification.
Preserve every returned finding and its order. Keep all original methodology
and disconnected performance information accessible. Add no second feed,
arbitrary cap, invented outcome or new fix/apply action.
Audience/tone differences are label observations, not proven strategic conflict.
CTA diversity is not quality or coverage. Trust field presence is not truth.
Do not expose raw retained finding.nodes or invent analysis.cta.values.
Qualify zero-eligible-node trust/CTA findings without hiding source findings.
Journey source association must use exactly the existing mapping predicates;
missing stages must not acquire fabricated source nodes.

Reuse Show on Canvas and Ask AI Brain. Use a unique current-ID index and plain
text authored values. Preserve first-affected default navigation and Home
compatibility; an explicit finding target must belong to that current finding.
Do not invent Node #N labels or use a title or numeric suffix as identity.

For checked Insights targets, extend the existing node-reference endpoint with
the strictly discriminated deterministic branch described in audit section 8.
Retain the Brain three-field contract unchanged. Take exact Board/node/type and
expected saved scope from captured current state; reject unknown/extra fields.
Reuse saved supported-type/unique-ID validation, scope capture/assertions,
double fingerprint revalidation and referenceRevision. Return only exact ID and
the existing digest. Do not call Advice or Board GET to obtain a reference.
The scope capture's existing default remains edit for every existing caller.
Only the new authenticated Insights branch may explicitly select Board-view
capture while retaining verified identity, accepted Workspace membership,
lifecycle and association checks. No canonical Brand or Advice/proposal access
is added. Public/anonymous contexts acquire no new checked-reference ability.

Recheck local snapshot plus account/revision/catalog/association/loading/saving
origin before and after async work and selection frames. Reuse BW-40 native
focus/reveal/Inspector behavior, extracting only the smallest common UI sequence
if needed. Authenticate/revalidate before opening; no optimistic navigation.
Unsaved new IDs have no persisted reference. Live-unsaved evidence must not be
called a saved quote. Keep unavailable/pending/retry states localized and safe.

Proposed implementation files:
app.js
language.js
styles.css
api/ai-brain/node-reference.js
api/_ai-brain-proposal-scope.js
scripts/check-bw28-3-1-insights-runtime-rendering.js
scripts/check-bw43-insights-browser.js
scripts/check-bw40-node-references.js
scripts/check-bw40-node-references-browser.js
docs/implementations/bw44-actionable-insights.md

No new API route, AI output schema, persistent layer or independent node identity.
No package/workflow change is needed to run the existing listed test paths.
If existing source-string or hash tests fail because of the approved presentation
change, document exact necessary expectation updates and retain all original
behavior/security assertions; do not weaken checks.

Implement all 22 acceptance groups and fixture contrasts in audit section 10
with fictional data through production analysis and real local resolver paths.
Test all original and new authorization branches, especially default edit
isolation, authenticated viewer scope, duplicate IDs, stale/revoked/in-flight
references, exact duplicate-title destinations and zero writes/inference.
Run relevant BW-25/BW-28/BW-36.21B2/BW-40/BW-40.1/BW-43 regressions and the full
Runtime Boot Safety matrix on PostgreSQL 17.6 and 18.4.
Report blocked checks honestly; do not equate mocked inference with model quality.

Review all public documentation/artifacts for secrets, customer information and
sensitive operational detail. Work on one dedicated branch, commit and publish
exactly one normal non-draft PR against latest main. Verify draft:false.
Do not merge or deploy. Report real PR URL, base/head commits, exact changed
files, validation results and remaining limitations.
```

### Publication review

This audit contains repository-level code contracts and fictional test cases only. No credentials, production customer records, session tokens, private configuration values, raw operational logs or browser profiles are included. The document and proposed public PR text were reviewed for these classes before publication. The user explicitly requested a non-draft documentation-only PR; no additional publication authorization requirement was found in repository instructions. Only this Markdown file is to be published.

### Delivery validation

Current production-path audit checks are listed in §2. Browser and final PR verification are recorded in the PR description; do not interpret the future acceptance plan as completed implementation validation.
