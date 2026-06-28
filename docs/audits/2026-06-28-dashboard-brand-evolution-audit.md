# Dashboard Brand Evolution Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Intelligence MVP PR 10 audit |
| Scope | Brand Evolution card reads existing Brand Core / Brand Brain runtime data |
| Runtime behavior changes | None; Dashboard reads only |
| Files changed | `app.js`, `index.html`, `styles.css`, `docs/audits/2026-06-28-dashboard-brand-evolution-audit.md` |

## Documents Read

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-06-28-dashboard-continue-working-audit.md`
- `docs/constitution/engineering-constitution.md`

## Audit Findings

### 1. Existing `state.brandCore` fields

The current runtime already has a local Brand Core / Brand Brain object in `state.brandCore` with these fields:

- `brandCore`
- `toneOfVoice`
- `messagingPillars`
- `valueProposition`
- `personas`
- `contentGuidelines`
- `dosAndDonts`
- `brandVoiceExamples`
- `keywords`
- `brandAssets`
- `brandDNA`
- `customTiles`

These fields are already normalized by existing Brand Core helpers. This PR only reads them.

### 2. Brand Core form and persistence behavior

Brand Core editing is handled by existing Brand Core editor functions. Edits call `saveBrandBrainState()`, which stores Brand Brain data in localStorage using the existing board-scoped `brandBrainStorageKey()` behavior. Board load can also hydrate `state.brandCore` from `brand_core_snapshot`.

No Brand Core editing, localStorage, board snapshot, save/load, or autosave behavior is changed by this PR.

### 3. Safe completeness signals

Completeness can be safely summarized by checking whether existing Brand Core fields contain meaningful values. The implementation uses ten existing signal groups:

1. Brand Core
2. Value Proposition
3. Tone of Voice
4. Messaging Pillars
5. Personas
6. Content Guidelines
7. Do / Don't Rules
8. Brand Voice Examples
9. Keywords
10. Brand Assets

The card displays a summary such as `4 of 10 Brand Core signals present.` This is not a health score and does not claim analytics performance.

### 4. Missing knowledge inputs

The requested missing knowledge inputs are not canonical fields today:

- Founder Story
- Market Research
- Pitch Deck
- Whitepaper
- Business Plan

To avoid fake claims, the Dashboard treats these as missing unless they appear in existing user-provided Brand Core text, Brand Assets references, or custom Brand Core tiles. No new fields are created.

### 5. Fallbacks

When no meaningful Brand Core data exists, the Brand Evolution card shows:

`Brand signals will appear once Brand Core is connected.`

The card hides detailed completeness/learning/improvement content until existing Brand Core data is available.

## Implementation Summary

- Replaced the static Brand Evolution placeholder with render targets for completeness, newest available learning, suggested improvement, and missing knowledge pills.
- Added read-only Dashboard Brand Evolution helpers in `app.js`.
- Added scoped Dashboard styles for empty state and missing knowledge pills.
- Rendered Brand Evolution when the Dashboard/Home view is rendered and when `refreshDashboardIfVisible()` runs.

## Runtime Fields Read

- `state.brandCore.brandCore`
- `state.brandCore.valueProposition`
- `state.brandCore.toneOfVoice`
- `state.brandCore.messagingPillars`
- `state.brandCore.personas`
- `state.brandCore.contentGuidelines`
- `state.brandCore.dosAndDonts`
- `state.brandCore.brandVoiceExamples`
- `state.brandCore.keywords`
- `state.brandCore.brandAssets`
- `state.brandCore.customTiles`

## Runtime Confirmation

This PR does not change:

- Brand records
- Active Brand
- `getActiveContext()`
- Brand Core editing behavior
- Brand Brain persistence behavior
- localStorage keys
- board snapshots
- save/load
- autosave
- routing
- Canvas
- AI Brain
- APIs

Dashboard remains read-only and owns no Brand data.

## Manual QA Checklist

1. Empty Brand Core shows the fallback: `Brand signals will appear once Brand Core is connected.`
2. Filled Brand Core shows a meaningful completeness summary.
3. Missing knowledge inputs appear as pills.
4. Brand Core editing still works.
5. Dashboard does not write Brand data.
