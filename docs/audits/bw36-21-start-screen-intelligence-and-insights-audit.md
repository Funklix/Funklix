# BW-36.21 — Start Screen Intelligence & Insights audit

**Status:** documentation-only proposal for review; no product implementation or future feature approval.

**Repository and baseline:** `Funklix/Funklix`, merged `main` at `fd18e8966fc78a702d365c97ef350d3df6b9c771` (PR #779), inspected 2026-10-16. The local starting checkout was PR #778; the six changed files were read from GitHub at the baseline SHA. Their Git blobs, the complete tree (`83da93501f28299295bb4d3b5584a03ef2d7849d`) and signed commit were reconstructed and hash-verified before this document was authored. Source references below are pinned to that baseline.

**Method and limits:** static tracing of HTML, CSS, browser handlers, read/write routes, serializers, authorization helpers, persistence contracts and regression scripts. Existing product/audit documents are background, not evidence that a capability shipped. No production database inspection, SQL execution, paid inference, deployment or UI replacement. Runtime configuration, production schema health, production data volume, actual visual appearance and end-to-end browser behavior are not established by this audit. Proposed acceptance tests are release gates for future implementation, not claims that those future features passed.

## Executive summary

### Confirmed findings

1. Home is an existing dashboard embedded in a large vanilla-JavaScript application, not an independent page that can be replaced safely. Root boot, Board hydration, DOM references, view switching and autosave share `app.js`. Preserve the shell and lifecycle. [S1] [S2] [S3] [S4]
2. Current Daily Briefing, Continue Working, Brand Evolution, Suggested Opportunities and Today's Focus are mostly projections of the **current runtime Canvas/Brand snapshot**. Root startup deliberately does not restore the old local Canvas into Home. These cards do not constitute a workspace intelligence feed. [S5] [S6] [S7]
3. There are useful persisted sources already: an authorized workspace catalog; Board metadata and Canvas JSON; canonical Brand Core with revisions; node responsibilities and discussions; governed Brand Learnings with human review and event history. No new analytics store is needed to present these facts. [S8] [S9] [S10] [S11] [S12]
4. Workspace membership, Brand membership and Board access are distinct. The catalog intersects workspace membership with object access; Board viewers can be denied Brand Core; Learning reads require an active application identity and independent Brand access. Browser selections are never credentials. [S8] [S13] [S14] [S15]
5. Insights already has deterministic findings and source/freshness metadata. Its readiness/health numbers are formulas over Canvas fields, not measured campaign outcomes. Campaign quality checks and social diagnostics exist, but there is no general persisted workspace-wide readiness feed. [S16] [S17] [S18]
6. The Home Team Activity entries are hard-coded examples, not a bound event stream. Brand Evolution's “learning” text is a Brand Core signal preview, not the governed Learning library. Tasks opens node responsibility management, not a standalone task/deadline system. [S1] [S7] [S11]

### Recommendation

Use **existing authenticated reads and browser composition (option A)** for a selected-workspace, selected-Brand, current-Board MVP. Show authorized catalog orientation, saved Board continuation links, selected-Brand Learning review availability, and explicitly scoped current-Board diagnostics/responsibilities. Make source scope visible on every module. Do not silently hydrate a different Board to populate Home.

If full workspace-wide pending reviews or cross-Board tasks become a requirement, separately approve **one narrow authenticated aggregation endpoint (option B)** returning minimized summaries with completeness/pagination semantics. Do not fan out full Learning libraries and Canvas payloads across every Brand/Board. A persistent Insights service (option C) is unjustified for this MVP.

## 1. Current implementation inventory — findings

| Area | Existing implementation | Constraint to preserve |
| --- | --- | --- |
| Layout | `index.html` `#dashboard-view` contains `.mission-control`, hero, Continue Working, two-column Brand Evolution/opportunities, focus list and support grid. Direct `getElementById` references are cached in `el`; renderers query child IDs. [S1] [S5] | Retain parent and child IDs or migrate every reference and handler together in a later implementation. Do not delete apparently hidden Canvas/Inspector elements. |
| Views/navigation | `setActiveView` toggles Home, Board/list/calendar, Boards library, Brand Profile/Core, Content Workspace, Insights, Funnel Simulator and AI Brain; `setAppMode` and shell synchronization also participate. [S2] | Keep navigation through current adapters; changing a CSS class alone does not perform a Board load or shell transition. |
| Identity/access | Session user provides name/email/avatar; Board access comes from server capabilities. Hero resolves approved Brand avatar, saved Brand image and initial fallbacks; its URL helper accepts HTTP(S), image data and blob URLs. Actual image availability depends on the current Brand context. [S5] [S13] | Keep sign-in and view-only handling; selected identity/IDs must not manufacture access. |
| Workspace selection | Server catalog, validated/normalized in `workspace-catalog.js`; sidebar derives active context from active Board, Brand, selection, then a sole workspace. `selectSessionWorkspace` can clear Board route/identity and return Home. [S8] [S19] | Preserve context precedence, profile leave guard, catalog generation and identity checks. Do not leave old `state.nodes` visible under a new workspace heading. |
| Brand selection | `selectSessionBrand` accepts a visible Brand from the selected ready catalog and rejects switching while a Board is active. Brand Profile has its own draft/leave lifecycle. [S19] [S20] | Do not reassign a Board's Brand because a dashboard filter changes. Do not discard unsaved Profile drafts. |
| Board listings | `loadBoardsLibrary` calls `/api/boards` with all/Brand/unbranded scope; request generation/abort guards reject obsolete results. Display filtering intersects catalog Board IDs for a selected workspace; active Board is pinned, with manual order retained. [S9] [S21] | Existing list is not a global “recently opened” list. Preserve list scope, ordering and active Board behavior. |
| Recent activity | `canvas_json.activityFeed` is serialized with the Board; activity UI uses sanitization, bounded history and browser seen markers. Home's Team Activity does not read it. [S1] [S22] | No workspace-wide event log, authoritative user visits, or durable notification read receipts can be inferred. |
| Empty/onboarding | Home has no-selection/empty Canvas/absent Brand signals states; Live Campaigns is a static no-deployment placeholder. Workspace creation, Brand Profile setup and project creation are separate existing flows. [S1] [S3] [S20] | Reuse existing entry points and distinguish loading, denied, unavailable, no workspace, no Brand and no Board. |
| Responsive | Dashboard grids collapse and buttons stack; later responsive shell CSS overrides earlier rules. Sidebar/popover has its own responsive behavior. [S23] | Check cascade and actual viewport overflow; a new card must not widen Canvas/Inspector or hide selectors. |
| Light/Dark | `theme-bootstrap.js` reads `funklix.themePreference.v1` before paint; `theme.js` manages preference. `styles.css` uses `--fk-*` tokens, explicit dark dashboard surfaces and reduced-motion overrides. [S23] [S24] | Use existing theme preference/tokens; no dashboard-only theme store. |
| Accessibility | Sections have headings/labels; native action buttons exist. Focus cards are `article[role=button][tabindex=0]`; the dashboard listener is click delegation and no matching focus-card keyboard handler was found. [S1] [S6] [S25] | Proposed actionable cards should use real buttons/links, including Enter/Space semantics and visible focus. Verify existing issue before widening the pattern. |

### Lifecycle and DOM dependencies

`bootApp` loads the session, diagnoses required DOM, distinguishes `/boards/:id` from root, checks but does not restore the root local Canvas draft, initializes Brand state, then selects Board or Home. It installs autosave and refresh/presence machinery after initialization. [S3]

`loadBoardFromUrlIfPresent` increments `boardLoadGeneration`, marks load/hydration flags, clears autosave, resets Brand state, fetches the Board with existing read headers, rejects obsolete identity/generation results, honors the server serializer, applies Canvas state, then starts refresh/presence and post-hydration density work. `saveBoardToServer` blocks while loading/hydrating, during responsibility saves/campaign creation and for read-only access; it sends serialized state with optimistic `lastKnownUpdatedAt` handling. [S4] [S26]

**Preservation contract for future work:** Home rendering must not call `applyCampaignState`, `loadCampaignCanvasState`, `saveBrandBrainState`, campaign generation, responsibility writes or Board association writes merely to obtain summaries. Do not use live `state.nodes` as a scratch buffer for other Boards. Keep the Canvas `#canvas`, `#zoom-layer`, `#links`, Inspector, Brand editor and shell controls that boot and event binding expect. Keep request generation/abort protection, autosave update-only/no-Board guards, conflict handling and direct Board routes. `diagnoseDomDependencies` and existing browser regression coverage are migration gates. [S3] [S4] [S26]

## 2. Intelligence data-source matrix — findings

“Persisted” below means represented by existing storage/write contracts; it does not assert that a production row exists. “Runtime” may contain unsaved changes and must be labeled accordingly.

| Source | Exact data and access surface | Persistence/freshness | Honest dashboard use and gaps |
| --- | --- | --- | --- |
| Workspace catalog | `GET /api/workspaces`: workspace `id,name,role,revision,avatar_url,locale`; Brand `id,name,role,revision,logo_url,logo_revision`; Board `id,name,role,brand_id` with hidden unauthorized association. [S8] | DB-backed membership/object projection; browser lifecycle can be ready, refreshing or stale/error. No Board modified time in catalog. | Authorized orientation and object links. Counts must say “visible to you”; not organization totals. No catalog readiness/task/diagnostic fields. |
| Canonical Brand Profile | `GET /api/brands/:id`; `brands.brand_core`, `revision`, `created_at`, `updated_at`, logo metadata and `access`. [S10] [S20] | Persisted independent canonical object; optimistic revision writes. Client edit/generated drafts are not confirmed saved truth. | Read selected authorized Brand only; show saved revision and missing/setup sections. Collection API summaries do not include full Core. |
| Brand identity/strategy | `brand_core.brandDNA` archetypes/positioning/personality and `userApproved`; `personas`, `valueProposition`, `toneOfVoice`, `messagingPillars`, custom knowledge tiles including ICP/audience. [S20] [S27] | Nested Brand JSON, not separate normalized tables. Board `state.brandCore` may instead be a saved campaign snapshot plus local edits. | Keep canonical Brand and campaign snapshot separate; do not count arbitrary text as accepted strategy. |
| Accepted modules | `customTiles[].moduleData[namespace].accepted.{content,structuredFacts,acceptedAt,revisionId,provenanceRefs}` and `lifecycle.status`; draft metadata is separate. Dependency engine requires accepted metadata/status and module-specific required clusters; Founder Story has its own lifecycle. [S27] [S28] | Persists when owning Core/snapshot is saved; generated draft in memory is not acceptance. No universal age-based expiry or complete per-field revision clock. | Explain “missing accepted ICP facts” only when a supported evaluator establishes it; no invented completeness score. Generic Profile readiness and accepted module readiness are different models. |
| Boards/Campaign Canvas | `/api/boards` metadata: `id,name,updated_at,created_at,order_index,access_role`, authorized display projection. Detail: `canvas_json.nodes,edges,metadata,activityFeed`, owner fields, Brand snapshot/provenance subject to serializer. [S9] [S12] | Saved JSON plus server Board timestamp; live runtime may be dirty. Lists limited to 200 without a cursor. Catalog Board IDs establish workspace intersection. | “Last edited” from server `updated_at`; no personal `last_opened_at`. `withBoardSchemaDefaults` can synthesize missing Canvas metadata times and activity sanitization can synthesize timestamps; neither establishes historical author activity. List omits `workspace_id`; join by ID against catalog, not a guessed Brand relationship. Sorting the returned 200 cannot promise globally most recent. |
| Campaign strategy/status | Generated campaign is a connected validated node set saved into a Board; Idea/Variation/content nodes carry relevant fields. `campaign-creation.js` and `_campaign-creation.js` validate funnel structure and preserve Brand snapshot. [S29] | Persisted node content/structure; transient generation setup/results are not necessarily a separately readable strategy record. | Node status buckets and goal/audience/channel are available. No uniform Board-level campaign lifecycle/status field was found in these read contracts. A Board may contain multiple campaign structures. |
| Snapshot freshness | Board `brand_core_snapshot`, `brand_core_source_revision`, `brand_core_source_updated_at`, `brand_core_snapshot_copied_at`; comparison/refresh/restore flows and backup availability. [S12] [S30] | Saved campaign context intentionally diverges from canonical Brand. Null legacy provenance is unknown, not stale by definition. | “Canonical revision changed since snapshot” is a comparison fact, not proof of strategic inconsistency; navigate to existing human comparison, never refresh automatically. |
| Tasks/responsibilities | Node `ownerEmail,ownerName,ownerAvatar,status`; `campaign-responsibilities.js`; `_campaign-responsibilities.js` validates assignable people and revision-safe writes. [S11] | Persisted as Board node fields through Canvas save/responsibility operation. No separate task records, deadlines, task priority or standalone completion model found. | Current Board “Assigned to you”/incomplete node actions. Do not say “overdue” or invent urgent work. Node completion follows existing status mapping and is not a due date. |
| Discussions/Post-its | `nodes[].postits[]`, `replies`, `resolved`, author fields/timestamps. `getOpenConversationCountForNode` deduplicates and excludes deleted/resolved/system/generated contributions while counting supported human replies. [S31] | Board JSON, plus unsaved runtime contributions and browser seen state. Not an independently paginated task/comment service. | “Open contributions” using existing helper semantics; do not relabel it as unique thread count or mandatory decisions. Board authorization bounds comments. |
| Governed Learnings | `/api/brands/:id/learnings?status=…&offset=…`: proposed/approved/rejected/archived rows, `statement,evidence_summary,revision,created_at,updated_at,reviewed_at`, proposer/reviewer, status counts, `can_write`, `has_more`, history, access-safe source context. [S15] [S32] | `brand_learnings` and `brand_learning_events`; reads under transaction/identity/Brand checks; 50 rows/page (+1 lookahead), latest 10 events per item. Missing status count keys should display as zero only after successful response. | Selected Brand pending review/approved availability. `approved` is human reviewed supplementary knowledge, not externally verified performance. Counts are broader than returned page; histories are bounded. |
| Learning governance | Proposal edit/approve/reject; approved edit creates proposed successor; approving successor archives predecessor; approved archive; expected revisions and duplicate checks. [S15] | Persisted lifecycle and event revisions. Learning changes are not a guaranteed bump to canonical Brand revision. | Re-read library on return from review. Never cache Learning freshness solely under `brands.revision`. No automatic adoption/approval from Home. |
| Approved Learning availability | AI Brain supplies only current approved same-Brand Learnings after independent Brand/identity authorization; relevance ranking is deterministic and token-budgeted with coverage disclosure. [S33] [S34] | Learning rows persisted, selection/ranking/answer ephemeral; request checks context before dispatch and after inference. | Same Brand knowledge can inform different authorized campaigns. **No cross-Brand knowledge sharing** is established; cross-Brand dashboard aggregation is a separate visibility projection, not reuse permission. |
| AI Brain/Advisor | Advice route consumes saved Board snapshot, independently allowed canonical Brand, approved Learnings, bounded working Canvas/history; Advice requires Board edit. Advisor requires editable Brand, active identity, accepted workspace membership, matching authorized saved Board, explicit discussion scope. [S33] [S35] | Conversation/Advice and Advisor suggestions/receipts are transient; adoption persists proposed Learnings, human approval is separate. AI Brain also has explicit proposal/create flow separate from read-only Advice. | Offer contextual navigation without inference. No background analysis, automatic question submission or auto-save. Baseline R1 uses `store:false`; operational revalidation failures are bounded 503, confirmed changed context 409. |
| Deterministic Insights | `analyzeCampaign`, `buildInsightsFindings`, current Board `insightsDiagnosticSnapshot` with identity, Canvas fingerprint, `live_unsaved/loaded_saved`, `analyzedAt`; server `_ai-brain-diagnostics.js` has a separate versioned structural analysis. [S16] [S17] | Runtime derivation, not a persisted workspace feed. Two engines have different schemas/heuristics; do not treat as interchangeable. | Structural CTA, funnel, audience label and tone opportunities. Existing formulas are present, but must not become measured marketing KPIs. Zero nodes and missing applicable node type need honest unavailable states. |
| Generation quality/social diagnostics | `evaluateCampaignV3Quality`, strategic/social diagnostics and repair loop; Content Workspace `calculateReadiness`, approval fingerprints, publication status and Facebook engagement reads. [S18] [S36] | Generation results/reviews may occur in runtime/node fields; publication/engagement have provider-specific persistence/access/freshness contracts. No universal saved quality report timestamp/score in Board collection. | Link to current diagnostics; do not reconstruct quality from names/status counts. Social readiness is not distribution success. Facebook metrics are limited provider-specific evidence, not all-campaign performance. Exclude external metric fetching from MVP Home. |

## 3. Source-of-truth and access matrix — findings and safe scope

| Scope/object | Server authority | Safe visibility/action | Forbidden inference |
| --- | --- | --- | --- |
| Personal | Verified session; for workspace/Learnings, unique active application identity bound to canonical email. [S8] [S15] | Greeting; own assignments inside independently readable Board data. | Browser email, local preferences or a node assignment is not access. No persisted personal visit history exists here. |
| Workspace | Accepted membership + active workspace + separate object ACLs in catalog. [S8] | List only returned Brands/Boards. Workspace owner/admin rename rights do not imply Brand knowledge access. | Never enumerate all workspace Brand strategy/Learnings based on workspace role alone. |
| Canonical Brand | Owner or Brand member admin/editor/viewer. Owner/admin/editor can write canonical Brand; viewer can read. [S14] | Profile read, approved library and pending counts for authorized Brand. Use response capabilities for review CTA; viewers get view access, not approval controls. | A Board membership/token does not authorize canonical Brand/Learnings. Brand owner/admin member management rules differ from editor rights. |
| Board | `_board-access.js`: owner identity/email, Board editors/viewers, Brand roles; legacy unowned path has distinct behavior. Serializer hides Core for direct `viewer`/`public_viewer`. [S13] [S12] | Server-authorized detail/navigation; authenticated workspace dashboard requires catalog intersection. Advice needs `canEdit`. | A catalog's normalized `viewer` role does not distinguish Board viewer from Brand viewer; never derive Core capabilities from it. Public link access is not a dashboard account scope. |
| Governed Learning | `_brand-learnings.authorize`: verified session → active unique identity → Brand read/write predicate and membership/identity locks. Source Board/node visibility is revalidated independently. [S15] | Same-Brand authorized library; safe source link only if `source_context.available`. | No stale source labels/UUIDs from raw provenance, unauthorized Brand totals, or automatic cross-Brand reuse. |
| Collaboration | Existing Board read for stored Canvas comments/activity; Board edit for responsibility mutation, plus allowed assignee checks. [S11] [S31] | Show only accessible Board items; modification through existing controls. | No invented private-per-comment or assignee-only ACL. The current Board serializer returns Canvas JSON to Board viewers; a new summary must preserve current rules and minimize disclosure. |

**Recommended dashboard default:** workspace scope for orientation, with a selected-Brand section and a clearly named current-Board section. Personal is an optional filter on authorized responsibilities, not a separate data authority. Brand-specific facts must always show their Brand name; diagnostics/discussions must always show Board name. No anonymous/public dashboard aggregation.

**Cross-Brand aggregation currently supported:** `/api/workspaces` safely returns minimal multi-Brand catalogs across accepted workspaces. It does not return combined Learning counts/content, task inboxes or strategic diagnostics. Existing per-Brand APIs can support an explicit selected Brand, not an assertion that an entire workspace was analyzed. A future aggregate must intersect active workspace membership, each Brand's independent rights and each Board's rights, conceal unauthorized associations, and omit both content and counts for inaccessible sources. Treat failed/partial sources as unknown, never zero or “all clear.”

## 4. Product opportunities and feasibility — recommendations

Priorities indicate proposed delivery order, not invented urgency of a user's work. No module needs AI inference to render its basic state.

| Module / user value | Source, availability and authorization | Endpoint / inference | Reliability, UX complexity and risk | Priority |
| --- | --- | --- | --- | --- |
| Workspace Overview: orient within visible Brands/projects | Catalog already available; active identity/membership and object ACLs. | Existing `/api/workspaces`; no inference. | High-confidence visibility at read time; no activity freshness clock. Low UX complexity/risk if it remains catalog-only. Label counts as visible objects. | P1 |
| Continue Working: open saved work | Catalog Board IDs/names; optional join with Board collection `updated_at/access_role`; Board detail reauthorizes navigation. | Existing reads; no inference. | High for returned rows; incomplete 200-row list and manual ordering limit recency claims. Low complexity; medium lifecycle risk if preview code hydrates Boards. | P1 |
| Next Best Actions: explicit review/continue choices | Successful selected-Brand Learning `counts.proposed`, capability; current Board assignments and deterministic findings. | Existing reads/runtime; no inference. Workspace-wide feed would need B. | Facts reliable as of read; ordering must be explainable. Medium UX complexity/risk from mixing scopes, empty and unavailable. No automatic edits or synthetic priority score. | P1 bounded scope |
| Brand Intelligence: reviewed knowledge and setup gaps | Authorized selected Brand Core + Learning library. Acceptance-aware evaluators require canonical projection, not current Board state. | Existing selected reads; no inference. Summary-only Learning counts endpoint optional later. | Medium: coarse Profile readiness differs from accepted-module completeness. Medium UX/risk; explain unknown/legacy metadata and do not prescribe strategy from field presence. | P1 review counts; P2 module readiness |
| Campaign Insights: inspect concrete quality opportunities | Current Board Insights snapshot and supported findings. Cross-Board saved derivation not exposed in lists. | Existing runtime; no inference. B for wider summaries if justified. | Fingerprint guards are useful; existing heuristic wording can overstate observations. Medium UX/risk; route to full methodology, distinguish live unsaved context. | P1 current Board link/summary; P2 broader analysis |
| Team Collaboration: find assigned work and unresolved input | Current readable Board node owners/status, postits/replies, bounded activity feed. | Existing loaded Board; no inference. Cross-Board inbox needs minimized Board summaries via B. | No deadlines/notification service; unresolved contributions are not automatically decisions. Medium UX/risk due comment privacy and old runtime context. | P1 current Board responsibility entry; P2 activity/discussions |
| AI Brain Entry: ask with reliable context | Existing AI Brain Board context/capabilities; Advisor Brand/workspace/Board scope and opt-in discussions. | No inference on dashboard; existing explicit submit routes only. | Low navigation complexity; medium context/privacy risk. An unaffiliated Brand-only chat is not currently the Board Advice contract. Disable/explain without eligible Board. | P1 navigation; P2 scoped Advisor entry |

**Immediately buildable** means future UI work using existing contracts: catalog orientation, Board links, selected-Brand review availability, current-Board responsibility/Insights/AI entry points. It does not mean shipping this audit changes the UI. **Needs additional implementation/design**: acceptance-aware canonical evaluator adapter, saved cross-Board insight projections, workspace task/review aggregation, reliable pagination/completeness and narrower summary APIs. **Needs a new product/data contract**: overdue tasks, persistent personal recent visits, workspace notification receipts, live campaign lifecycle and all-channel performance analytics.

## 5. Deterministic-first actionable insight contract — proposal

Each proposed card carries source type, explicit workspace/Brand/Board scope, source ID handled internally, source revision/timestamp where actually available, saved-versus-live label, observation rule/method version, destination, capability, and unavailable/partial state. A local `fetched at` or `analyzed at` means client read/analysis time, not last author activity. Do not persist a new insight entity for MVP.

| Candidate | Supported predicate and label | Action / missing prerequisite |
| --- | --- | --- |
| Learnings await review | Successful selected-Brand library response with `counts.proposed > 0`; **Fact:** “N Learning proposals await review in [Brand].” | Open Brand Profile → Brand Learnings; viewer sees view action, writer can use existing review. Do not approve from dashboard. |
| Resume a campaign Board | Catalog-authorized Board ID; metadata optionally confirms saved `updated_at`. **Fact:** “Saved Board · Last edited …” | Existing `/boards/:id` navigation. Without metadata use “Open saved Board”; never claim “recently visited by you.” |
| Responsibility needs attention | Current authorized loaded Board, normalized node owner matches verified user, existing incomplete status predicate. **Deterministic observation:** “Assigned to you · Draft” or actual status. | Open responsibility manager or focus existing node. No due date means no “overdue”; unknown status is shown, not guessed complete. Assignment does not grant access. |
| Structural Canvas opportunity | Current fingerprint-valid snapshot and supported applicable rule, e.g. eligible node lacks CTA. **Deterministic diagnostic:** identify missing field and affected node. | Existing Insights → Show on Canvas. If no affected node, open Insights only. A missing Landing Page is not evidence that an existing Landing Page lacks proof; suppress inaccurate example wording when no such node exists. |
| Accepted strategy is incomplete | Canonical saved tile has accepted lifecycle/revision and supported evaluator reports missing required clusters. **Deterministic observation:** accepted facts are missing named inputs. | Open Profile/advanced module. Existing engine's `{state}` adapter cannot be pointed at arbitrary canonical JSON by mutating global state; add/test a read-only adapter in a separately approved implementation. Until then show general Profile setup state, not accepted completeness. |
| Canonical/snapshot revision differs | Authorized canonical revision and saved Board source revision are both known and differ. **Fact:** revision differs; **Interpretation:** alignment may merit review. | Existing comparison/refresh review. Human chooses whether to update. No automatic snapshot replacement; unknown provenance is “comparison unavailable.” |
| An approved Learning may inform campaign | Same-Brand authorized approved Learning + allowed Board context; existing Advice ranker can select supplementary context on explicit request. | P2 contextual AI Brain entry. No current persisted “Learning applied to campaign” or applicability relationship. A dashboard suggestion would need an independently tested read-only relevance projection, scope validation and honest heuristic label. Do not call existing Advice to generate dashboard cards. |

### Labels and human control

| Type | User-visible wording | Control |
| --- | --- | --- |
| Fact | “Saved”, “Approved by a person”, “Proposed”, “Last edited”, with source scope | Navigate to authoritative record; refresh/re-read after changes. Approval is not external verification. |
| Deterministic observation | “Canvas diagnostic” / “Setup check”; disclose rule and saved/live basis | Inspect evidence and affected fields. Never claim performance or guaranteed impact. |
| Strategic interpretation | “Consider reviewing…”; explicitly separate from detected differences | User decides whether variation is intentional; no inferred contradiction or urgency asserted as fact. |
| AI-generated recommendation | “AI suggestion”; source coverage/omissions and assumptions visible | Explicit opt-in request; review before adopting; existing create/proposal/adoption/approval steps remain distinct. |

Ordering proposal: user-selected continuation first; explicit pending review and own incomplete responsibilities next; structural opportunities after these. Within a category use actual supported metadata/stable ordering. This is editorial placement, not a new “best action” score or claim that work is urgent. No persistent dismissals/snoozes in MVP. Display activity dates only when the underlying saved event supplied a valid timestamp; do not promote sanitizer/default fallback times into historical facts.

## 6. Architecture options and performance assessment — recommendation

| Concern | A — existing reads + browser composition | B — narrow authenticated aggregate (future) | C — persistent Insights service |
| --- | --- | --- | --- |
| Data minimization | Catalog is small-field projection; Learning GET is heavier than a count, returning rows, provenance/history; avoid workspace fan-out. | Can return only Board/Brand summary, count, rule evidence and capability; never raw Core/Canvas/comments by default. | Adds copies of sensitive knowledge, invalidation and retention obligations. |
| Query cost/performance | Catalog performs membership + Brand + Board reads, without pagination. Board list caps 200; full Learning read has per-row history/source checks. Lazy-load only selected Brand once, not one request per visible Brand. | Set-based bounded page queries after authorization, plus permitted object/source checks; measure query plan and payload size with representative fixtures. No request to inference/provider. | Background processing, queues and indexes not justified by present navigation/observation needs. |
| Freshness/caching | Request identity + workspace/Brand + generation; abort/ignore obsolete responses. Existing workspace, Board list, Learning and Advice routes use private no-store; protect all new sensitive fetch/cache paths likewise. Reuse only within current authorized session. | Private no-store initially; include actual source revisions/as-of and per-section status. Any later cache key must include principal and authorization scope, with revocation strategy. | Must invalidate on every Board, membership, identity, Profile and Learning lifecycle mutation, including nested JSON changes. |
| Pagination/completeness | Catalog has no pagination; Board/Brand collections cap 200 without has-more; Learning library has offset/has-more. Do not present subset counts as global totals or globally newest Boards. | Define bounded cursor pages and explicit coverage/partial status. Do not introduce a product quota as a query limit. Explain skipped/unavailable sources. | Still needs all B semantics, plus reconciliation/rebuilds. |
| Permissions/security | Compose only server-authorized results; catalog ID intersection prevents workspace mixing but is not server authorization. Destination always rechecks. | Verified session → active identity → accepted workspace membership → individual Brand/Board ACL → minimized projection. Never trust requested scope alone or expose hidden IDs/counts. | Larger authorization and disclosure surface; stale derived rows can leak revoked information. |
| Concurrent changes | Invalidate on session/selection/catalog generation, Board reload, Profile save, Learning lifecycle and visibility transitions. Stale click rechecks target; clear sensitive cards on revoked access. Never use old current Board nodes after switch. | Consistent transactional snapshot where sections must agree; otherwise explicit independent as-of and unknown status. No long-lived read locks for dashboard fan-out. | Event ordering, duplicate delivery and eventual consistency must be designed. |
| Empty/error states | Independent module loading/empty/denied/unavailable; one Learning failure must not block Board navigation. No “no work” on network/schema failure. | Per-section availability; no hidden source count/detail in errors. | More recovery states and delayed materialization. |
| Compatibility/extensibility | Lowest scope/risk; small read-only view-model adapter can later accept B's summaries without changing Board boot. | Additive versioned endpoint only if breadth/cost requires it; retain existing navigation/write boundaries. | No current requirement warrants operations/migration burden. |

**Smallest maintainable choice:** A for Phase 1. Use existing catalog lifecycle rather than a parallel workspace store. Keep lightweight dashboard view models isolated from Canvas mutation. Fetch selected Brand detail/library on demand, deduplicate in-flight requests and cancel on scope change. No full Board fetch per card, no preview-induced Canvas hydration, no external engagement reads, automatic AI, new quotas or analytics persistence. Do not claim a latency target based on this static audit; collect payload/query timing evidence in a future test environment before approving broader aggregation.

## 7. Recommended UX architecture — proposal, not implementation

The page should answer “Where am I?”, “Where can I continue?” and “What can I review?” in that order. Keep existing workspace/Brand selectors, navigation and compact context bar as the persistent orientation layer.

```text
Existing navigation / Workspace selector / Brand selector
Home — [Workspace name]                    [existing create-project action]
Visible Brands with real logos/initials; concise welcome and scope explanation

Continue Working (primary, wide)     Needs Your Review (selected Brand)
Saved Board links + last edited      Pending Learning count + review entry
Current Board clearly identified    Setup/knowledge state, only if confirmed

Current Board: [Board name] — saved or live unsaved context
Assigned work / Tasks entry          Canvas Insights / inspect evidence

Contextual AI Brain entry (eligible current Board; explicit submission later)
Optional current-Board activity/discussion detail after data is real
```

Desktop proposal: generous content margin, restrained two-column editorial layout; Continue Working is the visual anchor, with review cards alongside. Avoid a KPI wall. Use Tendra One's existing `fk` typography/buttons/surfaces, strong title hierarchy, quiet supporting labels, approved identity art and authenticated real logos. Board cards can use a typographic preview from authorized metadata; a rendered campaign thumbnail would require a new safe preview source and is not in MVP. Initials and restrained color marks are useful fallbacks. Do not fetch generated assets simply to decorate Home.

Replace hard-coded Team Activity examples with a genuine scoped feed or remove that presentation in a later UI change. Retire the unconnected Live Campaigns placeholder from the proposed hierarchy until there is a defined campaign deployment/lifecycle source. A saved social post/publication is not a deployed whole campaign. Rename ambiguous “Brand learning” copy to its actual source or use real governed Learnings. [S1] [S7]

Mobile proposal: single column in the same reading order, short Board rows, full-width primary actions, disclosure for secondary evidence. Preserve reachable workspace/Brand selectors and prevent horizontal scrolling at 320/375px and zoomed text. Medium widths must not force sidebar/content collision. Reuse existing responsive breakpoints after checking later CSS overrides. [S23]

Light/Dark proposal: same hierarchy in both themes; use app surface/elevated/text/border/primary tokens, real image fallback, sufficient text/icon/focus contrast; no white image-card assumptions. Give AI entry a restrained existing accent plus text label, not an animation implying ongoing inference.

Accessibility proposal: one Home heading with section headings, semantic lists, native links for saved destinations and buttons for local actions, explicit Board/Brand names in accessible labels, status announced politely without noisy rerenders, stable focus on refresh and focus return from dialogs. Explain disabled/context-missing actions in text. Use subtle opacity/position transitions only after state is real; honor reduced motion for node focus, pulses and skeletons. Existing global CSS does not prove JS `behavior:'smooth'` is always disabled; explicitly test each new navigation path.

Empty states: no workspace → existing first workspace flow; no Brand → authorized Brand creation/Profile entry; no Board → existing project flow if permitted; selected Brand without proposals → “No proposals awaiting review”; unavailable library → retry and preserve other sections; no current Board → “Open a Board to see assignments and Canvas diagnostics.” Viewers receive relevant read actions. Never insert fake team avatars, successes, activity or charts to fill space.

## 8. MVP feature specification and incremental phases — recommendations

All phases below require subsequent implementation authorization. This audit approves none of them. Phase 1 deliberately does not promise complete workspace-wide intelligence.

| Phase 1 feature | Exact source and user behavior | Destination / permissions | Fallback | Acceptance criteria / likely files / dependencies |
| --- | --- | --- | --- | --- |
| F1 Workspace orientation | Validated `workspaceCatalog.value.workspaces` → selected workspace's visible Brand/Board summaries; show name, actual logo or initial, “visible to you.” | Existing selectors via `selectSessionWorkspace`/`selectSessionBrand`; object links via existing navigation. Catalog/membership/object ACL. | Loading/retry/no accessible workspace; no cached private details after session/authorization reset. | T1–T4/T7; `index.html`, `app.js`, `workspace-catalog.js`, `workspace-sidebar.js`, `styles.css`, `language.js`. Depends on existing catalog identity/schema contracts; no new backend. |
| F2 Continue Working links | Catalog-authorized Board rows. Optional selected-workspace intersection with `/api/boards` for `updated_at`; current Board pinned explicitly, returned saved rows may be sorted for presentation without changing library manual order. Label partial recency honestly. | `/boards/:id` through existing Board opening flow; preserve dirty/save lifecycle. Detail reauthorizes at open time. | Without collection metadata show catalog links, no dates; with no Boards show permitted existing New project action. | T1/T3/T5/T6/T10; `app.js` Board library adapters and new read-only dashboard model, `index.html`, CSS/i18n. Depends on F1 and preserved Board load/autosave boundary; no backend. |
| F3 Selected-Brand Learning review | Explicit selected independently readable Brand → existing GET library; successful counts and `can_write`; label proposals and approved knowledge separately. No raw statements needed on Home. | Open existing Brand Profile section “Brand Learnings” via current Profile/mount adapters; review actions remain library-owned. Brand/active identity boundary; viewer view-only. | Schema/network failure is “unavailable,” not 0; no Brand → choose Brand. No current canonical authorization → hide library content/counts. | T4/T7/T8; `app.js`, `brand-learnings.js` entry adapter if needed, `brand-profile-setup.js`, HTML/CSS/i18n. Depends on F1, existing Learning schema deployed/healthy and Profile entry; no migration/new endpoint required for one selected library. |
| F4 Current-Board responsibility entry | Already loaded authorized current Board's `nodes[].ownerEmail/status`; show actual incomplete assignments or a Tasks entry. Never read stale nodes for another workspace. | `openCampaignResponsibilities`; optional existing focus-node adapter after Board identity check. Writes remain existing capability/revision-checked manager. | No eligible loaded Board → open Board prompt; read-only Board → supported view-only manager behavior, no assign controls. | T3/T4/T5/T9/T10; `app.js`, `campaign-responsibilities.js`, HTML/CSS/i18n. Depends on F1/F2 and existing BW-36.15/15R1; no backend or due dates. |
| F5 Current-Board diagnostic summary | Fingerprint-valid `insightsDiagnosticSnapshot`, live-unsaved/saved label; small number of applicable evidence-backed findings, no health KPI. | `setActiveView('insights')`; use `showInsightsFindingOnCanvas` only for reliably affected existing nodes. Board read; AI handoff requires edit. | No Board/nodes/snapshot → inspect/open Board prompt; no valid applicable findings → bounded “No supported structural findings,” never “campaign is ready.” | T4/T5/T6/T7/T11; `app.js` Insights adapters, HTML/CSS/i18n. Depends on F2, existing BW-28 provenance and freshness contracts. No backend/AI. |
| F6 Contextual AI Brain entry | Current authorized Board identity and `boardAccess.canEdit`, no public token; show scope and navigate without submitting. | Existing AI Brain view. Future user submission uses unchanged Advice route and separately authorized approved Learning context. | No Board → choose/open Board; view-only → explain unavailability. | T4/T5/T12; `app.js`, `index.html`, CSS/i18n. Depends on F2, BW-26/BW-36.20 + R0/R1 protections. No new endpoint, quota or automatic inference. |

**Phase 1a:** F1/F2 and truthful empty states; remove placeholder event claims only as part of separately authorized UI work. **Phase 1b:** F3–F6 through existing read/navigation adapters with regression gates. These can ship independently without changing Canvas storage, Board schemas or existing write routes.

**Phase 2 optional:** acceptance-aware canonical module completeness; current-Board real activity and open contributions; explicit Advisor entry with scope/discussion consent; canonical/snapshot comparison entry; one minimized workspace aggregate if product requires all-Brand review/task summaries. Establish cursor/completeness contract before claiming full recency/inbox coverage. F1/F2 and independent authorization tests are prerequisites.

**Phase 3 requires a fresh decision:** personal visit history, notifications/read receipts, task deadlines, semantic cross-campaign strategy review, cross-Brand knowledge reuse or measured performance summaries. Each needs a defined source, retention/access policy, value and cost assessment. None is implicitly authorized; no persistent analytics infrastructure is recommended here.

## 9. Security/privacy risks and technical dependencies

| Risk | Evidence / consequence | Required mitigation for implementation |
| --- | --- | --- |
| Workspace-only authorization | Catalog intentionally intersects separate ACLs; Learning helper independently authorizes Brand. [S8] [S15] | Reuse server checks for all sensitive summaries, including counts; never trust selected IDs. |
| Old scope displayed after selection/session change | Home reads global state; workspace switching clears Board identity but does not prove all runtime node/diagnostic state has been cleared for every path. [S6] [S19] | Bind cards and callbacks to principal/workspace/Brand/Board/generation; clear or hide obsolete data immediately; ignore late responses and stale clicks. |
| Viewer/Core leak | Detail serializer excludes Brand data for Board/public viewers; catalog roles are normalized. [S12] | Preserve serializer capabilities and hidden association rules. Never enrich a viewer Board card from another cache. |
| Learning provenance leak | Source validation checks current Board/node/workspace relation rather than trusting historical labels. [S15] | Only use safe `source_context`; no raw source snapshots or hidden IDs in dashboard payload/errors/DOM. |
| Stale Learning knowledge | Approved edits create successors; archive/revocation may occur without canonical Brand revision changing. [S15] [S34] | Fetch library on review return; invalidate by lifecycle and authorization, not just Brand revision; no model/context-result reuse as a Learning cache. |
| Comment/context oversharing | Full Canvas and library APIs are larger than a dashboard summary; Advisor discussions have explicit scope. [S12] [S35] | MVP uses current authorized Board only; minimize displayed bodies, no background transmission to AI; preserve discussion opt-in/exclusions. |
| Misleading performance/urgency | Health/readiness is heuristic; task deadlines absent; examples are static. [S1] [S11] [S16] | Separate facts/rules/interpretations/AI; no fabricated metrics, urgency or activity. |
| Query/payload growth | Unpaginated catalog, capped Board/Brand lists and per-row Learning history/source queries. [S8] [S9] [S15] | Selected-source lazy composition; no N×Board hydration or all-library polling; measure before B. |

Technical prerequisites are existing authenticated sessions, valid active identity for workspace/Learnings, accepted workspace membership for catalog/Advisor, healthy deployed workspace/Brand/Board/Learning schemas, current read contracts and stable navigation adapters. This audit does not verify production migrations or require new credential/provider setup. Baseline PR #779's `store:false` and bounded 409/503 revalidation behavior must survive later AI entry changes. [S33] [S34]

## 10. Migration assessment

**Phase 1 needs no database changes, migrations, new persistent analytics data, quotas or paid inference.** Existing Board metadata, Brand Core JSON, Learnings and catalog suffice for the bounded proposal. Dashboard state can remain transient. Preserve existing browser keys and root local-draft guard; no mass browser-storage reset or reinterpretation of saved Canvas as a recent-workspace record.

Option B may be implemented as reads over existing tables/JSON if approved, with query-plan and ACL verification. New indexes are not assumed necessary from static inspection and require measured justification. New persistent visits, task deadlines, notification receipts or insight materialization would require separate schema/migration proposals and approval. No migrations or production SQL are included in this audit.

## 11. Concrete acceptance tests for future implementation

| ID | Scenario and expected assertion | Relevant existing coverage to retain/extend |
| --- | --- | --- |
| T1 Start Screen/root | Load `/` signed in/out with empty, valid, malformed and old local Canvas storage. Home loads; no Board is created/saved/restored from root merely to render cards; navigation and required DOM initialization succeed. | `bootApp`, root-startup assertions in runtime workflow; Board isolation and profile/browser suites. |
| T2 Catalog/onboarding | No identity/no membership/empty workspace, stale catalog, malformed relationship, API 503 and retry. Distinguish no data from unavailable; use existing creation flow only with capability; all visible totals match authorized scope. | `check-bw36-9-authorized-workspace-read-boundary.js`, `check-bw36-9r1-workspace-identity-resolution.js`, `check-bw36-13r3r1-workspace-catalog-repair.js`. |
| T3 Workspace/Brand switch | Delay requests for workspace A/Brand A, switch to B, then resolve A. No A content/counts/handlers appear in B. Profile leave guard works; active Board Brand cannot be reassigned by filter; rapid switches and no-active-selection work. | `check-bw36-10-workspace-selector-and-sidebar-hierarchy.js`, `check-bw36-13r5-brand-lifecycle-stability.js`, BW-4/BW-5 selection/isolation suites. |
| T4 Permission boundaries | Exercise workspace-only member, Brand owner/admin/editor/viewer, direct Board editor/viewer, unrelated/disabled/ambiguous identity, legacy unowned Board, anonymous/public token and revoked membership. Verify IDs, names, counts, Core, Learning/source metadata and comments follow their actual server boundary; destination rechecks. | BW-18/19/20, BW-36.9, BW-36.17 and BW-36.20/R0 suites; test response payload and DOM, not just hidden buttons. |
| T5 Board navigation | Open a saved Board from Home, including a Board outside an old list filter, deleted/revoked target and browser Back/reload/direct route. Correct identity, name, nodes/edges, snapshot, access and post-hydration density appear; no other Board state is overwritten. | `check-bw5-board-brand-isolation-regression.js`, `check-bw36-14-stable-campaign-creation.js`, `check-bw36-16-adaptive-canvas-view-hierarchy.js`. |
| T6 Canvas/autosave | Render/refresh Home while Board is dirty, saving, hydrating or in 409 conflict; navigate back. No dashboard-triggered writes/generation; existing guard, update-only autosave, save acknowledgment, responsibility hold and conflict behavior remain intact. | Board lifecycle scripts; `check-bw36-15r1-responsibility-workspace-continuity.js`; existing runtime boot workflow. |
| T7 Freshness/error isolation | Profile save, archive/proposal change, missing timestamps, source mismatch, obsolete diagnostics, 200-row metadata subset and one module failure. Show source-specific unavailable/partial state, no invented dates/global totals and no all-clear on failure. Catalog links remain usable if optional metadata/library fails. | BW-28 snapshot/runtime suites, BW-36.13 Profile suites, BW-36.17/18 lifecycle suites. |
| T8 Learning lifecycle | Proposed → approve/reject; edit approved → successor; approve successor → archive predecessor; direct archive; concurrent expected-revision conflict and unavailable source. Counts/read actions refresh; viewer cannot write; dashboard never automatically approves/adopts and does not rely on Brand revision alone. | `check-bw36-17-governed-brand-learnings.js`, `check-bw36-18-governed-learning-provenance.js`, `check-bw36-19r6-learning-review.js`. |
| T9 Tasks/discussions | Own/other/unassigned node, completed/unknown status, resolved/deleted/duplicate Post-it and human replies on AI Review. Only correct current Board shown; count matches helper semantics; no fabricated due dates/urgency. Unauthorized Board contributes neither item nor count. | `check-bw36-15-campaign-team-responsibilities.js`, BW-33.4B1R1/B3.1 comment suites. |
| T10 Browser storage | Switch accounts, logout/re-login, denied storage, old keys and root local draft. Private cards clear, no preference grants access, existing Board/Brand/theme/seen keys preserved, no autosave writes an old Board into a new workspace. | Existing BW-4/5, theme, session and lifecycle suites; add focused dashboard browser cases. |
| T11 Visual/a11y | Light/Dark/system, 320/375/768px and desktop, zoomed text, long names, no image, keyboard-only, screen reader labels, Enter/Space, dialog focus return and reduced motion. No overflow/collision, lost focus or animated implication of background AI; verify contrast on actual surfaces. | `check-bw27-7-responsive-shell-stability.js`, `check-bw28-3-1-insights-runtime-rendering.js`, BW-27 theme and Profile/Advisor visual suites. |
| T12 AI boundaries | Opening Home/AI entry makes zero provider calls. Explicit submission requires current Board edit and preserves Brain's independent canonical/Learning checks, omission disclosure, pre/post revalidation and `store:false`; no automatic retries or adoption. Use mocked transport only. | `check-bw36-20-approved-learning-ai-brain.js`, `check-bw36-20r0-ai-brain-board-authorization.js`, `check-bw36-20r1-learning-integration-review-fixes.js`, BW-26 and BW-36.19 suites. |

For the documentation-only PR, validate source links/line anchors, baseline hash, Markdown/diff whitespace, coverage of requested sections and that exactly this audit file changes. Runtime implementation tests are not required to validate prose changes. Keep existing `.github/workflows/runtime-boot-safety.yml` unchanged; its source/browser/database fixtures remain relevant regression evidence, not proof of live production health.

## 12. Open decisions requiring product/implementation approval

1. Accept the proposed scope: workspace orientation plus selected Brand/current Board intelligence, or require complete workspace-wide review/task aggregation? The latter triggers B and pagination/completeness design.
2. Define “Continue Working”: current Board + visible saved Boards ordered by actual last edit, versus personal recent visits. Personal visits require a new source. How should a truncated metadata list be described?
3. Should Brand viewers see pending proposals on Home as permitted by today's library, or should a future narrower product policy change that visibility? Do not change existing ACLs incidentally.
4. Approve exact setup rules: Profile section presence, accepted strategy readiness, or both with distinct labels. Which accepted modules are required for which workflow? Do not create one global Brand score.
5. Approve replacing placeholder Team Activity/Live Campaigns presentation and current heuristic wording. Decide whether actual current-Board activity is worth the extra module before cross-Board aggregation.
6. Decide whether contextual Advisor entry is a later user-triggered tool with explicit discussion scope. No background AI, cross-Brand reuse or automatic knowledge adoption is authorized.
7. Approve rollout order and release gates, including permission matrix, stale-context and accessibility/browser checks before changing the shared Home/Canvas DOM.

**Genuine capability blockers for broader proposals:** absent persisted personal visits, standalone tasks/deadlines and uniform campaign status; no existing complete cross-Board summary/pagination API; no universal saved quality/strategic inconsistency feed; no approved cross-Brand knowledge reuse policy. These do not block the bounded Phase 1 recommendation. Production data/schema health and visual behavior need future environment/browser verification. No product implementation blocker is being silently resolved in this audit.

## 13. Exact source reference register

All links use the inspected baseline, so later edits to `main` do not move the evidence. Each anchor is the entry point to the adjacent implementation described above.

- **S1** — [`index.html:490`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/index.html#L490): `<section id="dashboard-view"`.

[S1]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/index.html#L490

- **S2** — [`app.js:17928`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L17928): `function setActiveView(`.

[S2]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L17928

- **S3** — [`app.js:20221`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L20221): `async function bootApp(`.

[S3]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L20221

- **S4** — [`app.js:9351`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L9351): `async function loadBoardFromUrlIfPresent(`.

[S4]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L9351

- **S5** — [`app.js:6847`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L6847): `function getDashboardBoardStatus(`.

[S5]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L6847

- **S6** — [`app.js:7289`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L7289): `function getDashboardContinueWorkingModel(`.

[S6]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L7289

- **S7** — [`app.js:8706`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L8706): `function getDashboardBrandEvolutionModel(`.

[S7]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L8706

- **S8** — [`api/_workspace-catalog.js:88`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_workspace-catalog.js#L88): `async function loadWorkspaceCatalog(`.

[S8]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_workspace-catalog.js#L88

- **S9** — [`api/boards/index.js:59`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/boards/index.js#L59): `module.exports = async function handler(`.

[S9]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/boards/index.js#L59

- **S10** — [`api/_brands-storage.js:55`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_brands-storage.js#L55): `function serializeBrand(`.

[S10]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_brands-storage.js#L55

- **S11** — [`api/_campaign-responsibilities.js:28`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_campaign-responsibilities.js#L28): `async function saveResponsibilities(`.

[S11]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_campaign-responsibilities.js#L28

- **S12** — [`api/_board-serializer.js:1`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_board-serializer.js#L1): `function serializeBoardForAccess(`.

[S12]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_board-serializer.js#L1

- **S13** — [`api/_board-access.js:113`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_board-access.js#L113): `async function getBoardAccess(`.

[S13]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_board-access.js#L113

- **S14** — [`api/_brand-access.js:25`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_brand-access.js#L25): `function brandCapabilities(`.

[S14]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_brand-access.js#L25

- **S15** — [`api/_brand-learnings.js:123`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_brand-learnings.js#L123): `async function authorize(`.

[S15]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_brand-learnings.js#L123

- **S16** — [`app.js:5843`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L5843): `function analyzeCampaign(`.

[S16]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L5843

- **S17** — [`api/_ai-brain-diagnostics.js:5`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_ai-brain-diagnostics.js#L5): `function analyzeCanvas(`.

[S17]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_ai-brain-diagnostics.js#L5

- **S18** — [`app.js:12469`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L12469): `function evaluateCampaignV3StrategicDiagnostics(`.

[S18]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L12469

- **S19** — [`app.js:4923`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L4923): `async function selectSessionWorkspace(`.

[S19]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L4923

- **S20** — [`brand-profile-setup.js:10`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/brand-profile-setup.js#L10): `const SECTIONS =`.

[S20]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/brand-profile-setup.js#L10

- **S21** — [`app.js:19913`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L19913): `async function loadBoardsLibrary(`.

[S21]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L19913

- **S22** — [`app.js:1794`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L1794): `function sanitizeActivityFeed(`.

[S22]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L1794

- **S24** — [`theme-bootstrap.js:3`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/theme-bootstrap.js#L3): `var key =`.

[S24]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/theme-bootstrap.js#L3

- **S25** — [`app.js:19418`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L19418): `el.dashboardView?.addEventListener("click"`.

[S25]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L19418

- **S26** — [`app.js:9191`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L9191): `async function saveBoardToServer(`.

[S26]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L9191

- **S27** — [`app.js:7708`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L7708): `function normalizeStrategyModuleData(`.

[S27]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L7708

- **S28** — [`knowledge-module-dependency-engine.js:158`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/knowledge-module-dependency-engine.js#L158): `function acceptedStrategyFacts(`.

[S28]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/knowledge-module-dependency-engine.js#L158

- **S29** — [`api/_campaign-creation.js:9`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_campaign-creation.js#L9): `async function execute(`.

[S29]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_campaign-creation.js#L9

- **S30** — [`app.js:4131`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L4131): `function normalizeBoardSnapshotProvenance(`.

[S30]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L4131

- **S31** — [`app.js:1713`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L1713): `function getOpenConversationCountForNode(`.

[S31]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L1713

- **S32** — [`api/brands/[id]/learnings.js:5`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/brands/[id]/learnings.js#L5): `module.exports = async function handler(`.

[S32]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/brands/[id]/learnings.js#L5

- **S33** — [`api/ai-brain/advice.js:63`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/ai-brain/advice.js#L63): `module.exports = async function handler(`.

[S33]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/ai-brain/advice.js#L63

- **S34** — [`api/_ai-brain-learning-context.js:90`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_ai-brain-learning-context.js#L90): `async function revalidate(`.

[S34]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_ai-brain-learning-context.js#L90

- **S35** — [`api/_learning-advisor.js:130`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_learning-advisor.js#L130): `async function loadScope(`.

[S35]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/api/_learning-advisor.js#L130

- **S36** — [`app.js:17972`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L17972): `function contentWorkspaceIdentity(`.

[S36]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/app.js#L17972

- **S23** — [`styles.css:8247`](https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/styles.css#L8247): responsive shell containment; also inspect dashboard rules around lines 6200–6300 and dark/reduced-motion rules around 7340–7604.

[S23]: https://github.com/Funklix/Funklix/blob/fd18e8966fc78a702d365c97ef350d3df6b9c771/styles.css#L8247

BW-36.21 START SCREEN INTELLIGENCE AUDIT READY FOR REVIEW
