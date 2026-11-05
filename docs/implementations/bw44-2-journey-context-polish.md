# BW-44.2 Campaign Journey context polish

Based on main `eec0b5b` (merged PR #852).

The approved five-stage artwork, labels and coverage remain intact. Native stage
`details` now live in a shared context area immediately below the Journey list.
Each summary repeats its translated stage name, so independently expanded panels
stay associated with their stage. Panels stack in normal document flow, use the
existing lavender/theme surfaces, and never overlap controls. There is no new
expansion state or exclusive accordion behavior.

The existing source-list renderer only changes button contents for Journey
references: node type, title and a small translated Show on Canvas affordance.
Existing goal/context text stays with that node. The responsive grid fits multiple
columns when 260px cards fit, and explicitly uses one column below 600px. Long
values wrap. Existing truncation and source selection are unchanged.

No data producer, scoring, mapping, ACL, freshness check, reference route,
navigation handler, loading status, AI inference or write behavior changes.
Legacy DOM IDs remain. Opportunity source presentation is unchanged.

## Validation

- New production-app Chromium suite: 20 Light/Dark × EN/DE × 1440/1024/768/375/320
  cases; one/many/no nodes; multiple native disclosures; collapse/reopen via
  Enter/Space; focus outlines; long titles/goals; reduced motion; no overflow.
- Every displayed Journey reference opens its own persisted ID, original Board
  and visible Inspector, including duplicate node titles and keyboard activation.
  The fixture executes the real checked-reference route with disposable SQL.
- Pending, 403, 409, 503 and stale-during-request targets remain in Insights.
  Fixture assertions prohibit inference and application writes.
- Native Chromium 200% browser zoom verified through DPR and halved CSS viewport,
  with all disclosures expanded and no horizontal overflow.
- Existing BW-40.1 suites pass, including BW-44.1 authenticated editor/viewer,
  public isolation, EN/DE, keyboard and lifecycle/authorization regressions.
- Existing BW-43 suite passes all 48 cases and native 200% zoom.
- Browser script integrity, app/test syntax, BW-28.3.1 producer/renderer contrasts,
  BW-28.1 and BW-25.1 translations pass locally.
- The old missing-finding-IDs assertion now checks finding buttons specifically:
  the independent Journey references correctly remain available. Its original
  prohibition on navigation actions for findings without IDs is retained.

The new suite is registered in the existing full Runtime Boot Safety workflow on
both PostgreSQL 17.6 and 18.4. Fictional browser screenshots and JSON results are
uploaded as `bw44-2-browser-postgres-<version>` artifacts. Final CI status is
reported in the PR handoff; local browser checks alone do not establish a full
PostgreSQL matrix pass. Browser acceptance uses fictional data and installed
Chromium; no production account or deployment is touched. Automated semantics and
keyboard checks do not substitute for a manual screen-reader session.
