# BW-35.2 — Manual Posting Plan Workspace

## Product objective

The Posting Plan is a Board-scoped, content-first workspace for reviewing every Social Media Posting node and managing internal planning dates. The complete publish-ready caption is the primary surface; dates, status, channel, destination availability, links, and media are supporting metadata. This phase never schedules with or publishes to a provider.

## Entry point and information hierarchy

The Board navigation contains one localized **Posting Plan / Posting-Plan** entry. It opens a dedicated mode in the existing Content Workspace lifecycle. Desktop uses a wide primary column of readable post cards and a compact, sticky chronological navigation column. The persistent summary and compact filters precede both columns. No export control is rendered; the view leaves room for a future separately authorized Phase 4 action.

Each card renders the authoritative caption (`social.caption`, with `content` only as the established fallback) as escaped text with preserved paragraphs, Unicode, emoji, hashtags, and URLs. It is never replaced by the shortened Content Library preview and is not clamped. The card then shows channel, internal title, honest destination unavailability, local date/time/timezone, scheduling state, editorial approval, readiness, publication protection, link presence, and media count. Provider and internal identifiers are intentionally absent.

## Authoritative selection, counts, filters, and ordering

Selection is exact: every current-Board node whose `type` is `Social Media Posting` is collected in Board array order; other node types are excluded. Unscheduled, incomplete, unapproved, destination-less, unsupported-provider, and finalized posts remain visible.

The card list and the five summary values use the same collection and classifier. Counts are total, scheduled, unscheduled, published/finalized, and not currently eligible. A canonical `planningSchedule` is counted once and wins over legacy aliases. The bounded BW-35.1 legacy reader remains display-only.

Filters cover All, Scheduled, Unscheduled, Published/Finalized, and Channel. Destination filtering is omitted because current node data has no safe canonical destination binding. Filters retain the common deterministic order:

1. scheduled editable posts by authoritative UTC instant;
2. unscheduled editable posts by original Board order;
3. finalized or otherwise locked posts by relevant schedule time;
4. original Board index and opaque node ID provide deterministic ties.

## Manual scheduling and authoritative reconciliation

Eligible authenticated editors use the established date, time, IANA timezone, and DST-disambiguation dialog. Save sends the exact BW-35.1 command to `PUT /api/boards/:id/posting-schedule`; Remove sends `schedule: null`. No legacy alias is submitted or written.

The dialog disables Save and Cancel while its node request is pending and announces the bounded saving state. The prior card schedule remains authoritative until a structured server response arrives, while other cards remain usable. On success, the browser accepts only the allowlisted returned `planning_schedule` and Board revision, clears legacy aliases for that deliberately changed node, recomputes counts and ordering, and rerenders the timeline. On invalid, authorization, stale/conflict, finalized, duplicate-pending, or generic failure, the prior schedule remains intact and localized controls are restored. Board switches reset plan filters and the existing workspace unmount clears transient overlays.

## Timezone, DST, and calendar synchronization

Every planned card and chronological entry displays stored local date and time. Cards always show the IANA timezone, or identify bounded legacy data as missing a timezone. The form uses the BW-35.1 local-time resolver: nonexistent times are rejected, ambiguous times require `earlier` or `later`, and server-local time is never inferred. Localized display never changes stored values.

The compact chronological navigator and cards both consume `readPlanningSchedule`. Multiple same-day posts remain separate buttons showing time, channel, and title. Selecting an entry scrolls to and focuses its complete card. There is no drag-and-drop or second calendar data store.

## Authorization and locked states

Board owners/editors with established `canEdit` may mutate an eligible schedule. Authenticated viewers and public/read-only users can review the full plan but receive no mutation control. Anonymous Board access remains prohibited by existing Board loading authorization. The BW-35.1 server boundary, not button visibility, remains authoritative.

Editorial Scheduled/Published and finalized/protected posts are rendered with an explicit lock explanation and no active mutation control. Incomplete or otherwise ineligible posts remain readable with a bounded reason.

## Approval and publication invariants

A schedule operation changes only `planningSchedule` through BW-35.1. It does not change caption, title, media, link, destination, editorial status, approval state, approved fingerprint, approval metadata, publication material, publication record, provider job, attempt state, or external post. `planningSchedule` remains outside approval material. The Posting Plan contains no provider request, publishing action, automatic schedule, queue, worker, CSV generation, or download.

## Legacy compatibility

Canonical `node.planningSchedule` always wins. The approved bounded read-only fallback for `social.scheduledDate`, `scheduledTime`, `scheduledAt`, and `addedToCalendar` remains visible and is labelled as legacy. Deliberate mutation writes only canonical scheduling data and follows BW-35.1 cleanup; dual writes are forbidden.

## Localization, responsive behavior, theme, and accessibility

All new user copy is paired English/German, including navigation, title, summary, filters, metadata, empty/read-only/locked/pending states, actions, and outcomes. Shell navigation uses the shared language module; workspace copy follows the existing Content Workspace localized dictionary architecture.

The implementation uses existing `--fk-*` surface, input, border, text, selected, focus, success/warning, and muted tokens, including existing dark-theme token overrides. No white Posting Plan surface is hardcoded. Below 900px the timeline stacks before cards; at phone widths filters and metadata collapse without horizontal scrolling, captions retain wrapping, and controls retain at least 44px touch targets.

Buttons and labelled select controls are semantic and keyboard operable. Selected filters use `aria-pressed`; status/pending feedback uses live regions; finalized state includes text and a lock symbol rather than color alone. Timeline selection places keyboard focus on the associated card. The established schedule dialog supplies initial focus, Tab containment, Escape behavior when not saving, and trigger focus restoration.

## Diagnostics and privacy

The workspace renders no access token, encrypted credential, provider response, provider/external post ID, internal Page ID, approval fingerprint, confirmation binding, or sensitive diagnostic. Failures use stable localized categories and never raw server error content.

## Changed files

- `index.html`: Board-level Posting Plan navigation entry.
- `app.js`: entry routing, pending projection, and authoritative workspace integration.
- `content-workspace.js`: canonical collection, classification, counts, filters, cards, ordering, timeline navigation, scheduling states, and EN/DE copy.
- `styles.css`: token-based responsive Posting Plan layout.
- `language.js`: shared German navigation label.
- `scripts/check-bw35-2-manual-posting-plan-workspace.js`: dependency-safe invented-fixture regression.
- `package.json` and `.github/workflows/runtime-boot-safety.yml`: focused command registration.
- This document: BW-35.2 behavior and boundaries.

## Deployment requirements

Deploy browser assets together with the already deployed BW-35.1 route and service. No environment variable, provider credential, worker, dependency, database migration, or data rewrite is required. A tracked-files-only checkout can run the focused Node regression.

## Acceptance criteria

The implementation is accepted when the single Board entry opens the plan; every current-Board social post and its full caption is reviewable; canonical counts, filtering, order, and timeline agree; eligible editors can save/edit/remove only through BW-35.1; viewers and finalized posts cannot mutate; pending/failure preserve authority; English/German, light/dark, mobile, focus, and keyboard contracts pass; and focused plus affected persistence, calendar, role, integrity, approval, and provider-finalization regressions pass without provider access.

## Rollback boundary

Hide/remove the Posting Plan navigation and dedicated presentation functions/styles. Do not revert BW-35.1, rewrite Board JSON, or remove compatible `planningSchedule` records. Existing Inspector and Content Workspace calendar planning remain available.

## Explicit non-goals

No automatic or bulk scheduling; conflict/capacity engine; CSV projection, preview, generation, or download; provider-side schedule; automatic publishing; provider call; destination invention; real post creation/edit/reschedule/deletion; approval mutation; fingerprint change; publication-state mutation; database migration; drag-and-drop; or export action is included.
