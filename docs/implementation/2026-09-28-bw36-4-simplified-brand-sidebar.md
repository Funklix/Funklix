# BW-36.4 simplified Brand sidebar

## Problem and verified authorities

The expanded sidebar previously presented Workspace preference and Current Board Brand as adjacent technical cards, exposed canonical/snapshot comparison terminology, and required users to interpret persistence architecture. The BW-36.3 audit verified that the browser-restored selection, reusable Brand, Board association, Board snapshot/provenance, Brand ACL, and Board ACL are separate authorities. This implementation changes only their presentation and retains those boundaries.

## Projection and hierarchy

One pure projection selects the visible identity in this order: the authorized Profile being viewed in Brand mode; otherwise an active authorized Board's associated catalog Brand; otherwise, without a Board, the authorized browser-selected Brand. A Board association therefore cannot be overridden by the Workspace preference. An inaccessible association becomes a bounded unavailable state with no former identity. A snapshot-only legacy Board says Campaign Brand / Saved with this campaign and never fabricates a reusable Profile. Empty and loading states likewise clear identity.

The expanded panel contains a Brand label, 48px avatar, safely truncated name, one relationship line, optional revision/provenance-backed Update available status, Open Brand Profile, and a quieter context-specific change action. There is no explanatory paragraph. The underlying creation/catalog form remains the established selection flow.

## Avatar, actions, comparison, and authorization

Only the authorized reusable Brand Core's user-approved Brand DNA avatar is eligible; safe initials render otherwise and replace a failed image locally. Images retain aspect ratio with `object-fit: cover`, and identity alternatives name the Brand. No Board node, social content, provider, or new URL service participates.

Open Brand Profile loads the projected reusable Brand without changing Board association or browser preference, and remains available to viewers. With a Board, Change campaign Brand reuses the existing confirmed PATCH workflow and its server/client Board-edit checks. Without a Board, Switch Brand opens the existing filtered catalog and only its established preference flow. Comparison is removed from the sidebar and relocated as Review campaign updates in the existing full Brand detail workspace; it remains gated by the existing resolved Board/reusable-Brand relationship. The dialog and its synchronization, initialization, recovery, provenance, revision, and confirmation behavior are not redesigned.

## Responsive and accessibility behavior

The expanded panel is bounded to 180px, uses semantic labeling and polite bounded status, exposes full truncated names through `title`, keeps 44px action targets and visible focus, and uses existing theme tokens. Collapsed desktop/tablet displays only the 36px avatar anchor. Mobile CSS continues to exclude all non-navigation sidebar children from the bottom navigation, so there is no duplicated card or overflow. Forced-colors and reduced-motion rules are explicit; narrow layout and 200% zoom inherit the icon-rail/mobile breakpoints.

## Lifecycle, deployment, and rollback

The projection is recomputed from existing catalog, Board association/access, mode, language, preference, and provenance state on their established render lifecycle. Rendering performs no fetch and no mutation; deletion, sign-out, catalog access loss, Board switching, and reset clear or replace source state before projection. Avatar cache content is populated only by the existing explicitly opened Profile request. Canvas, Content, Calendar, Auto-plan, Export Review, AI Brain, Insights, Funnel, toolbar, and compact top-context code are untouched.

Deploy `brand-sidebar.js`, `app.js`, `index.html`, `styles.css`, `language.js`, the regression/workflow registration, and this record together. No migration, dependency, feature flag, provider configuration, AI request, data rewrite, or automatic synchronization is involved. Rollback restores the two former card markups/render copy and removes the projection bundle and registrations; no stored Board or Brand repair is needed.

## Manual acceptance and explicit deferrals

Acceptance should cover avatar/fallback/broken image, mismatched Workspace and Board Brands, no Board, no Brand, legacy snapshot-only Board, access loss, deletion, viewer/editor/owner, freshness status, English/German, light/dark/forced colors/reduced motion, keyboard-only use, 200% zoom, and 1440/1024/768/480/375/320px widths. Confirm network logs contain no render-triggered request and that Profile open and reassignment remain distinct.

The full Brand workspace information architecture and terminology migration, Campaign Sync redesign, governed Brand Learnings, database/schema work, automatic synchronization, and AI/provider suggestions are explicitly deferred.
