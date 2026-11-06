# BW-45.0 — Insights Quality & Strategic Intelligence Audit

## Executive summary and architecture decision

Audit and architecture decision only. No application, formula, authorization, schema, provider or UI change is delivered. Audited main: **`53e09d015b81ffc57679282cd22d0dd0ec735d70`**, merged PR #854, checked 6 November 2026. BW-43's dashboard and BW-44's explanations, interactive Journey, exact-ID Canvas/Inspector navigation and editable Ask AI Brain workflow are preserved.

The current scores are deterministic field/stage heuristics. They do not establish content quality, strategic alignment or measured marketing performance. BW-44 already explains most of these limits accurately. More explanatory prose alone cannot fix a missing-field exception, 120% coverage or an attention summary that hides a real missing CTA.

**Decision: B now, C only after product approval; D deferred.** Correct specific input/validation and finding-consumer defects in narrow packages, preserving weights, thresholds and interactions. Do not import Campaign Creator scores or add inference. Preserve the single existing findings comparator. Keep semantic review in explicit AI Brain submission. A future change to empty-label rewards, CTA diversity policy or proportional trust coverage requires a separate scoring-policy decision and before/after fixture review; this audit approves none of those changes.

Exactly three prioritized improvements:

1. Make missing/malformed optional diagnostic inputs safe and align CTA field evidence across the existing analyzer, findings and explanations.
2. Make funnel coverage canonical and mathematically consistent across analyzer, count, Journey and findings.
3. Make the attention summary faithfully surface actionable emitted findings, without another ranking engine.

The minimum BW-45.1 is a first, compatible subset of improvement 1: safely handle absent/null Landing Page CTA values, retaining all existing formulas and field-selection semantics. Ship canonical-stage validation, CTA source normalization and attention behavior in separately reviewable follow-ups. This keeps urgent availability repair independent from score movement and summary policy.

## Scope, evidence and current contracts

Read `AGENTS.md` and all six requested architecture documents. All requested filenames exist at the audited main:

- [BW-44 audit](bw44-actionable-insights-intelligence.md).
- [BW-44 implementation](../implementations/bw44-actionable-insights.md).
- [BW-43 inventory](../implementations/bw43-insights-inventory.md).
- [BW-43 dashboard](../implementations/bw43-ai-insights-redesign.md).
- [BW-40 references](../implementations/bw40-simple-canvas-node-references.md).
- [BW-44.3 Journey](../implementations/bw44-3-interactive-journey.md).
- `AGENTS.md` requires a dedicated branch, commit/publication, exactly one normal PR against main, verified non-draft status, and no merge. (Six named design/audit documents plus AGENTS constitute the seven requested files.)

Relevant contracts were checked against code, rather than inherited solely from those documents. The BW-44.3 document's closing fingerprint-approval note is historical: merged PR #854 includes that follow-up. BW-40's original EDIT-only resolver description is also historical; BW-44.1 added the explicit Insights VIEW branch. Do not regress either contract.

| Current source | Audit relevance |
| --- | --- |
| [`app.js:6185`](../../app.js#L6185), `analyzeCampaign(nodes, edges, brandCore)` | Synchronous deterministic analysis; `edges` and `brandCore` are unused |
| [`app.js:6350`](../../app.js#L6350), `calculateInsightsDiagnostic()` | Calls analyzer/capture; catches any failure and stores unavailable analysis |
| [`app.js:7902`](../../app.js#L7902), `currentInsightsCanvasIdentity()` | Fingerprints selected node identity/title/type/labels, goal, platform and CTA/trust fields |
| [`app.js:7906`](../../app.js#L7906), `captureInsightsDiagnostic(analysis)` | Nonempty viewable loaded Board; runtime snapshot with timestamp, source state, analysis and findings |
| [`app.js:8085`](../../app.js#L8085), `buildInsightsFindings(analysis)` | Existing emitted codes, evidence, affected IDs and ranking |
| [`app.js:8127`](../../app.js#L8127), checked navigation area | Snapshot/account/saved-scope and asynchronous navigation checks |
| [`app.js:8176`](../../app.js#L8176), `insightsNodeSupportsStage(node, stage)` | Journey source membership matches explicit stage/type/goal/LP CTA rules |
| [`app.js:8182`](../../app.js#L8182), `askAiBrainAboutFinding(code)` | Explicit editable composer handoff, no submission |
| [`app.js:8196`](../../app.js#L8196), `renderInsightsSurface()` | `renderInsightsSurface`, metric explanations, status, attention, Journey and measured-data absence |
| [`app.js:14395`](../../app.js#L14395), `addCampaignV3StrategicSocialDiagnostics(...)` | Deterministic channel-copy conventions, appends issues to supplied accumulator |
| [`app.js:14471`](../../app.js#L14471), `evaluateCampaignV3StrategicDiagnostics(nodes, setup, context)` | Heuristic optimization findings and capped penalty scores |
| [`app.js:14598`](../../app.js#L14598), `evaluateCampaignV3Quality(nodes, setup, context)` | Validation plus strategic results; distinct generation-stage input contract |
| [`api/ai-brain/advice.js`](../../api/ai-brain/advice.js), [`api/_ai-brain-canvas-context.js`](../../api/_ai-brain-canvas-context.js) | Independently authorized, bounded working Canvas and Brand context; explicit provider boundary |
| [`api/ai-brain/node-reference.js`](../../api/ai-brain/node-reference.js), [`api/_ai-brain-proposal-scope.js`](../../api/_ai-brain-proposal-scope.js) | Exact saved ID/type, strict Insights VIEW versus default Brain EDIT requests, double-captured scope |

The initial local checkout was older (`4655fed`); shell Git fetch was unavailable. The GitHub connector established the current main SHA and supplied the complete comparison. All 19 changed text blobs were synchronized into the disposable audit working copy and verified using Git blob hashes against that SHA. Three added PNGs were not needed for executing the application or these tests. Publication adds only this Markdown file to a branch based on the audited main; synchronization changes are not audit implementation changes.

### Canvas and Brand data ownership

Saved Canvas is `boards.canvas_json`, with `nodes`, `edges`, counters, zoom, schemaVersion and metadata. Stable `node.id` strings drive edges, selection and Inspector; titles and array positions are not identities. `createNode` initializes empty audience/goal/channel/funnelStage/tone, social platform/caption/hashtags/preview, and Landing Page headerClaim/problem/solution/trust/cta. Imported/older nodes can omit these optional structures. `sanitizeNodeForPersistence` cleans images/status/ownership/transient flags, but does not guarantee CTA or strategy strings. Thus current default nodes being well formed does not make old optional fields safe to dereference.

Current Insights freshness includes `[id,type,title,audience,tone,funnelStage,goal,social.platform,social.preview,social.cta,landingPage.cta,landingPage.trust]`. It does not bind body/caption/problem/solution/description or Brand DNA for semantic analysis. Edges are not scored. A future body-quality helper must explicitly extend its dependency/freshness scope; merely calling a richer helper would otherwise leave its evidence stale.

`state.brandCore` is passed but unused by `analyzeCampaign`. `suggestNextNodes` reads persona/tone for suggestions; this is not a Brand-alignment check. AI Brain separately authorizes saved Board snapshot, optional canonical Brand Core and approved learnings. Local Insights visibility does not grant canonical Brand access.

## Complete current methodology

Let `S` be the set of truthy derived stages, `A` distinct trimmed nonempty audience strings, `T` distinct trimmed nonempty tone strings, `L` Landing Pages with trimmed nonempty trust, `C` truthy values selected on every node by `landingPage.cta || social.preview || ""`, and `U` distinct lowercased strings in C. String operations presume strings; malformed truthy numbers can throw. There is no inference/provider call in these calculations. Stage mapping is deterministic *inference of role*, not semantic judgment.

| Metric / exact calculation | Included fields and missing behavior | Supported conclusion / unsupported conclusion and misleading cases | Stronger existing evidence |
| --- | --- | --- | --- |
| Readiness = round, clamp 0–100 of `40 + 25×|S|/5 + 10×any(L) + 10×(|U|≥2) + 10×(|A|≤1) + 5×(|T|≤2)` | Base 40, each distinct derived stage 5 points; any trust 10; at least two CTA strings 10; zero/one audience 10; zero/one/two tones 5. Missing audience/tone earns full bonuses; no trust or CTA removes only its bonus. Custom stages count before clamp | Weighted stage/label signal. Does not prove launch readiness, quality or success. One Idea scores 60; a superficially filled Canvas scores 100. A single missing CTA can remove all visible diagnostics through an exception rather than simply reduce a score | Existing factor explanations disclose arithmetic; V3 identifies missing bodies/structured fields but its aggregate is unsuitable for direct reuse |
| Funnel `round(|S|/5×100)` | Every truthy explicit `funnelStage`; Idea/Social Media Posting adds Awareness, Content adds Interest; Landing Page OR exact goal/stage `Conversion` OR trimmed LP CTA adds Conversion. Explicit and inferred roles accumulate, not override one another. Missing canonical stages are five-name set difference. No validation/normalization of custom strings | Rule-based stage representation. Does not establish connected journey, stage content sufficiency or conversion flow. Custom values inflate count; six derived values produce 120. A Landing Page is Conversion even without CTA. Email has no inferred Retention role | Existing five Journey statuses and source predicate expose canonical presence; missingStages is already canonical |
| ICP `90 if |A|≤1, else 55` | All nodes' `audience`, trimmed, case sensitive, blank ignored; repeated identical label counted once; conflicting or intentional segments treated identically; no population denominator | Entered-label equality. Does not test actual ICP fit, whether a label describes customers, or Brand personas. Empty labels score 90; Teams/teams score 55 | BW-44 lists counts and labels; explicit Brain can review available audience/message context |
| Tone `90 if |T|≤1; 75 if 2; else 50` | All nodes' trimmed tone strings, blank ignored, case sensitive. Readiness still gives its full tone bonus at two labels despite this component falling to 75 | Label diversity. Does not read semantic tone or respect intended channel differences. Clear/clear/CLEAR gives 50; no labels 90 | Existing label/node explanations; V3 channel conventions are copy heuristics, not semantic tone; Brain can judge appropriateness |
| Trust `80 if any(L), otherwise 35` | Landing Page type only; any nonempty trimmed `landingPage.trust`. No LP, all empty LPs both 35; one of many nonempty pages yields 80 and suppresses trust finding | Presence of at least one entered proof field. The label “coverage” sounds proportional but formula is binary. A single `x` gets 80; no verification of claims, citations, credibility or completeness | Existing disclosure gives populated/total LPs; V3 catches short/generic proof but cannot verify truth |
| CTA `round(|U|/max(|C|,1)×100)` | Every node can contribute LP CTA or social preview; truthy LP CTA wins; no trim before filtering/comparison; case lowercased only. `social.cta`, top-level `cta`, caption/body/email CTAs ignored. Missing values excluded from denominator | Lexical diversity of recognized strings. Label “variation among existing CTAs” is much closer than internal `qualityScore`; no clarity, effectiveness or coverage. One value =100, two repeated =50, three repeated =33. Single value still triggers fewer-than-two-values opportunity. Whitespace =100 and pads create false variation | Missing-field finding checks eligible types and also native Social CTA; current predicates disagree. V3 Learn-more/invitation checks offer limited wording evidence |
| Platform distribution | Only Social Media Posting, `social.platform || "Unknown"`, raw case/spacing; counts by label; summary reports social node count and label count. Bars relative to largest count, not percentage of all channels | Social platform-label counts. Not full channel mix: email/content `channel` ignored; Unknown counts as a category. Two LinkedIn nodes trigger generic “Multi-platform social presence” strength despite one platform | Actual `platformDistribution.counts` is stronger than that strength template; renderer uses these counts |

All metrics ignore content/body quality, semantic CTA clarity, Brand fit, proof truth, media delivery and marketing outcomes. Most also ignore graph edges, node status and scheduling. Per-metric field scope above is exhaustive for the score. Scores are not measured confidence probabilities despite the internal funnel name `confidence`.

Statuses are `Strong ≥85`, `Good foundation ≥70`, `Needs attention ≥45`, otherwise `Incomplete`. The CTA row overrides to Good foundation whenever any emitted `CTA_` opportunity exists, even with score 0 or 100. This is pre-existing display policy, explicitly explained by BW-44, not an extra calculation. An empty Canvas's raw analysis is `[55,0,90,90,35,0]`, but capture returns null and the renderer correctly withholds scores.

### Other existing deterministic consumers and suggestions

`api/_ai-brain-diagnostics.js::analyzeCanvas` is a separate pre-existing, bounded server diagnostic supplied to Advice; it does not supply dashboard scores or the ranked Insights opportunities. Its `text()` checks strings before trimming, giving useful precedent for safe optional fields, but it still ignores native social.cta and accepts custom stages. Direct fictional probes confirm numeric audience is safely ignored, whitespace preview/native Join still reports missing_cta, and Idea+Custom still has both Custom/Awareness. It has different codes/severities and must not be substituted as a second ranking engine. Brain's evidence policy explicitly asks the model to recheck actual top-level/native CTA evidence and warns that preview may contain no action. That policy is stronger qualification, not proof the model will always correct the diagnostic.

`app.js::suggestNextNodes` remains defined with no current call site in app.js. It is distinct from the visible ranked opportunity feed. It suggests a missing-conversion LP (high), trust Content when trust<60 (medium), another platform when fewer than two labels (medium), CTA Social when CTA score<50 (high), then a generic Campaign Variation fallback. It deduplicates by suggestion ID and returns the first six in insertion order, rather than sorting high priority first. “Strong Landing” tests CTA+solution+Conversion on any LP, then examines the first LP, so those are not necessarily the same node. These legacy candidate-generation rules are not intelligence measurements or a reason to add recommendations to the current dashboard. The separate explicit createSuggestedNodeFromAnalysis workflow performs generation and saves; never invoke it merely to read Insights. No new engine or activation of that unused suggestion path is recommended.

### Aggregate score and user trust

BW-44 now discloses the full readiness formula and warns that empty labels earn points. Users can understand the arithmetic, but cannot infer substantive campaign readiness from 90/100. No field-level content minimum exists. Stage and trust/CTA can overlap: any populated LP CTA infers Conversion (5 points), and additional distinct CTA text can add 10; LP type already infers Conversion. This is correlated evidence, not independent validation. Showing readiness twice does not count it twice mathematically.

Structural sparsity can score highly: custom stages inflate S; empty labels add 15; meaningless distinct CTA strings and one-character proof add 20. Adding more identical CTA nodes reduces the CTA component while readiness is unchanged if U remains fixed. One missing field can crash findings even while the analyzer returns finite numbers. Unknown values are generally collapsed into positive label-consistency scores rather than represented as unavailable; trust absence instead gets 35, CTA absence 0. No uniform “unknown” model exists.

Preserving explanations (A) is insufficient for proven A-class defects. B is the next corrective direction. C needs explicit product agreement on applicability, unknown labels, normalization and score comparability. D may eventually separate structural coverage from evidence availability and semantic review, but there is no evidence for new weights, thresholds or a replacement readiness formula in this audit.

## Verified inconsistencies and classification

Class A = incorrect calculation/data handling; B = misleading label/interpretation; C = valid limitation needing explanation; D = deliberate existing product policy. Some observations have distinct aspects in two classes. Existing policy is inferred only where the code and prior implementation preservation explicitly establish it.

| Verified observation | Classification and current-main evidence | Consequence / disposition |
| --- | --- | --- |
| Empty Audience/Tone receive 90; readiness awards 15 for absent labels | B for positive interpretation; D for explicitly preserved zero-label formula. `audienceSet/toneSet` in analyzer; fixture idea/empty labels | Unknown evidence looks positive. BW-44 explanations now disclose it; changing rewards requires product approval |
| Noncanonical stage increases coverage and readiness; summary subtracts covered count from five | A. Analyzer derives arbitrary explicit strings; renderer `5-covered.size`; fixtures Custom and six stages | 120%, −1 missing, and five correct Journey statuses contradict each other. Validate canonical membership for calculations; do not rewrite saved strings |
| One CTA gets 100 while limited-variation finding remains | D arithmetic plus B if interpreted as quality. C divisor and U<2 suggestion | Not a mathematical defect in distinct/total; explain and retain until separate policy approval, rather than inventing a one-CTA penalty |
| Native social CTA accepted by finding, ignored by analyzer; preview wins even when native differs | A cross-consumer inconsistency; B internal quality name. Fixture native CTA =0 but no missing finding | Agree explicit source precedence and normalization before changing the analyzer; do not assume preview is always a true CTA |
| Whitespace/padded values count toward CTA diversity; whitespace preview prevents fallback to native CTA in findings | A. Truthiness before trim in both selections; lowercasing only in analyzer | Blank can receive 100; `Join`/` Join ` falsely receive distinct-value readiness bonus; normalize under approved source contract |
| Audience/tone case differences reduce score | C/D literal-label matching, not a mathematical defect. Clear/clear/CLEAR =50 | Intentional channel differences and casing aren't semantic conflict; product approval needed before case folding |
| One nonempty trust field suppresses missing-proof findings on all LPs | C binary presence rule; B coverage label. One of two =80, no trust finding | Existing disclosure is accurate; neither verified proof nor proportional completeness. No automatic formula change |
| Attention maps TRUST_LAYER_MISSING but actual code is TRUST_PROOF_MISSING | A consumer mismatch, verified in renderer and producer | Actual trust finding falls back to 50 rather than score 35. Currently both classify as non-Strong, so this typo alone does not change inclusion/order. Correct with code-specific test, avoid overstating impact |
| Missing CTA can disappear from Attention when another recognized CTA scores 100 | A applicability mismatch: CTA_MISSING uses diversity score as its filter; fixture missing CTA attention | Important actionable field gap is hidden while its full opportunity card remains. Existing summary should derive eligibility from actionable findings, retaining order/cap |
| Absent/null LP CTA throws in findings | A. Ternary fallback covers Social branch only, then `.trim()` on undefined/null | Analyzer succeeds, capture throws, catch stores analysis null: all scores/opportunities unavailable. Immediate BW-45.1 candidate |
| Truthy numeric CTA/audience throws during analyzer normalization | A malformed optional input handling | Whole analysis unavailable. Narrow follow-up should define rejection/absence handling without stringifying arbitrary data into positive evidence |
| Two same-platform social nodes produce “Multi-platform social presence” strength | B, raw strength uses node count ≥2; one-channel fixture | Actual platform counts are correct. Strength is not a new visible feed in current dashboard; qualify/correct its wording in a consumer-aware follow-up |
| No LP/CTA-eligible nodes still yields trust/variation findings with no IDs | C applicability; raw old evidence can overstate presence (B) | BW-44 visible observation correctly says no source exists; Home filters these by applicability. Brain draft still uses raw finding evidence/description. Do not claim current dashboard repeats the older false explanation |

`isValidInsightsDiagnostic` checks several finite scores/arrays, not canonical membership, score semantics, or even finite funnel confidence directly. It does not prevent the 120% result. “Validation passed” is not proof of score correctness.

## Representative production-function fixture results

Fictional disposable data only; duplicate title `Same title`, unique IDs except dedicated existing duplicate-ID regression. These cases run the actual extracted production functions through the existing runtime harness: analyzer, finding builder, calculate/capture and renderer. Canvas inputs are asserted unchanged. Production formulas were not reimplemented to produce expected values. Structural truths are compared independently of the current numeric outputs: six canonical slots cannot exist; missing CTA must not invalidate all analysis; blank labels are not evidence of fit; a field gap is actionable despite other CTAs' diversity.

Score vectors below are **readiness / funnel / ICP / tone / trust / CTA**. “Available” means runtime diagnostic snapshot with analysis; empty Canvas deliberately has no snapshot. Table values are current behavior, not target expectations.

| Fixture | Current score vector | Runtime result / structural truth |
| --- | --- | --- |
| empty | 55 / 0 / 90 / 90 / 35 / 0 | null; Raw analyzer only; UI correctly shows empty state. |
| idea | 60 / 20 / 90 / 90 / 35 / 0 | available; Four canonical stages absent; no ICP/tone evidence despite 90/90. |
| small incomplete | 70 / 60 / 90 / 90 / 35 / 0 | available; Awareness/Interest/Conversion; blank LP CTA receives important finding. |
| complete-looking superficial | 100 / 100 / 90 / 90 / 80 / 100 | available; 21 nodes; five stages, unique nonsemantic actions, one-character proof and body; no findings despite low substantive quality. |
| different audiences | 55 / 40 / 55 / 90 / 35 / 0 | available; Label differences alone trigger ICP; no semantic conflict established. |
| case labels | 45 / 20 / 55 / 50 / 35 / 0 | available; Teams/teams differ; Clear/clear/CLEAR are three tones. |
| empty labels | 60 / 20 / 90 / 90 / 35 / 0 | available; Whitespace-only audience ignored; absent evidence still 90/90. |
| single CTA | 60 / 20 / 90 / 90 / 35 / 100 | available; 100 diversity plus limited-variation finding; not CTA quality. |
| identical CTAs | 60 / 20 / 90 / 90 / 35 / 50 | available; Case folds only: Join/JOIN become one distinct of two. |
| distinct CTAs | 70 / 20 / 90 / 90 / 35 / 100 | available; Two recognized strings, missing four canonical stages. |
| native CTA | 60 / 20 / 90 / 90 / 35 / 0 | available; Native social.cta satisfies presence but analyzer scores zero. |
| preview overrides native | 60 / 20 / 90 / 90 / 35 / 100 | available; Native Join and preview Read: analyzer/finding prefer Read. |
| whitespace preview hides native | 60 / 20 / 90 / 90 / 35 / 100 | available; Blank preview blocks valid native fallback; missing CTA alongside 100. |
| whitespace CTA | 60 / 20 / 90 / 90 / 35 / 100 | available; Blank LP CTA gets 100 but important missing finding. |
| padded CTA values | 70 / 20 / 90 / 90 / 35 / 100 | available; Join and padded Join falsely distinct; readiness gains 10. |
| partial trust | 80 / 20 / 90 / 90 / 80 / 100 | available; One of two trust fields populated; 80 and no trust finding. |
| no landing | 65 / 40 / 90 / 90 / 35 / 0 | available; No trust source, but global trust/variation findings have no IDs. |
| one channel | 70 / 20 / 90 / 90 / 35 / 100 | available; Two LinkedIn nodes; raw multi-platform strength is false. |
| two channels | 70 / 20 / 90 / 90 / 35 / 100 | available; LinkedIn/Instagram counts differ; scores same as one channel. |
| explicit inferred | 80 / 100 / 90 / 90 / 35 / 100 | available; Idea Retention + Content Consideration + LP imply all five; explicit/inferred roles accumulate. |
| custom stage | 65 / 40 / 90 / 90 / 35 / 0 | available; Idea plus Custom counted as two; four canonical stages still missing. |
| six stages | 85 / 120 / 90 / 90 / 35 / 0 | available; Five canonical stages + Custom; 120%, summary −1 missing, five covered Journey stages. Analyzer does not emit stage-gap finding. |
| missing CTA attention | 70 / 20 / 90 / 90 / 80 / 100 | available; Important CTA_MISSING exists on b but absent from Attention because recognized value scores 100. |
| missing LP object | 60 / 20 / 90 / 90 / 35 / 0 | unavailable; Analyzer succeeds, finding .trim throws; entire analysis becomes unavailable. |
| missing CTA property | 60 / 20 / 90 / 90 / 35 / 0 | unavailable; Same exception with LP object present and CTA property absent. |
| null CTA | 60 / 20 / 90 / 90 / 35 / 0 | unavailable; Null .trim throws in finding builder. |
| numeric CTA | unavailable | unavailable; Analyzer toLowerCase throws for 42; no valid results. |
| numeric audience | unavailable | unavailable; Analyzer .trim throws for 42; no valid results. |
| malformed social | 60 / 20 / 90 / 90 / 35 / 0 | available; Number social:42 yields no recognized fields; missing CTA, no crash in this particular case. |
| duplicate titles | 70 / 20 / 90 / 90 / 35 / 100 | available; Two different IDs with Same title; findings/navigation must use IDs. |

### Findings, evidence and prioritization

The single comparator sorts severity ascending (`critical`, `important`, `opportunity`, `information`), structural relevance descending, affected-ID count descending, weight descending, category (`structure`, `funnel`, `strategy`, `content`), code, then first ID. Final engine slice is five. There is no independent business-impact score. Existing mutually exclusive CTA missing/variation conditions mean these templates can produce at most five findings. No new feed or cap is justified.

| Code | Trigger; applicability and evidence | Severity / structural relevance / weight / affected IDs |
| --- | --- | --- |
| `CTA_MISSING` | LP or Social with selected blank CTA; LP uses `landingPage.cta`; Social `preview || cta || ""`; blanket “clear next step” wording exceeds pure presence | important / 3 / 3 / missing eligible nodes |
| `FUNNEL_STAGE_GAPS` | Canonical missingStages nonempty; covered and missing names; no existing node can represent an absent stage | important when ≥3 missing, otherwise opportunity / 4 / missing count / none |
| `TRUST_PROOF_MISSING` | Analyzer trust suggestions; associated blank LPs; may fire with zero LPs. One populated page disables it even if others blank | opportunity / 2 / 2 / blank LPs only |
| `ICP_VARIATION` | More than one distinct trimmed audience; labels are evidence of difference, not conflict | opportunity / 2 / 2 / all populated audience nodes |
| `TONE_SHIFTS_HIGH` | More than two distinct trimmed tones; old “most similar/few variations” description is not established | opportunity / 1 / 1 / all populated tone nodes |
| `CTA_VARIATIONS_MISSING` | U<2 and no eligible missing CTA; no analyzer `cta.values` property actually exists, so bounded currentValues is empty | opportunity / 2 / 1 / all eligible CTA nodes, including zero nodes |

IDs are sorted strings; duplicate IDs are not deduplicated in the producer. Render-local unique-ID indexing and checked resolver reject ambiguous destinations. Three sources are a compact preview, with every remaining ID accessible; preserve this. Evidence/current/missing lists trim, deduplicate and bound to eight strings of 160 characters, and shallow-frozen findings can retain original node objects. BW-44 intentionally uses current field/index data rather than treating retained nodes as an authoritative evidence copy.

Structural urgency is consistent with the comparator: three-or-more missing stages rank before missing CTA because both are important and relevance 4 outranks 3. Missing CTA ranks before an opportunity-level stage gap. Among opportunities, many affected CTA nodes can outrank a trust finding of greater weight; node count precedes weight. These are existing policies, not demonstrated marketing impact. An intentional single-stage campaign can legitimately receive a prominent gap finding. BW-44 frames this as a review question; retain that qualification.

The full opportunity list is the authoritative ordering. Attention is a filtered first-three orientation summary with the two defects described above, not a second ranking. Fix those consumers within the original ordering. Do not assign conversion/revenue uplift or automatic urgency to every missing stage.

Canvas handoffs retain exact ID/type, first applicable target, no fake destination for missing stages, strict saved-scope double capture and stale/removed-button cancellation. The authenticated Insights request is `{source:"insights",board_id,node_id,node_type,expected_scope:{updated_at,brand_id,workspace_id}}`, with explicit paired `hidden` association markers only for the real redacted viewer projection. Default Brain remains `{board_id,node_id,scope_revision}` and EDIT. Anonymous/public navigation is local. Unsaved new IDs cannot acquire checked saved references; saved IDs with working edits verify identity/access, not saved content quality.

Ask AI Brain remains editor-only and editable without submit. Its descriptor holds exact IDs, but composed text includes titles/types rather than those IDs, is capped at 2,000 characters and can truncate later instructions. Duplicate titles and raw generic trust/tone evidence therefore remain limitations. Do not claim every current handoff already communicates unambiguous exact-ID evidence to the model. Fixing that future semantic handoff requires the established authorized request-local Node #N mapping, not invented labels or title matching.

## Campaign Creator V3 reuse decision

Names/contracts above exist on current main. `evaluateCampaignV3Quality(normalizedNodes=[],setup={},context={})` calls `evaluateCampaignV3StrategicDiagnostics(sourceNodes,normalizedSetup,fallbackContext)`, which calls `addCampaignV3StrategicSocialDiagnostics(node,sourceNodes,setup,context,optimizationIssues)` per node. Direct evaluation is synchronous, does not fetch, generate, repair or persist. The social helper mutates its caller-supplied issue accumulator, not the Canvas. These are pure evaluation boundaries in context, not safe entry points via their generation wrappers.

Current call sites are the generation compatibility workflow `runCampaignV3AICompatibility` after normalization/fallback before planning, and reevaluation inside `runCampaignV3QualityRepairLoop` after repairs. The wrappers can invoke inference, mutate generated candidates, adapt/commit Canvas and log diagnostics. Never call them from Insights. Generation error fallback can also report perfect placeholder quality results; importing a stored generation result would compound provenance and error-state problems.

| Existing intelligence | What it actually establishes | Saved-Canvas reuse assessment |
| --- | --- | --- |
| Required title/body, LP header/problem/solution/trust/CTA; email subject/CTA regex | Structure/presence; email CTA detection is lexical English keyword matching | Most fields available; saved `description` not guaranteed; top-level Canvas labels differ from generation metadata; validate applicability independently |
| Generic/internal LP title/claim/solution, short/generic trust, Learn more/invitation context | Limited content-quality evidence from known phrases/length/offer tokens | Potentially reusable small predicates; language and false-positive limits explicit; invitation check requires real setup context |
| Duplicate variation titles/social captions, variation token Jaccard ≥0.92 | Literal/lexical duplication, not redundant strategy | Current text available; duplication may be deliberate. Needs exact persisted ID and field provenance adapter; no title-based targets |
| Placeholder titles, fallback language, label-only/short bodies | Known generic/short-copy patterns, not writing excellence | Useful evidence candidates, no justified new dashboard score. Some messages point to content while combined text includes structured LP fields |
| LinkedIn length/90-word/paragraph/takeaway checks; X >280; TikTok hook; Instagram visual/community terms | Heuristic platform conventions; not actual audience fit or platform-specific performance | Platform/body often available, but missing/unknown platform defaults to LinkedIn. English regexes can penalize German and short intentional formats; no universal requirements |
| Offer mismatch and invitation context | Keyword overlap with `setup.offer/valueProposition/campaignIdea/additionalContext` | Original generation setup is not reliably recoverable from a saved Canvas. Do not synthesize it from an unrelated node or unauthorized canonical Brand |

Validation returns `ok/structuralOk`, issues with `code,severity,type,tempId,nodeIndex,title,field,value,message`, counts and `score/structuralScore`. Score is `max(0,round((totalChecks−2×errors−warnings)/totalChecks×100))`, `totalChecks=max(nodes×3,issues.length,1)`. “Structural” already includes some copy-quality checks. Optimization returns weighted heuristic issues, with `strategicScore=max(0,100−min(30,totalWeight))`; dimensions specificity/differentiation/audienceFit have the same capped penalty pattern, while offerClarity/outcomeClarity/brandBrainAlignment are null. Overall = round(70% structural +30% strategic). These weights and 70-point floor are generator conventions, not validated Insights policies.

Five direct production evaluation probes also preserve inputs: empty array yields structural/strategic/overall **100/100/100**; Idea with empty body **33/100/53**; LP with absent LP structure **0/95/29**; short social body **100/77/93**; LP with generic `Learn more` and one-character trust **0/95/29**. The social probe uses the fixture's short generic content fallback, demonstrating that CTA/preview are not the evaluated caption. All return `repairRecommendation.shouldRepair=false`, zero targets. Unknown dimensions stay null. Empty strategic 100 and “audienceFit” based on channel conventions are strong evidence against score import.

Node identity uses `tempId || id`, `sourceNodes.indexOf(node)` and a field string; generation temp IDs can be replaced by the Canvas adapter. Neither issue objects nor their `confidence` labels contain independently authorized saved scope, timestamp or exact-ID reference metadata. Some combined text values are not exact quotes from the advertised field. They need a current-source adapter before Insights can present them as attributable evidence.

**Architecture decision:** later, a small deterministic helper accepting explicitly normalized strings and returning limited field-level observations could serve both paths. It must have explicit applicability/language handling, no wrapper calls or aggregate score import, no writes, exact persisted-ID provenance on the Insights side and freshness dependencies for all inspected fields. No shared extraction or new findings engine is implemented or prioritized for BW-45.1.

## AI Brain boundaries and narrow future opt-in workflow

| Review question | Deterministic evidence available | Semantic judgment still needed |
| --- | --- | --- |
| Does CTA communicate the next step? | Presence, selected field, literal wording; known generic phrase | Whether action/destination is clear for this audience and offer |
| Does messaging resonate with ICP? | Entered audience labels and actual content | Relevance, motivation and fit; labels alone cannot decide |
| Are objections addressed? | Supplied problem/solution/trust text and missing fields | Which objections matter and whether proof answers them; truth needs independent evidence |
| Is tone right for the channel? | Tone labels, platform, length/paragraph/keyword conventions | Intended voice, audience expectations and purposeful channel variation |
| Is positioning aligned with Brand DNA? | Only explicitly authorized Brand context through existing Brain path | Interpretation of positioning and conflicts; analyzer does not consume Brand DNA |
| Does content support the goal? | Explicit goal/stage mapping and source text | Whether the argument and offer serve the goal; no business-outcome prediction |

Keep the existing Ask AI Brain action. A future narrowly scoped opt-in improvement can prepare an editable question asking to review one finding against its current affected nodes, quote bounded actual fields, distinguish saved content from working edits, and ask whether label differences are intentional. Resolve exact persisted identities through the existing authorized request-local Node #N map; preserve duplicate-title safety and stale history invalidation. Do not add invented positional labels, new JSON envelopes, background evaluation, automatic submit or a new analysis route.

The user explicitly submits the existing composer. The existing advice handler independently checks identity/Board EDIT scope, loads the saved campaign Brand snapshot, authorizes canonical Brand separately through `canViewCanonicalBrandCore`, and includes approved Brand Learnings under their existing context budget and precedence rules. Working Canvas is a bounded allowlisted projection, not arbitrary state. Missing/omitted content must be acknowledged. Do not widen VIEW to Advice. Existing model selection (`OPENAI_AI_BRAIN_MODEL`, existing fallback), provider route, token budgeting and cost boundaries remain. This audit executes no paid inference; provider responses in existing contract tests are mocks.

Semantic advice remains a qualified recommendation with assumptions. It does not become a numeric diagnostic, verified proof, measured performance or an automatic Canvas/Brand write.

## Exactly three prioritized improvements

### 1. Safe optional fields and coherent CTA evidence

1. **Problem:** undefined/null LP CTA throws; truthy malformed strings can also abort analysis; analyzer excludes native social CTA while missing-field finding accepts it; whitespace handling disagrees.
2. **User consequence:** all diagnostics disappear on a partially populated saved page; other Canvases show missing CTA alongside 100 or native CTA alongside 0.
3. **Verified source:** `buildInsightsFindings` ternary `.trim()`; analyzer C selection/lowercasing; runtime fixtures missing LP/property/null, whitespace and native CTA.
4. **Correction:** first safely default missing/null optional LP CTA to empty within the existing predicate. Separately agree a typed per-node CTA observation contract, then use the same chosen source and trim/lowercase rules in analyzer, findings and disclosure. Do not silently select precedence or coerce arbitrary objects/numbers into proof.
5. **Benefit:** diagnosis stays available and numbers explain the same field observations as findings.
6. **Complexity:** low for null/undefined fallback; medium for the full typed/source alignment, including consumer inventory and EN/DE disclosure changes.
7. **Regression risk:** low for default-string preservation; medium for source normalization and older Boards. Retain fail-closed behavior for unrelated truly malformed values in the minimal first patch.
8. **Authorization/provenance:** local working evidence only; no authorization expansion. Preserve ID/type, snapshot freshness and saved/unsaved navigation contracts. Native CTA already participates in fingerprint; richer fields require dependency review.
9. **Required tests:** missing LP object/CTA/null, explicit empty, whitespace, native-only/preview-only/both distinct, padded/case-only/repeated values, malformed truthy values, noneligible node fields, unchanged input/zero calls, Home parity and all existing runtime/reference/Journey regressions.
10. **Historic comparability:** minimal absent/null handling restores previously unavailable results and preserves valid-input scores. Normalization/source alignment will change some readiness/CTA values and must be separately explained; do not backfill persisted Canvas or fabricate prior scores.

### 2. Canonical, consistent funnel coverage

1. **Problem:** arbitrary explicit stage strings enter numeric S while missingStages and Journey use five canonical names.
2. **User consequence:** 120% coverage, −1 missing and inflated readiness; custom stage can hide a genuine gap from the attention filter.
3. **Verified source:** analyzer derivedStages/coveredStages, summary `5-covered.size`, canonical Journey; six-stage and Custom fixtures.
4. **Correction:** filter calculated coverage to the established exact five canonical names after existing derivation, preserving all existing type/goal inference and authored custom strings. Derive counts consistently from canonical coverage/missingStages. Explicitly disclose unrecognized authored stages; do not guess synonym/case mappings without product agreement.
5. **Benefit:** coverage/counts/Journey agree and mathematically impossible results disappear.
6. **Complexity:** low to medium, including consumer and fixture updates.
7. **Regression risk:** historic custom-stage Boards can lose five readiness points per invalid distinct value and have changed finding severity/Attention inclusion. Canonical-only Boards should remain byte-equivalent in result values.
8. **Authorization/provenance:** deterministic current Canvas only, no content writes; custom labels remain inspectable in their original nodes. Reference and authorization contracts unchanged.
9. **Required tests:** each canonical stage; type inference; explicit plus inferred roles; custom/case/space/numeric stages; all five plus custom; >5 custom values; coverage 0–100; canonical missing count and Journey parity; input immutability; Home/shared analyzer parity; no writes/inference.
10. **Historic comparability:** yes for invalid/custom-stage inputs; classify as data-validation correction and disclose before/after fixtures. No reweighting or retrospective data migration.

### 3. Attention aligned with actionable findings

1. **Problem:** attention maps a nonexistent trust code and filters missing CTA by diversity of other CTAs; high custom coverage can similarly mask stage gaps.
2. **User consequence:** executive orientation can omit a real important missing-field opportunity while the detailed card remains below.
3. **Verified source:** renderer attention map/filter and fixture one populated plus one empty LP CTA; actual engine codes/ranking.
4. **Correction:** use actual emitted codes and explicit applicability of existing actionable findings for summary eligibility; retain engine ordering and existing three-item summary cap. Canonical-stage fix resolves invalid-stage score masking. Do not add priority scores or a second comparator.
5. **Benefit:** structural omissions remain discoverable consistently from summary to card.
6. **Complexity:** low, with focused code-to-summary integration tests and deliberate retained summary-policy contract.
7. **Regression risk:** low numeric risk; visible summary membership changes. Simply fixing trust spelling produces no current inclusion change because both values are below Strong; do not sell the typo as the main benefit.
8. **Authorization/provenance:** unchanged snapshot and original finding IDs; attention still scrolls to the existing card, never resolves new destinations or calls inference.
9. **Required tests:** missing CTA at variation 100 and 0; real trust code; stage gaps under high coverage; order/cap parity; no fabricated empty-source destinations; EN/DE/keyboard and reduced-motion scroll; full cards untouched.
10. **Historic comparability:** no component or readiness score changes from this improvement alone; summary visibility changes only. Any broader summary-eligibility policy must be explicit in the follow-up PR.

## Minimal implementation boundaries, acceptance and deferred work

**Immediate BW-45.1:** only absent/null Landing Page CTA finding safety. One narrow implementation PR. It is a data-handling repair, not approval to implement all three recommendations. A malformed truthy numeric/object CTA can remain the existing unavailable state until a typed-input policy is agreed. Explicit empty/whitespace strings must continue to yield missing findings.

**Separate follow-ups:** canonical-stage validation (improvement 2), then CTA observation/source normalization (remaining improvement 1, with product-approved precedence), then attention consistency (improvement 3; can be reviewed independently, with canonical results as baseline). The top three should not ship as one broad PR: availability restoration, altered scores and altered summary membership have different regression/comparability boundaries.

**Scoring-policy approval required:** whether no audience/tone should be unknown rather than rewarded; case normalization for labels; authoritative Social CTA versus legacy preview precedence; single-CTA diversity interpretation; trust proportionality/no-LP applicability; CTA Good-foundation override; readiness weights/base; and broader Attention inclusion policy. Canonical membership filtering is a proposed defect correction with numeric consequences, not an approved reweighting. None is implemented by this audit.

**Acceptance for the minimal patch:** absent LP object, `{landingPage:{}}`, and `cta:null` remain diagnosable, produce important `CTA_MISSING` on the exact ID, and preserve all other analysis/finding ordering. Valid existing fixtures keep scores and snapshots. Empty Canvas retains unavailable/empty UI; unsaved source identity and Home parity hold. No Canvas/history/Brand mutation, provider request, schema change or new route. Interactive stages, all-source expansion, duplicate-title exact destinations, viewer/default-EDIT isolation, stale/in-flight cancellation and retry behavior remain verified.

**Deferred:** formula redesign, new weighted quality scores, semantic scoring, verified-proof assessment, measured analytics, generator helper extraction, persisted intelligence/history and database migration. No arbitrary quotas/limits, output schema, dashboard redesign or auto-optimization. A future shared helper must be evaluated with language/format false-positive fixtures before product promotion. No claim that structurally complete campaigns will convert or generate revenue.

### Complete directly copyable BW-45.1 implementation prompt

```text
# TENDRA ONE — BW-45.1: Preserve Insights on absent Landing Page CTA fields

Repository: Funklix/Funklix. Base: latest merged main, including PR #854
and the BW-45.0 audit. Read AGENTS.md and
docs/audits/bw45-insights-quality-strategic-intelligence.md first.
Verify function names and contracts against current main.

Implement only the immediate missing/null optional-field safety correction
from recommendation 1. Do not implement the rest of that recommendation,
the canonical-stage correction, attention changes, or any scoring-policy change.

Current defect:
In app.js, buildInsightsFindings selects missingCta with a ternary whose
Landing Page branch is node.landingPage?.cta, then calls .trim() on its result.
If landingPage or its cta property is absent, or cta is null, this throws.
calculateInsightsDiagnostic catches the exception and makes all analysis
unavailable even though analyzeCampaign can calculate this Canvas.

Required correction:
Safely default only absent/null Landing Page CTA to an empty string before
the existing .trim() check. Keep the current Social preview/native CTA
selection and all string behavior unchanged. Do not stringify arbitrary
objects/numbers into CTA evidence. Retain existing unavailable behavior for
unrelated truly malformed inputs. Do not catch and discard individual
findings or change global diagnostic failure handling.

Preserve analyzeCampaign, readiness weights/base/clamp, all six formulas,
stage mappings, audience/tone handling, trust rule, CTA variation policy,
classification thresholds/override, findings codes/severities/comparator/cap,
attention filtering, snapshot shape and exact-ID navigation authorization.
No Canvas/Brand/history writes, migrations, inference, dependencies, routes,
new pipeline or dashboard redesign. Preserve BW-43/BW-44 explanations,
interactive Journey, all-source access, Refresh and editable Ask AI Brain.

Extend the existing scripts/check-bw28-3-1-insights-runtime-rendering.js
production harness with missing landingPage, empty landingPage object,
missing cta property and cta:null fixtures. Assert production calculation
and rendering remain available, important CTA_MISSING names the exact LP
ID, fields are unchanged, and no provider/write boundary is used. Cover
empty string, whitespace and valid CTA as unchanged controls; mixed LP/Social
and Home shared-analysis behavior must stay consistent. Existing truthy
malformed values must not become fabricated positive evidence.

The existing test pins buildInsightsFindings by exact SHA-256. Because this
prompt explicitly authorizes changing that function, update only its exact
expected digest after checking the diff and new regression assertions.
Keep all other producer/handoff fingerprints, assertions, SQL/security/
authorization pins and regression coverage unchanged. Explain the authorized
digest update; never replace it with dynamic/wildcard expectations.

Run focused BW-25, BW-28/runtime, Home/Insights, BW-40/BW-40.1,
BW-43 and BW-44.3 checks with fictional fixtures and mocked providers only.
Investigate/report inherited failures without weakening tests or making
unrelated repairs; BW-45.0 initially observed a BW-43 Expanded Journey sources reflow
failure; the identical isolated rerun passed all 48 cases.
Report exact current results and full CI separately from local checks.

Document changed behavior, valid-score parity, restored formerly unavailable
inputs, tests, risks and publication safety. Work on a dedicated branch;
commit/push and open exactly one normal non-draft PR against latest main.
Verify draft:false and the actual file diff. No merge or manual deployment.
Return PR URL, base/commit, tests, review findings and remaining uncertainty.
```

## Validation, publication review and remaining uncertainty

The production-function matrix above and direct V3 probes ran without paid calls and with immutable input assertions. Existing tests use fictional data; server Advice tests mock provider output and verify call boundaries, rather than invoking providers. Audit execution does not run generation/repair as an Insights read side effect.

| Existing check | Result on audited code |
| --- | --- |
| `check-bw25-honest-ai-insights-baseline.js` | PASS |
| `check-bw25-1-dynamic-insights-translations.js` | PASS |
| `check-bw28-ai-insights-architecture.js` | PASS, 86 architecture contracts |
| `check-bw28-1-insights-ux-and-brain-handoff.js` | PASS, 39 regression contracts |
| `check-bw28-3-premium-insights-and-brand-avatar.js` | PASS |
| `check-bw28-3-1-insights-runtime-rendering.js` | PASS, 46 original contracts plus BW-44 contrasts and all eight unchanged producer/handoff hashes |
| `check-bw40-node-references.js` | PASS, real resolver/authorization with disposable SQL and mocked Advice |
| `campaign-v3-harness.js` | PASS, 14 plan/layout/commit mock cases including expected-invalid cases |
| `check-bw36-21b2-home-insights-brain.js` | PASS, 30 groups including 20,000-node parity and zero providers/writes |
| `check-bw40-node-references-browser.js` | PASS, authenticated editor/viewer Insights navigation, Brain exact IDs, pending lifecycle and public isolation |
| `check-bw40-1-prompt-shortcuts-browser.js` | PASS, all six focuses, editable insertion, keyboard and no submit |
| `check-bw44-2-journey-context-browser.js` | PASS, current BW-44.3 20 responsive theme/language cases, native zoom and checked exact IDs |
| `check-bw43-native-zoom.js` | PASS: CSS width 720, outer width 1440, DPR 2, visual scale 1 |
| `check-bw43-insights-browser.js` | Initial FAIL at Expanded Journey sources reflow; identical isolated rerun PASS all 48 combinations. Cause unconfirmed; not a resolved application defect claim |
| `check-browser-script-integrity.js` | PASS, 48 local classic scripts |
| `check-bw36-14-stable-campaign-creation.js` | PASS, signed transaction/replay checks plus retained context/logo/roles/DOM/themes/reflow |

Initial sandboxed Home and Canvas-creation browser launches failed at Chromium startup. Running the unchanged checks with the supported browser execution permission resolved that environment limitation. No assertions or harnesses were modified. The BW-43 assertion failure was a separate real test outcome and is reported above even though its isolated rerun passed. No full PostgreSQL 17.6/18.4 workflow was run locally for this documentation-only audit.


Publication self-review checks this document for repository-only source references, fictional fixtures, no credentials/customer records/internal operational logs, no unsupported marketing claims and clear separation of evidence from recommendations. Scratch scripts, logs, browser profiles, dependencies and screenshots are excluded from the publication. Only this Markdown file is committed on the main-based publication branch. Self-review is not independent human approval.

Remaining uncertainty: heuristics have not been validated against marketing outcomes; language/platform conventions have no universal quality guarantee; browser results are Chromium-specific and do not establish manual screen-reader or other-engine behavior. The narrow null/undefined repair is not implemented here. Full PostgreSQL CI matrix status must be read from this PR's checks and must not be inferred from focused local checks. The initial BW-43 Journey reflow failure did not reproduce on the identical isolated rerun (48 cases passed); its cause remains uncertain. No test or product code was changed to obtain the pass.


## Reproduce the audit-only fixture probes

Run from the repository root at the audited commit with existing dependencies installed. This uses the existing runtime harness and exact production V3 evaluator block. It does not execute the generator or repair loop. The assertions retaining current 120/100/unavailable outputs below are characterization evidence of defects, not acceptance criteria for future corrected behavior. The future acceptance criteria are stated separately above.

```sh
node <<'NODE'
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const test=fs.readFileSync('scripts/check-bw28-3-1-insights-runtime-rendering.js','utf8');
const ctx={require,console,structuredClone};vm.createContext(ctx);
vm.runInContext(test.slice(0,test.indexOf('let h=render();'))+'\nglobalThis.H=harness;globalThis.R=render;globalThis.F=functionSource;',ctx);
const n=(id,type='Idea',extra={})=>({id,type,title:'Same title',content:'Fictional',...extra});
const lp=(id,cta='Join',trust='')=>n(id,'Landing Page',{landingPage:{cta,trust}});
const social=(id,cta='',preview='',platform='LinkedIn')=>n(id,'Social Media Posting',{social:{cta,preview,platform}});
const cases=[
 ['empty',[]],['idea',[n('i')]],
 ['small incomplete',[n('i'),n('c','Content'),lp('l','')]],
 ['complete-looking superficial',Array.from({length:20},(_,i)=>n('n'+i,i%2?'Content':'Idea',{funnelStage:['Awareness','Interest','Consideration','Conversion','Retention'][i%5],audience:'Teams',tone:'Clear',landingPage:{cta:'Action '+i,trust:''},content:'x'})).concat(lp('l','Join','x'))],
 ['different audiences',[n('a','Idea',{audience:'Teams'}),n('b','Content',{audience:'Founders'})]],
 ['case labels',[n('a','Idea',{audience:'Teams',tone:'Clear'}),n('b','Idea',{audience:'teams',tone:'clear'}),n('c','Idea',{tone:'CLEAR'})]],
 ['empty labels',[n('a','Idea',{audience:' ',tone:''})]],
 ['single CTA',[lp('l')]],['identical CTAs',[lp('a'),lp('b','JOIN')]],['distinct CTAs',[lp('a'),lp('b','Read')]],
 ['native CTA',[social('s','Join')]],['preview overrides native',[social('s','Join','Read')]],
 ['whitespace preview hides native',[social('s','Join','   ')]],['whitespace CTA',[lp('l','   ')]],
 ['padded CTA values',[lp('a','Join'),lp('b',' Join ')]],
 ['partial trust',[lp('a','Join','x'),lp('b','Read','')]],['no landing',[n('i'),n('c','Content')]],
 ['one channel',[social('a','','Join'),social('b','','Read')]],['two channels',[social('a','','Join'),social('b','','Read','Instagram')]],
 ['explicit inferred',[n('i','Idea',{funnelStage:'Retention'}),n('c','Content',{funnelStage:'Consideration'}),lp('l')]],
 ['custom stage',[n('i','Idea',{funnelStage:'Custom'})]],
 ['six stages',[...['Awareness','Interest','Consideration','Conversion','Retention','Custom'].map((s,i)=>n('s'+i,'Campaign Variation',{funnelStage:s}))]],
 ['missing CTA attention',[lp('a','Join','proof'),lp('b','','')]],
 ['missing LP object',[n('l','Landing Page')]],['missing CTA property',[n('l','Landing Page',{landingPage:{trust:''}})]],
 ['null CTA',[lp('l',null)]],['numeric CTA',[lp('l',42)]],['numeric audience',[n('i','Idea',{audience:42})]],['malformed social',[n('s','Social Media Posting',{social:42})]],
 ['duplicate titles',[lp('a','Join'),lp('b','Read')]]
];
const results=[];
for(const [name,nodes] of cases){
 const before=JSON.stringify(nodes),h=ctx.H({nodes});let raw=null,error=null,findingsError=null;
 try{raw=h.sandbox.analyzeCampaign(nodes,[],{});}catch(e){error=e.message;}
 if(raw)try{h.sandbox.buildInsightsFindings(raw);}catch(e){findingsError=e.message;}
 h.sandbox.calculateInsightsDiagnostic();h.sandbox.renderInsightsSurface();
 const s=h.state.insightsDiagnosticSnapshot;
 const attention=h.cards.querySelector('.insights-attention-list')?.children.map(c=>c.textContent)||[];
 assert.equal(JSON.stringify(nodes),before);
 results.push({name,scores:raw?[raw.healthScore,raw.funnel.confidence,raw.icp.consistencyScore,raw.tone.consistencyScore,raw.trust.score,raw.cta.qualityScore]:null,covered:raw?.funnel.coveredStages,missing:raw?.funnel.missingStages,findings:s?.findings?.map(f=>({code:f.code,ids:f.affectedNodeIds})),attention,strengths:raw?.strengths,error,findingsError,snapshot:s===null?'null':s.analysis?'available':'unavailable'});
}
assert.equal(results.find(r=>r.name==='single CTA').scores[5],100);
assert.equal(results.find(r=>r.name==='six stages').scores[1],120);
assert.equal(results.find(r=>r.name==='missing CTA property').snapshot,'unavailable');
assert(!results.find(r=>r.name==='missing CTA attention').attention.includes('CTA structure needs attention'));
// Evaluate the exact pure V3 production block, with real helpers, no generation wrapper.
const app=fs.readFileSync('app.js','utf8');
const v={console,Set,Map,CAMPAIGN_CHAIN_TYPES:JSON.parse(app.match(/const CAMPAIGN_CHAIN_TYPES = (\[[\s\S]*?\]);/)[1])};vm.createContext(v);
vm.runInContext(ctx.F('cleanCampaignField')+'\n'+ctx.F('campaignV3NodeCounts')+'\n'+app.slice(app.indexOf('function campaignV3QualityNormalized('),app.indexOf('const CAMPAIGN_V3_REPAIRABLE_ISSUE_CODES')),v);
const qualityCases=[['empty',[]],['idea empty body',[n('i','Idea',{content:''})]],['missing LP',[n('l','Landing Page')]],['short social',[social('s','Join','Read')]],['generic proof',[lp('l','Learn more','x')]]];
const quality=[];for(const [name,nodes] of qualityCases){const before=JSON.stringify(nodes);const q=v.evaluateCampaignV3Quality(nodes,{},{});assert.equal(JSON.stringify(nodes),before);quality.push({name,score:q.score,strategic:q.strategicScore,overall:q.overallScore,dimensions:q.strategicDimensions,issues:q.issues.map(i=>({code:i.code,tempId:i.tempId,index:i.nodeIndex,field:i.field})),optimization:q.optimizationIssues.map(i=>i.code),repair:q.repairRecommendation});}
for(const r of results)console.log(r.name+' | '+(r.scores||'ERROR')+' | '+r.snapshot+' | '+(r.findings?.map(f=>f.code).join(',')||r.error||r.findingsError||''));
console.log(JSON.stringify(quality,null,2));
NODE
```
