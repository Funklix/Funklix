# BW-36.10R1 — Workspace selector popover layout repair

## Production evidence and root cause

The production observations supplied for BW-36.10 show that the closed Workspace → Brand hierarchy is correct. After either trigger is opened, however, the selector was an absolutely positioned child of `.workspace-context`, with a generic width up to 320px, a maximum height of 520px, an internal heading, and a dedicated 44px close control. Because the sidebar is an overflow/layout owner in its expanded and responsive modes, that child looked and behaved like another tall sidebar section: it competed with navigation, clipped names in rail geometry, and used space disproportionate to its choices.

No production screenshot file was supplied or captured in this environment. The observed failure above is therefore recorded from the acceptance report rather than represented as new browser proof.

## Layout ownership and corrected geometry

The existing shell continues to own the two closed trigger rows. On open, the single existing selector node is moved to `document.body` as a portal and positioned `fixed` from the active trigger's live `getBoundingClientRect()`. It is consequently outside sidebar/document flow: opening cannot alter sidebar, navigation, Canvas, or main-content dimensions and cannot create an additional selector owner.

An expanded-sidebar menu aligns its left edge and width to the trigger (bounded to 220–320px and viewport edges), prefers the 6px space below it, and flips above when the available space below is smaller. Its overall height is capped at 320px; choices scroll internally in a 256px region. Rows retain 44px minimum targets, compact spacing, avatar/initials, a flexible name column, and a selected checkmark. Lists over eight choices receive the only optional chrome: a compact search field. The redundant title, explanatory/card chrome, footer space, and X control are absent.

At rail widths, the same bounded menu opens six pixels to the trigger's right and is vertically clamped to the live viewport without widening or covering the rail. Below 768px, the menu uses a touch-appropriate, viewport-width sheet above the fixed trigger, observes safe-area padding, stays below 320px, and never exceeds `100dvh`. Geometry is recomputed for captured sidebar scrolling, window/visual-viewport resize, and host resizing, covering shell mode and zoom changes.

## Text and accessibility

Trigger and option names use a flexible `minmax(0, 1fr)` column with one-line ellipsis. Each trigger name and choice exposes its full normalized Unicode text through `title`; initials remain Unicode/code-point safe. The listbox/option contract, `aria-selected`, focus-visible styling, 44px targets, Arrow Up/Down, Home/End, Enter/Space, Escape, outside click, trigger toggle, selection close, and focus restoration remain. Opening the other selector reuses the one portal and closes the current mode first. Forced-colors selection and focus remain explicit, and reduced motion disables transitions and smooth scrolling.

## Unchanged behavior and boundaries

Workspace derivation, active Board priority, single-Brand automatic selection, multi-Brand deliberate selection, Board filtering, authorization, and session-only state are unchanged. The selector still consumes the bootstrapped catalog and introduces no fetch, mutation, persistence, database, provider, or AI path. The application retains exactly one `FunklixWorkspaceCatalog.load()` call for each authenticated generation. Canvas toolbar markup and the compact non-Canvas context-bar subtree are unchanged.

## Deployment and rollback

Deploy `workspace-sidebar.js`, `workspace-sidebar.css`, and the small selector markup removal together with the focused regression, package/workflow registration, and this record. There is no migration, manual SQL, backfill, dependency, environment-variable, provider, authorization, or data operation.

Rollback the same bundle together: restore the BW-36.10 selector module/style/markup and remove only the R1 regression registration and this record. Stored Workspace, Brand, and Board state requires no repair because this release changes presentation only.

## Manual visual acceptance

After deployment, verify authenticated accounts with one and multiple Workspaces/Brands in dark and light themes at 320, 375, 480, 768, 1024, and 1440 CSS pixels and at 200% zoom. Open each available trigger near the top and bottom of a scrolled sidebar; confirm below/above collision behavior, trigger alignment or right-of-rail placement, no navigation or content movement, readable long names/tooltips, internal list scrolling, a single portal, and focus restoration after selection, outside click, Escape, trigger toggle, and navigation. Repeat with forced colors and reduced motion. Confirm network and database tooling records no selector-triggered request or write, and separately confirm the Canvas toolbar and compact context bar are visually unchanged.
