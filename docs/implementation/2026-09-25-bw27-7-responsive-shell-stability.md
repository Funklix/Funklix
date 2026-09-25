# BW-27.7 — Responsive application shell stability

## Verified root causes

The shell already used a two-track grid, but its `max-width: 1300px` rule changed the navigation track to 88px and then hid every `.nav-item`. At intermediate widths this left an empty rail while the toolbar, dashboard and Calendar continued to negotiate their own intrinsic minimums. The top toolbar's three tracks, the Dashboard's 320px secondary track, and the Calendar's 260–330px backlog could therefore compete with the main surface rather than yielding in a deliberate order. Several descendants were shrink-safe, but that contract did not extend continuously from the document through the shell, workspace and feature roots.

Mobile rules were component-local: Calendar and portals had narrow modes, while the shell retained its desktop navigation track. Month view also retained a 760px minimum at mobile even though a separate one-day-per-row presentation was available later in the cascade. The result was page-level pressure, clipped controls, or an apparently missing surface. Auto-plan, Details and quick scheduling were viewport-aware already, but their breakpoint contracts were not aligned with the shell.

No application or Content Workspace `resize` listener, cached initial viewport width, resize-triggered fetch, or viewport-derived business state was found. Portal identity, proposal state, Board state, Content tab state and schedules remain runtime-owned rather than presentation-owned.

## Width ownership model

Previously, navigation changed width independently, the main track absorbed unresolved intrinsic minimums, and individual feature layouts changed later or not at all. BW-27.7 establishes one chain:

1. `html`, `body`, and `.app-shell` own the viewport boundary.
2. At desktop widths, navigation owns either the 240px full track or the 74px compact icon track.
3. `.workspace-wrap` owns `minmax(0, 1fr)` and every feature root is explicitly shrink-safe.
4. Optional Inspector, Calendar backlog and portal panels own bounded dimensions; they overlay or stack before they can compress the main surface.
5. Only the Week data surface retains local scrolling where its tabular seven-day geometry genuinely requires it.

Document overflow clipping is a final paint-containment guard, not a substitute for layout: all participating feature roots, grids, toolbar groups and sheets are independently bounded first.

## Viewport behavior

- **Wide desktop (1440px+)**: full 240px navigation, multi-column Dashboard, side-by-side Calendar/backlog, and bounded right-side Auto-plan studio.
- **Standard desktop (1024–1439px)**: at 1300px the same navigation DOM becomes a 74px icon rail; at 1180px the toolbar wraps, Dashboard progress stacks, and Calendar backlog moves beneath the Calendar. Inspector remains a column only where its existing 1024px contract permits it.
- **Compact desktop / landscape tablet (768–1023px)**: bounded icon rail, single-column Dashboard groups and Brand Core workspace, Inspector overlay, and proportional Auto-plan sheet up to 72vw/560px.
- **Tablet/mobile (480–767px)**: the same navigation DOM becomes a fixed, safe-area-aware bottom bar; workspace uses the full remaining width. Dashboard and toolbars reflow, Calendar month becomes a readable day stack, backlog remains in flow, and overlays fill available width.
- **Narrow mobile (320–479px)**: actions stretch or wrap, metrics become one column, dialogs and Auto-plan use `100dvh`, and Auto-plan summaries/channels reduce columns without reducing typography.

Intermediate widths use fluid tracks, `clamp()`/`min()`, wrapping and maximum-width queries rather than exact device assumptions.

## Dynamic resize and state preservation

Presentation mode is CSS-only. Resizing does not render the workspace, refetch a Board, recreate a proposal, change the selected section, mutate a schedule, or call a provider. A single navigation DOM changes visual mode, so desktop and mobile navigation cannot coexist. Existing portal cleanup removes duplicate Auto-plan nodes and restores body overflow; existing drawer and dialog handlers retain Escape, focus trap and focus restoration behavior. An open portal responds to CSS immediately without remounting, leaving Auto-plan configuration and proposal identity intact.

## Portals and accessibility

Auto-plan retains its three-row header/body/footer layout, independently scrolling body and sticky actions. It is bounded on desktop, proportional on compact widths, and full-screen at narrow mobile widths. Details and quick scheduling similarly become full-width sheets with safe-area-aware padding. Popovers are viewport-positioned on mobile. Controls keep 44px targets, DOM/keyboard order is unchanged, focus-visible styles remain active, and explicit reduced-motion and forced-colors rules cover the repaired shell. The 320px contract also provides the reflow target required when desktop content is viewed at 200% zoom.

## Deployment and rollback

Deploy `styles.css`, the BW-27.7 regression, package/workflow registration and this document together. There is no dependency, migration, environment, API, provider, persistence, schedule or proposal-engine change. Roll back that bundle together to restore the prior layout; stored Boards, proposals and schedules require no rollback.

Auto-plan persistence remains governed by BW-35.3; only its portal presentation participates in this responsive contract.

## Deployed-preview acceptance

1. Open a Board at 1440px and visit Dashboard, Canvas and Content.
2. Open Content Calendar and Auto-plan with a valid proposal.
3. Resize slowly 1440 → 900 → 390 → 320 → 1440 without reloading.
4. Confirm the Board, section, Content tab, filters, Auto-plan settings and proposal remain intact; Apply or cancel normally.
5. Repeat 1280 → 768 → 1024 and 390 portrait → 844 landscape → 390 portrait.
6. At 1180, 900, 768, 390 and 320px open Board selection and verify readable names/actions, then inspect Dashboard and Calendar for overlap or a page-level horizontal scrollbar.
7. Open Details, quick scheduling, filters and display options; verify Escape and focus restoration and that no backdrop remains.
8. Confirm the Network panel records no resize-triggered request and the console records no exception.
9. Repeat in dark mode and at 200% browser zoom.

