# Design Components Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-26 |
| Topic | Additive reusable Funklix design component classes |
| Current behavior | Funklix has additive `--fk-*` design tokens and several feature-specific button, card, input, badge, modal, and dashboard styles. There is not yet an official reusable component class layer. |
| Goal | Establish the first reusable component foundation using only existing `--fk-*` tokens without changing current screens or runtime behavior. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-design-foundation-implementation-audit.md`
- `styles.css`

## Existing style findings

- `styles.css` already defines additive `--fk-*` color, radius, shadow, spacing, and typography tokens.
- Existing buttons are feature-scoped across toolbar actions, Brand Core, social actions, Campaign builder, Campaign V3, Dashboard, and other surfaces.
- Existing cards are feature-scoped across Brand Core, AI Brain, Insights, Campaign builder, Campaign V3, and Dashboard.
- Existing inputs are feature-scoped across inspector forms, Brand Core forms, Campaign builder forms, and board flows.
- Existing badges and pills are feature-scoped across Brand Core tags, social status, board access chips, Campaign V3 summary chips, and Dashboard placeholders.
- Modal styles are currently specialized and should not be touched by this foundation PR.

## Safest insertion point

Add a clearly labeled `/* Funklix Design Component Foundation */` section in `styles.css` immediately after the existing `:root` design token block and before the global `*` selector.

This keeps reusable primitives close to the tokens they consume and avoids editing existing feature-specific selectors.

## Blast radius

Low, if the implementation only adds unused `.fk-*` classes and does not attach those classes to existing markup.

No visual changes should occur because no existing screen will use the new classes in this PR.

## Risks

- Accidentally modifying existing selectors would create visual regressions.
- Applying new classes to current markup would turn this into a migration PR.
- Adding new colors instead of using existing tokens would weaken the design foundation.
- Global element selectors could affect Campaign Canvas, nodes, inspector, modals, Campaign V3, Brand Core, AI Brain, Insights, or Dashboard.

## Recommendation

Proceed with a foundation-only CSS addition:

- Add `.fk-btn`, `.fk-btn-primary`, `.fk-btn-secondary`, `.fk-btn-ghost`.
- Add `.fk-card`, `.fk-card-header`, `.fk-card-body`.
- Add `.fk-input`, `.fk-select`, `.fk-textarea`.
- Add `.fk-badge`, `.fk-badge-success`, `.fk-badge-warning`, `.fk-badge-danger`.
- Add `.fk-pill`.
- Add `.fk-section`.

Use only existing `--fk-*` design tokens. Include hover, active, disabled, and focus-visible states where relevant. Do not alter existing selectors or markup.

## Decision

Implement the reusable component foundation as additive CSS only.

## Follow-up

Future PRs can migrate one surface at a time after local audits. Recommended order:

1. New Dashboard surfaces.
2. Low-risk static settings or documentation-like screens.
3. Brand Core secondary controls.
4. AI Brain and Insights cards.
5. Inspector and Campaign Canvas controls only after dedicated Canvas/Inspector audits.
