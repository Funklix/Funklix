# BW-31.5 Content Workspace recovery and UX audit

**Audit date:** 2026-09-02  
**Scope:** documentation-only analysis of the current local tree and local history through BW-31.4  
**Evidence method:** source inspection, comparison of local commits `11dff80` (BW-31.2) and `357e7fa` (BW-31.4), and an in-memory deterministic runtime fixture. No production, style, test, package, or boot-safety file was changed.

## 1. Executive conclusion

**Decision: GO for a narrowly bounded BW-31.5.1 recovery, NO-GO for UX redesign until recovery runtime cases pass.** Three concrete integration defects explain the reported failures:

1. **Canvas scheduling first fails at `evaluateScheduling()`'s `APPROVAL_REQUIRED` condition.** The Canvas node button still renders, is enabled, stops propagation, and calls `openSchedulePostModal(node.id)`. BW-31.4 replaced the legacy overlay with `renderContentWorkspace()` plus `openCalendarSchedule()`. The canonical dialog rejects every non-Approved post (and Approved posts without a matching `approvedContentFingerprint`). Its error is written to the hidden Content Workspace `.cw-feedback`, so the Canvas appears inert.
2. **Inspector scheduling is not absent in markup; it is operationally unusable for the same reason.** `#add-to-posting-calendar-btn` is shown for a selected Social Media Posting and calls the same legacy-named bridge. There is no Inspector-specific status/readiness preflight, no visible blocker, and no direct application scheduling command. BW-30.1 correctly hides the Inspector outside Canvas; BW-31.4 did not replace the Inspector control but redirected it into a mounted module whose feedback host is outside the visible view.
3. **False “Content deleted” starts in the Content Workspace's guarded `c.getNode` closure, not in the transition writer.** `renderContentWorkspace()` captures the entire `contentWorkspaceIdentity()` string and defines `getNode: id => contentWorkspaceIdentity() === identity ? getNode(id) : null`. If any identity component changes after render—including `lastKnownUpdatedAt` after autosave or any material Canvas revision—the still-existing node is deliberately returned as `null`. The transition click handler then runs `projectAsset(null)` and maps that result to `t.deleted`. The failed comparison is `contentWorkspaceIdentity() === identity`; it is not an authoritative `state.nodes` miss.

The architecture should use one application-level **plan-post command** accepting canonical node ID and source context. It must resolve from current `state.nodes`, revalidate access/lifecycle/readiness, explain eligibility in the initiating surface, open one canonical dialog, and mutate only after confirmation. Use **Model C**: Draft/review assets may receive an internal target date; editorial state and publishing blockers remain visible, while future external publishing remains approval-gated.

The current workspace renders too many simultaneous systems: header/context/refresh, three destinations, seven overview metrics, up to eight Library controls, result count, metadata-heavy cards, five Review filters, and a Calendar with controls, four more metrics, grid/agenda, queue, badges, disclosures, and dialogs. The evidence supports two destinations—**Content** and **Calendar**—with Review as an attention shortcut/filter, one compact attention strip, and progressive disclosure.

## 2. Confirmed failures

### Failure A — Canvas scheduling

| Question | Finding |
|---|---|
| Button rendered/enabled | Expanded Social Media Posting creates `calendarBtn`; Inspector also retains `#add-to-posting-calendar-btn`. The expanded-node button is enabled. Inspector visibility and disabled state depend only on a single selected Social Media Posting, not approval/readiness. |
| Listener/callback | Node listener stops propagation and calls `openSchedulePostModal(node.id)`. Inspector listener resolves `state.selectedPrimary` and calls the same function. |
| Canonical ID | Normal string IDs are passed correctly. The Canvas closure uses `node.id`; no filtered index is used. `getNode` is strict (`n.id === id`), so callers must not normalize independently. |
| Dialog reachability | `openSchedulePostModal` resolves the node and module, calls `renderContentWorkspace()`, then `openCalendarSchedule`. The module and hidden host exist when scripts/DOM loaded normally. |
| Exact first failure | For the established Draft/In Review workflow, `openScheduleDialog` calls `evaluateScheduling`; `normalizedStatus(node.status) !== "Approved"` adds `APPROVAL_REQUIRED`. An Approved node without an exact material fingerprint also adds `APPROVAL_STALE`. |
| Visibility | `openScheduleDialog` writes raw reason codes to `.cw-feedback` and returns before creating a dialog. Because active view remains `board`, that feedback is inside hidden `#content-workspace-view`. Failure is silent on Canvas. |
| Active view/lifecycle | Active view itself is not checked. The module is forcibly rendered/mounted while hidden. Its `getNode` guard can independently reject if the oversized identity changes. |
| Overlay/events/closure | `stopPropagation` is correct and no overlay intercept was found. The old `#posting-plan-overlay` still exists, but `confirmSchedulePost` is retired to close-only. The stale mounted-context closure is a secondary hazard, not the first failure in the reproduced non-Approved case. |
| Behavior change | Before BW-31.4 the same action opened the legacy date/time overlay for any selected Social Media Posting and wrote `social.scheduled*`. BW-31.4 intentionally centralized mutation but accidentally introduced approval gating and invisible error delivery. |

### Failure B — Inspector scheduling

Before BW-31.4 the Inspector button opened the legacy planner, showed the existing scheduled date, and used the legacy confirm listener. Current markup IDs and click listener remain. `fillInspector()` and `updateInspectorActionVisibility()` still recognize the role correctly and expose the button for Social Media Posting; scheduled text understands canonical or legacy metadata. What is missing is an Inspector-facing command result: no readiness/editorial status explanation, no planned-date versus publishability distinction, no visible error region, and no “Open Calendar” action.

BW-30.1 is behaving as designed: Inspector exists only in the Canvas view, is inert elsewhere, and uses column/overlay lifecycle. Inspector and Canvas resolve the same authoritative selected node. The defect is that BW-31.4 exposed the mutation writer only as `onSchedule` inside the Content Workspace context; Canvas/Inspector can reach it only through `openSchedulePostModal` and a hidden module mount. Scheduling controls do not depend on approval before click, but the downstream dialog does.

### Failure C — false deletion

The exact rejection paths are:

1. **Before dialog:** `bind()` handles `[data-cw-transition]`, reads the dataset string, then calls `projectAsset(c.getNode(...))`. The app-supplied `c.getNode` returns `null` when the current identity string differs from the captured render identity. `projectAsset(null)` returns `null`, and `bind()` immediately renders `t.deleted`.
2. **After preparation:** if the node is genuinely absent, `applyContentWorkspaceTransition()` calls strict `getNode(prepared.nodeId)` and returns `NODE_DELETED`, which `applyPrepared()` correctly maps to `t.deleted`. This is not the reproduced false-positive path.

The exact false-positive comparison is therefore:

```text
contentWorkspaceIdentity() === identity
current identity            captured identity
```

The identity includes account email, Board ID, Board-load generation, view/edit booleans, Public Viewer token, `lastKnownUpdatedAt`, and a JSON serialization of material/render node fields. A save acknowledgement changing only `lastKnownUpdatedAt`, or an unrelated node/material edit changing `canvasRevision`, makes the comparison false even though `state.nodes.find(n => n.id === requestedId)` still succeeds. The click handler misclassifies **context freshness** as **node deletion**.

### Failure D — overload

The hierarchy has four competing summary/filter layers before card content, duplicates editorial/readiness state in overview metrics, filters, badges, issue text and “next” text, and presents Review as both card transitions and a full destination. Calendar repeats platform, role, readiness, schedule state, review count and internal-planning disclosure already communicated elsewhere. The design is functionally rich but lacks an operational focal point.

## 3. Runtime reproduction results

### Fixture and evidence boundary

An in-memory DOM fixture represented an editable loaded Board (`board-31-5`, editor `editor@example.test`, generation 7) with string canonical IDs and five assets: Approved LinkedIn post with matching approval fingerprint; In Review Instagram post; Needs Changes Content asset; Ready Draft social post with caption/CTA/platform; and an incomplete social asset. It supplied the real module with `getNode`, transition/schedule callbacks shaped like the app boundaries, a Canvas trigger, selected Inspector node, and current projection. It introduced a render-generation change between preparation and confirmation for the approval case. No fixture was written to the repository.

“Runtime” below means module rendering/event/callback behavior was executed against that deterministic fixture. “Source trace” means the surrounding monolithic app listener/persistence chain was verified from source because loading all browser/application services is outside a deterministic unit DOM fixture.

| # | Flow | Trigger → listener → callback | Checks/dialog | Mutation and synchronization | Result |
|---:|---|---|---|---|---|
| 1 | Canvas → Add | Visible expanded-node button → `click`/stop propagation → `openSchedulePostModal` → `openCalendarSchedule` | Current node found; editor allowed; Draft/In Review fails Approved status before dialog | No mutation, autosave, or activity; error targets hidden Workspace feedback | **Reproduced from source + module:** visible no-op; first code `APPROVAL_REQUIRED`. Approved fixture opens canonical dialog. |
| 2 | Inspector → schedule | Visible `#add-to-posting-calendar-btn` → selected-node lookup → same bridge | Correct role; same approval/fingerprint checks; no Inspector preflight | Same as flow 1 | **Reproduced:** control exists, but non-Approved flow is unusable and invisible. |
| 3 | Library → Schedule | No Library-card Schedule trigger is rendered by `actions()` | N/A | N/A | **Reproduced:** entry is absent; scheduling exists in Calendar queue/event only. |
| 4 | Workspace → Submit | Card transition listener → live lookup → `openDialog`/`applyPrepared` | Ready Draft passes permission/readiness/status; no dialog when confirmation unnecessary | Writer updates status, activity, Canvas card, Inspector if selected, List; `markUnsaved`; Workspace rerender | **Reproduced:** success for stable identity; vulnerable to pre-click identity invalidation. |
| 5 | Review Queue → Approve | Approve listener → guarded lookup → confirmation for warnings → writer | Stable Ready item can apply directly; Needs-attention requires checkbox. Identity change before initial click returns deleted; change after prepared action produces stale/access classification, not deletion unless truly removed | On success sets fingerprint/status, activity, all render paths, autosave | **False deletion reproduced** by changing identity while authoritative node remained present. |
| 6 | Review Queue → Request changes | Secondary transition → dialog/note → writer | Permission, status, current fingerprint/readiness; required note | Adds bounded review note, status/activity, rerenders, `markUnsaved` | **Reproduced:** works under stable identity; same pre-click false-deletion risk. |
| 7 | Calendar → Reschedule | Event → detail dialog → reschedule → canonical schedule dialog → `onSchedule` | Access, node, status, approval fingerprint, readiness, local time/DST, schedule revision | Updates only `planningSchedule`, removes duplicate legacy fields, activity, Canvas/Inspector/List/legacy Calendar/Workspace, `markUnsaved` | **Reproduced:** Approved matching-fingerprint fixture succeeds. |
| 8 | Calendar → Remove | Event detail → remove → `prepareSchedule`/`onSchedule` | Access, node/current status/readiness/fingerprint and schedule revision; removal bypasses eligibility evaluator after stale guards | Deletes canonical planning metadata; activity/rerenders/autosave | **Reproduced:** succeeds; no confirmation is presented. |
| 9 | Show on Canvas | Card/detail trigger → `onOpenNode(nodeId, ..., identity)` | Requires exact action identity, view permission, strict node lookup | Changes active view, focuses/selects Canvas node; optional Inspector open; no asset mutation | **Reproduced/source traced:** stable identity works; stale identity silently rerenders Workspace. |
| 10 | Return to Workspace | app navigation listener → `setActiveView("content_workspace")` → render | Board/access context projected anew | No mutation; latest state shown | **Source traced:** canonical state is reprojected and Inspector is made inert by BW-30.1 shell lifecycle. |

Autosave remains canonical through `markUnsaved()` for the two BW-31 boundaries; no external social API is called. Activity is recorded only after successful status/schedule mutation.

## 4. Pre/post BW-31.4 comparison

| Area | Immediately before BW-31.4 | Current | Classification |
|---|---|---|---|
| Canvas/Inspector Add | `openSchedulePostModal` opened visible legacy overlay for any Social Media Posting | Legacy-named function mounts hidden Workspace and delegates to canonical dialog | Centralization intentional; visible bridge accidentally disconnected from feedback/navigation. |
| Confirm | Wrote `social.scheduledDate`, `scheduledTime`, `scheduledAt`, `addedToCalendar`; saved directly | Old confirm is close-only; `applyContentWorkspaceSchedule` writes versioned `planningSchedule` and marks unsaved | Intentional replacement; preserving old DOM/listener is safe during recovery. |
| Eligibility | Role/date/time/read-only checks; no Approved requirement | Approved + exact approval fingerprint + readiness + supported platform + access/lifecycle | Newly blocked established planning behavior. |
| Inspector | Existing Add/Scheduled button and schedule metadata | Same IDs/listener/text; canonical metadata display added | Not removed, but operational contract became hidden-Workspace-dependent. |
| Node action | Expanded Social card always exposed Add/Scheduled | Same button still tests only legacy `social.scheduledAt` for its label | Accident: canonical schedules can still label Canvas node “Add”. |
| Calendar navigation | Legacy top-level Calendar/list view displays legacy fields | Workspace adds Month/Agenda/queue while legacy view remains | Additive but duplicated; canonical writer clears fields legacy view reads, so legacy Calendar becomes empty after new scheduling. |
| IDs | App strict identity; module projects string IDs | Same, with dataset strings and strict app lookup | Safe for ordinary UUID strings, unsafe as a general mixed-type contract. |
| Lifecycle | Review boundary used render identity and guarded callback | Schedule adds access generation/revision; mounted context still carries identity-guarded lookup | Guard is over-broad and conflates stale view with missing node. |
| Dialog host | Legacy overlay in `index.html` | Canonical dialog appended to `document.body`; errors written inside Workspace host | Dialog is globally visible only if eligibility passes; blocker is hidden on Canvas. |
| Layout | Library + Review Queue, already dense | Adds third tab, Calendar metrics/filters/month/agenda/queue/details | Calendar compounds existing hierarchy rather than simplifying it. |

## 5. Scheduling-entry inventory

| Entry point | Visible? | Listener? | Callback | Eligibility | Dialog | Mutation path | Current result |
|---|---|---|---|---|---|---|---|
| Social Media Posting node | Yes when expanded | Yes | `openSchedulePostModal(node.id)` | Approved, fingerprint, readiness, platform, access | Canonical only after pass | `applyContentWorkspaceSchedule` | Draft/review appears inert; errors hidden. |
| Expanded posting preview | Same node action | Yes | Same | Same | Same | Same | Same defect; label only checks legacy schedule. |
| Inspector | Yes for selected social node | Yes | Same bridge via selected ID | Same downstream; button has no preflight | Same | Same | Missing/unusable for established pre-approval planning. |
| Content Library card | No scheduling action | No | None | N/A | None | None | Missing. |
| Review Queue | No schedule action on cards | No | None | N/A | None | None | Review only; planned date may display as metadata. |
| Calendar unscheduled queue | Yes only for eligible Approved assets | Yes | `openScheduleDialog` | Eligibility pre-filtered; warning accepted in queue calculation | Canonical | Same writer | Works for exact Approved fixture. Ineligible assets disappear rather than explain why. |
| Calendar event detail | Yes for scheduled assets | Yes | detail → reschedule/remove | Stale guards; reschedule re-evaluates full eligibility | Canonical/detail | Same writer | Works; removal has no confirmation. |
| Legacy List/Calendar | Calendar destination remains; no scheduling trigger identified | Navigation/event listeners exist | `renderCalendarView` | Reads legacy fields only | Legacy overlay DOM retained but active command bypasses it | No active legacy writer | Canonical events disappear because writer clears legacy fields. |

**Authoritative command:** introduce a small app-level `requestContentPlanning({ nodeId, source, trigger })`. It should (1) preserve and resolve the canonical ID from current `state.nodes`; (2) validate current Board/account/access generation without using render equality as lookup; (3) calculate current readiness; (4) evaluate planning eligibility and return localized actionable reasons to `source`; (5) open the one body-hosted dialog; and (6) perform no mutation before confirmation. Confirmation should call the existing guarded writer through a freshly prepared token. Canvas, Inspector, Library, queue and event detail must call this command—never duplicate Calendar rules.

## 6. Exact Canvas scheduling root cause

Call chain:

```text
calendarBtn click
  → stopPropagation()
  → openSchedulePostModal(node.id)
  → getNode(nodeId) + renderContentWorkspace()
  → FunklixContentWorkspace.openCalendarSchedule(nodeId, activeElement)
  → mounted.context.getNode(nodeId)
  → openScheduleDialog(...)
  → evaluateScheduling(...)
  → normalizedStatus(node.status) !== "Approved"
  → reasonCodes += "APPROVAL_REQUIRED"
  → feedback(hidden Workspace host) and return
```

The first failing condition for a previously schedulable Ready Draft/In Review post is **Approved status**. If status is Approved but it predates approval fingerprints, the next failure is `node.approvedContentFingerprint !== materialFingerprint(node)` → `APPROVAL_STALE`. The node, module, listener and dialog factory exist. The dialog is never constructed. No propagation, overlay or closure issue is needed to reproduce the primary defect.

Minimal recovery: point this unchanged ID/listener to the shared request command, adopt planning eligibility independent of approval, and route rejection text to a visible Canvas status/trigger description. Preserve the legacy overlay DOM and IDs until dependency regressions prove they can be retired.

## 7. Exact Inspector scheduling root cause

The Inspector control was **not removed**: HTML ID, element cache, role-driven visibility, disabled state, localized label, schedule metadata and click listener remain. The exact missing integration is that Inspector never received a scheduling command surface after the old overlay implementation was retired. It calls the Canvas bridge, which mounts the Content Workspace behind the active Canvas and can only report pre-dialog failure inside that hidden host.

Role detection is correct (`selectedNode?.type === "Social Media Posting"`). Button availability does not consider status, readiness, platform, fingerprint, or access beyond node type; downstream evaluation considers all of them. Inspector and Canvas share the authoritative node via `state.selectedPrimary`/`getNode`. BW-30.1 only governs whether the Inspector is visible/inert and is not the rejection source.

Intended Inspector: show editorial status, readiness, internal planned date, one context-sensitive review action, **Plan post/Reschedule**, **Open Calendar**, and a short “internal plan; approval required only before future publishing” disclosure. It must remain compact, not duplicate Workspace filters/cards.

## 8. Exact false deletion root cause

### Identity map

| Field | Render/card value | Action/dialog value | Authoritative/current value | Comparison and finding |
|---|---|---|---|---|
| Projection node ID | `text(n.id)` (trimmed string) | DOM dataset string; `prepare.nodeId = asset.id` | `node.id`; app `getNode` strict equality | UUID strings match. Numeric IDs are unsupported by projection; mixed types are not normalized centrally. |
| DOM node ID | HTML-escaped attribute, decoded by dataset | Dataset string | Same normal UUID expected | Escaping does not alter dataset identity. |
| Action payload ID | Dataset/projected ID | Prepared ID | Strict lookup | No filtered-array index or selected-node substitution. |
| Dialog prepared ID | Fresh `prepare(asset,...)` at confirmation | String | Strict lookup | Rerender does not rewrite this token; dialog closure holds projection. |
| Board ID | Context Board | Prepared Board | Current Board | Exact string equality in writer; mismatch maps permission, not deleted. |
| Account | Context email | Prepared account | current user email | Exact string equality; no normalization; mismatch maps permission. |
| Board-load/access generation | `boardLoadGeneration` | `accessGeneration` | current generation | Exact numeric equality; mismatch maps permission/access. |
| Public token/access | Included in render identity/context | Not copied as token | current public/access flags | Revocation maps permission in writer; lookup guard can null first. |
| Lifecycle identity | Huge `contentWorkspaceIdentity()` | Captured in context closure | Recomputed on each `c.getNode` | **False mismatch:** any serialized revision or `lastKnownUpdatedAt` change makes lookup return null. |
| Fingerprint | Projection `materialFingerprint` | Prepared fingerprint | Recomputed from current node | Mismatch correctly maps stale content in writer. JSON cloning is irrelevant. |
| Status | Normalized projection status | Prepared current status | Re-normalized current status | Mismatch maps invalid status, not deleted. |
| Readiness | Projection level | Prepared level | Recomputed | Mismatch maps stale content. |

**Actual projected reference:** a plain projection `{ id: "review-social-1", status: "In Review", readiness, fingerprint, ... }`, not the authoritative object. The authoritative `state.nodes` still contains `{ id: "review-social-1", ... }`. The wrapper declines to perform that lookup because identity changed; direct app `getNode("review-social-1")` succeeds.

No stale object reference, JSON clone, filter index, HTML escaping, selected-node confusion, account-format change, or previous-render dialog callback is required. Filter/sort rerenders reuse context but do not themselves change identity. Autosave acknowledgement (`lastKnownUpdatedAt`) and unrelated material Board/node changes do. A material change to the action node should produce `STALE_CONTENT`; a change elsewhere should not invalidate this action at all.

**Minimal correction:** separate resolution from lifecycle validation. `resolveCurrentContentNode(canonicalId)` must query current `state.nodes` directly. Only return `NODE_DELETED` when that lookup misses. Validate Board/account/access generation separately; compare the action node's current fingerprint/status/readiness at confirmation and classify those exact mismatches. Do not gate `getNode` on whole-Canvas or `lastKnownUpdatedAt` equality.

## 9. Scheduling eligibility reassessment

| Model | Benefit | Cost/risk | Assessment |
|---|---|---|---|
| A: Approved only | Strongest guard against confusing plan with publish | Prevents normal capacity/deadline planning; broke legacy behavior; hides blocked work | Reject for internal planning. |
| B: Any usable asset planned | Simple; planning decoupled from publishing | “Usable” and draft/review distinctions need visible definition | Better, but can under-communicate workflow state. |
| C: Draft/review target dates + visible state/blockers | Supports real editorial planning and makes risk explicit; future-safe for connectors | Requires clear visual/status semantics | **Recommended.** |

Persist `planningSchedule` as internal intent independent of editorial status. Define planning eligibility as editable Board + schedulable role + minimally meaningful platform/caption + valid local date/time/timezone. Show readiness warnings but permit planning after explicit acknowledgement where safe. Future publishing eligibility separately requires Approved status, matching approval fingerprint, connector/account capability, and delivery validation. Scheduling never calls an external API and never changes editorial status.

## 10. Review workflow usability

| Action | Current location/primary behavior | Confirmation/blockers/feedback | Simplification |
|---|---|---|---|
| Submit | Library/Review card primary for Draft | Ready submits immediately; Incomplete disabled; reasons are card issue text but not tied clearly to button | One primary “Submit for review”; inline missing fields with Canvas link. |
| Approve | Review/Library primary for In Review | Immediate when Ready; checkbox dialog when warnings; false deleted possible; success status rerenders | One primary Approve; preflight warning summary; stable dialog token. |
| Request changes | Simultaneous secondary button for In Review | Dialog and required note; same stale lookup risk | Put in secondary menu unless reviewer workflow makes it co-primary. |
| Resubmit | Primary for Needs Changes | Same readiness blocking; latest note shown | Primary “Resubmit” with unresolved note context. |
| Reopen | Primary for Approved | Confirmation; clears approval fingerprint | Secondary menu action, because it reverses completion. |

Each card should expose one next-best primary action, one secondary menu, and Show on Canvas where useful. Explain blockers before click, announce success/failure in the active surface, and avoid showing every valid transition at once.

## 11. Current information architecture

Current render order is: page header (title, description, Board/assets/projection context, access state, Refresh); Library/Review/Calendar tabs; then mode-specific content. Library adds seven editorial/readiness metrics, search, role/platform/stage/status/readiness/owner/language filters, sort/clear, result count, heading and cards. Review adds explanation, five queue filters and cards. Calendar adds disclosure, Month/Agenda/date navigation, five filters/clear, four planning metrics, month/agenda content, and unscheduled queue.

Review Queue is mostly a filtered/status-sorted expression of the same assets and actions. It should not remain a top-level destination. Recommended hierarchy:

1. **One operational header:** Content, compact Board context, search, Content/Calendar segmented switch.
2. **One compact attention strip:** Needs review, Changes requested, Unscheduled, Incomplete; each is a shortcut/filter.
3. **Content:** All / Needs attention / In review / Approved subfilters; cards.
4. **Calendar:** scheduled timeline/month and compact unscheduled/blocked grouping.

Refresh can move to a secondary menu or automatic projection indicator. Show the internal-planning disclosure once per Calendar, not per event/dialog/card.

## 12. Card-density findings

Retain: role, title, two-to-three-line bounded preview, platform, one editorial status, one readiness state, planned date if any, one primary action, secondary menu. Merge readiness status plus missing-field sentence; do not render badge + issues + “next” paragraph for the same condition.

Move owner, comments, AI Review, funnel stage, language, detailed field list, schedule provenance/timezone/revision, timestamps and review-note history into expanded details/Inspector/menu. Show the latest requested-change note only when it is the user's next task.

* **Compact:** one-column row/card, title + role/platform, status/readiness, planned date, primary action; preview hidden.
* **Comfortable desktop:** bounded preview, maximum two concise metadata rows; cards align without artificial empty height.
* **Mobile:** one column, full-width 44px controls, no horizontal card scroll, metadata wraps beneath title, menu remains keyboard/touch operable.

## 13. Filter findings

* **Always visible:** search, attention/status shortcut, and platform only when more than one platform exists; sort in a small menu.
* **Attention shortcuts:** Needs review, Changes requested, Unscheduled, Incomplete.
* **More filters:** role/type, owner, readiness, scheduled state/date, language.
* **Defer at current scale:** funnel stage and separate review-state filter unless evidence shows repeated use; status already captures review state.
* Preserve active-filter chips and one Clear action, but collapse secondary controls by default. A small Board should not see eight enterprise controls before its assets.

## 14. Calendar UX findings

Month and Agenda are both useful, but the current Calendar duplicates Library badges, platform/role/readiness, filters, metrics, warnings and disclosures. Compact V1 should answer: **what is planned, what lacks a date, what is blocked, and what needs attention today**.

Use Agenda by default on mobile; Month on desktop with concise event title + editorial blocker marker. Place a collapsible right/under queue with “Unscheduled” and “Blocked” groups. Event detail owns timezone/provenance and Reschedule/Remove. Planning counts should be at most Scheduled, Unscheduled and Blocked; “changed” is an attention item, not a fourth dashboard.

The legacy Canvas Calendar should remain as a compatibility shortcut during recovery and route to Workspace Calendar once canonical rendering is supported. Do not delete or rename legacy DOM IDs. Canonical scheduling currently clears the fields that legacy rendering reads, so either teach the shortcut to route or adapt projection in a later verified step; visually hiding it is acceptable only after keyboard/navigation dependencies are checked.

## 15. Blocking-reason audit

| Preflight label | Meaning | Where to fix | Continue? |
|---|---|---|---|
| Ready / Can be planned | Minimum planning fields are valid | Choose date/time | Yes; does not imply publishing. |
| Needs approval before publishing | Internal date is allowed; external delivery is not | Review workflow | Yes for planning, no for future publish. |
| Missing caption | Required social copy absent | Canvas/Inspector caption field | No until caption exists. |
| Missing platform | Channel cannot be interpreted | Inspector platform | No. |
| Approved content changed | Fingerprint differs from approved material | Reopen/review current version | Planning may remain with warning; future publish blocked. |
| Needs review | Editorial action pending | Review Queue/Content filter | Yes for planning under Model C. |
| No permission | Board is read-only/access changed | Request editor access | No mutation. |

Every trigger should expose its current preflight state via adjacent text/title/`aria-describedby`. Failure output belongs to the active surface and an assertive live region. Generic “Cannot schedule” is insufficient when a known reason code exists.

## 16. Error-classification audit

| Code/current message | Origin/condition/actions | Actionable? | Correct message and next action |
|---|---|---|---|
| `NODE_DELETED` → Content deleted | Writer strict lookup miss; also falsely emitted by transition listener when guarded lookup returns null | Yes | Only “Content deleted” after direct canonical miss; close dialog and refresh projection. |
| identity guard null → Content deleted | `c.getNode` whole-context mismatch before transition | Yes | “Workspace changed; review current item” only if action node changed; otherwise transparently resolve and continue. |
| `STALE_CONTENT` → asset changed | Fingerprint/readiness or resolved UTC mismatch | Yes | “Content changed; review current version,” preserving source/action. |
| `INVALID_STATUS` → different editorial state | Current status differs/precondition invalid | Yes | State the new status and next valid action. |
| `PERMISSION_DENIED` / `ACCESS_REVOKED` | account/Board/generation/edit/public mismatch | Yes | “Editing access changed; reopen Board or request access.” |
| `READINESS_INCOMPLETE` | required fields missing | Yes | List missing fields and open Canvas/Inspector. |
| `READINESS_ACK_REQUIRED` | warnings not accepted | Yes | Show warning checkbox; do not hide asset. |
| `APPROVAL_REQUIRED` | schedule evaluator requires Approved | Yes | Under Model C remove from planning; reserve message for publishing. |
| `APPROVAL_STALE` | fingerprint missing/mismatch | Yes | “Approved content changed; review again before publishing.” |
| `STALE_SCHEDULE` | schedule revision differs | Yes | “Schedule changed; review the current date/time,” then reload details. |
| `ACCOUNT_REQUIRED` / `BOARD_REQUIRED` | missing context | Yes | “Open an editable Board while signed in.” |
| `ROLE_NOT_SCHEDULABLE` | unsupported role | Yes | “Only Social Media Posting can be planned here.” |
| `PLATFORM_MISSING` / `PLATFORM_UNSUPPORTED` | missing/non-enumerated platform | Yes | Identify platform field and supported choices. |
| date/time/timezone/DST codes | invalid, nonexistent or ambiguous local time | Yes | Field-specific correction; offer earlier/later for ambiguity. |
| `ACTION_NOT_PERMITTED` | remove without current schedule | Yes | “Schedule already removed; refresh event.” |
| unknown → wrong status/invalid | fall-through mapping | Weak | Reserve generic message for unknown code and log diagnostics; never map known stale/access cases generically. |

Dialog state stale is not a dedicated code today. Add classifications for context refresh versus action-node change; schedule revision already covers concurrent schedule edits.

## 17. Mutation-boundary audit

There are multiple concepts despite two nominal writers: strict app `getNode` versus identity-gated context lookup; whole-workspace identity versus Board generation/access checks; module fingerprint plus approval fingerprint use; module readiness; status normalization/evaluation; Canvas/List/legacy Calendar/Inspector/Workspace rerenders; and legacy direct-save scheduling retained as dead DOM/listener code. Status and schedule writers both duplicate account/Board/access/node/status/readiness/fingerprint guards and synchronization lists.

Minimum shared Content Operations functions, without broad `app.js` rewrite:

1. `resolveCurrentContentNode(nodeId)` — canonical ID policy + direct current-state lookup.
2. `captureContentLifecycle(node, action)` — Board/account/access generation, node ID, relevant fingerprint/status/readiness/schedule revision.
3. `validateContentLifecycle(token)` — typed mismatch, never deletion unless direct miss.
4. Pure existing `calculateReadiness`, `normalizedStatus`, `materialFingerprint` and transition/planning evaluators.
5. `requestContentAction({ nodeId, action, source, trigger })` — visible preflight/dialog preparation.
6. Narrow status/schedule mutators that modify selected fields only.
7. `synchronizeContentOperations(node, event)` — established Canvas card, Inspector, List, legacy Calendar compatibility and Workspace rerenders; one `markUnsaved`; one activity event.

## 18. Inspector integration

Current Inspector has Social fields, schedule button/date display, AI review/regeneration actions and generic node status fields, but no integrated human editorial readiness/action panel or planning blocker explanation. Scheduling is role-visible, hidden for other roles, and disabled only when the selected node is not Social. Outside Canvas BW-30.1 correctly removes the Inspector from layout/focus.

Target Social Inspector order: editorial status → readiness with concise missing fields → one next review action → internal planned date → Plan/Reschedule + Open Calendar → one external-publishing disclosure. Keep owner/history/advanced scheduling in disclosure. Never reserve Inspector space without a valid supported selection.

## 19. Canvas-node integration

Expanded Social node currently has Copy Caption, Copy Full Post, Add to Posting Calendar, and regeneration actions. Preserve these listeners/IDs, show review status compactly, and rename the visible label to **Plan post** while external publishing is not connected (retain the existing internal ID/contracts). Canonical `planningSchedule` must drive the planned label, not only `social.scheduledAt`. Click must either open the canonical dialog or render immediate, focused, accessible feedback adjacent to the button.

## 20. Responsive and visual hierarchy

| Context | Finding | Recommendation |
|---|---|---|
| Large desktop | Grid plus wide metric/filter bands creates horizontal scanning; cards repeat metadata | Bound readable width while letting Calendar use width; 3 compact cards maximum. |
| Standard desktop | Metrics, filters and cards compete; controls wrap unpredictably | Two destinations, one attention strip, 2-card comfortable grid. |
| Tablet | Calendar grid + queue and wrapped filters become dense; Inspector overlay is correct | Agenda default near tablet threshold; queue below; collapse filters. |
| Mobile | Existing media rules help, but Month semantics and button clusters remain crowded | Single column, Agenda default, no horizontal scrolling, 44px targets, bottom-safe dialogs. |
| Light/Dark | Dedicated theme selectors exist, but many bordered containers amplify noise | Fewer borders/surfaces, one primary accent, semantic warning/error colors with contrast. |
| English/German | German labels/disclosures are longer and magnify wrapping | Prefer short verbs, flexible controls, test 200% zoom and longest German states. |

Use fewer simultaneous containers and pills, stronger section headings, consistent type scale, one accent for the next action, and progressive disclosure. Editorial state should be the primary badge; readiness becomes concise semantic text/icon; planning state appears only when relevant.

## 21. Accessibility

Strengths: workspace status live regions, tab roles/arrow handling, modal role/`aria-modal`, Escape and basic focus trap, focus restoration for most dialogs, and BW-30.1 inert Inspector behavior. Gaps:

* Review tablist lacks a clear roving `tabindex` implementation; all tabs may remain in sequential order.
* `<details>` menus are keyboard-native but need menu naming, predictable focus and close behavior.
* Event detail dialog lacks an `aria-labelledby`; removal has no confirmation.
* Calendar month uses visual grid cells rather than explicit calendar/grid semantics and keyboard date navigation.
* Schedule dialog's captured focusable list excludes dynamically relevant semantics and does not guard stale/removed trigger focus.
* Canvas errors go to an off-view polite region; users receive no screen-reader announcement.
* Raw reason codes are not user-facing/localized.
* Readiness and editorial badges need distinct accessible labels, not color alone.
* Validate touch target sizes, 200% zoom, mobile keyboard obstruction, and focus restoration after rerender/stale dialog.

Recovery must keep native buttons, focus-visible styles, body-hosted modal semantics, source-aware live regions, and explicit error announcement.

## 22. Regression gaps

BW-31.1/31.2/31.4 pass because they combine pure-function assertions, string/source checks and minimal hosts whose `querySelectorAll()` returns no elements. They verify rendered strings and evaluators, not real Canvas/Inspector listeners. BW-31.4 calls `evaluateScheduling` with pre-Approved fixtures and a matching fingerprint, so the established Draft scheduling regression is encoded as expected behavior. It checks that app source contains writer fragments but does not click the bridge, switch active views, observe hidden feedback, or confirm a real dialog. BW-31.2 tests transition policy and source text but skips a render-identity change between render/click and does not use the app's guarded `getNode` closure. BW-30.1 verifies shell layout, not Inspector action content.

No current check renders all integrated hierarchy at realistic volume or assesses responsive composition, cognitive duplication, Light/Dark visual hierarchy, German fit, month keyboard behavior, or mobile scrolling.

Future runtime regressions must:

1. Load an editable Board fixture with the five required lifecycle/readiness assets and real IDs.
2. Click actual Canvas and Inspector buttons and assert the same dialog node opens.
3. Plan a Draft under Model C and assert publishing remains blocked/no external request occurs.
4. Click Library/Calendar entry points and compare command payload/path.
5. Change `lastKnownUpdatedAt` and an unrelated node between render and Approve; approval must still resolve the action node.
6. Change the action node fingerprint/status/readiness; assert exact stale/status/readiness message.
7. Delete the action node; only then assert Content deleted.
8. Rerender/filter/sort while a dialog is open, then confirm safely.
9. Assert one activity, one dirty/autosave trigger, canonical metadata only, and synchronized Canvas/Inspector/Workspace/Calendar.
10. Render realistic asset volumes at desktop/tablet/mobile in both themes/languages and assert no horizontal overflow and bounded card controls.

## 23. Functional recovery plan

### BW-31.5.1 only

1. Add direct authoritative node resolution and typed lifecycle validation; stop using whole-workspace identity as a lookup gate.
2. Add one source-aware application scheduling command and route Canvas, Inspector and Workspace scheduling triggers through it.
3. Adopt Model C internal planning eligibility while leaving publishing approval-gated; expose localized blockers at the trigger.
4. Preserve current Workspace UI and legacy IDs/DOM; do not redesign.
5. Fix Canvas canonical schedule label/display and add Inspector Plan/Reschedule/Open Calendar affordance.
6. Add runtime integration regressions for all ten flows, identity changes, true deletion, synchronization, one persistence/activity effect, and no external API.

Acceptance:

1. A Ready Social post opens scheduling from Canvas, Inspector and Content Workspace through the same dialog/command.
2. Draft/review content may receive an internal planned date; this does not imply or perform publishing.
3. Existing In Review node approves by canonical ID after unrelated render/autosave changes.
4. Rerender while dialog open cannot yield false deletion; genuine removal does.
5. Status synchronizes Workspace/Canvas/Inspector; schedule synchronizes Workspace/Calendar/Canvas/Inspector.
6. No external API, duplicate persisted asset, or alternate save path is introduced; canonical autosave remains.

## 24. UX simplification plan

### BW-31.5.2 only after recovery passes

1. Reduce top-level destinations to Content and Calendar; convert Review Queue into attention shortcut/subfilter.
2. Replace seven Library/four Calendar metrics with one four-item attention strip, avoiding repeated counts/disclosures.
3. Keep search plus at most two contextual controls visible; collapse secondary filters.
4. Compact cards to minimum information, one dominant action, one secondary menu, optional Show on Canvas.
5. Simplify Calendar to scheduled/unscheduled/blocked/today; responsive Agenda default; progressive event detail.
6. Validate accessibility, Light/Dark, English/German, and responsive composition without altering verified command paths.

Measurable acceptance: at most two primary destinations; one dominant card action; one editorial/readiness communication cluster; one planning disclosure; secondary filters closed by default; known blockers visible pre-click; Calendar clearly groups scheduled/unscheduled/blocked; no viewport-width horizontal scroll at 320px; Inspector reserves no unsupported-view space; labels fit at 200% zoom in English/German; themes retain contrast and semantic hierarchy.

### Later Social Connector phase

Connected accounts, external publishing, delivery state, external posts and analytics remain separate. Connector commands consume publishing eligibility; they do not redefine an internal planned date.

## 25. Blast-radius table

| Area | Failure mode | Safeguard | Future regression |
|---|---|---|---|
| Campaign Canvas | Plan click looks inert | Shared command + Canvas live feedback | Actual node-button click. |
| Social nodes | Canonical schedule label stale | Read canonical then legacy | Label after schedule/reschedule/remove. |
| Inspector | Hidden-host dependency/space regression | Source-aware command; retain BW-30.1 lifecycle | Actual Inspector click across breakpoints/views. |
| Content Library | No schedule entry/too many actions | One primary plus menu | Command convergence assertion. |
| Review Queue | False deletion/duplicated actions | Direct resolution; filtered Content model | Autosave/unrelated rerender before Approve. |
| Calendar | Ineligible work vanishes; duplication | Unscheduled + blocked groups | Draft, blocked and Approved fixtures. |
| Legacy List/Calendar | Canonical events invisible | Route shortcut/preserve IDs | Canonical schedule visible via supported route. |
| Node status | Planning accidentally changes status | Narrow field mutator | Status unchanged after planning. |
| Readiness | Divergent calculation | One pure evaluator | Same readiness every surface. |
| Approval fingerprints | Planning/publishing conflated | Separate planning/publish evaluator | Changed Approved content remains planned but publish-blocked. |
| Scheduling metadata | Legacy/canonical duplication | One canonical writer; projection compatibility | Persisted shape/revision/DST round-trip. |
| Autosave | Duplicate saves or lost dirty state | One synchronization/persistence call | Spy exactly one mark/save cycle. |
| Activity/history | Duplicate/missing event | Append after successful mutation only | Exactly one typed event; none on cancel/fail. |
| Public Viewer | Mutation controls leak | Current access validation + hidden controls | Public fixture cannot prepare/confirm. |
| App Shell | hidden Inspector/dialog confusion | Source-aware host; preserve shell contract | View changes and focus restoration. |
| Localization | Raw codes/German overflow | Complete code-message map | EN/DE known-error and 200% zoom checks. |
| Themes | warning/action contrast | Semantic tokens/contrast audit | Light/Dark screenshots or computed contrast. |
| Mobile | month/filter/card overflow | Agenda default/collapsed filters | 320/375/768 widths, keyboard/touch. |
| Future publishing | Planned interpreted as publish-ready | Explicit separate eligibility/delivery state | Planning performs zero connector calls. |

## 26. Files by implementation phase

### Likely BW-31.5.1 recovery files

* `app.js` — shared command, direct resolution/typed lifecycle, synchronization bridge.
* `content-workspace.js` — planning evaluator/dialog entry and precise errors.
* Possibly `index.html` — compact Inspector hook/status host while preserving existing IDs.
* `language.js` — localized planning/blocker/action messages.
* One targeted runtime regression script, with its package command and Runtime Boot Safety registration.

### Likely BW-31.5.2 UX files

* `content-workspace.js` — hierarchy, filters, cards, Review-as-filter, Calendar composition.
* `styles.css` — density/responsive/theme hierarchy.
* `language.js` — shorter labels and accessible descriptions.
* One targeted responsive/integration regression script, with its package command and Runtime Boot Safety registration.

Do not change API provider endpoints, database schema, authentication permissions, Persona Journey, Campaign Creator output schema, Canvas geometry, Brand persistence, AI Insights formulas, external social APIs, or analytics storage. Package and boot-safety changes belong only to future implementation registration, not this audit.

## 27. Go/no-go criteria

All audit prerequisites are identified:

* Exact Canvas failure: `evaluateScheduling` adds `APPROVAL_REQUIRED`; hidden feedback makes it silent.
* Exact Inspector failure: retained control delegates to hidden Workspace-only command/reporting; no Inspector mutation-boundary entry.
* Exact false deletion: whole `contentWorkspaceIdentity() === captured identity` lookup guard fails before direct authoritative lookup.
* Authoritative command: `requestContentPlanning({ nodeId, source, trigger })` converging all entries.
* Authoritative resolution: direct current `state.nodes` lookup with one canonical ID policy.
* Eligibility: Model C internal planning separated from future Approved publishing.
* Minimum scope: resolver/classification, command convergence, two restored entries, exact blockers, regressions; no redesign.
* Simplification: two destinations, attention strip, Review filter, compact cards/filters/Calendar.
* Runtime strategy: real trigger/listener/dialog/confirm/rerender/persistence assertions with a loaded editable Board fixture.

Therefore BW-31.5.1 is **GO** within those boundaries. BW-31.5.2 remains **NO-GO** until every functional acceptance case is green.

## 28. Final recommendation

Recover behavior before changing presentation. First make deletion classification truthful and establish one source-aware internal planning command. Restore Canvas and Inspector entry points, permit pre-approval target dates under Model C, and expose exact blockers where the user clicked. Keep canonical autosave/activity and all legacy DOM IDs stable. Verify the ten real flows—including rerender/autosave during approval—before simplifying anything.

Then reduce the Workspace to Content and Calendar, treat review as attention state rather than a competing destination, remove duplicate metrics/status clusters, collapse secondary filters, and compact cards around one next action. External publishing remains a later, independently gated connector concern.
