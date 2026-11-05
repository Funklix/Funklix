# BW-43 pre-implementation inventory and dependency audit

Audited before editing application code. Base: `978833e` (latest merged main, verified by fetch). Only the single approved Light Mode mockup is a design reference. Earlier repository screenshots are not design inputs.

## Data and ownership

`analyzeCampaign` in `app.js` is the deterministic source, shared with Home and AI Brain. `calculateInsightsDiagnostic` calls it; `captureInsightsDiagnostic` captures analysis, ranked findings, identity, Canvas fingerprint, saved/live provenance and timestamp. No provider, API write, or persistence belongs to this path. `isCurrentInsightsSnapshot` verifies account, Board, load generation, view permission and Canvas fingerprint. `renderCampaignIntelligence` refreshes the snapshot and renders Insights and Brain. Explicit navigation and deferred authorized Home demand retain their existing calculation lifecycle.

Header retains current Board name (fallback Current Board), actual node count, loaded saved/unsaved Canvas indication and localized analyzed timestamp. Refresh is a local deterministic recalculation. Data freshness, account/Board switches, permission denial, loading, no Board, empty Canvas, malformed/unavailable analysis all remain owned by the existing guards. Saved-source ownership, fingerprint and permissions must not change.

## Complete visible data and interaction inventory

| Area | Existing data and behavior |
| --- | --- |
| Header | AI Insights; purpose and Canvas-source explanation; Board, node count, source state, localized timestamp; Refresh insights listener |
| Executive overview | readiness `/100`, threshold classification, existing supporting sentence; up to three filtered attention findings in engine order, buttons scroll to their opportunity; count of covered/missing stages and five status dots; all positive finite channel counts, number of channels and relative count bars; zero-channel explanation |
| Journey | Awareness, Interest, Consideration, Conversion, Retention, localized in that order; membership of `funnel.coveredStages` determines Covered/Missing content; status and accessible name per stage; Canvas coverage vs measured-conversion disclaimer; no stage clicks or View details action |
| Opportunities | engine-ranked findings (existing maximum five); severity class and High priority/Worth improving/Minor improvement; original title and description; affected-node count and existing bounded preview (three titles/types plus remainder count); Show on Canvas for valid affected IDs; Ask AI Brain for signed-in editable nonpublic Boards; No current findings empty state |
| Diagnostics | all six numeric checks below, in four existing groups; name, `/100`, status, explanation and native How this is calculated disclosure with Current Board scope and method |
| Performance | native disclosure, No analytics data connected, Verified metrics can appear here when available, and full future-source explanation; current renderer has no verified metric branch and no connection action |
| Methodology | native disclosure; six classifications with full definitions (Measured, Deterministic diagnostic, Inferred, Simulated, User-entered, Unavailable); current source, Board, saved/live state, raw timestamp, name and node count; seven diagnostic methods; full assumptions and limitations |

## Diagnostics: formulas, groups and status

| Group | Metric / actual formula | Method label |
| --- | --- | --- |
| Structure and readiness | readiness: round and clamp to 0–100 of 40 + 25×covered-stage-count/5 + 10 if trust present + 10 if at least two distinct CTAs + 10 if at most one audience + 5 if at most two tones | Canvas readiness formula |
| Funnel coverage | round(covered-stage-count/5×100) | Funnel-stage mapping |
| Strategy and consistency | ICP: 90 if at most one distinct nonempty trimmed audience, otherwise 55 | Distinct audience labels |
| Strategy and consistency | Tone: 90 if at most one distinct nonempty trimmed tone, 75 if two, otherwise 50 | Distinct tone labels |
| Strategy and consistency | Trust: 80 if a Landing Page has nonempty trust, otherwise 35 | Landing Page trust-field presence |
| Content and channels | CTA: round(distinct case-insensitive CTAs / max(nonempty CTA count,1) ×100); existing analyzer uses Landing Page CTA or social preview | CTA variation check |

Classification thresholds: Strong ≥85, Good foundation ≥70, Needs attention ≥45, Incomplete otherwise. Existing CTA-opportunity override labels CTA Good foundation and uses the full distinct-CTA/variation explanation even when its numeric score is higher/lower. Preserve this semantic distinction. Other explanation copy is the existing status-dependent complete/consistent, good foundation, review evidence, or incomplete-content sentence. Invalid analysis suppresses numeric results rather than fabricating values.

Stage inference adds explicit `funnelStage`; Idea→Awareness, Content→Interest, Social Media Posting→Awareness; Landing Page, Conversion goal/stage or nonempty Landing Page CTA→Conversion. The existing engine owns distinct stage membership and missing-stage calculation. Platform counts come only from social nodes, using their platform or Unknown, with one count per node; bars are relative to maximum count, not campaign outcome percentages. Methodology also lists Platform counting.

## Findings, evidence and handoff

Existing conditional codes: CTA_MISSING, FUNNEL_STAGE_GAPS, TRUST_PROOF_MISSING, ICP_VARIATION, TONE_SHIFTS_HIGH, CTA_VARIATIONS_MISSING. Missing CTA suppresses the variation-only finding. Severity, structural relevance, affected-node count, weight, category and stable ID sort determine priority; no redesign sorting. Evidence/current values/missing elements and affected IDs are carried in immutable findings, with original bounds. They are transferred by `askAiBrainAboutFinding` in the existing localized editable prompt, including source and timestamp; this action does not submit or call AI. `showInsightsFindingOnCanvas` checks current identity, then uses existing Canvas focus/select. No unavailable or stale handoff may expose outgoing Board data.

Findings contain evidence used in the handoff beyond their visible card description. Keep the full data contract untouched. Analyzer strengths, weaknesses, suggestions, CTA warnings and platform summary also remain in the shared analysis for its existing consumers; the current Insights renderer does not separately display these raw fields. Do not remove or reinterpret them.

## Repetition and presentation decision

Readiness repeats in overview and diagnostics: the former establishes overall health, the latter exposes classification and calculation. Journey counts/status repeat in overview, full stage path, funnel diagnostic and gap opportunity: orientation, stage map, methodology and actionable handoff respectively. Source context repeats in header and expanded methodology for auditability. Preserve each purpose. Compact numeric rows will place the original explanation inside the existing calculation disclosure, retaining both original content and summary behavior. All existing opportunity cards remain visible; first receives visual emphasis without changing priority.

## Technical dependencies and boundaries

- `index.html`: `#insights-view`, `#insights-cards`, nav IDs; retain all.
- `app.js`: `el` bindings, renderer section IDs, `data-finding-id`, native details, refresh/scroll/Canvas/Brain listeners; rendering only receives additive decorative spans and numeric bars, and diagnostic-copy placement. No new actions.
- `styles.css`: legacy Insights rules at ~2720 and BW-28.3 at ~7685; new overrides must scope to `#insights-view` and preserve sole scroll owner. Current max-width 1120 and four equal overview columns waste desktop space; current diagnostic rows use four large columns and repeat copy.
- `language.js`: existing EN/DE closed vocabulary, authored content stays text. No new UI copy required.
- Theme: existing surface, text, primary, divider, status and shadow tokens; Light acceptance with explicit coherent Dark treatment; visible focus, reduced motion, 320/375/tablet and zoom reflow.
- Tests: BW-25 baseline/translations, BW-28 architecture/UX/premium/runtime, BW-36.21B2 Home and AI Brain shared source, browser integrity, boot workflow and recent Brain/Profile regressions.
- Complete `.github/workflows/runtime-boot-safety.yml` matrix uses PostgreSQL 17.6 and 18.4; no checks weakened or removed.

## Pre-existing limitations identified (outside visual scope)

The executive supporting sentence is unconditional even for low readiness. Attention uses its existing lookup including TRUST_LAYER_MISSING while the engine emits TRUST_PROOF_MISSING (fallback classification). Engine stage-count calculation accepts noncanonical explicit stages. Existing channel labels and node previews have length bounds. Preserve these formulas/behaviors and document rather than repair unrelated logic here.
