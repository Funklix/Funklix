# BW-45.1 — Preserve Insights on missing Landing Page CTA fields

## Scope and correction

Base: `e775e6770bf67bcee0f421e56553e5022cb3b726`, latest merged main including PR #855. Implementation follows the immediate BW-45.1 boundary in [the approved audit](../audits/bw45-insights-quality-strategic-intelligence.md).

`buildInsightsFindings` selected `node.landingPage?.cta` and called `.trim()` on the result. An absent Landing Page object, missing CTA property or null CTA therefore threw after `analyzeCampaign` succeeded. The unchanged global diagnostic handler then stored `analysis: null`, hiding all Insights diagnostics.

The only application edit is the Landing Page branch of that existing predicate:

```js
node.type === "Landing Page" ? (node.landingPage?.cta ?? "") : node.social?.preview || node.social?.cta || ""
```

Only null/undefined become an empty string before the existing trim check. No authored value is filled or normalized. Valid strings, whitespace behavior and Social preview/native precedence retain their existing meaning. Objects, numbers and other unrelated malformed values retain unavailable behavior; the handler and finding collection are unchanged.

## Before and after

Vectors are readiness / funnel / ICP / tone / trust / CTA from actual production functions. The single fictional Landing Page has no trust, audience or tone. Its ID is `actual-landing-id`; duplicate titles never determine identity.

| Input | Before | After | Score vector after |
| --- | --- | --- | --- |
| Absent/null `landingPage`, empty object, missing/undefined/null `cta` | Whole analysis unavailable | Full original sections; important `CTA_MISSING` on exact Landing Page ID | 60 / 20 / 90 / 90 / 35 / 0 |
| `cta: ""` | Available, missing finding | Same | 60 / 20 / 90 / 90 / 35 / 0 |
| Whitespace-only CTA | Available, missing finding | Same, including existing diversity score | 60 / 20 / 90 / 90 / 35 / 100 |
| Valid `Join` CTA | Available, no missing finding | Same | 60 / 20 / 90 / 90 / 35 / 100 |
| Numeric/object/array/boolean CTA | Unavailable | Same | No fabricated positive CTA evidence |

Mixed Landing Page/Social fixtures preserve Awareness plus Conversion and all original values. Missing LP CTA with Social preview `Read` scores 65 / 40 / 90 / 90 / 35 / 100. Valid or whitespace LP CTA plus `Read` scores 75 / 40 / 90 / 90 / 35 / 100. The whitespace diversity result is existing policy, preserved deliberately.

`analyzeCampaign`, all six formulas, readiness weights, stage inference, trust/audience/tone rules, findings codes/severity/order/cap, Attention filtering, snapshot shape/provenance, reference authorization, Brain handoff, Journey, Refresh, translations and visual assets remain unchanged. No API, inference, dependency, route, migration, quota or database-write change.

## Changed files and integrity

- `app.js`: one nullish fallback in `buildInsightsFindings`.
- `scripts/check-bw28-3-1-insights-runtime-rendering.js`: optional/mixed/valid/malformed regressions and the specifically authorized finding-builder digest.
- `scripts/check-bw36-21b2-home-insights-brain.js`: real-browser shared Home/Insights regression. Three existing exception fixtures now use `{cta:42}` instead of `{}` because an empty Landing Page object is valid after this repair; every original failure-isolation assertion remains.
- This implementation document.

Only the fixed expected SHA-256 for `buildInsightsFindings` changes:

- Before: `9384e4154e2c50832449abfc029391384dcbf5aa96439c15acd5f6010e24d191`.
- After: `28e1b35c3aaa37c0b7b1751972d7014b01d5ad73372918005476fdfd6f531563`.

The exact function diff was reviewed before updating the digest. All seven other producer/handoff digests and their assertions remain intact. No dynamic expected hashes or wildcard checks are introduced. Searches for both changed test files' original SHA-256 values found no dependent test-file pins requiring updates. Workflow/security/SQL/authorization checks are preserved.

## Regression and validation

The new production-path regression first failed against unchanged main at `Available analysis: no landingPage object`, reproducing the defect. After the correction, it verifies nine optional/valid Landing Page cases both alone and with Social nodes, important exact-ID findings, all six original scores, original section rendering, Refresh parity, input immutability including undefined properties, unchanged dirty state and empty Brain history. Boundary traps record and reject provider/write calls even if an application catch would otherwise hide the exception. Social precedence, unrelated malformed CTA/audience and empty Canvas controls remain covered.

The Home browser extension exercises eight optional/valid forms, compares the shared snapshot to the actual analyzer, checks the Home finding projection against the same source fields, renders all six Insights calculations, and verifies unchanged Canvas/provenance. Its fixture prohibits provider endpoints and asserts zero writes. Original account/access, source-freshness, cancellation, navigation and 20,000-node checks remain.

Local focused and complete Runtime Boot Safety results are recorded in the PR description after execution. Local matrix execution uses disposable official PostgreSQL 17.6 and 18.4 containers, all workflow run commands and original assertions. The local browser setup uses available system Chromium; hosted CI executes the workflow's matched Playwright Chromium installation. Checkout and artifact upload are hosted infrastructure actions rather than local tests. Local runner continues after individual failures to report all checks.

Hosted CI results must be read separately from this PR's GitHub Actions checks; local success does not establish hosted success. Exact head commit, workflow links and any failures/reruns are reported with delivery. No merge or manual deployment is performed.

## Review and limitations

Self-review confirms the sole application change is the requested fallback and the restored inputs now emit existing findings without writing fields. No unrelated production fix or expected-score adjustment is included. Public changes contain repository references and fictional fixtures only; credentials, customer data, scratch logs, browser profiles, dependencies and generated screenshots are excluded. This is implementation self-review, not independent human approval.

Malformed values outside null/undefined can still make analysis unavailable. Existing whitespace diversity, native Social CTA scoring, funnel coverage and Attention limitations remain as documented in the audit and require separate work. Browser evidence is Chromium-specific. Full matrix outcomes and hosted review findings remain explicit in the PR/delivery report.
