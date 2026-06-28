# Brand Switcher Shell Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Brand Switcher shell audit |
| Scope | Sidebar visual shell only |
| Runtime behavior changes | None |
| Files changed | `index.html`, `styles.css`, `docs/audits/2026-06-28-brand-switcher-shell-audit.md` |

## Documents Read

- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/audits/2026-06-28-passive-board-ownership-diagnostics-audit.md`
- `docs/audits/2026-06-27-passive-brand-session-placeholder-audit.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`

## Goal

Introduce a visual Brand Switcher shell in the sidebar so the future Workspace → Brand → Board hierarchy becomes visible without implementing real Brands.

This is a UI shell only.

## Audit Findings

### 1. Sidebar markup and current logo/nav structure

The sidebar currently starts with:

1. `#left-sidebar`
2. `.sidebar-header`
3. `.logo`
4. `#sidebar-toggle-btn`
5. `<nav>` containing existing nav buttons
6. Activity panel

The nav IDs are used by existing runtime event listeners and should not be moved or renamed.

### 2. Safest insertion point

The safest insertion point is between `.sidebar-header` and `<nav>`.

This location:

- keeps the product logo and collapse control unchanged
- keeps nav IDs and event listeners intact
- communicates Brand context before users choose a product surface
- avoids Dashboard, Canvas, Inspector, Toolbar, routing, save/load, and autosave areas

### 3. Existing nav IDs/event listeners preserved

The implementation preserves existing nav IDs:

- `home-nav-btn`
- `campaign-canvas-nav-btn`
- `boards-nav-btn`
- `brand-core-nav-btn`
- `ai-brain-nav-btn`
- `insights-nav-btn`

No nav button was moved outside the existing `<nav>` element.

### 4. No runtime Brand implementation

The shell is static and shows the current expected runtime state:

```text
No Brand selected
Workspace context
```

No Brand IDs are created, inferred, read from Brand Core, written to Boards, or stored.

### 5. No Board filtering

The shell does not filter Boards or alter Board listing behavior.

Board ownership remains unchanged.

### 6. No behavior change

No JavaScript was added.

The shell uses a native `<details>` disclosure for a non-persistent placeholder menu:

- No Brand selected
- Brand switching coming soon
- Create Brand coming soon (disabled)

This avoids new state, routing, persistence, API, or event-handler behavior.

## Implementation Summary

### Markup

Added `.brand-switcher-shell` after `.sidebar-header` and before `<nav>`.

The shell contains:

- eyebrow: `Current Brand`
- current state: `No Brand selected`
- subtitle: `Workspace context`
- disclosure chevron
- static placeholder menu
- disabled create-brand placeholder button

### Styling

Added scoped sidebar styles for:

- `.brand-switcher-shell`
- `.brand-switcher-summary`
- `.brand-switcher-avatar`
- `.brand-switcher-copy`
- `.brand-switcher-menu`
- collapsed-sidebar adaptations

The styles use existing Funklix tokens and `.fk-*` components.

## Behavior Unchanged Confirmation

This PR does not:

- implement real Brands
- create Brand records
- add APIs
- change Board ownership
- filter Boards
- change Brand Core
- change AI Brain
- change Dashboard data
- change routing
- change autosave
- change save/load
- change Canvas
- change Inspector
- change Toolbar
- change existing nav IDs or click handlers

## Risks

### 1. Static shell may look functional

The placeholder disclosure says Brand switching is coming soon and the create action is disabled. This should prevent users from believing Brand switching exists today.

### 2. Sidebar density

The shell adds content above navigation. Styling is compact and collapsed-sidebar behavior hides text/menu to preserve the compact mode.

### 3. Native details disclosure

The disclosure uses native browser behavior to avoid JavaScript. This is intentionally non-persistent and local to the DOM.

## Rollback Plan

Rollback is simple:

1. Remove the `.brand-switcher-shell` markup from `index.html`.
2. Remove the related CSS rules from `styles.css`.
3. Remove this audit file.

No runtime state, API, routing, save/load, autosave, Dashboard, Canvas, or Brand behavior depends on this shell.

## Manual QA Checklist

1. Sidebar still loads.
2. Sidebar collapse still works.
3. Brand Switcher shell appears above nav items.
4. Shell shows `No Brand selected` and `Workspace context`.
5. Switch Brand disclosure opens a static placeholder menu.
6. Create Brand appears disabled/coming soon.
7. Existing nav items still work.
8. Dashboard and Canvas are unaffected.

## Decision

Proceed with a static Brand Switcher shell only.

Do not implement Brand records, Brand switching, Brand APIs, Board filtering, Board ownership, routing changes, save/load changes, autosave changes, or Dashboard data changes in this PR.
