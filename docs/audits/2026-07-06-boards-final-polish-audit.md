# Boards Final Polish Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | UX Unification Sprint 1 PR 2 final Boards polish audit |
| Scope | Boards / My Boards visual polish only |
| Runtime behavior changes | None |
| Files changed | `app.js`, `styles.css`, `docs/audits/2026-07-06-boards-final-polish-audit.md` |

## Documents Read

- `docs/audits/2026-07-06-ui-design-system-migration-audit.md`
- `docs/audits/2026-07-06-boards-design-migration-audit.md`

## Goal

Finish the Boards / My Boards surface so each board card feels like a premium campaign library item rather than a technical list row.

This PR is visual polish only. It does not add avatar storage, generate avatars, infer brands, call APIs, change routing, change persistence, change ownership, change permissions, change share/copy logic, or touch other product surfaces.

---

## Findings

### Current state after PR 1

The previous Boards migration already:

- migrated the static Boards shell to `.fk-section`
- migrated the Create New Board button to `.fk-btn .fk-btn-primary`
- migrated generated board rows to `.fk-card`
- migrated ownership/status chips to `.fk-pill`
- migrated rename controls to `.fk-input` and `.fk-btn`
- preserved all behavior-facing IDs and `data-*` attributes
- added scoped `#boards-library-view` CSS

### Remaining polish gaps

1. Board cards had no visual identity marker or avatar area.
2. Brand name was not displayed when existing Brand data was already available.
3. Last-edited metadata and ownership/access description were visually close together.
4. Actions were still presented as a flat cluster; Open, Copy Link, Rename, Delete, Move Up, and Move Down needed clearer visual hierarchy.
5. Responsive layout needed final protection so avatar, metadata, and buttons wrap without collisions.

### Existing Brand data available without new APIs

The current runtime can already have Brand data in two passive places:

- `state.brandCore` for the currently loaded board.
- `board.brand_core_snapshot` / compatible snapshot fields if a board object already includes them.

This PR reads those existing objects only. It does not add API fields, write Brand data, generate avatars, or infer Brand identity from board names.

---

## Affected Files

- `app.js`
  - Adds passive display helpers for existing Brand snapshot/avatar/name data.
  - Updates generated board card markup for avatar, Brand name, metadata hierarchy, and action hierarchy.
- `styles.css`
  - Polishes scoped `#boards-library-view` card layout, avatar treatment, Brand/metadata rows, actions, and responsive behavior.
- `docs/audits/2026-07-06-boards-final-polish-audit.md`
  - Records audit findings, decisions, preserved contracts, risks, rollback, and QA.

---

## Visual Improvements

### Brand Avatar

- Each board card now includes a passive avatar area.
- If an existing Brand Avatar URL is available from the current board Brand state or an available board Brand snapshot, the card renders that image.
- If no Brand Avatar exists, the card falls back to an initial badge.
- No avatar storage, generation, inference, or API changes were added.

### Brand Name

- When an existing Brand name is available in the Brand state/snapshot, the card displays:

```text
Brand
<Brand Name>
```

- If no Brand name exists, the Brand field is omitted.
- Brand name is not inferred from board title.

### Action hierarchy

- Primary action: `Open`
- Secondary action: `Copy Link`
- Tertiary actions: `Rename`, `Delete`, `Move Up`, `Move Down`
- Destructive and utility actions use lighter ghost styling while preserving existing `data-*` attributes and handlers.

### Card layout polish

The card hierarchy now reads as:

1. Avatar
2. Board title and status chips
3. Brand, when available
4. Last edited
5. Short existing description/access line
6. Actions

### Responsive polish

- Cards remain single-column containers with an avatar/details grid.
- Actions wrap naturally.
- Metadata rows use `overflow-wrap` and scoped spacing to avoid collision.
- Avatar dimensions shrink slightly at narrow widths while preserving proportions.

---

## Preserved IDs

No IDs were renamed or removed.

Preserved static Boards IDs:

- `boards-library-view`
- `boards-library-title`
- `boards-library-subtitle`
- `boards-create-btn`
- `boards-library-list`

---

## Preserved Handlers / Event Targets

All existing generated behavior-facing targets remain intact:

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

The PR does not alter the existing document-level delegation for these targets.

---

## Runtime Confirmation

This PR does not modify:

- app routing
- Canvas
- Dashboard / Mission Control
- Brand Core behavior
- AI Brain
- Insights
- Workspace
- Brand Switcher
- Autosave
- Save/load
- Ownership
- Permissions
- Board APIs
- Board creation
- Board deletion
- Board duplication
- Share logic
- Copy logic
- Inspector
- Toolbar
- Node rendering
- data model

Brand Avatar and Brand name display are passive reads only.

---

## Risks

### Low: current-board-only Brand data

The Boards list API does not necessarily include `brand_core_snapshot` for every board. In that case, only the current board can display Brand Avatar / Brand name from `state.brandCore`; other cards safely fall back to initials and omit Brand name.

### Low: long board names or Brand names

Long strings could wrap. Scoped CSS uses `overflow-wrap` and a responsive card layout to reduce collision risk.

### Low: action wrapping

Actions may wrap to multiple rows on narrow screens. This is intentional and safer than clipping or overflowing.

---

## Rollback

Rollback is straightforward:

1. Remove the passive Brand display helper functions from `app.js`.
2. Restore the previous generated board row markup in `renderBoardsLibrary()`.
3. Remove the final-polish CSS additions/overrides in the `#boards-library-view` section of `styles.css`.
4. Remove this audit file.

No persisted state, API, routing, save/load, autosave, Canvas, Dashboard, Brand Core behavior, or ownership behavior depends on this polish.

---

## Manual QA

- Open Boards / My Boards.
- Confirm board cards render with an avatar/initial area.
- Confirm a current board with an existing approved Brand Avatar displays the avatar image.
- Confirm boards without Brand Avatar fall back to initials.
- Confirm a current board with existing Brand name displays the Brand field.
- Confirm boards without Brand name do not invent one.
- Confirm Open still opens the board.
- Confirm Copy Link still copies the board URL and shows feedback text.
- Confirm Rename still opens, saves, and cancels.
- Confirm Delete still uses the existing delete flow.
- Confirm Move Up and Move Down still reorder.
- Confirm Claim still appears and works when available.
- Confirm cards remain clean at smaller widths.
- Confirm Dashboard is unaffected.
- Confirm Canvas is unaffected.
- Confirm autosave/save/load are unaffected.

## Decision

Proceed with this final Boards-only polish. Do not continue into Brand Core, AI Brain, Dashboard, Workspace, Canvas, Toolbar, APIs, permissions, persistence, routing, or any other surface in this PR.
