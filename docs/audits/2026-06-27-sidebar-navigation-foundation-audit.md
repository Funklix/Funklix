# Sidebar Navigation Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Topic | Sidebar navigation foundation visual migration |
| Current behavior | Sidebar markup is static in `index.html`, with navigation buttons wired by IDs in `app.js` and styled by legacy `.nav-item`, `.logo`, `.sidebar-toggle`, and sidebar selectors in `styles.css`. |
| Goal | Modernize only the persistent sidebar navigation foundation while preserving all navigation behavior, collapse behavior, view switching, routing, and runtime systems. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`
- `index.html`
- `styles.css`
- `app.js`

Note: `docs/audits/2026-06-27-workspace-shell-design-audit.md` was requested as review context but was not present in the repository at audit time.

## Current sidebar findings

- Sidebar markup contains the logo, collapse button, primary navigation, and Activity panel in one persistent aside.
- Navigation items are plain buttons with stable IDs used by event listeners for Home, Campaign Canvas, Boards, Brand Core, AI Brain, and Insights.
- Navigation icons are emoji stored in `data-icon` attributes and rendered with `.nav-item::before`.
- Icons are not inline SVG, icon font glyphs, or image assets.
- Collapse behavior is controlled by `setSidebarCollapsed()` in `app.js`, which toggles `sidebar-collapsed` and updates the collapse button text/ARIA/title.
- Active state handling is controlled by `setActiveView()` in `app.js`, which toggles `.active` on the existing nav buttons.
- Current hover and active states share the same visual treatment, making the active destination less distinct.
- Current sidebar styles use legacy variables such as `--panel`, `--border`, `--primary`, and `--primary-soft` rather than the newer `--fk-*` tokens.

## Safest migration path

- Add `.fk-btn` to the sidebar collapse button and primary navigation buttons only.
- Keep all existing nav IDs, labels, `data-icon` values, and event listeners unchanged.
- Preserve emoji icons in this PR and only normalize their container sizing/alignment.
- Use sidebar-scoped CSS to override generic `.fk-btn` sizing so nav items remain full-width, calm, and scan-friendly.
- Separate hover, active, and focus-visible states with `--fk-*` tokens.
- Leave Activity Feed, profile/footer areas, collaboration widgets, toolbar, inspector, Dashboard, Campaign Generator, Canvas, nodes, AI Brain, Brand Core, and Insights untouched.

## Recommended future icon strategy

- Replace emoji icons in a later dedicated PR with a small inline SVG icon set checked into the repository or authored directly in markup.
- Do not add an icon library dependency unless a broader product decision approves it.
- Keep icon dimensions fixed to avoid platform-dependent emoji rendering differences.

## Blast radius

Low. The implementation should touch only static sidebar/collapse/nav classes in `index.html`, sidebar navigation styles in `styles.css`, and this audit document. Runtime behavior remains owned by the existing IDs and functions in `app.js`.

## Risks

- Generic `.fk-btn` styles could introduce unwanted shadows/transforms if not overridden inside `.sidebar`.
- Collapsed sidebar width is narrow, so logo and collapse button spacing must remain safe.
- Changing nav labels, IDs, or `data-icon` values would risk navigation regressions and is explicitly out of scope.

## Decision

Proceed with a visual-only, additive class migration for the sidebar navigation foundation. Do not modify `app.js` because the existing collapse and active-state logic can remain unchanged.

## Follow-up

- Save the broader Workspace Shell audit as a dated file if the next PR continues shell migration work.
- Audit a future inline SVG icon strategy before replacing emoji icons.
- Migrate Activity Feed separately; it is intentionally excluded from this PR.
