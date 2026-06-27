# Inspector Action Buttons Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Topic | Inspector static action button migration to Funklix button primitives |
| Current behavior | Inspector action buttons are static markup in `index.html` and behavior is wired by stable IDs in `app.js`. Existing styling comes from broad `.node-form button` and section rules. |
| Goal | Modernize static Inspector action buttons with `.fk-btn` variants without changing IDs, DOM order, labels, event listeners, visibility, disabled/loading behavior, or runtime logic. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-27-inspector-ui-migration-audit.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`
- `index.html`
- `styles.css`
- `app.js`

## Findings

- Static Inspector action buttons are grouped across Landing actions, Images actions, AI Actions, and Node Actions.
- `app.js` wires behavior by existing button IDs, so additive class changes in `index.html` are sufficient.
- `generate-header-visual-btn` mutates its own `disabled` state and `textContent` during loading; the migration must preserve disabled styling and not change runtime behavior.
- Destructive Node actions need clearer danger treatment, but this should be Inspector-scoped rather than a new global `.fk-btn-danger`.
- Generated image controls are out of scope because they are created dynamically in `app.js`.
- No `app.js` changes are necessary.

## Safe migration targets

- Landing action: `generate-header-visual-btn`
- Image actions: `generate-image-btn`, `generate-posting-visual-btn`
- AI actions: `improve-node-btn`, `generate-next-step-inspector-btn`, `review-node-btn`, `regenerate-node-btn`, `regenerate-platform-btn`, `add-to-posting-calendar-btn`, `generate-full-pack-btn`
- Node actions: `disconnect-selected-btn`, `propagate-descendants-btn`, `delete-node-btn`, `delete-selected-btn`

## Button hierarchy

- Primary: `improve-node-btn`
- Secondary: generation, review, schedule, disconnect, and propagate actions
- Ghost: regenerate actions
- Inspector-scoped danger: delete actions while retaining existing `danger` class

## Deferred / legacy areas

- Generated image action buttons in `renderInspectorImages()`.
- AI Workspace rendering.
- File upload controls.
- Connected context.
- Any runtime state, loading, save/load, autosave, or business logic.

## Blast radius

Low-medium. The implementation should touch static classes in `index.html`, Inspector-scoped button CSS in `styles.css`, and this audit file. Runtime remains owned by existing IDs and event listeners.

## Decision

Proceed with class-only migration. Do not modify `app.js`; use Inspector-scoped danger styling instead of adding a global `.fk-btn-danger`.
