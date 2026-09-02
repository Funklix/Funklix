# BW-31.3 Content Calendar, scheduling lifecycle, and publishing-boundary audit

**Audit date:** 2026-09-02
**Scope:** Documentation-only repository audit. No scheduling, connector, publishing, storage, production-code, CSS, test, package, or Runtime Boot Safety change is made here.
**Authoritative baseline:** the merged BW-31 operations audit, BW-31.1 Content Library implementation/regression, and BW-31.2 human-review implementation/regression. Repository observations below are implementation facts; proposals are explicitly labelled.

## 1. Executive conclusion

**Decision: GO for BW-31.4 only under the contracts in this document; NO-GO for external scheduling, delivery claims, or analytics.**

The repository has a **partial legacy month calendar**, not an operational Content Workspace Calendar. `#calendar-view` is a sibling legacy Campaign Canvas view. `renderCalendarView()` projects only `Social Media Posting` nodes whose `social.addedToCalendar`, `social.scheduledDate`, `social.scheduledTime`, and `social.scheduledAt` happen to agree. The scheduling overlay writes timezone-less browser-local strings directly to a node and immediately saves local Canvas state. It has no eligibility check, approval/revision guard, schedule revision, actor, activity event, remove flow, external destination, provider job, or proof of publication. Month naming is fixed to German while event time is fixed to British formatting. Thus the view can show an internal intention, but cannot reliably identify a portable instant and must never imply provider delivery.

BW-31.1 establishes the correct projection boundary: the current Board's Canvas `state.nodes` remains content authority and Content Workspace does not copy assets. BW-31.2 establishes the correct mutation shape: prepare an action, then re-resolve account, Board, access generation, live node, editorial state, deterministic readiness, and material fingerprint at action time; mutate the authoritative node; update dependent surfaces; mark dirty; and use autosave. Calendar mutations must extend that boundary rather than call the legacy direct writer.

The smallest useful, future-safe BW-31.4 is:

* Content Workspace **Month** and **Agenda** projections plus an **Unscheduled Approved** queue; no Week view and no drag-and-drop.
* A labelled, accessible schedule dialog for schedule/reschedule/remove, including local date, local time, and an explicit IANA timezone.
* Additive `node.planningSchedule` metadata containing the canonical UTC instant, original wall time and zone, actor/change time, scheduled material fingerprint, and schedule revision. Legacy `social.*` fields are read through a compatibility adapter and migrated only on an authorized write.
* Deterministic eligibility for operational/publishable roles, `Approved`, acceptable readiness, meaningful content, and valid platform/channel. `Needs attention` requires deliberate acknowledgement. AI Review, ownership, unresolved notes, media, and a connected account do not universally gate internal planning (though visible warnings or role/platform rules may apply).
* Four independent dimensions: editorial, internal planning, future external delivery, and future performance. A past internal schedule remains “Scheduled in Funklix — publication not verified”; elapsed time never creates `Published`.
* Future Publish Jobs and External Posts as separate durable entities linked to account/Board/node/schedule/revision. This audit confirms the hybrid architecture suggested by BW-31.

## 2. Current Calendar architecture

### Exact inventory

| Concern | Repository fact | Assessment |
|---|---|---|
| Host DOM | `<section id="calendar-view" class="board-list-view hidden">`, containing `#calendar-title`, previous/next buttons, and `#calendar-grid`. | Separate legacy view, not inside `#content-workspace-view` / `#content-workspace-surface`. |
| Navigation/mode | Active view string is `calendar`. Utilities `#view-calendar-btn` and the Board/List/Calendar cycle call `setActiveView("calendar")`. The Canvas sidebar remains active for `board`, `list`, and `calendar`. | Legacy Campaign Canvas mode. Content Workspace's only active view is `content_workspace`; it currently renders Library and Review Queue, not Calendar. |
| Renderer | Global `renderCalendarView()` in `app.js`. Previous/next month mutate `state.calendarMonth` and rerender. | Imperative, month-only renderer. |
| Data authority | Live `state.nodes`, originally hydrated from Board `canvas_json` or local draft and serialized by `serializeState()`. | Correct authority, but no dedicated scheduling projection/adapter. |
| Display date source | Day placement requires exact `social.scheduledDate === YYYY-MM-DD` and truthy `social.scheduledTime`; title count additionally requires `addedToCalendar && scheduledAt`. Event time is reparsed from `social.scheduledAt`. | Three potentially divergent date sources and one flag. A node may count but not render, render under one day with a time derived from another, or disappear. |
| Month source | `state.calendarMonth`, initialized as the browser-local first day of the current month. Date arithmetic uses local `Date`. | Ephemeral browser state, not Board/user timezone state. |
| Supported role | Exact node type `Social Media Posting`. | Content/Email/Landing are excluded even though BW-31.1 regards them as operational; Calendar V1 should initially define an explicit publishable role policy rather than infer all operational roles are schedulable. |
| Scheduling fields | `social.scheduledDate`, `social.scheduledTime`, `social.scheduledAt`, `social.addedToCalendar`; temporary `state.scheduleDate`, `state.scheduleTime`, and `state.pendingScheduleNodeId`. | Legacy, timezone-less, no revision/provenance. |
| Writer | `confirmSchedulePost()` reached from Canvas social card or Inspector “Add to Posting Calendar.” | Direct node mutation after only a read-only check, node lookup, and non-empty date/time. No role/status/readiness/freshness validation. |
| Persistence | `saveCampaignCanvasState()` serializes all sanitized nodes to local storage immediately. Server autosave is normally driven by `markUnsaved()`, but this writer does not call it. | Stored in Canvas JSON locally; server persistence is not deliberately entered by the scheduling action. The dirty watcher may later detect a changed snapshot, but that is incidental, delayed, and not the canonical mutation consequence. |
| Card rendering | Platform pill, parsed time, 60-character caption/title preview, optional last-image thumbnail; inline platform colors. | Compact enough, but omits status, readiness, role/context, warnings, and honest planning wording. |
| Click | Event switches to Board, selects exact node, fills Inspector, and calls `forceNodeVisible()`. | Useful “Show on Canvas” behavior, but closure does not action-time revalidate access/node identity and has no explicit accessible label. |
| Drag-and-drop | None in calendar. Canvas nodes themselves can be dragged, but calendar events/day cells have no drag handlers. | Correctly absent for now. |
| Empty/error/loading | No explicit Calendar state; it always builds a month grid. Leading pad cells are hidden. | Placeholder-quality state handling. No no-Board, no-assets, no-results, malformed-date, access, or calculation-failure recovery. |
| Responsiveness | Fixed seven-column CSS grid, minimum 120px day height. No Calendar-specific tablet/mobile alternative. | Likely compressed or horizontally/vertically dense on narrow screens; no agenda-first mobile experience. |
| Localization | Month title uses `de-DE`; event time uses `en-GB`; “scheduled posts,” modal title/labels/buttons, image alt, and event content are hard-coded. `language.js` translates Calendar View, Add to Posting Calendar, Scheduled, and one schedule template only. | Partial and internally inconsistent. Switching UI language does not intentionally control calendar locale. |
| Accessibility | Events are native buttons. Day containers are generic `div`s; no weekday headings, grid semantics, full date labels, selected-date model, keyboard date navigation, live month announcement, or agenda alternative. Prev/next buttons contain only glyphs and lack explicit accessible names. Overlay is a generic `div`, labels are not associated with inputs, no dialog semantics/focus trap/restoration/error announcement. | Material accessibility gaps. |
| Operational maturity | Existing date/time can be added and shown; event opens Canvas. | **Partial legacy implementation**, not an operational Calendar and not merely static decoration. |

### Adjacent surfaces and behavior

* **List mode:** `#board-list-view` and `updateListView()` group every filtered Canvas role. Social list metadata derives “Scheduled” from `scheduledAt` alone. It is not Content Workspace Library mode.
* **Content Workspace:** BW-31.1 projects the live nodes into default roles (`Content`, `Social Media Posting`, `Landing Page`, `Email Campaign`) and optional roles. Its `scheduledDate` is a presentation projection of `social.scheduledDate || social.scheduledAt`, sliced to ten characters. It displays the date but has no schedule action.
* **Social node:** Canvas renders a platform selector, advisory hard-coded “Ready” badge, caption/CTA/hashtags, optional schedule badge, and Add/Scheduled action. “Ready” is not BW-31.1 deterministic readiness. Platform/content edits write directly and can stale BW-31.2 approval.
* **Inspector:** only Social Media Posting exposes the scheduling button and formatted metadata. It does not expose editable date/time/timezone fields; those are in the overlay.
* **Node schemas:** new nodes initialize only `social.scheduledAt: ""`; the other legacy fields appear on first scheduling write. Canvas schema version remains `1`, and permissive node persistence preserves additive object fields after sanitization.
* **Save/load/autosave:** `serializeState()` persists sanitized nodes, edges, counters, zoom, bounded activity, and metadata in `canvas_json`. Board load validates/defaults the payload then replaces live state. Public Viewer load deliberately does not cache the payload to local storage. `markUnsaved()` enters a three-second guarded server autosave; snapshot comparison is a fallback dirty detector.
* **Status/activity:** `node.status` permits Draft, In Review, Needs Changes, Approved, and Published. Legacy schedule does not change it and emits no activity. `Published` is manually settable and is not delivery evidence. Activity is bounded to 50 persisted entries / 15 visible entries and currently sanitizes a narrow field set.
* **BW-31.2 boundary:** `applyContentWorkspaceTransition()` checks authenticated account, Board, edit permission, no public token, Board load generation, node existence, current status, material fingerprint, readiness, allowed transition, and required note. It updates node/card/Inspector/List, records status activity, marks dirty, and refreshes Content Workspace.
* **Public Viewer:** receives full-width shell and authorized Canvas projections, `canEdit=false`, and no BW-31.2 transition controls. Legacy schedule button is disabled/guarded by read-only behavior, but calendar visibility is not a separate publication-schedule privacy policy.

## 3. Scheduling-field inventory

Repository-wide production search found no persisted due date, publication date, posted date, timezone, destination account, external post ID/URL, publish-job state, delivery state, or retry state. Similar “destination” and “retry” words in website import/AI errors are unrelated.

| Field / derived value | Node roles | Stored format | Writer | Reader | Persisted? | Meaning | Risk |
|---|---|---|---|---|---|---|---|
| `node.social.scheduledDate` | Social Media Posting | `YYYY-MM-DD` string from native date input | `confirmSchedulePost()` | Calendar day placement; BW-31.1 projection | Yes, inside Canvas node | Intended browser-local calendar day | No zone; can disagree with `scheduledAt`; missing on newly created/older nodes. |
| `node.social.scheduledTime` | Social Media Posting | `HH:mm` string from native time input | `confirmSchedulePost()` | Calendar inclusion (truthiness), but displayed time comes from `scheduledAt` | Yes | Intended browser-local wall time | No seconds/zone; syntactic truthiness only; duplicate source. |
| `node.social.scheduledAt` | Social Media Posting | `YYYY-MM-DDTHH:mm:00`, no offset | `confirmSchedulePost()`; initialized to empty on create | modal prefill, Canvas badge, Inspector, List, filters, Calendar count/time, Content Workspace fallback | Yes | Legacy local planning datetime | Parsed according to current runtime timezone; not a canonical instant; can disagree with split fields. |
| `node.social.addedToCalendar` | Social Media Posting | Boolean `true`; absent otherwise | `confirmSchedulePost()` | Calendar count and event inclusion | Yes | Legacy inclusion marker | Redundant with schedule; no false/remove flow; inconsistent values hide valid dates. |
| `state.scheduleDate` | Pending any selected node, intended Social | `YYYY-MM-DD` or empty | modal open/input confirmation/close | confirmation | No | Overlay draft date | Global transient state; no prepared identity or stale token. |
| `state.scheduleTime` | Same | `HH:mm`, defaults `09:00` | modal open/input confirmation/close | confirmation | No | Overlay draft time | Browser-local and global; no timezone. |
| `state.pendingScheduleNodeId` | Same | Node ID or null | open/close overlay | confirmation | No | Target node pointer | Node can change/delete and permissions/revision can change while modal remains open. |
| `state.calendarMonth` | All display | Browser `Date` at local month start | initialization and prev/next controls | Calendar renderer | No | Month being viewed | Browser-zone and language independent; not shareable/restored. |
| Calendar day `key` | Social display | Derived `YYYY-MM-DD` | renderer | comparison with `scheduledDate` | No | Day bucket | Uses browser-local month and split legacy date, not canonical instant. |
| `formatScheduleMeta()` labels | Social display | Derived locale strings: `en-US` date, `en-GB` time | formatter | Canvas/List/Inspector | No | Presentation | Mixed locale, runtime-zone conversion, and loss of year/timezone; never persist. |
| Calendar title/time labels | Social display | `de-DE` month/year and `en-GB` time | renderer | visible UI | No | Presentation | UI language mismatch; malformed `scheduledAt` may display “Invalid Date.” |
| `node.status` | All roles | Canonical string (plus normalized legacy aliases in workspace projection) | Inspector/BW-31.2 | Canvas, List, Workspace, dashboard/filter | Yes | Existing editorial/manual status | Includes `Published` despite no external evidence; must not absorb planning/delivery/performance. |
| derived `Scheduled` filter/state | Social | Truthy `social.scheduledAt` | none | Canvas filtering/List metadata | No | Presentation inference | Ignores `addedToCalendar`, validity, split date, timezone, and approval. |
| `node.social.platform` | Social | Free/canonical-ish string; options differ across surfaces | create defaults, Inspector, Canvas, generators | cards, filters, readiness, Calendar pill | Yes | Intended social platform | Vocabulary inconsistency (`X`, `X / Twitter`); not a destination/account. |
| `node.channel` | All roles | Free string | Inspector/generation/inheritance | Workspace fallback, filters, context | Yes | Generic campaign channel | Can duplicate/conflict with `social.platform`; not a provider destination. |
| `ownerEmail`, `ownerName`, `ownerAvatar` | All roles | strings | owner assignment | Workspace/Canvas/List | Yes | Internal work ownership | Not authorization and not scheduling actor/destination. |
| `approvedContentFingerprint` | Approved operational roles in BW-31.2 | deterministic string fingerprint | approval transition | Workspace `approvalChanged`; guarded transition | Yes | Material revision approved by a human action | No immutable revision ID; required as V1 scheduled-revision anchor but must be captured, not recomputed later. |
| `updatedAt` / `updated_at` on node | Any legacy node | unspecified string | no reliable general node writer identified | Workspace sorting/projection | If present | Claimed node update time | Not reliable enough for scheduling revision/change time. |
| Board `metadata.createdAt/updatedAt`, server `updated_at` | Board | ISO-like server/metadata values | Board lifecycle/server | dirty/load/UI/conflict logic | Yes | Board timestamps | Not an asset schedule; timestamp-only Board change must not stale a prepared schedule action. |
| activity `timestamp` | Activity entries | UTC ISO from `new Date().toISOString()` | activity append | History | Yes, bounded | Event occurrence | Existing sanitizer cannot retain old/new schedule details or timezone without additive bounded fields. |

**Duplicate/ambiguous concepts:** the split date/time, combined local datetime, and inclusion Boolean all represent one schedule; `platform` and `channel` overlap; `Published` implies delivery despite no evidence. There are no persisted locale-formatted schedule strings—the locale strings are presentation-only—but the locale-independent-looking `scheduledAt` is still unsafe because it omits an offset/zone. Existing legacy values may be absent, malformed, partial, contradictory, or timezone-shifted by the viewer's machine.

## 4. State-dimension separation

| Dimension | Values / evidence | BW-31.4 ownership | Deferred ownership |
|---|---|---|---|
| **Editorial status** | `Draft`, `In Review`, `Needs Changes`, `Approved`. Existing `Published` is retained as a legacy manually marked value, visibly qualified. | Existing BW-31.2 workflow remains authoritative. Schedule actions do not alter it. Eligibility requires effective `Approved`. | A future migration may remove delivery wording from editorial UI only with compatibility protection. |
| **Planning state** | `Unscheduled`, `Scheduled`; activity transitions “Schedule changed” and “Schedule removed.” A stale approved revision adds a blocked/warning condition, not another editorial state. | Derived from valid `planningSchedule`; activity records changes/removal. Do not need a separately mutable enum. | Recurrence, campaign-wide planning, and cross-Board schedule entities. |
| **External delivery** | `Not submitted`, `Queued`, `Submitting`, `Accepted`, `Published`, `Failed`, `Cancelled`, `Deleted externally`, `Unknown`. | Only honest static “Not connected / not submitted” boundary copy, not node delivery state. | Separate Publish Job/External Post entities and provider reconciliation. |
| **Performance** | `Unavailable`, `Awaiting data`, `Available`, `Stale`, `Sync failed`. | `Unavailable` because no verified source; do not infer from schedule. | Metric synchronization/snapshots with provenance. |

“Schedule changed” and “Schedule removed” are transitions/history, not long-lived values after the resulting state is respectively Scheduled/Unscheduled. Likewise `Failed` must mean a specific future delivery job failed—not malformed internal planning data. No dimension may be encoded into `node.status`.

## 5. Scheduling eligibility

### BW-31.4 deterministic contract

An asset may receive or change an internal schedule only when all are true at confirmation time:

1. Current authenticated account, current Board, current access generation, edit permission, no Public Viewer token, and live node exist.
2. Role is explicitly `Social Media Posting` for initial V1. The architecture may later add Email Campaign or another typed publishable role; generic `Content` and Landing Page are operational but not automatically social-publishable.
3. Effective editorial status is `Approved` and `approvedContentFingerprint` equals the current BW-31.2 material fingerprint.
4. BW-31.1 deterministic readiness is `Ready`, or `Needs attention` and the user explicitly checks an acknowledgement in the schedule dialog. `Incomplete` is blocked.
5. `social.platform` normalizes to a supported V1 platform value. `channel` alone may be shown for context but must not silently stand in for a Social platform on write.
6. Required publishable content exists. For Social this means the existing readiness requirements: platform and meaningful caption/content. Platform-specific media/alt-text constraints may produce `Needs attention` until formalized; do not fabricate a universal media requirement.
7. Local date, local time, and a supported IANA timezone resolve to one valid UTC instant under the timezone rules below.

Not required for internal planning: a node owner, connected social account, account destination, external credentials, AI Review or score, zero unresolved review comments, or universal media. Ownership is work assignment, not authorization. Unresolved notes should be visible; if BW-31.2's approved state remains valid they do not independently override it. AI Review is always advisory.

### Stable reason codes

| Code | User-facing explanation / next safe action |
|---|---|
| `ACCOUNT_REQUIRED` | “Sign in to schedule this asset.” Sign in, then reopen current Board. |
| `BOARD_REQUIRED` | “Open a Board before scheduling.” Return to Boards. |
| `ACCESS_REVOKED` | “You no longer have edit access.” Reload authorized read-only view. |
| `NODE_DELETED` | “This asset no longer exists.” Refresh Calendar/Library. |
| `ROLE_NOT_SCHEDULABLE` | “This asset type cannot be scheduled in Calendar V1.” Show on Canvas or select a Social asset. |
| `APPROVAL_REQUIRED` | “Approve the current asset revision before scheduling.” Open Review Queue. |
| `APPROVAL_STALE` | “Approved content changed.” Reopen/review the current revision; preserve any existing schedule as blocked. |
| `READINESS_INCOMPLETE` | “Complete the required platform and content first.” Open Inspector with listed issues. |
| `READINESS_ACK_REQUIRED` | “Review and accept the remaining readiness warnings.” Return focus to warning acknowledgement. |
| `PLATFORM_MISSING` / `PLATFORM_UNSUPPORTED` | “Choose a supported platform.” Open Inspector/platform control. |
| `SCHEDULE_DATE_INVALID` / `SCHEDULE_TIME_INVALID` | “Enter a valid date/time.” Focus the failing labelled field. |
| `TIMEZONE_REQUIRED` / `TIMEZONE_INVALID` | “Choose a valid timezone.” Focus timezone selector. |
| `LOCAL_TIME_AMBIGUOUS` | “This time occurs twice because clocks change.” Choose the earlier/later offset explicitly. |
| `LOCAL_TIME_NONEXISTENT` | “This time does not exist because clocks change.” Choose a valid nearby time. |
| `STALE_CONTENT` | “The asset changed while the dialog was open.” Review the current version. |
| `STALE_SCHEDULE` | “The schedule changed elsewhere.” Reload and review the current schedule. |
| `ACTION_NOT_PERMITTED` | “This action is unavailable for the current schedule.” Refresh without mutation. |

## 6. Canonical scheduling contract

### Recommended smallest additive node metadata

```json
{
  "planningSchedule": {
    "version": 1,
    "scheduledAtUtc": "2026-10-25T08:30:00.000Z",
    "localDate": "2026-10-25",
    "localTime": "09:30",
    "timeZone": "Europe/Berlin",
    "scheduledBy": { "accountId": "user@example.com", "name": "Ada" },
    "updatedAt": "2026-09-02T12:34:56.000Z",
    "scheduleRevision": 1,
    "assetFingerprint": "<BW-31.2 material fingerprint>",
    "scope": "internal_planning"
  }
}
```

**Semantics:** object absence means Unscheduled. Presence is Scheduled only if all required fields validate and local components/zone round-trip to `scheduledAtUtc`. `scheduledAtUtc` is the canonical instant. `localDate`, `localTime`, and `timeZone` preserve the user's intended civil time and explain the conversion. `scheduledBy` and `updatedAt` answer actor/change provenance. Monotonic integer `scheduleRevision` guards concurrent reschedule/removal. `assetFingerprint` identifies the exact approved material revision planned. `scope` must be exactly `internal_planning`; it prevents UI/provider ambiguity. It does **not** contain a publish job ID.

Use the existing BW-31.2 fingerprint as Calendar V1's material revision token because the repository has no immutable asset revision ID. This is future-safe identity, not perfect revision history. Store account ID (stable internal identifier when available; normalized email only as current compatibility identity) and a bounded display name. Avoid full account/profile copies.

Do not persist a mutable `planningState`: derive Unscheduled/Scheduled and record changed/removed transitions in activity. Do not store locale-formatted strings, browser offset alone, `Date.toString()`, provider fields, external claims, or duplicate content/media in this object.

### Legacy adapter and migration-on-write

Read precedence is: (1) valid canonical `planningSchedule`; otherwise (2) coherent legacy split `scheduledDate` + `scheduledTime`, with `scheduledAt` as consistency evidence; otherwise (3) parseable `scheduledAt`; otherwise invalid legacy schedule. Legacy schedules have **unknown timezone** unless an explicit Board policy is introduced; never silently label them UTC. Present “Timezone missing — review schedule” and block external preparation.

The existing Add to Posting Calendar action must route into the new schedule dialog. On confirmed schedule/reschedule, write canonical metadata and either remove the four legacy fields or update them only as a temporary compatibility mirror with a documented single writer. Preferred end state: canonical write plus delete legacy duplicates in that node, after every legacy reader has been converted. Removal deletes canonical and legacy scheduling fields atomically. Merely loading an old Board never rewrites it.

## 7. Timezone behavior

**Authoritative interpretation:** the user selects a civil `localDate` + `localTime` in an explicit IANA `timeZone`; the application resolves that tuple once to `scheduledAtUtc`. The UTC instant is authority for ordering and future jobs; the tuple is authority for explaining the user's intent. Both must remain round-trip consistent.

* **Defaults:** default selected timezone to a valid Board timezone if a future Board preference exists; otherwise the current user's saved IANA timezone; otherwise `Intl.DateTimeFormat().resolvedOptions().timeZone`. Show that default before confirmation. Browser zone is a default only, never implicit persisted meaning.
* **Board timezone:** none exists now. BW-31.4 need not add a Board-wide field. If later added, changing it changes display defaults, not existing instants or stored selected zones.
* **Display:** event time defaults to its selected scheduling timezone and always shows a zone abbreviation plus accessible full IANA zone. An optional “view in my timezone” projection may convert display, but labels both zones and never mutates data.
* **DST nonexistent time:** reject (for example a spring-forward gap), explain, and offer nearby valid choices; do not auto-shift.
* **DST ambiguous time:** require explicit earlier/later offset choice, show both UTC offsets, and persist the resulting UTC instant plus same IANA zone/local fields.
* **Boundaries:** derive month/day buckets in the selected display timezone, not by slicing UTC. Use calendar-safe year/month/day operations for midnight, month ends, leap days, and year changes. Test leap year and non-leap rejection.
* **Language:** localized labels may change; persisted numeric local components, IANA zone, and UTC instant do not. Interface language changes never parse/rewrite schedule data.
* **Account switch:** invalidate open prepared actions, rerender authorized data and timezone preference, and leave persisted schedules untouched.
* **Other viewers/timezones:** by default see the planned civil time and named zone; if local conversion is offered, it is clearly secondary. Same asset always maps to the same UTC instant.
* **Travel:** browser-zone change does not move a schedule. Rescheduling after travel starts from the stored local tuple/zone; changing zone while preserving wall time is an explicit schedule change, as is choosing “keep instant, show in new zone.”
* **Reschedule:** only deliberate confirmation can change `scheduledAtUtc`. Opening/cancelling the dialog, changing UI language, changing account, changing Board default, or rendering in another zone cannot.

## 8. Calendar information architecture

### Evaluation

| Candidate | V1 decision | Reason |
|---|---|---|
| Month | Include | Best compact campaign-planning overview; familiar and compatible with legacy month expectation. |
| Week | Defer | High interaction/layout cost and little incremental value before dense publishing operations exist. |
| Agenda/List | Include | Accessible, mobile-friendly, handles density/long labels/timezones, and is the semantic alternative to the grid. |
| Unscheduled queue | Include | Converts approved assets into action and makes “nothing on month” useful. |
| Platform filter | Include | Existing data supports it and users need channel scanning. |
| Campaign/Board filter | Current Board context only | Workspace is Board-scoped; a cross-Board picker requires broader identity/query architecture. Show Board name, do not offer a fake filter. |
| Editorial status | Compact filter or fixed approved policy | Scheduled stale/legacy/manual Published context may require visibility; queue itself is Approved-only. |
| Readiness filter | Include | Ready / Needs attention / Incomplete is deterministic and already implemented. |
| Planning filter | Include | Scheduled / unscheduled / invalid legacy. |

### Smallest useful V1

Inside `content_workspace`, add a Calendar section/mode with: Month and Agenda segmented controls; previous/today/next date navigation; compact platform/readiness/planning filters; current Board context; an Unscheduled Approved queue; selected-day/event detail preview; schedule dialog; and “Show on Canvas.” Keep Library and Review Queue projections of the same authoritative nodes. Do not create another persisted asset list or retain the legacy Calendar as a second writer.

## 9. Event design

Each compact event shows, in order: scheduled local time + short zone; title (one/two-line ellipsis); platform icon/text; readiness or blocking warning. Detail/agenda adds role, Board/campaign name, editorial status, planning state, selected timezone, media thumbnail when useful, and action buttons. “Approved” and readiness are text/icons, not color alone. Future delivery state occupies a distinct labelled row only when backed by a job.

* Same-time events sort stably by UTC instant, normalized platform, title, then node ID; never overlap visually.
* Day overflow shows the first bounded events and a keyboard-operable “+N more” disclosure opening agenda for that day.
* Long titles and German labels wrap/ellipsis without widening the grid; full title is in the event's accessible name/detail.
* Missing platform displays “Platform missing,” warning icon/text, and is blocked from new scheduling.
* Missing media uses role/platform fallback; never broken-image chrome. Media is warning/blocking only under explicit platform policy.
* Deleted assets disappear after refresh; a stale open preview says deleted and offers return to Calendar. No orphan event copy is retained.
* Changed approved content retains the event in place with “Blocked — approved content changed” until re-reviewed; never silently remove user intent.
* Conflicts (same destination/time once destinations exist; currently same platform/time advisory) are warnings, sorted consistently, and never automatically merge.
* Events have zero duration in V1; no spanning bars or invented duration.
* Past scheduled events remain “Scheduled in Funklix — publication not verified.” They never become Published based on the clock.

## 10. Scheduling workflow

### Schedule

1. Choose an eligible Approved asset from Library, Unscheduled queue, Calendar action, Inspector, or Canvas social action.
2. Prepare identity: account, Board, access generation, node ID, current editorial state, readiness, material fingerprint, current schedule revision.
3. Open accessible dialog/sheet; select date, time, and explicit IANA timezone.
4. Show platform, readiness, material-revision warning, civil time, zone, and resolved UTC preview. Require warning acknowledgement for Needs attention.
5. Confirm through the canonical guarded mutation path.
6. On success, update only scheduling metadata; preserve `Approved`; record bounded activity; mark dirty/autosave; refresh Calendar, Library, Canvas badge, Inspector, and any legacy List projection.
7. Announce success and restore focus to the initiating asset/action.

### Variants

* **Reschedule:** same dialog prefilled from canonical local tuple/zone. Compare schedule revision and fingerprint; activity records authorized old/new instants and zone. No editorial-status change.
* **Remove:** accessible confirmation dialog states that only Funklix's internal plan is removed and approval/content remain. Guard schedule revision and delete schedule metadata atomically.
* **Library:** secondary “Schedule”/“Reschedule” action. Ineligible action remains disabled with reason and direct next action rather than disappearing without explanation.
* **Calendar:** unscheduled queue opens schedule dialog; event opens bounded detail; explicit Reschedule/Remove buttons. Clicking event itself selects detail, not mutation.
* **Existing Add action:** becomes a single adapter to the same dialog and mutation service; label changes to Reschedule when canonical/valid legacy schedule exists.
* **Open asset:** action-time verify access and node existence, switch to Board, select exact ID, reveal/focus, optionally open Inspector, then restore normal Canvas keyboard flow.
* **Stale action:** no write; preserve entered choices where safe, explain content/schedule changed, and offer “Review current asset” / reload schedule.
* **Permission loss:** no write/save; close or convert dialog to read-only state, announce loss, refresh authorized projection.
* **Asset changed during scheduling:** material change blocks confirmation even if Board timestamp also changed. Non-material coordinate/comment/AI changes do not.

Never use browser `alert`, `prompt`, or `confirm` for Calendar workflows.

## 11. Drag-and-drop decision

**Decision: defer Calendar drag-and-drop from BW-31.4.** A drop looks immediate but would conceal timezone conversion, create accidental mutation, be poor on mobile, race content/schedule revisions and autosave, require action-time permission validation, need conflict messaging and undo, and exclude keyboard/screen-reader users unless an equivalent workflow exists. The explicit dialog is smaller and safer.

If introduced later, dragging only prepares a proposed date; it must open deliberate confirmation showing old/new civil time, zone, and UTC instant. It needs a keyboard equivalent (“Move schedule”), live announcements, permission/revision revalidation, conflict handling, and undo that itself is a guarded reschedule. Pointer drop alone must never persist.

## 12. Mutation path

Extend BW-31.2 with a dedicated `applyContentWorkspaceScheduleMutation(prepared)` (name illustrative) rather than broadening status transitions or calling `confirmSchedulePost()`.

**Prepare token:** account ID, Board ID, access generation, node ID, action (`schedule|reschedule|remove`), current editorial status, readiness level/codes, material fingerprint, current schedule revision/hash, proposed local tuple/timezone/resolved UTC, and warning acknowledgement. It is not authorization.

**Action-time checks, in order:** current signed-in account; current Board; same access generation; current `canEdit` and no public token; node existence; eligible role; effective Approved status; current deterministic readiness; current material fingerprint/approved fingerprint; current schedule revision (including absent state); valid strict local date/time; recognized IANA timezone; deterministic DST resolution and UTC round trip; action valid for existing state; warning acknowledgement/permitted action.

Board `updated_at`/metadata timestamp changes and unrelated-node mutations do not reject the action. Only target material fingerprint, target schedule revision, access/account/Board generation, and relevant eligibility changes do.

**Accepted consequences:** update/delete only `planningSchedule` and controlled legacy mirrors; increment schedule revision; append one bounded activity event; update target Canvas card; refill Inspector if selected; rerender Content Workspace Library/Review Queue/Calendar; update legacy List only while it exists; `markUnsaved()` exactly once; let established autosave persist. Do not call local-only save as the sole consequence, change content/status, duplicate the node, copy an asset into a calendar store, or issue a provider request.

## 13. Approved-content changes

The BW-31.2 material fingerprint includes publish-relevant node material and intentionally excludes position, comments/Post-its, and AI Review. Calendar captures that fingerprint at scheduling.

| Change before schedule | Schedule behavior | Editorial/safety behavior |
|---|---|---|
| Title/caption/body/hashtags/CTA or other fingerprint material | Retain instant and event; mark “Blocked — approved content changed.” | Existing approval is stale; require normal human review and then explicit “Confirm updated revision for this schedule” (which updates fingerprint/revision and activity). |
| Platform/channel material | Retain schedule and block; show old planned context only if available without copying content. | Reapprove and explicitly reconfirm; destination compatibility later must be revalidated. |
| Media/favorite media where included in material fingerprint | Retain and block/warn according to current fingerprint implementation and formal media policy. | Reapprove/reconfirm; do not silently substitute media in future job. |
| Canvas coordinates/compact geometry | Retain unchanged. | Non-material; no rejection or reconfirmation. |
| Comments/replies/resolution | Retain unchanged. | Non-material to fingerprint; unresolved feedback remains visible. |
| AI Review/result/score | Retain unchanged. | Advisory and non-material; never gates eligibility. |

Preserving the schedule protects user intent. Automatically removing it loses planning context; automatically treating changed content as safe risks wrong publication. BW-31.4 therefore retains-but-blocks. It does not require changing the instant unless the user chooses to reschedule, and it never publishes.

## 14. Permissions

| Principal | View authorized schedule/filter/navigate | Schedule/reschedule/remove/status/timezone/save |
|---|---|---|
| Board owner | Yes | Yes, after all action-time guards. |
| Board editor | Yes | Yes, under existing Board edit permission and same guards. |
| Board viewer | Yes if Board access authorizes content | No. |
| Brand Viewer | Only schedule data reachable through an independently authorized Board; Brand role alone grants no Board mutation | No. |
| Public Viewer | Only schedule information included by Board public-view policy; read-only navigation to authorized Canvas nodes | No controls and no save. Consider minimizing actor identity/timezone detail exposed publicly. |
| Signed-out user | Only a valid Public Viewer surface | No. |

Filtering, month navigation, agenda switching, and opening authorized assets are local UI actions and do not trigger save. Read-only users cannot alter scheduling timezone; they may toggle a non-persisted “display in my timezone” view if implemented. Every mutation revalidates permission at confirmation, not only when rendering the button.

## 15. Activity and History

Add bounded transition types: `asset_scheduled`, `asset_rescheduled`, `asset_schedule_removed`, and `asset_schedule_blocked_content_changed` (the last should deduplicate per node/schedule revision/fingerprint, not on every render).

Allowed event payload: event ID/type; actor ID/display name; node ID and bounded title; UTC event timestamp; old/new scheduled UTC instant as applicable; old/new IANA timezone as applicable; resulting schedule revision; scheduled material fingerprint or short non-sensitive revision token. Do not copy captions, bodies, media blobs, complete node objects, provider tokens, or destination credentials. Public/read-only rendering may redact actor and precise history according to existing authorization.

History text examples: “Ada scheduled ‘Launch post’ for 25 Oct 2026, 09:30 Europe/Berlin”; “Ada rescheduled … from … to …”; “Ada removed the internal schedule …”; “Scheduling blocked because approved content changed.” Show an “Internal plan” badge so history cannot be mistaken for provider delivery. Use semantic theme tokens for surface/text/border/success/warning, readable contrast in Light/Dark, text+icon rather than color alone, wrapping timezone/long German text, `<time datetime>` for machine-readable instants, and a bounded visible list consistent with the existing 50/15 limits.

## 16. Legacy compatibility

* **Add to Posting Calendar:** preserve entry points but route to canonical dialog/service; never retain a second writer.
* **Legacy fields:** tolerate absent/partial/wrong-type values. Canonical valid object wins. Coherent split fields become a legacy schedule with unknown zone. Combined `scheduledAt` is only fallback. Contradictions show “Schedule needs review,” not a guessed event.
* **Existing `Scheduled` status:** Content Workspace normalization currently recognizes it although the Inspector canonical statuses do not. Treat as an unknown/legacy editorial label, not proof of planning. Derive planning solely from schedule metadata. Do not rewrite until an explicit compatible editorial transition.
* **Existing `Published`:** display “manually marked Published — external publication not verified.” Never generate delivery state or metrics from it.
* **Legacy navigation:** while retained, make it a read-only redirect/projection of the canonical Calendar or clearly label it legacy. It must not mutate through old code.
* **Older Boards:** absent `planningSchedule` is normal Unscheduled. Load remains permissive; no schema bump may reject old nodes solely for missing schedule metadata.
* **Missing timezone:** display the original wall time if coherent, label timezone unknown, exclude from UTC ordering/provider preparation, and offer editors “Review schedule.” Do not assume browser/UTC.
* **Malformed dates:** quarantine from month placement; expose in an “Invalid legacy schedules” recovery state with Show on Canvas/Review schedule.
* **Duplicates:** if canonical and legacy agree, show once. If conflicting, canonical wins and warning/telemetry records legacy conflict. Never render two events for one node.
* **Migration-on-write:** only a guarded confirmed schedule/reschedule/remove canonicalizes or removes fields. Read/load/render is non-mutating.

## 17. Publishing boundary

BW-31.4 Calendar V1 **may** create internal publishing plans, display/reschedule/remove them, expose readiness and approval staleness, navigate to authoritative assets, and persist future-safe planning identity.

It **must not** say or imply that Funklix connected to LinkedIn/Meta/X/TikTok/another provider, submitted a request, created an external schedule, received provider acceptance, published a post, has analytics available, or selected a connected account. Safe copy is “Scheduled in Funklix” and “Internal plan — not submitted to a platform.”

Future handoff is explicit and entity-based:

1. A **Social Connection** authorizes a provider for a Funklix account/workspace.
2. A **Publishing Destination** identifies a compatible provider profile/page/channel.
3. A guarded command snapshots/references the approved revision and internal schedule into a **Publish Job** with idempotency key and delivery lifecycle.
4. Provider acceptance/publication creates or updates an **External Post** identity/URL and provider timestamps.
5. Reconciliation—not elapsed local time—advances delivery state.

## 18. Social Connector readiness

Future connectors require platform, publishing destination, provider external account ID, publish job ID, canonical scheduled UTC instant, scheduling timezone, asset/approved revision, immutable media references, idempotency key, delivery state, provider response timestamp, external post ID, and external URL.

Calendar V1 should retain only platform (already on node), UTC instant, IANA timezone, and scheduled asset fingerprint/revision identity. Destination/account IDs, job ID, idempotency key, delivery/provider timestamps, external ID/URL, retries, and provider responses belong to future connection/job/post records. Media remain authoritative node/revision references; do not duplicate them into planning metadata. This separation avoids fields that falsely imply provider operations.

## 19. Measured-performance mapping

Future lineage should be explicit:

`Funklix account/workspace → Board ID → Canvas node ID → approved immutable revision/fingerprint → internal schedule ID/revision → Publishing Destination → Publish Job → External Post(provider + external ID) → reporting period → immutable metric snapshot/source timestamp`.

A schedule captures intent, not observation. Even a past schedule does not prove submission, provider acceptance, publication, impressions, engagement, conversions, attribution, or revenue. Metrics become “Measured” only when a verified provider/import source identifies the external post and reporting period. Missing connector/post mapping stays Unavailable; simulation/inference remains separately labelled under the BW-28 data-classification boundary.

## 20. UX states

| State | Honest message | Next safe action |
|---|---|---|
| No Board | “No Board is open.” | Open Boards / return to Canvas. |
| No approved assets | “No approved assets are ready to plan.” | Open Review Queue. |
| Approved but unscheduled | “Approved assets are waiting to be planned.” | Select an eligible queue item and Schedule. |
| Empty month | “No internal schedules in this month.” | Today/next month, clear filters, or use Unscheduled queue. |
| No filter results | “No scheduled assets match these filters.” | Clear individual/all filters. |
| Invalid legacy date | “This saved schedule cannot be interpreted safely.” | Review schedule or Show on Canvas. |
| Missing timezone | “Timezone missing; instant is not verified.” | Editor: Review schedule; viewer: view asset. |
| Scheduling conflict | “Another item uses this time/platform.” | Continue deliberately or choose another time; no silent move. |
| Stale asset | “Asset changed while scheduling.” | Review current asset and reopen dialog. |
| Deleted asset | “This asset was deleted.” | Close preview and refresh Calendar. |
| Access revoked | “You no longer have access to change this schedule.” | Reload authorized read-only view / Boards. |
| Changed approved content | “Schedule retained, but approved content changed.” | Re-review then confirm updated revision. |
| Past without publication | “Scheduled time passed; external publication is not verified.” | Show on Canvas; future connector may reconcile. |
| Calculation/render failure | “Calendar could not be calculated. No content changed.” | Retry rendering or use Agenda/Canvas. |

All states preserve data and offer a non-destructive next action. No empty state offers “Publish” before a connector exists.

## 21. Responsive design

Use BW-30.1's full-width `content_workspace` shell; never reserve/mount Inspector width there.

* **Desktop:** compact seven-day month grid; persistent bounded Unscheduled queue alongside/below based on width; compact sticky filters; selected asset preview capped in width/height; overflow disclosure rather than expanding days indefinitely.
* **Tablet:** default to the last chosen Month/Agenda if usable, but offer prominent Agenda; month cells remain readable and event details move to a modal/panel; schedule dialog is comfortably scrollable; no Inspector reservation.
* **Mobile:** Agenda first; compact previous/today/next date navigation; no seven-column horizontal scroll trap; full-width bottom schedule sheet; at least 44px controls/targets; event metadata stacks; filters use accessible disclosure.

Long German labels, asset titles, IANA timezone names, and validation messages wrap with `min-width:0`/overflow-safe treatment. Native date/time controls must not overflow. Orientation/resize preserves focus and selected date without mutating schedule.

## 22. Theme behavior

Calendar page, controls, day cells, today, selected day, events, queue, status/readiness badges, warnings, dialog/sheet, date/time inputs, timezone selector, empty states, and History events must use the existing semantic surface/text/border/focus/success/warning/danger tokens.

Today and selected day need distinct text/icon/border semantics in both themes. Platform accents cannot be the only label and must meet contrast. Dark Mode explicitly styles native control backgrounds, text, icons/color-scheme, option menus where controllable, dialog backdrop/surface, hover/selected/focus, empty surfaces, and warnings—no white native-looking islands. Thumbnail fallbacks and skeletons use theme surfaces. Validate Light/Dark at all breakpoints rather than relying on broad `.board-list-view` rules.

## 23. Accessibility

* Provide a labelled calendar region with month heading and proper grid/table semantics: weekday headers, row/day relationships, full localized date labels, today/selected annotations. Do not put interactive event buttons inside an invalid grid keyboard model.
* Implement documented arrow-key day navigation, Home/End within week, Page Up/Down month changes (with modifiers if adopted), Enter to select/open; retain Tab for actionable controls. Announce month changes politely.
* Agenda is a fully equivalent semantic list grouped by date, not a reduced fallback.
* Event accessible names include title, date/time, IANA timezone, platform, editorial/readiness/planning warning, and “internal plan; publication not verified.” Avoid noisy duplicate thumbnail alt text.
* Schedule UI uses `role=dialog`, `aria-modal`, labelled title/description, explicitly associated date/time/timezone labels/help/errors, initial logical focus, focus trap, Escape cancellation when safe, and focus restoration to the invoker.
* Announce timezone default/change and resolved offset/ambiguity. Errors use `aria-describedby` plus an assertive/polite error summary as appropriate and move focus to summary/first invalid control.
* Never communicate status by color alone. Text/icon/pattern and accessible name carry status.
* Honor reduced motion; scrolling/pulsing is nonessential and focus remains visible.
* Any future drag/drop needs the equivalent keyboard Move Schedule dialog and live drop-position announcements.

## 24. Architecture alternatives

| Alternative | Compatibility/autosave | Stale revisions | Publishing/analytics/cross-Board/recurrence | Complexity | Verdict |
|---|---|---|---|---|---|
| 1. Metadata on Canvas nodes | Excellent with current `canvas_json`, node authority, dirty/autosave; easy old-Board defaults | Can capture BW-31.2 fingerprint + schedule revision | Poor if provider jobs/metrics are overloaded onto mutable node; cross-Board query/recurrence limited | Lowest | Suitable for internal V1 planning only. |
| 2. Separate persisted Schedule entities now | Requires new tables/API/query/save transaction outside current Board autosave | Strong identity/history possible | Best cross-Board/recurrence and connector mapping | Highest; expressly outside current scope | Premature for V1 and violates no-table boundary. |
| 3. Hybrid node planning + future jobs/posts | V1 fits current persistence; future delivery gets durable identities | Fingerprint now; immutable job snapshot later | Good connector/analytics mapping; future cross-Board query can project entities without content copies | Moderate, phased | **Recommended.** |
| 4. Reuse legacy Calendar/fields | Superficially easy but writer bypasses canonical guarded mutation | None | Unsafe timezone, no job identity, false status pressure, weak analytics lineage | Low initial / high remediation | Reject. |

## 25. Recommended architecture

Confirm the baseline direction: authoritative Canvas node content remains singular; additive node `planningSchedule` models only internal intent; Content Workspace purely projects Library/Review/Calendar from live nodes; schedule actions extend BW-31.2's guarded node mutation boundary; future Publish Jobs and External Posts are separate persisted entities referencing account/Board/node/schedule/approved revision; metrics reference External Post and snapshots rather than schedules.

This is the smallest future-safe approach supported by repository evidence: node objects already survive permissive Canvas save/load and are refreshed across Canvas/Inspector/List/Workspace; no database schedule or provider schema exists; BW-31.2 already supplies fingerprint and action-time guard patterns. Recurrence and cross-Board operational calendars remain deferred because node-local V1 metadata cannot efficiently query them globally.

## 26. Implementation phases

### BW-31.4 — internal Calendar

Canonical node planning metadata and legacy adapter; strict timezone conversion; eligibility; Month + Agenda; Unscheduled Approved queue; compact filters; accessible schedule/reschedule/remove dialog; Show on Canvas; blocked changed-content presentation; bounded activity; synchronized Calendar/Library/Canvas/Inspector/List; localization/theme/responsive/accessibility; no provider calls.

### Future Social Connector phase

Connection authorization/health; Social Accounts and Publishing Destinations; immutable revision/media preparation; Publish Jobs; idempotency; delivery/retry/reconciliation states; External Post identity; explicit cancellation/provider-deletion semantics. This phase requires a separate persistence/security audit.

### Future Analytics phase

External-post mapping; authorized metric ingestion/synchronization; reporting periods and immutable metric snapshots; stale/sync-failed states; measured/inferred/simulated provenance; no schedule-derived metrics.

## 27. Blast-radius table

| Area | Failure mode | Safeguard | Required regression |
|---|---|---|---|
| Content Workspace | Calendar copies/stales assets or breaks Library/Review | Pure projections from live nodes; one mutation adapter | Library/Review parity, no duplicate records, synchronization. |
| Canvas nodes | Additive metadata lost or content overwritten | Narrow schedule-only write; persistence sanitizer fixture | Round-trip old/new node and unrelated-field equality. |
| BW-31.2 review | Schedule changes editorial status or bypass approval | Independent dimensions; reuse fingerprint/readiness | Approved remains Approved; non-approved blocked. |
| Approval fingerprints | Non-material changes stale; material changes pass | Use exact BW-31.2 fingerprint and captured value | Material matrix, coordinates/comments/AI exclusions. |
| Inspector | stale badge/action or workspace reserves Inspector | targeted refill; BW-30.1 full layout | selected/other node updates and no width reservation. |
| Canvas badges | wrong local time or “Published” implication | canonical formatter and “Scheduled in Funklix” | timezone rendering/no automatic publication. |
| Autosave | local-only write, duplicate saves, read-only save | `markUnsaved()` once; established autosave guards | dirty/save lifecycle and view-only zero network/save. |
| Save/load | old Board rejected or canonical object malformed | optional versioned object; tolerant read/quarantine | old/absent/malformed/valid round trips. |
| Activity/History | unbounded content/PII or duplicate events | narrow sanitizer, 50/15 bounds, dedupe blocked event | payload/bounds/theme/render tests. |
| Legacy Calendar | two writers/duplicate event/conflicting source | redirect/read-only projection; canonical precedence | Add action and contradictory-field fixtures. |
| Social node actions | old direct mutation survives | every entry point invokes same dialog/service | Canvas/Inspector/Library/Calendar action parity. |
| Public Viewer | mutation controls/save or schedule leakage | render-time hiding + action-time rejection + privacy projection | public-token navigation and zero mutation/save. |
| App Shell | Inspector/sidebars compress Calendar | BW-30.1 `content_workspace: full` | desktop/tablet/mobile shell dimensions. |
| Localization | locale changes instant or mixed EN/DE | keys for all copy; format-only locale | EN/DE instant equality and long-label wrapping. |
| Themes | white controls/low status contrast in Dark | semantic tokens and native control treatment | Light/Dark state matrix and contrast checks. |
| Mobile | seven-column trap, tiny controls, inaccessible sheet | agenda-first, 44px, full-width sheet | viewport/keyboard/focus tests. |
| Future publishing | node claims provider acceptance or stores secrets | strict `internal_planning`; separate job entities | forbidden claims/fields/network calls. |

## 28. Regression specification

A future `check:bw31.4` must exercise runtime behavior, not regex alone, and must be registered after BW-31.2 in complete Runtime Boot Safety. Minimum checks:

1. Canonical fields validate/version/round-trip; absence means Unscheduled; malformed objects quarantine safely.
2. Civil date/time + IANA zone convert to expected UTC and round-trip; reject offset-only/fake zones.
3. DST spring gap rejects; fall overlap requires earlier/later choice; test multiple zones, UTC, midnight/month/year boundaries, leap day and non-leap invalid date.
4. Schedule eligible Ready Approved Social; Needs attention requires acknowledgement; Incomplete, missing platform/content, unsupported role, Draft/In Review/Needs Changes reject; AI score does not affect result.
5. Reschedule increments revision and records old/new instant; remove clears canonical/legacy schedule; none changes editorial status/content.
6. Prepared-action stale guards reject account/Board/access/node/material/schedule changes and permission loss. Unrelated-node and Board timestamp-only changes succeed; coordinate/comment/AI-only target changes follow fingerprint exclusions.
7. Approved material changes retain schedule and render blocked; reapproval plus explicit reconfirm updates scheduled fingerprint. No silent removal/reschedule.
8. Advancing clock beyond scheduled instant never writes/displays external Published. UI contains no provider-success, connection, analytics-availability, or external-scheduling claim and emits no social-provider request.
9. Legacy absent/split/combined/malformed/missing-zone/contradictory values and legacy Scheduled/manual Published statuses render honestly; canonical precedence and migration-on-write are deterministic; old Boards load.
10. Owner/editor mutate; viewer/Brand Viewer/Public Viewer/signed-out cannot. Read-only users filter/navigate authorized assets without dirty/save/network mutation. Action-time permission revalidation is explicit.
11. Accepted actions mark dirty once, enter autosave, survive save/load, append one bounded activity event, and synchronize Calendar, Library, Canvas badge, Inspector, and legacy List without duplicate asset records.
12. Month navigation/day bucketing/event overflow/same-time stable sorting/empty states work; Agenda is equivalent; Unscheduled queue contains only eligible Approved unscheduled assets and explains blocked items.
13. Show on Canvas selects/reveals exact live node and rejects deleted/stale/access-revoked targets.
14. English/German localize all visible/accessible strings while UTC instant remains byte-identical. Long German/timezone strings wrap.
15. Light/Dark render every semantic state without white islands; desktop/tablet/mobile use full-width shell, agenda-first mobile, 44px controls, and no horizontal calendar trap.
16. Accessibility checks cover calendar semantics, keyboard date movement, Agenda alternative, event names, dialog focus trap/restoration, associated labels/help/errors, timezone/DST announcements, non-color status, reduced motion, and keyboard-equivalent policy.
17. Run BW-26 through BW-31.2 compatibility commands appropriate to the changed files, browser-script syntax/integrity, and the **complete** Runtime Boot Safety workflow—not a reduced subset.

## 29. Expected files

Likely future implementation scope (not changed by this audit):

* `content-workspace.js` — projection, eligibility, legacy adapter, canonical schedule validation, Calendar UI/dialog.
* `app.js` — narrowly scoped guarded schedule mutation integration, timezone conversion boundary if not in module, surface refresh, activity sanitizer/renderer, legacy action routing.
* `language.js` — all Calendar, timezone, reason, activity, accessibility, and honest-boundary copy.
* `styles.css` — scoped Calendar/month/agenda/queue/dialog/theme/responsive states.
* Possibly `index.html` — only if a static accessible host/template is preferable; Content Workspace already has a host.
* One runtime regression script such as `scripts/check-bw31-4-content-calendar.js`.
* `package.json` and `.github/workflows/runtime-boot-safety.yml` only to register that future regression (they are explicitly unchanged in BW-31.3).

No separate schedule table/API is expected in BW-31.4.

## 30. Unchanged systems

BW-31.4 should leave API provider endpoints, external social APIs, Persona Journey, Campaign Creator schema/generation contract, authentication/Board-role policy, Canvas geometry/edges, Brand persistence, AI Insights formulas/data classifications, analytics storage, and provider credential handling unchanged. It consumes existing Board access outcomes; it does not invent permissions. It may rerender but must not alter unrelated node content, review notes, AI Review, Brand state, campaign structure, or metrics.

## 31. Go/no-go criteria

Implementation is **NO-GO** unless its plan and tests preserve all of these gates:

- [x] Current scheduling fields and every reader/writer are inventoried.
- [x] Current authoritative content/date sources and their contradictions are identified.
- [x] Explicit IANA civil-time → canonical UTC contract and DST behavior are defined.
- [x] Role, approval, readiness, platform/content, and warning eligibility rules/reason codes are deterministic.
- [x] Small additive scheduling metadata, revision/fingerprint, and migration-on-write are defined.
- [x] Editorial, planning, delivery, and performance state remain independent.
- [x] BW-31.2-style action-time mutation guards and refresh/autosave consequences are specified.
- [x] Material approved-content changes retain but block the schedule; non-material changes do not invalidate it.
- [x] Owner/editor/read-only/Public Viewer boundaries are defined.
- [x] Old/malformed/missing-zone/duplicate fields and manual Scheduled/Published labels load safely and honestly.
- [x] Calendar V1's provider/publishing/analytics boundary and future handoff entities are explicit.
- [x] Exact V1 IA is Month + Agenda + Unscheduled Approved queue + compact filters/dialog/detail/Show on Canvas; Week and drag/drop are deferred.
- [x] Runtime-capable regression matrix and complete Runtime Boot Safety requirement are defined.

The implementation remains NO-GO if it proposes parsing locale strings into persisted data, silently assumes timezone for legacy values, makes elapsed schedules Published, uses `node.status` for delivery, duplicates assets, bypasses dirty/autosave, exposes mutations to read-only users, or claims provider behavior.

## 32. Final recommendation

Proceed to a narrowly scoped BW-31.4 implementation only after adopting the hybrid contract and tests above. Build one honest internal-planning Calendar inside Content Workspace, make the UTC instant + IANA zone + approved material fingerprint explicit, and route every scheduling entry point through one action-time guarded node mutation. Preserve schedule intent when content changes but block unsafe future preparation until the approved revision is reconciled. Defer drag-and-drop, Week view, destinations, Publish Jobs, provider states, External Posts, and measured performance to independently audited phases.

The repository evidence rejects reusing the legacy fields/rendering as the final architecture: they are useful compatibility input but not a trustworthy lifecycle. Calendar V1 succeeds when users can plan and navigate approved work without ever being led to believe Funklix contacted or published to an external platform.

**AUDIT READY FOR REVIEW**
