# Dashboard Today's Focus Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Intelligence MVP PR 11 audit |
| Scope | Today's Focus reads existing Canvas nodes as actions |
| Runtime behavior changes | None; Dashboard reads only |
| Files changed | `app.js`, `index.html`, `docs/audits/2026-06-28-dashboard-todays-focus-audit.md` |

## Documents Read

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-06-28-dashboard-continue-working-audit.md`
- `docs/audits/2026-06-28-dashboard-brand-evolution-audit.md`
- `docs/constitution/engineering-constitution.md`

## Audit Findings

### 1. Existing node structure

Canvas nodes already exist in `state.nodes`. Created nodes include fields such as:

- `id`
- `type`
- `title`
- `content`
- `status`
- `tags`
- `audience`
- `goal`
- `channel`
- `funnelStage`
- `tone`
- `ownerEmail` / `ownerName` / `ownerAvatar` when ownership is assigned
- content-specific fields such as `social`, `landingPage`, `images`, and `imagePrompt`

This PR only reads those existing node fields.

### 2. Status model

Existing node statuses include Draft, In Review, Needs Changes, Approved, and Published. For Dashboard focus, `Approved` and `Published` are treated as complete/done and are excluded from the action list. Unknown or missing statuses normalize to Draft through existing helpers.

### 3. Assignment model

There is no separate task system. Node ownership exists through `ownerEmail`, `ownerName`, and `ownerAvatar`. A node is labeled `Assigned to you` only when `ownerEmail` safely matches the current signed-in user's email. Other owned nodes are labeled with owner context. Unowned nodes are labeled `Campaign node`, not `Assigned node`.

### 4. Actionable node selection

Today's Focus should show up to three nodes:

1. incomplete nodes assigned to the current user,
2. other incomplete owned nodes,
3. other incomplete campaign nodes,
4. newest/most recent fallback based on node timestamp when present or current array order.

No node data is written and no statuses are changed.

### 5. Fallbacks

If no actionable nodes exist, the Dashboard shows:

`Node-level actions will appear once a campaign board is active.`

### 6. Click behavior

No node-focus click behavior is added in this PR. This avoids changing Canvas navigation, selection, routing, or focus behavior. A future PR may wire clicks to existing `focusNodeInCanvas()` only after a dedicated interaction audit.

## Implementation Summary

- Replaced static Today’s Focus placeholder cards with render targets.
- Added read-only Dashboard helpers to derive up to three node actions from `state.nodes`.
- Rendered Today’s Focus when Home renders and through the existing Dashboard refresh helper.

## Runtime Confirmation

This PR does not:

- create task storage
- add APIs
- write node data
- change node statuses
- change save/load
- change autosave
- change Canvas behavior
- change routing
- change Campaign V3
- change Board ownership
- implement Active Brand
- implement real tasks

Dashboard reads only.

## Manual QA Checklist

1. Root Home with no Board shows the empty Today’s Focus state.
2. Board with nodes shows up to three real node actions.
3. Approved/Published nodes are excluded when other incomplete nodes exist.
4. No fake assigned-node wording appears unless owner data supports it.
5. Canvas behavior remains unchanged.
