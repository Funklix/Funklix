# BW-45.3 — Attention and Findings Consistency

Base: `9b4799bf2bdec0543952d32a71f410f22b6678af`, latest merged main including PR #857. This is a consumer-only correction inside `renderInsightsSurface`.

## Verified mismatch and correction

Before editing, inspected the shared analyzer, diagnostic calculation/capture, snapshot freshness, finding builder/comparator, Attention, full Opportunities, existing classification rules and navigation. The existing Attention consumer discarded findings when a separately mapped diagnostic classified as Strong. A production regression on unchanged main reproduces a populated Landing Page CTA alongside a missing CTA: diversity is 100 and the engine emits important `CTA_MISSING`, but Attention omits it. The regression fails with an empty summary instead of that single finding.

Attention now takes `snapshot.findings.slice(0, 3)` using the existing array fallback. This is the already ranked engine result, with no additional eligibility test, comparator, score or generation step. Fewer findings produce fewer items; zero findings retain the existing empty state. Empty Canvas still withholds diagnostics. Every original finding remains in Opportunities, in its original order, up to the engine's unchanged five-finding cap.

Removing the redundant code-to-score map also removes its incorrect `TRUST_LAYER_MISSING` reference. The actual emitted `TRUST_PROOF_MISSING` is consumed directly like every other finding. At current Trust score 35, both the old fallback 50 and score 35 were non-Strong, so that typo alone did not change eligibility or guarantee a visible ordering change. The tests exercise the actual code at 35 without changing the Trust formula.

| Production fixture | Before | After |
| --- | --- | --- |
| All five stages, populated trust, one missing CTA among otherwise distinct CTAs | CTA score 100; important finding absent from Attention | Same score and finding; Attention shows `CTA_MISSING` |
| Same stages, missing CTA and all trust fields blank | Trust score 35; trust opportunity present; missing CTA hidden | Same findings/scores; Attention shows CTA then trust in engine order |
| Five findings with stage gaps, two missing CTAs, multiple audiences and tones | Additional score filter precedes three-item preview | Exactly first three engine findings; all five Opportunities remain |
| No findings / empty Canvas | Existing empty/unavailable states | Same states |

## Interaction and preserved boundaries

Attention retains native buttons, localized titles, existing code-based Opportunity lookup and reduced-motion-aware scrolling to the card. Titles and array indices are never identities. Before scrolling, the handler now requires the captured snapshot to be the current snapshot and pass the existing freshness predicate. Old detached buttons cannot target findings after Refresh or Board switching. No new navigation system is introduced. Canvas checked references, exact-ID selection, Inspector focus, viewer authorization and editable Brain handoff are unchanged.

All eight existing SHA-256 producer/identity/freshness/handoff assertions pass unchanged. No expected digest changes. Finding codes, severity, category, structural relevance, weights, comparator, ordering, count/cap, evidence, missing elements and affected IDs are untouched. Campaign Health, all diagnostic calculations including BW-45.2 Funnel Coverage, classification thresholds/CTA override, Journey/stage detail, Home, Brand Profile, Refresh and methodology remain unchanged. No inference, dependency, quota, route, migration, authorization change or Canvas/Brand write.

## Regression fixtures

The existing production runtime suite adds real analyzer/snapshot/finding/renderer fixtures for empty Canvas, zero/one/two/three/five findings, CTA diversity 100 with missing CTA alone and alongside other findings, actual trust code at score 35, audience/tone variation, funnel gaps, mixed severities, zero affected IDs and several affected IDs. Every case runs in EN/DE and both themes. Assertions compare Attention with the leading engine findings, full Opportunities with the entire source array, all analysis values with the untouched analyzer, and snapshot bytes before/after rendering and interactions. Refresh resolves findings; Board switching rebuilds the summary; stale captured buttons do not scroll.

The existing BW-43 production browser suite compares Attention and complete Opportunities in every existing theme/language/sidebar/viewport combination. Added high-CTA/trust fixtures use duplicate titles and native Enter/Space on each displayed item to verify exact code targets. Captured detached buttons are rejected after Refresh and Board switching. Existing reduced-motion, focus, responsive/zoom, viewer/public, Canvas/Brain, six diagnostic and zero-write/provider assertions remain.

## Validation and review

Local production runtime checks (including BW-44, BW-45.1, BW-45.2 and BW-45.3), BW-25 baseline/translations/localization, BW-28 architecture/UX/avatar, browser-script integrity, BW-36.21B2 Home (31 groups) and BW-40 server checks pass. Further focused browser and hosted results are reported with the delivery PR. The unchanged Runtime Boot Safety workflow provides the complete PostgreSQL 17.6/18.4 matrix; focused local checks do not substitute for those hosted jobs. The local BW-43 suite fails its inherited `Expanded Journey sources reflow` assertion on both patch and an untouched `git archive` of base `9b4799b`: patch at dark/DE/expanded sidebar/320px; base at light/DE/expanded sidebar/375px. An unchanged patch rerun reaches and passes all newly added Attention keyboard/reveal/stale-target assertions before the same existing reflow assertion fails. No layout code or original assertion is modified; the root cause and hosted outcome are not inferred from this local evidence.

Self-review: the only application edits are removal of the score eligibility map and addition of snapshot freshness checks to the existing Attention click handler. No producer fingerprint, security/SQL assertion, style or translation changed. Public changes contain repository contracts and fictional fixtures only; scratch scripts/logs, dependencies, screenshots, credentials and customer information are excluded. This is implementation self-review, not independent human approval.

The summary deliberately shows only three entries. The existing engine can return at most five; all remain available in Opportunities. Existing diagnostic policy limitations, malformed-input behavior outside BW-45.1 and Chromium-specific layout limitations remain. The correction does not claim marketing effectiveness, proof truth or semantic strategic quality. No merge or manual deployment is performed.
