# Campaign Generator Design Migration Audit

| Field | Value |
|---|---|
| Date | 2026-06-26 |
| Topic | Campaign Generator modal migration to Funklix design component primitives |
| Current behavior | Campaign Generator modal markup is generated in `app.js` and styled with feature-specific `.campaign-builder-*` selectors. The reusable `.fk-*` component foundation exists but is not yet consumed by the generator modal. |
| Goal | Visually migrate the existing Campaign Generator modal to reusable design primitives without changing fields, defaults, validation, Campaign V3 logic, generation flow, loading animation, or modal behavior. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`
- `app.js`
- `styles.css`

## Findings

- The Campaign Generator modal is not static HTML; both V3 and legacy generator modal markup are generated in `app.js`.
- Class-only markup updates in `app.js` are required to adopt `.fk-btn`, `.fk-card`, `.fk-input`, `.fk-select`, `.fk-textarea`, `.fk-section`, and `.fk-badge` directly.
- Existing modal fields, IDs, defaults, and event bindings are keyed by IDs and data attributes, so adding classes is low risk if IDs and attributes are preserved.
- Existing `.campaign-builder-*` CSS duplicates component-foundation responsibilities for modal surface, card surfaces, inputs, selects, textareas, and action buttons.
- Loading, completion, and error experiences use separate Campaign V3 classes and should remain unchanged in this migration.

## Safest migration path

- Add `.fk-*` classes to the generated initial V3 and legacy Campaign Generator modal markup only.
- Preserve every existing ID, `type`, `min`, `max`, `value`, `checked`, `rows`, placeholder, option, and data attribute.
- Keep `.campaign-builder-*` classes for modal layout, grid, stepper, toggle, estimate, and Campaign-specific spacing.
- Remove duplicated generator-specific surface/form-control styles that the `.fk-*` classes now provide.
- Do not modify Campaign V3 generation, validation, repair, save/load, loading, completion, or error logic.

## Blast radius

Medium-low. The implementation touches `app.js` generated class names for the Campaign Generator modal and `styles.css` generator-specific styles. The risk is limited to visual presentation of the initial Campaign Generator forms because behavior-related IDs and event hooks are preserved.

## Risks

- Removing too much generator CSS could affect stepper layout or checkbox layout.
- Changing generated strings could accidentally alter field IDs/defaults if not constrained to class additions.
- Completion/error/loading states should not be migrated in this PR because they are part of the Campaign V3 experience and animation flow.

## Recommendation

Proceed with a class-only markup migration plus CSS cleanup:

- Use `.fk-section` on `.campaign-builder-modal`.
- Use `.fk-card` on the hero, field wrappers, builder cards, toggles, and estimate card.
- Use `.fk-badge` on generator kickers.
- Use `.fk-input`, `.fk-select`, and `.fk-textarea` on controls.
- Use `.fk-btn` variants on modal action buttons and stepper buttons.
- Keep Campaign-specific layout selectors.

## Decision

Implement the visual migration for the initial Campaign Generator modal only. Do not change runtime behavior or Campaign V3 logic.

## Follow-up

- Audit Campaign V3 loading/completion/error states separately before migrating their specialized buttons or animated states.
- Consider a dedicated checkbox primitive later if more forms adopt shared checkbox cards.
