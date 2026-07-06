# Dashboard Mission Insight Audit

Date: 2026-07-06

## Scope

This is a Dashboard Intelligence presentation PR. Dashboard remains read-only. The change adds deterministic Mission Insight copy to the hero and polishes existing presentation using current Dashboard data only. It does not change Canvas, save/load, autosave, node model, routing, APIs, AI, persistence, scoring, analytics, Dashboard actions, Today's Focus logic, or Suggested Opportunities logic.

## Existing Dashboard data reused

The implementation reuses only existing runtime values and helpers:

- Campaign Health progress, completed count, total nodes, and status buckets from `getDashboardCampaignHealthModel(state.nodes)`.
- Today's Focus first item from `getDashboardTodaysFocusActions()`.
- Existing node lookup through `getNode(focusItem.id)`.
- Existing node status through the current `node.status` value.
- Existing graph connections through `state.edges`.
- Existing active-context fallback behavior in the Daily Briefing model.

## Rule hierarchy

Campaign momentum uses deterministic milestones:

1. `100%` => `Campaign ready.`
2. `81–99%` => `You're approaching launch.`
3. `51–80%` => `You're making strong progress.`
4. `21–50%` => `Momentum is building.`
5. `1–20%` => `Your campaign is taking shape.`
6. `0%` => `Let's build your campaign.`

Mission Insight uses deterministic read-only rules:

1. Today's Focus node with outgoing connections => `Completing this unlocks X downstream assets.`
2. Today's Focus node in review => `Approving this moves the campaign forward.`
3. Today's Focus node needing changes => `Resolving feedback keeps downstream work moving.`
4. Today's Focus draft node with connections => `Publishing this enables the next campaign step.`
5. Today's Focus node with no downstream connections => `This is your highest priority active asset.`
6. No focus node and completed equals total => `Campaign is ready for launch.`
7. No focus node and progress over 80% => `You're approaching campaign completion.`

No randomization, AI, quality inference, performance inference, blocker inference, or invented dependency copy is used.

## Connection reuse

Downstream count is derived from existing `state.edges`. The helper supports the current array edge shape and object edge shapes already present in the codebase (`source` / `target`, `sourceNodeId` / `targetNodeId`, and similar directional fields). It counts unique direct downstream target nodes for the Today's Focus node.

## Status reuse

Mission Insight reads the focus node's existing `status` and maps it through the existing Dashboard campaign status bucket helper. It does not change statuses or introduce new status semantics.

## Presentation-only changes

- The hero executive summary now uses campaign momentum milestones instead of repeating the Continue Working detail card.
- The hero keeps the existing Today's Focus line when available.
- Mission Insight is rendered directly below the Today's Focus line and stays short.
- Campaign Progress copy and Workflow Snapshot accents remain presentation-only polish.

## Runtime confirmation

Dashboard remains presentation-only. No node data is written. No persistence, routing, save/load, autosave, Canvas behavior, APIs, AI, scoring, analytics, or node model behavior changed.
