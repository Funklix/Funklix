# BW-31 Content Workspace operations audit

**Audit date:** 2026-09-02
**Scope:** Documentation-only repository audit of Content Workspace, approval, calendar, and publishing readiness.
**Evidence base:** `index.html`, `app.js`, `styles.css`, `language.js`, `campaign-v3.js`, the BW-26–BW-30.1 audit/regression artifacts, and browser/API persistence helpers. No runtime behavior or schema was changed.

## 1. Executive conclusion

**Decision: GO for a read-only Phase 1 projection; NO-GO for review mutations, operational scheduling, or publishing until their contracts below are implemented and regression-protected.**

The visible **Content Workspace** navigation item is currently an inert label: it has no ID, listener, host section, renderer, or reachable `content_workspace` active view. The only architectural preparation is `SHELL_LAYOUT_BY_VIEW.content_workspace = "full"`. The existing **List View** and **Calendar View** are legacy Campaign Canvas projections reached through hidden compatibility controls/the Utilities popover; they are not modes inside a Content Workspace.

The authoritative content source is unequivocally the currently loaded Board's in-memory `state.nodes`, hydrated from `canvas_json` (or a local draft) and serialized with `state.edges`, counters, activity, and metadata. A workspace must project these node objects live; it must not persist a second content copy. Existing node IDs are stable within a Board but are not globally/provenance sufficient without account/workspace, Board, revision, platform, and external-post identities.

Repository evidence supports the likely roadmap architecture:

1. Canvas nodes remain the editable authority.
2. Content Workspace Phase 1 is a non-mutating operational projection.
3. Phase 2 routes edits through one guarded Canvas-node mutation service and Board save/autosave path.
4. Future publish jobs, external posts, and metric snapshots are separate durable records linked to Board/node/revision identities—not fields pretending that provider delivery occurred.

The smallest valuable V1 is **Content Library + deterministic readiness + filters/sorting + safe Show on Canvas/Open Inspector**, using the corrected BW-30.1 full-width shell and never mounting/reserving Inspector width in the workspace. Review Queue, Calendar scheduling, connectors, and metrics remain later phases.

## 2. Current Content Workspace inventory

### Entry point and lifecycle

| Concern | Exact current state |
|---|---|
| Navigation trigger | Sidebar `<button class="nav-item fk-btn">` whose label is `Content Workspace`; unlike neighboring navigation buttons it has **no ID** and no registered click listener. |
| Host DOM | **None.** There is no Content Workspace `<section>` or host ID. `#board-list-view` and `#calendar-view` are separate legacy hosts. |
| Active-view name | `content_workspace` exists only in `SHELL_LAYOUT_BY_VIEW` as a full-width layout key. `setActiveView()` has no visibility, active-navigation, title, or renderer branch for it. Runtime `state.activeView` starts as `board`. |
| Renderer | **None.** Relevant legacy renderers are `updateListView()` and `renderCalendarView()`. |
| Data source | Both legacy projections read live `state.nodes`; Calendar additionally reads each social node's `social` scheduling fields. |
| Supported roles | List accepts every role present in `state.nodes`. Calendar accepts only exact type `Social Media Posting`. |
| Filtering | Shared Canvas search/filter state: text plus type, platform, normalized status, owner, and state/funnel. The popover omits Email Campaign, Visual Concept, and Image Brief type shortcuts, although list projection can display them. |
| Sorting/grouping | List groups by exact `node.type`, alphabetically sorts group names, and otherwise retains Board array order. Calendar is month/day placement in Board array order. No user-selectable sort. |
| Status | List displays normalized status chips and unread status activity. Calendar does not distinguish editorial status, schedule state, or publication state. |
| Actions | List row opens exact Canvas node; comment badge opens its Post-its. Calendar post opens exact Canvas node. Canvas/Inspector provide copy, AI, media, regeneration, and scheduling actions—not a workspace. |
| Empty/loading/error | List has Board-empty and no-filter-result strings (mixed German/English). Calendar has no explicit empty, loading, or error state; an empty month grid is the implicit empty state. No Content Workspace states exist. |
| Theme | Legacy list/calendar receive broad theme styling, but calendar uses runtime inline platform colors and lacks an explicit audited workspace token contract. BW-30.1 declares full-width workspace layout support only. |
| Responsive | Full-width shell removes Inspector reservation outside Board. Legacy calendar remains one month grid; no day/week/mobile agenda adaptation exists. List is a grouped row list. |
| Accessibility | List rows are focusable `role=button`, support Enter/Space, and have focus labels; nested comment buttons risk composite-interaction complexity. Calendar posts are buttons, but day cells are generic `div`s with no grid/date labels, weekday header, announced month changes, or calendar keyboard model. Arrow month buttons have glyph-only accessible names. |
| Localization | Sidebar label, view names, status labels, Inspector controls, and some scheduling copy have German entries. List headings/empty text, dynamic metadata, calendar count/title and locale, previews, labels, and many actions are hard-coded or mixed. Calendar is always `de-DE`; event times are always `en-GB`, independent of UI language. |

### Relevant render flow

1. Board initialization/load normalizes a payload, assigns `state.nodes`, renders Canvas nodes, then calls `updateListView()` even when hidden.
2. Shared search/filter changes call `refreshNodeSearchUI()`, update Canvas cards, and refresh List if active/visible.
3. `setActiveView("list")` exposes `#board-list-view` and calls `updateListView()`; `setActiveView("calendar")` exposes `#calendar-view` and calls `renderCalendarView()`.
4. A List/Calendar item switches to `board`, selects the referenced ID, updates selection, fills Inspector, and reveals the node. This does not presently perform a fresh authorization/node-existence transaction beyond local lookup.
5. Node edits and scheduling explicitly rerender affected surfaces. There is no event-driven workspace projection boundary.

### Current actions adjacent to the objective

- **Copy/export:** social cards offer caption and full-post clipboard actions. Images can be downloaded. Board link can be copied. There is no structured asset export or workspace bulk export.
- **AI:** all nodes expose Improve, Generate Next Step (where mapped), Review, Regenerate, and propagation controls. Social has platform regeneration and posting-visual generation; Content has image/full-pack generation; Landing Page has header visual generation. AI Review persists review text on the node and suggested fixes require explicit apply; it is not editorial approval.
- **Scheduling:** “Add to Posting Calendar” opens a date/time modal only for Social Media Posting. Confirmation stores local wall-clock fields and a timezone-less datetime string; it does not change node `status` to Scheduled or contact a provider.
- **Comments/Post-its:** node `postits` contain identity, timestamps, resolution, and replies; signed-in editors can add/reply/resolve. They are discussion primitives, not revision-scoped review records.
- **Ownership/collaboration:** owner fields are `ownerEmail`, `ownerName`, and `ownerAvatar`; choices derive from owner/editors/presence. Ownership is assignment metadata, not authorization. Board `canEdit` gates mutation.

## 3. Asset-role matrix

All eight canonical roles come from `NODE_TYPES`. No additional Canvas node roles are registered. `Social Media Post` appears only as a legacy next-step alias, not a canonical `NODE_TYPES` role.

**Legend:** O operational; S strategic/planning; C supporting creative; P potentially publishable; N non-publishable. “AI” means generic node review/regeneration compatibility, not readiness approval.

| Canonical role | Class/default visibility | Title and primary content | Channel, funnel, owner, status, language | Schedule/media/CTA | Current AI/copy/regeneration | Readiness and future suitability (Workspace / Calendar / publish / metrics) |
|---|---|---|---|---|---|---|
| `Idea` | S/N; optional | `title`; `content` (quality checker also accepts description semantics) | `channel`; `funnelStage` and optional `strategy.funnelStage`; common owner/status; no per-node language, generated content follows campaign-language preference | No schedule; common `images`; CTA may only be inferred from text | Generic AI review, improve, regenerate, next step; no dedicated export | title + meaningful body. Optional / no / no / only as campaign provenance. |
| `Campaign Variation` | S/N; optional | `title`; `content`; common `variants[]` can coexist but represents loose A/B strings | Common channel/funnel/owner/status/language behavior | No schedule; common images; no structured CTA | Generic AI; regeneration overwrites current fields | title + meaningful body + distinguishable angle. Optional / no / no / provenance only. It is a **strategy angle**, not a revision-safe content variant. |
| `Content` | O/P candidate; default | `title`; `content`; `imagePrompt`; `contentFormat` | Common channel/funnel/owner/status/language behavior | No schedule; `images[]`, `favoriteImageId`; CTA only in free text | AI review/improve/regenerate; image and full content pack; full pack creates/updates related social; no dedicated copy button on base card | title + meaningful content; media conditional on intended format. Yes / optional-filter only until date exists / not directly V1 / map through downstream publication. |
| `Social Media Posting` | O/P; default | `title`; `content`; `social.caption`, `social.hashtags`, `social.preview` | `social.platform` plus common `channel`; common funnel/owner/status/language behavior | `social.scheduledDate` (`YYYY-MM-DD`), `scheduledTime` (`HH:mm`), `scheduledAt` (local ISO-like string), `addedToCalendar`; common images; CTA is `social.preview`/text, not dedicated semantic field | AI review/improve/regenerate and regenerate-for-platform; posting visual; copy caption/full post; schedule | platform + caption (and destination/media/alt text later); yes / yes / yes eventually / yes with revision and external identity. |
| `Landing Page` | O/P destination; default | `title`; `content`; `landingPage.{headerVisualPrompt,headerClaim,problem,solution,trust,cta}` | Common channel/funnel/owner/status/language behavior | No schedule; common images/header visual; structured CTA | Generic AI review/regeneration; header visual generation; no export/publish action | title + all five customer-facing structured sections (visual optional unless policy requires). Yes / no in V1 / deployable later, not social-publishable / yes when deployment identity exists. |
| `Email Campaign` | O/P candidate; default | `title`; `content` expected to include Subject, Preview text, body, CTA; no structured email fields | Common channel/funnel/owner/status/language behavior | No schedule; common images; CTA embedded in content | Generic AI review/regeneration; no email-specific copy/export/send | title + detectable subject/body/CTA; preview text recommended. Yes / later when send date exists / eventual email integration, not social connector / yes with send identity. |
| `Visual Concept` | C/N; optional | `title`; `content` | Common channel/funnel/owner/status/language behavior | No schedule; common images; no CTA | Generic AI review/regeneration; image download if attached | title + concept description. Optional / no / no / provenance only. |
| `Image Brief` | C/N; optional | `title`; `content` | Common channel/funnel/owner/status/language behavior | No schedule; common images; no CTA; no dedicated brief schema | Generic AI review/regeneration; image download if attached | title + actionable brief. Optional / no / no / provenance to resulting asset. |

**Default Content Library roles:** Content, Social Media Posting, Landing Page, Email Campaign. **Optional “Supporting & strategy” filter:** Idea, Campaign Variation, Visual Concept, Image Brief. A user may explicitly choose “All Canvas roles.” Calendar defaults only to Social Media Posting; future email/web dates require explicit typed scheduling contracts rather than recycling social fields.

## 4. Current status model

### Canonical node statuses

The single stored field is `node.status`. `normalizeNodeStatus()` accepts only exact, trimmed canonical values and silently projects everything else as `Draft`; it does not rewrite legacy input until a later mutation/serialization. Every canonical role may use every value because no role or transition validator exists.

| Stored value | English / German | Setter and Inspector | Canvas/List/filters | Persistence/autosave/access | Viewer visibility and operational truth |
|---|---|---|---|---|---|
| `Draft` | Draft / Entwurf | Default on create; Inspector select can set directly | Badge/list chip; status filter | Node form mutation, activity, local serialization and Board autosave; editor required | Visible to authorized/Public Viewer projections; editorial label only. |
| `In Review` | In Review / In Prüfung | Inspector direct select | Same | Same | Visible; no review request/reviewer/lock, so manually entered. |
| `Needs Changes` | Needs Changes / Änderungen nötig | Inspector direct select | Same; dashboard additionally recognizes legacy variants | Same | Visible; no required comment, so manually entered. |
| `Approved` | Approved / Freigegeben | Inspector direct select | Same; dashboard counts complete | Same | Visible; no approver/revision evidence, so manually entered and not trustworthy as revision approval. |
| `Published` | Published / Veröffentlicht | Inspector direct select | Same; dashboard counts complete | Same | Visible; no provider job/external ID, so manually entered—not proof of publication. |

### Other status-like values (not node editorial states)

- `Scheduled` is translated and displayed when `social.scheduledAt` is truthy, and the “scheduled” filter derives from that field, but it is **not** in `NODE_STATUSES` and is not stored in `node.status` by scheduling.
- Dashboard bucketing tolerates `review`, `in-review`, `in_review`, `done`, `completed`, and `complete`, plus needs-change variants. This compatibility is display inference, not canonical transition support.
- Campaign Creator “Campaign Ready/Canvas Ready/Quality Checked,” Brand strategy lifecycle (`empty`, `draft`, `generating`, `needs_review`, `saving`, `accepted`, `stale`, `error`), AI operation states, Board save/load states, and publication calendar flags are separate concerns and must stay separate.

### Readers and writers

- **Readers:** node card rendering, compact metadata, Inspector, List status chip/filter, dashboard campaign summary/focus, activity unread status, diagnostics/AI context, and Board serialization.
- **Writers:** create defaults; Inspector form; generated/imported node normalization; direct AI/regeneration content paths generally leave status untouched. No code validates a transition, role, readiness, reviewer, ownership, schedule, or external proof.
- **Activity:** Inspector status edits call status-change activity; persistence stores activity with the Board. Scheduling currently has no dedicated activity event.
- **Compatibility requirement:** never rename stored statuses in-place. A future lifecycle adapter must recognize exact canonical values and documented legacy aliases, preserve unknown raw values for migration telemetry, project safely, and only write a new canonical value after an explicit authorized transition. Existing `Needs Changes` should display as proposed “Changes Requested” without destructive migration if product copy changes.

## 5. Intended lifecycle

### Smallest useful V1 lifecycle

Phase 1 is read-only and introduces **no status transitions**. Phase 2 should retain the compatible editorial values: **Draft → In Review → Needs Changes ↔ In Review → Approved**, with **Approved → Draft** when content changes. “Ready for Review” is better represented by deterministic readiness plus a Request Review action, not another persisted status. “Changes Requested” is preferred UI copy mapped compatibly to stored `Needs Changes`. `Scheduled`, `Published`, and `Archived` must not be editorial statuses: they belong to publishing/retention domains.

| Transition | Who | Preconditions | Comment/AI/owner | Reversal/cancellation | Event and dirty state |
|---|---|---|---|---|---|
| Draft → In Review (Request review) | editor/author or Board owner | asset reviewable; fresh node/revision; explicit reviewer if supported | owner recommended, reviewer required once assignment exists; AI optional; comment optional | requester/owner may withdraw to Draft | `review_requested`; node mutation marks Board dirty and autosaves. |
| In Review → Approved | assigned reviewer or Board owner; avoid self-approval policy later | deterministic approval readiness; unchanged revision | human action required; AI never sufficient; owner not authorization | approver/owner can revoke to Draft with reason | `asset_approved` with actor, revision fingerprint, timestamp; dirty/autosave. |
| In Review → Needs Changes | reviewer/Board owner | fresh revision | reason/comment required; AI optional evidence | author resubmits to In Review | `changes_requested` linked to comment/revision; dirty/autosave. |
| Needs Changes → In Review | editor/author/owner | issues addressed; reviewable; new revision fingerprint | existing unresolved feedback shown; do not force AI | reviewer reassigned/retained | `review_resubmitted`; dirty/autosave. |
| Any editorial state → Draft | editor/owner, except enforce policy around another reviewer’s active decision | explicit confirmation from Approved/In Review | reason recommended for revoking approval | normal editing resumes | `review_withdrawn`/`approval_revoked`; dirty/autosave. |

Any change to approval-relevant fields after approval invalidates the approved revision and returns **editorial projection** to Draft (or shows “approval stale” until explicit confirmation); never silently retain approval. Schedule cancellation changes a future publication record/scheduling fields, not editorial approval. Published content cannot be “unpublished” by changing editorial status; external deletion is a delivery event.

### Five independent concerns

1. **Editorial status:** Draft, In Review, Needs Changes, Approved.
2. **Technical readiness:** Ready, Needs attention, Incomplete plus issue codes.
3. **Publishing status:** not prepared, prepared, scheduled/cancelled.
4. **External delivery:** queued, submitted, accepted, published, failed, deleted externally.
5. **Performance availability:** unavailable/pending/available/stale, with provenance classification.

## 6. Readiness model

### Existing evidence

- Campaign Creator validates its setup before generation and runs deterministic Campaign V3 quality diagnostics for missing/weak Idea, Variation, Content, Social, Landing, and Email fields, duplicate variants/captions, funnel structure, and generic fallbacks.
- AI Insights computes deterministic Board structure/funnel/platform/CTA/ICP/tone/trust diagnostics. These are Board diagnostics, not per-asset publication gates.
- Persona Journey consumes normalized Canvas assets and reports missing/usable assets for simulation; it does not certify editorial or provider readiness.
- AI Review is an optional generated critique and score stored/displayed with the node. Applying fixes is explicit. Scores are neither deterministic readiness nor human approval.
- There is no consolidated role readiness service, media/alt-text policy, platform length/format validator, timezone contract, destination/account check, or publish validation.

### Deterministic contract

Return `{level, issues[], capabilities}` from a pure projection over a node and context. **Incomplete** means a minimum usable required field is absent; **Needs attention** means minimum content exists but a warning or downstream requirement is unmet; **Ready** means all requirements for the selected capability are met. Readiness must be capability-specific (`review`, `approve`, `schedule`, `publish`), because editorial usability is not publishing readiness.

| Role | Minimum usable fields / codes and actionable explanation | Review / approve / schedule / eventual publish |
|---|---|---|
| Idea | `title`, body. `TITLE_MISSING`: “Add an Idea title.” `BODY_MISSING`: “Describe the campaign idea.” | yes when usable / yes as strategy if policy allows / no / no. |
| Campaign Variation | title, body, parent/context recommended. Codes above plus `VARIANT_ANGLE_DUPLICATE`: “Differentiate this angle from the other variation.” | yes / yes / no / no. |
| Content | title, meaningful content. `CONTENT_BODY_MISSING`; `MEDIA_MISSING` only when selected format/channel requires media; `IMAGE_ALT_MISSING` once media publishing is in scope. | yes / yes when required errors clear / no with current schema / downstream only. |
| Social Media Posting | platform and caption. `PLATFORM_MISSING`, `CAPTION_MISSING`; warning `CTA_MISSING`; conditional `MEDIA_MISSING`, `IMAGE_ALT_MISSING`, `PLATFORM_CONSTRAINT`; schedule codes `SCHEDULE_DATE_MISSING`, `SCHEDULE_TIME_MISSING`, `TIMEZONE_MISSING`; future `DESTINATION_MISSING`, `CONNECTION_MISSING`. | yes / yes before scheduling / yes only with valid instant/timezone + approval policy / yes only with destination, connection, media rules, approval, and publish contract. |
| Landing Page | title and `headerClaim`, `problem`, `solution`, `trust`, `cta` (content may supplement, not conceal missing structured fields). `LP_*_MISSING` per field; `LP_MEDIA_MISSING` warning if hero visual required. | yes / yes / no current date / eventual deployment integration, not social publishing. |
| Email Campaign | title and detectable subject/body/CTA; preview text warning. `EMAIL_SUBJECT_MISSING`, `EMAIL_BODY_MISSING`, `EMAIL_CTA_MISSING`, `EMAIL_PREVIEW_MISSING`. | yes / yes / no current date / eventual email provider only. |
| Visual Concept | title and concept body (`TITLE_MISSING`, `CONCEPT_BODY_MISSING`); image is optional evidence. | yes / optional internal approval / no / no. |
| Image Brief | title and actionable brief (`TITLE_MISSING`, `BRIEF_BODY_MISSING`); dimensions/alt text become warnings only for a specified destination. | yes / optional internal approval / no / no. |

Every issue includes field path, severity, capability affected, localized explanation, and safe actions **Show on Canvas** and, for authorized editors only, **Open Inspector**. Do not hide an issue behind a score. Computation failure must render “Readiness unavailable; no asset data changed,” never assume Ready or mutate status.

## 7. List and Calendar audit

### List

The List is a **partially operational legacy Canvas projection and separate active view**, not Content Workspace. Host: `#board-list-view`; content host: `#node-list-view`; renderer: `updateListView()`.

- Source: live `state.nodes`, filtered by shared Canvas search/filter state.
- Presentation: alphabetically named type sections; rows retain source order and show status chip, bounded title/preview, owner, up to six metadata chips, unread activity/status, and comment counts.
- Actions: row or keyboard activation focuses exact node on Canvas; comment button opens node discussion.
- Missing: explicit columns, selectable sort/group, campaign/readiness/date/language/media/AI-review columns, loading/error/stale states, saved views, and operational default-role filtering.
- Responsive/accessibility: naturally compressible rows but no declared density/mobile contract. Keyboard activation exists; nested controls and heading level (`h4` under page `h2`) need semantic cleanup.

### Calendar

The Calendar is a **partially operational separate legacy Canvas projection**. Host: `#calendar-view`; grid: `#calendar-grid`; renderer: `renderCalendarView()`.

- Scope: month only; Monday-aligned cells; previous/next month controls. No day/week modes, recurrence, platform grouping, drag/drop, overflow handling contract, unscheduled tray, or published distinction.
- Included assets: Social Media Posting where `addedToCalendar === true`, `scheduledDate` equals the day key, and `scheduledTime` is truthy. Header count instead checks `addedToCalendar && scheduledAt`, so malformed records can count but not render.
- Date storage: `social.scheduledDate` as local `YYYY-MM-DD`; `social.scheduledTime` as local `HH:mm`; `social.scheduledAt` as `${date}T${time}:00` without offset/zone; `addedToCalendar` Boolean. Other dates include image/comment/activity timestamps, Board metadata `createdAt`/`updatedAt`, generated `justConnectedAt`, and server `updated_at`; those are provenance/update dates, not scheduling fields.
- Timezone: browser-local parsing, no IANA zone or UTC instant. Modal reopening derives date via `toISOString()` but time via local getters, which can shift the date across offsets. Header uses fixed German locale; events fixed British time formatting.
- Mutation: modal confirmation directly changes the node, rerenders, and calls local save/autosave path. It does not set editorial status or log schedule history. There is no cancel/unschedule UI.
- Undated content: absent without explanation. Published content: no distinct source/appearance. Clicking an event opens Canvas and Inspector.

**Constraint:** no drag-and-drop before a canonical timezone model, guarded mutation API, conflict/stale handling, permissions, activity event, cancellation semantics, and autosave tests exist.

## 8. V1 information architecture

### Recommended smallest hierarchy

1. **Header:** “Content Workspace,” current Board/campaign context, last projection update/save state, and one primary “Open Canvas” action. No publishing button.
2. **Attention summary:** three concise links/counts—Incomplete, Needs attention, In review—computed from the same filtered model; not a repeated-pill dashboard.
3. **Content Library (default route):** operational assets, filters, sort, density, results count, and bounded rows/cards.
4. **Deferred tabs:** Review Queue (Phase 2), Calendar and Publishing Readiness (Phase 3). Do not render empty decorative tabs as operational features.

This answers what exists, campaign/channel, status/readiness, schedule, owner, attention, and next action. “Published” must say “manually marked Published” until external evidence exists. Overview can be the compact attention summary rather than a separate page. Saved views are deferred.

## 9. Content Library contract

- **Presentation:** responsive table/list on desktop for scanability; cards/stacked rows below tablet width. Keep one semantic item model, not separate behavior. Density toggle offers Comfortable (default) and Compact; preserve preference locally, not in Board content.
- **Fields:** bounded media thumbnail/fallback, title + two-line preview, role, platform/channel, funnel stage, Board/campaign, editorial status, readiness label + issue count, owner, schedule, last content update (only when reliable), AI Review indicator, unresolved comments, and one primary next action.
- **Primary action:** Incomplete → Open Inspector (editors) or Show on Canvas (read-only); In Review → Review (authorized Phase 2); otherwise Show on Canvas. Secondary actions live in an accessible menu.
- **Progressive disclosure:** never render full captions/content or every metadata pill. Two preview lines, one thumbnail, four essential metadata cells, and expandable details/issue popover. Missing values use meaningful “Not set,” not blank pills.
- **Filters:** Board/campaign (current-only in V1, selector future), asset type, channel/platform, funnel stage, editorial status, readiness, owner, content language (future because nodes lack it), scheduled/unscheduled, and inclusive date range. Disable/annotate unsupported filters rather than infer false data.
- **Stable sorting:** default `attention rank → scheduled instant (valid first) → normalized title → node ID`; options updated (only with trustworthy timestamp), scheduled date, title, role, status, readiness, owner. Use original Board index/node ID as final tie-breaker.
- **Grouping:** default none; optional role, platform, status, readiness, owner, or scheduled day. Sorting remains stable inside groups; collapsed-group UI state is non-authoritative preference.
- Filters must be combinable (AND across groups, OR within multiselect), URL/session-shareable only after privacy review, keyboard operable, removable individually, and have “Clear filters.”

## 10. Review and approval workflow

### Current primitives and gaps

Post-its provide comments/replies/resolution and activity events. Owner assignment and Board roles exist. AI Review supplies optional evidence and explicit suggested-fix application. Status is freely editable. Activity is bounded Board history, not an immutable audit log. There is no reviewer field, review request, approval identity, revision ID/fingerprint, stale-approval guard, or transaction-level conflict check.

### Safest additive V1 (Phase 2)

- Approval applies to a **specific node revision fingerprint**, not the mutable node in perpetuity, whole campaign, inferred Canvas edge, or schedule. A platform adaptation is its own Social node/revision. A later scheduled publication separately references the approved revision.
- Minimal persistence-compatible record can initially be bounded node metadata only after schema compatibility is proven: editorial state, reviewer identity, requested/decided timestamps, approved fingerprint, and linked feedback ID. Until then, keep the existing stored status adapter and activity event evidence together.
- Request review selects/records reviewer; approve/request changes re-fetch or compare current Board version and revision fingerprint immediately before mutation. If stale, block and offer Reload/Show latest—never overwrite.
- Changes Requested requires a human reason/comment. Resolve comment remains separate from resubmission. Editing approved content invalidates its approval. Return to Draft and revoke approval require confirmation when another user’s decision is affected.
- Board owner may request/reassign/approve/request changes/revoke. Editors/authors may edit, request/withdraw, comment, resolve their own workflow as policy allows; assigned reviewers may decide. Viewers, Brand Viewers, Public Viewers, and signed-out users receive no mutation controls. AI Review is optional evidence, visibly labeled AI, and never changes state.
- Use accessible confirmation dialogs for destructive/reversal actions, describe effect, require explicit button, restore focus, and announce success/failure. Append actor/revision-aware activity events and mark Board dirty once per accepted transition.

## 11. Variant management

- Campaign Variation nodes are strategy/angle variants generated between Idea and Content—not content revision entities.
- `node.variants[]` is a comma-separated loose string array and is hidden for Content in Inspector; it has no identity, selection, status, or provenance.
- Multiple Content/Social nodes can represent alternatives, but there is no canonical concept/group/parent field. Edges express campaign flow. They may suggest lineage but cannot safely prove “variant of”: users can freely reconnect edges, edge types are inconsistently represented, and one node may have multiple neighbors.
- Generic regeneration and platform regeneration **overwrite** current node fields. Suggested AI fixes preview before apply but still overwrite on apply. Full pack may create a social child yet can update it.

**V1:** display each node independently, expose Canvas connections as context only, label Campaign Variation “campaign angle,” and do not offer compare/preferred controls. Never infer variant groups solely from edges. **Deferred:** immutable asset revision IDs; explicit concept/variant-group ID; parent revision; adaptation platform; preferred selection; author/time/generation provenance; side-by-side compare; fork rather than overwrite. Preserve alternatives by creating a revision/fork, with confirmation before destructive regeneration.

## 12. Publishing preparation

### Current publishing-related inventory

- Platform values exist in `social.platform` (Inspector: Instagram, TikTok, YouTube, X, LinkedIn) and generic `channel` (also `X / Twitter`, Email, web channels). Filter values use yet another `X / Twitter` spelling. No Facebook option appears in current social Inspector.
- Caption, hashtags, CTA-like `social.preview`, common images, copy-caption/full-post, posting visual generation, and schedule fields exist.
- `Published` is a manual editorial status option. No connection, account/destination, alt text, timezone, provider job, external URL/ID, retry, delivery receipt, or metrics identity was found.

### Platform-neutral readiness

A future publishable Social revision requires: supported canonical platform; active Social Connection; selected Social Account/Publishing Destination; non-empty content/caption; media and alt text when required by content/platform policy; approved revision; valid local date/time plus IANA timezone and derived UTC instant; provider capability/constraint validation; idempotency key; and explicit external state. Hashtags and CTA may be recommended rather than universal hard requirements.

Keep these labels separate:

1. **Prepared in Funklix:** deterministic fields complete; no provider claim.
2. **Scheduled in Funklix:** approved revision + valid intended instant; still no provider claim.
3. **Submitted to provider:** request sent with job identity.
4. **Accepted by platform:** provider acknowledgement/remote identity where available.
5. **Published:** verified provider state/time/external post.
6. **Failed:** job-level error with safe retry/idempotency.
7. **Deleted externally:** previously known post no longer present; do not erase provenance.

BW-31 implements none of these APIs.

## 13. Social Connector preparation

Minimum future concepts:

- **Social Connection:** authorization grant/provider, owning Funklix account/workspace, scopes, health/expiry; managed only in Settings.
- **Social Account:** provider account discovered through a connection.
- **Publishing Destination:** concrete profile/page/channel selectable for a compatible asset in Content Workspace.
- **Publish Job:** immutable attempt/idempotency, revision payload reference, intended time/zone, state, errors, provider receipts.
- **External Post:** durable provider identity/URL, destination, published/deleted timestamps, latest known state.
- **Metric Snapshot:** external-post/account metrics for a defined reporting interval, fetched-at time, source, and classification.

LinkedIn, Instagram, Facebook, X, and future platforms must map behind canonical platform capabilities; UI copy must not assume identical media, scheduling, alt-text, or API behavior. Settings owns connect/revoke/health; Content Workspace owns destination/preflight/submit; Calendar owns temporal projection; Insights owns measured results.

## 14. Measured-performance mapping

Required provenance chain: Funklix account/workspace → Board ID → campaign identity (until explicit campaign entities, Board plus campaign-root/context) → Canvas node ID → immutable asset revision/fingerprint → canonical platform → destination/account → publish job attempt → external post ID → metric snapshot/reporting interval.

Node IDs such as `node-7` are only Board-local counters, can recur across Boards, and content is mutable. They are insufficient alone for idempotency, historical attribution, deleted-node retention, or identifying which approved text/media was published. Store immutable foreign references and a bounded content/revision fingerprint in external records; retain tombstone provenance if a node/Board is later deleted subject to privacy/retention policy.

Every displayed datum keeps the established classification: **measured** (provider observation), **deterministic diagnostic** (repeatable Canvas calculation), **inferred** (disclosed derivation), **simulated** (scenario), **user entered**, or **unavailable**. A manual `Published` status is user entered, never measured. Absence of metrics is unavailable, never zero.

## 15. Permissions

| Actor/context | View projection | Show on Canvas | Open Inspector/edit | Review mutations | Schedule/publish |
|---|---|---|---|---|---|
| Board owner | yes | yes | yes | all, subject to stale/readiness rules | later, if connection/destination rights also pass |
| Board editor | yes | yes | yes | request/withdraw/comment; approve/request changes only when assigned/policy permits | schedule later; publish only with explicit connector permission |
| Board viewer | yes if Board access grants | yes read-only | Inspector may be read-only on Canvas, but no edit CTA | none | none |
| Brand Viewer | only if separately authorized to this Board; Brand access must not imply Board access | same | none unless Board editor independently | none | none |
| Public Viewer | yes only through valid public token and sanitization policy | public Canvas only | no mutation Inspector/control | none | none; do not reveal account/destination internals |
| Signed-out | only valid public Board/local explicitly permitted path | according to same source | no server mutation; do not imply ownership | none | none |

On account/Board switch, increment lifecycle/generation, cancel async work, clear projection/reviewer/destination state, and rebuild only from the newly authorized Board. On revocation, immediately hide mutation controls and discard pending actions. Every Show on Canvas/Open Inspector action must revalidate current account/token, Board ID, `canView`, node existence, and generation; deleted/stale targets show a recovery state. Unsaved Canvas is projected from live `state.nodes` and labeled “Includes unsaved Canvas changes.” Autosave-in-progress is informational and must not block read-only navigation; mutations must use conflict guards.

## 16. Persistence and mutation boundaries

### Current paths

- Node fields are mutated in memory by Inspector/contenteditable, owner/status controls, AI fixes/regeneration, media, comments, and scheduling.
- `serializeState()` sanitizes nodes and stores them with edges, counters, activity, schema version, and metadata.
- `saveCampaignCanvasState()` writes localStorage and refreshes intelligence. `markUnsaved()` sets dirty state and schedules server autosave. Several older action paths call local save directly, so mutation behavior is not yet uniformly centralized.
- `saveBoardToServer()` guards loading/hydration, overlapping saves, `canEdit`, optimistic conflicts, and persists `canvas_json` plus Brand snapshot. Manual save and autosave share it.
- Activity is bounded inside Board state. Comments/Post-its, owners, status, and social schedule all live inside node/Board persistence.

### Canonical future path

Introduce one narrow command boundary, conceptually `mutateCanvasNode({boardId,nodeId,expectedBoardVersion,expectedRevision,actor,command,payload})`, that:

1. revalidates Board lifecycle/access and node;
2. validates role/capability/transition;
3. snapshots history once;
4. applies mutation to authoritative `state.nodes` only;
5. appends one typed activity event;
6. rerenders projections from state;
7. marks dirty once and uses existing autosave/manual save/conflict handling.

No workspace cache may become a writable source. Derived rows/readiness can be memoized only by Board generation + node revision and discarded on any authoritative change. A separate asset model is not justified for Phase 1; separate external operational records become justified when provider jobs must outlive mutable/deleted Canvas content.

## 17. Responsive and theme behavior

- Use BW-30.1 `content_workspace: full`: no Inspector support, visibility, inert exception, grid column, or reserved width. Canvas opening may then show Inspector only after selecting the current node.
- Large desktop: full table, sticky header/filter bar, bounded content width only where useful; normal desktop: compress optional columns into details menu; tablet: stacked rows/cards and horizontally non-scrolling primary controls; mobile: single column, filter sheet, one primary action, optional metadata disclosure.
- Expanded/collapsed navigation changes available width without overlapping content. Test both.
- Light/Dark use semantic design tokens; no hard-coded white text/surfaces or inline platform colors without contrast-safe token pairs. Status/readiness never depend on color.
- English/German layouts allow at least 30–50% expansion. Long titles/platform names wrap or truncate with accessible full text; never expand rows without bound.
- Missing images use a role icon/neutral placeholder with text. Many filters collapse into summarized chips and a sheet; many assets use pagination/windowing only if semantics/focus remain stable.
- Calendar on tablet/mobile becomes an agenda by selected day/month; do not squeeze seven interactive columns below usable control sizes.

## 18. Accessibility

- One page `h1`, then `h2` regions (summary/library), `h3` groups; do not skip to current List `h4`.
- Use a real table with caption/headers for desktop tabular data, or semantic list/articles for cards—not clickable `li role=button` containing nested buttons. Provide explicit links/buttons.
- Logical focus: header → summary → filters → results/sort/density → assets/actions. Preserve focus by node ID after rerender; return focus after menus/dialogs and Canvas round trips.
- Filters use named fieldsets/comboboxes, visible labels, counts, `aria-pressed`/selected state, Clear controls, and live but non-noisy result announcements.
- Status/readiness include visible text and screen-reader descriptions; icons/media have meaningful labels or are decorative. Announce exact missing requirements.
- Menus implement button/menu semantics and Escape/outside close. Dialogs have label/description, initial focus, trap, explicit cancel/confirm, Escape behavior, and restored trigger focus.
- Calendar uses a labeled grid only if implementing the WAI-ARIA keyboard pattern; otherwise prefer an accessible dated list. Provide weekday/date labels, current date, event count, and announced month. Arrow controls require localized names.
- Honor reduced motion for pulses/transitions/scroll; never require animation to find a node. Target size at least 44×44 CSS px on touch layouts.
- Confirmations state consequence and do not rely on color. Errors focus/associate with controls. Media thumbnails expose asset title/alt status, not generic repeated “Image.”

## 19. UX states

| State | Message and next action |
|---|---|
| Loading | “Loading content from [Board]…” skeleton with no stale actions; Cancel/back if prolonged. |
| Empty Board | “This Board has no Canvas nodes.” Owner/editor: Add on Canvas; reader: return to Boards. |
| No operational assets | “Strategy exists, but no operational content yet.” Show supporting assets filter; editor may Open Canvas. |
| No filter results | State active criteria; Clear filters. Never conflate with empty Board. |
| Readiness failure | “Readiness could not be calculated; content is unchanged.” Retry and Show on Canvas; no Ready fallback. |
| Stale data | “This Board changed.” Reload projection; block pending mutations. Preserve non-authoritative filter preferences. |
| Access denied/revoked | Explain access is unavailable; return to Boards/sign in. Remove all Board data/actions from view. |
| Deleted asset | “This asset no longer exists.” Return to library/reload; never navigate by stale ID. |
| Missing media | Placeholder plus exact requirement and Open Inspector for editors; readers get Show on Canvas. |
| Unsaved/autosaving | “Includes unsaved Canvas changes” / “Saving…”; projection remains readable. Conflicts demand reload/reconcile. |
| Future offline/network | Separate local preparation from provider availability; retain draft, do not claim scheduled/submitted. Retry when online. |
| Publishing failure | Show platform/destination, failed stage, safe error, attempt/time, Retry if idempotent; content remains approved. |
| Partial platform success | Per-destination outcomes; never collapse into global Published. Retry only failed destinations. |

## 20. Architecture alternatives

| Alternative | Consistency/migration/autosave | Publishing/analytics/revisions | Complexity and finding |
|---|---|---|---|
| 1. Live Canvas-node projection | Strong single source; no migration; naturally includes unsaved state and existing save lifecycle | Weak alone for immutable delivery/revisions/metrics | Lowest Phase 1 complexity; **best V1**. |
| 2. Separate persisted Content Asset entities | Drift and dual-write risk; migration/backfill; bypasses Board autosave semantics | Strong independent lifecycle if comprehensively designed | Highest premature complexity; reject for V1. |
| 3. Hybrid projection + external publication records | Canvas remains consistent; external records have explicit transactional boundary | Strong jobs/external identity/metrics and historical revision linkage | Moderate staged complexity; **roadmap target** after read-only/review foundations. |
| 4. Reuse legacy List/Calendar unchanged | Same source but mixed strategic scope, incomplete fields, weak states | Timezone-less calendar/manual Published cannot support providers or metrics | Low initial work but unsafe product semantics; use code knowledge, not unchanged UX/model. |

## 21. Recommended architecture

Adopt **Alternative 1 for Phases 1–3 projections**, evolving to **Alternative 3 for provider delivery and metrics**. Repository evidence confirms that Board `canvas_json` already owns nodes, comments, owners, statuses, scheduling flags, and activity; List/Calendar already prove live projection is feasible. It also proves nodes lack globally unique revision/provider identities, so forcing external delivery into mutable nodes would be unsafe.

Phase 1 dedicated module should receive an immutable/read-only snapshot and callbacks (`onShowCanvas`, authorized `onOpenInspector`), calculate deterministic presentation, and emit no DOM events that mutate nodes. App integration controls Board lifecycle and shell. Later command callbacks return to the single mutation boundary; external services store only publication/measurement facts and references.

## 22. Implementation phases

1. **Phase 1 — Read-only daily operations:** authoritative host/nav/view; default operational roles; library; pure readiness; filters/stable sort/group; status/readiness/media/comment/AI indicators; Show on Canvas/Open Inspector; complete states, responsive full-width shell, a11y/localization. No node writes, calendar changes, status transitions, schema, package/provider/API changes. Independently pass mutation-sentinel and BW-26–30.1 regressions.
2. **Phase 2 — Human review:** revision fingerprint contract; guarded Request Review/Approve/Request Changes/Return Draft; reviewer and stale protection; typed activity; Review Queue. No scheduling/provider. Test transition matrix, roles, conflicts, autosave exactly once.
3. **Phase 3 — Operational Calendar/preparation:** canonical zoned schedule (wall time + IANA zone + UTC instant), unscheduled tray, cancellation, publishing preflight, agenda/month projection. No drag/drop until command semantics pass; no provider submission. Migration adapter reads current social dates without silently shifting them.
4. **Phase 4 — Social Connections/delivery:** Settings connection management; destination selection; publish jobs/idempotency; external post identities; per-destination outcomes for LinkedIn/Instagram/Facebook/X. Provider records are separate and access-controlled.
5. **Phase 5 — Measured performance:** scheduled sync, metric snapshots/reporting windows, provenance/classification, deletion/retention, Insights mapping. Never mix diagnostics/simulations with measured provider data.

Each phase has its own feature boundary and can ship/roll back without enabling the next.

## 23. Blast-radius table

| Risk / affected system | Failure mode | Safeguard | Required regression |
|---|---|---|---|
| Canvas rendering/geometry | projection mutates/reorders nodes or opening target changes layout | read-only selectors; ID callbacks; no geometry writes | snapshot nodes/edges/positions before/after render/navigation |
| Node schema/Board loading | defaults strip unknown fields or new fields break old Boards | existing sanitizer compatibility; additive versioned adapters | old/new/unknown-field fixtures and round trip |
| Inspector/App Shell | workspace leaves Inspector visible/reserved | BW-30.1 view contract; Inspector supported only on Board | all breakpoints, open/closed selection, view switches |
| Autosave/manual save | rendering marks dirty; command double-saves | mutation sentinel; one command path | zero saves Phase 1; one dirty/autosave per Phase 2 command |
| Statuses | legacy values collapse to Draft or manual Published appears verified | compatibility adapter; provenance labels | canonical + aliases + unknown values; no silent rewrite |
| Ownership/permissions | owner mistaken for authorization; reader sees controls | central `boardAccess` capability checks at render and execution | owner/editor/viewer/public/signed-out matrices |
| Comments | unread/resolve state lost or review comment ambiguous | project node Post-its; explicit linked feedback later | counts, unread, reply/resolve, identity, no mutation read-only |
| AI Review | score auto-approves/readies; apply overwrites stale node | evidence-only; revision guard; explicit apply | low/high/missing/error review never changes status/readiness |
| Campaign Creator | workspace assumptions alter generated schema/roles | no generation changes Phase 1 | V3 generation/quality compatibility fixtures |
| Social actions | schedule/regeneration bypass permissions or overwrite alternatives | retain guards; later canonical commands/fork UX | copy/regenerate/media/schedule read-only and stale cases |
| Calendar | date shifts, count/render mismatch, Published conflation | zoned contract/migration preview; explicit state domains | DST, offset, locale, malformed/undated/cancelled/published |
| Activity history | missing/duplicate/wrong actor events | typed event once per accepted command | event type, actor, revision, persistence, bounded rendering |
| Public Viewer | leaks owners/comments/destinations or allows mutation | server/public sanitization policy; remove controls, execution guards | token valid/expired/revoked, direct-handler attempts |
| AI Insights | projection changes diagnostics or labels measured data | reuse state without mutation; preserve classifications | deterministic snapshot before/after workspace |
| Funnel/Persona simulators | operational filtering removes context from their source | filters are view-only; simulators retain full Canvas | BW-29 suites and all-role context |
| Localization | hard-coded English/German or locale mismatch | all dynamic keys/Intl locale from preference | complete EN/DE UI and date snapshots |
| Theme/mobile | unreadable tokens, overflow, tiny controls | semantic tokens; responsive card/agenda; 44px controls | light/dark × desktop/tablet/mobile visual/runtime checks |

## 24. Regression specification

Future checks must be runtime-capable, boot the actual browser scripts, fail on uncaught errors/unhandled rejections, and include:

1. Fixtures for all eight roles plus legacy `Social Media Post` input; default operational versus optional strategy/creative filtering.
2. Stable sorting tie-breaks, every filter, combinations, clear, grouping, density, and long/missing values.
3. Role readiness at Ready/Needs attention/Incomplete boundaries; exact localized missing-field codes/explanations; calculation failure; AI scores never affect results.
4. Show on Canvas/Open Inspector exact-node navigation, stale/deleted ID, Board/account switch, access revalidation, focus restoration, reduced motion.
5. Assert workspace full width and `inspectorSupported=false`, hidden/inert Inspector, no reserved grid width at desktop/tablet/mobile and expanded/collapsed navigation.
6. Canonical/legacy/unknown statuses; valid/invalid transition matrix; revision stale protection; editorial versus schedule/provider state.
7. Board owner/editor/viewer/Brand Viewer/Public Viewer/signed-out; control absence and direct callback denial.
8. Deep equality of nodes/edges/serialized Board and dirty/save counters before/after Phase 1 render/filter/sort; no duplicate content copy and no mutation during rendering.
9. Unsaved Canvas reflected and labeled; autosave in progress, success, conflict, hydration, revocation, stale Board, and one-save-per-command.
10. Review request/reassign/approve/request changes/comment/resolve/resubmit/revoke; required reason, explicit human action, AI optional, activity correctness.
11. Calendar legacy dates, canonical zone/UTC instant, DST gap/fold, month boundary, undated/malformed/cancelled/scheduled/published, no drag mutation, locale and mobile agenda.
12. Missing media, loading/empty/no-results/error/access/offline/failure/partial-success states and next actions.
13. Keyboard order, headings, table/list/calendar semantics, dialogs/menus, live regions, icon labels, contrast, target sizes, focus after rerender.
14. Light/Dark, English/German, long translations/titles/platforms, many filters/assets on large desktop, desktop, tablet, and mobile.
15. Compatibility with every relevant BW-26 through BW-30.1 suite and complete Runtime Boot Safety registration when implementation adds a browser module. Existing boot IDs must remain unique.

## 25. Expected files

Likely future implementation files (not changed by this audit):

- `index.html` — one authoritative host and identified navigation trigger; preserve every existing DOM ID.
- `content-workspace.js` (new, dedicated) — pure projection/readiness/render model and callback contract.
- `app.js` — narrow lifecycle/state/callback integration only.
- `styles.css` — token-based full-width responsive presentation in implementation phase.
- `language.js` — complete English/German dynamic UI keys.
- Focused runtime regression scripts under `scripts/`.
- `package.json` and Runtime Boot Safety registration only when the implementation’s new check/module requires them, never in this audit.
- Later phases may add narrowly scoped review/scheduling modules and server endpoints/entities for social connections, publish jobs, external posts, and metrics after separate design/security review.

## 26. Unchanged systems

Content Workspace V1 must not change AI provider endpoints, Persona Journey execution, Funnel Simulator, AI Insights formulas/classifications, Campaign Creator/generation schemas, authentication or authorization semantics, database schema, Board/public-sharing API, Canvas geometry/edges/node IDs, node role/status stored values, comments/ownership behavior, persistence/autosave conflict behavior, Brand Core, existing DOM IDs, or external platform integrations. Phase 1 must not write Canvas nodes at all.

## 27. Go/no-go criteria

| Required gate | Audit result / implementation gate |
|---|---|
| Authoritative host | **Absent today:** create exactly one new host; do not repurpose `#board-list-view` ambiguously. |
| Authoritative node source | **Identified:** current authorized Board `state.nodes` from `canvas_json`/live unsaved state. |
| Operational roles | **Identified:** Content, Social Media Posting, Landing Page, Email Campaign by default. |
| Status semantics | **Identified:** five manual editorial labels; Scheduled is derived; Published is unverified. Compatibility required. |
| Readiness | **Specified:** deterministic three-level, issue-code, capability-specific contract. Must be implemented pure and localized. |
| Mutation/autosave | **Identified:** mixed direct paths today; Phase 1 read-only; later one guarded command path required. |
| List/Calendar | **Identified:** separate partial legacy projections; Calendar timezone contract is insufficient. |
| Permissions | **Specified:** Board access authoritative; read-only controls absent; action-time revalidation required. |
| V1 IA | **Specified:** header + compact attention summary + Content Library; later routes deferred. |
| Smallest safe phase | **Specified:** read-only projection/navigation only. |
| Runtime regressions | **Specified:** role, readiness, mutation sentinel, permissions, shell, locale/theme/responsive/a11y, BW compatibility/boot safety. |

Implementation remains **NO-GO** if the host/nav IDs and lifecycle are not made authoritative, if readiness depends on AI, if Phase 1 can mutate/dirty/save, if Public Viewer receives controls, or if Calendar/publishing is presented as real provider state. Review/scheduling phases remain NO-GO until revision, permission, timezone, conflict, and activity contracts pass.

## 28. Final recommendation

Proceed with a narrowly scoped Phase 1: introduce a real full-width Content Workspace host and dedicated read-only projection module over the live authorized Canvas nodes; default to operational roles; provide deterministic readiness, stable filtering/sorting, bounded previews, and safe node navigation. Reuse concepts from legacy List, but do not rename it into a workspace or treat the current Calendar as operational publishing infrastructure.

Then add revision-bound human approval through a single Board mutation path; only afterward normalize zoned scheduling. Add provider connections/jobs/external posts as separate records and measured metric snapshots last. This sequence preserves Canvas authority and autosave compatibility while creating immediate daily value without making false claims about approval, publication, or performance.

**AUDIT READY FOR REVIEW**
