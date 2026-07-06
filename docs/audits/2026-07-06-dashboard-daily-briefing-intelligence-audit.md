# Dashboard Daily Briefing Intelligence Audit

Date: 2026-07-06

## Documents read

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/audits/2026-07-06-dashboard-campaign-health-card-audit.md`
- `docs/audits/2026-07-06-dashboard-campaign-health-refinement-audit.md`
- `docs/audits/2026-06-28-dashboard-todays-focus-audit.md`
- `docs/audits/2026-06-28-dashboard-suggested-opportunities-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`

## Scope

This PR updates the Dashboard Daily Briefing hero copy only. The hero remains read-only and derives its state from existing Dashboard helpers and runtime fields. No APIs, AI calls, node writes, status changes, save/load changes, autosave changes, routing changes, Canvas rendering changes, Campaign V3 changes, Board ownership changes, Brand runtime changes, Brand Core persistence changes, analytics, or storage were added.

## Current hero rendering inspected

The hero renderer already controls three text targets:

- `#dashboard-title`
- `#dashboard-hero-subtitle`
- `#dashboard-hero-support`

It also already renders the Dashboard hero avatar through the read-only avatar resolver. The previous text was generic: `Good morning.`, `Your next best move is ready.`, and a static instruction to start with the current campaign.

## Existing derived helpers inspected

The Daily Briefing can safely reuse existing read-only Dashboard intelligence:

- Campaign Health from `getDashboardCampaignHealthModel(state.nodes)`.
- Today's Focus first item from `getDashboardTodaysFocusActions()`.
- Suggested Opportunities first item from `getDashboardSuggestedOpportunities()`.
- Current campaign/board name from `state.currentBoardName` with existing board id fallback semantics.
- Active context from `getActiveContext()`.
- Signed-in first name from the existing `getDashboardUserFirstName()` helper.

## Runtime values used

The hero derives only these values:

- board/campaign name
- progress percentage
- completed node count through Campaign Health
- total node count through Campaign Health
- draft count through Campaign Health status buckets
- in-review count through Campaign Health status buckets
- first Today's Focus node title when available
- top Suggested Opportunity title when available

## Daily Briefing logic

The greeting remains:

- `Good morning, Felix.` when the existing safe first-name helper returns a value.
- `Good morning.` otherwise.

For a board/current canvas with nodes, the subheadline is:

```text
[Campaign Name] is [progressPercent]% complete.
```

The supporting copy chooses the next move in this order:

1. Today's Focus first item: `Start with: [Node Title].`
2. Three or more Draft nodes: `Review draft nodes to move the campaign forward.`
3. Any In Review nodes: `Review in-progress assets before expanding the campaign.`
4. Top Suggested Opportunity: `Next opportunity: [Opportunity Title].`
5. Fallback: `Open the campaign board to continue building.`

## Fallback behavior

- No active board/current canvas: `Select a board to see your campaign focus.` and `Your briefing will update once a campaign board is active.`
- Active board/current canvas with zero nodes: `[Board Name] is ready to build.` and `Add or generate nodes to create your first campaign health signals.`
- Board with nodes but no focus item: use draft/in-review/opportunity/fallback copy in the priority order above.

## Runtime confirmation

The Daily Briefing does not invent summaries or campaign intelligence. It uses existing Campaign Health, Today's Focus, Suggested Opportunities, active context, board name, and user first-name helpers. It updates DOM text only and does not mutate nodes, Brand Core, Board state, Canvas state, routing, storage, autosave, or CTA behavior.
