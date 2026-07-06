# Dashboard Campaign Health Card Refinement Audit

Date: 2026-07-06

## Scope

This refinement updates the Dashboard Continue Working / Campaign Health card presentation only. It remains read-only and derives all intelligence from existing runtime Canvas nodes. No APIs, AI, storage, node writes, status changes, save/load changes, autosave changes, routing changes, Canvas changes, Campaign V3 changes, Board ownership changes, Brand runtime changes, analytics, or invented data were added.

## Existing Campaign Health renderer inspected

The current renderer builds a Continue Working model from `getActiveContext()`, `state.currentBoardName`, `state.nodes`, and the existing last-updated timestamp fallbacks. The Campaign Health section already computes progress from node statuses, renders workflow buckets, renders type buckets, and keeps the existing Open Board / Open Boards CTA behavior.

## Existing node fields available

The Dashboard can safely read these existing node fields without becoming a source of truth:

- `id`
- `title`
- `type`
- `status`
- `description`
- `content`
- `goal`
- `audience`
- `channel`
- `parentId` when present
- ownership fields when present, though this refinement does not display ownership

## Campaign Summary source decision

Campaign Summary can be derived safely when existing node text exists. The selected source order is:

1. Root `Idea` node with summary text.
2. First `Idea` node with summary text.
3. First node whose type includes `campaign` and has summary text.
4. First node with meaningful `description`, `content`, or `title`.
5. Fallback only when no safe node summary exists: `This campaign is ready to continue. Open the Campaign Canvas to keep building.`

Summary text is not invented. It is read from existing `description`, `content`, or `title`, normalized for whitespace, and truncated for card presentation.

## Objective, Audience, and Channel

The left column now shows optional metadata rows only when existing runtime values are present:

- Primary Objective: first available `goal`, preferring the summary source node.
- Primary Audience: first available `audience`, preferring the summary source node.
- Channel: first available `channel`, preferring the summary source node.

Rows with no existing value are hidden.

## Progress refinement

The progress bar remains unchanged, but the progress copy now reads:

```text
X Approved · Y Remaining
```

`Approved` uses the existing completed count, which includes `Approved`, `Published`, and safe completed raw variants from PR 16. `Remaining = totalNodes - completedNodes`.

## Workflow Snapshot refinement

Workflow Snapshot now renders compact KPI cards instead of stacked chips. The counts are unchanged and continue to use the existing derived status buckets:

- Completed
- In Review
- Draft
- Needs Changes
- Other only when present

## Campaign Structure refinement

Campaign Structure now renders only categories that actually exist and sorts them by descending count. It still uses the same existing node type buckets from PR 16.

## Footer refinement

The technical note `Campaign health is derived from current Canvas nodes.` was replaced with the warmer passive note `Campaign health updates automatically as your campaign evolves.`

## Runtime confirmation

All changes are display-only. The card reads existing runtime node fields and existing timestamp/context state, then updates DOM presentation. It does not mutate nodes, persist summaries, create analytics, write campaign health, or change Canvas/CTA behavior.
