# Inspector Image Controls Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Topic | Inspector image/upload/gallery controls migration to Funklix design primitives |
| Current behavior | Static image controls live in the Inspector Images section in `index.html`, while uploaded/generated image cards and their favorite/download/delete actions are rendered dynamically by `renderInspectorImages(node)` in `app.js`. |
| Goal | Modernize only Inspector image/upload/gallery controls visually with additive `.fk-*` classes and scoped CSS while preserving upload, lightbox, favorite, download, delete, image serialization, save/load, autosave, and Canvas behavior. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-27-inspector-ui-migration-audit.md`
- `docs/audits/2026-06-27-inspector-action-buttons-foundation-audit.md`
- `index.html`
- `styles.css`
- `app.js`
- `renderInspectorImages(node)`
- `removeNodeImage(node, imageId)`
- `downloadNodeImage(node, img)`
- `openLightbox(imageUrl, alt)`

## Findings

- Static image controls are isolated in the Inspector Images section: `content-upload-fields`, `node-image-upload`, `inspector-image-list`, `content-format-field`, `node-content-format`, `generate-image-btn`, and `generate-posting-visual-btn`.
- Image prompt and landing header visual controls are image-related but already participate in prior static field/action migrations; only safe class additions should be made where needed.
- `renderInspectorImages(node)` dynamically creates image cards, thumbnails, favorite tags, action controls, and empty-state text.
- Dynamic image actions rely on direct event listeners attached inside `renderInspectorImages(node)`, so class additions must not alter button creation order, event handlers, or propagation guards.
- Favorite, download, delete, and lightbox behavior are event-driven and should remain unchanged.
- Existing image CSS already owns the gallery layout and hover behavior, making the safest migration additive class names plus scoped visual overrides.
- `app.js` changes are justified only for additive class names on generated image cards/actions/empty state; no logic changes are needed.

## Image-related IDs/classes/event dependencies

- Static IDs: `content-image-prompt-field`, `node-image-prompt`, `landing-page-fields`, `lp-header-visual-prompt`, `generate-header-visual-btn`, `content-upload-fields`, `node-image-upload`, `inspector-image-list`, `content-format-field`, `node-content-format`, `generate-image-btn`, `generate-posting-visual-btn`.
- Dynamic classes to preserve: `inspector-image-item`, `is-favorite`, `inspector-image-thumb`, `inspector-image-favorite-tag`, `inspector-image-actions`, `inspector-image-action`, `danger`, `inspector-image-name`.
- Event dependencies: card/thumbnail click opens the lightbox; favorite action toggles `node.favoriteImageId`; download action calls `downloadNodeImage(node, img)`; delete action calls `removeNodeImage(node, img.id)`.

## Safe migration targets

- Add `.fk-card` to the static Images section and generated image cards.
- Add `.fk-input` to the static file input.
- Add `.fk-select` to the static content format select.
- Add `.fk-btn` and `.fk-btn-ghost` to generated favorite/download/delete buttons while preserving `inspector-image-action` and `danger`.
- Add `.fk-pill` to the generated favorite tag.
- Add `.dashboard-placeholder` is not appropriate; use Inspector-specific empty-state styling instead.

## Deferred / legacy areas

- Image generation logic.
- Upload handling logic.
- Blob storage and object URL lifecycle.
- Favorite image state logic.
- Lightbox creation/open/close logic.
- Image serialization, save/load, autosave, and node data model.
- Canvas node image-strip rendering.
- Campaign V3 and Campaign Generator image flows.

## Blast radius

Low-medium. Static markup changes are class-only in `index.html`. Dynamic markup changes in `app.js` are limited to additive `className` strings inside `renderInspectorImages(node)`. Scoped CSS can polish the generated gallery without changing event behavior.

## Decision

Proceed with the smallest visual migration: add `.fk-*` classes to static image controls, add additive `.fk-*` classes to generated image gallery elements, and add Inspector-scoped CSS for file input spacing, cards, thumbnails, actions, favorite state, and empty state. Do not change image logic, event handlers, persistence, lightbox behavior, or Canvas rendering.
