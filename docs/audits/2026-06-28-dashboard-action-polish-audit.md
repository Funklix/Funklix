# Dashboard Action Polish Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Intelligence PR 13 audit |
| Scope | Safe Dashboard action affordances for existing cards |
| Runtime behavior changes | Navigation/focus delegation only; no writes |
| Files changed | `app.js`, `styles.css`, `docs/audits/2026-06-28-dashboard-action-polish-audit.md` |

## Audit Findings

### 1. Existing Dashboard CTA handlers

Dashboard clicks are delegated from `el.dashboardView` through `data-dashboard-action`. Existing safe actions already open Boards, Brand Core, AI Brain, campaign creation, and the current Board/Boards path through existing navigation buttons.

### 2. Existing safe node focus behavior

The runtime already has `focusNodeInCanvas(nodeId, { behavior, select, pulse })`. It validates the node and DOM element, opens Board view when needed, scrolls the Canvas, selects the node, fills the Inspector, and pulses the node. This is existing Canvas behavior and can be reused instead of creating new focus logic.

### 3. Existing Brand Core nav behavior

`el.brandCoreButton?.click()` already delegates to the existing Brand Core nav behavior. Missing Knowledge pills can safely use the existing `open-brand` Dashboard action because it only opens the existing Brand Core view.

### 4. Today's Focus render output

Today’s Focus actions are derived from existing nodes and include the node `id`. That ID can be stored as a stable `data-dashboard-focus-node` attribute for click delegation.

### 5. Safest action behavior

- Continue Campaign hero CTA should use the same existing `open-current-board` action target as the Continue Working button.
- Missing Knowledge pills should open Brand Core through the existing `open-brand` action.
- Today’s Focus rows may open Canvas and focus/select the existing node via `focusNodeInCanvas()`.
- Suggested Opportunities remain read-only/static because they do not map to a single safe existing navigation target.

## Runtime Confirmation

This PR does not:

- add data
- write data
- add APIs
- change routing contracts
- change save/load
- change autosave
- change Canvas rendering
- change Brand Core behavior
- implement tasks
- implement AI

## Manual QA Checklist

1. Continue Campaign works through existing Continue Working target logic.
2. Missing Knowledge pill opens Brand Core.
3. Today’s Focus row opens Canvas and focuses/selects the existing node.
4. Suggested Opportunities do not imply unsupported behavior.
5. Canvas behavior remains unchanged.
