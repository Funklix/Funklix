# Top Toolbar Controls Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Topic | Persistent top toolbar controls visual foundation migration |
| Current behavior | Top toolbar markup is static in `index.html`, with behavior wired by stable IDs in `app.js`. Toolbar layout has several inline CSS rules in `index.html` plus legacy button/search/status styles in `styles.css`. |
| Goal | Modernize persistent top toolbar controls with existing `--fk-*` tokens and `.fk-*` primitives without changing runtime behavior, control order, default visibility, or toolbar layout. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`
- `docs/audits/2026-06-27-sidebar-navigation-foundation-audit.md`
- `index.html`
- `styles.css`
- `app.js`

## Current toolbar findings

- The visible top toolbar contains primary controls for Create Campaign, Add Node, Undo, search, auth, Filters, Utilities, board access/status, presence, and Copy Link.
- Hidden legacy toolbar hooks remain in `#legacy-toolbar-hooks` and should not be removed or visually migrated in this PR.
- Toolbar event listeners are keyed by stable IDs such as `#create-campaign-btn`, `#add-node-btn`, `#undo-btn`, `#node-search-input`, `#filters-toggle-btn`, `#utilities-toggle-btn`, `#copy-board-link-btn`, and auth controls.
- Filters and Utilities menus are positioned from the existing button bounding boxes, so controls can receive additive classes but should not move or be reordered.
- Existing toolbar button styles are split across inline toolbar CSS, `.actions button`, `.actions .primary-add`, `.actions .create-campaign-btn`, `.topbar button`, utility classes, and individual auth/share/status classes.
- The search input uses ID-specific legacy styling and can safely adopt `.fk-input` if its width and compact toolbar sizing remain scoped.
- Board access/status chips can safely adopt `.fk-pill`/`.fk-badge` classes because their text/state logic remains ID/class based; however, owner/editor/viewer color variants should remain untouched in this PR.

## Safest migration path

- Add `.fk-btn` variants to visible toolbar buttons only.
- Add `.fk-input` to the visible node search input.
- Add `.fk-pill`/`.fk-badge` only to existing visible status/access spans where markup remains unchanged.
- Preserve all IDs, labels, hidden classes, `hidden` attributes, event listeners, and DOM order.
- Leave `#legacy-toolbar-hooks` intact and do not migrate hidden hook buttons in this PR.
- Keep filters/utilities popover behavior unchanged by avoiding app.js changes.
- Scope CSS overrides to `.topbar` and existing toolbar selectors so Dashboard, Sidebar, Inspector, Campaign Generator, Canvas, nodes, AI Brain, Brand Core, and Insights remain untouched.

## Controls safe to adopt `.fk-*`

- `#create-campaign-btn` → `.fk-btn .fk-btn-primary`
- `#add-node-btn` → `.fk-btn .fk-btn-secondary`
- `#undo-btn` → `.fk-btn .fk-btn-ghost`
- `#node-search-input` → `.fk-input`
- `#google-signin-btn` → `.fk-btn .fk-btn-secondary`
- `#auth-signout-btn` → `.fk-btn .fk-btn-ghost`
- `#filters-toggle-btn` and `#utilities-toggle-btn` → `.fk-btn .fk-btn-secondary`
- `#duplicate-board-cta-btn` → `.fk-btn .fk-btn-secondary`
- `#copy-board-link-btn` → `.fk-btn .fk-btn-ghost`
- Board access chips → `.fk-pill`
- Read-only notice → `.fk-badge .fk-badge-warning`

## Controls intentionally untouched

- Hidden legacy hook controls inside `#legacy-toolbar-hooks`.
- Filters and Utilities popover internals.
- Presence avatar internals and collaboration follow UI.
- Save/share logic and hidden share panel hooks.
- Any generated menu or modal content.

## Blast radius

Medium-low. The PR touches static toolbar class names in `index.html`, toolbar/search/status CSS in `styles.css`, and this audit file. Runtime behavior remains owned by existing IDs and event listeners in `app.js`.

## Risks

- Generic `.fk-btn` min-height and hover transforms could make the toolbar too tall or visually jumpy if not overridden in `.topbar`.
- Legacy `.actions` and `.topbar button` rules could override `.fk-*` primitives unless scoped away from `.fk-btn`.
- Filters and Utilities popover placement depends on button bounds, so spacing changes must remain compact.

## Decision

Proceed with a visual-only, class-based migration of visible top toolbar controls. Do not modify `app.js`; the existing event listeners and positioning logic remain valid.

## Follow-up

- Migrate filter/utility popover internals in a separate audit/PR.
- Consider moving toolbar inline CSS from `index.html` into `styles.css` in a dedicated cleanup PR.
- Audit broader board/share/status indicator semantics before replacing owner/editor/viewer chip variants.
