# Mission Control Layout Polish Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Area | Home Dashboard / Mission Control |
| Audit Type | Above-the-fold hierarchy polish audit |
| Runtime Scope | Markup/CSS only |
| Decision | Safe to polish scoped Mission Control layout |

## Documents reviewed

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/constitution/design-constitution.md`
- `docs/audits/2026-06-27-mission-control-static-layout-safe-audit.md`

`docs/product/dashboard-2.0-implementation-spec.md` was requested but is not present in the current working tree. This audit therefore applies the available Dashboard 2.0 product spec, design constitution, and prior static-layout safe audit without recreating or modifying the missing product spec.

## Current layout audit

The current static Mission Control layout is correctly scoped inside the existing `#dashboard-view` shell and uses a `.mission-control` wrapper with static cards. It preserves the Dashboard shell and does not require JavaScript.

Observed polish issues:

- The Daily Briefing hero is premium but slightly tall for common laptop viewports because of the `340px` minimum height, large responsive padding, and very large headline scale.
- The vertical rhythm uses a generous page gap, so Continue Working can feel visually separated from the hero instead of part of the first decision moment.
- The lower sections remain a long vertical sequence, which can make the page feel more like a stack of cards than a curated briefing.
- Today’s Focus is clear, but its heading and card padding can be tightened so it remains secondary to Daily Briefing and Continue Working.
- Live Campaigns and Team Activity are lower-priority supporting sections and can sit together to reduce perceived length without becoming dense.

## Safety boundary

Safe changes are limited to:

- Static markup inside the existing `#dashboard-view` element.
- CSS scoped to `#dashboard-view` and `.mission-control`.
- This audit file.

Do not modify:

- `app.js`
- JavaScript behavior
- routing
- view switching
- CTA delegation
- Canvas
- Sidebar
- Toolbar
- Inspector
- Campaign Generator
- Campaign V3
- save/load
- authentication
- board behavior

## Recommended polish

- Reduce the Dashboard viewport padding slightly.
- Reduce Mission Control vertical gap.
- Make the hero slightly more compact while preserving premium spacing and avatar presence.
- Reduce headline maximum size slightly to communicate faster above the fold.
- Bring Continue Working closer by tightening global rhythm and feature-card sizing.
- Wrap Live Campaigns and Team Activity in a supporting two-column section so lower-priority content reads as supporting material instead of extending the main stack.
- Keep all buttons static and unwired.

## Decision

Proceed with CSS/markup polish only. The change is safe because it remains scoped to the existing Dashboard markup and does not touch runtime behavior or JavaScript.
