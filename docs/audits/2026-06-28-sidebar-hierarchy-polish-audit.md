# Sidebar Hierarchy Polish Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | PR 15A sidebar hierarchy polish audit |
| Scope | Brand Switcher shell presentation only |
| Runtime behavior changes | None |
| Files changed | `styles.css`, `docs/audits/2026-06-28-sidebar-hierarchy-polish-audit.md` |

## Documents Read

- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/audits/2026-06-28-brand-switcher-shell-audit.md`

## Goal

Polish the visual hierarchy of the Sidebar Brand Switcher shell so it feels like a compact navigation/context selector instead of a dashboard card.

This PR is presentation-only.

## Audit Findings

### 1. Current sidebar / Brand Switcher visual issue

The Brand Switcher shell introduced the right product hierarchy, but its first-pass styling made it feel heavier than the surrounding sidebar navigation.

Issues observed:

- The shell used card-like padding, border treatment, background, and shadow.
- The summary row used a larger avatar and card-like radius.
- The menu occupied normal document flow when opened, pushing nav content down.
- The component visually competed with the actual nav items instead of acting as lightweight context.

### 2. Affected markup/classes

No markup change was required.

Affected CSS classes only:

- `.brand-switcher-shell`
- `.brand-switcher-eyebrow`
- `.brand-switcher-summary`
- `.brand-switcher-avatar`
- `.brand-switcher-copy strong`
- `.brand-switcher-menu`
- collapsed-sidebar Brand Switcher rules

### 3. Preserved nav IDs

The existing nav IDs remain untouched:

- `home-nav-btn`
- `campaign-canvas-nav-btn`
- `boards-nav-btn`
- `brand-core-nav-btn`
- `ai-brain-nav-btn`
- `insights-nav-btn`

No nav item was moved, renamed, or restyled in this PR.

### 4. Preserved runtime behavior

No JavaScript was changed.

The native `<details>` disclosure behavior remains the same and is still non-persistent.

The placeholder state remains:

- `Current Brand`
- `No Brand selected`
- `Workspace context`
- Brand switching coming soon
- disabled create Brand placeholder

### 5. Chosen implementation approach

CSS-only polish.

Changes made:

- Removed card-like border/background/shadow from the outer shell.
- Reduced vertical spacing and padding.
- Reduced summary height and avatar size.
- Made the control look closer to a sidebar context selector.
- Converted the placeholder menu to an overlay-style dropdown so opening it does not push navigation downward.
- Preserved collapsed-sidebar behavior while making the collapsed shell more compact.

## Behavior Unchanged Confirmation

This PR does not:

- implement real Brands
- add APIs
- change Board ownership
- change Brand Core
- change AI Brain
- change Dashboard data
- change routing
- change autosave
- change save/load
- change Canvas
- change nav IDs
- change nav behavior
- add persistent state
- modify `app.js`
- modify `index.html`

## Risks

### 1. Menu overlay can cover nav items

The placeholder menu is now overlay-style to preserve sidebar hierarchy. It may visually overlap the first nav items while open, but that is acceptable for a temporary non-functional placeholder and avoids expanding the sidebar stack.

### 2. Context selector may feel understated

The shell is intentionally quieter. It still includes the `Current Brand` eyebrow and `No Brand selected` state so the Workspace → Brand context remains visible.

### 3. Collapsed mode density

Collapsed mode hides text/menu and keeps only the compact avatar, preserving existing collapse behavior.

## Rollback Plan

Rollback is simple:

1. Revert the `.brand-switcher-*` CSS changes in `styles.css`.
2. Remove this audit file.

No runtime, routing, save/load, autosave, Dashboard, Canvas, Brand, Board, or nav behavior depends on this polish.

## Manual QA Checklist

1. Sidebar expanded looks cleaner and more compact.
2. Sidebar collapsed still works.
3. Brand Switcher still shows `No Brand selected`.
4. Placeholder menu still opens.
5. Nav items still work.
6. Dashboard and Canvas are unaffected.

## Decision

Proceed with CSS-only Sidebar Brand Switcher hierarchy polish.

Do not implement real Brands, APIs, Board ownership, routing, autosave, save/load, Canvas, Dashboard data, nav behavior, or persistent state in this PR.
