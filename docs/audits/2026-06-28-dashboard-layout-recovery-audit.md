# Dashboard Layout Recovery Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Layout Recovery audit |
| Scope | Visual layout repair after runtime-backed Continue Working card |
| Runtime behavior changes | None |
| Files changed | `index.html`, `styles.css`, `docs/audits/2026-06-28-dashboard-layout-recovery-audit.md` |

## Audit Findings

### 1. Current `#dashboard-view` markup

The current Dashboard markup had reverted to the old Home shell pattern:

- a `Welcome back to Funklix` hero,
- a standalone runtime-backed Continue Working card,
- an old three-column placeholder grid for Brand, Insights, and AI Brain.

This no longer matched the intended Mission Control hierarchy.

### 2. Old placeholder shell still present

The old placeholder Dashboard shell remained visible through:

- `dashboard-hero` with the generic Home copy,
- `dashboard-grid` with Brand Status, Insight Highlights, and AI Activity placeholder cards.

These placeholders competed with the Mission Control concept and made the Dashboard feel like a legacy homepage rather than a daily briefing.

### 3. Duplicate/conflicting Continue Working sections

There was only one runtime-backed Continue Working render target, but it visually conflicted with the old placeholder grid because it was inserted between the generic Home hero and unrelated lower cards. The issue was not duplicate IDs; it was duplicate product hierarchy.

### 4. CSS compression causes

The previous Dashboard CSS used a simple three-column `.dashboard-grid` with minimal Mission Control section structure. Lower sections were compressed because Brand, Insights, and AI Brain placeholders were forced into equal small cards instead of being arranged as Mission Control sections with clear rhythm.

### 5. Dashboard width and right-side shell

`#dashboard-view` fills the workspace area, while the app shell can still include right-side UI when not hidden by view state. The Dashboard needed its own content max-width and centered surface so it would feel intentional and not visually collide with the surrounding shell/background.

### 6. Smallest safe visual repair

The safest repair is markup/CSS only:

- Restore a Mission Control wrapper and Daily Briefing hero.
- Keep the existing runtime-backed Continue Working IDs and data target so PR 9 JavaScript continues to work unchanged.
- Replace the old placeholder grid with the required hierarchy: Brand Evolution, Suggested Opportunities, Today's Focus, Live Campaigns, Team Activity.
- Scope layout CSS under `#dashboard-view` to avoid Canvas, Inspector, Sidebar, Toolbar, and other surfaces.
- Do not modify `app.js`, routing, Active Context, save/load, autosave, or runtime data logic.

## Implementation Summary

Implemented visual recovery only:

1. Replaced the generic `Welcome back to Funklix` hero with a Mission Control Daily Briefing hero.
2. Preserved the runtime-backed Continue Working card and all existing IDs used by the PR 9 renderer.
3. Removed the old Brand/Insights/AI placeholder grid.
4. Added Mission Control sections:
   - Brand Evolution
   - Suggested Opportunities
   - Today's Focus
   - Live Campaigns
   - Team Activity
5. Added a centered `.mission-control` max-width wrapper.
6. Added scoped `#dashboard-view` styles for spacious hierarchy and two-column sections.

## Duplicated Markup Removed / Fixed

Removed the old placeholder hierarchy:

- generic Home hero language,
- Brand Status placeholder card,
- Insight Highlights placeholder card,
- AI Activity placeholder card,
- old three-column Dashboard grid.

Preserved the single Continue Working runtime render target:

- `#dashboard-continue-working`
- `#dashboard-continue-title`
- `#dashboard-continue-action`
- `#dashboard-continue-backed`
- `#dashboard-continue-nodes`
- `#dashboard-continue-updated`
- `#dashboard-continue-status`
- `#dashboard-continue-progress-row`
- `#dashboard-continue-progress`
- `#dashboard-continue-context`
- `#dashboard-continue-open`

## Runtime Confirmation

No `app.js` changes were made.

This PR does not change:

- runtime data logic
- `getActiveContext()`
- Dashboard model helpers
- routing
- autosave
- save/load
- Canvas
- Inspector
- Sidebar
- Toolbar
- Campaign Generator
- Campaign V3
- Brand runtime
- AI Brain
- Insights
- APIs
- authentication

Dashboard Continue Working still uses the runtime-backed data path from PR 9 because the same DOM IDs are preserved.

## Manual QA Checklist

1. Root Home shows Mission Control Daily Briefing, not the old Welcome shell.
2. Continue Working appears once.
3. Continue Working still uses real runtime data.
4. Brand Evolution and Suggested Opportunities are readable two-column sections on desktop.
5. Today's Focus is readable and not compressed.
6. Live Campaigns and Team Activity are lower-priority supporting sections.
7. Continue Campaign / Open Board behavior still delegates to existing buttons.
8. Canvas still opens and renders as before.
9. Inspector, Sidebar, and Toolbar behavior are unchanged.

## Decision

Proceed with markup/CSS-only layout recovery.

Do not change runtime data logic or Active Context for this visual repair.
