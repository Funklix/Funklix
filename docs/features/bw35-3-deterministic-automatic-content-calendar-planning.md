# BW-35.3 — Deterministic automatic Content Calendar planning

## Prior state and scope

BW-35.1 and BW-35.2 remain authoritative for canonical schedules and the unified calendar. BW-35.3 adds a temporary preview and one Board-scoped atomic persistence command. It does not publish, contact a social provider, optimize engagement, recur, export CSV, or replan existing schedules.

## Proposal engine and defaults

`automatic-planning.js` is the single pure, dependency-free (apart from the shared bounded timezone resolver) proposal engine. Its default is Monday–Friday, the saved `defaultPlanningTime`, one post per day, and 28 inclusive calendar days. The start is the later of today and the visible future period. All represented channels are included unless a channel filter is supplied.

Exact Social Media Posting records are ordered by canonical Board index and then stable node identity. Existing schedules are copied to the result and consume capacity; they are never modified. Finalized, publishing, unauthorized, malformed, already scheduled, non-social, and otherwise canonically ineligible records receive one bounded exclusion reason. Invalid temporal candidates and insufficient capacity receive bounded unplaced reasons.

Candidate dates follow selected weekdays. Unique strict `HH:mm` times are sorted, resolved with the shared IANA timezone/DST resolver, and filtered for existing collisions, daily capacity, and optional minimum spacing. Gaps are rejected; overlaps use the selected canonical disambiguation.

### Exact balanced distribution algorithm

Let `K = min(N, M)`, where `N` is ordered eligible posts and `M` is ordered valid slots. For post index `i` from zero through `K - 1`, choose slot index:

`floor(((2 × i + 1) × M) / (2 × K))`.

This is the integer midpoint of each of `K` equal partitions of the available sequence. For `K <= M`, indices are strictly increasing and unique. Posts retain Board order, selected slots retain chronological order, and excess posts are explicitly unplaced. There is no random input or “optimal time” claim.

## Proposal session and adjustments

The bounded session owns normalized settings, proposal version, minimal ID-to-schedule placements, excluded/unplaced categories, dirty identities, original Board revision, and lifecycle generation. It contains no Board clone, DOM, captions, media, credentials, provider responses, or history. Cancel, apply success, regeneration, access/lifecycle change, unmount, and stale authority clear or invalidate it.

Month/week movement and Schedule/Change time are proposal-only operations while preview is active. Validation covers range, timezone, DST, capacity and collisions. An intentional manual placement outside selected weekdays is accepted only through the explicit manual-adjustment option and is visibly marked; it must remain within the selected range and canonically resolve. Returning a card to proposal backlog removes its placement. These operations neither fingerprint nor write authority.

## Planning studio and accessibility

Editors and owners see **Auto-plan** in the calendar toolbar; viewers receive no mutation control. The responsive right-side studio opens with an immediate proposal, concise controls and summary, R9 platform icon/accent reuse, strong proposal badges, keyboard-native fields/buttons, visible focus inherited from the calendar, live status text, reduced-motion behavior, dark/light tokens, and a mobile full-height layout. English and German strings cover controls, state, failures, apply and Undo terminology.

## Atomic batch contract

`PUT /api/boards/:id/posting-schedule/batch` accepts only `posting_schedule_batch_v1`, Board identity/revision, a bounded request ID, and 1–100 strict schedule commands. Each command contains node identity, expected schedule revision/status, v2 publication-material fingerprint, and the canonical schedule or `null`. Unknown keys, duplicates and oversized batches are rejected.

The authenticated service requires `canEdit`, begins one transaction, locks the Board row once with `FOR UPDATE`, verifies the Board revision once, and validates every node, exact type, revision, editorial state, v2 fingerprint, publication protection and canonical time before changing any node. It detects collisions inside the batch. Only targeted `planningSchedule` fields and retired legacy schedule aliases change. One failure rolls the complete transaction back. Captions, titles, media, approval data, publication records, provider state, unrelated nodes and Board metadata remain intact.

The response is bounded snake_case authority: result code, correlation ID, new Board revision, allowlisted per-node schedule projections/revisions, and counts. It never returns a Board, caption, media, provider identifiers/URLs, tokens, encrypted values, or raw errors.

## Client reconciliation, rollback, concurrency and Undo

Apply freezes the preview, resolves current nodes, rechecks Board lifecycle/revision/access, computes current v2 fingerprints, and sends exactly one request. No optimistic canonical write occurs. A validated identity-complete response replaces schedules in one local authoritative snapshot without a full reload. Malformed, incomplete, stale or uncertain responses leave prior authority and the proposal preview intact.

A complete-plan Undo uses the same batch boundary with the returned Board and schedule revisions and the exact captured prior schedules. It is bounded by the existing Undo window and invalidated by later authority; therefore it cannot overwrite newer work. The server revalidates every lock and rolls back as one unit. Failed Undo retains the applied authority.

Diagnostics allow only correlation/lifecycle categories, bounded counts/stages/result codes, revision presence and elapsed category. IDs, content, media and provider data are prohibited.

## Deployment and rollback

No database migration is required: schedules remain in `boards.canvas_json` under the existing canonical shape. Deploy the engine/browser asset, route, contract, service and UI together. Rollback removes the new route and client surface; existing canonical schedules remain valid and untouched.

## Acceptance procedure

Use a Board containing eligible unscheduled, scheduled and locked posts. Open Auto-plan and verify immediate weekday/one-per-day/four-week distribution; change weekdays, time slots and channel filters; move, retime and backlog a proposal; verify no write; cancel and verify no request. Reopen and apply once; verify one batch request, one atomic reconciliation and no Board reload. Undo and verify the entire prior schedule set returns. Force stale authority and a one-command validation failure; verify zero partial writes and a retained preview. Repeat as viewer, in English/German, light/dark, desktop/mobile and keyboard-only. Network inspection must show no provider request.

## Non-goals

CSV export, provider scheduling/publishing, recurrence, automatic publishing, engagement/AI recommendations, provider review work, automatic replanning and modification of publication material or approval state are explicitly excluded.

## BW-35.3R1 — Auto-plan studio presentation repair

### Root-cause analysis

The BW-35.3 studio was emitted by `renderCalendar` as the final child of the Content Calendar section. Although the studio itself used `position: fixed`, it remained owned by the calendar DOM and its stacking context. The calendar toolbar was sticky, the backlog and calendar surfaces had their own layered descendants, and the studio used `z-index: 45` while portal-owned drawers, sheets, and toasts used four- and five-digit layers. This made the result dependent on ancestor stacking contexts and allowed calendar chrome to paint above it. The sheet also began below a hard-coded 72 px offset without a bounded height or a header/body/footer grid. One `overflow:auto` on the complete aside made header and actions scroll away, while its token surface was not explicitly isolated from the backdrop-filtered calendar chrome.

The markup compounded the defect: the detached `Proposed` label preceded the heading; settings, summary, and a complete proposal-card collection shared one undifferentiated grid; weekday controls used a wrapping flex row; date/rhythm controls used unconstrained flex children; and toolbar order placed a minimally styled text action after Display options. Every workspace render replaced the calendar-owned studio node, so lifecycle ownership and focus restoration were implicit rather than reliable. No ancestor transform was required to reproduce the defect, and the markup was syntactically valid; the primary causes were the wrong DOM owner, incompatible layer scales, incomplete height/overflow containment, and insufficiently structured responsive CSS.

### Portal ownership and lifecycle

R1 gives Auto-plan its own `data-calendar-auto-plan-portal` node appended directly to `document.body`. It is distinct from the detail-drawer and quick-scheduling portal nodes. Creation checks `document`, `createElement`, `body`, and `appendChild` capabilities so BW-35.2R3CI bounded document doubles still boot. Cleanup uses the retained portal reference first and only uses selector APIs when supplied; a capable browser additionally removes every stale matching node before mounting the sole current instance.

The Content Workspace owns the portal. Board/access lifecycle changes, reset, unmount, cancel, successful apply, and render failure remove it. Opening Auto-plan closes an active detail drawer or quick-scheduling sheet before mounting. Portal remounts preserve the proposal session and the calendar's authoritative snapshot, projection preferences, current period, filters, and scroll owner. Opening creates no schedule or provider request. Apply still uses exactly the existing single atomic batch command and successful apply still installs the returned authority before closing.

### Desktop, tablet, and mobile behavior

Desktop Auto-plan is a fixed, opaque, isolated 420–480 px right sheet above calendar chrome, backlog, popovers, toasts, and drop targets. Its outer layer ignores pointer events while the sheet accepts them, so the visible calendar remains interactive and no desktop backdrop or focus trap is applied. A three-row grid owns a sticky header, independently scrolling body, and sticky action footer. The trigger is retained and receives focus after Cancel, successful Apply, or Escape.

Tablet uses a wider sheet up to 520 px without squeezing the calendar into a second layout. At 640 px and below, the portal becomes an opaque full-screen modal layer with `100dvh`, safe-area header/footer padding, body scroll locking, bounded horizontal overflow, Escape handling, and a Tab/Shift+Tab focus loop. Cleanup restores the prior body overflow value and trigger focus.

### Toolbar and information hierarchy

Auto-plan is now the primary calendar action: a semantic button with a repository-owned sparkle SVG, filled Tendra gradient, elevation, visible localized label, and a badge capped at 99. Navigation and view controls remain first; Auto-plan is visually stronger than the secondary Filters and Display options controls; timezone remains compact context. On mobile the primary action occupies a full toolbar row without horizontal scrolling. Editors retain a disabled entry plus localized explanation when no unscheduled posts exist; viewers receive no mutation action.

The studio header combines the icon, `Auto-plan` / `Automatisch planen`, supporting copy, compact preview-state badge, and integrated 44 px close control. The body begins with five compact metrics: proposed, eligible, preserved, excluded, and unplaced. Settings are divided into Planning range, Active days, Posting rhythm, and Channels. Dates use two bounded columns and stack on phones. All seven localized weekday toggles use a single seven-column grid, full weekday accessible names, restrained selected styling, and explicit focus treatment. Time slots are bounded chips with removable additional slots; maximum capacity stays inside its grid; minimum spacing is behind progressive disclosure. Channel choices reuse the R9 local icon and accent system with visible labels, counts, and pressed state.

Results contain only compact counts and expandable excluded/unplaced lists—never ordinary backlog cards, thumbnails, captions, Schedule, or Details actions. Regenerate stays in the results heading. The opaque sticky footer always provides Cancel preview and Apply plan; its pending label is contained without changing footer dimensions.

### Proposal preview, accessibility, and layer scale

The existing indexed calendar projection remains singular. While a proposal session exists, its minimal ID-to-schedule map is read as a temporary projection overlay; the immutable Board snapshot is not rebuilt or written. Proposed calendar cards reuse the R9 channel icon/accent and receive a compact Proposed badge plus dashed/dual border, making them distinct from persisted schedules. There is no second calendar or duplicate proposal-card collection in the studio.

Desktop exposes the sheet as a labelled non-modal region and leaves the calendar visible and operable. Mobile supplies modal-equivalent backdrop, focus containment, body scroll lock, and focus restoration. A polite summary live region announces generated counts. Semantic inputs/buttons, full weekday labels, focus-visible outlines, reduced-motion rules, forced-color borders, light/dark surface tokens, safe areas, and no-horizontal-overflow containment are explicit.

The calendar layer scale is centralized in CSS: content `0`, sticky chrome `12`, popovers `30`, toast `10020`, Auto-plan `10040`, quick scheduling `10050`, detail drawer `10060`, and mobile modal `12000`. Auto-plan proactively closes conflicting opaque side sheets; detail and quick-scheduling portals never share its node.

### Deployment, rollback, and manual acceptance

Deploy `content-workspace.js`, `styles.css`, the R1 regression, package script, workflow registration, and this document together. There is no migration, provider configuration, proposal-engine version change, or batch-contract change. Rollback removes the R1 portal/presentation layer and its check while leaving BW-35.1 canonical schedules, BW-35.3 deterministic planning, atomic persistence, and Undo untouched.

Manual acceptance:

1. Open Content Calendar on desktop and confirm Auto-plan is the prominent primary action before the secondary Filters/Display options context.
2. Open it and confirm an opaque right sheet with no toolbar, backlog, card, or calendar text bleeding through.
3. Scroll the body independently; confirm the header and Cancel/Apply footer stay visible.
4. Confirm seven weekdays fit; date, time, capacity, additional-time, and channel controls remain bounded.
5. Confirm the summary and expandable exception lists do not duplicate full backlog cards.
6. Continue using the visible calendar, inspect differentiated proposed cards, adjust a proposal, and regenerate without period/filter/scroll resets or writes.
7. Close with the button and Escape and confirm focus returns to Auto-plan.
8. Reopen and Apply; inspect the network log for exactly one internal batch request and no provider request.
9. At mobile width, confirm full-screen presentation, focus containment, body scroll lock, safe-area footer, and no horizontal overflow.
10. Repeat in English/German, light/dark, reduced motion, and forced colors.
11. Confirm viewers cannot invoke Auto-plan and an editor with no eligible work sees the disabled explanatory state.
12. Run the declared Runtime Boot Safety workflow and verify the R1 check immediately follows BW-35.3.

## BW-35.3R2 — Apply transaction and session persistence repair

### Verified root cause and ruled-out hypotheses

Repository tracing established a two-part client defect. First, the active proposal object owned only the planner result, while every edited date, weekday, time, capacity, spacing, and channel value lived only in portal inputs. `applyAutomaticPlanning` set `pending` and immediately called the workspace renderer. R1 correctly rebuilt the body portal on that render, but `renderPlanningStudio` repopulated it from the original `p.result.settings`; therefore the visible fields jumped to defaults before preflight. Regenerate happened to scrape the old portal immediately, but Apply did not, so configuration had no durable session owner.

Second, the prior Apply path treated an optional callback and a loosely shaped success object as sufficient authority. It had no guarded exception boundary, no post-await Board-lifecycle check, incomplete response identity/revision validation, and no in-studio failure state. A rejection or malformed/obsolete response could consequently become silent, while the pending render had already erased DOM-only edits. The Apply button itself was `type="button"` and had a direct listener, so a missing listener and native submission were ruled out as primary causes. The server already used one row lock, one transaction, strict fingerprints/revisions, and rollback; no database or server atomicity defect was found. The R1 portal ownership and CSS design were also not causes.

The historical R1 regression used `[^}]+` between successful session clearing and portal cleanup. R2 diagnostics legitimately insert bounded object literals there, so that scope-only assertion now uses a non-greedy cross-line match. Its actual ordering assertion remains unchanged.

### Corrected ownership and state machine

The proposal session wrapper is now the single explicit owner of normalized `settings`, the generated result/session, `pending`, bounded `status`, and localized `error`. Defaults are created only by `openAutomaticPlanning` for a new proposal. Every control change copies normalized values into session settings; portal and calendar renders read those settings rather than the DOM or the original result. Regeneration consumes the owned settings and atomically replaces the generated proposal. Apply captures and validates the last rendered values at its boundary before entering pending state. Recoverable failure retains settings and proposal; cancel, success, Board/access lifecycle invalidation, reset, and unmount clear them deliberately.

The bounded Apply states are `ready → preparing → applying → success`, with `failure` returning to an enabled attempt and `stale` requiring regeneration. The direct portal listener prevents default and propagation, the portal also prevents native submit, and the synchronous `pending` guard makes rapid clicks single-flight. Preparing/applying keep the proposal overlay and cards mounted, expose an item-count progress label through a polite live region, preserve footer dimensions, block Escape cleanup while pending, and use reduced-motion-safe token styling. Disabled Apply exposes a localized explanation.

### Exact preflight and transaction boundary

Immediately before dispatch the client verifies the current immutable snapshot's Board identity, revision, lifecycle generation, access, and every proposal identity. Each node is re-resolved by stable ID from current authority; scheduling eligibility, absence of an intervening schedule, editorial status, and proposal/result settings freshness are checked. Any missing or changed item rejects the whole proposal as stale—commands are never silently filtered. The App boundary then re-resolves every node from current application authority and computes each v2 publication-material fingerprint from that current node.

Exactly one strict `posting_schedule_batch_v1` PUT is sent for Apply and exactly one for complete-plan Undo. It carries the Board revision plus every proposal command's node identity, expected schedule revision/editorial status, current fingerprint, and canonical local date, local time, IANA timezone, and DST disambiguation. There is no per-post request and no Board refetch.

### Response validation and reconciliation

The authoritative route now echoes the validated Board identity. Before any client mutation, the App validates lifecycle/Board continuity, response contract, Board identity, changed Board revision, requested/updated counts, unique and complete node identities, exact schedule-revision advancement, and returned canonical schedule fields. The workspace independently validates the identity-complete schedule set and revision advancement. Only then does it construct and install the next immutable R8 Board snapshot, one node replacement at a time under the returned Board revision. Month, Week, and List therefore read the same reconciled snapshot; scheduled/unscheduled counts update in the same render. Proposal overlays and the Auto-plan portal are removed only after validation and reconciliation. The localized toast includes the applied count, and Undo retains every returned authoritative revision and uses one atomic batch.

### Failure and lifecycle preservation

Network, storage, permissions, publication lock, stale revision, temporal conflict, identity mismatch, malformed response, and unexpected client failures map to bounded categories. Failure restores Apply, keeps the portal open, retains all settings, and preserves the proposal unless authority proves it stale. Identity mismatch is not classified as publication lock. No response mutates partial authority: response validation precedes the mutation loop. A late response checks both retained context identity and Board generation and cannot affect a newly opened Board. Portal cleanup remains scoped to `data-calendar-auto-plan-portal`, idempotent, focus-restoring, body-scroll-safe, and separate from drawer/quick-scheduling portals.

### Diagnostics and privacy

Allowlisted stages cover click receipt, preflight start/completion, fingerprint preparation start/completion, batch dispatch, response receipt/validation, immutable reconciliation, bounded failure, and portal cleanup. Records include only stage, bounded error category, count, lifecycle generation, and a sanitized correlation identifier. Captions, media URLs, destinations, fingerprints, tokens, provider payloads, and request/response bodies are never logged.

### Deployment, rollback, and manual acceptance

Deploy the workspace, App dispatcher, authoritative route, state CSS, regression, Runtime Boot Safety registration, and this document together. No migration, provider configuration, dependency, or build change is required. Rollback those R2 files as one unit; already persisted canonical schedules remain compatible.

Manual acceptance:

1. Open a writable Board in each calendar view; open Auto-plan and change dates, weekdays, two custom times, capacity, spacing, and channels.
2. Regenerate, navigate/rerender the calendar, and confirm every setting and proposal survives.
3. Apply once and rapidly double-click; confirm one internal batch PUT, stable count-based progress, retained overlay while pending, then immediate Month/Week/List schedules and counts.
4. Confirm the portal closes only after reconciliation, the success toast reports the exact count, and complete-plan Undo sends one atomic PUT.
5. Repeat with offline/server failure; confirm the studio, proposal, settings, focus/scroll ownership, and enabled retry remain.
6. Force Board revision conflict and confirm explicit regenerate feedback; return malformed/identity-mismatched authority and confirm no client authority changes and no publication-lock wording.
7. Switch Boards while a response is pending and confirm the late response cannot mutate the new Board.
8. Repeat in English/German, dark/light mode, mobile, keyboard-only, and reduced motion.
9. Inspect network traffic and confirm zero Facebook, LinkedIn, Meta, CDN, or other provider requests and zero real publication mutations.

## BW-35.3R3 — Semantic freshness and safe rebasing

### Proven root cause

R2 used Board revision and lifecycle generation as a binary proxy for proposal freshness. `renderCore` destroyed an open proposal whenever the incoming context revision string differed from the previously installed calendar snapshot, and Apply required exact string equality for the snapshot revision and lifecycle before dispatch. The App repeated exact string comparison against `state.lastKnownUpdatedAt`. Consequently an equivalent refreshed/cloned Board (including equivalent timestamp spellings) could be rejected before any semantic target comparison; the catch path then called `session.invalidate("")`, permanently disabling Apply. Refresh did not help because it replaced the snapshot/generation that the proposal later compared by identity-like lifecycle/revision tokens, rather than establishing a semantic compatibility record.

Contributing factors were provenance split between the planner session, generated result, current context, and mutable portal controls; pending-render reconstruction occurring before the old broad preflight; and all authority conflicts being presented with one stale message. Ruled out by code trace and deterministic regression were portal listener loss, DOM/object reference comparison, fingerprint producer disagreement as the initiating fault, multiple Apply dispatches, server transaction partiality, and provider traffic.

### Semantic provenance and freshness contract

The Auto-plan session now owns one immutable `auto_plan_provenance_v1` record: normalized Board ID/base revision; lifecycle/access generation for diagnostics; stable target IDs; canonical schedule and schedule revision per target; editorial eligibility/publication-lock state; material identity; sorted eligible IDs; relevant existing canonical schedules and capacity inputs; normalized configuration; and a deterministic canonical command identity. Undefined optional visual fields, property order, clones, localized labels, portal/calendar renders, overlays, filters, and display preferences are excluded.

Freshness has four outcomes:

* `current`: normalized Board revision and all proposal-relevant invariants match.
* `safe_rebase`: only the authoritative revision/generation or unrelated metadata changed. Apply retains Preview ready and uses the latest normalized Board revision and current target revisions/material.
* `requires_regeneration`: target schedules, collisions/existing schedules, eligible set, editorial/material state, capacity, or a newly finalized target changed. Configuration and proposal remain visible, the header becomes **Update needed / Aktualisierung nötig**, a bounded reason is shown, and Regenerate is primary.
* `blocked`: Board switch, access loss, missing target, durable publication lock, missing provenance, or invalid configuration prevents safe in-place application.

Apply captures the session once, guards duplicate clicks synchronously, resolves current authority, classifies before pending render, and dispatches exactly one complete `posting_schedule_batch_v1` request only for `current` or `safe_rebase`. Network/storage/malformed-response failures return to Preview ready with retry enabled; they do not semantically stale the proposal. Reconciliation still occurs only after an identity-complete authoritative success.

### Browser/server parity and batch taxonomy

Board revisions are normalized to ISO instants in provenance and at the App dispatch boundary. Stable IDs are strings; schedule revisions are integers; schedules retain canonical local date/time, IANA zone, DST disambiguation and resolved UTC instant. Canonical object ordering distinguishes absent optional display data from material inputs without making visual projection fields authoritative. Browser dispatch still computes the shared v2 publication-material fingerprint from current authoritative nodes; the fingerprint is never logged or displayed.

The strict endpoint allowlist and service continue to distinguish malformed request, authentication/edit authorization, Board revision conflict, schedule revision conflict, material fingerprint conflict, missing/invalid target, editorial conflict/ineligibility, finalized publication, temporal validation, collision, and storage failure. It retains one transaction and one `FOR UPDATE` Board lock, exact command coverage, all-or-nothing persistence, and bounded response fields.

### Privacy-safe diagnostics and transitions

Diagnostics now cover provenance capture, refreshed snapshot receipt, classification start/result, safe rebase, regeneration category, preflight completion, batch dispatch, server failure category, and reconciliation. Only allowlisted stage/classification/reason categories, bounded counts, lifecycle generation, and sanitized correlation IDs are emitted—never captions, media URLs, nodes, fingerprints, schedule bodies, provider identifiers, tokens, or server responses.

State transitions are `ready → preparing → applying → success` for current/safe-rebased proposals, `ready → stale → ready` after required regeneration, and `ready → applying → ready` for recoverable transport failures. Configuration survives stale and retry paths. Successful authoritative reconciliation alone closes the studio.

### Deployment, rollback, and manual acceptance

Deploy `automatic-planning.js`, `content-workspace.js`, `app.js`, the R3 regression/package/workflow registration, and this documentation together. No migration, dependency, provider configuration, or full-Board-refetch workaround is required. Rollback these R3 files together; canonical schedules and the R2 atomic endpoint remain compatible.

Manual acceptance: refresh Content, open Auto-plan, configure and generate, then Apply and verify one batch PUT and immediate authoritative reconciliation. Repeat while replacing the Board with an equal clone and with a newer revision containing only unrelated metadata; Preview ready must remain and the request must use the newest revision. Then independently change a target schedule, eligible set, editorial/material state, existing collision, capacity, and publication lock; verify bounded Update needed/blocked messaging, preserved controls, no request, and successful regeneration from current authority. Test rapid double click, offline retry, English/German, desktop/mobile, dark mode, keyboard focus, and reduced motion. Network inspection must show zero Facebook, LinkedIn, Meta, Instagram, TikTok, X, CDN, or other provider requests and zero real publication mutations.
