# Boards / My Boards Design Migration Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | UX Unification Sprint 1 PR 1 audit and implementation record |
| Scope | Boards / My Boards UI only |
| Runtime behavior changes | None intended |
| Files changed | `index.html`, `app.js`, `styles.css`, `docs/audits/2026-07-06-boards-design-migration-audit.md` |

## Documents Read

- `docs/audits/2026-07-06-ui-design-system-migration-audit.md`
- `docs/design-system/README.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`

## Goal

Modernize the Boards / My Boards UI so it feels like a finished premium product surface and aligns with Mission Control while preserving every existing board behavior.

This PR is intentionally a small visual migration. It does not change board persistence, loading, creation, duplication, sharing/copy, ownership, access permissions, routing, autosave, save/load, Canvas, Dashboard, Brand Core, AI Brain, APIs, or the data model.

---

## Audit Findings

### 1. Static Boards markup in `index.html`

The Boards / My Boards surface is the static section `#boards-library-view`.

Behavior-facing static IDs found:

- `boards-library-view`
- `boards-library-title`
- `boards-library-subtitle`
- `boards-create-btn`
- `boards-library-list`

The static Create New Board button is stored in `app.js` as `el.boardsCreateButton` and must preserve `#boards-create-btn`.

### 2. Generated board markup in `app.js`

Board rows are rendered by `renderBoardsLibrary()`.

Behavior-facing generated data attributes found:

- `data-open-board`
- `data-copy-board`
- `data-rename-board`
- `data-delete-board`
- `data-up-board`
- `data-down-board`
- `data-index`
- `data-claim-board`
- `data-rename-wrap`
- `data-rename-input`
- `data-rename-save`
- `data-rename-cancel`

These attributes are event targets and must remain intact.

### 3. Boards event listeners and selectors

Boards actions are handled through document-level click delegation in `bindGlobalResetDelegation()`.

Connected handlers/selectors:

- `[data-open-board]` routes to `/boards/:id`.
- `[data-rename-board]` reveals the matching rename row via `[data-rename-wrap]`.
- `[data-rename-cancel]` hides the rename row.
- `[data-rename-save]` reads `[data-rename-input]` and calls `renameBoard()`.
- `[data-delete-board]` calls `deleteBoard()`.
- `[data-up-board]` and `[data-down-board]` call `moveBoard()` using `data-index`.
- `[data-claim-board]` sends the existing claim PATCH request.
- `[data-copy-board]` writes the board URL to the clipboard and temporarily updates the clicked button text.
- `#boards-create-btn` remains the existing create-board trigger.

### 4. Current board card render function

`renderBoardsLibrary()` owns:

- authenticated vs unauthenticated title/subtitle copy
- empty state rendering
- board row creation
- role/copy chip rendering
- board metadata display
- rename form rendering
- row action buttons

### 5. Search/filter/create/open/duplicate/share/copy handlers

- No Boards-specific search or filter controls are present in this surface.
- Create is triggered by `#boards-create-btn` and existing create-board logic.
- Open is triggered by `data-open-board`.
- Copy/share is triggered by `data-copy-board` per board row and `#copy-board-link-btn` in the toolbar outside this PR scope.
- Duplicate current board is available through the Utilities menu via `data-utility-action="duplicate-board"`; that menu is outside this PR scope.

### 6. Legacy UI identified in Boards

- Static Boards section used a compact legacy row header and a `primary-add boards-create-btn` create button.
- Board cards were bespoke `.board-row` surfaces rather than `.fk-card`-aligned cards.
- Status chips were bespoke `.board-row-chip` pills.
- Row actions used `.icon-btn` with mixed icon/text behavior.
- Rename form used unclassed input/buttons.
- Empty state had only headline and description, without one clear action.
- Inline CSS in `index.html` still contains older Boards rules; this PR avoids broad cleanup and overrides only within `#boards-library-view` from `styles.css`.

### 7. Safe class-only / presentation migration targets

Safe targets selected:

- Add `.fk-section` to `#boards-library-view`.
- Add `.fk-btn .fk-btn-primary` to `#boards-create-btn` while preserving `primary-add boards-create-btn` and ID.
- Add `.fk-card` to generated `.board-row` cards.
- Add `.fk-pill` to generated board role/copy chips.
- Add `.fk-input` and `.fk-btn` variants to generated rename controls.
- Replace legacy row action classes with scoped `board-action-btn` plus `.fk-btn` variants while preserving every `data-*` target.
- Add `.fk-card` / `.fk-badge` / `.fk-btn` primitives to the empty state and route the empty-state CTA to the existing `#boards-create-btn` behavior.
- Add scoped `#boards-library-view` CSS only.

### 8. Markup that must remain unchanged

The following must remain stable:

- `#boards-library-view`
- `#boards-library-title`
- `#boards-library-subtitle`
- `#boards-create-btn`
- `#boards-library-list`
- all generated `data-*` action attributes listed above
- generated `data-index` values for move up/down behavior
- `data-rename-wrap`, `data-rename-input`, `data-rename-save`, and `data-rename-cancel` relationships

### 9. CSS selectors with wider impact

Existing inline selectors such as `.boards-library-panel`, `.board-row`, `.board-row-chip`, `.icon-btn`, and `.board-rename` may affect or be reused by nearby surfaces. Notably, `.boards-library-panel` is also used by AI Brain and Insights containers.

To avoid wider impact, the implementation adds new CSS scoped under `#boards-library-view` instead of rewriting global or inline rules.

### 10. Smallest safe implementation scope

The smallest safe implementation is:

1. Static Boards header polish and `.fk-*` class adoption.
2. Generated board card presentation migration while preserving all `data-*` event targets.
3. Empty state alignment to headline, description, one clear action.
4. Scoped Boards-only CSS for premium card layout and responsive stacking.
5. No changes to API calls, data shape, persistence, routing, ownership, access, save/load, autosave, or Canvas behavior.

---

## Implementation Summary

### Static shell

- Converted `#boards-library-view` to a more complete library shell with `.fk-section`.
- Added a compact badge-style kicker.
- Kept `#boards-library-title`, `#boards-library-subtitle`, `#boards-create-btn`, and `#boards-library-list` unchanged.
- Added `.fk-btn .fk-btn-primary` to the existing Create New Board button.

### Generated board cards

- Generated board rows now include `.fk-card`.
- Ownership/status chips now include `.fk-pill`.
- Main row actions now use `.fk-btn` variants with scoped `.board-action-btn` styling.
- Rename controls now use `.fk-input` and `.fk-btn` variants.
- All behavior-facing `data-*` attributes are preserved.

### Empty state

The empty state now follows the required pattern:

1. Headline: `No boards yet`
2. Description: `Create your first board to start collaborating.`
3. One clear action: `Create New Board`

The empty-state action delegates to the existing `#boards-create-btn` click path instead of introducing a new create-board behavior.

### Scoped CSS

Added a `/* Boards / My Boards design migration */` section in `styles.css` scoped to `#boards-library-view`.

The CSS covers:

- premium library shell treatment
- header hierarchy
- card spacing and hover polish
- ownership/status chip polish
- row action button hierarchy
- rename form spacing
- empty state layout
- responsive stacking at narrower widths

---

## IDs / Event Targets Preserved

Preserved static IDs:

- `boards-library-view`
- `boards-library-title`
- `boards-library-subtitle`
- `boards-create-btn`
- `boards-library-list`

Preserved generated event targets:

- `data-open-board`
- `data-copy-board`
- `data-rename-board`
- `data-delete-board`
- `data-up-board`
- `data-down-board`
- `data-index`
- `data-claim-board`
- `data-rename-wrap`
- `data-rename-input`
- `data-rename-save`
- `data-rename-cancel`

Added one presentation-only empty state target:

- `data-empty-create-board`

It forwards to the existing `#boards-create-btn` path and does not add a new creation flow.

---

## Deferred Legacy Elements

Deferred intentionally:

- Utilities menu duplicate-board action styling.
- Top toolbar copy/share controls.
- Board delete confirmation modal styling.
- Older inline Boards CSS cleanup in `index.html`.
- AI Brain and Insights use of `.boards-library-panel`.
- Any Boards search/filter feature; none exists in the current Boards surface.
- Any board loading behavior or skeleton state.
- Any API, persistence, routing, ownership, sharing, duplication, or save/load behavior.

---

## Risk / Blast Radius

Risk: **Medium-low**.

Reasoning:

- The changed UI is limited to the Boards / My Boards surface.
- Existing behavior-facing IDs and data attributes are preserved.
- Generated row structure remains a row with content and action regions.
- The only added event target delegates to the existing create button.
- CSS is scoped under `#boards-library-view` to avoid affecting Dashboard, Canvas, Brand Core, AI Brain, Insights, Inspector, toolbar, or modals.

---

## Manual QA Checklist

- Open Boards / My Boards.
- Board list renders correctly.
- Open board still works.
- Create board still works from the header.
- Create board still works from the empty state when no boards are available.
- Copy link action still writes the board URL and updates feedback text.
- Rename still opens, saves, and cancels.
- Delete still opens the existing confirmation and deletes when confirmed.
- Move up/down still works.
- Claim still works when available.
- Duplicate current board still works from Utilities menu.
- Sidebar navigation still works.
- Dashboard is unaffected.
- Canvas is unaffected.
- Autosave is unaffected.

## Decision

Proceed with this smallest safe Boards / My Boards visual migration.

Do not include broader popover, modal, duplicate-flow, API, persistence, routing, Dashboard, Canvas, Brand Core, AI Brain, Insights, save/load, or autosave changes in this PR.
