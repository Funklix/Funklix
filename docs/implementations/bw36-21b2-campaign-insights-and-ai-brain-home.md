# BW-36.21B2 — Campaign Insights and Contextual AI Brain on Home

Phase B2 only. Implemented 2026-10-18 (Europe/Berlin). Baseline: latest merged `main`, `e5b4dadf0b9ae517591d574a1c4161154d78e875`, including PR #790; confirmed with both GitHub's commit API and `git fetch origin main`. Dedicated branch: `codex/bw36-21b2-home-insights-brain`.

## Baseline inspection and approved boundaries

Read the complete [architecture audit](../audits/bw36-21-start-screen-intelligence-and-insights-audit.md), Home Foundation, R2.2, R2.3, R2.3R1 and B1 implementation records, and traced their current source. The audit is a proposal against an older baseline; merged Brand selection is independent of the loaded Board. B1's selected-Brand Learning counts and current-Board responsibility projection remain separate.

The actual contracts inspected were `home-foundation.js:create/model/sameScope`, `brandBoardNavigationContext`, `selectSessionWorkspace`, `selectSessionBrand`, Board hydration and retirement, existing sidebar view controls, `setActiveView`, `focusNodeInCanvas`, `renderCampaignIntelligence`, `analyzeCampaign`, `buildInsightsFindings`, `captureInsightsDiagnostic`, `isCurrentInsightsSnapshot`, `showInsightsFindingOnCanvas`, and the existing AI Brain renderer/submission flow. Required legacy HTML IDs, DOM ownership, boot, Canvas persistence and autosave are preserved.

Server inspection covered Advice's Board edit authorization, independently authorized canonical Core, the approved-Learning context capture/revalidation path, and its `store:false` and 409/503 behavior. Generation quality/social diagnostics and the server's `bw25-canvas-diagnostics-v1` output have different schemas and purposes. B2 consumes none of those alternative outputs and changes no provider, prompt, Learning, database, billing, publishing or authorization code.

## Diagnostic source of truth and applicability

Home is a **read-only consumer of the existing runtime Insights snapshot**. It never calculates diagnostics, calls a backend, writes a Board/Canvas, or runs inference to populate its preview. When no snapshot exists after a direct Board load, the module truthfully offers the existing Insights view, where the existing deterministic path runs on explicit navigation. Returning Home then shows its valid evidence.

`homeCampaignInsights` returns a minimized projection: availability, source, actual analysis time, finding code/title/description/severity, affected IDs and an optional safe node target. No score, percentages, universal readiness calculation, external performance metric or fabricated opportunity is introduced. Up to three findings appear in the engine's existing order; the complete existing Insights surface remains available without a diagnostic or entitlement limit.

The source engine can emit trust warnings with no Landing Page and CTA-variation warnings with no eligible CTA nodes. Home suppresses those inapplicable previews; funnel-gap findings require a campaign node or actual diagnostic strategy fields. A notes-only Canvas therefore has no applicable structural findings. Source findings, identifiers, severity, affected IDs, engine ordering and limits are unchanged. This is presentation applicability, not another analysis engine.

A defensive fingerprint correction includes `goal` and `social.cta`, both read by existing diagnostic functions but omitted from the previous fingerprint. Changes to either now invalidate the existing snapshot. Diagnostic capture also moves inside the existing calculation error boundary: an exception from finding construction now becomes the established unavailable snapshot rather than escaping the renderer. The failure branch still renders the existing Brain surface, so a diagnostic failure cannot prevent its navigation. The Home adapter validates the finding contract and isolates malformed optional evidence as an unavailable module.

## Freshness and evidence handling

| Context | Home behavior |
| --- | --- |
| Fresh loaded/saved snapshot | Board identity, authorized Brand label, actual supported findings, saved-source label and analysis time. |
| Fresh live/unsaved snapshot | Same evidence with explicit live Canvas / unsaved label. |
| Snapshot from another account, Board, hydration generation or access identity | Stale message, no findings; existing Insights entry. |
| Canvas fingerprint or saved/live provenance changed | Stale message, no findings; no automatic recalculation. |
| Missing snapshot | Explicit missing-analysis message; existing Insights entry. |
| Calculation exception, invalid analysis/time/finding contract | Calculation unavailable; no false all-clear. Other Home modules remain usable. |
| Empty Canvas | Explicit empty state, no invented findings. |
| Valid analysis, no applicable findings | Bounded structural statement that explicitly does not measure campaign results. |
| Loading/hydrating or unconfirmed/revoked access | No outgoing Board findings or Brain action. |
| No saved Board | Open-Board explanation and existing Browse Boards flow. |
| No account, public token, catalog/identity mismatch or no Workspace | Existing Home sign-in, catalog or Workspace selection states; no private module data. |

Analysis time is a client diagnostic timestamp, not a persistence timestamp, last author activity or measurement date. Home checks the original snapshot identity and fingerprint and requires its original saved/live provenance to match the runtime. It does not relabel an old snapshot after a save-state transition. Freshness cannot be established from a name, selected Brand or server modification date alone.

## Board/Brand isolation and AI Brain permissions

Both new modules use the **current hydrated, readable Board**, intersected with the selected authorized Workspace's catalog Board IDs. The associated Brand name comes only from that Workspace's independently visible Brand catalog. Hidden and unbranded associations use the existing neutral labels; neither snapshot text nor a collection response enriches a hidden association.

With selected Brand Y and Board A/X, B1 Brand Intelligence continues to show Y; responsibilities, Campaign Insights and AI Brain show A/X. The existing context mismatch notice remains. Home never sends Y's Core or Learnings to A/X, fetches X's Learning library for the Brain entry, or retains raw Learning statements for B2.

AI Brain's action is available only with a matching signed-in account/catalog identity, current saved/hydrated Board, explicit readable/editable Board capability, and no public token. Read-only/unconfirmed contexts receive an explanation and no Brain action. Independent canonical Brand/Learning authorization remains on the unchanged Advice path; hidden Brand knowledge is not a prerequisite for otherwise valid Board-only Advice. The card describes this conditional coverage rather than promising access to canonical knowledge.

The CTA **only navigates**. It does not create a conversation, change a question draft, call Advice, automatically retry, submit a form, or prefetch knowledge. Subsequent explicit user submission retains all existing authorization, approved-only lifecycle, context coverage, pre/post inference revalidation, provider storage and 409/503 semantics. Local state reflects the latest established server authorization; this feature adds no server push revocation channel.

## Navigation, lifecycle and accessibility

Home's existing event delegation and scope comparison remain the entry point. Each B2 button additionally captures its render scope through a `WeakMap`. On activation, current account/catalog identity, Workspace, selected Brand, Board, generation, view, loading and target capability are rechecked. Finding-node activation additionally requires the captured diagnostic evidence key to match a current applicable finding and its current unique selector-safe target. Deleted, replaced, duplicate and obsolete node references are refused.

`openHomeBoardDestination` rechecks the application context and invokes the existing Insights/AI Brain sidebar controls. Node actions first use the existing Canvas navigation control, then `showInsightsFindingOnCanvas`, avoiding a deferred node-focus callback across a Home-to-Board transition. No second Board router or Brain/Insights instance is added. Profile dirty/busy leave guards and Board lifecycle remain owned by the existing navigation flow. After a successful guarded transition, focus goes to the Insights heading, Brain question input or node Inspector title, with account/Board/generation revalidation. Reduced motion disables both smooth node scrolling and the existing focus pulse.

B1's local one-second Home presentation observer also observes the minimized diagnostic projection; it performs no request or mutation. Existing sync callbacks refresh earlier. Account/Workspace/Board changes reject old actions and remove private output. No persistent cache is added.

Semantic sections/headings, native buttons/lists, localized status text, preserved focus keys, visible focus rings and existing 44px controls support keyboard and assistive technology. Layout uses established Home typography, neutral/accent surfaces and theme tokens, with a single column at tablet/mobile widths. Long object names wrap. EN/DE, Light/Dark/system and reduced motion use the existing application settings.

## Changed files

- `app.js`: read-only diagnostic projection, guarded existing navigation adapters, fingerprint completeness, capture error boundary and reduced-motion node focus.
- `home-foundation.js`: two scoped modules, native actions, captured-scope/evidence validation and local presentation invalidation.
- `home-foundation.css`: existing-token card/list treatment and responsive B2 grid.
- `language.js`: EN/DE module/state copy and translations of the actual source finding descriptions.
- `scripts/check-bw36-21b2-home-insights-brain.js`: provider-free real-browser regressions using actual boot, deterministic engine and navigation.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register the focused suite in the complete existing CI gate.
- This implementation record and `bw36-21b2-visuals/`: representative screenshots, geometry and validation evidence.

## Validation and CI

**Final local result: PASS.** Complete Runtime Boot Safety: **187/187 workflow run blocks** (185 validation blocks plus two local dependency/browser setup checks), zero failures. Focused B2: **26/26 groups**, both separately and inside the complete run. Existing BW-28 architecture/handoff/runtime checks were also rechecked after the diagnostic error-boundary change (86, 39 and 46 contracts). Final syntax and diff whitespace checks pass; browser script integrity covers all 44 classic scripts.

The full run includes diagnostics/BW-28, BW-26 Advice, BW-36.20/R0/R1 (including approved-Learning lifecycle, `store:false`, 409/503 and independent authorization), Home Foundation, all 96 R2.1 Workspace-switch groups, R2.2, all 30 R2.3 context groups, B1, Board lifecycle, root boot, autosave, themes, localization, responsibilities, learning governance and Advisor suites. Locally installed dependencies/system Chromium satisfy setup; the GitHub Actions installer remains unchanged.

[Visual evidence and geometry](bw36-21b2-visuals/README.md), [machine-readable complete validation](bw36-21b2-visuals/validation.json), [runtime summary](bw36-21b2-visuals/runtime-summary.log) and [final B2 output](bw36-21b2-visuals/focused.log) are included. All ten final screenshots cover the two module positions in five viewport/theme/language combinations, with zero horizontal overflow. Desktop Light and mobile Dark captures were visually inspected. Initial focused fixture failures were corrected to use valid Landing Page fields and explicitly visit the real Insights view before expecting a snapshot; the missing-on-direct-load behavior remains truthful. No assertions or existing suites were weakened.

Exactly one normal PR against `main` is delivered without a merge. Its observed GitHub CI and Codex review state are reported in the delivery message rather than predicted here. Browser transport is intercepted before navigation and rejects provider/AI/analytics endpoints. Fixtures compare Canvas, edges, Core, association, dirty state, saved snapshot and revision; rendering and navigation must create no writes. Existing Advice tests mock provider transport and use disposable database fixtures. No production SQL or paid AI request is performed.

## Live acceptance scenarios and remaining limits

1. Open Home without a Board; confirm useful catalog/navigation and distinct no-Board explanations.
2. Open Board A/X from its direct route, visit Home, follow a missing/stale diagnostic entry to Insights, then return Home. Check the Board, provenance and supported findings; edit an analyzed field and verify old findings disappear until explicit analysis refresh.
3. Select Brand Y while A/X remains loaded. Verify B1 Brand Intelligence shows Y while the two B2 modules and responsibilities show A/X and the mismatch notice remains accurate.
4. Activate a mapped finding with keyboard; verify the expected current node/Inspector and focus. Repeat after node deletion, Board replacement and a delayed load; no stale action should run.
5. Open AI Brain as an editor. Verify the current Board and empty/preserved question draft, no generated answer and no provider request until explicit submission. Verify existing context-coverage disclosure on a separately authorized real submission.
6. Repeat as Board viewer/public viewer and with hidden canonical Brand access; verify no actionable Home Brain control for viewers and no unauthorized Brand label/knowledge. Revoke access/sign out/switch accounts and verify private cards clear after the current authorization/session update.
7. Exercise Workspace switching, Profile dirty Save/Discard/Cancel guards, browser reload, EN/DE, theme/system preference, reduced motion, long labels, zoom and keyboard/screen-reader navigation on actual devices.

There is no cross-Board diagnostic aggregation, newly persisted analysis, background AI, new knowledge-sharing policy or automatic diagnostics refresh. The existing full Insights view retains its prior broader wording/formulas; Home only previews applicable structural findings. A continuously focused client cannot infer remote revocation before a server/session update; unchanged destination/Advice handlers remain authoritative. Browser/disposable database evidence does not establish production data/schema parity or substitute for physical-device and screen-reader acceptance. These limits do not expand B2 scope.
