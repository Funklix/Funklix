# Mission Control Static Layout Safe Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Area | Home Dashboard / Dashboard 2.0 |
| Audit Type | Safe static layout boundary audit |
| Runtime Scope | Markup and CSS only |
| Decision | Replace only the contents inside existing `#dashboard-view` |

## Current `#dashboard-view` markup

The current Home Dashboard is an existing `<section id="dashboard-view" class="dashboard-view hidden" aria-labelledby="dashboard-title">` in `index.html`. The shell itself is already wired into Home navigation and view switching by existing JavaScript.

Current contents inside the boundary are:

- A generic `dashboard-hero` with a `Home` badge, "Welcome back to Funklix" headline, broad explanatory copy, and existing quick-action buttons.
- A `dashboard-grid` with three generic cards for Brand Status, Insight Highlights, and AI Activity.

## Exact replacement boundary

Replace only the children inside:

```html
<section id="dashboard-view" class="dashboard-view hidden" aria-labelledby="dashboard-title">
  <!-- replace this inner content only -->
</section>
```

Preserve the `#dashboard-view` element, ID, classes, and `aria-labelledby` contract exactly so Home nav behavior, root Home behavior, and existing view switching remain unchanged.

## Design goals

The static layout should make the Home Dashboard feel like Mission Control for an AI Marketing Operating System: calm, premium, curated, spacious, and focused on what deserves attention today.

The hierarchy should be:

1. Daily Briefing Hero
2. Continue Working card
3. Brand Evolution card and Suggested Opportunities card
4. Today's Focus card
5. Live Campaigns empty state
6. Team Activity placeholder

The layout should avoid tables, dense grids, tiny widgets, KPI dashboards, analytics cards, fake metrics, fake charts, and warning language.

## Blast radius

Allowed blast radius:

- `index.html`: static markup inside the existing `#dashboard-view` only.
- `styles.css`: Dashboard/Mission Control presentation CSS only, scoped under `#dashboard-view` or `.mission-control`.
- `docs/audits/2026-06-27-mission-control-static-layout-safe-audit.md`: this audit.

Explicitly out of scope:

- `app.js`
- routing
- view switching
- CTA delegation
- Canvas
- Inspector
- Toolbar
- Sidebar
- Campaign Generator
- Campaign V3
- save/load
- autosave
- authentication
- board behavior

## Files affected

Expected final files changed:

- `index.html`
- `styles.css`
- `docs/audits/2026-06-27-mission-control-static-layout-safe-audit.md`

No other files should remain changed in the final diff.

## Risks

- Adding JavaScript could affect runtime/view behavior, so this PR must not modify `app.js`.
- Replacing the outer `#dashboard-view` shell could break existing Home view switching, so only inner contents should change.
- Functional-looking CTAs could imply newly wired behavior, so buttons should remain static placeholders without new delegation.
- Global CSS selectors could affect Canvas or other product surfaces, so new CSS must be scoped to `#dashboard-view` or `.mission-control`.
- Placeholder content could imply live analytics, so Live Campaigns must remain an empty state with no charts or fake performance data.

## Recommendation

Proceed with a markup/CSS-only replacement of the existing Dashboard placeholder. Preserve the Dashboard shell and all JavaScript contracts. Use existing `fk-*` classes for component consistency while scoping new visual styling to the Mission Control surface.

## Decision

Proceed with static Mission Control layout foundation only. Do not wire CTAs, do not add JavaScript, and do not change runtime behavior.
