# Design Foundation Implementation Audit

| Field | Value |
|---|---|
| Date | 2026-06-26 |
| Topic | Funklix additive design foundation tokens |
| Current behavior | The app has a small existing `:root` token set plus many feature-specific hard-coded colors, radii, shadows, spacing values, and typography sizes. Buttons, cards, badges, inputs, and modals are styled inconsistently across surfaces. |
| Goal | Prepare the smallest safe design-foundation implementation before the Home Dashboard by adding only additive `--fk-*` CSS variables and avoiding UI migration. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/engineering-constitution.md`
- `docs/constitution/design-constitution.md`
- `docs/design-system/README.md`
- `styles.css`
- `index.html`
- `app.js`

## Current behavior

- `styles.css` already has a `:root` section with existing product tokens such as `--bg`, `--panel`, `--text`, `--muted`, `--primary`, `--primary-soft`, `--border`, `--danger`, and sidebar width tokens.
- The global font is Inter with system fallbacks.
- Toolbar buttons are styled mostly by placement through `.actions button`, with local variants for primary actions.
- Inspector buttons are mostly styled through `.node-form button` rather than semantic component classes.
- Campaign V3 has the strongest existing premium button/modal direction, with scoped primary and secondary button classes.
- AI Brain, Insights, Brand Core, Boards, Campaign builder, and Campaign V3 each define their own card, panel, badge, input, and modal-like styles.
- Browser-default or under-styled buttons can still appear where unclassed buttons are generated or only partially styled, especially legacy hooks, generated modals, calendar controls, and some Brand Core/board flows.

## Strongest existing design direction

The strongest existing Funklix direction is a calm, premium, light interface using:

- white and soft blue-purple surfaces,
- rounded cards and pills,
- subtle borders,
- soft shadows,
- blue/purple primary actions,
- green success states,
- restrained purposeful motion,
- readable Inter typography.

Campaign V3 provides the clearest premium action/modal treatment, while AI Brain and Brand Core provide the clearest reusable card direction.

## Goal

Add only additive design tokens now so future Dashboard and design-system work can consume shared values without changing existing product behavior.

## Risks

- Changing existing variables could unintentionally restyle current surfaces.
- Changing global selectors such as `button`, `input`, `.actions button`, `.node-form button`, modal selectors, or node selectors could affect Campaign Canvas, inspector, Campaign V3, Brand Core, Boards, or AI Brain.
- Applying new primitives to existing UI in the same PR would increase review and regression risk.
- Introducing Dashboard in the same PR would mix foundation work with feature implementation.

## Blast radius

Low if the first implementation is limited to:

- adding `--fk-*` variables inside the existing `:root`, and
- saving this audit document.

Medium to high if the implementation changes existing selectors, applies new tokens to existing components, changes global button/input styles, or touches runtime files.

## Recommendation

Implement the smallest safe first PR:

1. Add a clearly labeled `/* Funklix Design Foundation Tokens */` section in `styles.css`.
2. Add only new `--fk-*` CSS variables for colors, radius, shadows, spacing, and typography.
3. Do not modify existing variables.
4. Do not add button, card, badge, input, or modal classes yet.
5. Do not apply tokens to existing UI.
6. Do not change `app.js`, `index.html`, API files, Campaign Canvas rendering, Campaign V3 logic, node styles, modal styles, inspector styles, or global button styles.

## Decision

Proceed with an additive token-only design foundation PR and preserve all current runtime behavior.

## Follow-up

- Add component classes in a later dedicated PR only after tokens are reviewed.
- Build the Home Dashboard Shell as the first consumer of the foundation in a separate PR.
- Avoid global CSS migration until Dashboard validates the foundation.
