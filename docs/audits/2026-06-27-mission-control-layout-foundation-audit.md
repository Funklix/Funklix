# Mission Control Layout Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Area | Home Dashboard / Dashboard 2.0 |
| Audit Type | Pre-implementation layout foundation audit |
| Runtime Scope | Visual hierarchy only |
| Decision | Proceed with a static Mission Control layout using placeholders |

## Current Dashboard shell

The current Home Dashboard exists as `#dashboard-view` in `index.html`. It is a lightweight placeholder shell with a welcome hero, broad quick actions, and three generic placeholder cards for Brand Status, Insight Highlights, and AI Activity.

The current shell is safe and isolated, but it does not yet express the Dashboard 2.0 Mission Control hierarchy. It reads as a nicer home page rather than a daily briefing from the AI Marketing Operating System.

## Source documents reviewed

Product:

- `docs/product/dashboard-2.0-product-spec.md`
- `docs/product/dashboard-2.0-implementation-spec.md`
- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`

Constitutions:

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`

Design:

- `docs/design-system/README.md`

## Design goals

Mission Control should feel calm, premium, curated, and spacious. It should answer what deserves attention today without becoming an admin dashboard, KPI dashboard, task database, Insights surface, AI Brain chat, or Boards replacement.

The layout should prioritize:

1. Daily Briefing
2. Continue Working
3. Brand Evolution and Suggested Opportunities
4. Today's Focus
5. Live Campaigns
6. Team Activity

The implementation should use existing `fk-*` component foundations where possible and favor generous spacing, clear typography, restrained badges, calm cards, and whitespace.

## Blast radius

Expected blast radius is limited to:

- `index.html` Home Dashboard markup inside `#dashboard-view`
- `styles.css` Dashboard-specific presentation rules
- `app.js` only for existing CTA delegation if new placeholder buttons need to route through existing navigation handlers
- this audit file

No changes should touch Campaign Canvas, Campaign Generator, Inspector, sidebar behavior, toolbar behavior, routing contracts, board loading, save/load, autosave, authentication, Campaign V3, Brand Brain logic, AI Brain logic, Insights, Simulation, or the task model.

## Files affected

Planned safe files:

- `index.html`
- `styles.css`
- `app.js` only if CTA delegation requires mapping static buttons to existing actions
- `docs/audits/2026-06-27-mission-control-layout-foundation-audit.md`

## Risks

- The Dashboard could feel dense or CRM-like if the layout uses too many widgets, grids, KPIs, or metrics.
- Placeholder copy could imply fake analytics or live campaign data if not clearly framed.
- Today's Focus could imply a new task system if placeholder cards are not described as assigned nodes.
- Suggested Opportunities could sound like warnings if language is negative or corrective.
- CTAs could accidentally introduce new routing behavior instead of delegating to existing actions.
- CSS could unintentionally affect non-Dashboard surfaces if selectors are too broad.

## Recommendation

Proceed with a static Mission Control layout foundation using placeholder content only. Keep data non-dynamic, avoid charts and fake analytics, and scope CSS to Dashboard-specific class names. Use existing `fk-btn`, `fk-card`, `fk-section`, `fk-badge`, and `fk-pill` classes where practical.

## Decision

Proceed. The smallest safe implementation is to replace the Home Dashboard placeholder with a static visual hierarchy that creates presence, focus, and clarity while preserving all runtime business logic and product ownership boundaries.
