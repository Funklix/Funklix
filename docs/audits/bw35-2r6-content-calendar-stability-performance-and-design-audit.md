# BW-35.2R6 — Content Calendar stability, performance, architecture, and design audit

**Audit date:** 2026-09-23
**Scope:** documentation-only repository audit after BW-35.2R5. No fix is implemented here.
**Evidence vocabulary:** **proven** means directly established by repository code or a repeatable repository command; **likely** is the best code-supported explanation but still needs a browser trace; **possible** is a bounded hypothesis; **recommendation** describes future work.

## 1. Executive conclusion

The Content Calendar is not freezing because drag-and-drop is intrinsically difficult. The strongest **proven** main-thread hazard is synchronous timezone resolution: browser `resolveLocalDateTime` scans a 36-hour window one minute at a time and constructs/formats dates through `Intl.DateTimeFormat` for **2,161 iterations per call**. `readPlanningSchedule` invokes it for each canonical schedule, and the render/projection path invokes schedule reading repeatedly. A drag start and drop each rebuild the complete posting-plan projection; a reconciliation replaces the complete Content Workspace through `host.innerHTML`. With several scheduled cards, this multiplies thousands of expensive `Intl` calls, sorting/filtering and HTML construction on the event task. The `requestAnimationFrame` introduced by R5 occurs only *after* drop validation, record projection, optimistic DOM movement and feedback. It cannot make the synchronous work before it yield. This is a credible, repository-proven path to Chrome's “page unresponsive” state.

The broken pending treatment has an exact cause. `paintOptimisticCard` appends the text **Saving change…** in a `<span role="status">`; CSS applies `calendar-pending-spin` to **every** `[role="status"]` inside a pending card, rotating the entire text through 360 degrees. Two later pending rules also stack an outline and a `box-shadow` ring. The inline pill participates in card flow, so it competes with compact title/metadata in a constrained cell and changes dimensions. The observed diagonal text, collision, and oversized halo are therefore expected from current code, not a screenshot anomaly.

The “Finalized publication — locked” response is not a generic mapping of every conflict. The route/service emit `publication_finalized` only for editorial `Scheduled`/`Published` or a matching durable terminal external-post/job row, and the client maps only that failure category to `PUBLICATION_FINALIZED`. Stable node IDs are used from dataset through request and locked-row lookup. The strongest supported explanation is a **real server-discovered publication lock absent from the loaded Board snapshot**, which R5 itself acknowledges and then caches in memory. The repository does not prove that the production request targeted the intended visual card; a correlation-safe trace containing hashed/ordinal identities is required to rule out malformed or duplicate DOM identity. It also does not prove the durable row was correct; a bounded database diagnostic is required.

R5 reduced one source of full renders, but retained an architecture in which a post may simultaneously exist as the Board node, projected asset, posting-plan record, optimistic schedule overlay, moved DOM node, pending request/reservation, queue closure, runtime publication-lock overlay, and Undo snapshot. The queue serializes every Board write but is a growing promise chain, is not cancelled on unmount, does not coalesce superseded intents, and can retain prepared payload closures until earlier network work settles. It yields while awaiting fingerprint/network, so no synchronous recursive pump is proven; nevertheless it adds lifecycle and reconciliation complexity without solving the dominant synchronous projection cost.

**Recommendation:** retain one immutable authoritative Board snapshot, one memoized derived calendar projection, one bounded interaction overlay keyed by node ID, and one Board-scoped single-flight writer with at most one coalesced latest intent. Retain the server transaction, row lock, authorization, revisions, fingerprint and publication protection. Remove DOM-as-state, the unbounded promise-tail queue, duplicated schedule validation/projection, legacy scheduling aliases after a measured migration window, and full-workspace reconciliation. Pending becomes a fixed-position/icon slot (dot or spinner) with an off-screen live label, never rotating text or changing card dimensions. BW-35.3 automatic planning and CSV export remains paused until the acceptance criteria in §22 pass.

## 2. Current architecture map

```text
Board load -> app state.nodes + state.lastKnownUpdatedAt
           -> renderContentWorkspace context
           -> content-workspace project(all operational nodes)
           -> collectPostingPlan(Social Media Posting nodes)
              -> projectAsset -> readPlanningSchedule -> resolveLocalDateTime
              -> optimisticSchedules overlay
              -> schedulingEligibility -> publicationLockProjection
           -> filters + sort + scheduled/backlog/blocked projections
           -> Month | Week | List HTML + backlog + optional drawer
           -> host.innerHTML replacement -> bind every rendered element

native drag event -> dataset node ID -> collectPostingPlan again
drop -> collectPostingPlan again -> deriveDropSchedule
     -> calendarMutations reservation + optimisticSchedules entry
     -> physically move existing card + append pending text
     -> requestAnimationFrame
     -> app enqueuePostingScheduleMutation promise tail
     -> live node/readiness/status/schedule/eligibility re-resolution
     -> cached v2 fingerprint promise
     -> PUT /api/boards/:id/posting-schedule
     -> transaction + Board row lock + revision/material/status checks
     -> durable publication-row checks + whole canvas_json serialization
     -> client node/revision reconciliation
     -> overlay/reservation cleanup -> complete workspace render
     -> seven-second Undo record/timer -> another complete render on expiry
```

The authoritative persistence route is narrow, but the browser feature shares a 128 KB, 169-physical-line Content Workspace module with library, approval, provider publication, engagement, dialogs and calendar behavior. Compact physical lines conceal the actual size.

## 3. Current state-authority inventory

### 3.1 Authorities and representations

There are **three actual schedule authorities** in the current runtime and at least **nine simultaneous representations/coordination records**:

| Layer | Mutable? | Authority status | Lifetime / risk |
|---|---:|---|---|
| Locked database Board `canvas_json` node | yes, transactionally | Durable authority | Server Board lifetime. |
| Browser `state.nodes[]` node | yes | Loaded client authority between responses | Mutated in place after success; may be older than durable publication tables. |
| `node.planningSchedule` | yes | Canonical schedule field inside both snapshots | Legacy `social.*` aliases remain readable. |
| `projectAsset` result | no by convention | Derived copy | Recomputed widely; includes another schedule projection and fingerprint. |
| `postingPlanRecord` | no by convention | Derived copy | Recomputed for render and drag handlers; overlays optimistic schedule. |
| `optimisticSchedules` map | yes | Temporary visual override | Duplicates/nulls canonical schedule by node ID. |
| Physically moved DOM card | yes | Temporary presentation state | Can disagree with both projections until full render. |
| `calendarMutations` and app `postingScheduleRequests` | yes | Two pending/reservation authorities | Same mutation is represented in both modules. |
| App promise-tail queue and depth | yes | Board write ordering authority | Closures retain prepared intents until settled. |
| `finalizedPublicationByNode` | yes | In-session lock overlay | Combines publication result cache and scheduling lock discoveries. |
| `calendarState.undo` plus timer | yes | Temporary inverse-command authority | Holds previous schedule; one global slot. |

Thus pending state exists in at least five places: optimistic map, calendar reservation, app request set, queue/depth, and DOM classes/marker. A post can appear twice in generated collections when a stale DOM card is moved while the projection still contains its prior schedule; `paintOptimisticCard` explicitly removes duplicate matching cards as a defensive repair. Full render eventually overwrites all card-scoped DOM work.

### 3.2 Reduced authority model

Keep exactly:

1. immutable `boardSnapshot` `{boardId, revision, nodes}`;
2. one derived `calendarProjection`, calculated once per snapshot/preferences change and indexed by node ID;
3. one bounded `interactionByNode` map containing only `{desiredSchedule, phase, operationId, error?}` (maximum one entry per affected node, cleared at terminal state);
4. one Board-scoped writer `{active, latest}`;
5. one UI preferences value and one bounded feedback/Undo slot.

The server remains durable authority. The browser snapshot is the sole client authority. DOM nodes, queue promises, lock caches and duplicated request sets must not become additional authorities.

## 4. Reproduction evidence from the screenshots

The screenshots are described in the production report but are not stored in this repository, so pixel geometry and DevTools state cannot be independently measured here. The visible facts are consistent with code:

* The diagonal **Saving change…** matches the pending span selected by the rotating `[role="status"]` rule.
* The large outline matches simultaneous `outline` and `box-shadow: 0 0 0 2px` pending rules.
* Collision matches an appended inline pill inside a compact card whose title is single-line and caption can occupy two lines.
* A pending card plus a saving toast matches duplicated card-level and workspace-level feedback.
* Multiple scheduled/backlog/blocked cards maximize repeated schedule validation and projection immediately before/after the hang.
* The rollback wording is generated only after a failed canonical result and complete render. It establishes the category presented by the client, not whether the durable row was semantically correct.

No real IDs, captions, provider IDs or URLs are needed to reproduce these structural conditions.

## 5. Runtime freeze analysis

| Hotspot (exact function/file) | Trigger and frequency | Complexity / yield | Failure mode | Evidence and confidence |
|---|---|---|---|---|
| `resolveLocalDateTime`, `content-workspace.js` | Every canonical `readPlanningSchedule`, dialog validation and drop derivation | Fixed 2,161-minute loop; each iteration calls `Intl.DateTimeFormat(...).formatToParts`; entirely synchronous | Multi-second long task when multiplied across records/renders | Loop is explicit. **Proven, very high.** |
| `readPlanningSchedule` via `projectAsset`, `postingPlanRecord`, `resolveCurrentContentNode`, writer guards | Once or multiple times per node per render/mutation | `O(2161 × scheduled reads)` plus fingerprint work; no yield | Repeated timezone normalization dominates main thread | Direct calls are explicit. **Proven, high.** |
| `collectPostingPlan` in `dragstart` and `drop` | Whole collection on each start and accepted drop | `O(N)` projections, but each scheduled node pays timezone scan; no yield | Drag gesture itself can block before R5's rAF | Handler code is explicit. **Proven, high.** |
| `render` / `renderCalendar` | view/filter input, drawer, rollback/success, Undo expiry, refresh | Full operational projection + calendar projection + sort/filter + string HTML + `host.innerHTML`; no yield | DOM destruction, listener rebinding, focus loss, long layout/style work | Complete replacement is explicit. **Proven, high.** |
| `renderWeek` | Week render | 24 × 7 cells, each filters all records: `O(168N)`, plus HTML | Scales poorly and allocates many strings | Nested `hours.map(days.map(records.filter))`. **Proven, high.** |
| `renderMonth` | Month render | 42 cells with per-cell filtering: `O(42N)` | Avoidable repeated scan | Implementation filters records per cell. **Proven, high.** |
| `contentWorkspaceIdentity`, `app.js` | Shell workspace render/identity checks | Serializes selected fields, including social/images, for every node; `O(Board payload)` synchronous | Large Board serialization adds long-task pressure | `JSON.stringify(state.nodes.map(...))`. **Proven, medium-high.** |
| `paintOptimisticCard` | Once per accepted mutation | Query all duplicate cards, class/attribute changes, DOM reparent, marker insertion; no read-after-write layout | Style/layout invalidation, DOM/projection divergence | Explicit; no forced geometry read found. **Proven, medium.** |
| `afterOptimisticPaint` | Once per accepted mutation | One rAF (or timer fallback), yields only after all preceding work | Does not protect drag/drop prework; background tabs may delay rAF | Ordering is explicit. **Proven, high.** |
| `cachedPostingScheduleFingerprint` | Once per uncached material key | promise microtask then async SHA; cache max 64 | Adds work, but does yield through promise; rejected entries removed | Explicit. **Proven low freeze risk.** |
| `enqueuePostingScheduleMutation` | Every mutation | Promise-chain continuation per queued intent; network/fingerprint awaits yield | Long chain retains closures and stale intents; no synchronous recursive loop proven | Explicit `.then` chain. **Proven retention; low confidence as direct freeze cause.** |
| Success/failure/Undo reconciliation | Terminal mutation and 7 s later | Complete render each; synchronous | Burst of repeated normalization/DOM replacement | Explicit calls. **Proven, high.** |
| `dragover` | Many times per second | `preventDefault`, repeated class add and live-region `textContent`; no projection/render/storage/fingerprint | Accessibility announcement spam and repeated style invalidation; not by itself the dominant CPU loop | Handler is bounded. **Proven, medium.** |

No `MutationObserver`, `getBoundingClientRect`, synchronous layout read, synthetic event dispatch, or animation-frame loop exists in the audited calendar code. No direct recursive `render -> bind -> render` occurs merely during binding. However, `loadFacebookEngagement` can call `rerender`, its completion rerenders again, and each complete render re-runs engagement discovery; request/attempt guards bound this path. No infinite loop is proven. The freeze can arise without one: repeated large finite synchronous tasks are sufficient.

## 6. Drag/drop event-frequency analysis

* **`dragstart` (once):** resolves the dragged ID from `dataset`, calls full `collectPostingPlan(...).find`, writes `calendarState.drag`, logs, mutates class and live region. The collection call is inappropriately heavy.
* **`dragenter`:** no handler is registered.
* **`dragover` (browser-frequency, often tens per second):** every date/time cell calls `preventDefault`, `classList.add` and rewrites the assertive live region even when the target/message did not change. Backlog does the same class work. There is no render, storage write, projection, fingerprint or geometry read here. It should still be idempotent: update only when target identity changes and announce at most once per target.
* **`dragleave` (repeated):** removes one class. Child-boundary churn may flicker because related-target containment is not checked.
* **`drop` (once):** synchronously rebuilds all records, derives/validates schedule (including the expensive timezone scan), mutates overlay/DOM/feedback, and only then awaits rAF.
* **`dragend` (once):** clears drag and scans every `.is-drop-target` to remove its class.

Target state should be a single `activeDropTarget` reference/ID. `dragover` should do only `preventDefault` plus a guarded target transition. Projection, schedule resolution, storage, serialization, render and network preparation belong to `drop` or later, never pointer-frequency handlers.

## 7. Render and DOM-churn analysis

`render` projects **all** operational assets even in Calendar mode, applies Library filtering that Calendar does not consume, then independently collects/project posts again in `renderCalendar`. A Social Media Posting can therefore be normalized and schedule-validated at least twice per complete Calendar render before subsidiary renderers re-scan it. Month and Week group by repeated filters rather than a precomputed `Map<date/hour, records>`.

Every complete render removes the drawer portal, replaces the entire host via `innerHTML`, binds handlers by repeated `querySelectorAll`, then may move the newly generated drawer to `body`. Card-scoped optimistic movement is therefore genuinely local only until success/failure/Undo causes a full render. That final render recomputes canonical and optimistic projections and destroys the moved node. The defensive removal of duplicate cards confirms that DOM identity can temporarily diverge.

There are no virtualized lists, keyed DOM reconciliation, normalized-record memo, schedule-resolution cache, or date bucket index. `calendarState.search` rerenders on every input event. Filter/display changes and many clicks also reconstruct everything. This is accidental architecture complexity rather than required product behavior.

## 8. Mutation queue analysis

### 8.1 Exact R5 lifecycle

1. Calendar rejects a non-editable or already-reserved node.
2. It reserves the node in `calendarMutations`, writes `optimisticSchedules`, moves the DOM card, appends pending UI and awaits one paint.
3. It re-resolves the live node and prepares a payload.
4. App appends a closure to global `postingScheduleQueueTail`, increments a capped *displayed* depth (actual queued promises are not capped), and captures `boardLoadGeneration`.
5. When prior tail settles, rejection is swallowed; generation is compared, then work dispatches or returns `BOARD_CHANGED`.
6. Dispatch re-resolves node/access/status/readiness/schedule, checks app request reservation, calculates/reuses fingerprint, sends one PUT with the latest Board revision at **dispatch time**, reconciles node/revision on success, and clears app reservation in `finally`.
7. Queue `finally` decrements depth. Calendar checks its mutation token/context, clears overlays, installs an in-session lock on finalized failure, fully renders, and creates Undo only after success.

### 8.2 Properties

* **No synchronous recursive pump is proven.** Promise continuations run serially and fingerprint/fetch await external completion.
* Failure does not poison later work because `queued.catch(()=>{})` precedes each next operation.
* Same-node duplicate enqueue is normally blocked in Calendar, but the quick scheduler reaches the app queue without the Calendar reservation; app reservation is checked only when dispatch begins. Identical same-node commands can therefore both sit in the queue, with the later one eventually failing stale validation rather than being coalesced.
* Superseded intents are not removed. Rapid different-node actions all execute; rapid same-card Calendar actions are blocked rather than recording latest intent.
* Generation prevents dispatch after a Board switch, but queued closures remain retained until earlier work settles. `unmount` does not reset the app queue/tail/cache/request set. Calendar `unmount` does not clear optimistic maps, mutations or Undo timer; `resetCalendar` does, but unmount itself does not call it.
* A fetch with no timeout can keep the queue active indefinitely and block all later schedule writes. This is head-of-line blocking, not a formal deadlock; a never-settling fetch makes it operationally equivalent.
* Early return on calendar token/context mismatch occurs before cleanup in `applyCalendarMutation`; Board reset normally clears maps, but an unmount without reset can retain entries.
* No stale DOM node is held by the app queue, but calendar state stores `drawerTrigger`, and mutation closures capture `host`, context and record objects.

### 8.3 Architecture comparison

| Option | Merits | Costs / verdict |
|---|---|---|
| Current serialized promise queue | Preserves Board revision order | Unbounded actual chain, head-of-line blocking, no coalescing/cancel, duplicate state. **Retire.** |
| One active + one coalesced latest intent | Bounded memory/work; dispatch latest after new revision | Must define replacement semantics. **Recommended**, Board-scoped; coalesce by node, latest user intent wins. |
| One active + all subsequent actions temporarily queued in memory | Easy semantics | Recreates unbounded queue and executes obsolete actions. Reject unless hard bounded to one. |
| Server atomic revision retry | Can reduce benign conflicts | Silent retry risks applying intent to changed material/state. Do not add; explicit authoritative validation remains. |
| Pessimistic persistence + drag ghost | Simplest reconciliation | Feels slow and sacrifices immediate intent feedback; useful emergency fallback only. |
| Optimistic per-card + minimal authoritative writer | Responsive and local | Correct when combined with one-active/one-latest writer and one overlay. **Recommended target.** |

Rapid moves: while one Board write is active, accept at most one `latest` intent (replace the previous queued intent, announce replacement); render overlays per affected node; after success, install the returned revision then dispatch latest after fresh validation. On uncertain/network outcome, do not dispatch latest until explicit authoritative refresh. Unrelated UI never blocks.

## 9. False-finalization analysis

### Proven findings

* Drag identity uses `data-calendar-card` node ID, not an array index. Drop re-finds by stable ID. Request body sends that ID. Server locked Board lookup and durable publication queries use the same ID plus Board ID.
* Optimistic records do not replace the authoritative node; they override only `schedule` in `postingPlanRecord`.
* Server returns `publication_finalized` only after the node is resolved and only for editorial `Scheduled`/`Published`, a matching terminal `social_external_posts` row, or a matching terminal/delivering `social_publish_jobs` row.
* Client maps only `raw.failure_category === 'publication_finalized'` to `PUBLICATION_FINALIZED`; Board/schedule/material conflicts map to `SCHEDULE_CONFLICT`. A random 409/423 is not generically labeled finalized.
* Browser lock projection recognizes editorial states, Facebook embedded state, generic `externalPublication/publication` states and runtime locks. It does **not** query durable tables for Instagram/other platforms before drag.

### Most likely cause

A real finalized/outcome-unknown/delivering durable publication record existed for the same Board/node but was absent from the loaded node projection. This is explicitly possible in the architecture and matches the precise server category. It may be legitimate protection or a stale/incorrect durable association; repository code cannot distinguish those.

### Not supported as current primary causes

Index-based lookup, adjacent post state, optimistic replacement of the node, alias collision, or generic conflict misprojection are not present in the inspected path. Facebook-specific fields can create a client-side lock, but cannot make the server emit `publication_finalized`; the server reads editorial state and durable tables.

### Bounded production evidence required

Capture one failed correlation without content/provider secrets: client operation ID; hashed Board/node identity; drag dataset hash; request node hash; locked-row resolved node hash; editorial state category; presence/absence and terminal category for each durable table; Board/schedule revision match booleans; HTTP/failure category; and snapshot age. Separately verify referential provenance of the durable row. Do not log captions, external IDs, URLs, tokens, payloads or credentials. A real browser trace should also assert one unique DOM card for that hashed node before drop.

## 10. Listener/lifecycle analysis

| Category | Registration | Multiplication / cleanup finding |
|---|---|---|
| Drag | Per rendered draggable card and every drop cell through `ondrag*` | Old host descendants are destroyed by `innerHTML`, so ordinary listeners become collectible; portal/retained triggers can extend lifetime. Excessive number of handlers, not proven accumulation. |
| Click/input/change | Per button/input via both properties and `addEventListener` in `bind` | Rebound after every render. No event delegation. No explicit removal, relying on DOM replacement. |
| Keyboard/Escape | `host.onkeydown`; dialog/drawer-local handlers | Host property is replaced, not multiplied. Dialog removed on close; drawer is destroyed/recreated. |
| Focus trap | Drawer and quick/editorial/publish dialogs | Node-local. Drawer trigger is retained in global `calendarState`; focus can point to a detached node after rerender. |
| Document/body | Drawer/dialog portal append and global portal query/removal | No persistent document listener found. Portal cleanup exists but unmount does not clear drawer trigger. |
| Window/resize/storage | No Calendar window, resize or storage-event listener | Preferences use synchronous `localStorage` only on option/toggle changes, not dragover. |
| Board lifecycle | Indirect through repeated `render` contexts and app generation | Maps reset inconsistently: calendar reset on context change; app queue/cache persist. |
| Popovers | Elements recreated with workspace; click/input handlers local | No outside-click/Escape management; no multiplication proven. |

There is no code proof of listener-count growth explaining “works once, fails twice, then hangs.” The more strongly supported progression is increasing scheduled-card count and repeated expensive projections/renders. A browser listener-count test is still required because DOM doubles cannot model detached portal/closure retention.

## 11. Cache and memory analysis

| Container | Bound / eviction | Cleanup | Retention finding |
|---|---|---|---|
| `postingScheduleFingerprintCache` | 64 FIFO insertion entries; rejected promise evicted | No Board-switch/unmount clear; key includes Board/node/material | Bounded count, but promises/nodes can remain across Boards until displaced. |
| App promise queue | No actual length bound; depth metric clamps at 32 | No cancellation/reset | Closures and payloads grow with actions while a request stalls. |
| `postingScheduleRequests` | Number of active dispatched node IDs | `finally` after dispatch | A never-settling fetch retains entry indefinitely. |
| `optimisticSchedules`, `calendarMutations` | Number of pending cards | `resetCalendar` and terminal cleanup; not `unmount` | Can retain on early stale completion/unmount. |
| `finalizedPublicationByNode` | Unbounded node IDs for module lifetime | `resetCalendar` does **not** clear it; unmount does not clear it | Cross-Board ID collision and steady growth are possible; mixes publishing and schedule-lock provenance. |
| Undo | One record | replacement/7 s/reset | Bounded, but unmount does not clear timer; callback may render any later `mounted` workspace. |
| Feedback/toast | Feedback DOM; one Undo timer | DOM replacement/timer | No separate toast timer beyond Undo. |
| Drawer | One ID and DOM trigger reference | drawer close/context reset; incomplete unmount | Detached trigger closure/reference possible. |
| Preferences | One objects + per-Board/account localStorage key | browser storage policy | Values bounded; number of Board keys unbounded over product lifetime, small payload. |
| Normalized records | No cache | ephemeral each render | Allocation churn rather than retained memory. |
| Engagement/approval maps | Several maps/sets | partly lifecycle-cleared | Shared module complexity; some approval failure/pending state is not Calendar-scoped. |

Repeated ordinary dragging can therefore grow active queue closures under slow persistence and runtime lock/cache keys over long sessions. The largest immediate risk remains active work/allocations, not a proven monotonic heap leak.

## 12. Server persistence analysis

The route authenticates, validates an allowlisted command, ensures storage, and delegates. The service opens a transaction, resolves edit access, locks the Board row, checks Board revision, finds the node, checks type/schedule revision/status/material fingerprint, checks publication tables, mutates only schedule/legacy aliases, serializes the complete `canvas_json`, updates the Board and commits.

Query work per successful mutation is approximately: access lookup (implementation-dependent), locked Board select, relation-existence select, up to two publication existence queries, and one whole-Board update. Transaction duration includes all those checks and whole-JSON serialization but no provider request. The response is small and allowlisted: status, Board ID, node ID, planning schedule, Board revision, plus envelope IDs/classification. Authentication, row locking, schedule validation, publication protection, fingerprint protection and authoritative reconciliation are all necessary and must remain.

Minimum request: `{boardId,nodeId,schedule|null,expectedBoardRevision,expectedScheduleRevision,expectedMaterialFingerprint,expectedStatus}`. Minimum success response: `{ok,status,node_id,planning_schedule|null,board_revision}` plus response-contract/request IDs. Minimum failure response: `{ok:false,failure_category,retryable}` plus request ID.

Potentially unnecessary work is the preliminary access read followed by a locked row read, relation discovery on every call, and writing/serializing the entire Board JSON to move one field. These are optimization candidates only after measurement; the browser can freeze entirely before/independent of server completion. A stalled fetch does, however, create queue head-of-line blocking. Add timing categories, not weakened checks.

## 13. Complexity inventory

Repository measurements on the audited revision:

* `content-workspace.js`: **128,021 bytes, 169 physical lines, 91 named functions**. Calendar/scheduling-heavy lines 45–128 alone are **74,897 bytes across 84 compressed physical lines** and contain **68 named functions** (some shared approval/publication helpers).
* App context/writer area inspected at lines 16980–17220: **25,464 bytes / 241 lines**; focused queue/writer has 8 schedule-specific functions/helpers or state operations.
* Calendar style region measured at lines 8039–8101: **20,793 bytes / 63 compressed physical lines**, with **182 calendar-selector/name occurrences** across `styles.css`.
* BW-35.1 through R5 added net **629 lines and removed 78** across the relevant implementation, tests and feature history; each repair layered behavior rather than replacing the underlying renderer.
* Focused BW-35 scripts contain **108 physical lines**, heavily compressed; most assertions are regex/string/static fixtures.
* Mutable calendar/schedule containers: at least **11** (calendar state, optimistic map, calendar reservation map, mutation sequence, Undo/timer, finalized map, app request set, fingerprint cache, queue tail/depth, Browser Board nodes/revision).
* Render entry points affecting Calendar: **at least 4** (`render`, exported `rerender`, app `renderContentWorkspace`, `onRefresh`), plus many event paths invoking them.
* Event-binding paths: one monolithic `bind` with roughly **20 selector groups**, including per-card/per-cell drag handlers.
* Eligibility checks: shared `schedulingEligibility` is called at record creation, controls/dialog and writer, while `evaluateScheduling` and readiness are recomputed beneath it; **at least 4 admissions per mutation/render lifecycle**.
* Publication-lock checks: shared projection in record/controls/writer plus server editorial and two durable-table checks: **at least 4 layers**.
* Schedule writers: **one canonical HTTP writer** plus server service; legacy local-writer code is gone, though compatibility comments/reads/renderers remain.
* Compatibility layers: at least **six**—legacy `social.*` schedule read/delete, old shell `renderCalendarView`, retained BW-31 vocabulary comment, private duplicated localization, legacy hidden hook text, and obsolete Calendar/list scheduled projections identified by the prior audit.
* Old checks preserving tokens rather than behavior: BW-31.4 delegates into R2, R1/manual scripts delegate into R2, and R3–R5 assert implementation strings. At least **six check files** constrain names/markup/compatibility more than runtime outcomes.

**Required product complexity:** Month/Week/List projection, backlog, details, one validated schedule mutation, access/publication protection. **Safety complexity:** revisions, material fingerprint, transaction lock, stable ID, terminal lock and authoritative response. **Accidental complexity:** repeated projection/timezone scans, DOM-as-state, two pending reservations, full replacement/rebinding, promise-tail coordination. **Obsolete compatibility complexity:** legacy schedule aliases and old shell/calendar vocabulary/surfaces. **Visual complexity:** dense text, multiple badges/controls and duplicated feedback without icon/media hierarchy.

## 14. Regression-gap analysis

Current checks pass because they prove source tokens and pure examples, not browser scheduling behavior. Host doubles return empty selector lists and have no layout engine. R5 asserts source ordering around rAF, presence of cache/queue/cleanup strings, CSS token existence and a few pure lock/drop projections. It does not execute `applyCalendarMutation`, native drag frequency, real rAF, `Intl` cost at scale, fetch latency, timers, styles, layout or listener lifecycle.

Not represented: native data transfer; dozens of dragovers; child dragleave churn; actual paint; CSS animation/transforms; compact-cell geometry; layout shift; detached nodes; portal focus; Board switch during fetch; never-settling fetch; 20 repeated moves; multiple scheduled posts; browser task/microtask scheduling; long-task observation; event-listener counts; heap growth; duplicate DOM identity; real response mapping across route; and server-discovered durable locks.

Passing regressions therefore cannot exclude broken presentation, long tasks or a semantically surprising but correctly mapped durable lock.

## 15. UX/design audit

* **Month:** too much caption/status text for the smallest cell; cards are differentiated mainly by a left accent and platform word. Limit to icon+time, one-line title, optional fixed thumbnail, one state glyph.
* **Week:** hourly grid is useful but 168 drop cells and repeated filters are expensive. Permit a slightly richer two-line title/thumbnail, still no full caption.
* **List:** appropriate for richer metadata; keep date/time, icon/channel, title, approval/readiness, media indicator and owner in scannable columns.
* **Backlog:** currently repeats platform, title, caption, readiness, media count and two actions plus drag affordance. Use icon/accent, title, one-line excerpt, thumbnail when present, one compact blocker/readiness chip; keep Details secondary.
* **Blocked list:** explain one primary blocker without showing a false draggable affordance; locked is distinct from incomplete.
* **Drawer:** correct location for full caption, complete schedule/timezone, owner, approval/readiness, lock reason and safe larger media preview. Preserve one clear scheduling action group.

Pending and Undo feedback are duplicated. Use card icon state plus one global polite announcement/toast. Locked state must use lock icon/text, not color alone.

## 16. Channel visual system recommendation

Use repository-native inline SVG symbols (new vetted assets in the later repair, not external requests), a consistent 16 px icon slot and a 3 px accent edge. Brand hues are accents, never the only label and never large body-text colors. Exact foreground/background pairs must pass WCAG contrast in both themes.

| Channel | Icon | Accent recommendation | Text alternative |
|---|---|---|---|
| LinkedIn | recognizable `in` mark | blue (current `#3977b9`, contrast-adjusted per surface) | “LinkedIn” |
| Instagram | camera glyph, not gradient-dependent | magenta/purple (current `#b84689`) | “Instagram” |
| Facebook | `f` mark | blue (current `#4267b2`) | “Facebook” |
| X | X glyph | neutral slate/black adapted for theme | “X” |
| TikTok | note glyph | teal/pink detail or accessible teal accent | “TikTok” |
| Generic/unknown | globe/share glyph | product muted/primary token | “Other channel” |

Icons must remain distinguishable in monochrome/high contrast. Channel class normalization should be one shared map rather than string replacement scattered across markup. Month anatomy: top row icon + accessible channel name (visually hidden if space requires) and time; one-line title; optional 4:3 thumbnail in a reserved box; exactly one status icon (pending, locked, warning, or ready by priority).

## 17. Media-preview contract

Canonical browser data already contains `node.images[]` with `{id,url,name,createdAt,source}` and `favoriteImageId`; Canvas cards select favorite or latest. Calendar projection currently exposes only `mediaCount`, discarding URL/selection. Persistence sanitation excludes blob/data URLs and limits stored image objects, but no Calendar-specific remote-origin allowlist was found. Existing avatar images use lazy loading in one surface; Calendar does not render images.

Future contract:

1. Project at most one image: favorite if valid, otherwise newest valid persisted image.
2. Accept only parsed `https:` URLs from product-controlled/explicitly allowlisted storage origins. Reject credentials, `data:`, `blob:`, non-HTTP schemes and arbitrary HTML. Do not expose provider credentials or fetch provider APIs.
3. Render `<img loading="lazy" decoding="async">` with fixed `width`/`height`, `aspect-ratio: 4/3`, `object-fit: cover`, bounded source dimensions where the storage service supports thumbnails, and a fixed reserved box to prevent layout shift.
4. Use empty alt for a decorative thumbnail when the adjacent title identifies the post; use concise stored alt only if a canonical safe alt field is later introduced. Never use caption as verbose alt.
5. On missing, invalid or failed image, show a channel-colored icon fallback of identical dimensions. Never fabricate imagery.
6. Month may omit thumbnails at the narrowest density; Week/backlog use small thumbnails; List uses an optional small cell; Drawer may show a bounded larger preview.

Remote media can reveal client IP/referrer and consume bandwidth. Prefer already authorized first-party blob delivery and a conservative referrer policy; do not proxy or expand access in this task.

## 18. Accessibility/responsive findings

Native HTML drag-and-drop is poor on touch and has inconsistent keyboard/screen-reader support. Current keyboard users can open the quick scheduler, which is an adequate equivalent in scope, but drop cells being focusable does not implement keyboard drop. Keep native drag for desktop only during stabilization; make “Schedule/Move” the primary cross-device accessible path. Do not replace it with a custom pointer engine until touch direct manipulation is an explicit requirement—pointer drag would add capture, collision, scrolling and cancellation complexity contrary to simplification.

Preserve focus by stable logical ID after reconciliation, not detached node references. Use one polite live region for start/target/drop/save; do not rewrite it every dragover and do not use assertive announcements for routine target hover. Pending icon needs an accessible label; decorative thumbnail alt is empty. Reduced-motion already exists, but the pending spinner should use a nonessential bounded rotation and stop under reduced motion. Every channel includes icon shape/text, not color alone.

At ≤640 px the Month grid remains 760 px wide and horizontally scrolls; this is acceptable only as an optional desktop-like view. Default mobile to List, keep backlog collapsible and non-sticky, prevent drawer horizontal overflow, and ensure 44 px actions. Cards require container-aware truncation, reserved media, no full caption and no metadata overflow. Week's 760 px minimum likewise needs explicit horizontal-scroll labeling or mobile fallback.

## 19. Recommended target architecture

```text
immutable Board snapshot + revision
        |
        v (once per snapshot/preferences)
indexed calendar projection {byId, byDate, byHour, backlog, blocked}
        +
bounded interaction overlay Map<nodeId,{desired,phase,opId,error}>
        |
single Calendar renderer with keyed/card-local reconciliation
        |
one delegated click/input/drag binding on Calendar root

Board-scoped writer: active mutation + one replaceable latest intent
        -> canonical PUT with all existing guards
        -> success installs new immutable snapshot/revision
        -> server lock installs authoritative lock in reconciled snapshot/projection
        -> failure clears overlay and restores projection
```

**Remain:** Board snapshot/revision, derived projection, preferences, one interaction overlay, one active/latest writer, detail drawer, one bounded feedback/Undo model. **Remove:** `optimisticSchedules` plus separate `calendarMutations`/`postingScheduleRequests` duplication, promise-tail queue/depth, DOM card movement as state, permanent runtime lock map, detached trigger storage, repeated asset/calendar projection, and legacy aliases after telemetry/migration confirms retirement.

**Render paths:** keep initial/full render for Board/view change and a keyed Calendar update for preference/mutation results. Remove full workspace render from mutation cleanup, Undo expiry, drawer toggle and Calendar-only filters where a scoped update suffices. Never render during dragover.

**Locks:** a server-discovered lock ends the active operation, discards optimistic intent, updates an authoritative client snapshot/projection record with provenance `server`, disables controls, announces once, and schedules a bounded Board refresh if the schedule endpoint cannot return enough lock metadata. Never silently retry.

**Smallest freeze-prevention browser test:** in a real Chromium page with at least 20 mixed scheduled/backlog cards, perform 20 alternating same/different-card drops while responses are delayed; dispatch high-frequency dragover between drops; assert no task over an agreed threshold (target 200 ms, with timezone resolution itself under 16 ms through precomputation), controls remain clickable, exactly one card per node, listener count and writer/overlay sizes return to baseline, and no Calendar full-render counter increments during dragover.

## 20. Exact deletion/simplification candidates

Candidates for a later repair, with tests/telemetry before deletion:

1. Replace browser minute-by-minute `resolveLocalDateTime` search with the already bounded/shared resolver or a cached transition-safe resolver; never invoke it while merely reading a previously validated canonical schedule.
2. Remove `optimisticSchedules` and `calendarMutations` after introducing one interaction overlay.
3. Remove `postingScheduleQueueTail`/`postingScheduleQueueDepth`; replace with `{active, latest}`.
4. Merge `postingScheduleRequests` into writer active state.
5. Remove physical `appendChild(card)` optimistic movement and duplicate-card deletion; render the overlay through keyed projection.
6. Split the shared `finalizedPublicationByNode` into authoritative snapshot projection; stop using one map for provider publication results and scheduling locks.
7. Remove `calendarState.proposal` (cleared/read but direct drop no longer uses modal proposal flow) and unused `selectedDate` if no behavior consumes it.
8. Replace per-element `bind` loops with one root delegated binding; retain dialog-local traps.
9. Pre-index Month/Week records; delete nested per-cell `filter` calls.
10. Avoid Library `project/applyView` calculation while Calendar mode is active.
11. Remove Calendar full render from Undo timer expiry; update only feedback.
12. Retire legacy `social.scheduledDate`, `scheduledTime`, `scheduledAt`, `addedToCalendar` reader and old shell `renderCalendarView` after persisted-data inventory/migration and navigation confirmation.
13. Retire hidden `.cw-legacy-hooks` and BW-31 token-only compatibility comments/tests once behavioral tests replace them.
14. Consolidate Calendar localization with the established language store or a single Calendar dictionary; do not maintain two sources.
15. Project a safe media preview instead of `mediaCount` only; reuse favorite/latest selection logic.

## 21. Phased repair roadmap

### Phase 1 — Emergency stability containment

* Instrument long tasks/render count and reproduce with production-shaped card volume.
* Remove timezone scanning from schedule reads and cache/pre-index the projection.
* Make dragover idempotent and guarantee it performs no render/projection/storage.
* Prevent full render recursion/re-entry; add an in-progress guard and explicit lifecycle cleanup.
* Assert stable unique node targeting end to end; add bounded finalization diagnostics.
* Fix pending selector to animate only an icon and reserve its slot; preserve current visual structure otherwise.
* Add timeout/uncertain handling so a stalled write cannot hold all later interaction indefinitely.

### Phase 2 — Architecture simplification

* Introduce immutable snapshot + one derived projection + one interaction overlay.
* Replace promise-tail queue with one active/one latest Board writer.
* Consolidate authoritative reconciliation and card updates.
* Delegate Calendar events and delete duplicated pending/request state.
* Remove verified obsolete aliases, shell calendar and token-only compatibility layers.

### Phase 3 — Visual and information redesign

* Add vetted local platform icons and accessible accent tokens.
* Implement compact Month hierarchy and richer Week/List/backlog hierarchy.
* Add safe fixed-size lazy thumbnails using §17.
* Polish icon-only pending, lock/warning/ready priority and responsive overflow.

### Phase 4 — Browser-level reliability coverage

* Run repeated drag stress, same/different-card and delayed/failure sequences.
* Assert listener/render counts, task yielding and overlay/writer/cache cleanup.
* Add real-browser smoke coverage if current CI supports installed Chromium; otherwise a small optional Playwright job plus mandatory manual production acceptance.

**Gate:** BW-35.3 automatic planning and CSV export stays paused through all phases until §22 passes in a production-equivalent browser.

## 22. Acceptance criteria

The later repair is accepted only when all are measured:

* 20 consecutive eligible drag operations complete without freeze, including repeated same-card and alternating different-card moves.
* Listener count returns to baseline after render/unmount; no listener multiplication.
* Writer queue/active/latest, overlays, timers and relevant caches return to documented bounds after cleanup; no monotonic growth.
* Exactly one rendered card per node; no transient duplicate after the next paint.
* Eligible invented Instagram/LinkedIn fixtures never receive false finalized classification; a real server lock is correctly attributed and disables only that post.
* Zero full workspace renders and zero projection/fingerprint/storage operations during `dragover`; handler work is constant and idempotent.
* Optimistic feedback is visible by the next paint; Calendar controls, scroll and Details remain interactive while saving.
* Pending UI has zero measurable layout shift, overlap or rotating text at supported widths.
* Failure restores exact authoritative location/state; success advances schedule and Board revisions once.
* Rapid moves obey documented latest-intent semantics and never dispatch an obsolete intent after uncertain failure.
* Icons distinguish LinkedIn, Instagram, Facebook, X, TikTok and unknown without color; accent/text contrast passes WCAG AA where applicable.
* Safe media appears when valid media exists; invalid/missing media gets fixed-size fallback without layout shift.
* Scheduling causes no provider request, approval mutation, publication mutation/job or real social post.

## 23. Test strategy

Use the smallest suitable layers, not a framework migration:

1. **Pure tests:** schedule reading without timezone recomputation, date bucketing, lock projection, media URL policy, channel mapping.
2. **Writer state-machine tests:** active/latest replacement, revisions, success, typed failures, uncertain timeout, Board switch/unmount, Undo validity.
3. **DOM integration tests:** a lightweight real DOM environment for keyed placement, unique cards, delegated listeners, focus, pending geometry classes and portal cleanup. DOM doubles remain only for boot-capability checks.
4. **Stress test:** scripted 20-operation sequences with delayed/rejected fetch, high-frequency dragover, fake/real timers and rAF; assert render/listener/container bounds.
5. **Browser smoke:** one Chromium test exercising native drag/drop, computed CSS, layout rectangles, long-task/render counters, timer/network scheduling and responsive widths.
6. **Manual production acceptance:** lock reconciliation with sanitized diagnostics, mouse/keyboard/touch alternative, light/dark/reduced motion and real Board reload/revision verification.

Keep existing canonical contract/service tests. Replace implementation-token assertions gradually with outcomes; Runtime Boot Safety remains a separate boot check, not performance evidence.

## 24. Deployment and rollback boundaries

Later phases should ship behind a Calendar-only release boundary with counters for render duration, long tasks, writer state and typed failure categories—never content or provider identifiers. Deploy browser module/styles/test changes together. Server optimization, if any, is a separate deployment retaining the existing contract and protections. No migration is required for Phase 1/2 unless legacy-alias retirement finds persisted data requiring an explicit migration.

Rollback may restore the preceding Calendar renderer/writer but must not roll back BW-35.1 canonical `planningSchedule`, weaken server authorization/row locks/revisions/fingerprint/publication protection, rewrite Board JSON, or trigger provider work. If an uncertain mutation occurs, freeze further writes, reload authoritative Board state and show recoverable feedback rather than guessing.

## 25. Explicit non-goals

This audit does not implement fixes, add dependencies, change database schema, call providers, publish posts, mutate approval/publication, build automatic scheduling, recurrence, CSV export, campaign capacity/conflict planning, fabricate media, or replace the approved unified Content Calendar inside Content Workspace. It does not weaken any server safety boundary and does not expose production identifiers/content/secrets.

## 26. Open questions requiring production evidence

1. What are p50/p95/max durations and call counts for `resolveLocalDateTime`, `collectPostingPlan`, `renderCalendar` and `host.innerHTML` in the hanging Board?
2. Did the hang occur before request dispatch, while fetch was pending, or during terminal reconciliation? Correlate bounded stage timestamps with browser long tasks.
3. How many scheduled/unscheduled/blocked cards and images existed, and did scheduled-card count predict duration?
4. Did the failed Instagram node have a matching durable external-post/job row; what terminal category and provenance created it?
5. Was dataset/request/locked-row identity equal under a one-way diagnostic hash, and was exactly one matching DOM card present?
6. Was the loaded Board revision older than publication finalization, and should the normal Board loader project all provider-neutral durable locks?
7. Does a network request ever remain unsettled long enough to block the global queue; what timeout exists at infrastructure level?
8. Do listener counts or detached drawer triggers grow in a real browser across 20 renders despite host replacement?
9. Which persisted Boards still contain legacy `social.*` schedule aliases, and is the old shell Calendar reachable in production navigation?
10. Which image URL origins currently occur, which are first-party/authorized, and is a thumbnail transformation endpoint already available?

Until those bounded questions are answered and §22 passes, the stability incident remains open and BW-35.3 remains paused.
