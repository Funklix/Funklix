# Posting Plan Scheduling & CSV Export — End-to-End Audit

**Audit date:** 2026-09-18

**Scope:** documentation-only audit of the existing posting-planning, scheduling, calendar, Social Media Posting, persistence, approval, publishing, authorization, and export architecture.

**Change boundary:** this document is the only repository change. No production code, tests, dependencies, migrations, provider calls, or social posts were changed or created.

## 0. Evidence vocabulary and executive result

This audit uses the following labels deliberately:

- **Proven behavior** — directly established by a named implementation or regression check in this repository.
- **Inference** — a conclusion from multiple implementation facts, not an explicitly enforced contract.
- **Recommendation** — proposed future behavior; it does not exist today.
- **Unresolved production question** — cannot be proved from the repository and must be decided or verified before implementation.

### Executive result

**Proven behavior.** Funklix already has a strong internal-planning primitive: `node.planningSchedule` version 1, timezone-aware local-to-UTC validation, DST ambiguity handling, an editor-only guarded mutation boundary, Board JSON persistence, stale-dialog schedule revisions, and a Content Workspace month/agenda calendar. Scheduling is expressly additive internal metadata; it does not create a provider job and it does not change editorial status. The v2 approval contract explicitly excludes `planningSchedule` from approved material.

**Proven behavior.** The product simultaneously retains a second, obsolete Calendar View and retired scheduling overlay. The old calendar reads only `social.addedToCalendar`, `social.scheduledDate`, `social.scheduledTime`, and `social.scheduledAt`; the canonical writer deletes those aliases. Thus the navigation-level Calendar View can show zero events after a successful canonical schedule while Content Workspace Calendar shows the event. Several node/list labels also still test only `social.scheduledAt`.

**Proven behavior.** No Posting Plan export, CSV serializer, export preview, export authorization contract, automatic scheduler, conflict/capacity model, bulk scheduling transaction, node-level destination, node-level archived state, or canonical node creation/update timestamps exist.

**Recommendation.** Retain `planningSchedule` as the canonical scheduling authority inside each persisted Social Media Posting node for phases 1–4. Add a narrow authenticated Board-scoped schedule write contract (or a rigorously conflict-checked Board update) before building UX. Use Content Workspace—not the obsolete Calendar View—as the reusable UI foundation. Run CSV projection and serialization in the browser from the already-authorized Board snapshot, after explicit preview and confirmation; do not send captions and media references to a new server merely to create a file.

---

## 1. Existing scheduling surface inventory

### 1.1 Canonical Content Workspace surface

| Surface / symbol | Exact evidence and source data | Mutation / persistence path | Classification |
|---|---|---|---|
| `SCHEDULABLE_ROLES` | `content-workspace.js:45`; exactly `['Social Media Posting']`. | Read-only eligibility input. | **Authoritative eligibility rule** in the browser, but not a server schema. |
| `SUPPORTED_PLATFORMS` | `content-workspace.js:45`; LinkedIn, Instagram, Facebook, X / Twitter, TikTok. | Read-only eligibility input. | **Authoritative browser rule** only. |
| `readPlanningSchedule(node)` | `content-workspace.js:57`; reads canonical `planningSchedule`, validates timezone, local date/time, UTC equivalence and positive integer revision; otherwise projects legacy `social.*` schedule fields. | No write. Legacy fields are not upgraded on read. | **Canonical reader plus partial legacy adapter.** |
| `evaluateScheduling(input)` | `content-workspace.js:58`; consumes account, Board, edit/public access, node role/status, derived readiness, warning acknowledgement, platform/caption, and optional date/time/timezone. Separates planning blockers from later-publishing blockers. | No write. | **Complete single-node browser eligibility evaluator** for current manual planning; not an export or bulk-scheduler eligibility contract. |
| `prepareSchedule(asset,c)` | `content-workspace.js:59`; captures account ID, Board ID, node ID, editorial status, readiness, material fingerprint and schedule revision. | Produces a temporary dialog capability/stale-check snapshot. | **Temporary UI state.** |
| `primaryDecision`, `actions` | `content-workspace.js:63-65`; chooses review, immediate provider publishing, planning, open, or unavailable actions. Schedule/Reschedule and Remove schedule appear in card actions/menu. | Buttons dispatch through `openContentPlanning` or `removeSchedule`; no direct node write. | **Functional**, although publishing often outranks scheduling as the primary action. |
| Card “Not planned” / “Planned” | `card` in `content-workspace.js:71`; sourced from projected `planningSchedule` and `scheduledDate`. | No mutation. | **Functional canonical rendering**, but caption is truncated to a four/three-line preview by `.cw-preview` (`styles.css:7973,7994`), unsuitable as the primary full-content export-review surface. |
| Planning filters | `preferences` and `applyView`, `content-workspace.js:44,47`; `planning=planned|unscheduled`, exact local date, plus the “Unscheduled” attention shortcut. EN/DE strings are at lines 10–11. | Local module memory only; `resetCalendar` clears it. | **Local-only view state.** |
| `openContentPlanning` | `content-workspace.js:118`; accepts only the enumerated `PLANNING_SOURCES` from line 117, re-resolves live node/access/Board, evaluates eligibility, routes feedback, opens the dialog. | Calls `openScheduleDialog`; no direct write. | **Functional guarded command entry.** |
| `openScheduleDialog` | `content-workspace.js:98`; native date and time inputs, IANA timezone text input/datalist, live localized preview, DST gap/ambiguity handling, warning acknowledgement, Escape, Tab loop, trigger focus restoration. | Calls injected `c.onSchedule`, which is `applyContentWorkspaceSchedule` in `app.js`. | **Functional single-post control.** No explicit saving/pending disable state; repeated confirm is not locally locked. |
| `removeSchedule` | `content-workspace.js:99`; uses the same prepared schedule revision. | Calls `c.onSchedule({...p, remove:true})`. | **Functional local mutation**, asynchronously persisted only through Board autosave/manual save. |
| `calendarState` | `content-workspace.js:46`; `mode`, month/agenda `view`, month, selected date, role/platform/readiness/warning/owner filters. | Module memory; reset when account/Board/access context changes (`render`, line 96; `resetCalendar`, line 121). | **Temporary UI state.** `selectedDate` and `warning` are present but no meaningful scheduler workflow depends on them. |
| `renderCalendar` / `renderMonth` / `renderAgenda` | `content-workspace.js:87-95`; month keys/days use UTC date arithmetic, events come from valid/invalid projected schedules, and an unscheduled eligible queue is rendered. | Visual only; buttons open details or schedule dialog. | **Reusable visual calendar**, not scheduling authority. |
| Calendar event detail | `bind`, `content-workspace.js:116`; shows title, role/platform, local date/time/timezone, changed/internal warning, Show on Canvas, Reschedule, Remove. | Reschedule/remove use the canonical mutation callback. | **Functional.** Dialog has Escape and initial focus but does not implement a Tab focus loop like the schedule/publish dialogs. |
| Calendar overview states | `renderCalendar`, `content-workspace.js:95`; scheduled, unscheduled, blocked, today; event warning is driven by invalid schedule or changed approved material. | No mutation. | **Derived browser display.** “Blocked” counts only scheduled records that are invalid/changed, not all unschedulable posts. |
| Planning feedback | `routePlanningFeedback` (`content-workspace.js:93`) and `routeContentOperationsFeedback` (`app.js:17035-17048`). | ARIA live message placed at inspector/canvas source or workspace feedback. | **Functional local feedback.** |

The Calendar-specific EN/DE strings are declared in `calendarText` in `content-workspace.js` (including Calendar, Month, Agenda, Schedule, Reschedule, Remove schedule, Date, Time, Timezone, Unscheduled approved, ambiguous/nonexistent local time, warning acknowledgement, and internal-planning disclosure). General scheduling terms are also duplicated in `language.js:18,28,209`. **Inference:** two localization stores can drift because Content Workspace uses its private dictionary while shell/inspector uses `language.js`.

### 1.2 Canonical browser writer and pending state

**Proven behavior.** `renderContentWorkspace` injects `applyContentWorkspaceSchedule` as `onSchedule` (`app.js:17100-17146`). The sole scheduling writer (`app.js:17149-17195`):

1. requires the current authenticated account, edit access, no public token, and the prepared account identity;
2. re-resolves the current Board/node and rejects changed Board, access, missing node, material fingerprint, editorial status, readiness, or schedule revision;
3. re-runs `evaluateScheduling` and recomputes local date/time/timezone to UTC;
4. writes or deletes `node.planningSchedule` without changing `node.status`;
5. deletes legacy `social.scheduledDate`, `scheduledTime`, `scheduledAt`, and `addedToCalendar` after a deliberate canonical mutation;
6. records a bounded `schedule_created`, `schedule_rescheduled`, or `schedule_removed` activity;
7. updates the Canvas/list/legacy calendar/workspace; and
8. calls `markUnsaved()`, which schedules whole-Board autosave.

`state.pendingScheduleNodeId`, `state.scheduleDate`, and `state.scheduleTime` (`app.js:99` and `closePostingPlanner`, `app.js:10157-10168`) belong to the retired overlay and are not used by active scheduling. There is no canonical per-node “schedule saving” map. **Classification:** the old fields are **dead/placeholder local state**; canonical scheduling has **no explicit pending-persistence state** beyond global Board dirty/saving status.

### 1.3 Obsolete shell Calendar View and retired overlay

| Surface | Evidence | Current behavior | Classification |
|---|---|---|---|
| Shell Calendar View | `index.html:611-618`; `renderCalendarView`, `app.js:16823-16875`. | Generates a Monday-first local-time month grid, but includes only Social Media Posting nodes with all legacy `social.addedToCalendar`, `scheduledDate`, `scheduledTime`, and `scheduledAt`. Supports multiple buttons per day; displays time, platform, caption snippet, last image; click returns to Canvas. No filters, timezone, conflicts, move/edit, or canonical `planningSchedule` read. | **Misleading obsolete visual surface.** |
| Retired posting overlay | `index.html:872-884`; Date/Time and Add to Calendar controls. `confirmSchedulePost`, `app.js:10164-10168`, only closes it; no active code opens it. Listeners remain at `app.js:18319-18320`. | Cannot write any schedule. | **Placeholder/dead UI.** |
| Canvas card Schedule button | `app.js:13866-13873`. | Opens canonical dialog, but label and scheduled class inspect only `node.social.scheduledAt`, so a canonical schedule can still say “Add to Posting Calendar.” | **Action functional; rendered state incomplete/misleading.** |
| Inspector Add to Posting Calendar | visibility in `app.js:13225-13268`, display in `app.js:15318-15325`, listener in `app.js:17965-17969`. | Uses `planningSchedule || social.scheduledAt`, formats canonical local time/timezone, and opens canonical dialog. | **Functional canonical entry.** Read-only disabling relies on broader form/access state rather than the visibility helper’s node-type-only disabled expression. Writer still enforces access. |
| List metadata and scheduled filter | `getNodeListMeta`, `app.js:13441-13451`; list state tokens at `app.js:14095,14190`. | Inspects only `social.scheduledAt`; canonical schedules may not render/filter as Scheduled. | **Incomplete legacy projection.** |
| Status values | `normalizedStatus` and `STATUS_ORDER`, `content-workspace.js:4,28-29`. | Draft, In Review, Needs Changes, Approved, Scheduled, Published are normalized and rendered. The canonical scheduler deliberately permits only Draft/In Review/Needs Changes/Approved and never sets Scheduled; Scheduled/Published are not plannable. | **Scheduled status is a legacy/editorial label, not canonical schedule truth.** |
| “Unavailable” states | Facebook/LinkedIn action strings and `primaryDecision`, `content-workspace.js:12-23,63-65`; planning blocker messages at line 92. | Provider connection/destination/payload/approval availability is distinct from internal planning eligibility. | **Functional provider/readiness state; must not be conflated with schedule state.** |

### 1.4 Styles and accessibility coverage

**Proven behavior.** Calendar and schedule styles are concentrated at `styles.css:7964-7966`; Content Workspace cards at `7973-7995`; dialogs/dark mode at `7982-7985`; publish preview at `8010`. Existing tokens have fallbacks and the workspace defines dark tokens. Month becomes agenda-only below 640px, layout collapses below 900px, dialogs become bottom sheets, controls meet 44/48px target sizes, and reduced motion is honored.

**Gap.** The old `.calendar-grid` begins at `styles.css:3232` and is an unrelated visual system. The future scheduler must not extend both systems. Existing full-post review fails the stated goal because `.cw-preview` clamps captions. The schedule dialog timezone is a free text field with a short datalist, not a complete accessible IANA picker.

### 1.5 Existing scheduling tests

**Proven behavior.** `scripts/check-bw31-4-content-calendar.js` is the focused scheduling regression. It covers role/status/readiness/access eligibility; Berlin UTC conversion; nonexistent and ambiguous DST times; valid/invalid zones; canonical schedule validation and material-change warning; legacy projection; month/agenda render; public-view schedule-action suppression; guarded writer tokens; no provider publishing from the writer; localization; responsive/reduced-motion styles; and absence of provider queue/domain concepts from the workspace module.

Related workspace checks:

- `scripts/check-bw31-1-content-workspace-library.js`: projection, readiness, filters, sorting, status display, safe output, and workspace CSS/localization.
- `scripts/check-bw31-2-content-review-workflow.js`: editorial transitions and access protections.
- `scripts/check-bw31-5-1-content-functional-recovery.js`: live re-resolution and scheduling entry routing.
- `scripts/check-bw31-5-2-content-workspace-ux.js`: card/attention UX and responsive/localized behavior.

**Gap.** These are predominantly source/fixture checks. There is no test that a canonical schedule is sent by actual Board serialization, accepted by the real PUT route, reloaded into a second session, merged from collaboration, or exported.

---

## 2. Canonical Social Media Posting structure for planning/export

There is no declared JSON Schema or TypeScript type. The practical shape is formed by `createNode` (`app.js:9980-10017`), inspector/canvas mutations, `sanitizeNodeForPersistence` (`app.js:5065-5105`), Content Workspace projection, approval projection, and provider services.

### 2.1 Field map

| Requested datum | Current field/source | Authority/classification | Export consequence |
|---|---|---|---|
| Node ID | `node.id`, created by `createNode`; retained in Board `canvas_json.nodes`. | **Persisted, authoritative within a Board.** It is a string, not proved globally unique. | Include as opaque Node ID. |
| Board ID | `state.currentBoardId` / route `boards.id`; not stored on the node. | **Persisted Board row authority.** | Supply from authorized Board context, never infer from node. |
| Node type | `node.type`; exact schedulable value `Social Media Posting`. | **Persisted.** | Include only through eligibility, not necessarily a CSV column. |
| Title | `node.title`. | **Persisted and approval material.** | Default column. |
| Summary/content | `node.content`; `primaryContent` falls back to it only if `social.caption` is empty. `projectAsset.preview` is whitespace-collapsed/truncated derived text. | `content` **persisted**; preview **derived browser value**. | Caption column must not export the truncated preview. |
| Full caption | `node.social.caption`, fallback `node.content` for readiness/planning display. Provider contracts generally require `social.caption`. | **Persisted and approval material.** | Export exact normalized/display content chosen by a documented projection; recommended precedence is `social.caption`, then `content`, with a warning on fallback. |
| Channel/platform | `node.social.platform || node.channel`; platform is normalized lower-case only inside approval projection. | Both **persisted**; `channel` is a **legacy/general alias**. | Export display platform, flag missing/unsupported. |
| Destination/account/Page | Not stored on the node. LinkedIn/Facebook destinations live in `social_publishing_destinations`; browser snapshots expose selected destination labels. Facebook card derives it from connection snapshot. | **Provider-specific server state**, account-owned and mutable; no planning destination authority. | Column is currently unavailable except an ephemeral selected provider destination. Do not silently claim it is node-bound. |
| Link | No generic `link`. Facebook material derives link candidates from `social.preview`, `social.link`, `node.link`, and URLs in caption/content (`facebook-publication-material.js`). The default node calls `social.preview` CTA-like content. | Mixed persisted aliases; **no canonical general link field**. | Export a conservatively derived HTTPS link and expose ambiguity/unavailable state; never treat `preview` unconditionally as URL. |
| Hashtags | `node.social.hashtags`, normalized by `normalizeHashtagsInput` (`app.js:5155-5167`). | **Persisted and approval material.** | Usually already present in full caption only if author included them; if a separate future column is added, do not silently append/double them. |
| Attachments | No generic `attachments` field or attachment model was found. | **Does not currently exist.** | “Media/Attachment” must describe existing `images` only and explicitly say unavailable for non-image attachments. |
| Generated images | `node.images[]` entries with `{id,url,name,createdAt,source}`; `source` defaults to `uploaded`, generated flows can set a source. | **Persisted only for non-blob/non-data URLs** after `sanitizeNodeImages`, `app.js:5065-5078`; included in approval fingerprint. | Export safe descriptive presence/count/name/source by default, not raw URL. |
| Explicitly attached media | `node.images`; `favoriteImageId` can select a favorite in UI. No separate explicit-attachment field or guaranteed selected-media projection exists. | Images/favorite ID **persisted**; semantic “explicit attachment” is **not canonical**. | Do not promise which image is attached. Report media presence; optionally expose allowlisted authorized URL only after policy decision. |
| Approval state | `node.status` normalized by `normalizedStatus`; Approved is editorial state. | **Persisted.** Server approval is authoritative for transition to Approved. | Default column. |
| Approval fingerprint | `node.approvedContentFingerprint`, v2 SHA-256 contract. | **Persisted; server-authoritative on approval.** | Useful for internal diagnostics but omit from CSV v1 default and proposed minimum columns to reduce internal leakage. |
| Approval metadata | `node.approvalMetadata` `{version,authority,approvedByAccountId,approvedAt,clientRequestId}` from `api/content-review/approval-service.js:34-35`. | **Persisted, server-written.** | Exclude; contains actor/request metadata not needed for a posting plan. |
| Readiness state | `calculateReadiness(node)` in browser and `readiness(node)` in approval/publishing services. | **Derived, not persisted authority.** Browser supports more roles; Social Posting criteria broadly align but are duplicated. | Export derived value and test browser/server agreement. |
| Scheduled date/time/timezone | Canonical `node.planningSchedule.localDate`, `.localTime`, `.timeZone`; UTC instant `.scheduledAtUtc`. | **Persisted inside Board JSON after Board save.** Legacy aliases under `social` remain read-only. | Default columns. Empty fields must remain explicitly unscheduled. |
| Scheduling state | No stored enum. Derived from absence, canonical-valid, canonical-invalid, legacy-valid/invalid, and `changed`. | **Derived browser value.** | Define stable CSV values, recommended: `scheduled`, `unscheduled`, `schedule_invalid`, `legacy_review_required`, `content_changed_since_scheduling`. |
| Publication state | Provider job/external-post tables; some browser compatibility reads `node.facebookPublication` / `node.externalPublication`, but finalization services write social tables, not Board node status. | **Provider-specific server authority**, not one canonical node field. | Project a safe high-level state through an authenticated server DTO if required; otherwise `unavailable`, never infer “published” solely from editorial `node.status`. |
| Provider permalink | `social_external_posts.external_url`; returned as bounded HTTPS `externalUrl` in publish/reconciliation responses. | **Provider-specific server authority.** | Not in required CSV v1; if later added, expose only confirmed safe HTTPS URL, never provider post ID. |
| Creation/update timestamps | Board has `created_at`/`updated_at`; Canvas metadata has created/updated values. Nodes do not consistently create or update `createdAt`/`updatedAt`; projection merely accepts aliases. Image and schedule records have their own timestamps. | Board timestamps **authoritative**; node timestamps **not canonical**. | No node timestamp columns in CSV v1. |
| Archived | No canonical node archive flag/state was found. | **Does not currently exist.** | “Archived” cannot be a filter until a contract exists. |

### 2.2 Canonical `planningSchedule` version 1

The browser writer creates:

```json
{
  "version": 1,
  "scheduledAtUtc": "2026-02-14T08:30:00.000Z",
  "localDate": "2026-02-14",
  "localTime": "09:30",
  "timeZone": "Europe/Berlin",
  "disambiguation": "compatible",
  "scheduledBy": { "accountId": "…", "name": "…" },
  "createdAt": "ISO instant",
  "updatedAt": "ISO instant",
  "scheduleRevision": 1,
  "assetFingerprint": "v2-… or browser material fingerprint",
  "scope": "internal_planning"
}
```

**Proven behavior.** `readPlanningSchedule` accepts it only when version/scope/timezone are valid, the stored local components resolve exactly to `scheduledAtUtc`, and `scheduleRevision` is a positive integer. `assetFingerprint` marks whether publication material changed since scheduling. `scheduledBy` and timestamps are persisted but are not validated by the reader.

**Recommendation.** Preserve this shape for compatibility and formalize it as a shared contract. Do not add a second scheduling object for export. Decide whether `assetFingerprint` remains advisory schedule provenance or becomes an eligibility gate; it must not be confused with `approvedContentFingerprint`.

---

## 3. Persistence path and authority

### 3.1 End-to-end trace

1. **UI action.** Inspector/canvas/card/calendar actions call `openContentPlanning` (`app.js:10144-10155`; `content-workspace.js:118`).
2. **Temporary browser state.** `prepareSchedule` captures node/status/readiness/material/schedule revision; dialog fields remain DOM values until confirmation.
3. **Browser validation.** `resolveLocalDateTime` and `evaluateScheduling` reject malformed/DST-invalid/timezone-invalid or ineligible input (`content-workspace.js:49-59`).
4. **Node mutation.** `applyContentWorkspaceSchedule` mutates `state.nodes[].planningSchedule`, clears legacy aliases, appends activity, and marks the whole Board dirty (`app.js:17149-17195`).
5. **Serialization.** `serializeState` maps nodes through `sanitizeNodeForPersistence`; this shallow-spreads unknown node properties, so `planningSchedule` survives (`app.js:5081-5105,5897-5912`).
6. **Request.** `saveBoardToServer` sends `{canvas_json, brand_core_snapshot, lastKnownUpdatedAt}` as JSON via `PUT /api/boards/:id` for an existing Board (`app.js:8391-8468`).
7. **Authorization/concurrency.** `api/boards/[id].js:139-176` authenticates the session, resolves Board access, requires `access.canEdit`, and returns 409 if `lastKnownUpdatedAt` differs.
8. **Database.** The route replaces the entire `boards.canvas_json` JSONB value and advances Board `updated_at` (`api/boards/[id].js:180-192`). There is no scheduling table or field-level validation.
9. **Response.** The browser accepts returned Board ID/revision/access, marks clean, and refreshes its last-saved snapshot (`app.js:8502-8527`). It does not reconcile `canvas_json` from the save response because it assumes the submitted payload won.
10. **Reload.** Board GET returns authorized `canvas_json`; `loadBoardFromUrlIfPresent` validates the broad Canvas container and `applyCampaignState` restores sanitized nodes (`app.js:8608-8618,8295-8350`).
11. **Collaboration.** Every 12 seconds, `pollBoardForRemoteChanges` fetches the Board and `mergeRemoteBoardState` patches remote nodes unless that node is actively being edited (`app.js:2538-2543,2877-2913,2796-2873`).
12. **Rendering.** Content Workspace calls `readPlanningSchedule`; Inspector calls `formatNodeScheduleMeta`; obsolete views may still read only aliases.

### 3.2 Survival matrix

| Event | Result | Evidence/qualification |
|---|---|---|
| Ordinary rerender | **Survives.** | Schedule is on `state.nodes`; Content Workspace reprojects it. `contentWorkspaceIdentity` notably omits `planningSchedule` (`app.js:16999-17002`), but explicit schedule writer calls render, and projection reads live nodes. |
| Local Canvas save helper | **Survives in same browser localStorage.** | `saveCampaignCanvasState` serializes all persisted node properties. Canonical writer itself does not call this helper; it calls `markUnsaved`. |
| Board autosave/manual save | **Survives after successful save.** | Whole `planningSchedule` is serialized into Board JSON. Autosave runs after 3 seconds when eligible (`app.js:5025-5056`). |
| Browser reload | **Survives only after a successful Board save** (or potentially local draft restoration in its applicable boot path). | Server Board is the cross-session authority; a reload before autosave can lose the change. |
| Another authenticated browser | **Survives after successful Board save and authorized reload/poll.** | Same Board JSON returned under Board access. |
| Collaboration update | **Usually survives but is coarse-grained.** | Remote entire-node patch includes schedule. An actively edited node skips all remote fields. Local dirty nodes are not explicitly protected from remote patch unless actively focused. |
| Approval change | **Survives.** | Server approval mutates the locked Board JSON node and leaves `planningSchedule` intact. Approval material excludes it. However, an approval request races at whole-Board JSON granularity; stale expected fingerprint protects material, not schedule revision. |
| Publishing reconciliation/finalization | **Survives.** | Provider finalization writes social job/external-post tables, not `planningSchedule`. Browser Facebook reconciliation is an in-memory projection. |

### 3.3 Authority and race analysis

**Proven behavior.** The authoritative persisted boundary is the `boards.canvas_json` row written by `PUT /api/boards/:id`, not `applyContentWorkspaceSchedule`. Before autosave success, scheduling is local dirty state. The only server-side schedule authorization is inherited from whole-Board edit authorization.

**Risks:**

- Whole-Board replacement is last-writer-wins inside one accepted revision. `lastKnownUpdatedAt` prevents obvious cross-revision overwrite but does not provide node/schedule atomicity.
- The browser prevents overlapping saves and shows a 409 choice, but “save as new” can intentionally fork the plan.
- Collaboration polling patches entire nodes. A schedule can overwrite or be overwritten along with unrelated node fields; “actively edited” detection is DOM-focus based and has no schedule-dialog-specific merge lock.
- `contentWorkspaceIdentity` excludes `planningSchedule`, so generic identity-based stale render checks do not observe schedule-only change; the explicit schedule revision check does.
- `scheduleRevision` guards one browser dialog against a changed canonical schedule in current memory, but the server does not compare it and `PUT` accepts any JSON shape.
- A canonical scheduling click reports success before persistence. There is no per-schedule saving/saved/failed indicator or rollback on autosave failure.
- Approval service locks and rewrites `canvas_json` independently. Board revision and material expectation reduce risk, but schedule-only concurrent edits are not a request precondition for approval.

**Recommendation.** Phase 1 should establish a server-validated, authenticated, Board-scoped schedule mutation with Board revision + node ID + expected schedule revision (and material/status expectations) or prove an equivalent transactional Board update. Return authoritative node schedule and Board revision, then reconcile before displaying “saved.” Keep whole-Board save compatibility, but make this narrow boundary the canonical scheduling write authority.

---

## 4. Calendar architecture

### 4.1 Content Workspace Calendar (candidate foundation)

- **Month/day generation:** `monthKey`, `monthRange`, and `renderMonth` in `content-workspace.js:82-94` use `YYYY-MM`, UTC month boundaries, a Monday-first 42-cell grid, and ISO date keys. “Today” uses the browser’s UTC ISO date in overview/month comparisons rather than a selected planning timezone.
- **Included node types:** scheduled display is derived from projected assets, but only the canonical writer can schedule Social Media Posting. The unscheduled queue explicitly filters eligible unscheduled Social Media Posting nodes.
- **Assignment:** by `planningSchedule.localDate`; invalid canonical and legacy records can still be projected with warnings.
- **Time:** represented by `localTime` on month events, agenda, and detail dialog.
- **Timezone:** represented in event details/agenda; month groups by stored local date. There is no calendar-wide timezone selector.
- **Multiple per day:** supported; month shows a bounded number and an overflow count; agenda can list all.
- **Filters:** role, platform, readiness, warning, owner are in state/control generation. No destination filter because nodes lack destinations.
- **Conflicts:** no slot/capacity/minimum-spacing detection. “Warning” means invalid/changed schedule, not collision.
- **Move/edit:** details permit Reschedule/Remove; no drag/drop or inline time editing.
- **Authority:** visual projection only; node `planningSchedule` is the data authority.
- **Reuse:** good primitives for date projection, event details, permissions, responsive behavior, and filters. It should become the only calendar. A scheduler needs a proposal model and card-first review layer rather than another calendar implementation.

### 4.2 Shell Calendar View (not a candidate)

`renderCalendarView` is legacy-only, local-time/date dependent, German month heading regardless of UI language, and has no canonical schedules or editing. **Recommendation:** phase 2 should route or retire it rather than duplicate enhancements. Until then, explicitly label it legacy or hide it to avoid contradictory schedule truth (implementation work, not performed here).

---

## 5. Approval and publishing invariants

### 5.1 What scheduling changes today

| Concern | Proven current effect of date/time/timezone-only change |
|---|---|
| Editorial approval status | None. Writer leaves `node.status` untouched. |
| Approval fingerprint | None. `approval-material-contract.js:11-12` includes publication material and explicitly excludes `planningSchedule`, timestamps, status and provider-delivery state. |
| Readiness | None under current readiness functions; they inspect caption/platform/CTA, not schedule. |
| Preflight eligibility | No material/fingerprint effect. LinkedIn/Facebook preflight does not use `planningSchedule`; it evaluates saved Board, edit access, approval/current fingerprint, destination, content, provider state and prior jobs/posts. Unsaved schedule changes can make the Board dirty and the browser preflight refuses publishing until saved (`app.js:17050-17056`). |
| Prior-publication protection | None weakened. Provider services query prior job/external-post records and use idempotency keys over owner/destination/Board/node/approved fingerprint. |
| Publication finalization | None. It remains in provider-specific job/external-post tables. |
| Duplicate-delivery protection | None. Schedule metadata is outside provider idempotency and delivery mode remains `immediate`. |

**Recommended invariant.** Internal planning metadata (`planningSchedule` date, time, timezone, disambiguation, revision, scheduler and schedule timestamps) MUST NOT alter editorial status or the approved-publication-material fingerprint. A schedule may carry an `assetFingerprint` solely to warn that content changed after planning. Content-material changes continue to invalidate approval under the v2 contract. This invariant should be shared and tested browser/server.

### 5.2 Published/finalized protection

**Proven behavior.** `evaluateScheduling` rejects normalized `Scheduled` and `Published` statuses, but provider finalization does not necessarily change node status. Facebook readiness detects a finalized publication from an in-memory reconciliation map or compatibility node fields; server publishing services prevent another delivery using durable job/external-post state. Therefore node status alone is not a sufficient publication guard.

**Recommendation.** Scheduler/export preview must join each candidate with an authenticated, Board/node-scoped high-level publication projection. Confirmed published/finalized posts should default to a read-only historical row and MUST NOT be classified as publishable work, auto-rescheduled, or included in a “to publish” export. If users explicitly include them for archive/reporting, CSV must say `Publication Status=published` and a non-publishable scheduling/export state. Unknown/unreconciled provider outcomes must be protected like published until resolved. Never expose provider post IDs/raw responses.

---

## 6. Automatic scheduling insertion point

### 6.1 Narrowest safe location

**Recommendation.** Add a pure, dependency-free proposal function adjacent to a formal shared planning contract, not inside provider services and not directly in `renderCalendar`. Inputs should be an immutable projection of authorized Board nodes plus explicit policy; output should be assignments and diagnostics only. The browser may call it for instant preview. Acceptance should pass proposed assignments through the same authoritative Phase 1 schedule write boundary, ideally as one Board-revision-checked bulk operation.

The engine must never create `social_publish_jobs`, provider attempts, external posts, or network calls. Existing provider schema’s `delivery_mode='scheduled'` is explicitly outside this product task and must not be reused.

### 6.2 Required input contract and current availability

| Input | Current availability / gap |
|---|---|
| Start date | Does not exist as plan policy; collect explicitly as ISO local date. |
| Allowed weekdays | Does not exist; collect as ordered ISO weekday numbers. |
| Preferred time slots | Does not exist; collect strict `HH:mm` values in declared order. |
| Maximum posts/day | Does not exist; positive integer policy. |
| Minimum spacing | Does not exist; define minutes and whether global, channel-specific, or destination-specific. Recommended default is global within selected plan, then surface conflicts rather than silently move existing records. |
| Timezone | Canonical per schedule and browser-zone default already exist. Require one IANA zone for proposal; preserve explicit existing schedule zones. |
| Included channels | Node platform exists; provide explicit selected set. |
| Included destinations | Node binding does not exist. **Unresolved production question:** should plan destination be captured per node independently of current provider connection? A destination selector cannot be honestly implemented until this is decided. |
| Existing schedules | `readPlanningSchedule` supplies canonical/legacy projection. Valid existing schedules must be immutable occupied slots by default. Invalid legacy schedules must be warnings, never overwritten automatically. |
| Approval/readiness | Status/fingerprint/readiness exist. Current manual planning permits Draft/In Review/Needs Changes/Approved if not incomplete. Recommended automatic default: Approved + current fingerprint + Ready; allow deliberate selectable expansion to Needs attention/unapproved without silently excluding them. |
| Ordering | Existing `applyView` stable fallback is role/title/ID; “journey” label exists but `applyView` does not implement journey sorting. Canvas `state.nodes` order exists but is not declared campaign chronology. |

### 6.3 Deterministic algorithm contract

**Recommendation.** Normalize policy; select only Social Media Posting nodes that are not finalized/protected, pass planning eligibility, match channel/destination filters, and have no schedule; sort by explicit campaign order if a future canonical field exists, otherwise stable `(original Board node index, node ID)` and disclose that rule. Enumerate dates and preferred slots deterministically. Reject occupied slots and any candidate violating maximum/day or minimum spacing. Use `resolveLocalDateTime` semantics including explicit ambiguity policy. Never move existing schedules. Return `{proposalId/inputDigest, boardRevision, assignments[], unchanged[], conflicts[], excluded[]}` without mutating state.

Preview is temporary memory tied to account + Board + Board revision + policy digest. “Accept all” submits the proposal under optimistic concurrency; individual edits modify a proposal copy and revalidate all conflicts; Cancel discards it without dirtying the Board. Tests must freeze inputs and time, use explicit timezone/DST fixtures, permute irrelevant object key order, and assert byte-for-byte identical assignments.

**Migration conclusion.** No relational database migration is required to propose, persist, or export schedules because `planningSchedule` is already persisted in Board JSON. A migration would be justified only later for cross-Board querying, indexed operational queues, or normalized destinations—not for phases 1–4. A shared schema/contract version is still required even without SQL.

---

## 7. Manual scheduling and plan-review UX

### 7.1 Option assessment

| Option | Fit | Finding |
|---|---|---|
| Small modal | Existing schedule dialog is appropriate for one post, but not for reading full captions, media, warnings and many assignments. | Retain as a focused edit affordance, not the plan-review workspace. |
| Overlay | Existing retired overlay is nonfunctional and too small. A large overlay also competes with existing dialogs/focus handling. | Do not revive it. |
| Workspace panel | Could preserve Canvas context but existing inspector is already dense and mobile width is insufficient for cards + timeline. | Useful only as a launch/status affordance. |
| Dedicated view within Content Workspace | Existing navigation/view lifecycle, Board context, card projection, filters, calendar, permissions and responsive styles already live here. | **Recommended.** Add a Posting Plan mode/route under Content Workspace, with full post cards primary and compact week/month timeline secondary. |

### 7.2 Recommended layout and states

**Recommendation.** The primary column must render the full caption using safe text rendering/`white-space: pre-wrap`, plus title, channel, destination (or “Not assigned”), local date, time, timezone, approval/currentness, readiness, media count/presence, derived link, scheduling state and publication protection. Do not use `.cw-preview` clamping in final review. The secondary compact weekly timeline/calendar selects and contextualizes cards; it never becomes a second data store.

Desktop can use a resizable two-column workspace. At <=900px stack cards before timeline; at <=640px default to agenda/list, use bottom-sheet single-item editing, never require horizontal calendar scrolling, and preserve 44–48px targets. Sticky confirmation actions must not obscure captions.

Keyboard/focus requirements:

- semantic tabs with arrow/Home/End behavior already demonstrated by workspace tabs;
- one logical heading hierarchy and card landmarks;
- visible focus using existing `--fk-focus-shadow`/focus tokens;
- dialogs with initial focus, complete focus trap, Escape (when not saving), trigger restoration and background inertness;
- no drag-only scheduling: date/time controls and move earlier/later actions must be keyboard equivalents;
- live regions for proposal counts, validation, saving, success and failure;
- announce conflicts with node title, date/time and reason, not color alone.

Dark mode must use existing workspace tokens (`--fk-bg`, `--fk-surface`, `--fk-input-bg`, `--fk-border`, `--fk-text`, `--fk-text-muted`, `--fk-surface-muted`, success/warning/danger, focus shadow) rather than new hard-coded light colors. Validate overlays, date/time native controls, media placeholders, table/preview rows and disabled/published protection in both themes.

Required states: no Board; loading; access lost; no Social Media Posting nodes; no eligible nodes; all scheduled; proposal ready; conflict/invalid legacy/DST; unsaved edit; saving; saved; 409 stale Board; partial bulk failure (prefer atomic rejection); export preview building; export serialization failure; download unavailable. Never show “Scheduled” before server-authoritative persistence succeeds.

Localization must add all scheduler/export policy, counts, reason codes, CSV preview, confirmation, unscheduled/published protection and failure strings in both English and German. Reuse one localization path; do not add more private/shell duplicates. Dates may be localized in UI; persisted/CSV dates remain ISO. German pluralization and long labels must be layout-tested.

---

## 8. Export entry flow and inclusion policy

### 8.1 Existing export functionality

**Proven behavior.** Repository-wide searches found no Posting Plan command, CSV module, CSV endpoint, serializer, Blob download, or test. “Export” occurrences are CommonJS/module exports, not user export. Therefore the complete entry flow is new capability.

### 8.2 Future “Export Posting Plan” flow

1. User selects **Export Posting Plan** from Content Workspace/Posting Plan view.
2. Re-resolve the authorized current Board snapshot and collect only nodes whose exact type is Social Media Posting; join safe publication summary if required.
3. Classify every node visibly: scheduled valid, unscheduled, invalid/legacy schedule, content changed since scheduling, unapproved, not ready, published/protected, failed/unknown, and unsupported/missing platform. Show totals; do not silently discard any class.
4. If unscheduled eligible posts exist, offer three equal explicit routes: **Automatic Schedule**, **Manual Schedule**, and **Export with Unscheduled Posts**. The last keeps Date/Time/Timezone empty and sets `Scheduling Status=unscheduled`.
5. Automatic opens policy + non-persisted proposal preview. Manual opens the card-first plan workspace. Both return to the same export classification step.
6. Show a final row/column preview, included/excluded counts, warnings, filename, timezone semantics, and a selectable “include historical published rows” option.
7. Generate/download only after explicit confirmation. Cancel performs no persistence and no download.

### 8.3 Recommended defaults

| Node class | Default | Rationale |
|---|---|---|
| Approved, Ready, not finalized | Include. | Safest operational posting plan. |
| Approved, Needs attention | Include with warning (or selectable default-on). | Existing manual scheduling allows acknowledged warning; do not silently discard. |
| Draft / In Review / Needs Changes | Selectable, default-on in a **content planning** export but clearly non-publishable; default-off only if user explicitly selects a “publish-ready only” preset. | Target flow is internal planning; omission must be visible. |
| Incomplete/not-ready | Selectable, default-on with warning and empty unavailable fields; cannot auto-schedule under current rules. | Avoid silent content loss. |
| Unscheduled | Include when user explicitly chooses Export with Unscheduled; blank temporal columns and explicit status. | Required target behavior. |
| Published/finalized | Default excluded from actionable plan; show count and offer explicit “include as historical/reference,” read-only. | Prevent re-export as publishable work. |
| Failed publication | Include/selectable with `Publication Status=failed`; it is not equivalent to published. Eligibility for retry remains provider workflow, not CSV. |
| Unknown/provider-accepted-unreconciled | Default protected/excluded from actionable plan; selectable historical row with warning. | Avoid duplicate delivery. |
| Archived | No current state; show no filter until modeled. | Cannot infer. |

**Unresolved production question.** Product must define whether “Posting Plan” means all planning content or only publish-ready work. Recommended UI provides named presets and always shows excluded counts/reasons.

---

## 9. Proposed CSV v1 contract

### 9.1 Columns

Use the exact stable header order below. All values are text. “Unavailable” means the source cannot currently be established; use an empty field plus the applicable status/warning, never invented content.

| # | Column | Authoritative source | Format / null and unavailable behavior | Safe? | Default? |
|---:|---|---|---|---|---|
| 1 | `Date` | Valid `planningSchedule.localDate` | `YYYY-MM-DD`; empty for unscheduled/invalid. | Yes. | Yes. |
| 2 | `Time` | Valid `planningSchedule.localTime` | 24-hour `HH:mm`; no seconds; empty with empty Date for unscheduled. | Yes. | Yes. |
| 3 | `Timezone` | Valid `planningSchedule.timeZone` | IANA name such as `Europe/Berlin`; empty for unscheduled/legacy missing-zone. Never export browser offset as a substitute. | Yes. | Yes. |
| 4 | `Channel` | `social.platform || channel` | Human display string; empty plus readiness warning if missing. | Yes. | Yes. |
| 5 | `Destination` | Future node-bound planning destination; currently none. | Display label only. Empty means `unavailable`/not assigned. Never export external destination ID. | Conditionally. | Yes, but honest empties today. |
| 6 | `Title` | `node.title` | Full Unicode text; empty permitted. | Yes after formula defense. | Yes. |
| 7 | `Caption` | `social.caption`, documented fallback to `content` | Exact multiline Unicode caption; empty only when unavailable/incomplete. Do not use HTML-stripped/truncated preview. | Yes after formula defense. | Yes. |
| 8 | `Link` | Conservative canonical/derived HTTPS link | One validated HTTPS URL; empty if none or ambiguous. | Yes if scheme validated. | Yes. |
| 9 | `Media/Attachment` | `images[]` safe projection; no generic attachments | Recommended `None`, `1 image`, `N images` plus safe names if desired. Do not emit raw URLs by default. | Yes as metadata. | Yes. |
| 10 | `Approval Status` | normalized `node.status` plus fingerprint-currentness | Stable values such as `draft`, `in_review`, `needs_changes`, `approved`, `approval_stale`; do not treat Scheduled/Published label as proof. | Yes. | Yes. |
| 11 | `Readiness Status` | shared readiness projection | `ready`, `needs_attention`, `incomplete`, `unavailable`. | Yes. | Yes. |
| 12 | `Scheduling Status` | shared schedule classifier | `scheduled`, `unscheduled`, `schedule_invalid`, `legacy_review_required`, `content_changed_since_scheduling`. | Yes. | Yes. |
| 13 | `Publication Status` | safe authenticated provider summary | `not_published`, `published`, `failed`, `outcome_unknown`, `unavailable`. Never expose job/provider IDs. | Yes as bounded enum. | Yes. |
| 14 | `Board ID` | authorized route/current Board | Canonical UUID string. | Internal identifier; acceptable for owner/editor export after confirmation. | Yes per requested contract; consider optional privacy toggle later. |
| 15 | `Node ID` | `node.id` | Opaque string, exact value. | Internal identifier; formula-defend. | Yes. |

Hashtags remain part of the full approved caption only when authored there. A future `Hashtags` column may join `social.hashtags` with spaces, but adding it to v1 would change the stable contract. Approval fingerprint, scheduler identity, provider IDs, provider connection IDs, job IDs, raw destination IDs and media URLs are intentionally absent.

### 9.2 Safe serialization rules

**Recommendation:**

- Encode UTF-8. Offer/include UTF-8 BOM (`EF BB BF`) for Excel interoperability; document it and test both BOM bytes and decoded content. Unicode and emoji remain unchanged and NFC-normalized only if the contract explicitly chooses normalization; do not corrupt authored text.
- RFC 4180-style records with CRLF row terminators. Quote every field (simplest stable rule); represent `"` as `""`. This safely preserves commas, quotation marks and multiline captions.
- Formula injection: for every user/provider-controlled cell whose first non-whitespace character is `=`, `+`, `-`, or `@` (also consider tab/CR control prefixes), prefix a single apostrophe before CSV quoting. Apply to titles, captions, channels, destination labels, links, media names, Board/Node IDs—not only visible prose. Do not strip content silently; preview the defended value or disclose the rule.
- Remove/replace prohibited NUL and unsafe control characters while retaining CR/LF semantics; bound field/file sizes and surface failure instead of truncating silently.
- Empty Date, Time and Timezone are three quoted empty fields. Never put “TBD” in machine fields; `Scheduling Status` carries meaning.
- Date is local ISO `YYYY-MM-DD`; Time is local 24-hour `HH:mm`; Timezone is IANA. `scheduledAtUtc` is not a v1 column, but may be used to validate/order rows.
- Deterministic rows: scheduled valid first by `scheduledAtUtc`, then channel (normalized), title (locale-independent code-point or explicitly fixed `en` collation), Node ID; unscheduled afterward by original Board node index then Node ID. Published historical rows follow the same temporal rule and remain explicitly published. Freeze this algorithm in tests.
- Safe filename: `posting-plan_<sanitized-board-slug>_<YYYY-MM-DD>.csv`; derive date in a documented timezone (recommended UTC), allow only ASCII letters/digits/hyphen/underscore, collapse separators, cap total length, forbid path separators/control characters/reserved names, and fall back to `posting-plan_<board-id-prefix>_<date>.csv`.

### 9.3 Execution boundary

**Recommendation.** Generate CSV entirely in the browser from the latest successfully authorized/reconciled Board projection after explicit preview and confirmation. Benefits: no new endpoint, no additional server copy of captions/media metadata, immediate download, and the Board GET/write boundary already controls access. Before preview/download, require current `canView`; if publication summaries or destinations are included, fetch only bounded authenticated Board/node DTOs from existing/new read boundaries and merge them—never credentials/raw rows.

Server-side export is justified only if audit logging, very large files, organization policy, or authoritative provider joins become mandatory. If chosen later, it must reauthorize Board access and re-project allowlisted columns; the client may never submit arbitrary nodes for the server to echo.

---

## 10. Security and authorization

### 10.1 Existing access model

**Proven behavior.** `_board-access.js:75-143` recognizes Board owner/editor/viewer, unowned authenticated Board, brand owner/admin/editor/viewer, non-owner, anonymous and public viewer. `accessForRole` grants `canEdit` to owner/editor/unowned and brand write roles; viewers can read but not edit. Board PUT rechecks `canEdit` server-side. Content Workspace planning also requires authenticated account, `canEdit`, and no public-view token.

**Current role result:** owners/editors/brand writers can schedule; viewers/public viewers cannot. There is no schedule-specific or export-specific capability. Read-authorized viewers can already see Board content and could technically be allowed to export, but no export policy exists.

**Recommendation.** Scheduling requires `canEdit` server-side. Export defaults to authenticated `canView` roles (owner/editor/viewer/authorized brand roles) because it is a read operation, but public-token viewers should be denied by default due to easy bulk exfiltration unless product explicitly enables public export. Add explicit `canExportPostingPlan` rather than relying on button hiding. **Unresolved production question:** whether ordinary viewers may export and whether export requires owner opt-in/audit logging.

### 10.2 Data minimization and trust boundaries

- Scope input strictly to one authorized Board ID and nodes from that Board. Never accept client-supplied cross-Board nodes or destination IDs without reauthorization.
- Destination display labels are potentially personal/account data. Export only the label deliberately bound to the planned node; current account-wide selected destination is not sufficient proof of binding.
- Default media output to type/count/safe filename. Signed/private attachment URLs can leak access and expire; never include them by default. Revalidate any optional URL against an allowlist and authorization policy.
- Formula-defense all cells. HTML escaping is irrelevant to CSV safety.
- Never export OAuth/access tokens, encrypted token payloads/nonces/tags/key versions, connection credentials, provider external post IDs, destination external IDs, publish job/attempt IDs, idempotency keys, raw provider responses, diagnostics, actor email, approval client request ID, or unrelated Board/Brand data.
- Browser export trusts only the authorized Board response/current reconciled state; a server export must independently call `getBoardAccess`, ignore client node payloads, and use an allowlist projection.

---

## 11. Tests and compatibility

### 11.1 Existing protection inventory

| Area | Existing checks |
|---|---|
| Board persistence/access/roles | `check-bw18-board-access-roles.js`, `check-bw18-share-permissions-popover-lifecycle.js`, `check-bw19-private-public-board-sharing.js`, `check-bw20-brand-team-roles.js`, `check-bw20-1-inline-brand-role-management.js`; general Board save/load behavior is embedded in app checks but no schedule persistence E2E exists. |
| Social Media Posting projection/material | `check-bw31-1-content-workspace-library.js`, `check-bw31-2-content-review-workflow.js`, `check-bw32-3-6-authoritative-v2-approval.js`, `check-bw34-1-5-facebook-publication-material-compatibility.js`. |
| Approval fingerprints | `check-bw32-3-2-stale-approval-recovery.js`, `check-bw32-3-3-canonical-reapproval.js`, `check-bw32-3-5-approval-fingerprint-diagnostics.js`, `check-bw32-3-6-authoritative-v2-approval.js`, `check-bw32-3-7-approval-action.js`. They explicitly verify planningSchedule exclusion. |
| Calendar | `check-bw31-4-content-calendar.js`; supporting entry/UX checks in BW-31.5.1/.2. No check protects the obsolete shell calendar’s correctness against canonical data. |
| LinkedIn finalization | `check-bw32-3-1-linkedin-text-publish-now.js`, `check-bw32-3-8-linkedin-publication-finalization.js`, `check-bw32-3-9-authoritative-response-boundary.js`. |
| Facebook behavior/finalization | `check-bw34-1*.js`, especially 1.1 surface, 1.3 readiness, 1.5 material compatibility, 1.6–1.8 preflight, 1.9 finalization; engagement checks `check-bw34-2a*`. |
| Browser script integrity | `scripts/check-browser-script-integrity.js`. |
| Dark mode | `check-bw27*.js`; BW-31 calendar/workspace checks also inspect responsive/theme styles. |
| Language | `check-bw21-language-separation.js`, `check-bw21-1-inspector-language-coverage.js`, `check-bw23-language-region-settings.js`, `check-bw25-2-interface-localization.js`; Content Workspace checks cover some EN/DE literals. |

### 11.2 Minimum focused deterministic regressions

Phase 1 tests should prove:

1. manual schedule request validates role/access/status/readiness/date/time/IANA zone/DST, persists canonical shape, increments revision, clears only legacy aliases, preserves status/approval fingerprint, returns authoritative Board revision, and reloads identically;
2. viewer/public/cross-Board/stale Board/stale schedule revisions are rejected without mutation;
3. second authenticated session observes saved schedule; collaboration merge reconciles it; concurrent active/local dirty edits surface conflict rather than silently overwrite;
4. published/finalized and uncertain-outcome nodes cannot be rescheduled by the new authority;
5. browser and server contract fixtures agree on local/UTC resolution, readiness, schedule validity and fingerprint exclusion.

Phase 2 tests should cover full caption/no clamp, all operational metadata, manual edit/remove, loading/saving/failure/409, focus trap/restore/Escape, keyboard-only use, 320px mobile, EN/DE, light/dark/reduced motion, and legacy schedule repair.

Phase 3 tests should use fixed policy fixtures for ordering, weekdays, max/day, spacing, channel/destination selection, DST gaps/folds, conflict diagnostics, no mutation during preview/cancel, preservation of every existing schedule, individual edit revalidation, stale accept rejection, and deterministic identical output.

Phase 4 tests should prove exact header/row ordering, scheduled and explicitly unscheduled rows, empty temporal fields, multiline captions, comma/quote doubling, emoji/Unicode/hashtags, CRLF, BOM, formula prefixes (including whitespace/control prefixes), link/media privacy, filename sanitization, role authorization, Board scoping, explicit confirmation, cancel/no download, and bounded failure.

Every phase must run existing BW-31.4, BW-32.3.x, BW-34.1.x/2a checks and browser-script integrity to prove provider publishing behavior is unchanged. No regression should contact a provider; use deterministic fixtures/mocks only.

---

## 12. Required conclusion and implementation sequence

### 12.1 Proven current behavior

- Canonical internal schedules are timezone-aware `planningSchedule` metadata on Social Media Posting nodes, with DST handling, revision checks, provenance fingerprint, and Board JSON persistence after save.
- Manual schedule/reschedule/remove is functional through Content Workspace and Inspector for authenticated editors; it is not provider scheduling and creates no publish job.
- Content Workspace offers month/agenda projections, eligible unscheduled queue, filters, event details, and localized/responsive/dark-mode foundations.
- Approval v2 deliberately excludes schedules; scheduling does not change approved material or editorial status.
- Provider finalization and duplicate prevention are separate durable server concerns.

### 12.2 Incomplete or misleading current behavior

- The shell Calendar View and several Canvas/list labels read deleted legacy aliases, so they disagree with canonical scheduling.
- A retired visible-in-DOM scheduling overlay has live listeners but no write behavior.
- Scheduling success is reported before Board persistence; no per-schedule saving/error rollback exists.
- Schedule shape/eligibility is browser-only and the server accepts opaque whole-Board JSON.
- Calendar “today” and month arithmetic are not explicitly based on the plan timezone.
- Full captions are clamped; no bulk plan review, auto scheduling, conflicts, destination binding, or export exists.
- “Scheduled” and “Published” editorial labels are not reliable planning/publication authorities.

### 12.3 Reusable components

`planningSchedule` v1; `readPlanningSchedule`; `resolveLocalDateTime`; `evaluateScheduling`; material fingerprints; Content Workspace projection/cards/actions; month/agenda calendar; Board access capabilities; Board optimistic revision; approval/readiness projections; safe provider publication summaries; dialog keyboard patterns; workspace theme/responsive tokens; EN/DE infrastructure; existing deterministic regression style.

### 12.4 Exact root architectural gaps

1. No shared/server-validated scheduling contract or atomic schedule write authority.
2. Two calendars and mixed canonical/legacy readers create contradictory truth.
3. Whole-Board persistence/collaboration is too coarse for reliable bulk scheduling and lacks schedule save state.
4. No canonical destination binding or unified safe publication-status projection on a planned node.
5. No deterministic proposal model, capacity/conflict policy, explicit campaign order, or bulk confirmation transaction.
6. No Posting Plan view/entry flow, full-caption review, CSV contract, serializer, preview, download, or export capability.
7. Browser/server readiness and schedule classification are duplicated rather than shared.
8. Published protection is provider-authoritative but not yet joined into planning/export collection.

### 12.5 Conclusions

- **Canonical scheduling authority recommendation:** `node.planningSchedule` remains the canonical stored record, written through a new server-validated Board/node schedule boundary with optimistic Board + schedule revision and authoritative response reconciliation.
- **Migration conclusion:** no database migration is required for phases 1–4; Board JSON already persists the contract. Do not create a provider queue.
- **Approval/fingerprint conclusion:** scheduling metadata must remain excluded from approved publication material. `assetFingerprint` is advisory schedule provenance; content edits, not scheduling edits, invalidate approval.
- **Authorization conclusion:** schedule = `canEdit`; export = explicit authenticated `canExportPostingPlan` derived initially from `canView`, with public viewer denied by default and an unresolved decision for viewer policy.
- **CSV execution boundary recommendation:** browser-side after authorized latest snapshot, safe DTO merge, preview and confirmation; server endpoint only if future audit/scale/policy requires it.

### 12.6 Recommended phases, acceptance criteria and rollback boundaries

#### Phase 1 — canonical persisted scheduling contract and focused regression coverage

**Work:** formalize shared v1 validation/classification; add authenticated narrow manual/bulk schedule mutation; enforce Board/node/access/status/material/schedule revisions; authoritative response/reload; make all readers use canonical projection; define published protection join. No migration.

**Acceptance:** schedule/remove survives reload and another editor; stale/cross-Board/viewer/public/published attempts fail atomically; status and approval fingerprint are byte-identical; legacy records remain readable and upgrade only on deliberate edit; canonical schedule renders consistently everywhere; provider tables/calls untouched; focused and existing provider regressions pass.

**Rollback boundary:** disable/remove the new route/client adapter and return to existing Board autosave; stored `planningSchedule` remains compatible. Do not roll back or rewrite Board data.

#### Phase 2 — manual scheduling and plan-review interface

**Work:** add dedicated Posting Plan mode in Content Workspace; full-caption primary cards; compact secondary agenda/week/calendar; destination-unavailable honesty; schedule saving/conflict/failure states; consolidate obsolete calendar/overlay entry points; complete EN/DE/accessibility/theme behavior.

**Acceptance:** all candidate content is visible with explicit inclusion/protection state; full caption is readable; editor can schedule/reschedule/remove through Phase 1 authority; viewer is read-only; mobile/keyboard/focus/dark/light/EN/DE checks pass; no provider action is reachable from planning confirmation.

**Rollback boundary:** feature-flag/hide the new view and restore old navigation routing; Phase 1 contract/data remains valid and Inspector single-post planning continues.

#### Phase 3 — deterministic automatic-scheduling proposal and confirmation

**Work:** pure proposal engine; explicit policy form; immutable existing schedules; conflicts/exclusions; preview-only proposal; edit individual assignments; atomic accept/cancel.

**Acceptance:** only eligible unscheduled selected posts are proposed; same inputs produce identical output; existing/legacy/invalid/published records never move; DST/capacity/spacing conflicts are explicit; preview/cancel make zero writes; stale acceptance rejects all rather than partially applying; accepted records use Phase 1 authority.

**Rollback boundary:** disable Automatic Schedule; discard ephemeral proposals; manual scheduling and persisted schedules remain unchanged.

#### Phase 4 — CSV preview, safe serialization and download

**Work:** stable CSV v1 projection; classification/inclusion choices; unscheduled export; safe serializer; preview/confirmation; browser download; optional safe publication summary read.

**Acceptance:** exact v1 headers/order/formats; no silent exclusions; unscheduled blanks/status; deterministic rows/filename; commas/quotes/newlines/Unicode/emoji/formulas/BOM pass byte fixtures; unauthorized/public/cross-Board export denied per policy; file contains no prohibited identifiers/secrets/URLs; no file before confirmation.

**Rollback boundary:** hide export action/remove download module; no persisted data changes. Scheduling phases remain operational.

#### Phase 5 — optional provider or external-tool integrations later

**Work:** only after platform approval/business verification and a separate threat/product review, consider destination sync or third-party import formats. This is not provider scheduling.

**Acceptance:** separately specified authorization, consent, idempotency, reconciliation, privacy and provider approval; no reuse of internal schedule as automatic publishing instruction without an explicit new contract.

**Rollback boundary:** disable integration adapter/credentials independently; internal planning and CSV continue unchanged.

### 12.7 Explicit non-goals

- No provider-side scheduling or automatic publishing.
- No Facebook, LinkedIn, Meta, or other provider call from scheduler/export.
- No publish queue, job worker, webhook, engagement expansion, or retry design.
- No migration for phases 1–4 and no normalized scheduling database solely for CSV.
- No automatic approval, readiness override, material edit, destination invention, or rescheduling of existing/finalized posts.
- No tokens, credentials, encrypted secrets, raw provider responses, provider IDs, or unrelated Board/Brand data in CSV.
- No silent content exclusion, silent timezone conversion, or implicit download.

---

## 13. Unresolved production questions requiring product/security decisions

1. May authenticated Board viewers export, or only editors/owners? Is owner opt-in/audit logging required?
2. Is a Posting Plan all internal content or publish-ready-only by default? Which named preset is primary?
3. What is the canonical per-node planning destination when provider connections are absent, changed, or account-scoped?
4. What is the explicit campaign chronology when Board node array order is undesirable?
5. Is minimum spacing global, per channel, or per destination, and what are safe defaults?
6. Should BOM always be emitted or offered as an Excel-compatible option?
7. Are media URLs ever permitted in exports, and under what retention/access policy?
8. Must published historical rows be exportable, and if so is the permalink included in a later CSV version?

Until answered, implementations must expose “unavailable/selectable” states rather than infer policy.

## Implementation status

BW-35.4 implements the Phase 4 browser-only Posting Plan preview and safe CSV v1 export. See `docs/features/bw35-4-posting-plan-csv-export.md`; this note does not alter the audit's historical findings.
