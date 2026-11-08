# BW-45.2 — Canonical Funnel Coverage

Base: `c6467be` (latest merged main including PR #856). Scope follows the verified BW-45.0 defect and the BW-45.2 implementation authorization.

## Defect and exact policy

`analyzeCampaign` previously accepted every truthy derived stage into `coveredStages` while dividing by five. Five canonical stages plus Custom returned 120% and the summary displayed six covered and −1 missing, although the Journey displayed only five covered stages. Canonical missing-stage set difference was already correct; its count could disagree with the summary.

The authoritative membership list remains Awareness, Interest, Consideration, Conversion, Retention. Only exact case-sensitive matches enter the existing de-duplicated covered set. No trim, case folding, coercion, new stage or stored-field normalization is added. Empty/missing stage fields retain their existing type/goal/CTA inference. An explicit unrecognized value is excluded as a stage, while independent existing inference still applies: Idea + Custom covers Awareness; Email Campaign + Custom alone covers nothing. Case/whitespace variants behave the same way as other unrecognized values.

Production inspection found that explicit canonical values are added first and independent inferred roles accumulate; they did **not** suppress inferred roles on main. This patch preserves that exact existing behavior and insertion order, including Idea + Retention covering Retention and Awareness. Explicit canonical values are never replaced with inferred values. Introducing override-only semantics would change valid existing Canvas results and is outside this correction.

Funnel Coverage measures recognized structural stage presence, not the effectiveness of the customer journey.

## Implementation and consumers

The only calculation edit replaces `derivedStages.filter(Boolean)` with `derivedStages.filter((stage) => stages.includes(stage))` before the existing Set. All upstream mapping predicates, readiness arithmetic/weights/base/clamp/rounding, other scores and classifications remain byte-identical.

Before editing, inspected `analyzeCampaign`, `calculateInsightsDiagnostic`, `captureInsightsDiagnostic`, `buildInsightsFindings`, `renderInsightsSurface`, `insightsNodeSupportsStage`, stage-selection handlers, checked source navigation and the shared Home functions. Their dependency graph already uses this covered set for count/percentage/readiness, canonical set difference for missing stages, and exact canonical source predicates for the five Journey stages. No second calculation or association system is necessary. The existing gap finding now receives canonical covered evidence/currentValues, with unchanged missing-stage list, severity/category/comparator/action policy and zero affected IDs for absent stages. Its rank relative to other findings stays governed by the existing comparator.

The existing EN/DE funnel explanation now describes canonical-only counting and preserved independent inference. Source cards still show authored Custom fields verbatim when a node supports a stage by an existing inference rule. No Canvas persistence, API, SQL, authorization, stale-reference guard, UI layout/ID, Brain handoff, AI call, dependency or write path changes.

## Before/after fixtures

Fictional Email Campaign nodes have empty CTA/trust/audience/tone unless stated. Thus readiness before the stage contribution is 55. Actual analyzer results:

| Fixture | Coverage before → after | Covered/missing summary before → after | Readiness before → after |
| --- | --- | --- | --- |
| Empty Canvas (raw analyzer; UI continues withholding scores) | 0 → 0 | 0/5 → 0/5 | 55 → 55 |
| One inferred Idea / Content / Landing Page | 20 → 20 | 1/4 → 1/4 | 60 → 60 |
| Five explicit canonical stages | 100 → 100 | 5/0 → 5/0 | 80 → 80 |
| Five canonical plus Custom | 120 → 100 | 6/−1 → 5/0 | 85 → 80 |
| Custom alone, unmapped node type | 20 → 0 | 1/4 → 0/5 | 60 → 55 |
| Idea with Custom | 40 → 20 | 2/3 → 1/4 | 65 → 60 |
| Repeated Retention on two nodes | 20 → 20 | 1/4 → 1/4 | 60 → 60 |
| Retention plus inferred Content | 40 → 40 | 2/3 → 2/3 | 65 → 65 |
| Idea explicitly Retention | 40 → 40 | 2/3 → 2/3 | 65 → 65 |

The summary's previous subtraction is shown above; actual canonical `missingStages` was already 0/5/4 for the full-plus-Custom/Custom-only/Idea-plus-Custom examples respectively. It now agrees with the summary. For every valid result, covered and missing partition the canonical list, total five, each unique; percentage is the existing rounded covered/5 × 100.

Only results containing a previously counted unrecognized derived value change. Readiness loses five pre-clamp points per distinct such value; its original clamp can mask some or all of that difference. No weights are retuned to recover inflated scores. CTA, ICP, Tone, Trust and channel results are unaffected. Custom node fields remain byte-for-byte unchanged.

## Integrity safeguard

The existing exact SHA-256 assertion in `scripts/check-bw28-3-1-insights-runtime-rendering.js` pins `analyzeCampaign`. After reviewing the one-line production diff, its expected literal alone changes from `4b94ff14b905fe4dbd1c30d01d81c9981698bf3199e1ab9d69b9647ae2443558` to `628dd9d9f3dcd52bac2d17289ee0c377b7f5b5ade357837b792f011df4bde217`. Hash algorithm and equality comparison remain unchanged. All seven other producer/identity/findings/handoff pins remain unchanged. The original Custom fixture now expects the explicitly authorized corrected vector (60/20/90/90/35/0 instead of 65/40/90/90/35/0). No test is disabled or weakened and no security/SQL producer check is changed.

## Tests and regression evidence

The existing production runtime suite gains all requested analysis input contrasts, all 32 canonical subsets plus repeated values and Custom, partition/score/source invariants, actual gap finding evidence, Journey statuses/summary, saved/live-unsaved snapshots, edit/Refresh and Board switching. Side-effect traps and field-preservation assertions cover the new cases. Canonical-only results are deep-compared with the same fixtures plus an ignored Custom node; all original valid-score contrasts remain. Running the corrected regression against untouched base with its original hash literal reproduces Idea + Custom's old vector, failing 65/40 versus required 60/20.

The existing real browser Journey suite additionally loads all five canonical stages plus Custom with duplicate titles and distinct persisted IDs. It checks 100%/80 readiness, exactly one correct source per canonical stage, real checked SQL navigation to Retention/Inspector by ID, then a live Retention → Custom edit and Refresh producing 80%/75 readiness, an honestly empty Retention source panel, the existing missing-stage finding, unchanged custom data and shared Home coverage. Existing stale/revoked/pending/detached-reference and all responsive/keyboard/zoom cases remain intact. Its fixture prohibits inference and asserts no writes.

Local and hosted results will be recorded after execution; no pending matrix is claimed as passed. The unchanged Runtime Boot Safety workflow runs the extended tests on both PostgreSQL 17.6 and 18.4. Complete job outcomes and any inherited BW-43 reflow reproduction are reported with the final PR delivery.

## Review, limitations and publication safety

Self-review: calculation diff is canonical membership only; all directly dependent consumers use the corrected data, with no invented missing-stage source associations. Custom preservation, canonical fixtures and explicit-plus-inferred behavior are tested. This is implementation self-review, not independent human approval.

Existing malformed optional values outside this task can still make diagnostics unavailable. Existing CTA diversity/source-selection, audience/tone equality, binary trust and Attention limitations remain as audited. Coverage does not validate graph continuity, sufficient content, strategy, measured conversion or business results. Browser evidence is Chromium-specific.

Publication review: changed files contain repository contracts and fictional fixtures only. No credentials, customer data, raw operational logs, browser profiles, screenshots or dependencies are committed. One dedicated branch and one non-draft PR against main; no merge or manual deployment.
