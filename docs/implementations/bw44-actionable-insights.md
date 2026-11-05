# BW-44.1 — Actionable Insights and checked Canvas context

Base: `4655fed1cc6e41aef7e9610664947ec2aa6140a7`, merged main including PR #851. Implements Option A and the exact read-only authorization extension approved in BW-44.0 §8. The BW-43 dashboard remains the presentation foundation.

## Existing data and presentation

The renderer reuses the current diagnostic snapshot, original ranked findings, affected IDs, missing stages, Audience/Tone labels, `landingPage.cta/trust`, `social.preview/cta`, explicit stage/goal and existing type mapping. A render-local unique-ID index supplies actual current titles/types and relevant field values as DOM text. Retained finding `nodes` and absent `analysis.cta.values` are not treated as evidence sources. Authored values are not translated.

Every returned opportunity keeps its engine order, severity and first-card emphasis. The existing cards now explain the observed condition, a bounded review question, a practical next step and what Refresh can verify structurally. Zero eligible CTA nodes and zero Landing Pages have explicit absence explanations. Missing stages have no invented destination. Three supporting nodes remain the compact preview; native details expose every additional supporting ID without a new feed or display cap.

The five Journey stages retain their exact existing statuses and order. Compact native Canvas context disclosures show sources using the same explicit-stage/type/goal/Landing Page CTA predicates. Missing stages state absence. Six diagnostic disclosures explain their actual arithmetic, observed counts and limitations, including empty Audience labels, case-sensitive Tone labels, any-field trust presence, the different CTA predicates, the CTA classification override and custom stages. Readiness remains a structural heuristic. All classifications, seven methods, assumptions, source/timestamp and disconnected Measured Performance remain available.

English/German system templates cover observation, interpretation, next step, verification, arithmetic, source absence and pending/unavailable/retry states. Strategic judgment stays with the existing editable Ask AI Brain handoff. Refresh checks structural changes; it cannot establish conversion improvements, proof truth, writing quality or strategic audience fit.

## Exact navigation and authorization

The existing `/api/ai-brain/node-reference` route retains Brain's exact three-field `board_id/node_id/scope_revision` request and ID/digest response. Its default authorization remains EDIT.

Only the additional strict request `{source:"insights", board_id, node_id, node_type, expected_scope:{updated_at,brand_id,workspace_id}}` selects authenticated Board VIEW. Unknown/extra/missing/malformed fields fail closed. Expected fields are captured from the loaded saved timestamp and Board association, never a client-generated digest. The route reuses verified app identity, Board access, accepted Workspace membership/active lifecycle and Brand/Workspace association checks. It validates unique saved IDs, supported exact type, expected saved scope, actor identity and two complete saved-scope fingerprints, then returns only `nodeId` and the existing destination-bound `scopeRevision`. No source copy, inference or write occurs. Advice, proposals, canonical Brand capabilities and ordinary Brain references gain no viewer permission.

Authenticated Show on Canvas and individual source buttons use this adapter on explicit click, without prefetch. Default Show retains the first affected target; explicit IDs must belong to that current finding. Journey targets must satisfy the actual stage rule. Home keeps the same default adapter. Origin checks bind the rendered snapshot and Canvas fingerprint, account object, saved timestamp, catalog, association, nodes/edges, dirty state, generation and loading/hydrating/saving/conflict lifecycle. Checks run before dispatch, after response and around native animation frames. Navigation uses the existing Canvas focus/selection, reveal helper and Inspector focus. There is no optimistic destination opening or automatic save/reload.

Unsaved new IDs cannot acquire a persisted reference. Unsaved edits to persisted nodes remain local observations: a checked link verifies identity and access, not the quality or saved provenance of working text. Public/anonymous navigation remains local and gains no checked-reference authorization. Pending and failure status use native announcements; 503 permits retry without changing Canvas state.

The existing expected timestamp contract normalizes to milliseconds. Double capture and destination digests include the raw saved revision, but do not supply a historical microsecond token to the client. Authorization can change after final validation; the existing Canvas lifecycle still governs subsequent use.

## Preserved production contracts

Tests pin byte-for-byte SHA-256 values for `analyzeCampaign`, `calculateInsightsDiagnostic`, `captureInsightsDiagnostic`, `currentInsightsIdentity`, `currentInsightsCanvasIdentity`, `buildInsightsFindings`, `isCurrentInsightsSnapshot` and `askAiBrainAboutFinding`. No formula, snapshot shape, classification threshold/override, stage mapping, finding generation/comparator/cap, Attention filtering or editable handoff changed. No dependency, route, provider, database schema, persistent intelligence layer or Canvas/Brand write was added. Legacy DOM IDs remain.

Known analyzer inconsistencies remain visible and unchanged: one CTA can score 100; native social CTA can avoid a missing-field finding while scoring zero; whitespace is recognized differently; partial trust-field presence yields 80; custom stages can inflate counts; empty labels can receive high scores. The original handoff's bounded canonical evidence and category requests remain unchanged, including their previously audited limitations.

## Test coverage and evidence

Fictional Boards and signed fixture sessions exercise production analyzer/renderer, Advice and the real resolver. Existing provider mocks test the explicit Advice workflow, not model quality.

- BW-25 baseline/translations and BW-28 architecture, UX/handoff, premium and runtime checks pass. Runtime contrasts cover zero/one/multiple audiences, case-only tones, one/repeated/two CTAs, whitespace, native social CTA versus preview, absent/partial trust, same-channel posts, custom stages, duplicate IDs and access to all sources. Rendering deep-compares every original snapshot finding and analysis value.
- BW-43 retains the 48 EN/DE, Light/Dark, sidebar and desktop/tablet/375/320px combinations, original numeric fixture `[90,60,90,90,80,100]`, Journey statuses, rank/order, complete disclosures, Refresh, editable handoff, loading/unavailable/empty/denied states, source ownership and immutable Canvas. Added checks cover actual field context, missing-stage target absence and expanded source lists. Native Chromium 200% zoom passes with CSS width 720, outer width 1440, DPR 2 and visual scale 1.
- BW-40 server checks retain the original branch and add strict deterministic requests, exact duplicate-title destinations, authenticated viewer/default-EDIT/Advice isolation, saved ID/type/uniqueness, expected scope, disabled identity, revoked access, accepted membership, active Workspace, association, double-capture revocation/fingerprint changes, retryable service failure, zero inference and read-only route queries.
- BW-40 browser checks exercise exact ID selection and Inspector focus by Enter/Space in EN/DE and both themes for editors/viewers; unsaved new targets; no optimistic opening; in-flight account, revision, catalog, association, source, edge, save, hydration, loading, generation, permission and snapshot changes; frame lifecycle invalidation; retry; public isolation; unchanged Canvas/history and zero inference/writes. Existing Brain reference/history tests remain.
- BW-40.1 prompt shortcuts pass all six focuses, exact localized copy, editable insertion without submit, historical-label safety, keyboard, responsive layout, 200% reflow and reduced motion.
- BW-36.21B2 passes all 30 Home/Insights/Brain groups, including 20,000-node parity, deferred evidence, scope changes and the default checked navigation adapter.

Complete Runtime Boot Safety runs on both PostgreSQL 17.6 and 18.4 in the PR. Its final run and job conclusions are reported on the PR; focused local checks do not substitute for that matrix.

## Exact test-scope additions and integrity pins

Besides the expected implementation/test files, `scripts/fixtures/home-browser.js` adds a lazily initialized disposable SQL fixture for the newly checked default Show action. It invokes the production resolver with a signed fictional session and the fixture's saved Canvas, retains the prohibition on every inference/analytics route, and asserts read-only queries and zero provider calls. The BW-43 Journey selector now counts direct stage children so source-list items cannot be mistaken for stages; the five-stage assertion remains exact.

Two historical integrity files necessarily change: `scripts/check-bw36-6-workspace-schema-foundation.js` advances only the exact `styles.css` digest for appended, Insights-scoped source/focus/wrapping rules; `scripts/check-bw36-7r3-corrected-workspace-backfill-preflight.js` advances only the dependent test-source digest. Full hash comparisons and all other security/SQL/runtime baselines remain intact. No legacy assertion is removed or weakened.

## Review and publication

Self-review checks unchanged protected producers, strict branch discrimination/default EDIT isolation, exact identity, source applicability, all-source access, stale/async guards, text-only authored content, localized status, native focus and scoped theme/reflow rules. This is self-review, not independent approval. Self-review found inherited Journey list connectors affecting nested source rows; scoped source-list rules now isolate them, and all 48 browser combinations also expand and check Journey sources. The first CI matrix exposed a legacy source-string check for the default EDIT guard; the original explicit guard is retained in the edit branch without changing authorization or the test. No outstanding correctness finding is known after the listed checks. No business-effect or live model-quality claim is made.

Public changes contain repository-level contracts and fictional fixtures only. Review excludes scratch logs, browser profiles, dependencies, credentials, real customer records and sensitive operational details. Delivery is one normal, non-draft PR against main; no merge or manual deployment.
