# Dashboard Campaign Health Continue Working Card Audit

Date: 2026-07-06

## Documents read

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/audits/2026-06-28-dashboard-continue-working-audit.md`
- `docs/audits/2026-06-28-dashboard-todays-focus-audit.md`
- `docs/audits/2026-07-06-continue-working-copy-polish-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`

## Scope

This PR updates the Dashboard Continue Working card only. The card remains read-only and derives Campaign Health from existing `state.nodes`. No APIs, storage models, node writes, status changes, save/load changes, autosave changes, routing changes, Canvas rendering changes, Campaign V3 changes, Board ownership changes, Brand runtime changes, analytics, AI scoring, or persisted health model were added.

## Existing Continue Working implementation

The previous Continue Working model used `getActiveContext()`, `state.currentBoardName`, `state.nodes.length`, `state.lastKnownUpdatedAt`, `state.canvasMetadata.updatedAt`, and Board access/status helpers to render Board metadata. It also controlled the existing Open Board/Open Boards CTA target through the current Dashboard action delegation.

## Existing node fields inspected

Dashboard Campaign Health can be derived from existing Canvas node fields only:

- `node.id`
- `node.title`
- `node.type`
- `node.status`
- ownership fields such as `ownerEmail`, `ownerName`, and `ownerAvatar` when present, though ownership is not displayed in this card
- timestamp fields may exist on some nodes, but card-level Last Updated continues to use the existing Board/canvas timestamp fallback

## Progress calculation

Progress is calculated in memory from current runtime nodes:

```text
completedNodes / totalNodes
```

`completedNodes` counts nodes whose status is `Approved` or `Published`, plus safe raw variants `approved`, `published`, `done`, `completed`, and `complete`. If `totalNodes` is `0`, progress is `0%` and the card shows the empty campaign-health state.

## Status buckets

Node statuses are normalized into these display buckets:

- Completed
- In Review
- Draft
- Needs Changes
- Other, only when unknown statuses are present

Missing status is treated as Draft to match the existing default node status behavior.

## Type buckets

Node types are normalized into these display buckets:

- Ideas
- Campaign Variations
- Content
- Social Posts
- Landing Pages
- Email Campaigns
- Other, only when unknown types are present

The buckets map current Canvas node type strings such as `Idea`, `Campaign Variation`, `Content`, `Social Media Posting`, `Landing Page`, and `Email Campaign`.

## Technical metadata removed or demoted

The Continue Working card no longer foregrounds technical Board metadata:

- Ownership is removed from the card presentation.
- Board Status is removed from the card presentation.
- Active Board ID remains hidden and is not rendered.
- Board-backed workspace copy is replaced by a secondary read-only note: `Campaign health is derived from current Canvas nodes.`
- Last Updated remains, but is secondary beneath Campaign Health.

## Fallback behavior

- No active board/current canvas: keep the clean empty state: `No board selected`, `Select a board to continue your campaign work.`, and `Open Boards`.
- Active board/current canvas with zero nodes: show `Campaign board is ready.`, `Add or generate nodes to start building campaign health.`, `0%`, and `0 of 0 nodes complete`, with `Open Board` unchanged.
- Active board/current canvas with nodes: show progress, workflow status buckets, campaign structure buckets, secondary Last Updated, and the existing Open Board CTA.

## Runtime confirmation

Dashboard Campaign Health reads only from existing runtime state and updates only DOM presentation. It does not create a source of truth, persist health, mutate node statuses, write node data, or change navigation behavior.
