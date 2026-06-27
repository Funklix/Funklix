# Dashboard Design Migration Audit

| Field | Value |
|---|---|
| Date | 2026-06-26 |
| Topic | Migrate Home Dashboard shell to Funklix design component primitives |
| Current behavior | Home Dashboard uses Dashboard-scoped markup and CSS for its hero, quick actions, cards, and placeholders. Reusable `.fk-*` primitives now exist but are not consumed by Dashboard yet. |
| Goal | Make Home Dashboard the first isolated consumer of the new Design Component Foundation without changing layout, runtime behavior, or dashboard functionality. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-home-dashboard-shell-implementation-audit.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`
- `index.html`
- `styles.css`

## Findings

- The Dashboard shell is isolated in `#dashboard-view` and can be migrated through class names without touching app behavior.
- Quick Actions are already delegated through `data-dashboard-action`; adding design classes to those buttons does not affect behavior.
- Dashboard cards duplicate surface styles now provided by `.fk-card`.
- Dashboard quick-action buttons duplicate button styles now provided by `.fk-btn` variants.
- Dashboard kicker labels can safely consume `.fk-badge` for the first badge adoption.
- Placeholder states should remain Dashboard-specific because they are longer text blocks and `.fk-pill` is better reserved for compact labels.
- `.fk-section` is appropriate for the hero shell while Dashboard-specific classes continue to own layout.

## Safest migration path

- Update only Home Dashboard markup in `index.html` to add `.fk-*` classes alongside existing `dashboard-*` classes.
- Keep Dashboard-specific classes for layout, spacing, typography, and placeholder treatment.
- Remove duplicated Dashboard-specific surface/button styling that is now supplied by `.fk-section`, `.fk-card`, `.fk-card-header`, `.fk-card-body`, `.fk-badge`, and `.fk-btn`.
- Do not change `app.js`.

## Blast radius

Low. The migration is isolated to `#dashboard-view` markup and `.dashboard-*` CSS. No existing Canvas, Brand Core, AI Brain, Insights, Campaign V3, inspector, modal, save/load, routing, or API behavior should change.

## Risks

- Double padding or double shadows if Dashboard classes and `.fk-*` classes both define the same surface styles.
- Button appearance may shift if Dashboard-specific button styles are not removed after adopting `.fk-btn`.
- Placeholder text should not use `.fk-pill` if it makes longer empty states cramped.

## Recommendation

Proceed with a small Dashboard-only class migration:

- Add `.fk-section` to `.dashboard-hero`.
- Add `.fk-badge` to `.dashboard-kicker` labels.
- Add `.fk-btn` plus `fk-btn-primary`, `fk-btn-secondary`, or `fk-btn-ghost` to quick actions.
- Add `.fk-card`, `.fk-card-header`, and `.fk-card-body` to Dashboard cards.
- Keep `.dashboard-view`, `.dashboard-hero`, `.dashboard-grid`, `.dashboard-card`, `.dashboard-placeholder`, and related classes for layout and Dashboard-specific semantics.
- Remove duplicated Dashboard-specific button and card surface declarations from `styles.css`.

## Decision

Implement the migration as Dashboard markup and Dashboard-scoped CSS only. Do not change runtime JavaScript.

## Follow-up

- Future Dashboard cards can start with `.fk-card` by default.
- Future compact status labels can use `.fk-pill` where labels are short.
- Broader product migration should happen one surface at a time after local audits.
