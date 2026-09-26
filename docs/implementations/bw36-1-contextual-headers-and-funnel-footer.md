# BW-36.1 contextual headers and Funnel footer

## Scope and former ownership

The BW-36 audit verified that one static `#canvas-topbar` owned Canvas commands, account controls, Board access, presence, and sharing. `setActiveView()` previously hid that host only on Home, while Brand mode separately hid it. Consequently Boards, Content, AI Brain, Insights, and Funnel inherited Canvas controls despite not owning them. This implementation is limited to audit phases 1 and 2. The Brand Profile / Campaign Brand Snapshot terminology and comparison redesign remain later work.

## Four-mode projection and mapping

`deriveHeaderModel()` is the single semantic authority. It projects application state, never DOM text, into:

| Mode | Sections |
| --- | --- |
| `canvas` | Canvas Board (`board`) |
| `board_context` | legacy Board list and Calendar, Content Workspace and its Calendar, AI Brain, Insights, Funnel Simulator |
| `brand_context` | Brand Core |
| `account_library` | Home, Boards library, Settings, and bounded unknown-section fallback |

The existing header is still the sole header landmark. It now has mutually exclusive Canvas and contextual identity children plus one shared account-control owner. Theme, Google identity, avatar fallback, email/name behavior, and sign-out retain their original IDs and handlers. No desktop/mobile clone exists. Canvas keeps campaign creation, Add node, Undo, search, Filters, Utilities, access, presence, sharing, and Copy Link. Non-Canvas headers cannot render those controls. Page actions remain on their pages.

Board context is emitted only when an ID exists and the authoritative access projection does not deny viewing. Otherwise it says “No Board selected”; it never fabricates or retains a previous name. Brand context validates the ephemeral selection against the authorized loaded catalog and otherwise says “No Brand selected.” The Boards library always identifies itself as Boards, never as the last open Board. Board-context sections expose an in-flow Open Canvas action only for an authorized current Board.

## Responsive and accessibility behavior

The contextual row uses token surfaces, shrinkable tracks, ellipsis plus a full `title` and accessible name, and one global-controls cluster. At compact widths account text becomes visually hidden while the existing avatar remains available and named. Mobile uses the same DOM beside the existing bottom navigation, accounts for horizontal safe areas, and cannot impose a fixed minimum content width. Interactive targets are at least 44px. Focus is explicit; reduced-motion and forced-colors contracts are included. The heading hierarchy of each page remains page-owned, while the shell keeps one header landmark.

The projection only updates classes, text, accessible attributes, and the Open Canvas affordance. Resize synchronization does not fetch a Board, remount Content/Funnel workspaces, regenerate Auto-plan, invalidate export sessions, or touch Canvas selection, zoom, filters, dialogs, or simulator state.

## Funnel artifact root cause and correction

The audit identified the Persona Journey `.journey-nav` as the sole Back/Continue surface anchored at the viewport edge. At `max-width: 768px` it changed to `position: sticky; bottom: 4px` with an opaque elevated theme background. Its `.board-list-view` ancestor is the scroll owner. The sticky paint surface therefore produced the reported light/dark slab and could overlap adjacent final content; no explicit viewport-height owner was found.

The narrow correction makes `.journey-nav` `position: static` with cleared inset, automatic height, zero minimum height, transparent background, and safe-area-aware bottom padding. It remains directly after the active step in normal flow. Back/Continue order, button state and semantics, 44px size, wrapping, and all simulator render/state logic are unchanged. Long content scrolls through the established view, while application-level bottom-navigation space remains owned by BW-27.7.

## Authorization, privacy, and state guarantees

Header rendering uses existing in-memory Board access, Brand catalog, account, and localization projections. It performs no API, provider, AI, social, publication, scheduling, Board association, or Brand Core request or mutation. It logs no Board/Brand content, simulator answers, account email, token, cookie, or provider payload. There is no schema, dependency, persistence, framework, or build change. Server authorization and public redaction remain authoritative.

## Deployment and rollback

Deploy `index.html`, `app.js`, `styles.css`, `language.js`, the focused regression, package/workflow registration, and this document together. No migration, backfill, environment variable, provider setup, or data operation is required. Rollback is a bundle revert: it restores former header visibility and sticky Funnel navigation without transforming stored data.

## Manual acceptance

1. Sign in and open an authorized Board. At 1440, 1024, 768, 480, 375, and 320 CSS pixels, verify Canvas alone has the full toolbar.
2. Visit Home, Boards, Content Library/Calendar, AI Brain, Insights, Funnel Simulator, Brand Core, and Settings in both themes. Verify the table mapping, truthful identities, one account cluster, truncation, focus order, and no horizontal document overflow.
3. Switch Boards and Brands, remove/lose each selection, and confirm names replace immediately without stale disclosure. Confirm Boards never adopts the open Board as its library title.
4. Live-resize and switch theme while preserving Canvas selection/zoom, Content tabs/dialogs/plans/exports, and Persona Journey target groups, stages, assets, and current step.
5. In Persona Journey, inspect Back/Continue at every step with short and long content. Confirm computed `.journey-nav` position is `static`, buttons follow the last card, disabled state is announced, and the application bottom navigation conceals nothing.
6. Repeat at 200% zoom, with keyboard only, forced colors, and reduced motion. Confirm all primary actions remain reachable.

Brand terminology migration, Brand comparison redesign, Brand data changes, and optional cleanup are explicitly deferred.
