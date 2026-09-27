# BW-36.2 isolated compact non-Canvas context bar

## Sequence and architecture

BW-36.1R1 first restored the Canvas toolbar and restricted it to Canvas so this phase could not accidentally evolve that command surface into a shared header. BW-36.2 leaves the hashed `#canvas-topbar` subtree, its controls, IDs, bindings, CSS, dimensions, account presentation, and Canvas-only rule intact. A single sibling `#compact-context-bar` is mounted outside that header in normal workspace flow. One pure mode decision and one in-place renderer own it; there are no desktop/mobile copies and no DOM-derived state.

The mode mapping is intentionally bounded. `boards_library` and legacy `list` use `library`; legacy `calendar`, `content_workspace` (including its Calendar mode), `ai_brain`, `insights`, and `funnel_simulator` use `board`. Canvas (`board`), Home, Brand Core, Settings, Brand mode, public/unknown destinations, and every unmapped value use `hidden`. Hidden contributes zero height.

## Content and authority

The left group contains only the neutral repository-owned Board grid icon and either localized **Boards**, the authorized active Board name, or localized **No Board selected**. The library never projects a remembered Board. A Board title is accepted only while a current Board ID exists, loading has completed, and Board access has not been denied. Board loading clears the prior title before the existing request; authoritative load, save/rename, creation, access, and clear/auth lifecycles project state again. Rendering never reads a library card or page DOM and never fetches a Board.

The right group contains only the existing account state's Google avatar (or initials fallback), display name, email when space permits, a theme control delegating to `FunklixTheme`, and Sign out delegating to the established Canvas sign-out button/handler. Unique compact-control IDs and one-time bindings avoid duplicate event ownership. Session data is neither fetched nor logged. The strict exclusion list is enforced by regression: no Canvas, share, collaborator, page, simulator, Brand/workspace, refresh, planning, or export action is present.

## Responsive and accessible presentation

The opaque token-based bar is one row, 60px and at most 64px on desktop, and 58px/at most 60px at compact widths. Identity shrinks first and ellipsizes; its full value remains in `title` and `aria-label`. Email disappears on tablet-sized layouts. Account text and the visible Sign out label collapse on mobile while avatar, 44px theme target, and 44px accessible icon-only Sign out remain. At 320px the icon can yield space before the title or controls. The bar has no fixed/sticky positioning, negative margins, gradient, whole-bar card radius, or shadow.

The host is a labelled region rather than a second banner, preserving page-owned headings and the Canvas header landmark. Controls have stable left-to-right DOM order, visible token focus, accessible names and theme state; avatar fallback is labelled. Dark theme, forced-colors, and reduced-motion rules are explicit. Normal flow prevents covered content and the existing mobile bottom navigation remains the only navigation system.

## State preservation and non-interference

Projection changes only compact DOM attributes and text. It does not render Canvas, change zoom/selection, reload or select a Board, select a Brand, reset Content tabs/filters or Calendar, invalidate Auto-plan or Export Review, reset AI Brain/Insights/Funnel, touch `.journey-nav`, or perform provider/AI calls. Resize has no compact renderer, fetch, or state callback. There are no Board, Brand, schedule, approval, publication, or social-media mutations and no schema, migration, framework, dependency, or build-step change.

## Deployment and rollback

Deploy `index.html`, `app.js`, `styles.css`, `language.js`, the focused regression, package/workflow registration, and this record together. No server, database, provider, secret, or data deployment is involved. Rollback removes the sibling host, compact renderer/bindings/styles/strings, regression registration, and this record; it does not touch the R1 Canvas isolation or Funnel repair.

## Manual acceptance

Compare Canvas at 1440px and 1024px against the R1 baseline. Then inspect Boards, Content Workspace and Calendar, AI Brain, Insights, Funnel Simulator, and legacy routes at 1440, 1024, 768, 480, 375, and 320px in light/dark modes. Confirm Home, Brand Core, Settings, and Canvas retain their prior top position; test live resize, 200% zoom, keyboard traversal, long Board/account names, missing avatar, loading/no Board, Board switch/rename/access denial, both languages, theme cycling, and sign out. Confirm Funnel progress/footer, Auto-plan, and Export Review retain state.

## Explicit deferral

Brand Profile and Campaign Brand Snapshot terminology, Brand-context headers, Brand/workspace switching, and the Brand Core comparison redesign remain explicitly deferred. This phase does not revive the reverted four-header architecture.
