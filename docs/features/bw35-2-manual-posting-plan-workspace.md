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

## 2026-09-18 — BW-35.2R1 integrated design repair

### Corrected product architecture

The original BW-35.2 presentation incorrectly treated Posting Plan as a separate top-level application area. That split implied a second content-planning product even though the plan reads and changes the same current-Board Social Media Posting nodes as Content and Calendar. BW-35.2R1 removes the dedicated sidebar entry, element binding, active-navigation branch, and click route. There is no independent Posting Plan shell or hidden duplicate surface.

Posting Plan is now the third semantic tab in Content Workspace: **Content / Calendar / Posting Plan** and **Inhalte / Kalender / Posting-Plan**. It uses the existing roving tab focus and Left/Right/Home/End keyboard behavior without introducing history state or a shell mode. The selected view remains inside the one Content Workspace mount, Board snapshot, access context, loading path, render cycle, and cleanup lifecycle. A Board identity change clears filter and planning transients while preserving the selected workspace tab, so a newly opened Board immediately replaces the cards without reviving state from the prior Board or forcing an application-area switch.

### Unified no-Board and lifecycle behavior

Loading, missing-Board, and access-denied states are resolved before a view-specific body is rendered. Posting Plan therefore shows the same single Content Workspace no-Board message as Content and Calendar: it does not mount its header, summary, filters, navigator, post empty state, or a four-zero dashboard beneath that message. Once a Board is available, records are projected directly from that render's `nodes`; no additional Board request, store, listener, or duplicate DOM surface is created.

### Content-first visual hierarchy

The repaired view uses a compact purple token-based planning header with concise localized guidance, followed by an accessible progress bar and small count chips for total, scheduled, unscheduled, and finalized posts. Remaining unscheduled work is emphasized. Progress is expressed as “Scheduled N of M” / “N von M geplant” in text and with bounded progress semantics; an empty collection says that there are no posts to schedule and reports zero rather than a misleading completion percentage.

Compact filter chips retain All, Scheduled, Unscheduled, Published/finalized, and Channel filtering with clear selected, hover, focus-visible, and count treatment. A no-results state includes an explicit filter reset. A no-posts state uses a small calendar cue and explains when Social Media Posting nodes will appear rather than filling the page with zero metrics.

Full-content post cards are the primary surface. The complete caption preserves line breaks and safely wraps URLs and hashtags. Each card includes a restrained token-based channel accent; internal title; safe destination label when an existing Facebook selection is available; schedule date, time, and timezone; approval, readiness, and publication state; and link/media presence. Unscheduled cards receive a warm planning cue. Finalized cards retain full contrast, a completion treatment, lock text, and no scheduling mutation controls. No provider identifier, credential, approval fingerprint, or confirmation binding is rendered.

The secondary planning navigator groups scheduled dates, unscheduled posts, and finalized posts deterministically. On wide screens it is the narrow sticky column beside the wider card stream. Activating an entry scrolls to and focuses its full card. At tablet and mobile widths it moves above the cards, loses sticky positioning, and reflows from compact tiles to one column without a second calendar or horizontal overflow. Scheduling forms continue to use the established accessible dialog and stack at existing small-screen breakpoints.

### Theme, motion, and accessibility

All new surfaces use Tendra One surface, border, text, primary, focus, success, warning, glow, motion, radius, and shadow tokens; no Posting Plan surface hardcodes white. Explicit dark-theme rules cover the gradient header, cards, navigator, and caption layer. Controls retain 44px targets, semantic labels, `aria-pressed`, visible focus, and readable locked/status text beyond color. The summary exposes text plus native progressbar values. Tab selection remains semantic and keyboard operable, navigator activation moves focus predictably, and hover/progress motion is removed under `prefers-reduced-motion`.

### Preserved authority and non-goals

BW-35.1 remains the sole scheduling authority. Canonical `node.planningSchedule` wins over the unchanged bounded legacy fallback. Save and remove continue through only `PUT /api/boards/:id/posting-schedule`; removal still sends `schedule: null`; pending UI waits for the authoritative response; and stale, unauthorized, invalid, and finalized results retain their established handling. Scheduling still preserves editorial status, approval metadata and fingerprint, publication material, and unrelated Board data. Viewers remain read-only and durable publication-finalization locks remain enforced.

This repair adds no automatic or bulk scheduler, CSV projection/export/download, provider-side schedule, provider request, publication, edit, reschedule, deletion, queue, credential use, database migration, or real social mutation. Future Phase 3 and Phase 4 actions can enter the existing Posting Plan tab through Content Workspace rather than introducing another workspace.

### Rollback boundary

Rollback is limited to the third Content Workspace tab, its integrated renderer/bindings, the repaired Posting Plan styles, and the BW-35.2R1 regression. Do not restore the removed sidebar area, revert BW-35.1, rewrite Board JSON, remove compatible schedules, alter approval state, or change provider-publication records.

## 2026-09-21 — BW-35.2R2 unified Content Calendar

BW-35.2R2 replaces the separated Calendar and Posting Plan presentations with one **Content Calendar / Content-Kalender** tab beside Content / Inhalte. Month, Week, and List are display modes over one current-Board Social Media Posting collection, one filter/search model, one count projection, one lifecycle, and one render tree. No hidden Posting Plan or duplicate calendar DOM remains.

The compact toolbar supplies period navigation, Today, local search, a view switcher, one filter popover, display options, and the browser timezone. A single planning strip reports total, scheduled, unscheduled, finalized, and progress. Month uses readable cards and expandable day capacity; Week provides seven time-structured drop columns; List provides deterministic chronological rows with date, channel, content preview, safe destination availability, approval/readiness, publication state, and media/link cues.

The collapsible backlog separates eligible unscheduled posts from visible blocked posts and explains blockers. Eligible backlog cards and editable scheduled cards support drag initiation. Month drops preserve an existing time but require the shared scheduling confirmation when an unscheduled item has no time. Week slots propose date and time. Dropping a scheduled card on the backlog requires explicit unscheduling confirmation. Escape cancels transient drag state, Board/lifecycle identity invalidates stale drops, and the authoritative card location remains unchanged until BW-35.1 succeeds. Failure leaves the previous schedule in place. Schedule, Move post, Change time, and Remove from calendar provide equivalent touch and keyboard operations through the same dialog and endpoint.

One focus-managed right-side detail drawer opens from Month cards, Week cards, List rows, and backlog cards. It preserves the complete caption, paragraphs, Unicode, and safe metadata while omitting credentials, provider IDs/responses, internal Page IDs, fingerprints, and confirmation bindings. On mobile it becomes a full-width sheet. Viewer drawers expose no mutation controls and finalized posts stay readable and locked.

Display options cover view, compact/comfortable density, caption/destination/status/media visibility, List grouping, first weekday, and backlog expansion. A validated version-2 browser preference stores only these safe primitives under authenticated-identity-category and Board scope; it stores no content or sensitive/provider data. Unified filters and local search apply to every presentation and backlog derived from the current Board.

All calendar surfaces use Tendra One surface, primary, border, text, focus, shadow, success/warning, and glow tokens with explicit dark-mode treatment. Desktop preserves a wide calendar plus sticky backlog, tablet stacks the backlog, and phone rendering defaults from Month to List while retaining all view controls, 44px actions, a full-screen detail sheet, wrapping, and no page-level horizontal overflow. Semantic workspace tabs, labeled view controls, keyboard popovers, visible focus, live drag/save announcements, drawer focus restoration, Escape handling, textual status/lock cues, and reduced-motion rules provide the accessibility boundary.

The sole persistence path remains `PUT /api/boards/:id/posting-schedule`, writing only canonical `node.planningSchedule`; unscheduling sends `schedule: null`. Strict date/time/IANA-zone and DST validation, schedule and Board revisions, locked transactional reconciliation, approval fingerprint and publication-material checks, finalized-publication protection, bounded read-only legacy fallback, and server-returned authoritative reconciliation are unchanged. Scheduling does not change approval, caption, media, destination, publication material/records, provider attempts, or editorial status.

The toolbar deliberately leaves architectural room for later automatic scheduling and CSV export without rendering either action now. Explicit non-goals remain an automatic/bulk scheduler, CSV projection/download, provider-side scheduling, provider requests, publishing/editing/rescheduling/deleting a real provider post, database migration, or any second persistence path.

Rollback is limited to the unified calendar renderer, bindings, styles, preferences, and BW-35.2R2 check. It must not restore separate Calendar/Posting Plan trees, remove canonical schedules, rewrite Board JSON, alter approval/publication state, or revert BW-35.1.

## 2026-09-21 — BW-35.2R3 direct-manipulation repair

Production behavior showed that R2 routed a completed calendar drop through `calendarState.proposal` into the legacy scheduling dialog. That modal lifecycle—not the canonical endpoint—created the perceived pause and introduced redundant date/time/timezone entry, readiness-warning acceptance, and an unscheduling confirmation. R3 makes the drop itself the command. A Month move changes only `localDate` and preserves canonical `localTime`, IANA `timeZone`, and DST `disambiguation`; an unscheduled Month drop uses the Board/account-scoped safe `defaultPlanningTime` preference (strict `HH:mm`, initially `09:00`) and the active calendar timezone. A Week drop uses its date and time while preserving an existing timezone and resolving ambiguous local time under the canonical compatible/earlier/later contract. A backlog drop sends `schedule: null`.

The calendar installs an optimistic projection before invoking the one BW-35.1 mutation callback. The affected card moves immediately and exposes a textual pending status; the persisted node remains authoritative. Success reconciles the returned `planning_schedule` and Board revision without a Board refetch, removes the projection, and exposes a seven-second feature-local Undo. Undo submits the previous canonical schedule through the same endpoint using the schedule and Board revisions returned by the preceding response. Mutation sequence and Board identity guards prevent expired or stale Undo and switched-Board completions from overwriting newer work. Failure, conflict, or stale rejection removes the projection and announces that the card returned to its previous date. Duplicate per-node mutations are blocked.

The measured client-side latency boundary was the R2 modal and duplicate confirmation lifecycle before dispatch, followed by the required browser v2 fingerprint calculation before `fetch`. R3 removes the former and paints pending state in the drop interaction before canonical validation/fingerprinting and immediate dispatch; it adds no debounce, artificial minimum duration, full-Board reload, or provider request. The transaction, lock, authorization, expected Board/schedule revision, material fingerprint, and finalized-publication checks remain unchanged.

Readiness and content-quality warnings remain visible information, but internal planning no longer requires warning acceptance. Manual planning retains one Save action with date, time, timezone, and DST controls; editorial approval confirmation is a separate workflow and is unchanged.

The visual repair uses layered token-derived indigo surfaces, tinted current/weekend/out-of-month day states, elevated channel-accented LinkedIn/Facebook/Instagram/X/TikTok cards, structured backlog cards with drag affordance plus Schedule and Details actions, pending treatment, and a compact Undo toast. Dark-mode overrides use the same semantic surface tokens and reduced motion disables pending/drawer animation.

The drawer defect came from rendering a fixed-looking overlay inside the calendar/backlog stacking context while its panel was absolutely positioned and partly translucent. R3 portals the overlay to `document.body`, gives the backdrop and opaque fixed panel an isolated z-index above toolbars, popovers, cards, and drag layers, constrains desktop width to 420–560px, provides independent viewport scrolling, and uses a full-viewport mobile sheet. Backdrop/close/Escape handling, a Tab loop, and trigger focus restoration are bounded to the drawer. Caption and metadata remain stacked and readable.

The malformed title was caused by presentation code falling back to record identifiers and allowing callers to compose an absent optional role/category as a string prefix. All calendar projections now pass through `safePostTitle`: empty optional prefixes are omitted, the title is used alone, and a missing title becomes “Social post” / “Social-Media-Beitrag”; `undefined`, `null`, and `NaN` are never presentation fallbacks.

The rollback boundary is the R3 drop derivation, optimistic projection, feature-local Undo, safe preference/title projection, portal behavior, and calendar/backlog/drawer styles. Canonical `planningSchedule` records and BW-35.1 persistence must not be rolled back. Automatic scheduling, recurrence, CSV export, provider scheduling/publication, publication jobs, and provider API calls remain explicit non-goals.

### 2026-09-22 — BW-35.2R3CI Runtime Boot Safety compatibility

Runtime Boot Safety exposed an unconditional DOM assumption added by the R3 drawer portal cleanup: every `render()` called `document.querySelector("[data-calendar-drawer-portal]")` before determining whether the Content Calendar or drawer was active. The historical BW-32.3.7 server-authoritative approval-action regression deliberately supplies a bounded `document` double with no `querySelector`, so an unrelated Content Workspace approval render failed before its normal projection and bindings ran. The focused R3 check had provided no global document at all; its `typeof document !== "undefined"` path therefore skipped the faulty branch and missed this intermediate-capability boundary.

Portal cleanup now goes through the narrow `optionalDrawerPortal()` capability lookup. It returns `null` unless both `document` and `document.querySelector` exist, while normal browsers perform the identical selector, removal, drawer portaling, focus, Escape, Undo, optimistic scheduling, and direct-drop behavior. `unmount()` uses the same boundary. The R3 regression now renders the unrelated library/approval surface with a document double that intentionally omits `querySelector`. The complete Runtime Boot Safety command sequence passes in declared workflow order, including BW-32.3.7, and tracked-files-only checks pass without `node_modules`. Rollback is limited to this helper and its regression/documentation; removing it would restore the unconditional boot-time DOM requirement.

## 2026-09-22 — BW-35.2R4 scheduling interaction repair

### Root causes and evidence

The button path was still bound to the inherited `cw-dialog` centered form. It duplicated broad asset/readiness information, retained the old “Confirm schedule” step, and did not disable its primary action when its local date/time projection was invalid. More importantly, calendar classification and mutation admission were separate decisions: the calendar knew about editorial `Scheduled`/`Published` values and a subset of embedded publication fields, while live finalized publication reconciliation was held in a Facebook-only map and the generic Content card actions made their own decision. A finalized post could consequently be rendered in the eligible backlog before a later path rejected it.

The drag path itself derived the correct optimistic placement, but the authoritative writer created `expectedMaterialFingerprint` from a newly sanitized browser copy. That copy is not necessarily byte-equivalent to the locked Board node used by the server's approval-material projection (notably when persisted image objects have already passed through browser hydration/sanitization). The server correctly returned `node_material_conflict`; the browser collapsed that and all other failures into the same rollback toast. R4 fingerprints the latest current Board node with the shared v2 material contract, while continuing to send the live Board revision, live canonical schedule revision, current editorial status, and exact v1 schedule command. It does not relax any server comparison.

### Shared eligibility authority

`publicationLockProjection` and `schedulingEligibility` are now the common browser projection for calendar records, eligible/blocked backlog sections, card dragging, drop admission, Details controls, quick-scheduler admission, the Content Workspace action menu, and the final browser mutation guard. They recognize the existing authoritative shapes only: editorial `Scheduled`/`Published`, reconciled in-session publication finalization, persisted `facebookPublication.status`, and the existing `externalPublication`/`publication` terminal states (`published`, `delivering`, `delivered`, `provider_accepted_unreconciled`, and `outcome_unknown`). Facebook and LinkedIn production-shaped fixtures are locked. Locked posts remain readable under **Finalized / locked** or the bounded blocked presentation, with Details available, but expose no planning mutation control and cannot reach the endpoint.

### Quick scheduling interaction

The legacy centered scheduling form is replaced by an opaque, channel-accented right-side quick-scheduling sheet. It contains the post title, channel, date, local time, timezone, DST choice only when ambiguity requires it, a single planning-only disclosure, Cancel, and one **Schedule / Planen** action. An unscheduled post starts with the validated `defaultPlanningTime`; an existing canonical record retains its time, IANA timezone, and DST disambiguation unless changed. Invalid values disable the action. Pending submission prevents duplicates, success closes and restores focus, and failure keeps the sheet open with actionable feedback. The existing focus trap, Escape/backdrop semantics, focus restoration, full-height mobile treatment, light/dark tokens, 44px targets, and reduced-motion behavior are retained.

### Drag, persistence, reconciliation, and errors

Month drops change only the local date, retaining canonical local time/timezone/DST, or use `defaultPlanningTime` for a previously unscheduled post. Week drops use the target date/time and retain timezone/DST. Backlog drops issue `schedule: null` without confirmation. Each mutation resolves the current node after the event, verifies Board/access/content/status/schedule generations, reserves one per-node request, projects an optimistic schedule, and sends one canonical PUT. A matching authoritative snake_case response alone updates `planningSchedule`, clears bounded legacy scheduling aliases, and advances `lastKnownUpdatedAt`. A real rejection removes the optimistic projection and restores the prior canonical state. Undo remains bounded and itself passes through all current revision and eligibility checks; Board changes invalidate pending interactions.

Failure codes are now mapped to localized, secret-safe categories for stale calendar state, finalized/locked publication, permission loss, schedule conflict, invalid temporal input, missing post, and network/storage failure. No caption, token, destination/provider identifier, URL, raw provider response, or node payload is included. Stale state is never silently retried; the existing Refresh action is the explicit recovery.

### Preserved boundaries, deployment, and rollback

The server route, row lock, authorization, strict local date/time/IANA/DST validation, Board and schedule revisions, v2 material fingerprint, editorial-status check, durable publication queries, atomic narrow Board JSON update, and allowlisted response remain unchanged. `node.planningSchedule` is still the only write authority and `schedule: null` the only unschedule command. Scheduling changes no caption, media, approval, publication record, credential, provider job, or provider state, and makes zero provider requests.

Deploy `content-workspace.js`, `app.js`, and `styles.css` together with the focused regression registration. No migration, environment variable, worker, or provider credential is required. Rollback is limited to these browser assets and the regression/workflow registration; do not roll back BW-35.1, rewrite Board JSON, or remove compatible schedules.

### Manual production acceptance

1. Open the Content Calendar with eligible, scheduled, and finalized posts.
2. Confirm finalized Facebook and LinkedIn posts are locked and expose no Schedule action.
3. Click Schedule on an eligible unscheduled post.
4. Confirm the new Tendra One scheduling layer opens.
5. Select a date/time and save once.
6. Confirm the post moves without reload.
7. Drag the post to another Month date.
8. Confirm the date changes while time/timezone remain unchanged.
9. Drag an unscheduled backlog post onto a date.
10. Confirm it uses the default planning time.
11. Drag a scheduled post back to the backlog.
12. Confirm direct unscheduling without a confirmation dialog.
13. Test Undo, then verify an Undo after a stale external change is rejected with refresh guidance.
14. Confirm browser network activity contains one canonical scheduling PUT per action and no Facebook, LinkedIn, Meta, or other provider request caused by scheduling.

## 2026-09-23 — BW-35.2R5 fluid and reliable scheduling

### Verified causes

Tracing the real path from `dragstart` through the canonical response with production-shaped invented Facebook, LinkedIn, Instagram, and reordered-list fixtures proved three independent defects. First, the drop path synchronously called the complete Content Workspace renderer and the application writer rendered the complete workspace again before fingerprinting, after reconciliation, and from `finally`; replacing the host tree made the calendar appear inactive and discarded focus/interaction state while one card was saving. Second, different-node writes were allowed to race against the same Board revision, while subsequent calls could retain the revision prepared before an earlier response; the first response advanced visible node data and `lastKnownUpdatedAt`, but racing requests had already dispatched. Third, durable publication rows are necessarily server-authoritative and are not always represented in an older loaded Board node. The browser could therefore correctly consider that snapshot eligible while the locked transaction correctly found a finalized external post. The error text described the server result, but was not itself used as root-cause evidence.

No evidence showed an index-based drag target or adjacent-node fingerprint: drag state and the request both use stable node IDs. No provider reconciliation/refetch is required for a normal move. The fingerprint computation was repeated for unchanged material and contributed avoidable work, although it was not the primary freeze cause.

### Paint and granular update boundary

A valid drop now reserves only its stable card ID, stores the optimistic schedule, moves that existing DOM card directly to the destination, adds a compact localized pending pill, and removes drag capability from that card alone. It does not replace the Content Workspace tree. The code then yields through `requestAnimationFrame` (with a minimal non-browser fallback), proving that optimistic DOM work is scheduled and completed before fingerprinting or network dispatch. Toolbar controls, filters, Details, scrolling, other cards, channel styling, and readable content remain live. Authoritative success or card-scoped rollback performs the normal calendar reconciliation only after that paint boundary. No dimmer, blocking spinner, artificial debounce, provider call, or Board refetch was added.

### Lifecycle-bound mutation coordination and revisions

Canonical server dispatch is serialized behind a Board-lifecycle generation queue because every schedule write shares the Board revision. Each queued operation re-resolves the node by stable ID and revalidates access, eligibility, readiness, editorial status, current canonical schedule revision, material, and lifecycle immediately before dispatch. It then reads the latest `state.lastKnownUpdatedAt`; a successful response advances both the node's authoritative `planningSchedule` (including schedule revision) and that Board revision before the next queued operation runs. Queue failure is caught at the chain boundary so it cannot poison later work, and Board-generation changes discard queued work. Per-card reservations still reject duplicate simultaneous delivery. There is no silent retry after an uncertain outcome.

Undo continues through the same queue and live-node validation. It becomes available only after authoritative success, uses the revisions returned by that success, is invalidated by a newer same-card mutation/Board lifecycle, and on failure reconciles to the latest authoritative schedule rather than installing the older optimistic value.

### Fingerprint and finalized-publication consistency

The v2 browser fingerprint remains computed from the current authoritative Board node, never card text. A bounded 64-entry promise cache is keyed by Board identity, stable node identity, and the exact shared material fingerprint key. Unchanged material shares completed/in-flight work; a material change creates a different key; entries never cross nodes, and failed computations are evicted. Server verification is unchanged.

The established semantic browser lock projector remains the sole calendar/control eligibility rule for editorial and embedded publication shapes. When the locked server transaction discovers a newer durable finalization, the one affected card rolls back and the bounded in-session authoritative lock projection is updated. Its drag and schedule controls disappear on reconciliation, preventing repeated false admission. Facebook and LinkedIn finalized fixtures remain non-draggable; eligible Instagram and LinkedIn fixtures remain eligible. The server row lock, durable post/job lookup, and terminal-state protection are not weakened.

### Diagnostics, failure recovery, deployment, and rollback

Development diagnostics cover drag start, accepted drop, optimistic paint scheduled/completed, fingerprint ready, dispatch, response, reconciliation, and rollback. The fixed schema contains only correlation ID, lifecycle generation, mutation/stage/result categories, bounded elapsed time and queue depth, revision presence, and eligibility category. It cannot contain node/provider IDs, captions, titles, URLs, tokens, request bodies, or object snapshots.

Every failure clears the per-card reservation and optimistic projection deterministically, restores only that card from current authoritative state, preserves unrelated interactions, and leaves the queue usable. A finalized response additionally installs the authoritative lock. Deploy `content-workspace.js`, `app.js`, and `styles.css` together with the R5 regression/workflow registration. There is no migration, environment change, provider credential, or worker. Rollback is limited to the card paint helper, queue/cache/diagnostics, styles, and R5 registration; do not roll back BW-35.1 persistence or rewrite schedules.

### Manual acceptance

1. Open a Board containing several eligible, scheduled, and finalized posts.
2. Drag an unscheduled post into the current month and confirm it appears immediately with only that card showing Saving.
3. While saving, use filters, open Details, scroll, and interact with another card.
4. After success, move the same card again and confirm the second move uses the returned revisions.
5. Move two different eligible cards quickly and confirm serialized persistence without a stale-Board conflict.
6. Move a scheduled card in Month and confirm local time/timezone/DST are preserved; in Week confirm the dropped time is used.
7. Move a card to backlog and confirm direct canonical `schedule: null` unscheduling.
8. Test Undo after success; then make a newer same-card move and confirm obsolete Undo is unavailable.
9. Induce a bounded failure and confirm only that card returns to its exact authoritative location and can later move successfully.
10. Attempt finalized Facebook and LinkedIn cards and confirm no drag or planning controls exist.
11. Confirm a post finalized between drop and row lock rolls back once and becomes locked.
12. Confirm network activity has one canonical PUT per dispatched intent, no full Board reload, no duplicates, and no Facebook, LinkedIn, Meta, or other provider request.

## 2026-09-23 — BW-35.2R7 emergency stability containment

The R6 audit proved that the browser resolver formatted every minute in a 36-hour window (2,161 operations) whenever a canonical schedule was read. R7 replaces both browser and server resolution with one dependency-safe pure resolver. It strictly parses the local tuple, takes five fixed probes around the naive UTC instant, derives distinct plausible offsets, and verifies only those candidates. The public instrumentation ceiling is ten `formatToParts` operations per resolution (the covered normal and DST cases currently use six or seven), with a timezone-keyed formatter cache bounded to 32 entries. Gaps still reject, overlaps still require the established `earlier` or `later` choice, and impossible dates and invalid IANA zones still reject.

Calendar rendering now maintains an indexed projection for interaction admission. Drag start stores only lifecycle/Board/node identity, source and schedule-summary categories, correlation category, and eligibility. Delegated host handlers are installed once; dragover reads that session, compares one target, prevents default, and changes styling/announcement only on a target transition. It performs no timezone work, projection, fingerprint, render, serialization, storage, queue work, or network request. Drop re-resolves the node by stable ID and revalidates lifecycle, eligibility, and target before creating the canonical intent. Drag end, invalid targets, Board changes, exceptions, reset, and unmount clear the session and target.

A lifecycle-scoped render guard rejects synchronous re-entry, records a bounded secret-safe diagnostic, and coalesces at most one legitimate follow-up into a microtask; `finally` releases the guard after exceptions. Emergency queue containment retains the Phase 1 serial writer but caps depth at eight, rejects exact duplicate intents, invalidates stale Board generations, yields a task between items, removes intent keys in `finally`, and returns depth to idle after success or failure. Reset/unmount clear calendar reservations and pending projections. The listener ledger is test-only runtime state: one mounted host owns five delegated drag event properties, rerenders do not increase that count, and unmount returns calendar-owned global listeners and the host count to zero.

Pending Month cards now reserve a fixed 14px corner status slot containing an animated dot and screen-reader-only “Saving change…” label. Text never rotates, the marker is absolutely positioned, no outline/ring is stacked, opacity remains full, channel accent stays visible, and dark mode plus a static reduced-motion alternative are explicit. Week/List/backlog continue to remain readable and interactive.

Correlation remains bounded to category data from drag through intent and reconciliation. A durable finalization is accepted as a publication lock only for the same stable requested identity; identity/revision/material/storage failures retain distinct scheduling failure categories. The affected card alone rolls back, clears pending state, enters the in-lifecycle lock projection, and loses dragging. No raw IDs, Board IDs, captions, titles, provider identifiers, URLs, tokens, request bodies, or object snapshots enter scheduling diagnostics.

Phase 2 still owns removal of the promise-tail writer, consolidation of the three schedule authorities and numerous transient representations, memoized/keyed Calendar rendering, and broader module extraction. Automatic planning, CSV export, provider scheduling, recurrence, and channel/media redesign remain paused.

Deploy `timezone-resolver.js`, `content-workspace.js`, `app.js`, `styles.css`, and the server contract together. No migration, dependency, worker, environment variable, or provider credential is required. Rollback is limited to this R7 bundle; do not roll back BW-35.1 persistence or rewrite Board JSON. Production acceptance requires 20 alternating successful/failed/cancelled moves plus Board switch and unmount/remount, while confirming responsive controls, one card per stable ID, idle queue, no pending marker, stable listener count, bounded formatter cache, and exactly one canonical scheduling PUT per accepted operation with zero social-provider requests.

## 2026-09-23 — BW-35.2R8 simplified Content Calendar architecture

### Previous architecture and state-authority reduction

R7 intentionally contained, but did not remove, three client-side schedule authorities: mutable Board nodes, `optimisticSchedules`, and physically relocated cards. The same operation was additionally represented by `calendarMutations`, the application `postingScheduleRequests` set, an unbounded promise-tail queue, DOM pending state, drag state, and Undo. Month and Week scanned all scheduled records inside every cell, quick scheduling bypassed the Calendar coordinator, and response completion was split between the application dispatcher and Calendar mutation code.

R8 makes the application Board data the durable-input boundary and creates one immutable, lifecycle-versioned `authoritativeBoardSnapshot` in `renderCore`. That boundary owns Board ID/revision, lifecycle generation, frozen node records (including canonical `planningSchedule`, schedule revision, editorial/publication fields), and access projection. Event handlers retain stable IDs and resolve the node from that snapshot. An accepted response creates a new snapshot with `replaceSnapshotNode`; a failure never changes it. The application dispatcher still performs server-bound fingerprint, authorization, revision, and response-envelope validation, but it no longer queues or coordinates presentation state.

The reduction is:

* schedule authorities: three to one client authority plus the server durable authority;
* mutable Calendar coordination containers: `optimisticSchedules`, `calendarMutations`, promise-tail/depth/intent set, moved DOM cards, and separate temporary record state to one interaction overlay plus one `{active, latest}` writer;
* pending representations: five or more to one overlay entry per stable node (with a rendered fixed 14px status slot);
* write entry points: direct quick-sheet/application and Calendar paths to `applyCalendarMutation` -> `SchedulingWriter.submit`;
* response completion paths: per-action Calendar completion branches to the writer's one `reconcile` hook.

The bounded legacy `node.social.scheduledDate`, `scheduledTime`, `scheduledAt`, and `addedToCalendar` read fallback remains because persisted pre-BW-35.1 Boards can still contain it. Every write remains exclusively canonical and successful canonical writes clear those aliases. No standalone Posting Plan, retired scheduling modal, DOM relocation, duplicate pending map, promise-tail queue, or provider-scheduling compatibility path remains.

### Extracted module and indexed projection

`content-calendar-architecture.js` is a dependency-free UMD/classic-script module loaded after the timezone resolver and before `content-workspace.js`. It exposes only immutable snapshot creation/replacement, bounded overlay creation, the memoized projection factory, the writer state machine, writer state constants, and schedule-summary normalization. It has no server or DOM dependency and is directly testable in Node.

`createProjectionFactory` caches against the explicit Board identity/revision/generation, period, view, filter, preference, locale, timezone, and overlay version tuple. A rebuild creates read-only stable-ID, local-date, and channel indexes and immutable ordered visible/backlog/locked collections. Month uses the local-date buckets directly. Week performs only a bounded bucket-local hour selection rather than a full-record scan for each of 168 cells. Dragover only reads the frozen drag identity and target transition and cannot invalidate or rebuild the projection. Ordering remains scheduled instant, original Board index, then stable ID.

The overlay stores only stable node ID, lifecycle generation, compact versioned intent, prior/optimistic schedule summaries, stage, bounded correlation category/timestamps, and optional Undo expiry. It excludes nodes, Boards, DOM references, captions/media, credentials, request bodies, and provider responses. Projection rules select exactly one effective placement, so a node cannot appear in backlog and a date, two dates, or scheduled and locked sections.

### Writer state machine, coalescing, and reconciliation

The Board-scoped writer has explicit `idle`, `optimistic`, `preparing`, `sending`, `reconciling`, and `rolling_back` states. It holds one active immutable intent and at most one latest immutable queued intent—never an array or promise tail. Exact duplicates are ignored. A newer queued intent replaces the previous queued intent (including its overlay); the latest same-node intent therefore coalesces, while a different-node intent remains bounded to the same single slot. Active completion reconciles first and only then revalidates the latest intent against the new snapshot. Active failure clears only the active interaction and likewise revalidates the latest intent. Network uncertainty is returned as failure and is never silently retried.

The shared entry point resolves current authority, validates eligibility/temporal input, writes the overlay, renders optimistic projection, yields to the browser, prepares the current fingerprint/request, dispatches once, and calls the single writer reconciliation hook. Drag/drop, the quick sheet, change time, unschedule, and Undo all reach this entry point. Reconciliation rejects missing, malformed, identity-inconsistent, lifecycle-stale, and noncanonical success values. Only that hook replaces the authoritative snapshot. A same-identity finalized response adds the bounded publication-lock projection; Board-revision, schedule-revision, and fingerprint conflicts remain conflicts and are not mislabeled finalized.

Board switches, reset, and unmount invalidate the writer epoch, clear active/queued overlay presentation, clear drag state, and leave the writer idle. Late responses cannot cross that epoch. The delegated host remains the sole Calendar drag binding boundary; rerenders keep the same five host drag properties and unmount returns the Calendar listener ledger to zero. The detail drawer and quick sheet retain their explicit portal lifecycles.

### Removed compatibility paths and safety rationale

* Removed physical card reparenting. Projection plus overlay now determines placement; no DOM location is read as schedule state.
* Removed `optimisticSchedules` and `calendarMutations`. Their responsibilities are one minimal overlay and writer state.
* Removed `postingScheduleQueueTail`, the queue cap/depth, and intent-key set. The replacement structurally cannot retain more than active plus latest.
* Removed direct quick-sheet and library-unschedule calls to the application writer. They now use the shared Calendar writer.
* Removed nested Month date filtering and Week date filtering. Indexed buckets are produced once per relevant version.
* Removed duplicate Calendar response-completion branches. One reconciliation hook owns snapshot replacement and rollback.
* Retired R3/R4/R5/R7 regressions that asserted old implementation tokens; they now assert the preserved behavior or replacement invariant.

The legacy schedule read fallback is deliberately retained as the only verified persisted-data compatibility consumer. Publication and approval compatibility logic is outside this architecture change and remains intact.

### Complexity measurements

Measurements use repository bytes (`wc -c`) and named function declarations (`rg -o 'function …'`). The R6 baseline was `content-workspace.js` 129,090 bytes, 91 named functions, 68 functions in the broad audited Calendar-heavy region, three schedule authorities, at least five pending representations, multiple render/write paths, and one unbounded queue. R8 has `content-workspace.js` 132,464 bytes and 96 named functions because its thin integration/reconciliation adapter is explicit; the extracted pure module is 8,220 bytes and 16 named functions. The focused Calendar scheduling region is 40 named functions rather than 68. Core authority/projection/overlay/writer ownership (16 functions) is no longer in the workspace facade. Runtime containers are one snapshot, one memoized projection, one overlay, one active/latest writer, one preference value, and bounded Undo/feedback. There is one Calendar render projection entry and one scheduling write entry.

The important complexity reduction is runtime state and ownership rather than minified source bytes: the oversized classic workspace remains a future extraction candidate, but it no longer owns the queue, projection cache algorithm, snapshot immutability algorithm, or overlay/writer data structures.

### Preserved R7 containment and historical test boundary

The shared five-probe timezone resolver, ten-`formatToParts` ceiling, formatter cache, constant-time dragover, frozen drag identity, render re-entry guard, listener cleanup, fixed 14px pending slot, reduced-motion treatment, secret-safe diagnostics, identity mismatch ordering, finalized-lock behavior, and browser/server timezone parity remain active. R8's regression repeats the bounded resolver assertion and 20-operation idle/zero-overlay/unique-record stress.

The BW-33.5 and BW-33.5.1 checks incorrectly inspected the current working-tree diff and required every future change to remain inside their historical migration-only scope. Their boundary now validates the migration/rollback/verification artifacts, original migration hash, exact table inventory, SQL safety, runtime schema inventory, documentation, and workflow order without treating unrelated later tracked product work as part of the historical migration. No migration invariant was removed, no current file is hardcoded as an exception, and tracked-files-only checkouts are deterministic.

### Deployment, rollback, and production acceptance

Deploy `content-calendar-architecture.js`, `timezone-resolver.js`, `content-workspace.js`, `app.js`, `index.html`, and the regression registration together. The classic loading order is explicit. There is no framework, dependency, build step, migration, environment variable, worker, provider credential, provider schedule, or automatic publication change.

Rollback must revert the R8 browser bundle together; do not roll back BW-35.1 canonical persistence or R7 timezone containment and do not rewrite Board JSON. A rollback restores the former bounded R7 queue but does not require database work.

Production acceptance covers Month with scheduled/backlog/locked posts; immediate single-overlay placement; a second same-post move using returned revisions; two rapid posts showing active plus latest only; removal of superseded queued presentation; isolated controlled rollback followed by a successful move; quick-sheet time change; backlog unschedule; Undo; Details during save; filter/view switching; Board switching during pending work; and absence of duplicates, stuck state, freezes, or provider requests. Browser network inspection must show only canonical posting-schedule PUTs. Scheduling performs zero Facebook, LinkedIn, Meta, or other provider requests and zero real social-media mutations.

## 2026-09-24 — BW-35.2R9 visual system and post previews

### Shared channel identity and card hierarchy

The Calendar now owns one dependency-free channel projection in `content-calendar-visuals.js`. It canonicalizes only persisted LinkedIn, Instagram, Facebook, X/Twitter, and TikTok values, with a Tendra purple unknown fallback. Repository-owned inline SVG uses `currentColor`; visible labels or bounded accessible names accompany icons, so color is never the sole identity. Each projection supplies light/dark accent, surface, and border values. No icon package, CDN, provider API, credential, or provider identifier is involved.

Month cards are fixed, compact summaries: icon and local time, a two-line title beside a reserved 44px preview, then one compact approval/readiness or scheduling state. They never include captions, destinations, timezone prose, or publication explanations. Week cards add a bounded two-line caption. List rows add channel, date/time, 72px media, caption, approval, readiness, planning state, safe destination, Details, and an authorized scheduling action. Backlog cards use a balanced handle/60px-preview/summary/actions layout, visible channel label, two-line caption, and 44px actions; locked cards remain fully readable and omit mutation controls.

### Safe media boundary

Social Media Posting `images` records remain the only media source. The model has no favorite/selected field, so the preview is the latest safe image by numeric `createdAt`, with Board order as a deterministic tie-breaker. Explicit non-image records are excluded. URLs must be established same-origin paths or HTTPS, must contain no URL credentials, and must not contain credential-bearing query keys. The renderer escapes the allowlisted URL, emits no HTML from content, uses fixed dimensions, `object-fit`, lazy loading and async decoding, and caps the additional-media badge at `+99`. There is no fabricated image, provider request, retry, timer, or mutation.

A failed image hides itself and exposes the already-rendered channel-tinted fallback. This local `onerror` class change neither rebuilds the indexed projection nor enters the scheduling writer. The drawer uses the same selected safe source in a bounded 16:9 preview and preserves caption paragraphs, Unicode, hashtags, and URLs as escaped text.

### Responsive, theme, and accessibility behavior

Current day has a high-visibility inset marker; weekends and out-of-month dates use distinct readable surfaces; selected drop targets have a strong dashed treatment. Dark-mode channel equivalents stay restrained. Forced-colors rules restore system borders and icon color, reduced-motion disables pending animation, and focus continues to use the design-system ring. On phones, the established preference moves first-time Month users to List; compact Month can also collapse to one column, backlog stacks, the drawer is full-screen, actions remain 44px, and horizontal overflow is removed. Touch scheduling is independent of drag.

The channel filter presents icon, localized label, count, and keyboard-operable pressed state. Compact pending/queued updates retain polite status semantics. Locked reason text is available beside a local lock SVG. Full-card detail activation does not contain mutation controls; List and backlog actions are sibling buttons.

### Performance and architecture boundary

R9 is presentation-only above R8's immutable snapshot, memoized indexed projection, bounded per-node overlay, active-plus-latest writer, and single reconciliation path. Media selection occurs while projecting each node once. Image load/error changes only the image element and fallback class: it cannot update the Board snapshot, projection cache, overlay, writer, or schedule. Delegated drag listeners, constant-time dragover, timezone ceilings, optimistic rollback, Undo, publication locks, and provider isolation remain unchanged.

### Deployment, rollback, and manual acceptance

Deploy `content-calendar-visuals.js`, `content-workspace.js`, `styles.css`, `index.html`, the R9 regression, package registration, and Runtime Boot Safety registration together. No migration, environment variable, dependency, provider connection, build step, or data rewrite is required. Roll back this bundle together while retaining BW-35.1 persistence and R7/R8 architecture.

Manual acceptance uses one Board containing LinkedIn, Instagram, Facebook, X, TikTok, and unknown fixtures. In light, dark, forced-color, desktop, tablet, and mobile modes verify recognizable icons, compact Month cards without captions, stable valid-image previews, intentional no-media/unsafe/broken fallbacks, bounded `+N`, readable locked posts without scheduling controls, progressive Week/List detail, full drawer caption/media, labeled filter counts, keyboard and touch Schedule/Move, and no horizontal overflow. Repeat 20 successful/failed/cancelled scheduling operations plus Board switch/remount; confirm one card per ID, no freeze/layout corruption/listener growth, idle writer and empty overlay. Network inspection must show only accepted canonical Board scheduling PUTs: zero Facebook, LinkedIn, Meta, CDN, or other provider requests and zero real social-media mutations.
