# BW-36.11R1 — Workspace and Brand sidebar interaction

## Production evidence and verified root cause

The supplied production screenshots establish that the closed hierarchy was correct (`Felix Workspace` above `Brand Watcher`) while the opened one-Workspace selector was redundant and the rename form appeared as an oversized, default-looking white sidebar panel. Inspection confirmed two distinct causes. First, BW-36.10R1 correctly moved the shared selector owner under `document.body`, but BW-36.11 appended `.workspace-rename-editor` inside that portal while styling it as `position:absolute; inset:8px; align-content:center`. The editor consequently filled the selector's bounded box instead of sizing to its own content. Second, the editor buttons only received minimum height and padding; they did not receive the established button classes, so their appearance depended on generic browser/global rules. The selector was also still the only owner for Workspace selection, Workspace actions, and Brand selection, making the redundant single choice visually dominate the Brand level. The essential old CSS was top-level rather than sidebar-ancestor-qualified, so the hypothesized ancestor-selector failure was **not** the direct cause; absolute fill geometry and incomplete explicit control styling were.

## Interaction repair

Workspace and Brand remain independent hierarchy levels. With one authorized Workspace, its avatar/name is a disabled stable identity row with no chevron. Owners and admins receive a separate 44px ellipsis; members and viewers retain the read-only indication and have no action. The ellipsis opens a body-owned, content-height menu containing only **Rename workspace**.

With multiple authorized Workspaces, the identity row keeps its chevron and opens the Workspace listbox. Each authorized Workspace has its selected state and an English/German count computed only from that Workspace's already-authorized `workspace_catalog_v1.brands` descendants. Rename remains on the separate ellipsis instead of being repeated on list rows. There is no creation or deletion UI.

The Brand row remains immediately below Workspace whenever the sidebar is present. Multiple authorized Brands open their own body-owned listbox with avatar, full name, and selected state. A single Brand is stable without dropdown chrome. A multi-Brand Workspace with no selection says **Choose a Brand / Marke auswählen**. An unbranded Board remains **No Brand assigned / Keine Marke zugewiesen** and never receives an inferred association. Workspace selection, Brand selection, management, and rename have different ARIA owners, and opening any surface closes the previous surface.

## Portals, visual containment, and accessibility

`.workspace-selector-popover`, `.brand-selector-popover`, `.workspace-context-menu`, and `.workspace-rename-dialog` are top-level portal-safe classes whose essential fixed positioning, theme colors, dimensions, and controls do not depend on sidebar ancestry. The menu is at most 240px wide with one 44px row. The dialog is 320px by default, capped at 340px, has `height:auto`, `min-height:0`, no flex growth, a compact heading/input/status/actions layout, and explicit Tendra One button classes. Mobile uses viewport-safe margins, `100dvh`, and safe-area padding without becoming full height. Light/dark tokens, forced colors, reduced motion, compact rail, 200% zoom geometry, and 320–1440px widths are covered by the focused regression.

The listboxes retain arrow/Home/End selection. Escape and outside click close the active floating surface; Enter submits the form; Cancel dismisses it; the modal dialog traps Tab within its input and actions; and focus returns to the relevant trigger. Navigation, sign-out, account changes, and catalog rerenders continue to use the existing controller close lifecycle.

## Unchanged security and data boundaries

No persistence, authorization, Board filtering, Canvas, navigation, or hierarchy code was changed. Rename still delegates exactly once to the existing `FunklixWorkspaceCatalog.rename` path and therefore keeps `PATCH /api/workspaces`, `workspace_update_v1`, signed-session identity, owner/admin authorization, member/viewer denial, expected revision, transaction/locks, normalization, idempotent no-op, in-memory reconciliation, zero follow-up GET, and active context preservation. No Workspace, Brand, Board, membership, provider, or AI operation was added.

## Deployment, rollback, and acceptance

Deploy as ordinary static client assets after Runtime Boot Safety succeeds; no migration or manual SQL is required. Roll back the focused commit to restore the previous sidebar DOM/controller/CSS and check registration; no data rollback is needed.

Manual acceptance: sign in with owner/admin and member/viewer fixtures; inspect one- and multi-Workspace catalogs; open each Workspace/Brand surface in turn; rename successfully and exercise recoverable errors; confirm one surface at a time, focus restoration, keyboard operation, Brand Profile navigation, unbranded Board copy, light/dark/forced-colors/reduced-motion modes, 200% zoom, compact rail, and 320px/mobile through 1440px desktop widths. The supplied screenshot evidence motivated this repair, but automated execution does not provide browser screenshot proof.
