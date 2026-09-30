# BW-36.10 — Workspace selector and sidebar hierarchy

## Scope and hierarchy

The application shell now communicates **Workspace → Brand → Board / Campaign**. A Workspace is the current organization or private working environment, a Brand is reusable knowledge inside that Workspace, and a Board is the campaign/project. The sidebar owns the only visible selector. This change neither adds a top bar nor changes the Canvas toolbar or compact non-Canvas context bar.

This is a read-only selection phase. It uses the already-loaded, authorized `workspace_catalog_v1` response. It adds no schema, migration, server route, write operation, Workspace management action, provider request, or AI request.

## Selection rules

Initial Workspace resolution remains deterministic: the active authorized Board's Workspace, then the active authorized Brand's Workspace, then a sole authorized Workspace, otherwise no selection. Opening either list uses in-memory catalog state and never requests `/api/workspaces` again. Exactly one catalog request remains permitted for each authenticated bootstrap generation.

An explicit Workspace choice exists only in the browser runtime. It is not stored in browser storage or the database. A valid current Brand is retained inside that Workspace. Exactly one authorized Brand is selected automatically; multiple Brands show **Choose a brand** until the user chooses; no authorized Brands show the bounded empty state. The selector exposes only Brands independently authorized and returned under the selected authorized Workspace.

An active Board takes precedence. Its stored Brand association is campaign truth. A branded Board establishes both visible contexts; an unbranded Board says **No Brand assigned** and remains unbranded. A session Brand choice never patches a Board. Switching to a different Workspace closes an active Board and returns Home before changing the label. The existing Brand edit close/discard guard can cancel the switch and retains the old context.

The Boards library intersects its existing authorized results with Board descendants in the selected Workspace catalog. Workspace membership never grants Board access. With no Workspace context, the existing Board-only collaborator list remains intact; public-token sessions do not receive the authenticated selector or catalog.

## Interaction and lifecycle

Workspace and multi-Brand controls use one anchored popover/listbox. Arrow keys, Home, End, Enter, Space, Escape, outside click, and focus restoration are supported. Navigation, account changes, and sign-out close it. Catalog-generation reconciliation keeps IDs only while still present and otherwise applies the deterministic rules. Stale async generations remain rejected by the BW-36.9 lifecycle. A catalog failure displays **Workspace unavailable** without blocking other authorized application paths.

Workspace avatars accept only local or embedded image sources. Brand images use the catalog's authoritative avatar and fall back locally on failure. Initials are Unicode-safe. Names, IDs, emails, membership data, URLs, and catalog bodies are not logged.

## Responsive and visual behavior

Expanded desktop shows the compact related Workspace and Brand rows before existing navigation. The 74px desktop/tablet rail keeps its width and presents a Workspace-initial trigger with one anchored popover. Mobile keeps all existing bottom-navigation items and exposes a 44px shell-owned trigger immediately above that navigation; it creates no fixed header and its internally scrollable popover is bounded by `100dvh` and safe-area spacing. The styles include truncation, visible focus, light/dark token use, forced-colors support, reduced-motion behavior, and 200% zoom/reflow-safe bounds.

## Localization

English and German states cover Workspace, switching/choosing, unavailable/empty states, Brand choosing/empty/unbranded states, Brand Profile/Open profile, and read-only access. The scoped navigation label is now **Brand Profile** / **Markenprofil**; internal compatibility names and historical documentation are unchanged.

## Deployment and rollback

Deploy the static browser assets (`index.html`, `styles.css`, `workspace-sidebar.js`, `app.js`, and `language.js`) together. No migration or manual SQL is required. After deployment, verify one authenticated `GET /api/workspaces` with `workspace_catalog_v1`, exercise keyboard and responsive selectors, switch between Workspaces, and confirm the Canvas and compact context header remain unchanged.

Rollback is a single application-code rollback to the preceding commit. There is no data rollback because this phase performs no Workspace, membership, Brand, or Board mutation.

## Manual acceptance

1. Verify zero, one, and multiple Workspace states in English and German.
2. Verify sole-Brand auto-selection, multi-Brand no-default behavior, no-Brand and unbranded-Board copy.
3. Open selectors by pointer and keyboard; navigate with arrows/Home/End; close with Escape and outside click; confirm focus returns.
4. Switch away from an active Board; cancel when the existing protected interaction guard appears, then accept and confirm Home is shown without old Workspace content.
5. Test expanded desktop, icon rail, and mobile at 1440, 1024, 768, 480, 375, and 320 CSS pixels, 200% zoom, both themes, forced colors, and reduced motion.
6. Confirm the Canvas toolbar subtree, compact context bar, account/theme/sign-out controls, navigation destinations, Brand Profile editing, and Board sharing roles behave as before.
7. Confirm one catalog request per authenticated generation and no selector-open refetch, storage write, provider request, AI request, or data mutation.

## Deferred work

Workspace create, rename, archive/delete, invitations, membership management, and moving Brands or Boards await the write-authority phase. The full Brand Profile redesign, Campaign Sync, comparisons, and governed Brand Learnings remain separate future work.
